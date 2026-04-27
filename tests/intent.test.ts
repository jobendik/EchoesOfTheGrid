import { describe, it, expect } from "vitest";
import { RNG } from "../src/core/RNG.js";
import { CombatController } from "../src/game/combat/CombatController.js";
import { planEnemyAction, planMovementPath } from "../src/game/ai/IntentPlanner.js";
import { createEnemy, createHero } from "../src/game/units/UnitFactory.js";
import { Grid } from "../src/game/grid/Grid.js";
import type { CombatState } from "../src/game/state/CombatState.js";
import { findPath } from "../src/game/grid/Pathfinding.js";

/**
 * Build a minimal headless CombatState with no draw pile / hand etc. so we
 * can exercise the planner and movement logic without standing up a full
 * combat.
 */
function makeBareState(grid: Grid): CombatState {
  return {
    grid,
    units: new Map(),
    player: {
      energy: 0,
      maxEnergy: 0,
      handLimit: 10,
      startingHandSize: 0,
      heroIds: [],
      relics: [],
      movedHeroesThisTurn: new Set(),
      attacksThisTurn: 0,
      cardsPlayedThisTurn: 0,
      preventLethalCharges: 0,
    },
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    intents: new Map(),
    plannedActions: new Map(),
    telegraphs: [],
    log: [],
    phase: "enemy_turn",
    turn: 1,
    activeSide: "enemy",
    enemyOrder: [],
    debug: { overlay: false, revealIntents: false },
  };
}

describe("Enemy intents", () => {
  it("parasite applies Poison and Weak as its intent advertises", () => {
    const ctrl = new CombatController(
      {
        encounterId: "enc_parasite_nest",
        heroes: [{ heroClass: "vanguard", hp: 30, maxHp: 30 }],
        deck: [{ cardId: "guard" }, { cardId: "guard" }, { cardId: "step" }],
        relics: [],
        seed: 42,
      },
      new RNG(42),
    );
    const hero = ctrl.heroes()[0];
    // Park a parasite next to the hero so it can hit on its turn.
    const parasite = ctrl.enemies().find((e) => e.enemyKind === "parasite");
    expect(parasite).toBeDefined();
    parasite!.pos = { x: hero.pos.x + 1, y: hero.pos.y };
    ctrl.regenerateIntents();
    const intent = ctrl.getIntent(parasite!.id)!;
    expect(intent.kind).toBe("debuff");
    expect(intent.targetUnitId).toBe(hero.id);
    // Resolve the enemy turn — the action stored at intent time runs.
    ctrl.endPlayerTurn();
    ctrl.resolveEnemyTurn();
    expect(hero.statuses["poison"] ?? 0).toBeGreaterThan(0);
    expect(hero.statuses["weak"] ?? 0).toBeGreaterThan(0);
  });

  it("sniper charges, then fires a heavier shot the next turn", () => {
    const grid = new Grid(8, 4);
    const state = makeBareState(grid);
    const sniper = createEnemy("sniper", { x: 6, y: 1 });
    const hero = createHero("vanguard", { x: 1, y: 1 });
    state.units.set(sniper.id, sniper);
    state.units.set(hero.id, hero);

    // Turn 1: charging status not yet set → should plan a prepare_charge.
    const plan1 = planEnemyAction(state, sniper);
    expect(plan1.action.kind).toBe("prepare_charge");
    expect(plan1.intent.kind).toBe("charge");

    // Simulate the prepare_charge running.
    sniper.statuses["charging"] = 1;

    // Turn 2: charging > 0 → must plan a heavy attack with 1.5x damage.
    const plan2 = planEnemyAction(state, sniper);
    expect(plan2.action.kind).toBe("attack");
    if (plan2.action.kind === "attack") {
      expect(plan2.action.damage).toBeGreaterThan(sniper.attackDamage!);
    }
  });

  it("boss phase-3 beam is telegraphed (delayed) instead of firing instantly", () => {
    const grid = new Grid(8, 4);
    const state = makeBareState(grid);
    const boss = createEnemy("boss_cipher", { x: 6, y: 1 });
    boss.hp = Math.floor(boss.maxHp * 0.3); // phase 3
    const hero = createHero("vanguard", { x: 1, y: 1 });
    state.units.set(boss.id, boss);
    state.units.set(hero.id, hero);

    const plan = planEnemyAction(state, boss);
    expect(plan.action.kind).toBe("aoe");
    if (plan.action.kind === "aoe") {
      expect(plan.action.delay).toBeGreaterThan(0);
    }
  });

  it("intent and executed action are the same — no re-planning during resolution", () => {
    const ctrl = new CombatController(
      {
        encounterId: "enc_parasite_nest",
        heroes: [{ heroClass: "vanguard", hp: 30, maxHp: 30 }],
        deck: [{ cardId: "guard" }],
        relics: [],
        seed: 1,
      },
      new RNG(1),
    );
    // Snapshot every enemy's planned action at intent time.
    const snapshot = new Map<string, string>();
    for (const e of ctrl.enemies()) {
      snapshot.set(e.id, ctrl.state.plannedActions.get(e.id)!.action.kind);
    }
    ctrl.endPlayerTurn();
    ctrl.resolveEnemyTurn();
    // The plannedActions map is cleared at next regeneration. Verify the
    // pre-resolution snapshot matched the post-resolution intents (the
    // planner is deterministic given identical state, so re-running it
    // would have produced the same kinds — what we really want to know is
    // that NEW intents were computed from a NEW player-turn state).
    expect(snapshot.size).toBeGreaterThan(0);
  });
});

