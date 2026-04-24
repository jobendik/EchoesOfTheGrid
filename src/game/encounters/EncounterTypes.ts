import type { EncounterId, EnemyId, EventId, TileKind } from "../../core/Types.js";

export type EncounterKind =
  | "combat"
  | "elite"
  | "boss"
  | "rest"
  | "upgrade"
  | "event"
  | "shop";

export interface EnemySpawn {
  kind: EnemyId;
  /** Optional position; if omitted the encounter generator places it. */
  x?: number;
  y?: number;
}

export interface TerrainPatch {
  kind: TileKind;
  tiles: { x: number; y: number }[];
}

export interface EncounterDefinition {
  id: EncounterId;
  name: string;
  kind: EncounterKind;
  /** Suggested act / depth. Encounter picker uses this for difficulty. */
  tier: 1 | 2 | 3;
  gridWidth: number;
  gridHeight: number;
  spawns: readonly EnemySpawn[];
  terrain?: readonly TerrainPatch[];
  description: string;
}

export type EventChoiceOutcome =
  | { kind: "heal"; amount: number }
  | { kind: "loseHp"; amount: number }
  | { kind: "addRelic"; rarity: "common" | "uncommon" | "rare" }
  | { kind: "addRandomCard"; rarity: "common" | "uncommon" | "rare" }
  | { kind: "removeCard" }
  | { kind: "upgradeCard" }
  | { kind: "addGold"; amount: number }
  | { kind: "addCurse" }
  | { kind: "nothing" };

export interface EventChoice {
  label: string;
  description: string;
  outcomes: readonly EventChoiceOutcome[];
}

export interface EventDefinition {
  id: EventId;
  title: string;
  flavor: string;
  choices: readonly EventChoice[];
}
