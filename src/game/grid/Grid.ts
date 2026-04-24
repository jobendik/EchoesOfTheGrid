import type { GridPos, TileKind } from "../../core/Types.js";

export interface Tile {
  x: number;
  y: number;
  kind: TileKind;
}

/** The tactical battlefield. Grid is fixed-size per combat. */
export class Grid {
  readonly width: number;
  readonly height: number;
  private readonly tiles: Tile[];

  constructor(width: number, height: number, fill: TileKind = "floor") {
    this.width = width;
    this.height = height;
    this.tiles = new Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.tiles[y * width + x] = { x, y, kind: fill };
      }
    }
  }

  inBounds(p: GridPos): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height;
  }

  get(p: GridPos): Tile | undefined {
    if (!this.inBounds(p)) return undefined;
    return this.tiles[p.y * this.width + p.x];
  }

  getKind(p: GridPos): TileKind | undefined {
    return this.get(p)?.kind;
  }

  setKind(p: GridPos, kind: TileKind): void {
    const t = this.get(p);
    if (t) t.kind = kind;
  }

  /** Returns true if a unit can stand on this tile (ignoring occupation). */
  isWalkable(p: GridPos): boolean {
    const t = this.get(p);
    if (!t) return false;
    return t.kind !== "blocked";
  }

  /** Iterate all tiles (readonly). */
  *all(): IterableIterator<Tile> {
    for (const t of this.tiles) yield t;
  }
}

/** 4-directional neighbors (no diagonals). */
export const DIRS4: readonly GridPos[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function manhattan(a: GridPos, b: GridPos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function chebyshev(a: GridPos, b: GridPos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function posEq(a: GridPos, b: GridPos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function posKey(p: GridPos): string {
  return `${p.x},${p.y}`;
}

export function addPos(a: GridPos, b: GridPos): GridPos {
  return { x: a.x + b.x, y: a.y + b.y };
}
