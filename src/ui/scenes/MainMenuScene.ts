import { HEROES } from "../../data/heroes.js";
import { hasSave } from "../../game/state/SaveState.js";
import { audio } from "../../engine/AudioManager.js";
import { el } from "../UIHelpers.js";
import type { GameApp } from "../GameApp.js";

/** Main menu: New Run / Continue / Help / Settings. */
export function renderMainMenu(app: GameApp, seedLabel: string): HTMLElement {
  const scene = el("div", { class: "scene menu" });
  scene.appendChild(el("div", { class: "subtitle", text: "tactical roguelike deckbuilder" }));
  scene.appendChild(el("div", { class: "title", text: "Echoes of the Grid" }));
  scene.appendChild(el("div", {
    class: "dim",
    style: { marginTop: "4px", maxWidth: "560px", lineHeight: "1.55" } as Partial<CSSStyleDeclaration>,
    text: "Command a squad of three operators through a corrupted grid. Build a deck. Outthink the intents. Break the Cipher.",
  }));

  scene.appendChild(heroPreview());

  const buttons = el("div", { class: "buttons" });
  const canContinue = hasSave();
  buttons.appendChild(el("button", {
    class: "primary",
    text: "New Run",
    onClick: () => { audio.play("cardSelect"); app.startNewRun(); },
  }));
  const continueBtn = el("button", {
    text: canContinue ? "Continue" : "No Saved Run",
    onClick: () => { audio.play("cardSelect"); app.continueRun(); },
  }) as HTMLButtonElement;
  if (!canContinue) continueBtn.disabled = true;
  buttons.appendChild(continueBtn);
  buttons.appendChild(el("button", {
    text: "How to Play",
    onClick: () => { audio.play("cardHover"); app.showHelp(); },
  }));
  buttons.appendChild(el("button", {
    text: "Settings",
    onClick: () => { audio.play("cardHover"); app.showSettings(); },
  }));
  scene.appendChild(buttons);

  scene.appendChild(el("div", { class: "seed", text: `seed: ${seedLabel}` }));
  scene.appendChild(el("div", { class: "version", text: "v0.1.0 · portfolio prototype" }));
  return scene;
}

function heroPreview(): HTMLElement {
  const row = el("div", { class: "hero-preview" });
  for (const h of HEROES) {
    const card = el("div", { class: "hero-card" }, [
      el("div", { class: "role", text: h.role.split("—")[0].trim() }),
      el("h3", { text: h.name }),
      el("p", { text: h.shortDescription }),
      el("div", {
        class: "dim",
        style: { fontSize: "12px", marginTop: "6px" } as Partial<CSSStyleDeclaration>,
        text: `HP: ${h.maxHp} · deck: ${h.startingDeck.length}`,
      }),
    ]);
    row.appendChild(card);
  }
  return row;
}
