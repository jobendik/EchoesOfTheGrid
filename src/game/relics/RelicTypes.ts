import type { AssetKey, RelicId } from "../../core/Types.js";

/**
 * Relic trigger taxonomy. Relics subscribe to named trigger points that the
 * combat controller fires. New triggers can be added as new relic ideas
 * emerge — the combat controller's switch is deliberately open.
 */
export type RelicTrigger =
  | "onCombatStart"
  | "onTurnStart"
  | "onTurnEnd"
  | "onCardPlayed"
  | "onAttackDealt"
  | "onDamageTaken"
  | "onEnemyPushed"
  | "onStatusApplied"
  | "onEnemyKilled"
  | "onLethalPrevent";

export type RelicEffect =
  | { kind: "startCombatShield"; amount: number }
  | { kind: "bonusEnergy"; amount: number }
  | { kind: "firstAttackBonusPerTurn"; amount: number }
  | { kind: "bonusDamageOnMarked"; amount: number }
  | { kind: "drawOnPush" }
  | { kind: "shieldOnMoveCard"; amount: number }
  | { kind: "poisonReducesEnemyDamage"; amount: number }
  | { kind: "preventLethalOnce" }
  | { kind: "zeroCostBonusDamage"; amount: number }
  | { kind: "endOfTurnMarkedTick"; amount: number }
  | { kind: "healOnKill"; amount: number }
  | { kind: "extraStatusStacks"; amount: number }
  | { kind: "discountFirstCard" }
  | { kind: "shieldOnShieldCard"; amount: number }
  | { kind: "startCombatRegen"; amount: number }
  | { kind: "startCombatBurnEnemies"; amount: number }
  | { kind: "bonusDamageIfMoved"; amount: number }
  | { kind: "extraDrawPerTurn"; amount: number };

export interface RelicDefinition {
  id: RelicId;
  name: string;
  description: string;
  rarity: "common" | "uncommon" | "rare" | "boss";
  trigger: RelicTrigger;
  effect: RelicEffect;
  iconKey: AssetKey;
}
