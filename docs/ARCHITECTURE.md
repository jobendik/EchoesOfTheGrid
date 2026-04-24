# Architecture

Echoes of the Grid is organized in four strict layers. Arrows indicate the allowed direction of imports:

```
        src/core/      ← pure utilities (RNG, Logger, Types, EventBus, Ids)
            ↑
        src/data/      ← declarative content (cards, enemies, relics, encounters, events, heroes, balance)
            ↑
        src/game/      ← simulation (grid, units, cards, combat, AI, relics, encounters, progression, state)
            ↑
    src/render/ + src/engine/   ← rendering & audio (canvas, sprites, WebAudio)
            ↑
        src/ui/        ← DOM UI & GameApp orchestration (scenes, tooltips, helpers)
            ↑
        src/main.ts    ← entry point
```

**Hard rules:**

1. `src/game/**` must never import from `src/ui/**` or `src/render/**` — the simulation is headless and testable.
2. `src/data/**` contains only declarative content (no game logic beyond trivial derivations).
3. `src/core/**` has zero dependencies on anything else inside `src/` — it is the most stable layer.
4. Cross-layer communication from simulation to UI happens via the `EventBus` (`src/core/EventBus.ts`). The combat controller fires named events (`damageDealt`, `cardPlayed`, `turnStart`, …); scenes listen.

## Major modules

### Simulation

- **`CombatController`** (`src/game/combat/CombatController.ts`) — the beating heart of the game. Owns combat state, exposes `playCard()`, `endPlayerTurn()`, `resolveEnemyTurn()`, and fires events. Contains the relic trigger dispatcher.
- **`CardEffects`** (`src/game/combat/CardEffects.ts`) — a dispatch table that converts a card definition's effect list into simulation side-effects (damage, shield, draw, move, status, spawn, etc.).
- **`StatusSystem`** (`src/game/combat/StatusSystem.ts`) — a registry of status behaviours. Adding a status = one new record.
- **`DamageSystem`** (`src/game/combat/DamageSystem.ts`) — centralized damage math: computes multipliers from vulnerable/weak, subtracts shield, fires events.
- **`TargetingSystem`** (`src/game/combat/TargetingSystem.ts`) — pure functions that answer *what tiles are legal targets?* and *what tiles would this affect?* given a card definition.
- **`IntentPlanner`** (`src/game/ai/IntentPlanner.ts`) — see `AI_SYSTEM.md`.
- **`DeckManager`** (`src/game/cards/DeckManager.ts`) — draw/shuffle/discard/exhaust/retain lifecycle for card instances.
- **`MapGenerator`** (`src/game/encounters/MapGenerator.ts`) — deterministic branching map from a seeded `RNG`.

### Presentation

- **`GridRenderer`** (`src/render/GridRenderer.ts`) — canvas 2D rendering of the battlefield (tiles, units, intents, telegraphs, overlays, floating numbers).
- **`SpriteFactory`** (`src/render/SpriteFactory.ts`) — procedural shape drawing for unit placeholders.
- **`CardView`** (`src/ui/CardView.ts`) — DOM representation of a card instance (used in hand, rewards, forge).
- **`GameApp`** (`src/ui/GameApp.ts`) — orchestrator: owns the run state, swaps scenes, wires reward flow, and persists the save. Everything in the UI layer calls back into `GameApp` rather than holding its own copies of state.
- **`scenes/*`** — individual screens. Each scene is a function or class returning a DOM root + optional `dispose()`.

### Content

- **`src/data/cards.ts`** — 35+ card definitions.
- **`src/data/enemies.ts`** — enemies keyed by `EnemyId`, each with a behavior profile used by the intent planner.
- **`src/data/relics.ts`** — relic definitions with discriminated-union triggers.
- **`src/data/encounters.ts`** — encounter specs (grid size, spawns, terrain, tier, kind).
- **`src/data/events.ts`** — narrative events with branching outcomes.
- **`src/data/heroes.ts`** — hero blueprints and starting decks.
- **`src/data/balance.ts`** — central balance constants.
- **`src/data/keywords.ts`** — keyword glossary used for tooltips and description highlighting.

### Core

- **`RNG`** — deterministic mulberry32 PRNG. All random decisions in a run flow through one seeded instance so runs are reproducible and savable.
- **`EventBus`** — typed pub-sub with strict `Record<string, unknown>` constraints.
- **`Logger`** — thin wrapper around `console` with tags for dev/prod filtering.
- **`SaveVersion`** — versioning constants for `localStorage` keys; bump on any breaking schema change.

## State model

Two distinct state objects:

- **`RunState`** (persistent across combats, serialized to `localStorage`) — seed, heroes (class + HP + deck + upgrades), relics, gold, map, current node, RNG snapshot, flags.
- **`CombatState`** (transient, one per combat) — grid, units, intents, turn, phase, hand/draw/discard/exhaust piles, energy, log, telegraphs, player state, debug flags.

When a combat ends, `GameApp.onCombatVictory()` mutates the matching run state fields (HP, relics earned, card rewards) and writes the whole `RunState` back to storage.

## Determinism & testing

Everything random uses a single `RNG` instance seeded from the run seed. `tests/combat.test.ts` demonstrates that two `CombatController`s built from the same seed produce identical shuffles. This makes:

- **Replays** possible in future (just log inputs).
- **Bug reports** reproducible (include the seed).
- **AI tuning** safe (changing the planner doesn't affect deterministic card draws).

## Extension points

- **New card** → edit `src/data/cards.ts` + (if needed) add a new effect kind to `CardTypes.ts` and its handler in `CardEffects.ts`.
- **New status** → add a record to the status registry in `StatusSystem.ts`.
- **New relic trigger** → extend the relic discriminated union in `RelicTypes.ts` and add a case in the `CombatController`'s trigger dispatcher.
- **New enemy behavior** → add a profile option in `enemies.ts`; update the `IntentPlanner` scorers to handle it.
- **New encounter / event / hero** → add an entry in the matching `src/data/` file.
- **New scene** → create a file under `src/ui/scenes/` and wire it into `GameApp`.

## Non-goals

- **Networking / multiplayer** — out of scope; the architecture can accommodate a server-authoritative mode by making `CombatController` pluggable.
- **Procedural art generation beyond shapes** — intentional. The manifest makes swapping to real art trivial.
