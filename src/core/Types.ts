/**
 * Core domain-wide type aliases.
 *
 * These are kept string-based (branded only lightly) because the codebase is
 * data-driven and definitions reference each other by id. Stronger branding
 * would add friction without catching many real bugs.
 */

export type CardId = string;
export type RelicId = string;
export type EnemyId = string;
export type HeroClassId = "vanguard" | "riftblade" | "signalist";
export type ClassId = HeroClassId | "neutral";
export type EncounterId = string;
export type EventId = string;
export type KeywordId = string;
export type AssetKey = string;
export type UnitId = string;

export type Rarity = "starter" | "common" | "uncommon" | "rare" | "curse";
export type CardType =
  | "attack"
  | "skill"
  | "power"
  | "movement"
  | "tactic";

export type TileKind =
  | "floor"
  | "blocked"
  | "hazard"
  | "cover"
  | "energy"
  | "objective";

export interface GridPos {
  readonly x: number;
  readonly y: number;
}

export type Side = "player" | "enemy";

/** Generic result for pure gameplay functions. */
export interface EffectOutcome {
  /** Human-readable log lines produced by the effect. */
  logs: string[];
  /** IDs of units that died as a result (may be empty). */
  deaths: UnitId[];
}

/** Empty outcome helper. */
export const emptyOutcome = (): EffectOutcome => ({ logs: [], deaths: [] });
