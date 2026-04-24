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
import type { CombatState, Intent } from "../state/CombatState.js";
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
  unitDied: { unitId: UnitId };
  turnStart: { side: "player" | "enemy"; turn: number };
  turnEnd: { side: "player" | "enemy" };
  combatEnded: { victory: boolean };
  log: { text: string };
}

export interface CombatSetup {
  encounterId: string;
  heroes: { heroClass: HeroClassId; startingDeck: readonly string[]; upgraded?: readonly string[] }[];
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

  constructor(setup: CombatSetup, rng: RNG) {
    this.setup = setup;
    this.rng = rng;
    this.state = this.buildState();
    this.startCombat();
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  private buildState(): CombatState {
    const enc = ENCOUNTER_MAP.get(this.setup.encounterId);
    if (!enc) throw new Error(`Encounter not found: ${this.setup.encounterId}`);
    const gw = enc.gridWidth || Balance.combat.defaultGridWidth;
    const gh = enc.gridHeight || Balance.combat.defaultGridHeight;
    const grid = new Grid(gw, gh);
    if (enc.terrain) for (const patch of enc.terrain) for (const t of patch.tiles) grid.setKind(t, patch.kind);

    // Deck, piles
    const draw: CardInstance[] = [];
    for (const h of this.setup.heroes) {
      const upgraded = new Set(h.upgraded ?? []);
      for (const defId of h.startingDeck) draw.push(makeCardInstance(defId, upgraded.has(defId)));
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
      },
      drawPile: draw,
      hand: [],
      discardPile: [],
      exhaustPile: [],
      intents: new Map(),
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
      const u = createHero(this.setup.heroes[i].heroClass, pos);
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
    // Move innate cards to start of draw pile so they land in hand.
    // (Not critical for this prototype since no innate cards exist.)
    drawCards(this.state, this.state.player.startingHandSize, this.rng, this.state.player.handLimit);
    this.state.phase = "player_turn";
    this.state.turn = 1;
    this.regenerateIntents();
    this.events.emit("turnStart", { side: "player", turn: 1 });
    this.events.emit("stateChanged", { reason: "combat_start" });
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
    }
  }

  heroes(): Unit[] {
    return getAllUnits(this.state, "player");
  }

  enemies(): Unit[] {
    return getAllUnits(this.state, "enemy");
  }

  // ── Intent planning ───────────────────────────────────────────────────────

