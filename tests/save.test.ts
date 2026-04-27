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
      heroes: [{ heroClass: "vanguard", maxHp: 30, hp: 20 }],
      deck: [
        { instanceId: "rcard_1", cardId: "strike", upgraded: false },
      ],
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
    expect(loaded!.deck).toHaveLength(1);
    expect(loaded!.deck[0].cardId).toBe("strike");
  });

  it("clearSave removes the save", () => {
    const run: RunState = {
      seed: "X", seedNumber: 1, heroes: [], deck: [], relics: [], gold: 0,
      currentNodeId: null, map: [], completedNodeIds: [], flags: {}, rngState: 1,
    };
    saveRun(run);
    expect(hasSave()).toBe(true);
    clearSave();
    expect(hasSave()).toBe(false);
    expect(loadRun()).toBeNull();
  });

  it("migrates legacy v2 saves with per-hero deck arrays", () => {
    type LegacySave = {
      version: 2;
      seed: string;
      seedNumber: number;
      heroes: { heroClass: string; maxHp: number; hp: number; deck: string[]; upgraded: string[] }[];
      relics: string[];
      gold: number;
      currentNodeId: string | null;
      map: unknown[];
      completedNodeIds: string[];
      flags: Record<string, boolean>;
      rngState: number;
    };
    const legacy: LegacySave = {
      version: 2,
      seed: "OLD",
      seedNumber: 1,
      heroes: [
        {
          heroClass: "vanguard",
          maxHp: 30,
          hp: 20,
          // Two Strikes — only one upgraded; ensures only one instance is upgraded after migration.
          deck: ["strike", "strike", "guard"],
          upgraded: ["strike"],
        },
      ],
      relics: [],
      gold: 0,
      currentNodeId: null,
      map: [],
      completedNodeIds: [],
      flags: {},
      rngState: 1,
    };
    localStorage.setItem("eotg.save.v1", JSON.stringify(legacy));
    const loaded = loadRun();
    expect(loaded).not.toBeNull();
    expect(loaded!.deck).toHaveLength(3);
    const strikes = loaded!.deck.filter((c) => c.cardId === "strike");
    expect(strikes).toHaveLength(2);
    expect(strikes.filter((c) => c.upgraded)).toHaveLength(1);
    // Hero record no longer carries deck/upgraded fields.
    expect((loaded!.heroes[0] as unknown as { deck?: unknown }).deck).toBeUndefined();
  });
});
