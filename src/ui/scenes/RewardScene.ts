import { audio } from "../../engine/AudioManager.js";
import type { CardDefinition } from "../../game/cards/CardTypes.js";
import type { RelicDefinition } from "../../game/relics/RelicTypes.js";
import { renderCard } from "../CardView.js";
import { el } from "../UIHelpers.js";
import { makeCardInstance } from "../../game/cards/DeckManager.js";
import type { GameApp } from "../GameApp.js";

/**
 * Post-combat reward scene. Offers: gold, a card choice (3 cards), and
 * occasionally a relic. Skipping is always allowed.
 */
export function renderRewardScene(
  app: GameApp,
  cards: CardDefinition[],
  gold: number,
  relic: RelicDefinition | undefined,
): HTMLElement {
  const scene = el("div", { class: "scene reward-scene" });
  scene.appendChild(el("div", { class: "reward-title", text: "Victory" }));
  scene.appendChild(el("div", { class: "dim", text: `+${gold} scrap recovered` }));

  if (relic) {
    const relicRow = el("div", { class: "panel", style: { padding: "14px 20px", display: "flex", gap: "12px", alignItems: "center", maxWidth: "520px" } as Partial<CSSStyleDeclaration> }, [
      el("div", { style: { fontSize: "30px", color: "var(--c-gold)" } as Partial<CSSStyleDeclaration>, text: "◈" }),
      el("div", {}, [
        el("h3", { text: relic.name }),
        el("div", { class: "dim", text: relic.description }),
      ]),
      el("button", { class: "primary", text: "Take Relic", onClick: () => { audio.play("reward"); app.acceptRelic(relic.id); } }),
    ]);
    scene.appendChild(relicRow);
  }

  if (cards.length > 0) {
    scene.appendChild(el("div", { style: { marginTop: "12px", color: "var(--c-fg-dim)", letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "12px" } as Partial<CSSStyleDeclaration>, text: "Choose a card — or skip" }));
    const row = el("div", { class: "reward-offer" });
    for (const def of cards) {
      const inst = makeCardInstance(def.id);
      const node = renderCard(inst, {
        onClick: () => { audio.play("cardSelect"); app.acceptCard(def.id); },
      });
      row.appendChild(node);
    }
    scene.appendChild(row);
  }

  scene.appendChild(el("button", { class: "subtle", text: "Skip Rewards", onClick: () => { audio.play("cardHover"); app.skipRewards(); } }));
  return scene;
}
