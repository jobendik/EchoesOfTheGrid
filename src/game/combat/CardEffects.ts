import type { GridPos, KeywordId } from "../../core/Types.js";
import { manhattan } from "../grid/Grid.js";
import { applyDamage, gainShield, heal } from "./DamageSystem.js";
import type { CombatState } from "../state/CombatState.js";
import type { Unit } from "../units/UnitTypes.js";
import type {
  CardDefinition,
  CardEffectDefinition,
} from "../cards/CardTypes.js";
import { getAllUnits, unitAt, unitsOnTiles } from "./TargetingSystem.js";
import { makeCardInstance } from "../cards/DeckManager.js";

/**
 * The effect resolver. Each effect kind maps to a small handler so adding a
 * new card effect means adding one case. All handlers mutate `state` and
 * append to `state.log`.
 */

export interface EffectContext {
  state: CombatState;
  caster: Unit;
  target: GridPos;
  affectedTiles: GridPos[];
  cardDef: CardDefinition;
  /** Was the card played after the caster moved this turn? */
  casterMovedThisTurn: boolean;
  /** True for upgraded card effect lists. */
  upgraded: boolean;
  /** Effect list being used (upgraded or base). */
  effects: readonly CardEffectDefinition[];
}

export function applyCardEffects(ctx: EffectContext): void {
  for (const eff of ctx.effects) applyEffect(eff, ctx);
}

