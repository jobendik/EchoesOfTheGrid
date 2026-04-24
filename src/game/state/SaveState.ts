import { SAVE_KEY, SAVE_VERSION, SETTINGS_KEY } from "../../core/SaveVersion.js";
import { Logger } from "../../core/Logger.js";
import type { RunState, SerializedRun } from "./RunState.js";

/** Game-wide settings separate from a run. */
export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  showTutorial: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
  showTutorial: true,
};

function storageAvailable(): boolean {
  try {
    const t = "__eotg_probe__";
    localStorage.setItem(t, t);
    localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}

export function saveRun(run: RunState): void {
  if (!storageAvailable()) return;
  try {
    const data: SerializedRun = { ...run, version: SAVE_VERSION };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    Logger.warn("saveRun failed", err);
  }
}

export function loadRun(): RunState | null {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SerializedRun>;
    if (!parsed || parsed.version !== SAVE_VERSION) {
      Logger.warn("Stale save version detected — ignoring.");
      return null;
    }
    return sanitizeLoadedRun(parsed as SerializedRun);
  } catch (err) {
    Logger.warn("loadRun failed", err);
    return null;
  }
}

export function clearSave(): void {
  if (!storageAvailable()) return;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function hasSave(): boolean {
  if (!storageAvailable()) return false;
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveSettings(s: GameSettings): void {
  if (!storageAvailable()) return;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function loadSettings(): GameSettings {
  if (!storageAvailable()) return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function sanitizeLoadedRun(r: SerializedRun): RunState {
  // Defensive: ensure all expected fields exist after a bad merge.
  return {
    seed: r.seed ?? "",
    seedNumber: r.seedNumber ?? 0,
    heroes: r.heroes ?? [],
    relics: r.relics ?? [],
    gold: r.gold ?? 0,
    currentNodeId: r.currentNodeId ?? null,
    map: r.map ?? [],
    completedNodeIds: r.completedNodeIds ?? [],
    flags: r.flags ?? {},
    rngState: r.rngState ?? 1,
  };
}
