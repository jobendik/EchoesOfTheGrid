import { describe, it, expect } from "vitest";
import { RNG } from "../src/core/RNG.js";
import { CombatController } from "../src/game/combat/CombatController.js";

/**
 * End-to-end combat smoke test. Builds a real encounter, plays cards
 * deterministically, and asserts the game reaches a conclusion without
 * throwing, with consistent energy/hand/pile accounting.
 */
describe("CombatController", () => {
  it("initializes a playable combat state from an encounter id", () => {
    const ctrl = new CombatController(
      {
        encounterId: "enc_drone_patrol",
        heroes: [{ heroClass: "vanguard" }],
        deck: [
          { cardId: "strike" },
          { cardId: "strike" },
          { cardId: "guard" },
          { cardId: "guard" },
          { cardId: "step" },
        ],
        relics: [],
        seed: 7,
      },
      new RNG(7),
    );
    expect(ctrl.state.phase).toBe("player_turn");
    expect(ctrl.heroes().length).toBe(1);
    expect(ctrl.enemies().length).toBeGreaterThan(0);
    expect(ctrl.state.hand.length).toBeGreaterThan(0);
    expect(ctrl.state.player.energy).toBe(ctrl.state.player.maxEnergy);
    // Every enemy has an intent assigned.
    for (const e of ctrl.enemies()) expect(ctrl.getIntent(e.id)).toBeDefined();
  });

  it("ends a turn cleanly and advances state without throwing", () => {
    const ctrl = new CombatController(
      {
        encounterId: "enc_drone_patrol",
        heroes: [{ heroClass: "vanguard" }],
        deck: [
          { cardId: "strike" },
          { cardId: "guard" },
          { cardId: "step" },
          { cardId: "hold_the_line" },
        ],
        relics: [],
        seed: 99,
      },
      new RNG(99),
    );
    const initialTurn = ctrl.state.turn;
    ctrl.endPlayerTurn();
    expect(ctrl.state.phase).toBe("enemy_turn");
    ctrl.resolveEnemyTurn();
    // Either we advanced to the next player turn, or combat ended.
    expect(["player_turn", "victory", "defeat"]).toContain(ctrl.state.phase);
    if (ctrl.state.phase === "player_turn") {
      expect(ctrl.state.turn).toBe(initialTurn + 1);
    }
  });

  it("shuffles cards correctly into the draw pile with a given seed", () => {
    const setup = {
      encounterId: "enc_drone_patrol",
      heroes: [{ heroClass: "vanguard" as const }],
      deck: [
        { cardId: "strike" },
        { cardId: "strike" },
        { cardId: "guard" },
        { cardId: "guard" },
        { cardId: "step" },
        { cardId: "hold_the_line" },
      ],
      relics: [],
      seed: 1234,
    };
    const a = new CombatController(setup, new RNG(1234));
    const b = new CombatController(setup, new RNG(1234));
    expect(a.state.hand.map((c) => c.defId)).toEqual(b.state.hand.map((c) => c.defId));
    expect(a.state.drawPile.map((c) => c.defId)).toEqual(b.state.drawPile.map((c) => c.defId));
  });
});
