import { describe, it, expect } from "vitest";
import { RNG } from "../src/core/RNG.js";
import { CombatController } from "../src/game/combat/CombatController.js";

/**
 * Deck upgrade identity. Pre-fix, upgrading one Strike marked the cardId
 * as upgraded and every Strike in the deck was rendered + simulated as
 * upgraded. RunCardInstance gives each copy an `instanceId` so duplicates
 * are independent.
 */
describe("Deck upgrade identity", () => {
  it("upgrading one of two duplicates does not upgrade the other", () => {
    const ctrl = new CombatController(
      {
        encounterId: "enc_drone_patrol",
        heroes: [{ heroClass: "vanguard", hp: 30, maxHp: 30 }],
        deck: [
          { instanceId: "rcard_a", cardId: "strike", upgraded: true },
          { instanceId: "rcard_b", cardId: "strike", upgraded: false },
        ],
        relics: [],
        seed: 11,
      },
      new RNG(11),
    );
    // Both should appear in piles. Exactly one is upgraded, one is not.
    const allCards = [
      ...ctrl.state.drawPile,
      ...ctrl.state.hand,
      ...ctrl.state.discardPile,
      ...ctrl.state.exhaustPile,
    ];
    const strikes = allCards.filter((c) => c.defId === "strike");
    expect(strikes).toHaveLength(2);
    expect(strikes.filter((c) => c.upgraded)).toHaveLength(1);
    expect(strikes.filter((c) => !c.upgraded)).toHaveLength(1);
  });

  it("two unrelated copies of the same card have distinct instance ids", () => {
    const ctrl = new CombatController(
      {
        encounterId: "enc_drone_patrol",
        heroes: [{ heroClass: "vanguard", hp: 30, maxHp: 30 }],
        deck: [
          { cardId: "strike" },
          { cardId: "strike" },
          { cardId: "strike" },
        ],
        relics: [],
        seed: 13,
      },
      new RNG(13),
    );
    const all = [
      ...ctrl.state.drawPile,
      ...ctrl.state.hand,
      ...ctrl.state.discardPile,
    ].filter((c) => c.defId === "strike");
    const ids = new Set(all.map((c) => c.instanceId));
    expect(ids.size).toBe(all.length);
  });
});