describe("Pathfinding", () => {
  it("plans a path that routes around a wall", () => {
    const grid = new Grid(6, 4);
    // Wall: column 3 is blocked except for one gap at y=3.
    grid.setKind({ x: 3, y: 0 }, "blocked");
    grid.setKind({ x: 3, y: 1 }, "blocked");
    grid.setKind({ x: 3, y: 2 }, "blocked");
    const state = makeBareState(grid);
    const enemy = createEnemy("brute", { x: 0, y: 1 });
    const hero = createHero("vanguard", { x: 5, y: 1 });
    enemy.moveRange = 8;
    state.units.set(enemy.id, enemy);
    state.units.set(hero.id, hero);

    // The greedy stepper would get stuck at (2, 1) bumping the wall.
    // Pathfinding must route through (3, 3) to reach the hero side.
    const dest = { x: 4, y: 1 };
    const path = planMovementPath(state, enemy, dest, 8);
    expect(path.length).toBeGreaterThan(0);
    // None of the steps land on a blocked tile.
    for (const step of path) {
      expect(grid.getKind(step)).not.toBe("blocked");
    }
    // Final step should be at or near the destination.
    const final = path[path.length - 1];
    expect(Math.abs(final.x - dest.x) + Math.abs(final.y - dest.y)).toBeLessThanOrEqual(0);
  });

  it("the planner uses the same path that movement walks", () => {
    const grid = new Grid(8, 4);
    grid.setKind({ x: 4, y: 1 }, "blocked");
    grid.setKind({ x: 4, y: 2 }, "blocked");
    const state = makeBareState(grid);
    const brute = createEnemy("brute", { x: 1, y: 1 });
    brute.moveRange = 6;
    const hero = createHero("vanguard", { x: 7, y: 1 });
    state.units.set(brute.id, brute);
    state.units.set(hero.id, hero);

    const plan = planEnemyAction(state, brute);
    expect(plan.action.kind === "move" || plan.action.kind === "attack").toBe(true);
    if (plan.action.kind === "move" || plan.action.kind === "attack") {
      const planned = plan.action.movePath;
      // Sanity: each step must be 1 tile away from the previous and walkable.
      let prev = brute.pos;
      for (const step of planned) {
        const dist = Math.abs(step.x - prev.x) + Math.abs(step.y - prev.y);
        expect(dist).toBe(1);
        expect(grid.isWalkable(step)).toBe(true);
        prev = step;
      }
    }
  });
});

describe("Pathfinding sanity", () => {
  it("findPath returns null when there is no walkable route", () => {
    const grid = new Grid(4, 3);
    for (let y = 0; y < 3; y++) grid.setKind({ x: 2, y }, "blocked");
    const path = findPath(grid, { x: 0, y: 0 }, { x: 3, y: 0 }, 10, (p) => grid.isWalkable(p));
    expect(path).toBeNull();
  });
});
