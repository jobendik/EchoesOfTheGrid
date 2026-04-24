import { describe, it, expect } from "vitest";
import { RNG } from "../src/core/RNG.js";

describe("RNG determinism", () => {
  it("produces the same sequence from the same numeric seed", () => {
    const a = new RNG(12345);
    const b = new RNG(12345);
    for (let i = 0; i < 50; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("string and number seeds can be mixed via hashSeed", () => {
    const a = new RNG("hello");
    const b = new RNG(RNG.hashSeed("hello"));
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
  });

  it("snapshot/restore preserves state", () => {
    const a = new RNG(77);
    for (let i = 0; i < 7; i++) a.next();
    const snap = a.snapshot();
    const expected = [a.next(), a.next(), a.next()];
    a.restore(snap);
    expect([a.next(), a.next(), a.next()]).toEqual(expected);
  });

  it("int returns values in inclusive range", () => {
    const rng = new RNG(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it("shuffle is a permutation of input", () => {
    const rng = new RNG(42);
    const out = rng.shuffle([1, 2, 3, 4, 5]);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
