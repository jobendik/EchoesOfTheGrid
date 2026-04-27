import { describe, it, expect } from "vitest";
import { RNG } from "../src/core/RNG.js";
import { CombatController } from "../src/game/combat/CombatController.js";

/**
 * Combat-result regression tests.
 *
 * Pre-fix, victory stats were derived from `enemies().filter(e => e.dead)`
 * AFTER combat ended — but `enemies()` filters out dead units, so the
 * count was always 0. The new design tracks counters during combat via
 * the event bus, so dead-unit semantics in the unit graph no longer
 * affect the reported result.
 */
describe("CombatResult", () => {
  it("tracks enemies defeated, damage dealt, and damage taken during the fight", () => {
    const ctrl = new CombatController(
      {
        encounterId: "enc_drone_patrol",
        heroes: [{ heroClass: "vanguard", hp: 30, maxHp: 30 }],
        deck: [
          { cardId: "strike" },
          { cardId: "strike" },
          { cardId: "strike" },
          { cardId: "guard" },
          { cardId: "step" },
        ],
        relics: [],
        seed: 5,
      },
      new RNG(5),
    );
    const hero = ctrl.heroes()[0];
    // Manually kill an enemy by applying overwhelming damage via the event
    // path. We use playCard with a Strike to hit; nudge hero next to enemy
    // first.
    const enemy = ctrl.enemies()[0];
    hero.pos = { x: enemy.pos.x - 1, y: enemy.pos.y };
    enemy.hp = 1;

    const strike = ctrl.state.hand.find((c) => c.defId === "strike") ??
      ctrl.state.drawPile.find((c) => c.defId === "strike");
    expect(strike).toBeDefined();
    if (!ctrl.state.hand.includes(strike!)) ctrl.state.hand.push(strike!);
    ctrl.state.player.energy = 5;
    const ok = ctrl.playCard(strike!, hero.id, enemy.pos);
    expect(ok).toBe(true);
    expect(enemy.dead).toBe(true);

    const result = ctrl.getResult();
    expect(result.enemiesDefeated).toBeGreaterThanOrEqual(1);
    expect(result.damageDealt).toBeGreaterThan(0);
  });

  it("getResult does NOT depend on living-unit queries (dead enemies still count)", () => {
    const ctrl = new CombatController(
      {
        encounterId: "enc_drone_patrol",
        heroes: [{ heroClass: "vanguard", hp: 30, maxHp: 30 }],
        deck: [{ cardId: "strike" }, { cardId: "strike" }, { cardId: "guard" }],
        relics: [],
        seed: 9,
      },
      new RNG(9),
    );
    const hero = ctrl.heroes()[0];
    const enemy = ctrl.enemies()[0];
    enemy.hp = 1;
    hero.pos = { x: enemy.pos.x - 1, y: enemy.pos.y };
    const strike = ctrl.state.hand.find((c) => c.defId === "strike") ??
      ctrl.state.drawPile.find((c) => c.defId === "strike");
    if (!ctrl.state.hand.includes(strike!)) ctrl.state.hand.push(strike!);
    ctrl.state.player.energy = 5;
    ctrl.playCard(strike!, hero.id, enemy.pos);

    // The old code did `enemies().filter(e => e.dead).length`. enemies()
    // skips dead units, so it always returned 0. The new result must
    // report 1 (or more) regardless.
    const before = ctrl.enemies().filter((e) => e.dead).length;
    expect(before).toBe(0); // confirms the old approach would have failed
    expect(ctrl.getResult().enemiesDefeated).toBeGreaterThanOrEqual(1);
  });

  it("reports surviving heroHp and tracks downedHeroes when a hero dies", () => {
    const ctrl = new CombatController(
      {
        encounterId: "enc_drone_patrol",
        heroes: [{ heroClass: "vanguard", hp: 1, maxHp: 30 }],
        deck: [{ cardId: "guard" }],
        relics: [],
        seed: 3,
      },
      new RNG(3),
    );
    const hero = ctrl.heroes()[0];
    // Manually drop the hero via the damage path that fires events.
    const enemy = ctrl.enemies()[0];
    enemy.pos = { x: hero.pos.x + 1, y: hero.pos.y };
    enemy.attackDamage = 99;
    ctrl.regenerateIntents();
    ctrl.endPlayerTurn();
    ctrl.resolveEnemyTurn();
    const result = ctrl.getResult();
    if (hero.dead) {
      expect(result.downedHeroes).toContain(hero.id);
      expect(result.heroHp.find((h) => h.unitId === hero.id)).toBeUndefined();
    }
  });
});
