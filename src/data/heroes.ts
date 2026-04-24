import type { HeroBlueprint } from "../game/units/UnitTypes.js";

/**
 * Hero blueprints. Each one ships with a curated starting deck that
 * teaches the hero's identity through play.
 */
export const HEROES: readonly HeroBlueprint[] = [
  {
    heroClass: "vanguard",
    classId: "vanguard",
    name: "Vanguard",
    maxHp: 32,
    moveRange: 0,
    spriteKey: "heroes.vanguard",
    role: "Durable frontliner — shields, pushes, and holds the line.",
    shortDescription:
      "Soak damage, push enemies off key tiles, and protect the squad with layered shields.",
    startingDeck: [
      "strike",
      "strike",
      "guard",
      "guard",
      "shield_bash",
      "hold_the_line",
      "step",
      "taunting_signal",
      "counterstance",
    ],
  },
  {
    heroClass: "riftblade",
    classId: "riftblade",
    name: "Riftblade",
    maxHp: 24,
    moveRange: 0,
    spriteKey: "heroes.riftblade",
    role: "Mobile striker — dashes, flanks, and finishes weakened foes.",
    shortDescription:
      "Reposition each turn. Damage scales when you move or when enemies are low.",
    startingDeck: [
      "strike",
      "strike",
      "step",
      "step",
      "blink_strike",
      "momentum",
      "phase_step",
      "finisher",
      "backline_cut",
    ],
  },
  {
    heroClass: "signalist",
    classId: "signalist",
    name: "Signalist",
    maxHp: 22,
    moveRange: 0,
    spriteKey: "heroes.signalist",
    role: "Support / control — marks targets, shields allies, manipulates flow.",
    shortDescription:
      "Mark enemies for the team, chain sparks across the field, and draw extra cards.",
    startingDeck: [
      "quick_shot",
      "quick_shot",
      "mark_target",
      "chain_spark",
      "patch_wound",
      "barrier_field",
      "reboot",
      "scan",
      "overclock",
    ],
  },
];

export const HERO_MAP = new Map(HEROES.map((h) => [h.heroClass, h]));
