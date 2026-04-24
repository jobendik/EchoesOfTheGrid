import { describe, it, expect } from "vitest";
import { Grid, manhattan, posEq, posKey } from "../src/game/grid/Grid.js";
import { findPath, reachableTiles } from "../src/game/grid/Pathfinding.js";

describe("Grid primitives", () => {
  it("manhattan distance is symmetric and zero on same point", () => {
    expect(manhattan({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    expect(manhattan({ x: 3, y: 4 }, { x: 0, y: 0 })).toBe(7);
  });

  it("posEq and posKey are consistent", () => {
    expect(posEq({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(posEq({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
    expect(posKey({ x: 3, y: 4 })).toBe(posKey({ x: 3, y: 4 }));
    expect(posKey({ x: 3, y: 4 })).not.toBe(posKey({ x: 4, y: 3 }));
  });

  it("grid reports walkability and blocks", () => {
    const g = new Grid(4, 4);
    expect(g.isWalkable({ x: 0, y: 0 })).toBe(true);
    g.setKind({ x: 1, y: 1 }, "blocked");
    expect(g.isWalkable({ x: 1, y: 1 })).toBe(false);
    expect(g.inBounds({ x: -1, y: 0 })).toBe(false);
    expect(g.inBounds({ x: 4, y: 0 })).toBe(false);
  });
});

describe("Pathfinding", () => {
  const open = (_p: { x: number; y: number }) => true;
  const walkableOn = (g: Grid) => (p: { x: number; y: number }) => g.isWalkable(p);

  it("findPath finds a straight path on open grid", () => {
    const g = new Grid(5, 1);
    const path = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 }, 20, open);
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual({ x: 4, y: 0 });
  });

  it("findPath routes around a wall", () => {
    const g = new Grid(5, 3);
    g.setKind({ x: 2, y: 0 }, "blocked");
    g.setKind({ x: 2, y: 1 }, "blocked");
    const path = findPath(g, { x: 0, y: 1 }, { x: 4, y: 1 }, 20, walkableOn(g));
    expect(path).not.toBeNull();
    expect(path!.some((p) => p.x === 2 && (p.y === 0 || p.y === 1))).toBe(false);
  });

  it("findPath returns null when no path exists", () => {
    const g = new Grid(3, 3);
    for (let y = 0; y < 3; y++) g.setKind({ x: 1, y }, "blocked");
    const path = findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 }, 20, walkableOn(g));
    expect(path).toBeNull();
  });

  it("reachableTiles only returns walkable tiles within range", () => {
    const g = new Grid(5, 5);
    g.setKind({ x: 1, y: 1 }, "blocked");
    const tiles = reachableTiles(g, { x: 0, y: 0 }, 3, walkableOn(g));
    expect(tiles.some((p) => p.x === 1 && p.y === 1)).toBe(false);
    // All returned tiles are within manhattan distance 3.
    for (const p of tiles) expect(manhattan(p, { x: 0, y: 0 })).toBeLessThanOrEqual(3);
  });
});