function applyEffect(eff: CardEffectDefinition, ctx: EffectContext): void {
  const { state, caster, target, affectedTiles } = ctx;
  switch (eff.kind) {
    case "damage": {
      for (const u of targetedUnits(ctx, "enemy")) {
        const res = applyDamage(caster, u, eff.amount, state);
        logDamage(state, caster, u, res.hpDamage + res.shieldAbsorbed, res.killed);
        if (res.retaliate > 0 && !caster.dead) {
          const r = applyDamage(u, caster, res.retaliate, state);
          logDamage(state, u, caster, r.hpDamage + r.shieldAbsorbed, r.killed, " (Retaliate)");
        }
        if (res.killed) state.player.relics.includes("vampiric_chip") && healLowestHero(state, 2);
      }
      if (caster.side === "player") state.player.attacksThisTurn += 1;
      break;
    }
    case "damageMarkedBonus": {
      for (const u of targetedUnits(ctx, "enemy")) {
        if ((u.statuses["marked"] ?? 0) > 0) {
          const res = applyDamage(caster, u, eff.amount, state);
          logDamage(state, caster, u, res.hpDamage + res.shieldAbsorbed, res.killed, " (Marked bonus)");
        }
      }
      break;
    }
    case "damageIfMoved": {
      if (!ctx.casterMovedThisTurn) break;
      for (const u of targetedUnits(ctx, "enemy")) {
        const res = applyDamage(caster, u, eff.amount, state);
        logDamage(state, caster, u, res.hpDamage + res.shieldAbsorbed, res.killed, " (Momentum)");
      }
      break;
    }
    case "damageIfBelowHp": {
      for (const u of targetedUnits(ctx, "enemy")) {
        const baseDmg = ctx.cardDef.id === "finisher" ? (ctx.upgraded ? 14 : 10) : 0;
        const dmg = u.hp <= u.maxHp * eff.threshold ? eff.amount : baseDmg;
        const res = applyDamage(caster, u, dmg, state);
        logDamage(state, caster, u, res.hpDamage + res.shieldAbsorbed, res.killed);
      }
      if (caster.side === "player") state.player.attacksThisTurn += 1;
      break;
    }
    case "heal": {
      for (const u of targetedUnits(ctx, "ally")) {
        const healed = heal(u, eff.amount);
        if (healed > 0) state.log.push({ ts: Date.now(), kind: "heal", text: `${u.name} healed ${healed} HP.` });
      }
      break;
    }
    case "shield": {
      gainShield(caster, eff.amount);
      state.log.push({ ts: Date.now(), kind: "status", text: `${caster.name} gains ${eff.amount} Shield.` });
      break;
    }
    case "shieldAllAllies": {
      for (const u of getAllUnits(state, "player")) {
        gainShield(u, eff.amount);
      }
      state.log.push({ ts: Date.now(), kind: "status", text: `All allies gain ${eff.amount} Shield.` });
      break;
    }
    case "applyStatus": {
      const units = targetedUnits(ctx, ctx.cardDef.targeting.kind === "ally" || ctx.cardDef.targeting.kind === "self" ? "ally" : "enemy");
      for (const u of units) addStatus(state, u, eff.status, eff.stacks);
      break;
    }
    case "applyStatusSelf": {
      addStatus(state, caster, eff.status, eff.stacks);
      break;
    }
    case "applyStatusInArea": {
      // Apply to units actually on the computed affected tiles, respecting
      // the card's area shape (e.g. radius/cone) and chosen side.
      const side = eff.side === "enemy" ? "enemy" : "player";
      const tiles = affectedTiles.length ? affectedTiles : [target];
      const sideForQuery = side === "enemy" ? "enemy" : "ally";
      for (const u of unitsOnTiles(state, tiles, sideForQuery)) {
        addStatus(state, u, eff.status, eff.stacks);
      }
      break;
    }
    case "applyStatusAll": {
      const side = eff.side === "enemy" ? "enemy" : "player";
      for (const u of getAllUnits(state, side)) addStatus(state, u, eff.status, eff.stacks);
      break;
    }
    case "drawCards":
      // handled in caller via CombatController (which owns the RNG). We
      // enqueue a log and bump a counter; the controller post-processes.
      state.player.cardsPlayedThisTurn += 0; // no-op, kept explicit
      deferredDraw(state, eff.amount);
      break;
    case "drawIfMoved":
      if (ctx.casterMovedThisTurn) deferredDraw(state, eff.amount);
      break;
    case "gainEnergy":
      state.player.energy += eff.amount;
      state.log.push({ ts: Date.now(), kind: "info", text: `+${eff.amount} energy.` });
      break;
    case "exhaustSelf":
      // Handled by controller when processing the played card.
      break;
    case "moveSelf": {
      // Move the caster to the tile adjacent to target closest to the target.
      const destinations = adjacentEmpty(state, target);
      const destination = destinations.sort((a, b) => manhattan(caster.pos, a) - manhattan(caster.pos, b))[0];
      if (destination && manhattan(caster.pos, destination) <= eff.distance + 1) {
        moveUnit(state, caster, destination);
      }
      break;
    }
    case "moveTarget": {
      const u = unitAt(state, target);
      if (!u && ctx.cardDef.targeting.kind === "emptyTile") {
        // Move the first hero (caster) to that tile.
        if (manhattan(caster.pos, target) <= eff.distance && state.grid.isWalkable(target)) {
          moveUnit(state, caster, target);
        }
      } else if (u) {
        // Nudge them to an adjacent tile chosen deterministically.
        const free = adjacentEmpty(state, u.pos).filter((p) => manhattan(p, u.pos) <= eff.distance);
        if (free.length > 0) moveUnit(state, u, free[0]);
      }
      break;
    }
    case "push": {
      for (const u of targetedUnits(ctx, "enemy")) pushOrPull(state, caster, u, eff.distance, "push");
      break;
    }
    case "pull": {
      for (const u of targetedUnits(ctx, "enemy")) pushOrPull(state, caster, u, eff.distance, "pull");
      break;
    }
    case "swapPositions": {
      const u = unitAt(state, target);
      if (u && u.side === "player" && u.id !== caster.id) {
        const a = { ...caster.pos };
        caster.pos = { ...u.pos };
        u.pos = a;
        state.log.push({ ts: Date.now(), kind: "info", text: `${caster.name} swaps with ${u.name}.` });
      }
      break;
    }
    case "summonHazard": {
      state.grid.setKind(target, "hazard");
      state.log.push({ ts: Date.now(), kind: "info", text: "A hazard is deployed." });
      break;
    }
    case "mark": {
      for (const u of targetedUnits(ctx, "enemy")) addStatus(state, u, "marked", eff.stacks);
      break;
    }
    case "stun": {
      for (const u of targetedUnits(ctx, "enemy")) addStatus(state, u, "stun", eff.stacks);
      break;
    }
    case "revealIntents":
      state.debug.revealIntents = true;
      state.log.push({ ts: Date.now(), kind: "info", text: "Enemy intents scanned." });
      break;
    case "chainDamage": {
      const first = unitAt(state, target);
      if (!first || first.side !== "enemy") break;
      const hit = new Set<string>();
      let cur: Unit | undefined = first;
      let jumps = eff.jumps + 1;
      while (cur && jumps > 0) {
        hit.add(cur.id);
        const res = applyDamage(caster, cur, eff.amount, state);
        logDamage(state, caster, cur, res.hpDamage + res.shieldAbsorbed, res.killed, " (Chain)");
        jumps -= 1;
        const next = nearestUnseenEnemy(state, cur.pos, hit);
        cur = next;
      }
      if (caster.side === "player") state.player.attacksThisTurn += 1;
      break;
    }
    case "addCardToHand": {
      const inst = makeCardInstance(eff.cardId);
      for (let i = 0; i < eff.count; i++) state.hand.push(inst);
      break;
    }
    case "modifyCostThisTurn":
      for (const c of state.hand) c.costModifier += eff.amount;
      break;
    case "loseHp":
      for (const u of targetedUnits(ctx, "ally")) {
        u.hp = Math.max(1, u.hp - eff.amount);
      }
      break;
  }

  // Discard affected tiles warning to keep eslint happy if unused.
  void affectedTiles;
}

