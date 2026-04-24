import { audio } from "../../engine/AudioManager.js";
import type { GameSettings } from "../../game/state/SaveState.js";
import { el } from "../UIHelpers.js";
import type { GameApp } from "../GameApp.js";

export function renderSettingsOverlay(app: GameApp, settings: GameSettings): HTMLElement {
  const root = el("div", { class: "overlay settings-overlay" });
  const card = el("div", { class: "panel card-large" });
  card.appendChild(el("h2", { text: "Settings" }));

  const makeSlider = (label: string, value: number, onChange: (v: number) => void) => {
    const slider = el("input", { type: "range", min: "0", max: "100", value: String(Math.round(value * 100)) }) as HTMLInputElement;
    slider.addEventListener("input", () => onChange(Number(slider.value) / 100));
    return el("div", { class: "row" }, [
      el("label", { text: label, style: { flex: "1" } as Partial<CSSStyleDeclaration> }),
      slider,
    ]);
  };

  card.appendChild(makeSlider("Master Volume", settings.masterVolume, (v) => {
    settings.masterVolume = v;
    audio.setVolume(v);
    app.saveSettings(settings);
  }));
  card.appendChild(makeSlider("SFX Volume", settings.sfxVolume, (v) => {
    settings.sfxVolume = v;
    audio.setSfxVolume(v);
    app.saveSettings(settings);
  }));

  const muteCb = el("input", { type: "checkbox" }) as HTMLInputElement;
  muteCb.checked = settings.muted;
  muteCb.addEventListener("change", () => {
    settings.muted = muteCb.checked;
    audio.setMuted(muteCb.checked);
    app.saveSettings(settings);
  });
  card.appendChild(el("div", { class: "row" }, [
    el("label", { text: "Mute audio" }),
    muteCb,
  ]));

  card.appendChild(el("div", { class: "buttons", style: { marginTop: "12px" } as Partial<CSSStyleDeclaration> }, [
    el("button", { text: "Clear Saved Run", class: "danger", onClick: () => app.clearSavedRun() }),
    el("button", { class: "primary", text: "Close", onClick: () => app.closeOverlay() }),
  ]));
  root.appendChild(card);
  return root;
}
