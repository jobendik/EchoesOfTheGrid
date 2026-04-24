import type { CardId, EncounterId, HeroClassId, RelicId } from "../../core/Types.js";

/**
 * Run-level state. Persists between combats and is serialized to
 * localStorage between nodes.
 */

export interface HeroRunState {
  heroClass: HeroClassId;
  maxHp: number;
  hp: number;
  /** Card ids currently in the deck. Duplicates allowed. */
  deck: CardId[];
  /** Card ids that are upgraded. Matches entries in `deck` by first occurrence. */
  upgraded: CardId[];
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
