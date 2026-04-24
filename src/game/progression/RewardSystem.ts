import type { RNG } from "../../core/RNG.js";
import { CARDS } from "../../data/cards.js";
import { RELICS } from "../../data/relics.js";
import type { CardDefinition } from "../cards/CardTypes.js";
import type { RelicDefinition } from "../relics/RelicTypes.js";

/**
 * Reward rolls. All reward lists are pulled from the card / relic databases
 * and filtered by rarity + class relevance, so adding content to the DB
 * automatically makes it draftable.
 */

export function rollCardReward(
  rng: RNG,
  options: { count?: number; tier?: 1 | 2 | 3; ownedRelics?: string[] } = {},
): CardDefinition[] {
  const count = options.count ?? 3;
  const rarityWeights = rarityWeightsForTier(options.tier ?? 1);
  const chosen: CardDefinition[] = [];
  const pool = CARDS.filter((c) => c.rarity !== "starter" && c.rarity !== "curse");
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    const rarity = weightedPick(rng, rarityWeights);
    const candidates = pool.filter((c) => c.rarity === rarity && !used.has(c.id));
    const pick = rng.pick(candidates) ?? rng.pick(pool.filter((c) => !used.has(c.id)));
    if (pick) {
      chosen.push(pick);
      used.add(pick.id);
    }
  }
  return chosen;
}

export function rollRelicReward(
  rng: RNG,
  ownedRelicIds: readonly string[],
  targetRarity: "common" | "uncommon" | "rare" | "boss" = "uncommon",
): RelicDefinition | undefined {
  const pool = RELICS.filter((r) => r.rarity === targetRarity && !ownedRelicIds.includes(r.id));
  return rng.pick(pool);
}

function rarityWeightsForTier(tier: 1 | 2 | 3): { key: "common" | "uncommon" | "rare"; w: number }[] {
  if (tier === 1) return [{ key: "common", w: 65 }, { key: "uncommon", w: 30 }, { key: "rare", w: 5 }];
  if (tier === 2) return [{ key: "common", w: 45 }, { key: "uncommon", w: 40 }, { key: "rare", w: 15 }];
  return [{ key: "common", w: 25 }, { key: "uncommon", w: 50 }, { key: "rare", w: 25 }];
}

function weightedPick<T extends { key: unknown; w: number }>(rng: RNG, list: readonly T[]): T["key"] {
  const total = list.reduce((s, r) => s + r.w, 0);
  let t = rng.next() * total;
  for (const r of list) {
    t -= r.w;
    if (t <= 0) return r.key;
  }
  return list[list.length - 1].key;
}
