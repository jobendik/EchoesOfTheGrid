import type { GridPos } from "../../core/Types.js";
import { manhattan } from "../grid/Grid.js";
import { reachableTiles } from "../grid/Pathfinding.js";
import type { CombatState, Intent } from "../state/CombatState.js";
import { getAllUnits, unitAt } from "../combat/TargetingSystem.js";
import type { Unit } from "../units/UnitTypes.js";

/**
 * Utility-based intent planner.
 *
 * For each enemy we:
 *  1. find the best position to reach (scored by threat/reach/positioning),
 *  2. pick the best target (weakest / most dangerous / taunting),
 *  3. emit an Intent describing what will happen, with a reason string.
 *
 * Behavior profiles customize the weights and the available action set.
 */

type EnemyTurnAction =
  | { kind: "attack"; targetId: string; movePath: GridPos[] }
  | { kind: "aoe"; targetTile: GridPos; movePath: GridPos[]; predictedDamage: number; radius: number; label: string }
  | { kind: "buff_ally"; targetId: string; status: string; stacks: number; movePath: GridPos[] }
  | { kind: "shield_self"; amount: number }
  | { kind: "overwatch"; movePath: GridPos[] }
  | { kind: "charge"; targetId: string; damage: number; movePath: GridPos[] }
  | { kind: "summon_hazard"; tile: GridPos; movePath: GridPos[] }
  | { kind: "wait" };

export interface PlannedEnemyAction {
  action: EnemyTurnAction;
  intent: Intent;
}

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

function bestPositionTo(state: CombatState, enemy: Unit, target: GridPos, desiredRange: number): GridPos {
  const reachable = reachableFromEnemy(state, enemy);
  let best = enemy.pos;
  let bestScore = -Infinity;
  for (const p of reachable) {
    const d = manhattan(p, target);
    // Prefer tiles exactly at desired range; penalize being blocked.
    const score = -Math.abs(d - desiredRange) * 10 + (d <= desiredRange ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
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

function makePathPreview(from: GridPos, to: GridPos): GridPos[] {
  // Simple path for visualization; the real movement uses pathfinding.
  const out: GridPos[] = [];
  const cur = { ...from };
  while (cur.x !== to.x || cur.y !== to.y) {
    if (cur.x !== to.x) cur.x += Math.sign(to.x - cur.x);
    else if (cur.y !== to.y) cur.y += Math.sign(to.y - cur.y);
    out.push({ ...cur });
  }
  return out;
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

// ── Profile implementations ─────────────────────────────────────────────────

function planRanged(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  const taunt = pickTaunted(heroes);
  const target = taunt ?? weakestHero(heroes);
  const best = bestPositionTo(state, enemy, target.pos, enemy.attackRange ?? 3);
  const path = makePathPreview(enemy.pos, best);
  const dmg = enemy.attackDamage ?? 3;
  const reason = taunt
    ? `Targeting taunting ${target.name}`
    : `Weakest hero (${target.name}, ${target.hp} HP) in ranged line`;
  return {
    action: { kind: "attack", targetId: target.id, movePath: path },
    intent: {
      enemyId: enemy.id,
      kind: "attack",
      targetUnitId: target.id,
      predictedDamage: dmg,
      affectedTiles: [target.pos],
      reason,
      icon: "⚔",
    },
  };
}

function planMelee(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  const taunt = pickTaunted(heroes);
  const target = taunt ?? nearestHero(enemy, heroes);
  const best = bestPositionTo(state, enemy, target.pos, 1);
  const path = makePathPreview(enemy.pos, best);
  const dmg = enemy.attackDamage ?? 5;
  const canReach = manhattan(best, target.pos) <= 1;
  const reason = taunt
    ? `Charging taunting ${target.name}`
    : canReach
      ? `Closest hero (${target.name})`
      : `Closing distance to ${target.name}`;
  return {
    action: canReach
      ? { kind: "attack", targetId: target.id, movePath: path }
      : { kind: "charge", targetId: target.id, damage: 0, movePath: path },
    intent: {
      enemyId: enemy.id,
      kind: canReach ? "attack" : "move",
      targetUnitId: target.id,
      predictedDamage: canReach ? dmg : undefined,
      affectedTiles: canReach ? [target.pos] : path,
      reason,
      icon: canReach ? "⚔" : "→",
    },
  };
}

function planSniper(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  // Sniper charges every other turn. Use state.turn parity for stability.
  const charging = state.turn % 2 === 0;
  const target = weakestHero(heroes);
  if (charging) {
    return {
      action: { kind: "overwatch", movePath: [] },
      intent: {
        enemyId: enemy.id,
        kind: "charge",
        targetUnitId: target.id,
        predictedDamage: enemy.attackDamage,
        affectedTiles: [target.pos],
        reason: `Charging heavy shot on ${target.name}`,
        icon: "◎",
      },
    };
  }
  return planRanged(state, enemy, heroes);
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
  const best = bestPositionTo(state, enemy, target.pos, 1);
  const path = makePathPreview(enemy.pos, best);
  const canReach = manhattan(best, target.pos) <= 1;
  return {
    action: canReach
      ? { kind: "attack", targetId: target.id, movePath: path }
      : { kind: "charge", targetId: target.id, damage: 0, movePath: path },
    intent: {
      enemyId: enemy.id,
      kind: canReach ? "attack" : "move",
      targetUnitId: target.id,
      predictedDamage: canReach ? enemy.attackDamage : undefined,
      affectedTiles: canReach ? [target.pos] : path,
      reason: `Leaping toward weakest hero (${target.name}, ${target.hp} HP)`,
      icon: canReach ? "⚔" : "↯",
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

function planDebuffer(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  const target = nearestHero(enemy, heroes);
  const best = bestPositionTo(state, enemy, target.pos, 1);
  const path = makePathPreview(enemy.pos, best);
  const canReach = manhattan(best, target.pos) <= 1;
  return {
    action: canReach
      ? { kind: "attack", targetId: target.id, movePath: path }
      : { kind: "charge", targetId: target.id, damage: 0, movePath: path },
    intent: {
      enemyId: enemy.id,
      kind: canReach ? "debuff" : "move",
      targetUnitId: target.id,
      predictedDamage: canReach ? enemy.attackDamage : undefined,
      affectedTiles: canReach ? [target.pos] : path,
      reason: canReach
        ? `Applying Poison and Weak to ${target.name}`
        : `Crawling toward ${target.name}`,
      icon: canReach ? "☣" : "→",
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

function planBoss(state: CombatState, enemy: Unit, heroes: Unit[]): PlannedEnemyAction {
  const phase = enemy.hp / enemy.maxHp;
  if (phase < 0.35) {
    // Desperate: huge beam on the best-aimed line
    const target = weakestHero(heroes);
    return {
      action: {
        kind: "aoe",
        targetTile: target.pos,
        movePath: [],
        predictedDamage: 12,
        radius: 0,
        label: "Core Beam",
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
