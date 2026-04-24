import type { GridPos } from "../../core/Types.js";
import { Grid, addPos, chebyshev, manhattan, posEq } from "./Grid.js";

/**
 * Shape-based area-of-effect helpers. All functions return a list of
 * positions; callers clip to the grid and filter occupants. These are pure
 * to keep effect resolution testable.
 */

export function singleTile(p: GridPos): GridPos[] {
  return [p];
}

export function radiusTiles(center: GridPos, radius: number): GridPos[] {
  const out: GridPos[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const p = { x: center.x + dx, y: center.y + dy };
      if (chebyshev(center, p) <= radius) out.push(p);
    }
  }
  return out;
}

export function crossTiles(center: GridPos, radius: number): GridPos[] {
  const out: GridPos[] = [center];
  for (let i = 1; i <= radius; i++) {
    out.push({ x: center.x + i, y: center.y });
    out.push({ x: center.x - i, y: center.y });
    out.push({ x: center.x, y: center.y + i });
    out.push({ x: center.x, y: center.y - i });
  }
  return out;
}

export function adjacentTiles(center: GridPos): GridPos[] {
  return [
    { x: center.x + 1, y: center.y },
    { x: center.x - 1, y: center.y },
    { x: center.x, y: center.y + 1 },
    { x: center.x, y: center.y - 1 },
  ];
}

/**
 * Straight line between two tiles using Bresenham-style stepping, stopping
 * at `length`. Returns the tiles including the start's next step but not
 * the start itself.
 */
export function lineTiles(from: GridPos, to: GridPos, length: number): GridPos[] {
  const out: GridPos[] = [];
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  // Restrict to orthogonal lines for clarity.
  if (dx !== 0 && dy !== 0) return out;
  let cur = from;
  for (let i = 0; i < length; i++) {
    cur = addPos(cur, { x: dx, y: dy });
    out.push(cur);
  }
  return out;
}

/**
 * Returns the 3-tile-wide cone fanning from `from` toward `dir` for `length`
 * tiles. `dir` must be one of the four cardinal unit vectors.
 */
export function coneTiles(from: GridPos, dir: GridPos, length: number): GridPos[] {
  const out: GridPos[] = [];
  const perp: GridPos = { x: dir.y, y: dir.x };
  for (let i = 1; i <= length; i++) {
    for (let j = -i + 1; j <= i - 1; j++) {
      out.push({
        x: from.x + dir.x * i + perp.x * j,
        y: from.y + dir.y * i + perp.y * j,
      });
    }
  }
  return out;
}

export function clipToGrid(grid: Grid, tiles: GridPos[]): GridPos[] {
  return tiles.filter((p) => grid.inBounds(p));
}

export function inRangeManhattan(a: GridPos, b: GridPos, range: number): boolean {
  return manhattan(a, b) <= range && !posEq(a, b);
}