function targetedUnits(ctx: EffectContext, side: "enemy" | "ally" | "any"): Unit[] {
  const { state, caster, cardDef, target, affectedTiles } = ctx;
  switch (cardDef.targeting.kind) {
    case "self":
      return side === "ally" || side === "any" ? [caster] : [];
    case "allEnemies":
      // System Crash targets all enemies below 50% HP when it's the effect.
      if (cardDef.id === "system_crash") {
        return getAllUnits(state, "enemy").filter((u) => u.hp <= u.maxHp / 2);
      }
      return getAllUnits(state, "enemy");
    case "allAllies":
      return getAllUnits(state, "player");
    case "enemy":
    case "ally":
    case "unit":
    case "tile":
    case "emptyTile":
      return unitsOnTiles(state, affectedTiles.length ? affectedTiles : [target], side);
    case "none":
      return [];
  }
}

export function addStatus(state: CombatState, unit: Unit, status: KeywordId, stacks: number): void {
  let bonus = 0;
  if (state.player.relics.includes("signal_amplifier")) {
    const def = STATUS_DEBUFFS.has(status);
    if (def) bonus = 1;
  }
  unit.statuses[status] = (unit.statuses[status] ?? 0) + stacks + bonus;
  state.log.push({
    ts: Date.now(),
    kind: "status",
    text: `${unit.name}: ${status} ${stacks + bonus > 0 ? "+" : ""}${stacks + bonus}.`,
  });
}

const STATUS_DEBUFFS = new Set(["weak", "vulnerable", "poison", "burn", "fragile", "rooted", "stun", "marked"]);

function logDamage(
  state: CombatState,
  attacker: Unit | undefined,
  defender: Unit,
  total: number,
  killed: boolean,
  suffix = "",
): void {
  if (total <= 0) return;
  state.log.push({
    ts: Date.now(),
    kind: "damage",
    text: `${attacker ? attacker.name : "?"} → ${defender.name} for ${total}${suffix}${killed ? " (killed)" : ""}.`,
  });
}

