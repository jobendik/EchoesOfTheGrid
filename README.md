# Echoes of the Grid

> A tactical roguelike deckbuilder prototype, built in TypeScript + Vite as a portfolio piece.

**Echoes of the Grid** is a grid-based tactical deckbuilder: you command a squad of three operators — *Vanguard*, *Riftblade*, and *Cipher* — through a corrupted grid of combat, event, rest, and forge nodes, climbing toward a boss encounter. Every run is seeded, deterministic, and serializable.

This repository is a deliberately polished slice of a full game: it showcases **systems architecture**, **data-driven content**, **readable enemy AI**, and a **placeholder-first asset pipeline** that can be upgraded to production art without touching simulation code.

## Demo

- **Live demo (GitHub Pages):** enable GitHub Pages → Source: "GitHub Actions" to auto-deploy via `.github/workflows/deploy.yml`.
- **Local preview:** `npm install && npm run dev`

## Why this project

This is designed to impress two audiences:

1. **Players** get a compact, replayable tactical game with legible systems: visible intents, cause-and-effect combat, deterministic runs, keyboard & mouse support, tooltips, debug overlay, and multiple viable strategies.
2. **Reviewers** get a clean, heavily-commented TypeScript codebase with zero runtime dependencies — just Vite for dev tooling — organized the way a small indie team would actually ship a live game.

## Feature highlights

- **Tactical grid combat** on a variable-sized grid with cover, hazards, energy wells, and objective tiles.
- **Three heroes** with distinct starting decks and roles (tank / striker / controller).
- **35+ data-driven cards** spanning attacks, skills, movement, powers, and tactics — with upgrade paths.
- **Utility-based enemy AI** with visible intents, damage predictions, and human-readable *reason strings* explaining every action (hover any enemy to see *why* it chose that move).
- **Status effect registry** — add new statuses by writing a single record.
- **15 relics** with event-driven triggers (start-of-combat, on-attack, on-card-played, etc.).
- **Branching run map** with 6 node types (combat, elite, boss, rest, forge, event).
- **6 narrative events** with branching outcomes.
- **Deterministic seeded runs** — every run is reproducible from its seed string.
- **Versioned save/load** to `localStorage` with schema-mismatch guards.
- **WebAudio tone-based placeholder audio** — swap for real SFX via the asset manifest.
- **Procedural placeholder art** — every unit and card draws its own shape / SVG, trivially replaceable with real sprites.
- **Debug overlay** (press `` ` `` or `F1`) showing turn, energy, intents + reasons, seed, and pile sizes.
- **Keyboard-friendly:** `1–9` play cards, `Tab` cycle hero, `Enter` end turn, `Esc` cancel, `` ` ``/`F1` debug.

## Quickstart

```bash
npm install
npm run dev         # Vite dev server at http://localhost:5173
npm run typecheck   # Strict tsc, zero errors
npm test            # Vitest unit/integration tests
npm run build       # Production build into dist/
npm run preview     # Preview the production build
```

Node 20+ is recommended.

## Controls

| Action | Keyboard | Mouse |
| --- | --- | --- |
| Play card in slot _n_ | `1`–`9` | Click card, click target |
| Cycle active hero | `Tab` | Click hero plate or hero sprite |
| Cancel targeting | `Esc` | — |
| End turn | `Enter` | End Turn button |
| Toggle debug overlay | `` ` `` / `F1` | — |
| Inspect enemy intent | — | Hover enemy row or sprite |

## Repository layout

```
src/
├── core/         Pure engine utilities: RNG, EventBus, Logger, Types, IDs, SaveVersion
├── data/         Data-driven content: cards, relics, enemies, encounters, events, heroes, balance
├── engine/       AudioManager (WebAudio tone presets)
├── game/         Simulation layer — no DOM imports
│   ├── grid/     Grid, pathfinding, area patterns
│   ├── units/    Unit types + factory
│   ├── cards/    Card types + deck manager
│   ├── combat/   CombatController, card effects, status system, targeting, damage
│   ├── ai/       Intent planner (utility-based)
│   ├── relics/   Relic type + triggers (implemented inside CombatController)
│   ├── encounters/ Encounter types + MapGenerator
│   ├── progression/ Reward rolling
│   └── state/    CombatState, RunState, SaveState
├── render/       GridRenderer, SpriteFactory — canvas drawing
├── ui/           DOM UI layer: GameApp controller + scenes (menu, map, combat, rewards, events, rest, overlays)
├── styles/       CSS (one file, design tokens + component styles)
└── main.ts       Entry point
tests/            Vitest test suites
docs/             ARCHITECTURE.md, CARD_SYSTEM.md, AI_SYSTEM.md, GAMEPLAY.md, ASSETS.md
```

**Rule:** code under `src/game/` never imports from `src/ui/` or `src/render/`. This clean simulation↔presentation split makes it easy to write headless tests (see `tests/combat.test.ts`) and to swap the renderer.

## Adding content

Every content type is a pure data entry. Adding a new card, enemy, relic, encounter, or event requires no new code — just edit the matching file under `src/data/`.

- **New card:** add an entry to `src/data/cards.ts`. See `CARD_SYSTEM.md`.
- **New enemy:** add an entry to `src/data/enemies.ts` and reference its `id` from an encounter.
- **New encounter:** add to `src/data/encounters.ts`.
- **New relic:** add to `src/data/relics.ts`. Trigger hooks are wired automatically via `CombatController`.
- **New event:** add to `src/data/events.ts`.

After adding, run `npm test` — the data-integrity test suite catches typos and missing fields immediately.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — module layering, data flow, and extension points.
- [`docs/CARD_SYSTEM.md`](docs/CARD_SYSTEM.md) — how cards are declared, targeted, and resolved.
- [`docs/AI_SYSTEM.md`](docs/AI_SYSTEM.md) — utility-based enemy planner and why it produces readable behavior.
- [`docs/GAMEPLAY.md`](docs/GAMEPLAY.md) — designer notes on mechanics and balance levers.
- [`ASSETS.md`](ASSETS.md) — asset manifest and placeholder-to-production swap workflow.

## Deployment

The repository ships with `.github/workflows/deploy.yml` which builds on `main` and deploys `dist/` to GitHub Pages. Enable Pages with *Source: GitHub Actions* and push to `main`.

The Vite config uses `base: "./"` so the build works both on GitHub Pages (any sub-path) and via `vite preview`.

## Tests

```bash
npm test
```

Five suites totalling 20+ tests:

- `tests/rng.test.ts` — deterministic RNG, snapshot/restore.
- `tests/grid.test.ts` — pathfinding primitives.
- `tests/data.test.ts` — content database integrity (ids unique, shapes valid).
- `tests/save.test.ts` — save/load round-trip.
- `tests/combat.test.ts` — end-to-end combat smoke through the `CombatController`.

## License

MIT — see [`LICENSE`](LICENSE).

## Credits

Placeholder art, tones, typography (system UI stack), and all game design by the repository author. Intended as a portfolio prototype, not a commercial release.
