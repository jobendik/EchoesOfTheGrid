import { audio } from "../../engine/AudioManager.js";
import type { EventDefinition, EventOutcome } from "../../game/encounters/EncounterTypes.js";
import { el } from "../UIHelpers.js";
import type { GameApp } from "../GameApp.js";

/** Narrative event choice scene. */
export function renderEventScene(app: GameApp, event: EventDefinition): HTMLElement {
  const scene = el("div", { class: "scene event-scene" });
  const card = el("div", { class: "panel event-card" }, [
    el("h2", { text: event.title }),
    el("p", { class: "flavor", text: event.flavor }),
    el("div", { class: "choices" },
      event.choices.map((choice) =>
        el("button", {
          class: "event-choice",
          onClick: () => { audio.play("cardSelect"); app.resolveEvent(choice.outcomes as EventOutcome[]); },
        }, [
          el("div", { class: "label", text: choice.label }),
          el("div", { class: "description", text: choice.description }),
        ]),
      ),
    ),
  ]);
  scene.appendChild(card);
  return scene;
}
