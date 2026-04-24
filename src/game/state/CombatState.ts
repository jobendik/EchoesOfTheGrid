import type { GridPos, RelicId, Side, UnitId } from "../../core/Types.js";
import type { CardInstance } from "../cards/CardTypes.js";
import type { Grid } from "../grid/Grid.js";
import type { Unit } from "../units/UnitTypes.js";

/** Enemy's planned action, generated before the player acts. */
export interface Intent {
  enemyId: UnitId;
  /** Broad intent category for the icon/tooltip. */
  kind:
    | "attack"
    | "attack_aoe"
    | "buff_ally"
    | "shield_self"
    | "move"
    | "summon_hazard"
    | "overwatch"
    | "charge"
    | "debuff"
    | "wait";
  /** Optional target unit id if the intent targets a unit. */
  targetUnitId?: UnitId;
  /** Optional target tile if the intent affects a tile / area. */
  targetTile?: GridPos;
  /** Predicted damage before defensive statuses. Undefined if not applicable. */
  predictedDamage?: number;
  /** Tiles affected by the action (for preview overlays). */
  affectedTiles: GridPos[];
  /** Human-readable explanation used in tooltip / debug overlay. */
  reason: string;
  /** Optional icon glyph (filled in by UI). */
  icon?: string;
}

export interface CombatLogEntry {
  ts: number;
  kind: "info" | "damage" | "status" | "heal" | "death" | "turn" | "intent" | "relic";
  text: string;
}

export interface PlayerState {
  energy: number;
  maxEnergy: number;
  handLimit: number;
  startingHandSize: number;
  /** Hero ids ordered by party slot. */
  heroIds: UnitId[];
  /** Relics currently owned (order preserved). */
  relics: RelicId[];
  /** Per-turn bookkeeping used by relics / statuses. */
  movedHeroesThisTurn: Set<UnitId>;
  attacksThisTurn: number;
  cardsPlayedThisTurn: number;
  preventLethalCharges: number;
}

export type CombatPhase =
  | "intro"
  | "player_turn"
  | "resolving"
  | "enemy_turn"
  | "victory"
  | "defeat";

export interface CombatState {
  grid: Grid;
  units: Map<UnitId, Unit>;
  player: PlayerState;
  /** Card piles. */
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  intents: Map<UnitId, Intent>;
  /** Delayed effects such as bomber markers. */
  telegraphs: Telegraph[];
  log: CombatLogEntry[];
  phase: CombatPhase;
  turn: number;
  /** Side whose turn is currently active. */
  activeSide: Side;
  /** For tie-breaking deterministic enemy ordering. */
  enemyOrder: UnitId[];
  /** Debug flags. */
  debug: { overlay: boolean; revealIntents: boolean };
}

export interface Telegraph {
  /** Which enemy owns this telegraph (for cleanup if they die). */
  ownerId?: UnitId;
  /** Number of enemy turns until the effect fires. */
  turnsRemaining: number;
  /** Tile(s) that will be affected. */
  tiles: GridPos[];
  damage: number;
  label: string;
}
