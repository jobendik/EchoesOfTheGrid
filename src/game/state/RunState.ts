import type { CardId, EncounterId, HeroClassId, RelicId } from "../../core/Types.js";

/**
 * Run-level state. Persists between combats and is serialized to
 * localStorage between nodes.
 *
 * Card ownership model: the squad shares a single deck (`RunState.deck`).
 * Heroes contribute their starting card lists when a run is created, but
 * after that the deck is squad-wide — there is no concept of "this card
 * belongs to hero N". Combat already uses one shared draw/hand/discard
 * pile, so the per-hero deck array in the prototype was tracking
 * ownership the simulation never honoured.
 */

/**
 * A single, addressable card in the squad's deck. Multiple instances can
 * share a `cardId` while differing in `upgraded`, so upgrading one copy of
 * Strike no longer upgrades every Strike in the deck.
 */
export interface RunCardInstance {
  /** Stable id across the run; persists through saves. */
  instanceId: string;
  cardId: CardId;
  upgraded: boolean;
}

export interface HeroRunState {
  heroClass: HeroClassId;
  maxHp: number;
  hp: number;
}

export interface MapNode {
  id: string;
  layer: number;
  column: number;
  encounterId: EncounterId;
  kind: "combat" | "elite" | "boss" | "rest" | "upgrade" | "event" | "shop";
  /** Ids of nodes reachable from this node. */
  next: string[];
  completed: boolean;
}

/** Reward choice awaiting player action. Persisted so reloading continues on the reward screen. */
export interface PendingRewardState {
  cardIds: CardId[];
  gold: number;
  relicId?: RelicId;
}

export interface RunState {
  seed: string;
  seedNumber: number;
  heroes: HeroRunState[];
  /** Squad-wide deck — instances are identified by `instanceId`. */
  deck: RunCardInstance[];
  relics: RelicId[];
  gold: number;
  currentNodeId: string | null;
  map: MapNode[];
  /** Completed node ids. */
  completedNodeIds: string[];
  /** Narrative flags for events that can only happen once. */
  flags: Record<string, boolean>;
  /** RNG state snapshot (mulberry32). */
  rngState: number;
  /** Optional: reward the player hasn't picked yet. */
  pendingReward?: PendingRewardState | null;
  /** Cumulative run statistics (for the victory/defeat summary). */
  stats?: RunStats;
}

export interface RunStats {
  enemiesDefeated: number;
  damageDealt: number;
  damageTaken: number;
  goldEarned: number;
  cardsAdded: number;
  cardsRemoved: number;
  cardsUpgraded: number;
  relicsCollected: number;
  turnsTaken: number;
}

export interface SerializedRun extends RunState {
  version: number;
}