  regenerateIntents(): void {
    this.state.intents.clear();
    for (const enemy of this.enemies()) {
      const plan = planEnemyAction(this.state, enemy);
      this.state.intents.set(enemy.id, plan.intent);
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

    // Zero-cost bonus damage relic
    if (cost === 0 && this.state.player.relics.includes("scrap_multiplier")) {
      // Applied at damage time by searching relics; this check kept for clarity.
    }

    applyCardEffects({
      state: this.state,
      caster,
      target: t,
      affectedTiles: affected,
      cardDef: def,
      casterMovedThisTurn: movedBefore,
      upgraded: card.upgraded,
      effects,
    });

    // Movement card relic: shield on move card
    if (def.type === "movement" && this.state.player.relics.includes("warding_stride")) {
      caster.statuses["shield"] = (caster.statuses["shield"] ?? 0) + 2;
    }
    if (def.type === "skill" && def.tags.includes("defense") && this.state.player.relics.includes("bulwark_chip")) {
      caster.statuses["shield"] = (caster.statuses["shield"] ?? 0) + 1;
    }

    // Resolve pending draws (from drawCards effects)
    const pending = consumePendingDraws(this.state);
    if (pending > 0) drawCards(this.state, pending, this.rng, this.state.player.handLimit);

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

    // Start-of-turn ticks for enemies
    this.tickStatuses("enemy");

    // Resolve telegraphs (e.g., delayed bombs)
    this.resolveTelegraphs();

    for (const id of this.state.enemyOrder) {
      const enemy = this.state.units.get(id);
      if (!enemy || enemy.dead) continue;
      if ((enemy.statuses["stun"] ?? 0) > 0) {
        this.state.log.push({ ts: Date.now(), kind: "intent", text: `${enemy.name} is stunned.` });
        continue;
      }
      const plan = planEnemyAction(this.state, enemy);
      this.performEnemyAction(enemy, plan);
      this.reapTheDead();
      if (this.checkVictory()) return;
    }

    // End of enemy turn: tick player statuses, start next player turn
    this.tickStatuses("player");
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
    // Start-of-turn relics
    let drawCount = this.state.player.startingHandSize;
    for (const id of this.state.player.relics) {
      if (id === "drawExtra") drawCount += 1; // legacy alias, not used
    }
    drawCards(this.state, drawCount, this.rng, this.state.player.handLimit);
    this.regenerateIntents();
    this.events.emit("turnStart", { side: "player", turn: this.state.turn });
    this.events.emit("stateChanged", { reason: "player_turn_start" });
  }

  private performEnemyAction(enemy: Unit, plan: ReturnType<typeof planEnemyAction>): void {
    const act = plan.action;
    switch (act.kind) {
      case "wait":
        return;
      case "attack": {
        // Move to best position, then hit.
        const target = this.state.units.get(act.targetId);
        if (!target) return;
        this.moveEnemyToward(enemy, target.pos, 1);
        if (manhattan(enemy.pos, target.pos) <= 1) {
          const dmg = enemy.attackDamage ?? 3;
          const res = applyDamage(enemy, target, dmg, this.state);
          this.logAttack(enemy, target, res.hpDamage + res.shieldAbsorbed);
          this.events.emit("damageDealt", { attackerId: enemy.id, defenderId: target.id, amount: res.hpDamage + res.shieldAbsorbed });
          if (res.retaliate > 0) {
            const r = applyDamage(target, enemy, res.retaliate, this.state);
            this.logAttack(target, enemy, r.hpDamage + r.shieldAbsorbed, " (Retaliate)");
          }
        } else {
          // Ranged attack still fires if within attackRange
          if (enemy.attackRange && manhattan(enemy.pos, target.pos) <= enemy.attackRange) {
            const dmg = enemy.attackDamage ?? 3;
            const res = applyDamage(enemy, target, dmg, this.state);
            this.logAttack(enemy, target, res.hpDamage + res.shieldAbsorbed);
            this.events.emit("damageDealt", { attackerId: enemy.id, defenderId: target.id, amount: res.hpDamage + res.shieldAbsorbed });
          }
        }
        return;
      }
      case "charge": {
        const target = this.state.units.get(act.targetId);
        if (!target) return;
        this.moveEnemyToward(enemy, target.pos, 1);
        return;
      }
      case "aoe": {
        // Schedule a telegraph that fires next turn (for bombers). For boss,
        // fire immediately at target tile.
        if (enemy.enemyKind === "boss_cipher") {
          this.applyAoe(enemy, act.targetTile, act.radius, act.predictedDamage);
        } else {
          this.state.telegraphs.push({
            ownerId: enemy.id,
            turnsRemaining: 1,
            tiles: aoeTiles(act.targetTile, act.radius),
            damage: act.predictedDamage,
            label: act.label,
          });
          this.state.log.push({ ts: Date.now(), kind: "intent", text: `${enemy.name} arms a ${act.label}.` });
        }
        return;
      }
      case "buff_ally": {
        const ally = this.state.units.get(act.targetId);
        if (ally) addStatus(this.state, ally, act.status, act.stacks);
        return;
      }
      case "shield_self":
        addStatus(this.state, enemy, "shield", act.amount);
        return;
      case "overwatch":
        // Apply a marker status for UI; behavior consumed on next player move.
        enemy.statuses["overwatch"] = 1;
        this.state.log.push({ ts: Date.now(), kind: "intent", text: `${enemy.name} enters overwatch.` });
        return;
      case "summon_hazard":
        this.state.grid.setKind(act.tile, "hazard");
        this.state.log.push({ ts: Date.now(), kind: "intent", text: `${enemy.name} deploys a hazard.` });
        return;
    }
  }

  private moveEnemyToward(enemy: Unit, target: GridPos, desiredRange: number): void {
    // Greedy step: take up to moveRange steps toward target (ignoring proper
    // pathfinding for simplicity; this is sufficient for open grids).
    if ((enemy.statuses["rooted"] ?? 0) > 0) return;
    for (let i = 0; i < enemy.moveRange; i++) {
      if (manhattan(enemy.pos, target) <= desiredRange) break;
      const dx = Math.sign(target.x - enemy.pos.x);
      const dy = Math.sign(target.y - enemy.pos.y);
      const options: GridPos[] = [];
      if (dx !== 0) options.push({ x: enemy.pos.x + dx, y: enemy.pos.y });
      if (dy !== 0) options.push({ x: enemy.pos.x, y: enemy.pos.y + dy });
      // fall back to any move closer
      const viable = options.find((p) => this.state.grid.isWalkable(p) && !unitAt(this.state, p));
      if (!viable) break;
      enemy.pos = viable;
      if (this.state.grid.getKind(viable) === "hazard") {
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
            this.logAttack(undefined, u, res.hpDamage + res.shieldAbsorbed, ` (${t.label})`);
          }
        }
      } else {
        remaining.push(t);
      }
    }
    this.state.telegraphs = remaining;
  }

  private tickStatuses(side: "player" | "enemy"): void {
    for (const u of getAllUnits(this.state, side)) {
      // Poison ticks
      const poison = u.statuses["poison"] ?? 0;
      if (poison > 0) {
        const res = applyDamage(undefined, u, poison, this.state);
        this.logAttack(undefined, u, res.hpDamage + res.shieldAbsorbed, " (Poison)");
        u.statuses["poison"] = Math.max(0, poison - 1);
      }
      const burn = u.statuses["burn"] ?? 0;
      if (burn > 0) {
        const res = applyDamage(undefined, u, Balance.statuses.burnPerTurnDamage, this.state);
        this.logAttack(undefined, u, res.hpDamage + res.shieldAbsorbed, " (Burn)");
      }
      const regen = u.statuses["regen"] ?? 0;
      if (regen > 0) {
        heal(u, regen);
        u.statuses["regen"] = Math.max(0, regen - 1);
      }
      // Hazard tile damage
      if (!u.dead && this.state.grid.getKind(u.pos) === "hazard") {
        const res = applyDamage(undefined, u, 2, this.state);
        this.logAttack(undefined, u, res.hpDamage + res.shieldAbsorbed, " (Hazard)");
      }
      // Decay / expire
      for (const [k, v] of Object.entries({ ...u.statuses })) {
        if (v <= 0) {
          delete u.statuses[k];
          continue;
        }
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
    for (const u of this.state.units.values()) {
      if (u.dead) {
        this.events.emit("unitDied", { unitId: u.id });
      }
    }
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

