/**
 * Status effect registry.
 *
 * Effects are data-driven: each status is a record of behavior flags + tick
 * hooks. Units carry a map of status id → stacks. All gameplay systems
 * query this registry rather than hardcoding effect names.
 */

import type { KeywordId } from "../../core/Types.js";

export type StatusTiming = "startOfTurn" | "endOfTurn" | "onHit" | "onMove";

export type StatusBehavior =
  | "decayEachTurn"   // stacks tick down by 1 at end of turn
  | "expireEachTurn"  // stacks removed entirely at end of turn
  | "persistent";     // stacks never auto-decay

export interface StatusDefinition {
  id: KeywordId;
  name: string;
  description: string;
  /** Base color used by the UI for pills / borders. */
  color: string;
  /** Short symbol used on the unit plate. */
  symbol: string;
  behavior: StatusBehavior;
  /** Category lets renderers group positive / negative / control effects. */
  category: "buff" | "debuff" | "control" | "damage-over-time" | "shield";
}

/** Standard definitions. Extensible: add new entries and they become
 *  available everywhere the status system is consulted. */
export const STATUS_DEFS: readonly StatusDefinition[] = [
  {
    id: "shield",
    name: "Shield",
    description: "Absorbs incoming damage before HP. Decays each turn.",
    color: "#6bb8ff",
    symbol: "◈",
    behavior: "decayEachTurn",
    category: "shield",
  },
  {
    id: "vulnerable",
    name: "Vulnerable",
    description: "Takes +50% damage from attacks.",
    color: "#ff7b7b",
    symbol: "▲",
    behavior: "decayEachTurn",
    category: "debuff",
  },
  {
    id: "weak",
    name: "Weak",
    description: "Deals 25% less damage with attacks.",
    color: "#c793ff",
    symbol: "▽",
    behavior: "decayEachTurn",
    category: "debuff",
  },
  {
    id: "poison",
    name: "Poison",
    description: "Deals 1 damage per stack at start of turn, then -1 stack.",
    color: "#7be8a0",
    symbol: "☣",
    behavior: "persistent",
    category: "damage-over-time",
  },
  {
    id: "burn",
    name: "Burn",
    description: "Deals 2 damage at start of turn. Stacks expire each turn.",
    color: "#ffa257",
    symbol: "🔥",
    behavior: "expireEachTurn",
    category: "damage-over-time",
  },
  {
    id: "marked",
    name: "Marked",
    description: "Takes +2 damage from attacks. Persists until removed.",
    color: "#ffe066",
    symbol: "◎",
    behavior: "persistent",
    category: "debuff",
  },
  {
    id: "stun",
    name: "Stunned",
    description: "Skips its next turn.",
    color: "#d0d0d0",
    symbol: "✦",
    behavior: "expireEachTurn",
    category: "control",
  },
  {
    id: "rooted",
    name: "Rooted",
    description: "Cannot move. Decays each turn.",
    color: "#8a6d3b",
    symbol: "⚓",
    behavior: "decayEachTurn",
    category: "control",
  },
  {
    id: "strength",
    name: "Strength",
    description: "Deals +1 damage per stack with attacks.",
    color: "#ff9b6b",
    symbol: "✚",
    behavior: "persistent",
    category: "buff",
  },
  {
    id: "fragile",
    name: "Fragile",
    description: "Takes +1 damage per stack. Persistent.",
    color: "#b04040",
    symbol: "✖",
    behavior: "persistent",
    category: "debuff",
  },
  {
    id: "retaliate",
    name: "Retaliate",
    description: "When attacked, deals stacks damage back. Decays each turn.",
    color: "#c0ff6b",
    symbol: "↯",
    behavior: "decayEachTurn",
    category: "buff",
  },
  {
    id: "regen",
    name: "Regen",
    description: "Heals stacks at start of turn, then -1 stack.",
    color: "#8cffb5",
    symbol: "♥",
    behavior: "persistent",
    category: "buff",
  },
  {
    id: "taunt",
    name: "Taunting",
    description: "Enemy AI prefers targeting this unit.",
    color: "#ffc06b",
    symbol: "!",
    behavior: "decayEachTurn",
    category: "buff",
  },
];

const STATUS_MAP = new Map<string, StatusDefinition>(
  STATUS_DEFS.map((s) => [s.id, s]),
);

export function getStatusDef(id: KeywordId): StatusDefinition | undefined {
  return STATUS_MAP.get(id);
}

export type StatusMap = Record<KeywordId, number>;
