import type { GridPos } from "../../core/Types.js";
import type { CardDefinition, TargetingDefinition } from "../cards/CardTypes.js";
import {
  adjacentTiles,
  clipToGrid,
  coneTiles,
  crossTiles,
  lineTiles,
  radiusTiles,
  singleTile,
} from "../grid/AreaPatterns.js";
import { manhattan } from "../grid/Grid.js";
import type { CombatState } from "../state/CombatState.js";
import type { Unit } from "../units/UnitTypes.js";

/**
 * Targeting system. Pure functions that evaluate whether a card can be
 * aimed at a given target from a given caster, and what tiles are affected.
 */

export interface TargetSelection {
  casterId: string;
  target: GridPos;
  targetUnitId?: string;
}

export function getAllUnits(state: CombatState, side?: "player" | "enemy"): Unit[] {
  const out: Unit[] = [];
  for (const u of state.units.values()) {
    if (u.dead) continue;
    if (!side || u.side === side) out.push(u);
  }
  return out;
}

export function unitAt(state: CombatState, p: GridPos): Unit | undefined {
  for (const u of state.units.values()) {
    if (!u.dead && u.pos.x === p.x && u.pos.y === p.y) return u;
  }
  return undefined;
}

/** Returns true if `selection` is a legal aim for the card definition. */
export function isValidTarget(
  state: CombatState,
  caster: Unit,
  def: CardDefinition,
  target: GridPos,
): boolean {
  const t: TargetingDefinition = def.targeting;
  if (t.kind === "self" || t.kind === "none" || t.kind === "allEnemies" || t.kind === "allAllies") {
    return true;
  }
  if (!state.grid.inBounds(target)) return false;
  const dist = manhattan(caster.pos, target);
  if (dist > t.range) return false;

  const unit = unitAt(state, target);
  switch (t.kind) {
    case "enemy":
      return unit !== undefined && unit.side === "enemy";
    case "ally":
      return unit !== undefined && unit.side === "player";
    case "unit":
      return unit !== undefined;
    case "tile":
      return true;
    case "emptyTile":
      return unit === undefined && state.grid.isWalkable(target);
  }
  return false;
}

/** Returns the list of tiles that would be affected by this aim. */
export function computeAffectedTiles(
  state: CombatState,
  caster: Unit,
  def: CardDefinition,
  target: GridPos,
): GridPos[] {
  const t = def.targeting;
  let tiles: GridPos[];
  switch (t.area.kind) {
    case "single":
      tiles = singleTile(t.kind === "self" ? caster.pos : target);
      break;
    case "radius":
      tiles = radiusTiles(target, t.area.radius);
      break;
    case "cross":
      tiles = crossTiles(target, t.area.radius);
      break;
    case "adjacent":
      tiles = adjacentTiles(t.kind === "self" ? caster.pos : target);
      break;
    case "line": {
      tiles = lineTiles(caster.pos, target, t.area.length);
      break;
    }
    case "cone": {
      // Derive cardinal direction toward `target`
      const dx = Math.sign(target.x - caster.pos.x);
      const dy = Math.sign(target.y - caster.pos.y);
      const dir = dx !== 0 ? { x: dx, y: 0 } : { x: 0, y: dy || 1 };
      tiles = coneTiles(caster.pos, dir, t.area.length);
      break;
    }
  }
  return clipToGrid(state.grid, tiles);
}

/** Filter affected tiles to contain only a subset (enemies, allies, units). */
export function unitsOnTiles(
  state: CombatState,
  tiles: GridPos[],
  filter: "enemy" | "ally" | "any",
): Unit[] {
  const out: Unit[] = [];
  for (const t of tiles) {
    const u = unitAt(state, t);
    if (!u) continue;
    if (filter === "enemy" && u.side !== "enemy") continue;
    if (filter === "ally" && u.side !== "player") continue;
    out.push(u);
  }
  return out;
}
