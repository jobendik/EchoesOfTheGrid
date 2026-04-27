import { describe, it, expect } from "vitest";
import { RNG } from "../src/core/RNG.js";
import { generateMap } from "../src/game/encounters/MapGenerator.js";
import { Balance } from "../src/data/balance.js";

describe("Map generation", () => {
  it("produces exactly one final boss node per run", () => {
    for (const seed of [1, 2, 7, 42, 100]) {
      const map = generateMap(new RNG(seed));
      const bossNodes = map.filter((n) => n.kind === "boss");
      expect(bossNodes).toHaveLength(1);
      // The boss must live on the final layer.
      const finalLayer = Balance.run.mapLayers - 1;
      expect(bossNodes[0].layer).toBe(finalLayer);
      // Every penultimate-layer node should connect to the boss.
      const penultimate = map.filter((n) => n.layer === finalLayer - 1);
      for (const n of penultimate) {
        expect(n.next).toContain(bossNodes[0].id);
      }
    }
  });
});
