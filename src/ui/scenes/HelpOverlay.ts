import { audio } from "../../engine/AudioManager.js";
import { el } from "../UIHelpers.js";
import type { GameApp } from "../GameApp.js";

/** Help / controls / keyword reference overlay. */
export function renderHelpOverlay(app: GameApp): HTMLElement {
  const root = el("div", { class: "overlay help-overlay" });
  const card = el("div", { class: "panel card-large" }, [
    el("h2", { text: "How to Play" }),
    el("div", { class: "dim", style: { marginBottom: "10px" } as Partial<CSSStyleDeclaration>, text: "Command three operators through the corrupted Grid." }),
    el("h3", { text: "Combat" }),
    el("ul", {}, [
      el("li", { html: "Click an <strong>active hero's plate</strong> (top-left of the party HUD) or a hero on the grid to select them." }),
      el("li", { html: "Click a <strong>card</strong> in your hand, then a legal target tile, to play it." }),
      el("li", { html: "<strong>Enemy intents</strong> (icons above enemies and in the side panel) show what they'll do next turn, including predicted damage." }),
      el("li", { html: "Hover an enemy to see <em>why</em> it chose that action." }),
      el("li", { html: "<strong>Shield</strong> absorbs damage before HP. It resets at end of turn unless Retained." }),
      el("li", { html: "When the board looks bad, remember: movement cards are free damage mitigation." }),
      el("li", { html: "<strong>Cover</strong> tiles reduce exposure lanes and are highlighted in steel-blue." }),
    ]),
    el("h3", { text: "Keyboard" }),
    el("ul", {}, [
      el("li", { html: "<kbd>1–9</kbd> play card in that hand slot" }),
      el("li", { html: "<kbd>Tab</kbd> cycle active hero · <kbd>Esc</kbd> cancel targeting" }),
      el("li", { html: "<kbd>Enter</kbd> end turn · <kbd>`</kbd> or <kbd>F1</kbd> toggle debug overlay" }),
    ]),
    el("h3", { text: "Run Structure" }),
    el("ul", {}, [
      el("li", { text: "Climb a branching map of combats, events, rest sites, and forges to reach the boss." }),
      el("li", { text: "Each victory offers a card reward and scrap. Elites drop relics." }),
      el("li", { text: "Relics trigger automatically — hover the ◈ icons to see them." }),
    ]),
    el("h3", { text: "Glossary" }),
    el("ul", {}, [
      el("li", { html: "<strong>Intent:</strong> enemy's locked action for its upcoming turn." }),
      el("li", { html: "<strong>Telegraph:</strong> delayed attack pattern shown as warning tiles." }),
      el("li", { html: "<strong>Status effects:</strong> Burn, Poison, Marked, Weak, Vulnerable, Stun, Rooted, Retaliate." }),
      el("li", { html: "<strong>Energy tile:</strong> grants +1 energy at start of your turn when occupied." }),
    ]),
    el("div", { class: "buttons" }, [
      el("button", { class: "primary", text: "Got it", onClick: () => { audio.play("cardSelect"); app.closeOverlay(); } }),
    ]),
  ]);
  root.appendChild(card);
  return root;
}
