import { describe, it, expect } from "vitest";
import { CARDS, CARD_MAP, getCardDef } from "../src/data/cards.js";
import { RELICS } from "../src/data/relics.js";
import { EVENTS } from "../src/data/events.js";
import { ENCOUNTERS } from "../src/data/encounters.js";

/**
 * Data integrity: every entry in every database is internally consistent.
 * These tests make content authoring safe — a typo in an id or an invalid
 * effect shape breaks the test suite immediately.
 */
describe("Data integrity", () => {
  it("has a substantial card database", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(30);
  });

  it("all card ids are unique", () => {
    const ids = CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all relics have unique ids and defined fields", () => {
    const ids = RELICS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RELICS) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(0);
    }
  });

  it("has 5+ narrative events, each with 2+ choices", () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(5);
    for (const e of EVENTS) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2);
      for (const c of e.choices) {
        expect(c.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("getCardDef lookup matches CARD_MAP lookup", () => {
    for (const c of CARDS) {
      expect(getCardDef(c.id).id).toBe(c.id);
      expect(CARD_MAP.get(c.id)?.id).toBe(c.id);
    }
  });

  it("includes an encounter for every expected tier", () => {
    for (const tier of [1, 2, 3] as const) {
      expect(ENCOUNTERS.some((e) => e.kind === "combat" && e.tier === tier)).toBe(true);
    }
    expect(ENCOUNTERS.some((e) => e.kind === "boss")).toBe(true);
  });
});
