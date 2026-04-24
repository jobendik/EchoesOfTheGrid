import { describe, it, expect, beforeEach, beforeAll } from "vitest";

// Minimal localStorage shim — installed before any module imports SaveState.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null { return this.m.get(k) ?? null; }
  setItem(k: string, v: string): void { this.m.set(k, v); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  get length(): number { return this.m.size; }
}

beforeAll(() => {
  if (typeof (globalThis as unknown as { localStorage?: Storage }).localStorage === "undefined") {
    (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  }
});

// Import lazily so the shim is in place first.
const saveModule = await import("../src/game/state/SaveState.js");
const { saveRun, loadRun, clearSave, hasSave } = saveModule;
type RunState = import("../src/game/state/RunState.js").RunState;

beforeEach(() => {
  clearSave();
});

describe("SaveState", () => {
  it("saves and loads round-trip", () => {
    const run: RunState = {
      seed: "ABC123",
      seedNumber: 999,
      heroes: [{ heroClass: "vanguard", maxHp: 30, hp: 20, deck: ["strike"], upgraded: [] }],
      relics: ["first_move"],
      gold: 42,
      currentNodeId: "n_1_2",
      map: [],
      completedNodeIds: ["n_0_1"],
      flags: { saw_opening: true },
      rngState: 123456,
    };
    saveRun(run);
    expect(hasSave()).toBe(true);
    const loaded = loadRun();
    expect(loaded).not.toBeNull();
    expect(loaded!.seed).toBe("ABC123");
    expect(loaded!.relics).toEqual(["first_move"]);
    expect(loaded!.gold).toBe(42);
    expect(loaded!.flags.saw_opening).toBe(true);
  });

  it("clearSave removes the save", () => {
    const run: RunState = {
      seed: "X", seedNumber: 1, heroes: [], relics: [], gold: 0,
      currentNodeId: null, map: [], completedNodeIds: [], flags: {}, rngState: 1,
    };
    saveRun(run);
    expect(hasSave()).toBe(true);
    clearSave();
    expect(hasSave()).toBe(false);
    expect(loadRun()).toBeNull();
  });
});