function moveUnit(state: CombatState, u: Unit, dest: GridPos): void {
  if (!state.grid.isWalkable(dest) || unitAt(state, dest)) return;
  u.pos = { x: dest.x, y: dest.y };
  if (u.side === "player") state.player.movedHeroesThisTurn.add(u.id);
  // Hazard-on-step damage.
  if (state.grid.getKind(dest) === "hazard") {
    const res = applyDamage(undefined, u, 3, state);
    logDamage(state, undefined, u, res.hpDamage + res.shieldAbsorbed, res.killed, " (Hazard)");
  }
  // Overwatch: enemies with the status that can now see/reach `u` fire a
  // reaction shot, then lose the status.
  if (!u.dead && u.side === "player") {
    for (const enemy of getAllUnits(state, "enemy")) {
      const ow = enemy.statuses["overwatch"] ?? 0;
      if (ow <= 0 || enemy.dead) continue;
      const range = Math.max(1, enemy.attackRange ?? 1);
      if (manhattan(enemy.pos, u.pos) <= range) {
        const dmg = enemy.attackDamage ?? 3;
        const res = applyDamage(enemy, u, dmg, state);
        logDamage(state, enemy, u, res.hpDamage + res.shieldAbsorbed, res.killed, " (Overwatch)");
        enemy.statuses["overwatch"] = 0;
        delete enemy.statuses["overwatch"];
        if (u.dead) break;
      }
    }
  }
}

function pushOrPull(
  state: CombatState,
  source: Unit,
  target: Unit,
  distance: number,
  kind: "push" | "pull",
): void {
  const dx = Math.sign(target.pos.x - source.pos.x) * (kind === "push" ? 1 : -1);
  const dy = Math.sign(target.pos.y - source.pos.y) * (kind === "push" ? 1 : -1);
  for (let i = 0; i < distance; i++) {
    const next = { x: target.pos.x + dx, y: target.pos.y + dy };
    if (!state.grid.isWalkable(next)) {
      // Collision damage
      const res = applyDamage(source, target, 1, state);
      logDamage(state, source, target, res.hpDamage + res.shieldAbsorbed, res.killed, " (Collision)");
      break;
    }
    const occ = unitAt(state, next);
    if (occ) {
      const r1 = applyDamage(source, target, 1, state);
      const r2 = applyDamage(source, occ, 1, state);
      logDamage(state, source, target, r1.hpDamage + r1.shieldAbsorbed, r1.killed, " (Collision)");
      logDamage(state, source, occ, r2.hpDamage + r2.shieldAbsorbed, r2.killed, " (Collision)");
      break;
    }
    target.pos = next;
    if (state.grid.getKind(next) === "hazard") {
      const res = applyDamage(undefined, target, 3, state);
      logDamage(state, undefined, target, res.hpDamage + res.shieldAbsorbed, res.killed, " (Hazard)");
      break;
    }
  }
  if (kind === "push") {
    // Notify relics that listen for pushes.
    if (state.player.relics.includes("kinetic_recorder")) deferredDraw(state, 1);
  }
}

function adjacentEmpty(state: CombatState, center: GridPos): GridPos[] {
  const out: GridPos[] = [];
  for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
    const p = { x: center.x + d.x, y: center.y + d.y };
    if (state.grid.inBounds(p) && state.grid.isWalkable(p) && !unitAt(state, p)) out.push(p);
  }
  return out;
}

function nearestUnseenEnemy(state: CombatState, from: GridPos, seen: Set<string>): Unit | undefined {
  let best: Unit | undefined;
  let bestDist = Infinity;
  for (const u of getAllUnits(state, "enemy")) {
    if (seen.has(u.id)) continue;
    const d = manhattan(from, u.pos);
    if (d < bestDist) {
      best = u;
      bestDist = d;
    }
  }
  return best;
}

function healLowestHero(state: CombatState, amount: number): void {
  const heroes = getAllUnits(state, "player");
  if (heroes.length === 0) return;
  heroes.sort((a, b) => a.hp - b.hp);
  heal(heroes[0], amount);
  state.log.push({ ts: Date.now(), kind: "heal", text: `${heroes[0].name} healed ${amount} (Vampiric Chip).` });
}

/** Pending card draws stored on the state. The combat controller drains
 *  these after each card play, using the run RNG for deterministic draws. */
export interface PendingDraw {
  count: number;
}

const PENDING = new WeakMap<CombatState, PendingDraw>();

export function deferredDraw(state: CombatState, count: number): void {
  const p = PENDING.get(state) ?? { count: 0 };
  p.count += count;
  PENDING.set(state, p);
}

export function consumePendingDraws(state: CombatState): number {
  const p = PENDING.get(state);
  if (!p) return 0;
  const n = p.count;
  p.count = 0;
  return n;
}

// (no unused guards)

