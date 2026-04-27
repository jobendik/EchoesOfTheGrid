import { audio } from "../../engine/AudioManager.js";
import { getCardDef } from "../../data/cards.js";
import { makeCardInstance } from "../../game/cards/DeckManager.js";
import type { HeroRunState, RunCardInstance } from "../../game/state/RunState.js";
import { renderCard } from "../CardView.js";
import { el } from "../UIHelpers.js";
import type { GameApp } from "../GameApp.js";

/** Rest site: heal all heroes 30% of maxHp, OR upgrade a card. */
export function renderRestScene(app: GameApp, heroes: HeroRunState[]): HTMLElement {
  const scene = el("div", { class: "scene event-scene" });
  const card = el("div", { class: "panel event-card" }, [
    el("h2", { text: "Safe Harbor" }),
    el("p", { class: "flavor", text: "A quiet node. Recover your team, or retune a card." }),
    el("div", { class: "choices" }, [
      el("button", {
        class: "event-choice",
        onClick: () => { audio.play("heal"); app.resolveRest("heal"); },
      }, [
        el("div", { class: "label", text: `Rest — heal ${Math.round(heroes[0]?.maxHp * 0.3)} HP on each hero` }),
        el("div", { class: "description", text: "Heal each surviving hero for 30% of their max HP." }),
      ]),
      el("button", {
        class: "event-choice",
        onClick: () => app.resolveRest("upgrade"),
      }, [
        el("div", { class: "label", text: "Forge — upgrade a card" }),
        el("div", { class: "description", text: "Select a card to upgrade." }),
      ]),
    ]),
  ]);
  scene.appendChild(card);
  return scene;
}

/**
 * Upgrade picker: shows the squad deck. Clicking an instance upgrades that
 * specific copy — duplicates are independent thanks to instance ids.
 */
export function renderForgeScene(app: GameApp, deck: RunCardInstance[]): HTMLElement {
  const scene = el("div", { class: "scene event-scene" });
  const card = el("div", { class: "panel event-card", style: { maxWidth: "820px" } as Partial<CSSStyleDeclaration> }, [
    el("h2", { text: "Signal Forge" }),
    el("p", { class: "flavor", text: "Select a card to upgrade. Starter cards and already-upgraded cards are excluded." }),
  ]);
  const grid = el("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px", marginTop: "10px" } as Partial<CSSStyleDeclaration> });
  let anyOffered = false;
  for (const runInst of deck) {
    const def = getCardDef(runInst.cardId);
    if (def.rarity === "curse") continue;
    if (runInst.upgraded) continue;
    if (!def.upgradedDescription && !def.upgradedEffects && def.upgradedCost === undefined) continue;
    anyOffered = true;
    const inst = makeCardInstance(runInst.cardId, false);
    const node = renderCard(inst, {
      onClick: () => { audio.play("reward"); app.upgradeCardInstance(runInst.instanceId); },
    });
    grid.appendChild(node);
  }
  if (!anyOffered) {
    grid.appendChild(el("div", { class: "dim", text: "No cards available to upgrade." }));
    card.appendChild(el("button", { class: "primary", text: "Return to Map", onClick: () => app.resolveRest("skip"), style: { marginTop: "10px" } as Partial<CSSStyleDeclaration> }));
  }
  card.appendChild(grid);
  card.appendChild(el("button", { class: "subtle", text: "Cancel", onClick: () => app.resolveRest("skip"), style: { marginTop: "16px" } as Partial<CSSStyleDeclaration> }));
  scene.appendChild(card);
  return scene;
}
