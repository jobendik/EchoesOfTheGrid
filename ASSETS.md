# ASSETS.md — Placeholder-to-Production Pipeline

Echoes of the Grid ships with **only procedural placeholders** — no image or audio files are committed. This keeps the repository light and copyright-clean while making it trivial to swap in real art later.

## Core idea

There is a single asset manifest at [`src/data/assets.ts`](src/data/assets.ts) that maps *asset keys* (strings like `"heroes.vanguard"` or `"audio.cardPlay"`) to either a procedural placeholder spec or a future production path. Every game module refers to assets by key — never by path — so replacing a placeholder never requires code changes outside the manifest.

```ts
// src/data/assets.ts (excerpt)
export const ASSET_MANIFEST: Record<AssetKey, AssetEntry> = {
  "heroes.vanguard": {
    placeholder: { kind: "shape", shape: "shield", color: "#6bb8ff" },
    // productionPath: "sprites/heroes/vanguard.png", // add later
  },
  "audio.cardPlay": {
    placeholder: { kind: "tone", preset: "cardPlay" },
    // productionPath: "audio/card-play.ogg",
  },
};
```

## Sprite placeholders

`src/render/SpriteFactory.ts` reads a unit's asset entry and draws a canvas shape based on its `shape` and `color` fields. Supported placeholder shapes:

- `circle` · `triangle` · `square` · `diamond` · `hex` · `star` · `blade` · `shield` · `orb`

To replace a placeholder with a real sprite:

1. Drop the file in `public/sprites/…` (Vite serves `public/` at the root).
2. Set `productionPath` on the manifest entry.
3. Extend `SpriteFactory.drawUnitSprite` to prefer `productionPath` (image load + cache) when present. The placeholder path remains as a fallback.

The same applies to card art: `src/ui/CardView.ts` generates a tiny SVG glyph from the card id. You can replace `makeCardArt` with an `<img>` loader that reads a per-card path once real art is ready.

## Audio placeholders

`src/engine/AudioManager.ts` synthesizes short tones via the Web Audio API using presets declared in `PRESETS`. Each preset defines shape, frequency, duration, and an optional frequency ramp. Sounds currently mapped:

- UI: `cardHover`, `cardSelect`, `cardPlay`, `invalid`, `turnStart`, `mapNode`
- Combat: `hit`, `enemyAttack`, `enemyDeath`, `shieldGain`, `heal`
- Meta: `reward`, `victory`, `defeat`

To swap for real audio:

1. Drop `.ogg`/`.mp3`/`.wav` into `public/audio/`.
2. Add `productionPath` to the manifest entry.
3. Extend `AudioManager.play()` to load and cache a buffer from that path, falling back to the tone preset on load failure.

## Typography & UI

No web fonts are bundled. The UI uses the system font stack (Inter → system-ui → sans-serif) and a monospace stack for stat readouts. If you want Inter or another font, add a `<link>` to `index.html` — no code changes required.

## License & copyright

Because everything in this repository is either procedurally generated or plain text, there are no third-party licensing concerns. When you add real assets, document their origins and licenses here, for example:

```
sprites/heroes/vanguard.png — CC-BY 4.0, by <artist>, https://…
audio/card-play.ogg — CC0, freesound.org #12345
```

## Keeping the manifest honest

The data-integrity test in `tests/data.test.ts` can be extended to assert that every referenced asset key exists in the manifest. This prevents shipping a broken build when an asset is renamed.
