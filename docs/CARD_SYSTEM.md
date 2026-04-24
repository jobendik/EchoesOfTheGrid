# Card System

Every card in Echoes of the Grid is a pure data record in [`src/data/cards.ts`](../src/data/cards.ts). The card system is built around two ideas:

1. **Effects are declarative.** A card's behavior is a list of typed effects, not imperative code.
2. **Targeting is a separate concern.** Legal targets and affected tiles are computed from the `targeting` field by `TargetingSystem` — cards never re-implement target math.

## Card schema

```ts
interface CardDefinition {
  id: CardId;                    // unique, kebab_snake_case
  name: string;
  type: "attack" | "skill" | "movement" | "power" | "tactic";
  rarity: "starter" | "common" | "uncommon" | "rare" | "curse";
  cost: number;                  // energy cost (0..∞)
  upgradedCost?: number;         // cost when upgraded (Card+)
  description: string;
  upgradedDescription?: string;
  keywords: KeywordId[];         // e.g. ["exhaust", "innate"]
  targeting: TargetingSpec;      // see below
  effects: CardEffect[];         // ordered list, resolved in sequence
  upgradedEffects?: CardEffect[];// replaces `effects` when upgraded
  unplayable?: boolean;          // curses
  retain?: boolean;              // not discarded at end of turn
  ethereal?: boolean;            // exhausted if still in hand at end of turn
  exhaust?: boolean;             // exhausted when played
}
```

## Targeting specs

```ts
type TargetingSpec =
  | { kind: "none" }
  | { kind: "self" }
  | { kind: "singleEnemy"; range?: number; requiresLoS?: boolean }
  | { kind: "singleAlly"; range?: number }
  | { kind: "tile"; range?: number; area?: AreaPattern }
  | { kind: "allEnemies" }
  | { kind: "allAllies" }
  | { kind: "line"; length: number }
  | { kind: "cone"; length: number; width: number };
```

`TargetingSystem.isValidTarget` answers whether the player may click a given tile. `TargetingSystem.computeAffectedTiles` returns the preview tiles (highlighted in cyan on the grid).

## Effects

Card effects are discriminated by `kind`:

- `damage` — physical damage to target(s). Respects vulnerable/weak/marked.
- `shield` — temporary shield on caster or ally.
- `heal` — restore HP (clamped to maxHp).
- `draw` — draw N cards.
- `addEnergy` — gain energy this turn.
- `applyStatus` — add a stack of a status to a target (poison, burn, stun, vulnerable, weak, marked, strength, retaliate, rooted, regen).
- `move` — move caster along a direction or to a tile.
- `push` / `pull` — displacement on the target.
- `spawn` — create a temporary unit (e.g. decoy).
- `addCardToHand` — put a card instance into hand (e.g. Stim injects a tempo card).
- `exhaustRandomCard` / `discardHand` — curse-flavoured effects.
- `tileTransform` — change a tile's kind (e.g. create hazard).

Add a new effect kind by:
1. Extending the `CardEffect` union in `src/game/cards/CardTypes.ts`.
2. Adding a case in `CardEffects.resolveEffect`.

## Keywords

The keyword glossary lives in [`src/data/keywords.ts`](../src/data/keywords.ts). Descriptions mentioning a keyword are highlighted automatically in the card tooltip (see `CardView.formatKeywords`).

Built-in keywords: `exhaust`, `retain`, `innate`, `ethereal`, `unplayable`, `pierce` (ignores shield), `chain` (hits a second random enemy), `finisher` (bonus vs low-HP targets), `overload` (adds a curse to discard).

## Upgrades

A card with an `upgraded…` field is upgradeable. Forge nodes and some events call `GameApp.upgradeCardInDeck`, which records the card id in the hero's `upgraded` list. When a combat instance of the card is drawn, the `upgraded` flag is set, which flips the effects and description.

## Deck lifecycle

`DeckManager` handles the standard deckbuilder pipeline:

- `drawPile` → shuffled subset of the deck, drawn from in order.
- `hand` → current playable cards.
- `discardPile` → discarded cards; when `drawPile` empties, the discard is shuffled in.
- `exhaustPile` → removed-for-the-rest-of-combat cards.

Each turn the controller draws up to `Balance.player.handSize`, clamped by `handLimit`. Cards can be `retain`ed to persist through turns, or marked `ethereal` to self-exhaust at end of turn.

## Curses

A curse is just a card with `unplayable: true` and `rarity: "curse"`. The hand UI greys curses out; they're typically added by events or powerful effects and exiting the run requires removing them at forge nodes.

## Balancing guidelines

The central knobs live in [`src/data/balance.ts`](../src/data/balance.ts):

- `player.startingEnergy` — how aggressive the turn economy is.
- `player.handSize` — options per turn.
- `statuses.burnPerTurnDamage`, `weakMultiplier`, `vulnerableMultiplier`, `markedFlatBonus` — tune status potency.
- `difficulty.*` — elite/boss multipliers, tier-3 damage bonus.

Keep individual card numbers small and the global knobs as the primary tuning surface.
