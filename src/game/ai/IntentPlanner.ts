import type { GridPos } from "../../core/Types.js";
import { manhattan } from "../grid/Grid.js";
import { findPath, reachableTiles } from "../grid/Pathfinding.js";
import type { CombatState, EnemyTurnAction, Intent, PlannedEnemyAction } from "../state/CombatState.js";
import { getAllUnits, unitAt } from "../combat/TargetingSystem.js";
import type { Unit } from "../units/UnitTypes.js";

/**
 * Utility-based intent planner.
 *
 * Each planner returns a {@link PlannedEnemyAction} pairing a concrete
 * action (executed during the enemy turn) with its display Intent (shown to
 * the player ahead of time). The combat controller calls this exactly once
 * per regeneration and stores the result, so the executed action is always
 * the one the player saw.
 *
 * Behavior profiles customize the weights and the available action set.
 */

export type { EnemyTurnAction, PlannedEnemyAction };

/**
 * Plan an intent for a single enemy. Pure with respect to state (does not
 * mutate), so the combat controller can call this both to render intents
 * and to resolve them.
 */
export function planEnemyAction(state: CombatState, enemy: Unit): PlannedEnemyAction {
  const profile = enemy.behaviorProfile ?? "melee";
  const heroes = getAllUnits(state, "player");
  if (heroes.length === 0) {
    return waitAction(enemy, "No valid targets");
  }

  switch (profile) {
    case "ranged":
      return planRanged(state, enemy, heroes);
    case "melee":
      return planMelee(state, enemy, heroes);
    case "sniper":
      return planSniper(state, enemy, heroes);
    case "guardian":
      return planGuardian(state, enemy, heroes);
    case "leaper":
      return planLeaper(state, enemy, heroes);
    case "bomber":
      return planBomber(state, enemy, heroes);
    case "buffer":
      return planBuffer(state, enemy, heroes);
    case "debuffer":
      return planDebuffer(state, enemy, heroes);
    case "sentinel":
      return planSentinel(state, enemy, heroes);
    case "boss_cipher":
      return planBoss(state, enemy, heroes);
    default:
      return planMelee(state, enemy, heroes);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isTileFree(state: CombatState, p: GridPos, self: Unit): boolean {
  if (!state.grid.inBounds(p)) return false;
  if (!state.grid.isWalkable(p)) return false;
  const occ = unitAt(state, p);
  return !occ || occ.id === self.id;
}

function reachableFromEnemy(state: CombatState, enemy: Unit): GridPos[] {
  return [
    enemy.pos,
    ...reachableTiles(state.grid, enemy.pos, enemy.moveRange, (p) => isTileFree(state, p, enemy)),
  ];
}

/**
 * BFS-based path used both for the displayed intent preview and the actual
 * movement during turn resolution. Excludes the starting tile, so the first
 * entry is the first step the enemy will actually take.
 */
export function planMovementPath(state: CombatState, enemy: Unit, dest: GridPos, maxSteps: number): GridPos[] {
  if (maxSteps <= 0) return [];
  const path = findPath(state.grid, enemy.pos, dest, maxSteps, (p) => isTileFree(state, p, enemy));
  if (path) return path;
  // Best-effort fallback: try any reachable tile that minimizes distance to dest.
  const reachable = reachableFromEnemy(state, enemy);
  let best = enemy.pos;
  let bestD = manhattan(enemy.pos, dest);
  for (const p of reachable) {
    const d = manhattan(p, dest);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  if (best.x === enemy.pos.x && best.y === enemy.pos.y) return [];
  const fallback = findPath(state.grid, enemy.pos, best, maxSteps, (p) => isTileFree(state, p, enemy));
  return fallback ?? [];
}

/**
 * Returns the best reachable position to be at the desired range from a
 * target, scored along with a path. If no movement helps, returns the
 * enemy's current position with an empty path.
 */
function bestApproach(
  state: CombatState,
  enemy: Unit,
  target: GridPos,
  desiredRange: number,
): { pos: GridPos; path: GridPos[] } {
  const candidates = reachableFromEnemy(state, enemy);
  let bestPos = enemy.pos;
  let bestScore = scoreApproach(enemy.pos, target, desiredRange);
  for (const p of candidates) {
    const s = scoreApproach(p, target, desiredRange);
    if (s > bestScore) {
      bestScore = s;
      bestPos = p;
    }
  }
  if (bestPos.x === enemy.pos.x && bestPos.y === enemy.pos.y) return { pos: bestPos, path: [] };
  const path = planMovementPath(state, enemy, bestPos, enemy.moveRange);
  return { pos: bestPos, path };
}

function scoreApproach(p: GridPos, target: GridPos, desiredRange: number): number {
  const d = manhattan(p, target);
  // Prefer being exactly at desired range; then prefer being within range.
  return -Math.abs(d - desiredRange) * 10 + (d <= desiredRange ? 1 : 0);
}

function pickTaunted(heroes: Unit[]): Unit | undefined {
  const taunted = heroes.filter((h) => (h.statuses["taunt"] ?? 0) > 0);
  if (taunted.length === 0) return undefined;
  taunted.sort((a, b) => a.hp - b.hp);
  return taunted[0];
}

function nearestHero(enemy: Unit, heroes: Unit[]): Unit {
  let best = heroes[0];
  let bestD = manhattan(enemy.pos, best.pos);
  for (let i = 1; i < heroes.length; i++) {
    const d = manhattan(enemy.pos, heroes[i].pos);
    if (d < bestD) {
      best = heroes[i];
      bestD = d;
    }
  }
  return best;
}

function weakestHero(heroes: Unit[]): Unit {
  return heroes.slice().sort((a, b) => a.hp - b.hp)[0];
}

function waitAction(enemy: Unit, reason: string): PlannedEnemyAction {
  return {
    action: { kind: "wait" },
    intent: {
      enemyId: enemy.id,
      kind: "wait",
      affectedTiles: [],
      reason,
    },
  };
}

function moveIntent(enemy: Unit, target: Unit, path: GridPos[]): Intent {
  return {
    enemyId: enemy.id,
    kind: "move",
    targetUnitId: target.id,
    affectedTiles: path,
    reason: `Closing distance to ${target.name}`,
    icon: "→",
  };
}

function attackPlan(
  enemy: Unit,
  target: Unit,
  path: GridPos[],
  damage: number,
  reason: string,
  appliesStatuses?: { status: string; stacks: number }[],
): PlannedEnemyAction {
  const action: EnemyTurnAction = {
    kind: "attack",
    targetId: target.id,
    movePath: path,
    damage,
    ...(appliesStatuses ? { appliesStatuses } : {}),
  };
  const intent: Intent = {
    enemyId: enemy.id,
    kind: appliesStatuses && appliesStatuses.length > 0 ? "debuff" : "attack",
    targetUnitId: target.id,
    predictedDamage: damage,
    affectedTiles: [target.pos],
    reason,
    icon: appliesStatuses && appliesStatuses.length > 0 ? "☣" : "⚔",
  };
  return { action, intent };
}

function moveTowardPlan(state: CombatState, enemy: Unit, target: Unit, desiredRange: number, reason: string): PlannedEnemyAction {
  const { path } = bestApproach(state, enemy, target.pos, desiredRange);
  return {
    action: { kind: "move", movePath: path, toward: target.id },
    intent: {
      enemyId: enemy.id,
      kind: "move",
      targetUnitId: target.id,
      affectedTiles: path,
      reason,
      icon: "→",
    },
  };
}

// ── Profile implementations ─────────────────────────────────────────────────

function planRanged(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  const taunt = pickTaunted(heroes);
  const target = taunt ?? weakestHero(heroes);
  const range = enemy.attackRange ?? 3;
  const { pos, path } = bestApproach(state, enemy, target.pos, range);
  const dmg = enemy.attackDamage ?? 3;
  const reachInRange = manhattan(pos, target.pos) <= range;
  if (reachInRange) {
    const reason = taunt
      ? `Targeting taunting ${target.name}`
      : `Weakest hero (${target.name}, ${target.hp} HP) in range`;
    return attackPlan(enemy, target, path, dmg, reason);
  }
  return moveTowardPlan(state, enemy, target, range, `Repositioning to fire on ${target.name}`);
}

function planMelee(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  const taunt = pickTaunted(heroes);
  const target = taunt ?? nearestHero(enemy, heroes);
  const { pos, path } = bestApproach(state, enemy, target.pos, 1);
  const dmg = enemy.attackDamage ?? 5;
  const canReach = manhattan(pos, target.pos) <= 1;
  if (canReach) {
    const reason = taunt ? `Charging taunting ${target.name}` : `Closest hero (${target.name})`;
    return attackPlan(enemy, target, path, dmg, reason);
  }
  return {
    action: { kind: "move", movePath: path, toward: target.id },
    intent: moveIntent(enemy, target, path),
  };
}

/**
 * Sniper: prepares a heavy charged shot, then fires it the following turn.
 * Charge state is tracked on the enemy via `statuses.charging` so the
 * behavior is robust to interrupts (stuns, displacement) instead of tied
 * to brittle turn parity.
 */
function planSniper(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  const charging = (enemy.statuses["charging"] ?? 0) > 0;
  const target = weakestHero(heroes);
  const dmg = enemy.attackDamage ?? 9;
  const range = enemy.attackRange ?? 7;
  if (charging) {
    // Fire the heavy charged shot.
    const { pos, path } = bestApproach(state, enemy, target.pos, range);
    const inRange = manhattan(pos, target.pos) <= range;
    if (inRange) {
      const heavy = Math.round(dmg * 1.5);
      return attackPlan(enemy, target, path, heavy, `Releasing charged shot on ${target.name}`);
    }
    // No clear shot; fall through to a regular reposition.
    return moveTowardPlan(state, enemy, target, range, `Holding charge — repositioning toward ${target.name}`);
  }
  // Prepare charge in place. The action sets `charging` on the enemy at
  // resolve time so a staggered chain of charge/fire alternates cleanly.
  return {
    action: { kind: "prepare_charge", chargedDamage: Math.round(dmg * 1.5), targetId: target.id },
    intent: {
      enemyId: enemy.id,
      kind: "charge",
      targetUnitId: target.id,
      predictedDamage: Math.round(dmg * 1.5),
      affectedTiles: [target.pos],
      reason: `Charging heavy shot on ${target.name} (next turn)`,
      icon: "◎",
    },
  };
}

function planGuardian(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  // Shield an adjacent ally with lowest HP, else attack.
  const allies = getAllUnits(state, "enemy").filter((u) => u.id !== enemy.id);
  const needy = allies
    .filter((a) => manhattan(a.pos, enemy.pos) <= 1)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (needy) {
    return {
      action: { kind: "buff_ally", targetId: needy.id, status: "shield", stacks: 4, movePath: [] },
      intent: {
        enemyId: enemy.id,
        kind: "buff_ally",
        targetUnitId: needy.id,
        affectedTiles: [needy.pos],
        reason: `Shielding wounded ${needy.name}`,
        icon: "◈",
      },
    };
  }
  return planMelee(state, enemy, heroes);
}

function planLeaper(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  const target = weakestHero(heroes);
  const { pos, path } = bestApproach(state, enemy, target.pos, 1);
  const canReach = manhattan(pos, target.pos) <= 1;
  if (canReach) {
    return attackPlan(
      enemy,
      target,
      path,
      enemy.attackDamage ?? 5,
      `Leaping toward weakest hero (${target.name}, ${target.hp} HP)`,
    );
  }
  return {
    action: { kind: "move", movePath: path, toward: target.id },
    intent: {
      enemyId: enemy.id,
      kind: "move",
      targetUnitId: target.id,
      affectedTiles: path,
      reason: `Leaping toward weakest hero (${target.name}, ${target.hp} HP)`,
      icon: "↯",
    },
  };
}

function planBomber(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  // Pick tile that hits the most heroes within radius 1.
  let bestTile = heroes[0].pos;
  let bestHits = 0;
  for (const h of heroes) {
    let hits = 0;
    for (const other of heroes) if (manhattan(h.pos, other.pos) <= 1) hits += 1;
    if (hits > bestHits) {
      bestHits = hits;
      bestTile = h.pos;
    }
  }
  return {
    action: {
      kind: "aoe",
      targetTile: bestTile,
      movePath: [],
      predictedDamage: enemy.attackDamage ?? 5,
      radius: 1,
      label: "Bomb",
      delay: 1,
    },
    intent: {
      enemyId: enemy.id,
      kind: "attack_aoe",
      targetTile: bestTile,
      predictedDamage: enemy.attackDamage,
      affectedTiles: aoeTiles(bestTile, 1),
      reason:
        bestHits >= 2
          ? `Clustered heroes in radius: ${bestHits} targets`
          : `Dropping AoE on ${heroes.find((h) => h.pos.x === bestTile.x && h.pos.y === bestTile.y)?.name ?? "target"}`,
      icon: "✷",
    },
  };
}

function planBuffer(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  const allies = getAllUnits(state, "enemy").filter((u) => u.id !== enemy.id);
  if (allies.length > 0) {
    const target = allies[0];
    return {
      action: { kind: "buff_ally", targetId: target.id, status: "strength", stacks: 1, movePath: [] },
      intent: {
        enemyId: enemy.id,
        kind: "buff_ally",
        targetUnitId: target.id,
        affectedTiles: [target.pos],
        reason: `Strengthening ${target.name}`,
        icon: "✚",
      },
    };
  }
  return planRanged(state, enemy, heroes);
}

/**
 * Parasite/debuffer: bites adjacent heroes and applies Poison + Weak as
 * the intent advertises. Previously the action was a plain attack so the
 * statuses promised by the intent never landed.
 */
function planDebuffer(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  const target = nearestHero(enemy, heroes);
  const { pos, path } = bestApproach(state, enemy, target.pos, 1);
  const canReach = manhattan(pos, target.pos) <= 1;
  if (canReach) {
    return attackPlan(
      enemy,
      target,
      path,
      enemy.attackDamage ?? 2,
      `Applying Poison and Weak to ${target.name}`,
      [
        { status: "poison", stacks: 2 },
        { status: "weak", stacks: 1 },
      ],
    );
  }
  return {
    action: { kind: "move", movePath: path, toward: target.id },
    intent: {
      enemyId: enemy.id,
      kind: "move",
      targetUnitId: target.id,
      affectedTiles: path,
      reason: `Crawling toward ${target.name}`,
      icon: "→",
    },
  };
}

function planSentinel(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  if (state.turn % 2 === 0) {
    return {
      action: { kind: "overwatch", movePath: [] },
      intent: {
        enemyId: enemy.id,
        kind: "overwatch",
        affectedTiles: overwatchCone(enemy.pos),
        reason: "Entering overwatch: will attack first target in range",
        icon: "◉",
      },
    };
  }
  return planRanged(state, enemy, heroes);
}

/**
 * Boss: telegraphed attacks. The phase-3 Core Beam used to fire the same
 * turn it was announced — players had no way to respond. Telegraph the
 * beam so the affected tile is highlighted for one turn before it lands.
 */
function planBoss(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  const phase = enemy.hp / enemy.maxHp;
  if (phase < 0.35) {
    const target = weakestHero(heroes);
    return {
      action: {
        kind: "aoe",
        targetTile: target.pos,
        movePath: [],
        predictedDamage: 12,
        radius: 0,
        label: "Core Beam",
        delay: 1,
      },
      intent: {
        enemyId: enemy.id,
        kind: "attack_aoe",
        targetTile: target.pos,
        predictedDamage: 12,
        affectedTiles: [target.pos],
        reason: "Phase 3: Core Beam charging — evacuate the targeted tile",
        icon: "☀",
      },
    };
  }
  // Normal rotation based on turn parity
  if (state.turn % 3 === 0) return planBomber(state, enemy, heroes);
  if (state.turn % 3 === 1) return planRanged(state, enemy, heroes);
  return {
    action: {
      kind: "summon_hazard",
      tile: { x: Math.max(0, heroes[0].pos.x - 1), y: heroes[0].pos.y },
      movePath: [],
    },
    intent: {
      enemyId: enemy.id,
      kind: "summon_hazard",
      targetTile: { x: Math.max(0, heroes[0].pos.x - 1), y: heroes[0].pos.y },
      affectedTiles: [{ x: Math.max(0, heroes[0].pos.x - 1), y: heroes[0].pos.y }],
      reason: "Deploying a hazard next to the frontline",
      icon: "☣",
    },
  };
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

function overwatchCone(p: GridPos): GridPos[] {
  const out: GridPos[] = [];
  for (let i = 1; i <= 3; i++) {
    out.push({ x: p.x - i, y: p.y });
    out.push({ x: p.x - i, y: p.y - 1 });
    out.push({ x: p.x - i, y: p.y + 1 });
  }
  return out;
}

