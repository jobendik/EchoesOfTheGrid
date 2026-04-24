import { makeId } from "../../core/Id.js";
import type { RNG } from "../../core/RNG.js";
import { getCardDef } from "../../data/cards.js";
import type { CardInstance } from "./CardTypes.js";

/**
 * Deck / pile management. Operates on a CombatState-like shape passed by
 * reference but keeps mutation localized here. Pure enough to unit-test.
 */

export function makeCardInstance(defId: string, upgraded = false): CardInstance {
  getCardDef(defId); // throws if unknown
  return {
    instanceId: makeId("card"),
    defId,
    upgraded,
    costModifier: 0,
  };
}

export interface Piles {
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
}

/** Fisher–Yates shuffle via the run-seeded RNG. */
export function shuffleIntoDraw(piles: Piles, rng: RNG): void {
  piles.drawPile = rng.shuffle(piles.drawPile);
}

/**
 * Draws `n` cards; if the draw pile is empty, shuffles discard into draw
 * pile and continues. Respects the hand limit.
 */
export function drawCards(piles: Piles, n: number, rng: RNG, handLimit: number): CardInstance[] {
  const drawn: CardInstance[] = [];
  for (let i = 0; i < n; i++) {
    if (piles.drawPile.length === 0) {
      if (piles.discardPile.length === 0) break;
      piles.drawPile = rng.shuffle(piles.discardPile);
      piles.discardPile = [];
    }
    const card = piles.drawPile.shift()!;
    if (piles.hand.length < handLimit) {
      piles.hand.push(card);
      drawn.push(card);
    } else {
      // Over-draw is discarded
      piles.discardPile.push(card);
    }
  }
  return drawn;
}

/** Discards every non-retained card in hand. */
export function discardHand(piles: Piles): void {
  const keep: CardInstance[] = [];
  for (const card of piles.hand) {
    const def = getCardDef(card.defId);
    if (def.retain) keep.push(card);
    else piles.discardPile.push(card);
  }
  piles.hand = keep;
}

export function discardCard(piles: Piles, card: CardInstance): void {
  piles.hand = piles.hand.filter((c) => c !== card);
  piles.discardPile.push(card);
}

export function exhaustCard(piles: Piles, card: CardInstance): void {
  piles.hand = piles.hand.filter((c) => c !== card);
  piles.exhaustPile.push(card);
}

/** Build a fresh combat draw pile from a list of card ids. */
export function buildDeck(defIds: readonly string[], upgradeMap: Map<string, boolean> = new Map()): CardInstance[] {
  return defIds.map((id) => {
    // upgradeMap is keyed by defId; if two copies have different upgrade
    // state, use a compound key (handled by caller if needed).
    return makeCardInstance(id, upgradeMap.get(id) === true);
  });
}
