import { RNG } from "../core/RNG.js";
import { Logger } from "../core/Logger.js";
import { Balance } from "../data/balance.js";
import { ENCOUNTER_MAP } from "../data/encounters.js";
import { EVENTS } from "../data/events.js";
import { HEROES } from "../data/heroes.js";
import { RELICS } from "../data/relics.js";
import { audio } from "../engine/AudioManager.js";
import type { CombatSetup } from "../game/combat/CombatController.js";
import { CombatController } from "../game/combat/CombatController.js";
import { generateMap } from "../game/encounters/MapGenerator.js";
import type { EventOutcome } from "../game/encounters/EncounterTypes.js";
import { rollCardReward, rollRelicReward } from "../game/progression/RewardSystem.js";
import { CARDS, getCardDef } from "../data/cards.js";
import { clearSave, loadRun, loadSettings, saveRun, saveSettings, type GameSettings } from "../game/state/SaveState.js";
import type { MapNode, RunState } from "../game/state/RunState.js";
import { clear, el } from "./UIHelpers.js";
import { renderMainMenu } from "./scenes/MainMenuScene.js";
import { renderHelpOverlay } from "./scenes/HelpOverlay.js";
import { renderSettingsOverlay } from "./scenes/SettingsOverlay.js";
import { MapScene } from "./scenes/MapScene.js";
import { CombatScene } from "./scenes/CombatScene.js";
import { renderRewardScene } from "./scenes/RewardScene.js";
import { renderEventScene } from "./scenes/EventScene.js";
import { renderForgeScene, renderRestScene } from "./scenes/RestScene.js";
import type { CardDefinition } from "../game/cards/CardTypes.js";
import type { RelicDefinition } from "../game/relics/RelicTypes.js";

/**
 * Top-level controller. Owns the run state, settings, and current scene.
 * All scene transitions are funneled through `render()` so this is the one
 * place to trace the game flow.
 */
