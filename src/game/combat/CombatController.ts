import { EventBus } from "../../core/EventBus.js";
import type { RNG } from "../../core/RNG.js";
import type { GridPos, RelicId, UnitId } from "../../core/Types.js";
import { Balance } from "../../data/balance.js";
import { getCardDef } from "../../data/cards.js";
import { ENCOUNTER_MAP } from "../../data/encounters.js";
import { ENEMY_MAP } from "../../data/enemies.js";
import { planEnemyAction } from "../ai/IntentPlanner.js";
import type { CardInstance } from "../cards/CardTypes.js";
import { discardHand, drawCards, makeCardInstance, shuffleIntoDraw } from "../cards/DeckManager.js";
import { Grid } from "../grid/Grid.js";
import { manhattan } from "../grid/Grid.js";
import type {
  CombatResult,
  CombatState,
  EnemyTurnAction,
  Intent,
  PlannedEnemyAction,
} from "../state/CombatState.js";
import type { HeroClassId } from "../../core/Types.js";
import { createEnemy, createHero } from "../units/UnitFactory.js";
import type { Unit } from "../units/UnitTypes.js";
import { applyDamage, heal } from "./DamageSystem.js";
import {
  addStatus,
  applyCardEffects,
  consumePendingDraws,
} from "./CardEffects.js";
import {
  computeAffectedTiles,
  getAllUnits,
  isValidTarget,
  unitAt,
} from "./TargetingSystem.js";
import { getStatusDef } from "./StatusSystem.js";

/** Events fired by the combat controller. Consumed by the UI + VFX. */
export interface CombatEvents {
  [key: string]: unknown;
  stateChanged: { reason: string };
  cardPlayed: { instance: CardInstance; casterId: UnitId; target?: GridPos };
  damageDealt: { attackerId?: UnitId; defenderId: UnitId; amount: number };
  unitMoved: { unitId: UnitId; from: GridPos; to: GridPos };
  shieldGained: { unitId: UnitId; amount: number };
  statusApplied: { unitId: UnitId; status: string; stacks: number };
  enemyIntentResolved: { enemyId: UnitId; intentKind: string };
  unitDied: { unitId: UnitId };
  turnStart: { side: "player" | "enemy"; turn: number };
  turnEnd: { side: "player" | "enemy" };
  combatEnded: { victory: boolean };
  log: { text: string };
}

export interface CombatSetup {
  encounterId: string;
  heroes: {
    heroClass: HeroClassId;
    /** Current HP carried from the run state. Defaults to maxHp. */
    hp?: number;
    /** Max HP carried from the run state. Defaults to class blueprint. */
    maxHp?: number;
  }[];
  /**
   * Squad-wide deck for this combat. Each entry becomes one CardInstance in
   * the draw pile. Per-hero deck arrays are NOT supported — the squad
   * shares one deck (see `RunState.deck`).
   *
   * Tests can pass plain `{ cardId, upgraded? }` shapes; the controller
   * promotes them to full instances.
   */
  deck: ReadonlyArray<{ instanceId?: string; cardId: string; upgraded?: boolean }>;
  relics: RelicId[];
  seed: number;
}

export class CombatController {
  readonly state: CombatState;
  readonly events = new EventBus<CombatEvents>();
  readonly rng: RNG;
  /** Cached setup in case we need to restart. */
  readonly setup: CombatSetup;
  /** Tracks whose turn-start effects have been processed for this turn. */
  private firstCardDiscountAvailable = false;
  /**
   * Live combat result. Counters are incremented as events occur during
   * combat so the post-combat summary doesn't depend on inspecting the
   * final unit graph (which is unreliable: dead units may get GC'd or
   * reused, and stat tracking has to handle revives, downs, etc.).
   */
  private result: CombatResult = {
    victory: false,
    enemiesDefeated: 0,
    damageDealt: 0,
    damageTaken: 0,
    turnsTaken: 0,
    heroHp: [],
    downedHeroes: [],
  };
  /** Hero ids already counted as "downed" so we don't double-count revives. */
  private downedSet = new Set<UnitId>();

