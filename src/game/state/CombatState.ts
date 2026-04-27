import type { GridPos, KeywordId, RelicId, Side, UnitId } from "../../core/Types.js";
import type { CardInstance } from "../cards/CardTypes.js";
import type { Grid } from "../grid/Grid.js";
import type { Unit } from "../units/UnitTypes.js";

/**
 * Concrete planned enemy action. Produced once at planning time and reused
 * unchanged when the enemy turn resolves, so the intent the player sees
 * always matches the action that actually executes.
 */
export type EnemyTurnAction =
  | {
      kind: "attack";
      targetId: UnitId;
      movePath: GridPos[];
      damage: number;
      /** Statuses applied to the target on hit (e.g. parasite Poison/Weak). */
      appliesStatuses?: { status: KeywordId; stacks: number }[];
    }
  | {
      kind: "aoe";
      targetTile: GridPos;
      movePath: GridPos[];
      predictedDamage: number;
      radius: number;
      label: string;
      /** Telegraph delay in enemy turns (0 = fire immediately). */
      delay: number;
    }
  | { kind: "buff_ally"; targetId: UnitId; status: KeywordId; stacks: number; movePath: GridPos[] }
  | { kind: "shield_self"; amount: number }
  | { kind: "overwatch"; movePath: GridPos[] }
  | { kind: "move"; movePath: GridPos[]; toward: UnitId }
  | { kind: "summon_hazard"; tile: GridPos; movePath: GridPos[] }
  | { kind: "prepare_charge"; chargedDamage: number; targetId: UnitId }
  | { kind: "wait" };

export interface PlannedEnemyAction {
  action: EnemyTurnAction;
  intent: Intent;
}

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
  /** True while resolving a zero-cost card (used by scrap_multiplier). */
  zeroCostCardActive?: boolean;
  /** Unit ids whose death has already been broadcast via unitDied. */
  deathEventsEmitted?: Set<UnitId>;
}

export type CombatPhase =
  | "intro"
  | "player_turn"
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
  /**
   * Concrete planned actions per enemy. Populated whenever intents are
   * regenerated, then consumed during {@link CombatController.resolveEnemyTurn}.
   * Storing actions guarantees the displayed intent matches what runs.
   */
  plannedActions: Map<UnitId, PlannedEnemyAction>;
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

/**
 * Authoritative result of a finished combat. Tracked incrementally inside
 * the {@link CombatController} so post-combat callers don't have to
 * reconstruct counts (e.g. by counting `dead` units, which becomes wrong
 * the moment we recycle the unit map across combats).
 */
export interface CombatResult {
  victory: boolean;
  enemiesDefeated: number;
  damageDealt: number;
  damageTaken: number;
  turnsTaken: number;
  /** Final HP per surviving hero (excludes downed heroes). */
  heroHp: { unitId: UnitId; heroClass: string; hp: number; maxHp: number }[];
  /** Hero ids that hit 0 HP at any point during this combat. */
  downedHeroes: UnitId[];
}
