/**
 * Keyword dictionary used by tooltips. Keywords are referenced from card
 * descriptions and status effects. Keeping them in one place lets the UI
 * cross-link everywhere without string duplication.
 */
export interface KeywordDef {
  id: string;
  name: string;
  description: string;
}

export const KEYWORDS: readonly KeywordDef[] = [
  { id: "shield", name: "Shield", description: "Absorbs incoming damage before HP. Decays at end of turn." },
  { id: "marked", name: "Marked", description: "Attacks against marked units deal +2 damage." },
  { id: "weak", name: "Weak", description: "Attacks deal 25% less damage." },
  { id: "vulnerable", name: "Vulnerable", description: "Takes 50% more damage from attacks." },
  { id: "burn", name: "Burn", description: "Deals 2 damage at start of turn, then expires." },
  { id: "poison", name: "Poison", description: "Deals 1 damage per stack, then -1 stack, at start of turn." },
  { id: "stun", name: "Stun", description: "Stunned units skip their next turn." },
  { id: "rooted", name: "Rooted", description: "Rooted units cannot move." },
  { id: "retain", name: "Retain", description: "This card stays in your hand between turns instead of being discarded." },
  { id: "exhaust", name: "Exhaust", description: "Once played, this card leaves play for the rest of combat." },
  { id: "push", name: "Push", description: "Move target away from the source along the line of the attack." },
  { id: "pull", name: "Pull", description: "Move target toward the source along the attack line." },
  { id: "overwatch", name: "Overwatch", description: "Unit will attack the first target to enter its line of sight." },
  { id: "retaliate", name: "Retaliate", description: "When attacked, deal stacks damage to the attacker." },
  { id: "strength", name: "Strength", description: "Attacks deal +1 damage per stack." },
  { id: "fragile", name: "Fragile", description: "Takes +1 damage from all sources per stack." },
  { id: "regen", name: "Regen", description: "Heals stacks HP at start of turn, then -1 stack." },
  { id: "taunt", name: "Taunt", description: "Enemy AI prefers taunting targets." },
  { id: "innate", name: "Innate", description: "Starts in your hand on the first turn." },
];

export const KEYWORD_MAP = new Map(KEYWORDS.map((k) => [k.id, k]));
