import { RNG } from "../../core/RNG.js";
import { Balance } from "../../data/balance.js";
import { ENCOUNTERS } from "../../data/encounters.js";
import type { MapNode } from "../state/RunState.js";

/**
 * Simple branching map generator: L layers x N columns, each node
 * connects to 1–2 nodes on the next layer. Last layer is the boss.
 */
export function generateMap(rng: RNG): MapNode[] {
  const L = Balance.run.mapLayers;
  const N = Balance.run.nodesPerLayer;
  const nodes: MapNode[][] = [];
  const all: MapNode[] = [];

  for (let layer = 0; layer < L; layer++) {
    const row: MapNode[] = [];
    // Final layer is exactly one boss node — funnel every penultimate path
    // into a single climactic encounter. Multiple boss columns existed in
    // the prototype but were never the design intent.
    const isBossLayer = layer === L - 1;
    const layerWidth = isBossLayer ? 1 : N;
    const bossCol = Math.floor((N - 1) / 2);
    for (let i = 0; i < layerWidth; i++) {
      const col = isBossLayer ? bossCol : i;
      const kind: MapNode["kind"] = isBossLayer ? "boss" : chooseKind(layer, col, L, rng);
      const enc = isBossLayer ? "enc_boss_cipher" : chooseEncounter(kind, layer, rng);
      const n: MapNode = {
        id: `n_${layer}_${col}`,
        layer,
        column: col,
        encounterId: enc,
        kind,
        next: [],
        completed: false,
      };
      row.push(n);
      all.push(n);
    }
    nodes.push(row);
  }

  // Edges: each node connects to 1–2 nodes in the next layer, trying to keep
  // lines mostly non-crossing (adjacent columns only). The boss row has a
  // single node, so every penultimate node points at it.
  for (let layer = 0; layer < L - 1; layer++) {
    const next = nodes[layer + 1];
    for (const node of nodes[layer]) {
      const candidates =
        next.length === 1
          ? next.slice()
          : next.filter((m) => Math.abs(m.column - node.column) <= 1);
      const choose = Math.max(1, rng.int(1, Math.min(2, candidates.length)));
      const selected = rng.shuffle(candidates).slice(0, choose);
      for (const s of selected) node.next.push(s.id);
    }
    // Ensure each next-layer node has at least one incoming edge by grabbing
    // the closest source and adding an edge if orphaned.
    for (const nextNode of next) {
      const hasIncoming = nodes[layer].some((n) => n.next.includes(nextNode.id));
      if (!hasIncoming) {
        const src = nodes[layer].slice().sort((a, b) =>
          Math.abs(a.column - nextNode.column) - Math.abs(b.column - nextNode.column),
        )[0];
        if (src) src.next.push(nextNode.id);
      }
    }
  }

  return all;
}

function chooseKind(layer: number, _col: number, totalLayers: number, rng: RNG): MapNode["kind"] {
  if (layer === totalLayers - 1) return "boss";
  if (layer === 0) return "combat";
  // Mid-run: mix of combat, event, rest, elite, upgrade, shop.
  const rolls: { kind: MapNode["kind"]; w: number }[] = [
    { kind: "combat", w: 5 },
    { kind: "elite", w: layer >= 2 ? 2 : 0 },
    { kind: "event", w: 2 },
    { kind: "rest", w: layer >= 2 ? 2 : 1 },
    { kind: "upgrade", w: 1 },
    { kind: "shop", w: layer >= 1 ? 2 : 0 },
  ];
  const total = rolls.reduce((s, r) => s + r.w, 0);
  let t = rng.next() * total;
  for (const r of rolls) {
    t -= r.w;
    if (t <= 0) return r.kind;
  }
  return "combat";
}

function chooseEncounter(kind: MapNode["kind"], layer: number, rng: RNG): string {
  if (kind === "rest") return "enc_rest";
  if (kind === "upgrade") return "enc_upgrade";
  if (kind === "shop") return "enc_shop";
  if (kind === "event") {
    // Events are handled via EventDatabase — we encode them via a special
    // encounterId prefix "ev_". The run controller dispatches accordingly.
    return "ev_random";
  }
  if (kind === "boss") return "enc_boss_cipher";
  const tierWanted: 1 | 2 | 3 = layer <= 1 ? 1 : layer <= 3 ? 2 : 3;
  const candidates = ENCOUNTERS.filter(
    (e) => (kind === "elite" ? e.kind === "elite" : e.kind === "combat") && e.tier === tierWanted,
  );
  if (candidates.length === 0) {
    const fallback = ENCOUNTERS.filter((e) => e.kind === (kind === "elite" ? "elite" : "combat"));
    return rng.pick(fallback)?.id ?? "enc_drone_patrol";
  }
  return rng.pick(candidates)!.id;
}
