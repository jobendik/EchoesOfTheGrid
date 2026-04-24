/**
 * Deterministic pseudo-random number generator using the mulberry32 algorithm.
 *
 * All gameplay randomness — shuffling, AI decisions, map/reward generation —
 * flows through instances of this class so runs can be seeded, replayed, and
 * serialized to save files.
 */
export class RNG {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === "string" ? RNG.hashSeed(seed) : seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Next float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Random pick from an array. Returns undefined for empty arrays. */
  pick<T>(arr: readonly T[]): T | undefined {
    if (arr.length === 0) return undefined;
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Fisher–Yates shuffle returning a new array. */
  shuffle<T>(arr: readonly T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Returns true with the given probability in [0,1]. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick k distinct items (or fewer if the array is too small). */
  sample<T>(arr: readonly T[], k: number): T[] {
    return this.shuffle(arr).slice(0, Math.min(k, arr.length));
  }

  /** Serialize current state for save files. */
  snapshot(): number {
    return this.state;
  }

  /** Restore a serialized state. */
  restore(state: number): void {
    this.state = state >>> 0;
  }

  /** Simple string-to-int hash suitable for seeds. */
  static hashSeed(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Generates a short human-readable seed string. */
  static randomSeed(): string {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++) {
      out += letters[Math.floor(Math.random() * letters.length)];
    }
    return out;
  }
}