  constructor(setup: CombatSetup, rng: RNG) {
    this.setup = setup;
    this.rng = rng;
    this.state = this.buildState();
    this.wireResultTracking();
    this.startCombat();
  }

  /** Subscribe to events that feed the {@link CombatResult}. */
  private wireResultTracking(): void {
    this.events.on("damageDealt", (p) => {
      const attacker = p.attackerId ? this.state.units.get(p.attackerId) : undefined;
      const defender = this.state.units.get(p.defenderId);
      if (!defender) return;
      if (attacker?.side === "player" && defender.side === "enemy") {
        this.result.damageDealt += p.amount;
      } else if (defender.side === "player") {
        this.result.damageTaken += p.amount;
      }
    });
    this.events.on("unitDied", (p) => {
      const u = this.state.units.get(p.unitId);
      if (!u) return;
      if (u.side === "enemy") {
        this.result.enemiesDefeated += 1;
      } else if (u.side === "player" && !this.downedSet.has(u.id)) {
        this.downedSet.add(u.id);
        this.result.downedHeroes.push(u.id);
      }
    });
  }

  /** Live combat result; finalised when the combat ends. */
  getResult(): CombatResult {
    // Snapshot survivors at request time so callers always see fresh data.
    const heroHp: CombatResult["heroHp"] = [];
    for (const id of this.state.player.heroIds) {
      const u = this.state.units.get(id);
      if (!u || u.dead) continue;
      heroHp.push({ unitId: u.id, heroClass: u.heroClass ?? "?", hp: u.hp, maxHp: u.maxHp });
    }
    return {
      ...this.result,
      heroHp,
      turnsTaken: this.state.turn,
      victory: this.state.phase === "victory",
    };
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  private buildState(): CombatState {
    const enc = ENCOUNTER_MAP.get(this.setup.encounterId);
    if (!enc) throw new Error(`Encounter not found: ${this.setup.encounterId}`);
    const gw = enc.gridWidth || Balance.combat.defaultGridWidth;
    const gh = enc.gridHeight || Balance.combat.defaultGridHeight;
    const grid = new Grid(gw, gh);
    if (enc.terrain) for (const patch of enc.terrain) for (const t of patch.tiles) grid.setKind(t, patch.kind);

    // Squad deck → draw pile. Each run-level instance becomes one in-combat
    // CardInstance, preserving its upgrade flag independently from siblings
    // sharing the same `cardId`.
    const draw: CardInstance[] = [];
    for (const inst of this.setup.deck) {
      draw.push(makeCardInstance(inst.cardId, inst.upgraded === true));
    }

    const state: CombatState = {
      grid,
      units: new Map(),
      player: {
        energy: Balance.player.startingEnergy,
        maxEnergy: Balance.player.startingEnergy,
        handLimit: Balance.player.handLimit,
        startingHandSize: Balance.player.handSize,
        heroIds: [],
        relics: this.setup.relics.slice(),
        movedHeroesThisTurn: new Set(),
        attacksThisTurn: 0,
        cardsPlayedThisTurn: 0,
        preventLethalCharges: this.setup.relics.includes("failsafe_core") ? 1 : 0,
        zeroCostCardActive: false,
        deathEventsEmitted: new Set(),
      },
      drawPile: draw,
      hand: [],
      discardPile: [],
      exhaustPile: [],
      intents: new Map(),
      plannedActions: new Map(),
      telegraphs: [],
      log: [],
      phase: "intro",
      turn: 0,
      activeSide: "player",
      enemyOrder: [],
      debug: { overlay: false, revealIntents: false },
    };

    // Place heroes at the left side of the grid
    for (let i = 0; i < this.setup.heroes.length; i++) {
      const pos: GridPos = { x: 1, y: 1 + i * 2 };
      const runHero = this.setup.heroes[i];
      const u = createHero(runHero.heroClass, pos, {
        hp: runHero.hp,
        maxHp: runHero.maxHp,
      });
      state.units.set(u.id, u);
      state.player.heroIds.push(u.id);
    }

    // Place enemies from encounter
    let spawnIdx = 0;
    for (const spawn of enc.spawns) {
      const x = spawn.x ?? gw - 2 - (spawnIdx % 3);
      const y = spawn.y ?? 1 + spawnIdx;
      const bp = ENEMY_MAP.get(spawn.kind);
      const baseHp = bp?.maxHp ?? 10;
      const mult =
        enc.kind === "boss" ? Balance.difficulty.bossHpMultiplier :
        enc.kind === "elite" ? Balance.difficulty.eliteHpMultiplier : 1;
      const hp = Math.round(baseHp * mult);
      const u = createEnemy(spawn.kind, { x, y }, hp);
      if (bp && enc.tier >= 3 && u.attackDamage) {
        u.attackDamage += Balance.difficulty.tier3DamageBonus;
      }
      state.units.set(u.id, u);
      state.enemyOrder.push(u.id);
      spawnIdx += 1;
    }

    return state;
  }

  private startCombat(): void {
    // Apply onCombatStart relics
    this.applyCombatStartRelics();
    // Shuffle and draw starting hand
    shuffleIntoDraw(this.state, this.rng);
    // Move innate cards to the front of the draw pile so they always enter
    // the opening hand regardless of draw order.
    const innate: typeof this.state.drawPile = [];
    const normal: typeof this.state.drawPile = [];
    for (const card of this.state.drawPile) {
      const def = getCardDef(card.defId);
      if (def.innate) innate.push(card);
      else normal.push(card);
    }
    this.state.drawPile = [...innate, ...normal];
    this.drawCardsWithSideEffects(this.state.player.startingHandSize);
    this.state.phase = "player_turn";
    this.state.turn = 1;
    // First-card discount is available from the first turn onward.
    this.firstCardDiscountAvailable = this.state.player.relics.includes("first_move");
    // Grant energy from energy tiles on turn 1.
    this.grantEnergyTileBonuses();
    this.regenerateIntents();
    this.events.emit("turnStart", { side: "player", turn: 1 });
    this.events.emit("stateChanged", { reason: "combat_start" });
  }

  /**
   * Grants +1 energy for each hero currently standing on an energy tile.
   * Called at the start of every player turn.
   */
  private grantEnergyTileBonuses(): void {
    const seen = new Set<string>();
    for (const h of this.heroes()) {
      const key = `${h.pos.x},${h.pos.y}`;
      if (seen.has(key)) continue;
      if (this.state.grid.getKind(h.pos) === "energy") {
        seen.add(key);
        this.state.player.energy += 1;
        this.state.log.push({
          ts: Date.now(),
          kind: "info",
          text: `${h.name} taps an energy node (+1 energy).`,
        });
      }
    }
  }

  /**
   * Draw cards and apply on-draw side effects (e.g. Glitch curse drains
   * 1 energy per copy drawn). Returns the number of cards actually drawn.
   */
  private drawCardsWithSideEffects(n: number): number {
    const drawn = drawCards(this.state, n, this.rng, this.state.player.handLimit);
    for (const card of drawn) {
      if (card.defId === "glitch") {
        this.state.player.energy = Math.max(0, this.state.player.energy - 1);
        this.state.log.push({
          ts: Date.now(),
          kind: "info",
          text: "Glitch drained 1 energy on draw.",
        });
      }
    }
    return drawn.length;
  }

  private applyCombatStartRelics(): void {
    for (const id of this.state.player.relics) {
      if (id === "resonant_plating") {
        for (const h of this.heroes()) h.statuses["shield"] = (h.statuses["shield"] ?? 0) + 4;
      }
      if (id === "pulse_battery") this.state.player.energy += 1;
      if (id === "cipher_shard") {
        this.state.player.maxEnergy += 1;
        this.state.player.energy += 1;
      }
      if (id === "echo_frame") {
        for (const h of this.heroes()) h.statuses["regen"] = (h.statuses["regen"] ?? 0) + 2;
      }
      if (id === "entropy_coil") {
        for (const e of this.enemies()) e.statuses["burn"] = (e.statuses["burn"] ?? 0) + 2;
        this.state.log.push({ ts: Date.now(), kind: "status", text: "Entropy Coil ignites all enemies." });
      }
    }
    // Class-based passives: each hero gets a small identity boost at the
    // start of every combat. These reinforce the hero's intended role.
    for (const h of this.heroes()) {
      if (h.heroClass === "vanguard") {
        // Frontliner: starts braced.
        h.statuses["shield"] = (h.statuses["shield"] ?? 0) + 3;
      } else if (h.heroClass === "riftblade") {
        // Striker: starts with +1 Strength so the first burst hurts.
        h.statuses["strength"] = (h.statuses["strength"] ?? 0) + 1;
      } else if (h.heroClass === "signalist") {
        // Control: auto-Marks the nearest enemy for 2 turns.
        const nearest = this.nearestEnemyTo(h.pos);
        if (nearest) {
          nearest.statuses["marked"] = Math.max(nearest.statuses["marked"] ?? 0, 2);
        }
      }
    }
  }

  private nearestEnemyTo(pos: GridPos): Unit | undefined {
    let best: Unit | undefined;
    let bestDist = Infinity;
    for (const e of this.enemies()) {
      const d = Math.abs(e.pos.x - pos.x) + Math.abs(e.pos.y - pos.y);
      if (d < bestDist) { best = e; bestDist = d; }
    }
    return best;
  }

  heroes(): Unit[] {
    return getAllUnits(this.state, "player");
  }

  enemies(): Unit[] {
    return getAllUnits(this.state, "enemy");
  }

  // ── Intent planning ───────────────────────────────────────────────────────

  /**
   * Recompute intents AND concrete planned actions for every living enemy.
   * Both are stored so the enemy turn never re-plans — the action the
   * player saw in the intent line is the one that runs.
   */
  regenerateIntents(): void {
    this.state.intents.clear();
    this.state.plannedActions.clear();
    for (const enemy of this.enemies()) {
      const plan = planEnemyAction(this.state, enemy);
      this.state.intents.set(enemy.id, plan.intent);
      this.state.plannedActions.set(enemy.id, plan);
    }
  }

  getIntent(enemyId: UnitId): Intent | undefined {
    return this.state.intents.get(enemyId);
  }

  // ── Playing cards ─────────────────────────────────────────────────────────

  effectiveCost(card: CardInstance): number {
    const def = getCardDef(card.defId);
    const base = (card.upgraded && def.upgradedCost !== undefined) ? def.upgradedCost : def.cost;
    let cost = Math.max(0, base + card.costModifier);
    if (this.firstCardDiscountAvailable && this.state.player.relics.includes("first_move")) {
      cost = Math.max(0, cost - 1);
    }
    return cost;
  }

  canPlay(card: CardInstance, casterId: UnitId, target: GridPos | null): boolean {
    const def = getCardDef(card.defId);
    if (def.unplayable) return false;
    if (this.state.phase !== "player_turn") return false;
    const caster = this.state.units.get(casterId);
    if (!caster || caster.dead) return false;
    if (this.state.player.energy < this.effectiveCost(card)) return false;
    if (def.targeting.kind === "self" || def.targeting.kind === "none" || def.targeting.kind === "allEnemies" || def.targeting.kind === "allAllies") {
      return true;
    }
    if (!target) return false;
    return isValidTarget(this.state, caster, def, target);
  }

  /**
   * Play a card. Returns true on success. On success the card is removed
   * from hand, effects resolve, and events fire.
   */
  playCard(card: CardInstance, casterId: UnitId, target: GridPos | null): boolean {
    const def = getCardDef(card.defId);
    if (!this.canPlay(card, casterId, target)) return false;
    const caster = this.state.units.get(casterId)!;
    const t: GridPos = target ?? caster.pos;

    const cost = this.effectiveCost(card);
    this.state.player.energy -= cost;
    // First-card discount is consumed
    if (this.firstCardDiscountAvailable) this.firstCardDiscountAvailable = false;

    // Remove from hand
    this.state.hand = this.state.hand.filter((c) => c !== card);

    // Track if the caster moved this turn prior to effects
    const movedBefore = this.state.player.movedHeroesThisTurn.has(caster.id);

    // Compute affected tiles for effects that need them (push, AoE, etc.)
    const affected = computeAffectedTiles(this.state, caster, def, t);
    const effects = (card.upgraded && def.upgradedEffects) ? def.upgradedEffects : def.effects;

    // Zero-cost bonus damage relic (scrap_multiplier): set flag so the
    // damage system can consume it during this card's effects.
    const hadScrap = cost === 0 && this.state.player.relics.includes("scrap_multiplier");
    this.state.player.zeroCostCardActive = hadScrap;

    applyCardEffects({
      state: this.state,
      caster,
      target: t,
      affectedTiles: affected,
      cardDef: def,
      casterMovedThisTurn: movedBefore,
      upgraded: card.upgraded,
      effects,
      reportDamage: (e) => this.events.emit("damageDealt", e),
    });

    // Always clear the flag after resolution.
    this.state.player.zeroCostCardActive = false;

    // Movement card relic: shield on move card
    if (def.type === "movement" && this.state.player.relics.includes("warding_stride")) {
      caster.statuses["shield"] = (caster.statuses["shield"] ?? 0) + 2;
      this.events.emit("shieldGained", { unitId: caster.id, amount: 2 });
    }
    if (def.type === "skill" && def.tags.includes("defense") && this.state.player.relics.includes("bulwark_chip")) {
      caster.statuses["shield"] = (caster.statuses["shield"] ?? 0) + 1;
      this.events.emit("shieldGained", { unitId: caster.id, amount: 1 });
    }

    // Resolve pending draws (from drawCards effects)
    const pending = consumePendingDraws(this.state);
    if (pending > 0) this.drawCardsWithSideEffects(pending);

    // Exhaust / discard
    if (def.exhaust) this.state.exhaustPile.push(card);
    else this.state.discardPile.push(card);

    // Process deaths
    this.reapTheDead();

    this.state.player.cardsPlayedThisTurn += 1;
    this.events.emit("cardPlayed", { instance: card, casterId, target: target ?? undefined });
    this.regenerateIntents();
    this.checkVictory();
    this.events.emit("stateChanged", { reason: "card_played" });
    return true;
  }

  // ── Turn flow ─────────────────────────────────────────────────────────────

  endPlayerTurn(): void {
    if (this.state.phase !== "player_turn") return;
    this.events.emit("turnEnd", { side: "player" });
    // End-of-turn relic ticks
    for (const id of this.state.player.relics) {
      if (id === "sweeping_lens") {
        for (const e of this.enemies()) {
          if ((e.statuses["marked"] ?? 0) > 0) {
            const res = applyDamage(undefined, e, 1, this.state);
            this.state.log.push({
              ts: Date.now(),
              kind: "relic",
              text: `Sweeping Lens ticks ${e.name} for ${res.hpDamage + res.shieldAbsorbed}.`,
            });
          }
        }
      }
    }
    // Objective tiles: each hero standing on one gains 2 Shield.
    for (const h of this.heroes()) {
      if (this.state.grid.getKind(h.pos) === "objective") {
        h.statuses["shield"] = (h.statuses["shield"] ?? 0) + 2;
        this.events.emit("shieldGained", { unitId: h.id, amount: 2 });
        this.state.log.push({
          ts: Date.now(),
          kind: "status",
          text: `${h.name} holds the objective (+2 Shield).`,
        });
      }
    }
    // Decay player-owned statuses at the end of the player's turn.
    this.decayStatuses("player");
    this.reapTheDead();
    discardHand(this.state);
    this.state.phase = "enemy_turn";
    this.state.activeSide = "enemy";
    this.events.emit("stateChanged", { reason: "player_turn_end" });
  }

  /**
   * Resolve the enemy turn. Returns a list of mini-animations the renderer
   * can play sequentially. We treat the simulation as synchronous here;
   * the renderer can sequence time via the event stream.
   */
  resolveEnemyTurn(): void {
    if (this.state.phase !== "enemy_turn") return;
    this.events.emit("turnStart", { side: "enemy", turn: this.state.turn });

    // Start-of-turn damage-over-time ticks for enemies (but not decay).
    this.tickDotsAndHazard("enemy");
    this.reapTheDead();
    if (this.checkVictory()) return;

    // Resolve telegraphs (e.g., delayed bombs)
    this.resolveTelegraphs();
    this.reapTheDead();
    if (this.checkVictory()) return;

    for (const id of this.state.enemyOrder) {
      const enemy = this.state.units.get(id);
      if (!enemy || enemy.dead) continue;
      // Stun check happens BEFORE decay so a stun applied last turn still
      // prevents this turn's action.
      if ((enemy.statuses["stun"] ?? 0) > 0) {
        this.state.log.push({ ts: Date.now(), kind: "intent", text: `${enemy.name} is stunned.` });
        continue;
      }
      // Use the action that was planned at intent time. Falling back to a
      // fresh plan only when no plan exists (e.g. enemies summoned mid-turn)
      // keeps the no-replanning invariant: what the player saw is what runs.
      const plan = this.state.plannedActions.get(enemy.id) ?? planEnemyAction(this.state, enemy);
      this.performEnemyAction(enemy, plan);
      this.reapTheDead();
      if (this.checkVictory()) return;
    }

    // Decay enemy-owned statuses at the end of the enemy's turn.
    this.decayStatuses("enemy");
    // Start-of-turn DoTs for the player side (happen at their new turn).
    this.tickDotsAndHazard("player");
    this.reapTheDead();
    if (this.checkVictory()) return;

    this.state.turn += 1;
    this.state.phase = "player_turn";
    this.state.activeSide = "player";
    this.state.player.energy = this.state.player.maxEnergy;
    this.state.player.attacksThisTurn = 0;
    this.state.player.cardsPlayedThisTurn = 0;
    this.state.player.movedHeroesThisTurn.clear();
    this.firstCardDiscountAvailable = this.state.player.relics.includes("first_move");
    // Energy-tile start-of-turn grants.
    this.grantEnergyTileBonuses();
    // Start-of-turn relics — accumulate extra draws.
    let drawCount = this.state.player.startingHandSize;
    for (const id of this.state.player.relics) {
      if (id === "tactical_reserve") drawCount += 1;
    }
    this.drawCardsWithSideEffects(drawCount);
    this.regenerateIntents();
    this.events.emit("turnStart", { side: "player", turn: this.state.turn });
    this.events.emit("stateChanged", { reason: "player_turn_start" });
  }

  private performEnemyAction(enemy: Unit, plan: PlannedEnemyAction): void {
    const act: EnemyTurnAction = plan.action;
    this.events.emit("enemyIntentResolved", { enemyId: enemy.id, intentKind: act.kind });
    switch (act.kind) {
      case "wait":
        return;
      case "attack": {
        const target = this.state.units.get(act.targetId);
        if (!target || target.dead) return;
        // Walk the planned path step-by-step, respecting blockers and
        // statuses. The path was computed against the same state the
        // intent saw, so this matches the player's preview.
        if ((enemy.statuses["rooted"] ?? 0) === 0) this.followPath(enemy, act.movePath);
        const reach = enemy.attackRange ?? 1;
        if (manhattan(enemy.pos, target.pos) <= reach) {
          const dmg = act.damage;
          const res = applyDamage(enemy, target, dmg, this.state);
          const total = res.hpDamage + res.shieldAbsorbed;
          this.logAttack(enemy, target, total);
          this.events.emit("damageDealt", { attackerId: enemy.id, defenderId: target.id, amount: total });
          if (res.retaliate > 0) {
            const r = applyDamage(target, enemy, res.retaliate, this.state);
            this.logAttack(target, enemy, r.hpDamage + r.shieldAbsorbed, " (Retaliate)");
          }
          // Apply statuses promised by the intent (e.g. parasite Poison/Weak).
          if (act.appliesStatuses && !target.dead) {
            for (const s of act.appliesStatuses) addStatus(this.state, target, s.status, s.stacks);
          }
        }
        // Charged shots consume the charging status the moment they fire.
        if ((enemy.statuses["charging"] ?? 0) > 0) delete enemy.statuses["charging"];
        return;
      }
      case "move": {
        if ((enemy.statuses["rooted"] ?? 0) > 0) return;
        this.followPath(enemy, act.movePath);
        return;
      }
      case "prepare_charge": {
        // Lock the enemy into a charged state. The planner will fire on the
        // next plan because `charging > 0`.
        enemy.statuses["charging"] = 1;
        this.state.log.push({
          ts: Date.now(),
          kind: "intent",
          text: `${enemy.name} charges a heavy shot (${act.chargedDamage} incoming).`,
        });
        return;
      }
      case "aoe": {
        if (act.delay > 0) {
          this.state.telegraphs.push({
            ownerId: enemy.id,
            turnsRemaining: act.delay,
            tiles: aoeTiles(act.targetTile, act.radius),
            damage: act.predictedDamage,
            label: act.label,
          });
          this.state.log.push({ ts: Date.now(), kind: "intent", text: `${enemy.name} arms a ${act.label}.` });
        } else {
          this.applyAoe(enemy, act.targetTile, act.radius, act.predictedDamage);
        }
        return;
      }
      case "buff_ally": {
        const ally = this.state.units.get(act.targetId);
        if (ally) {
          addStatus(this.state, ally, act.status, act.stacks);
          this.events.emit("statusApplied", { unitId: ally.id, status: act.status, stacks: act.stacks });
        }
        return;
      }
      case "shield_self":
        addStatus(this.state, enemy, "shield", act.amount);
        this.events.emit("shieldGained", { unitId: enemy.id, amount: act.amount });
        return;
      case "overwatch":
        // Apply a marker status for UI; behavior consumed on next player move.
        enemy.statuses["overwatch"] = 1;
        this.events.emit("statusApplied", { unitId: enemy.id, status: "overwatch", stacks: 1 });
        this.state.log.push({ ts: Date.now(), kind: "intent", text: `${enemy.name} enters overwatch.` });
        return;
      case "summon_hazard":
        this.state.grid.setKind(act.tile, "hazard");
        this.state.log.push({ ts: Date.now(), kind: "intent", text: `${enemy.name} deploys a hazard.` });
        return;
    }
  }

  /**
   * Step the enemy along the planned path until blocked or finished. Each
   * step re-checks walkability and occupation in case the player altered
   * the world between planning and execution. Hazard tiles damage the unit
   * exactly as before.
   */
  private followPath(enemy: Unit, path: GridPos[]): void {
    let stepsLeft = enemy.moveRange;
    for (const step of path) {
      if (stepsLeft <= 0) break;
      if (!this.state.grid.isWalkable(step)) break;
      const occ = unitAt(this.state, step);
      if (occ && occ.id !== enemy.id) break;
      const from = { x: enemy.pos.x, y: enemy.pos.y };
      enemy.pos = { x: step.x, y: step.y };
      this.events.emit("unitMoved", { unitId: enemy.id, from, to: { x: step.x, y: step.y } });
      stepsLeft -= 1;
      if (this.state.grid.getKind(enemy.pos) === "hazard") {
        const res = applyDamage(undefined, enemy, 3, this.state);
        this.logAttack(undefined, enemy, res.hpDamage + res.shieldAbsorbed, " (Hazard)");
      }
    }
  }

  private applyAoe(source: Unit | undefined, center: GridPos, radius: number, damage: number): void {
    for (const tile of aoeTiles(center, radius)) {
      const u = unitAt(this.state, tile);
      if (u && u.side === "player") {
        const res = applyDamage(source, u, damage, this.state);
        this.logAttack(source, u, res.hpDamage + res.shieldAbsorbed, " (AoE)");
        this.events.emit("damageDealt", { attackerId: source?.id, defenderId: u.id, amount: res.hpDamage + res.shieldAbsorbed });
      }
    }
  }

  private resolveTelegraphs(): void {
    const remaining: typeof this.state.telegraphs = [];
    for (const t of this.state.telegraphs) {
      t.turnsRemaining -= 1;
      if (t.turnsRemaining <= 0) {
        for (const tile of t.tiles) {
          const u = unitAt(this.state, tile);
          if (u && u.side === "player") {
            const res = applyDamage(undefined, u, t.damage, this.state);
            const total = res.hpDamage + res.shieldAbsorbed;
            this.logAttack(undefined, u, total, ` (${t.label})`);
            // Emit a damageDealt event so the result tracker accounts for
            // telegraph hits as damage taken.
            if (total > 0) this.events.emit("damageDealt", { defenderId: u.id, amount: total });
          }
        }
      } else {
        remaining.push(t);
      }
    }
    this.state.telegraphs = remaining;
  }

  /**
   * Apply start-of-turn damage-over-time effects (poison, burn, regen) and
   * environmental hazards for all units of the given side. Does NOT decay
   * generic statuses — decay is performed separately at end of that side's
   * turn by {@link decayStatuses}.
   */
  private tickDotsAndHazard(side: "player" | "enemy"): void {
    for (const u of getAllUnits(this.state, side)) {
      if (u.dead) continue;
      const poison = u.statuses["poison"] ?? 0;
      if (poison > 0) {
        const res = applyDamage(undefined, u, poison, this.state);
        this.logAttack(undefined, u, res.hpDamage + res.shieldAbsorbed, " (Poison)");
        // Poison decays per tick on the affected unit's own turn.
        u.statuses["poison"] = Math.max(0, poison - 1);
        if (u.statuses["poison"] <= 0) delete u.statuses["poison"];
      }
      const burn = u.statuses["burn"] ?? 0;
      if (burn > 0) {
        const burnDmg = Balance.statuses.burnPerTurnDamage * burn;
        const res = applyDamage(undefined, u, burnDmg, this.state);
        this.logAttack(undefined, u, res.hpDamage + res.shieldAbsorbed, " (Burn)");
      }
      const regen = u.statuses["regen"] ?? 0;
      if (regen > 0) {
        heal(u, regen);
        u.statuses["regen"] = Math.max(0, regen - 1);
        if (u.statuses["regen"] <= 0) delete u.statuses["regen"];
      }
      // Hazard tile damage
      if (!u.dead && this.state.grid.getKind(u.pos) === "hazard") {
        const res = applyDamage(undefined, u, 2, this.state);
        this.logAttack(undefined, u, res.hpDamage + res.shieldAbsorbed, " (Hazard)");
      }
    }
  }

  /**
   * Decay or expire generic statuses for all units of the given side. Runs
   * at the END of that side's turn so that a status applied at any point
   * during a turn still takes full effect before ticking down.
   */
  private decayStatuses(side: "player" | "enemy"): void {
    for (const u of getAllUnits(this.state, side)) {
      for (const [k, v] of Object.entries({ ...u.statuses })) {
        if (v <= 0) {
          delete u.statuses[k];
          continue;
        }
        // Poison/regen are self-decayed in tickDotsAndHazard; skip here to
        // avoid double-decay.
        if (k === "poison" || k === "regen") continue;
        const def = getStatusDef(k);
        if (!def) continue;
        if (def.behavior === "decayEachTurn") u.statuses[k] = v - 1;
        else if (def.behavior === "expireEachTurn") u.statuses[k] = 0;
        if (u.statuses[k] <= 0) delete u.statuses[k];
      }
    }
  }

  // ── Death / victory ───────────────────────────────────────────────────────

  private reapTheDead(): void {
    const emitted = this.state.player.deathEventsEmitted ?? new Set<UnitId>();
    for (const u of this.state.units.values()) {
      if (u.dead && !emitted.has(u.id)) {
        emitted.add(u.id);
        this.events.emit("unitDied", { unitId: u.id });
      }
    }
    this.state.player.deathEventsEmitted = emitted;
  }

  private checkVictory(): boolean {
    const enemiesAlive = this.enemies().length > 0;
    const heroesAlive = this.heroes().length > 0;
    if (!heroesAlive) {
      this.state.phase = "defeat";
      this.events.emit("combatEnded", { victory: false });
      return true;
    }
    if (!enemiesAlive) {
      this.state.phase = "victory";
      this.events.emit("combatEnded", { victory: true });
      return true;
    }
    return false;
  }

  private logAttack(source: Unit | undefined, defender: Unit, amount: number, suffix = ""): void {
    if (amount <= 0) return;
    this.state.log.push({
      ts: Date.now(),
      kind: "damage",
      text: `${source ? source.name : "?"} → ${defender.name} for ${amount}${suffix}.`,
    });
  }
}

function aoeTiles(center: GridPos, r: number): GridPos[] {
  const out: GridPos[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      out.push({ x: center.x + dx, y: center.y + dy });
    }
  }
  return out;
}

// (no unused guards)

