import type {
  AssetKey,
  CardId,
  CardType,
  ClassId,
  KeywordId,
  Rarity,
} from "../../core/Types.js";

export type CardTag =
  | "strike"
  | "combo"
  | "ranged"
  | "aoe"
  | "movement"
  | "defense"
  | "control"
  | "support"
  | "heal"
  | "push"
  | "pull"
  | "mark"
  | "finisher"
  | "reaction"
  | "utility"
  | "curse";

/**
 * How the player chooses where to aim a card. The resolver converts the
 * selected target into a list of affected tiles using the shape below.
 */
export type TargetingKind =
  | "self"           // no selection required
  | "ally"           // a friendly unit (hero)
  | "enemy"          // an enemy unit in range
  | "unit"           // any unit in range
  | "tile"           // any tile in range
  | "emptyTile"      // empty tile in range
  | "allEnemies"     // no selection — affects all enemies
  | "allAllies"      // no selection — affects all heroes
  | "none";          // purely passive/power cards

export type AreaShape =
  | { kind: "single" }
  | { kind: "radius"; radius: number }
  | { kind: "cross"; radius: number }
  | { kind: "line"; length: number }
  | { kind: "cone"; length: number }
  | { kind: "adjacent" };

export interface TargetingDefinition {
  kind: TargetingKind;
  /** Max Manhattan range from the caster. 0 means the caster's tile. */
  range: number;
  area: AreaShape;
}

/** Every effect is a tagged union resolved by CardEffects.ts. */
export type CardEffectDefinition =
  | { kind: "damage"; amount: number }
  | { kind: "damageMarkedBonus"; amount: number }
  | { kind: "damageIfMoved"; amount: number }
  | { kind: "damageIfBelowHp"; amount: number; threshold: number; baseDamage?: number }
  | { kind: "heal"; amount: number }
  | { kind: "shield"; amount: number }
  | { kind: "shieldAllAllies"; amount: number }
  | { kind: "healAllAllies"; amount: number }
  | { kind: "applyStatus"; status: KeywordId; stacks: number; filterBelowHpPct?: number }
  | { kind: "applyStatusSelf"; status: KeywordId; stacks: number }
  | { kind: "applyStatusInArea"; status: KeywordId; stacks: number; side: "enemy" | "ally" }
  | { kind: "applyStatusAll"; status: KeywordId; stacks: number; side: "enemy" | "ally" }
  | { kind: "drawCards"; amount: number }
  | { kind: "drawIfMoved"; amount: number }
  | { kind: "gainEnergy"; amount: number }
  | { kind: "exhaustSelf" }
  | { kind: "moveSelf"; distance: number }
  | { kind: "moveTarget"; distance: number; teleport?: boolean }
  | { kind: "push"; distance: number }
  | { kind: "pull"; distance: number }
  | { kind: "swapPositions" }
  | { kind: "summonHazard" }
  | { kind: "mark"; stacks: number }
  | { kind: "stun"; stacks: number }
  | { kind: "revealIntents" }
  | { kind: "chainDamage"; amount: number; jumps: number }
  | { kind: "addCardToHand"; cardId: CardId; count: number }
  | { kind: "modifyCostThisTurn"; amount: number }
  | { kind: "loseHp"; amount: number };

export interface CardDefinition {
  id: CardId;
  name: string;
  classId: ClassId;
  rarity: Rarity;
  type: CardType;
  cost: number;
  /** If omitted, upgraded card keeps same cost. */
  upgradedCost?: number;
  targeting: TargetingDefinition;
  effects: readonly CardEffectDefinition[];
  upgradedEffects?: readonly CardEffectDefinition[];
  tags: readonly CardTag[];
  keywords: readonly KeywordId[];
  description: string;
  upgradedDescription?: string;
  artKey: AssetKey;
  /** Optional flags controlling deck-cycle behavior. */
  exhaust?: boolean;
  retain?: boolean;
  innate?: boolean;
  unplayable?: boolean;
}

/** Runtime instance of a card owned by a hero / deck. */
export interface CardInstance {
  instanceId: string;
  defId: CardId;
  upgraded: boolean;
  /** Temporary per-turn cost modifier (e.g. curses). */
  costModifier: number;
}
