import { describe, it, expect } from "vitest";
import { RNG } from "../src/core/RNG.js";
import { CombatController } from "../src/game/combat/CombatController.js";
import { getCardDef } from "../src/data/cards.js";

/**
 * Conditional card effects: ensure the description and the runtime effect
 * agree. system_crash specifically claimed to "stun all enemies below 50%
 * HP" but actually stunned every enemy regardless of HP.
 */
describe("system_crash", () => {
  it("only stuns enemies below 50% HP, leaving healthy enemies un-stunned", () => {
    const ctrl = new CombatController(
      {
        encounterId: "enc_drone_patrol",
        heroes: [{ heroClass: "vanguard", hp: 30, maxHp: 30 }],
        deck: [{ cardId: "system_crash" }],
        relics: [],
        seed: 1,
      },
      new RNG(1),
    );
    const enemies = ctrl.enemies();
    expect(enemies.length).toBeGreaterThanOrEqual(2);
    // Bring exactly one enemy to <= 50% HP, leave the rest healthy.
    const lowEnemy = enemies[0];
    lowEnemy.hp = Math.floor(lowEnemy.maxHp / 4);
    const otherEnemies = enemies.slice(1);

    // Force System Crash into hand: bypass the shuffle by replacing hand.
    const hand = ctrl.state.hand;
    const card = ctrl.state.drawPile.find((c) => c.defId === "system_crash") ?? hand.find((c) => c.defId === "system_crash");
    expect(card).toBeDefined();
    if (!hand.includes(card!)) hand.push(card!);
    ctrl.state.player.energy = getCardDef("system_crash").cost;

    const hero = ctrl.heroes()[0];
    const ok = ctrl.playCard(card!, hero.id, null);
    expect(ok).toBe(true);

    expect(lowEnemy.statuses["stun"] ?? 0).toBeGreaterThan(0);
    for (const e of otherEnemies) {
      expect(e.statuses["stun"] ?? 0).toBe(0);
    }
  });
});

describe("Card descriptions match effects (audit)", () => {
  it("every card with `damage` effect agrees with description thresholds", () => {
    // Cards whose descriptions claim a conditional effect must implement
    // that condition. Spot-check a few canonical examples.
    const finisher = getCardDef("finisher");
    const finisherEff = finisher.effects.find((e) => e.kind === "damageIfBelowHp");
    expect(finisherEff).toBeDefined();
    expect((finisherEff as { threshold: number }).threshold).toBe(0.5);

    const sysCrash = getCardDef("system_crash");
    expect(sysCrash.targeting.kind).toBe("allEnemies");
    // Effect must be the dispatch that goes through targetedUnits' filter.
    expect(sysCrash.effects[0].kind).toBe("applyStatus");
  });
});
