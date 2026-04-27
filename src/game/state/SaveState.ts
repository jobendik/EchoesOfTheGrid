import { SAVE_KEY, SAVE_VERSION, SETTINGS_KEY } from "../../core/SaveVersion.js";
import { Logger } from "../../core/Logger.js";
import { makeId } from "../../core/Id.js";
import type { CardId } from "../../core/Types.js";
import type { HeroRunState, RunCardInstance, RunState, SerializedRun } from "./RunState.js";

/** Game-wide settings separate from a run. */
export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  showTutorial: boolean;
  screenShake: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
  showTutorial: true,
  screenShake: 1,
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
    const parsed = JSON.parse(raw) as Partial<SerializedRun> & { version?: number };
    if (!parsed) return null;
    // Best-effort migration from older shapes. We expand support as the
    // schema evolves; callers that fail mid-migration fall back to null
    // so the player can start a new run rather than crash.
    const migrated = migrateRun(parsed);
    if (!migrated) {
      Logger.warn(`Save version ${parsed.version} unsupported — ignoring.`);
      return null;
    }
    return sanitizeLoadedRun(migrated);
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
    deck: r.deck ?? [],
    relics: r.relics ?? [],
    gold: r.gold ?? 0,
    currentNodeId: r.currentNodeId ?? null,
    map: r.map ?? [],
    completedNodeIds: r.completedNodeIds ?? [],
    flags: r.flags ?? {},
    rngState: r.rngState ?? 1,
    pendingReward: r.pendingReward ?? null,
    stats: r.stats ?? {
      enemiesDefeated: 0,
      damageDealt: 0,
      damageTaken: 0,
      goldEarned: 0,
      cardsAdded: 0,
      cardsRemoved: 0,
      cardsUpgraded: 0,
      relicsCollected: 0,
      turnsTaken: 0,
    },
  };
}

/**
 * Migrate older save payloads into the current schema. Returning `null`
 * signals the save is too old to recover and should be discarded.
 *
 * The pre-v3 format kept `deck: CardId[]` and `upgraded: CardId[]` on each
 * hero. We promote those into a squad-wide `deck: RunCardInstance[]` with
 * fresh instance ids, picking first-occurrence-wins for upgrade flags.
 */
function migrateRun(parsed: Partial<SerializedRun> & { version?: number }): SerializedRun | null {
  if (parsed.version === SAVE_VERSION) return parsed as SerializedRun;
  if (parsed.version === 2) {
    type LegacyHero = HeroRunState & { deck?: CardId[]; upgraded?: CardId[] };
    const legacyHeroes = (parsed.heroes ?? []) as LegacyHero[];
    const deck: RunCardInstance[] = [];
    const cleanHeroes: HeroRunState[] = [];
    for (const h of legacyHeroes) {
      const upgradedQueue = (h.upgraded ?? []).slice();
      for (const id of h.deck ?? []) {
        const upIdx = upgradedQueue.indexOf(id);
        const upgraded = upIdx >= 0;
        if (upIdx >= 0) upgradedQueue.splice(upIdx, 1);
        deck.push({ instanceId: makeId("rcard"), cardId: id, upgraded });
      }
      cleanHeroes.push({ heroClass: h.heroClass, maxHp: h.maxHp, hp: h.hp });
    }
    return {
      ...(parsed as SerializedRun),
      heroes: cleanHeroes,
      deck,
      version: SAVE_VERSION,
    };
  }
  return null;
}
