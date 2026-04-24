import type { AssetKey } from "../core/Types.js";

/**
 * Central asset manifest. Every visual / audio reference in the game resolves
 * through this object. `placeholder: "generated"` means the renderer will
 * draw/synthesize a placeholder; a `productionPath` can be added to any entry
 * to switch to real artwork without touching game logic.
 *
 * See docs/ASSETS.md and ASSETS.md for the full replacement guide.
 */

export interface AssetEntry {
  placeholder: "generated" | "generated-tone";
  productionPath?: string;
  /** Optional hex color used by placeholder drawing code. */
  color?: string;
  /** Optional geometric shape hint for placeholder sprites. */
  shape?: "circle" | "triangle" | "square" | "diamond" | "hex" | "blade" | "shield" | "orb" | "star";
}

export const Assets = {
  heroes: {
    vanguard: { placeholder: "generated", color: "#6bb8ff", shape: "shield" } as AssetEntry,
    riftblade: { placeholder: "generated", color: "#c793ff", shape: "blade" } as AssetEntry,
    signalist: { placeholder: "generated", color: "#7be8ff", shape: "orb" } as AssetEntry,
  },
  enemies: {
    drone: { placeholder: "generated", color: "#ff7b7b", shape: "triangle" } as AssetEntry,
    brute: { placeholder: "generated", color: "#b04040", shape: "square" } as AssetEntry,
    sniper: { placeholder: "generated", color: "#ff9a3c", shape: "diamond" } as AssetEntry,
    shieldbearer: { placeholder: "generated", color: "#ffb86b", shape: "shield" } as AssetEntry,
    leaper: { placeholder: "generated", color: "#ff5577", shape: "triangle" } as AssetEntry,
    bomber: { placeholder: "generated", color: "#ffa257", shape: "hex" } as AssetEntry,
    warden: { placeholder: "generated", color: "#d070ff", shape: "star" } as AssetEntry,
    parasite: { placeholder: "generated", color: "#7be8a0", shape: "circle" } as AssetEntry,
    sentinel: { placeholder: "generated", color: "#6bc0ff", shape: "diamond" } as AssetEntry,
    boss_cipher: { placeholder: "generated", color: "#ffe066", shape: "star" } as AssetEntry,
  },
  cards: {
    generic: { placeholder: "generated", color: "#8aa0c0" } as AssetEntry,
    attack: { placeholder: "generated", color: "#ff8080" } as AssetEntry,
    defense: { placeholder: "generated", color: "#6bb8ff" } as AssetEntry,
    movement: { placeholder: "generated", color: "#c793ff" } as AssetEntry,
    skill: { placeholder: "generated", color: "#7be8a0" } as AssetEntry,
    rare: { placeholder: "generated", color: "#ffe066" } as AssetEntry,
    curse: { placeholder: "generated", color: "#a02040" } as AssetEntry,
  },
  ui: {
    energy: { placeholder: "generated", color: "#ffe066" } as AssetEntry,
    heart: { placeholder: "generated", color: "#ff6b6b" } as AssetEntry,
    shield: { placeholder: "generated", color: "#6bb8ff" } as AssetEntry,
  },
  audio: {
    cardHover: { placeholder: "generated-tone" } as AssetEntry,
    cardSelect: { placeholder: "generated-tone" } as AssetEntry,
    cardPlay: { placeholder: "generated-tone" } as AssetEntry,
    invalid: { placeholder: "generated-tone" } as AssetEntry,
    hit: { placeholder: "generated-tone" } as AssetEntry,
    shieldGain: { placeholder: "generated-tone" } as AssetEntry,
    heal: { placeholder: "generated-tone" } as AssetEntry,
    enemyAttack: { placeholder: "generated-tone" } as AssetEntry,
    enemyDeath: { placeholder: "generated-tone" } as AssetEntry,
    reward: { placeholder: "generated-tone" } as AssetEntry,
    mapNode: { placeholder: "generated-tone" } as AssetEntry,
    victory: { placeholder: "generated-tone" } as AssetEntry,
    defeat: { placeholder: "generated-tone" } as AssetEntry,
    turnStart: { placeholder: "generated-tone" } as AssetEntry,
  },
} as const;

/** Resolve an asset key of the form `section.name` and return the entry. */
export function resolveAsset(key: AssetKey): AssetEntry | undefined {
  const [section, name] = key.split(".");
  const sec = (Assets as Record<string, Record<string, AssetEntry>>)[section];
  return sec?.[name];
}