export class GameApp {
  private root: HTMLElement;
  private overlayRoot: HTMLElement | null = null;
  private run: RunState | null = null;
  private settings: GameSettings;
  private rng: RNG;
  private currentScene: { root: HTMLElement; dispose?: () => void } | null = null;
  private combatScene: CombatScene | null = null;
  private pendingReward: { cards: CardDefinition[]; gold: number; relic?: RelicDefinition } | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.settings = loadSettings();
    audio.setVolume(this.settings.masterVolume);
    audio.setMuted(this.settings.muted);
    this.rng = new RNG(Date.now());
    this.render(renderMainMenu(this, this.randomSeedLabel()));
  }

  // ── Scene mgmt ─────────────────────────────────────────────────────────

  private render(node: HTMLElement, dispose?: () => void): void {
    if (this.currentScene && this.currentScene.dispose) this.currentScene.dispose();
    clear(this.root);
    this.root.appendChild(node);
    this.currentScene = { root: node, dispose };
  }

  private showOverlay(node: HTMLElement): void {
    this.closeOverlay();
    this.overlayRoot = node;
    this.root.appendChild(node);
  }

  closeOverlay(): void {
    if (this.overlayRoot && this.overlayRoot.parentElement) {
      this.overlayRoot.parentElement.removeChild(this.overlayRoot);
    }
    this.overlayRoot = null;
  }

  private randomSeedLabel(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  runSeedLabel(): string {
    return this.run?.seed ?? "—";
  }

  // ── Run lifecycle ───────────────────────────────────────────────────────

  startNewRun(): void {
    const seed = this.randomSeedLabel();
    const seedNumber = hashSeed(seed);
    this.rng = new RNG(seedNumber);
    const map = generateMap(this.rng);

    const heroes = HEROES.map((hb) => ({
      heroClass: hb.heroClass,
      maxHp: hb.maxHp,
      hp: hb.maxHp,
      deck: hb.startingDeck.slice(),
      upgraded: [] as string[],
    }));
    this.run = {
      seed,
      seedNumber,
      heroes,
      relics: [],
      gold: 0,
      currentNodeId: null,
      map,
      completedNodeIds: [],
      flags: {},
      rngState: this.rng.snapshot(),
    };
    saveRun(this.run);
    this.showMap();
  }

  continueRun(): void {
    const loaded = loadRun();
    if (!loaded) return;
    this.run = loaded;
    this.rng = new RNG(loaded.rngState);
    this.showMap();
  }

  saveAndExit(): void {
    if (this.run) {
      this.run.rngState = this.rng.snapshot();
      saveRun(this.run);
    }
    this.backToMenu();
  }

  abandonRun(): void {
    if (!confirm("Abandon this run? Progress will be lost.")) return;
    clearSave();
    this.run = null;
    this.backToMenu();
  }

  clearSavedRun(): void {
    clearSave();
    this.run = null;
    this.closeOverlay();
    this.backToMenu();
  }

  backToMenu(): void {
    this.combatScene = null;
    this.render(renderMainMenu(this, this.randomSeedLabel()));
  }

  // ── Map & node entry ────────────────────────────────────────────────────

  showMap(): void {
    if (!this.run) return this.backToMenu();
    const scene = new MapScene(this, this.run);
    this.render(scene.root, () => scene.dispose());
  }

  enterNode(node: MapNode): void {
    if (!this.run) return;
    this.run.currentNodeId = node.id;
    this.run.rngState = this.rng.snapshot();
    saveRun(this.run);
    if (node.kind === "rest") {
      this.render(renderRestScene(this, this.run.heroes));
      return;
    }
    if (node.kind === "upgrade") {
      this.render(renderForgeScene(this, this.run.heroes));
      return;
    }
    if (node.kind === "event") {
      const ev = this.rng.pick(EVENTS)!;
      this.render(renderEventScene(this, ev));
      return;
    }
    // Combat / elite / boss
    this.startCombatForNode(node);
  }

  private startCombatForNode(node: MapNode): void {
    if (!this.run) return;
    const encounter = ENCOUNTER_MAP.get(node.encounterId);
    if (!encounter) {
      Logger.warn(`Unknown encounter ${node.encounterId}, returning to map`);
      this.showMap();
      return;
    }
    const setup: CombatSetup = {
      encounterId: encounter.id,
      heroes: this.run.heroes.map((h) => ({
        heroClass: h.heroClass,
        startingDeck: h.deck,
        upgraded: h.upgraded,
      })),
      relics: this.run.relics.slice(),
      seed: this.run.seedNumber + node.layer * 100 + node.column,
    };
    const controller = new CombatController(setup, new RNG(setup.seed));
    this.combatScene = new CombatScene(this, controller);
    this.render(this.combatScene.root, () => this.combatScene?.dispose());
  }

  returnToMapAbandon(): void {
    if (!confirm("Abandon this combat? (you'll return to the map; HP/changes will not be committed)")) return;
    this.combatScene = null;
    this.showMap();
  }

  onCombatVictory(): void {
    if (!this.run || !this.combatScene) return;
    const controller = this.combatScene.controller;
    // Write back hero HPs to the run state
    for (const hero of controller.heroes()) {
      const runHero = this.run.heroes.find((h) => h.heroClass === hero.heroClass);
      if (runHero) runHero.hp = hero.hp;
    }
    // Mark node completed
    const nodeId = this.run.currentNodeId;
    if (nodeId) {
      const node = this.run.map.find((n) => n.id === nodeId);
      if (node) node.completed = true;
      if (!this.run.completedNodeIds.includes(nodeId)) this.run.completedNodeIds.push(nodeId);
    }
    // Victory on the boss node ends the run.
    const node = this.run.map.find((n) => n.id === this.run!.currentNodeId);
    if (node?.kind === "boss") {
      this.showVictoryScreen();
      return;
    }
    // Otherwise, roll rewards.
    const tier: 1 | 2 | 3 = node?.layer != null && node.layer < 2 ? 1 : node?.layer != null && node.layer < 4 ? 2 : 3;
    const cards = rollCardReward(this.rng, { count: 3, tier });
    const gold = this.rng.int(12, 22) + (node?.kind === "elite" ? 15 : 0);
    let relic: RelicDefinition | undefined;
    if (node?.kind === "elite") {
      relic = rollRelicReward(this.rng, this.run.relics, "uncommon");
    } else if (this.rng.next() < 0.18) {
      relic = rollRelicReward(this.rng, this.run.relics, "common");
    }
    this.run.gold += gold;
    this.pendingReward = { cards, gold, relic };
    saveRun(this.run);
    this.render(renderRewardScene(this, cards, gold, relic));
  }

  onCombatDefeat(): void {
    clearSave();
    this.run = null;
    this.combatScene = null;
    const overlay = el("div", { class: "overlay" });
    overlay.appendChild(el("div", { class: "panel card-large" }, [
      el("h2", { text: "Defeat" }),
      el("div", { class: "dim", text: "The Grid overwhelms your squad. Another signal is lost to the dark." }),
      el("div", { class: "buttons" }, [
        el("button", { class: "primary", text: "Main Menu", onClick: () => { this.closeOverlay(); this.backToMenu(); } }),
      ]),
    ]));
    this.showOverlay(overlay);
  }

  private showVictoryScreen(): void {
    const overlay = el("div", { class: "overlay" });
    overlay.appendChild(el("div", { class: "panel card-large" }, [
      el("h2", { text: "Run Complete" }),
      el("div", { class: "dim", text: "The Cipher collapses. The grid hums with silence. A clean signal, at last." }),
      el("div", { class: "buttons" }, [
        el("button", { class: "primary", text: "Main Menu", onClick: () => { clearSave(); this.run = null; this.closeOverlay(); this.backToMenu(); } }),
      ]),
    ]));
    this.showOverlay(overlay);
  }

  // ── Rewards ────────────────────────────────────────────────────────────

  acceptCard(defId: string): void {
    if (!this.run) return;
    this.run.heroes[0].deck.push(defId);
    this.run.rngState = this.rng.snapshot();
    saveRun(this.run);
    this.pendingReward = null;
    this.showMap();
  }

  acceptRelic(id: string): void {
    if (!this.run) return;
    if (!this.run.relics.includes(id)) this.run.relics.push(id);
    if (this.pendingReward) this.pendingReward.relic = undefined;
    if (this.pendingReward?.cards.length) {
      // Keep the reward scene up without the relic
      this.render(renderRewardScene(this, this.pendingReward.cards, this.pendingReward.gold, undefined));
      return;
    }
    saveRun(this.run);
    this.showMap();
  }

  skipRewards(): void {
    if (!this.run) return;
    saveRun(this.run);
    this.pendingReward = null;
    this.showMap();
  }

  // ── Events & rest ───────────────────────────────────────────────────────

  resolveEvent(outcomes: EventOutcome[]): void {
    if (!this.run) return;
    for (const o of outcomes) this.applyEventOutcome(o);
    saveRun(this.run);
    this.showMap();
  }

  private applyEventOutcome(o: EventOutcome): void {
    if (!this.run) return;
    switch (o.kind) {
      case "loseHp":
        for (const h of this.run.heroes) h.hp = Math.max(1, h.hp - o.amount);
        break;
      case "heal":
        for (const h of this.run.heroes) h.hp = Math.min(h.maxHp, h.hp + o.amount);
        break;
      case "addGold":
        this.run.gold += o.amount;
        break;
      case "addRandomCard": {
        const pool = CARDS.filter((c) => c.rarity === o.rarity);
        const pick = this.rng.pick(pool);
        if (pick) this.run.heroes[0].deck.push(pick.id);
        break;
      }
      case "addCurse": {
        // Add the curse to the first hero's deck.
        const curse = this.rng.pick(CARDS.filter((c) => c.rarity === "curse"));
        if (curse) this.run.heroes[0].deck.push(curse.id);
        break;
      }
      case "addRelic": {
        const relic = rollRelicReward(this.rng, this.run.relics, o.rarity as "common" | "uncommon" | "rare");
        if (relic) this.run.relics.push(relic.id);
        break;
      }
      case "removeCard": {
        // Remove the last non-starter card from hero 0
        const h = this.run.heroes[0];
        for (let i = h.deck.length - 1; i >= 0; i--) {
          if (getCardDef(h.deck[i]).rarity !== "starter") {
            h.deck.splice(i, 1);
            break;
          }
        }
        break;
      }
      case "upgradeCard": {
        const h = this.run.heroes[0];
        for (let i = 0; i < h.deck.length; i++) {
          const defId = h.deck[i];
          const def = getCardDef(defId);
          if (def.rarity === "curse") continue;
          const countUpgraded = h.upgraded.filter((x) => x === defId).length;
          const countTotal = h.deck.filter((x) => x === defId).length;
          if (countUpgraded < countTotal && (def.upgradedDescription || def.upgradedEffects || def.upgradedCost !== undefined)) {
            h.upgraded.push(defId);
            break;
          }
        }
        break;
      }
      case "nothing":
      default:
        break;
    }
  }

  resolveRest(choice: "heal" | "upgrade" | "skip"): void {
    if (!this.run) return;
    if (choice === "heal") {
      for (const h of this.run.heroes) h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * Balance.combat.restHealFraction));
      saveRun(this.run);
      this.showMap();
    } else if (choice === "upgrade") {
      this.render(renderForgeScene(this, this.run.heroes));
    } else {
      saveRun(this.run);
      this.showMap();
    }
  }

  upgradeCardInDeck(heroIndex: number, cardIndex: number): void {
    if (!this.run) return;
    const hero = this.run.heroes[heroIndex];
    const defId = hero.deck[cardIndex];
    if (!defId) return;
    const def = getCardDef(defId);
    if (def.rarity === "curse") return;
    hero.upgraded.push(defId);
    saveRun(this.run);
    this.showMap();
  }

  // ── Settings / Help ─────────────────────────────────────────────────────

  showHelp(): void {
    this.showOverlay(renderHelpOverlay(this));
  }

  showSettings(): void {
    this.showOverlay(renderSettingsOverlay(this, this.settings));
  }

  saveSettings(s: GameSettings): void {
    this.settings = s;
    saveSettings(s);
  }
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Prevent unused warning on RELICS import; used for typing indirectly.
void RELICS;
