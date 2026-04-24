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
}

export interface SerializedRun extends RunState {
  version: number;
}
