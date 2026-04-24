import type { GridPos } from "../../core/Types.js";
import { DIRS4, Grid, addPos, manhattan, posKey } from "./Grid.js";

/**
 * Returns whether `from` can reach `to` in a single straight-line step set
 * with a given maximum distance and a predicate that tells the search which
 * tiles are traversable (so callers can exclude occupied tiles, hazards,
 * etc. without modifying the underlying grid).
 */
export function isReachable(
  grid: Grid,
  from: GridPos,
  to: GridPos,
  maxDist: number,
  passable: (p: GridPos) => boolean,
): boolean {
  return findPath(grid, from, to, maxDist, passable) !== null;
}

/**
 * BFS shortest-path on a 4-connected grid (enough for tactics games of this
 * scale; A* would be overkill with uniform step cost). Returns the path as a
 * list of positions excluding the start and ending at `to`, or null if no
 * path of length ≤ maxDist exists.
 *
 * `passable` is called for intermediate and destination tiles only (`from`
 * is always considered the origin and not re-tested).
 */
export function findPath(
  grid: Grid,
  from: GridPos,
  to: GridPos,
  maxDist: number,
  passable: (p: GridPos) => boolean,
): GridPos[] | null {
  if (posKey(from) === posKey(to)) return [];
  if (!grid.inBounds(to)) return null;

  const prev = new Map<string, string | null>();
  const dist = new Map<string, number>();
  const fromKey = posKey(from);
  prev.set(fromKey, null);
  dist.set(fromKey, 0);

  // Heuristic-ordered BFS: pop nearest to `to` first to keep paths short.
  const queue: GridPos[] = [from];

  while (queue.length > 0) {
    // Pick the tile with lowest f = g + h.
    let bestIdx = 0;
    let bestF = Infinity;
    for (let i = 0; i < queue.length; i++) {
      const g = dist.get(posKey(queue[i])) ?? 0;
      const f = g + manhattan(queue[i], to);
      if (f < bestF) {
        bestF = f;
        bestIdx = i;
      }
    }
    const cur = queue.splice(bestIdx, 1)[0];
    const curKey = posKey(cur);
    const curDist = dist.get(curKey) ?? 0;
    if (posKey(cur) === posKey(to)) break;
    if (curDist >= maxDist) continue;

    for (const d of DIRS4) {
      const next = addPos(cur, d);
      const nKey = posKey(next);
      if (dist.has(nKey)) continue;
      if (!grid.inBounds(next)) continue;
      if (!passable(next)) continue;
      dist.set(nKey, curDist + 1);
      prev.set(nKey, curKey);
      queue.push(next);
    }
  }

  const toKey = posKey(to);
  if (!prev.has(toKey)) return null;
  // Reconstruct
  const path: GridPos[] = [];
  let cur: string | null | undefined = toKey;
  while (cur && cur !== fromKey) {
    const [x, y] = cur.split(",").map(Number);
    path.push({ x, y });
    cur = prev.get(cur) ?? null;
  }
  return path.reverse();
}

/**
 * Returns all positions reachable from `from` within `maxDist` steps, subject
 * to `passable`. Used for movement previews and AI reachability checks.
 */
export function reachableTiles(
  grid: Grid,
  from: GridPos,
  maxDist: number,
  passable: (p: GridPos) => boolean,
): GridPos[] {
  const seen = new Map<string, number>();
  const out: GridPos[] = [];
  seen.set(posKey(from), 0);
  const queue: GridPos[] = [from];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curDist = seen.get(posKey(cur))!;
    if (curDist > 0) out.push(cur);
    if (curDist >= maxDist) continue;

    for (const d of DIRS4) {
      const next = addPos(cur, d);
      const nKey = posKey(next);
      if (seen.has(nKey)) continue;
      if (!grid.inBounds(next)) continue;
      if (!passable(next)) continue;
      seen.set(nKey, curDist + 1);
      queue.push(next);
    }
  }
  return out;
}
