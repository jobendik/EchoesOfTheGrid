# Gameplay Notes

Designer-facing notes on the mechanics and balance of Echoes of the Grid.

## Fantasy

You command a three-operator squad infiltrating a corrupted grid — part data-realm, part battlefield — to destroy the Cipher at its core. Each run is a 6-layer climb through branching nodes of combat, events, rest sites, and forges, ending in a boss encounter.

## The three heroes

| Hero | Role | Identity |
| --- | --- | --- |
| **Vanguard** | Tank | Soaks damage with layered shields, pushes enemies, holds the front line. |
| **Riftblade** | Striker | Mobile melee — rewards movement cards, excels at finishing low-HP targets. |
| **Cipher** | Controller | Applies statuses (mark, vulnerable, burn), manipulates cards, shapes the board. |

Each ships with a curated ~9-card starting deck that teaches the hero's identity through play. New cards added via rewards should compose with this baseline.

## Turn structure

1. **Player turn start:** refresh energy (`Balance.player.startingEnergy` = 3 baseline), draw to hand size, tick start-of-turn effects (regen, burn, etc.).
2. **Player turn:** play cards in any order using any hero as the caster. Non-movement cards do not reposition heroes.
3. **End turn:** leftover shield expires (unless Retained), cards in hand discard unless retained, end-of-turn statuses trigger, enemies execute their declared intents.
4. **Intent planning:** after enemy actions, each surviving enemy plans its next intent.

## Resources

- **Energy:** spent to play cards. Refills each turn.
- **HP:** per-hero. Heroes do not heal between combats unless at a rest node.
- **Scrap (gold):** spent at shop nodes (future extension; scrap is tracked in the run state).
- **Shield:** temporary HP that absorbs damage, expires at end of turn.

## Statuses

Tracked as integer stacks on each unit. All statuses live in [`src/game/combat/StatusSystem.ts`](../src/game/combat/StatusSystem.ts).

| Status | Effect | Tick |
| --- | --- | --- |
| `burn` | Deals `burnPerTurnDamage` per stack at turn start, then decrements. | every turn |
| `poison` | Deals N damage then decrements by 1. | every turn |
| `vulnerable` | Takes ×1.5 damage. | decrements each turn |
| `weak` | Deals ×0.75 damage. | decrements each turn |
| `marked` | Attackers deal `markedFlatBonus` extra damage, marked consumed on hit. | on attack |
| `stun` | Skips next turn. | decrements each turn |
| `rooted` | Cannot be moved. | decrements each turn |
| `strength` | +N damage on outgoing attacks. | permanent for combat |
| `retaliate` | Deals N damage back to attackers. | permanent for combat |
| `regen` | Heals N at turn start. | decrements each turn |
| `shield` | Absorbs damage. | refreshes each turn |

## Card archetypes

- **Attacks** resolve damage + optional rider (status, push, draw).
- **Skills** shape the board (shield, draw, add card, buff, debuff).
- **Movement** move one hero, sometimes with a damage or status rider.
- **Powers** persistent for the rest of combat.
- **Tactics** exotic effects — teleports, swaps, temporary spawns, card manipulation.

## Intent-driven combat

The skill ceiling of Echoes is reading enemy intents and positioning/damaging in response. Every enemy commits to a single readable action per turn (attack, AoE, buff, summon, charge). The player's job is:

- **Prioritize** — who deals the most damage next turn? Kill or disable them.
- **Position** — step out of AoE zones, force LoS breaks.
- **Layer** — stack vulnerable/mark before burst turns; shield ahead of big hits.

## Difficulty progression

Map layers 0–5 roughly correspond to tiers:

- Layer 0–1: tier 1 encounters (teaches one mechanic each).
- Layer 2–3: tier 2 encounters (multi-vector threats).
- Layer 4: elite-dense + forge.
- Layer 5: boss.

Elite HP × `eliteHpMultiplier`. Boss HP × `bossHpMultiplier`. Tier-3 enemies get `+tier3DamageBonus` damage.

## Failure states

- Full squad wipe → defeat screen, save cleared.
- Abandon run from the map → save cleared.
- Victory at boss → victory screen, save cleared, seed recorded (future extension: high-score table).

## Levers for tuning

Rather than tuning dozens of cards, prefer:

1. Adjust `Balance.player.startingEnergy` (±1 is huge).
2. Adjust `Balance.player.handSize`.
3. Adjust status multipliers in `Balance.statuses`.
4. Adjust elite/boss HP and tier-3 damage in `Balance.difficulty`.

Individual card tweaks are for outliers. Global knobs keep the meta honest.

## Future work

- **Shop node** (scaffold present in the encounter kind enum) — spend scrap on cards/relics/card removal.
- **Daily seed mode** with a scoreboard.
- **Per-combat replay** from input log + seed.
- **More heroes** — each new hero is a hero blueprint + starting deck + 6–10 class-specific cards.
- **Asset swap** — follow [`ASSETS.md`](../ASSETS.md) to replace placeholders.
