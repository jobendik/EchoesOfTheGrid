import { RNG } from "../core/RNG.js";
import { Logger } from "../core/Logger.js";
import { makeId } from "../core/Id.js";
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
import type { MapNode, RunCardInstance, RunState } from "../game/state/RunState.js";
import { clear, el } from "./UIHelpers.js";
import { renderMainMenu } from "./scenes/MainMenuScene.js";
import { renderHelpOverlay } from "./scenes/HelpOverlay.js";
import { renderSettingsOverlay } from "./scenes/SettingsOverlay.js";
import { MapScene } from "./scenes/MapScene.js";
import { CombatScene } from "./scenes/CombatScene.js";
import { renderRewardScene } from "./scenes/RewardScene.js";
import { renderEventScene } from "./scenes/EventScene.js";
import { renderForgeScene, renderRestScene } from "./scenes/RestScene.js";
import { renderShopScene, renderShopRemovalScene, type ShopStock } from "./scenes/ShopScene.js";
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
  /** Current shop stock for the node being visited. Cleared on leaving. */
  private shopStock: ShopStock | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.settings = loadSettings();
    audio.setVolume(this.settings.masterVolume);
    audio.setSfxVolume(this.settings.sfxVolume);
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
    }));
    // Squad-wide starting deck — concatenate every hero's starter list into
    // distinct instances so duplicates can later be upgraded independently.
    const deck: RunCardInstance[] = HEROES.flatMap((hb) =>
      hb.startingDeck.map((cardId) => ({
        instanceId: makeId("rcard"),
        cardId,
        upgraded: false,
      })),
    );
    this.run = {
      seed,
      seedNumber,
      heroes,
      deck,
      relics: [],
      gold: 0,
      currentNodeId: null,
      map,
      completedNodeIds: [],
      flags: {},
      rngState: this.rng.snapshot(),
      stats: {
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
    saveRun(this.run);
    this.showMap();
  }

  continueRun(): void {
    const loaded = loadRun();
    if (!loaded) return;
    this.run = loaded;
    this.rng = new RNG(loaded.rngState);
    // Restore any in-flight reward screen from the save.
    if (loaded.pendingReward) {
      const pr = loaded.pendingReward;
      const cards = pr.cardIds
        .map((id) => CARDS.find((c) => c.id === id))
        .filter((c): c is CardDefinition => !!c);
      const relic = pr.relicId ? RELICS.find((r) => r.id === pr.relicId) : undefined;
      this.pendingReward = { cards, gold: pr.gold, relic };
      this.render(renderRewardScene(this, cards, pr.gold, relic));
      return;
    }
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
      this.render(renderForgeScene(this, this.run.deck));
      return;
    }
    if (node.kind === "event") {
      const ev = this.rng.pick(EVENTS)!;
      this.render(renderEventScene(this, ev));
      return;
    }
    if (node.kind === "shop") {
      this.openShop();
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
        hp: h.hp,
        maxHp: h.maxHp,
      })),
      deck: this.run.deck.map((c) => ({
        instanceId: c.instanceId,
        cardId: c.cardId,
        upgraded: c.upgraded,
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
    const result = controller.getResult();
    // Write back hero HPs to the run state from the combat result snapshot.
    // Iterating CombatResult.heroHp avoids querying the unit graph twice
    // and keeps stat tracking honest about who survived.
    for (const hero of result.heroHp) {
      const runHero = this.run.heroes.find((h) => h.heroClass === hero.heroClass);
      if (runHero) runHero.hp = hero.hp;
    }
    if (this.run.stats) {
      this.run.stats.enemiesDefeated += result.enemiesDefeated;
      this.run.stats.damageDealt += result.damageDealt;
      this.run.stats.damageTaken += result.damageTaken;
      this.run.stats.turnsTaken += result.turnsTaken;
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
    if (this.run.stats) this.run.stats.goldEarned += gold;
    this.pendingReward = { cards, gold, relic };
    // Persist pending reward on the run so it survives a save/exit during
    // the reward screen.
    this.run.pendingReward = {
      cardIds: cards.map((c) => c.id),
      gold,
      relicId: relic?.id,
    };
    saveRun(this.run);
    this.render(renderRewardScene(this, cards, gold, relic));
  }

  onCombatDefeat(): void {
    const run = this.run;
    clearSave();
    this.combatScene = null;
    const overlay = el("div", { class: "overlay" });
    const panel = el("div", { class: "panel card-large" }, [
      el("h2", { text: "Defeat" }),
      el("div", { class: "dim", text: "The Grid overwhelms your squad. Another signal is lost to the dark." }),
    ]);
    if (run) panel.appendChild(this.buildRunSummary(run));
    panel.appendChild(el("div", { class: "buttons" }, [
      el("button", { class: "primary", text: "Main Menu", onClick: () => { this.run = null; this.closeOverlay(); this.backToMenu(); } }),
    ]));
    overlay.appendChild(panel);
    this.showOverlay(overlay);
  }

  private showVictoryScreen(): void {
    const run = this.run;
    const overlay = el("div", { class: "overlay" });
    const panel = el("div", { class: "panel card-large" }, [
      el("h2", { text: "Run Complete" }),
      el("div", { class: "dim", text: "The Cipher collapses. The grid hums with silence. A clean signal, at last." }),
    ]);
    if (run) panel.appendChild(this.buildRunSummary(run));
    panel.appendChild(el("div", { class: "buttons" }, [
      el("button", { class: "primary", text: "Main Menu", onClick: () => { clearSave(); this.run = null; this.closeOverlay(); this.backToMenu(); } }),
    ]));
    overlay.appendChild(panel);
    this.showOverlay(overlay);
  }

  private buildRunSummary(run: RunState): HTMLElement {
    const s = run.stats;
    const nodesCleared = run.completedNodeIds.length;
    const row = (label: string, value: string | number) =>
      el("div", { class: "summary-row" }, [
        el("span", { class: "summary-label dim", text: label }),
        el("span", { class: "summary-value", text: String(value) }),
      ]);
    const rows = [
      row("Seed", run.seed),
      row("Nodes cleared", nodesCleared),
      row("Relics collected", run.relics.length),
      row("Gold on hand", run.gold),
    ];
    if (s) {
      rows.push(
        row("Enemies defeated", s.enemiesDefeated),
        row("Gold earned", s.goldEarned),
        row("Cards added", s.cardsAdded),
        row("Cards upgraded", s.cardsUpgraded),
        row("Cards removed", s.cardsRemoved),
        row("Turns taken", s.turnsTaken),
      );
    }
    return el("div", { class: "run-summary" }, rows);
  }

  // ── Rewards ────────────────────────────────────────────────────────────

  acceptCard(defId: string): void {
    if (!this.run) return;
    this.run.deck.push({ instanceId: makeId("rcard"), cardId: defId, upgraded: false });
    if (this.run.stats) this.run.stats.cardsAdded += 1;
    this.run.rngState = this.rng.snapshot();
    this.pendingReward = null;
    this.run.pendingReward = null;
    saveRun(this.run);
    this.showMap();
  }

  acceptRelic(id: string): void {
    if (!this.run) return;
    const wasNew = !this.run.relics.includes(id);
    if (wasNew) this.run.relics.push(id);
    if (wasNew && this.run.stats) this.run.stats.relicsCollected += 1;
    if (this.pendingReward) this.pendingReward.relic = undefined;
    if (this.run.pendingReward) this.run.pendingReward.relicId = undefined;
    if (this.pendingReward?.cards.length) {
      // Keep the reward scene up without the relic
      saveRun(this.run);
      this.render(renderRewardScene(this, this.pendingReward.cards, this.pendingReward.gold, undefined));
      return;
    }
    this.run.pendingReward = null;
    saveRun(this.run);
    this.showMap();
  }

  skipRewards(): void {
    if (!this.run) return;
    this.pendingReward = null;
    this.run.pendingReward = null;
    saveRun(this.run);
    this.showMap();
  }

  // ── Events & rest ───────────────────────────────────────────────────────

  resolveEvent(outcomes: EventOutcome[]): void {
    if (!this.run) return;
    for (const o of outcomes) this.applyEventOutcome(o);
    this.markCurrentNodeCompleted();
    saveRun(this.run);
    this.showMap();
  }

  private markCurrentNodeCompleted(): void {
    if (!this.run) return;
    const nodeId = this.run.currentNodeId;
    if (!nodeId) return;
    const node = this.run.map.find((n) => n.id === nodeId);
    if (node) node.completed = true;
    if (!this.run.completedNodeIds.includes(nodeId)) this.run.completedNodeIds.push(nodeId);
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
        if (pick) this.run.deck.push({ instanceId: makeId("rcard"), cardId: pick.id, upgraded: false });
        break;
      }
      case "addCurse": {
        const curse = this.rng.pick(CARDS.filter((c) => c.rarity === "curse"));
        if (curse) this.run.deck.push({ instanceId: makeId("rcard"), cardId: curse.id, upgraded: false });
        break;
      }
      case "addRelic": {
        const relic = rollRelicReward(this.rng, this.run.relics, o.rarity as "common" | "uncommon" | "rare");
        if (relic) this.run.relics.push(relic.id);
        break;
      }
      case "removeCard": {
        // Remove the last non-starter card instance.
        for (let i = this.run.deck.length - 1; i >= 0; i--) {
          if (getCardDef(this.run.deck[i].cardId).rarity !== "starter") {
            this.run.deck.splice(i, 1);
            break;
          }
        }
        break;
      }
      case "upgradeCard": {
        // Upgrade the first non-curse, non-already-upgraded instance.
        for (const inst of this.run.deck) {
          if (inst.upgraded) continue;
          const def = getCardDef(inst.cardId);
          if (def.rarity === "curse") continue;
          if (def.upgradedDescription || def.upgradedEffects || def.upgradedCost !== undefined) {
            inst.upgraded = true;
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
      this.markCurrentNodeCompleted();
      saveRun(this.run);
      this.showMap();
    } else if (choice === "upgrade") {
      this.render(renderForgeScene(this, this.run.deck));
    } else {
      this.markCurrentNodeCompleted();
      saveRun(this.run);
      this.showMap();
    }
  }

  /**
   * Upgrade a single card instance in the squad deck. Identified by
   * `instanceId` so picking one Strike to upgrade no longer upgrades every
   * Strike copy.
   */
  upgradeCardInstance(instanceId: string): void {
    if (!this.run) return;
    const inst = this.run.deck.find((c) => c.instanceId === instanceId);
    if (!inst) return;
    const def = getCardDef(inst.cardId);
    if (def.rarity === "curse" || inst.upgraded) return;
    inst.upgraded = true;
    if (this.run.stats) this.run.stats.cardsUpgraded += 1;
    this.markCurrentNodeCompleted();
    saveRun(this.run);
    this.showMap();
  }

  // ── Shop ────────────────────────────────────────────────────────────────

  private openShop(): void {
    if (!this.run) return;
    // Build stock if this is the first visit to this shop node in this session.
    if (!this.shopStock) {
      const node = this.run.map.find((n) => n.id === this.run!.currentNodeId);
      const tier: 1 | 2 | 3 = node?.layer != null && node.layer < 2 ? 1 : node?.layer != null && node.layer < 4 ? 2 : 3;
      const cardDefs = rollCardReward(this.rng, { count: 4, tier });
      const cards = cardDefs.map((def) => ({
        def,
        price: priceForCard(def.rarity, tier, this.rng),
        bought: false,
      }));
      const relicDef = rollRelicReward(this.rng, this.run.relics, tier >= 3 ? "rare" : "uncommon");
      const relic = relicDef
        ? { def: relicDef, price: priceForRelic(relicDef.rarity, this.rng), bought: false }
        : null;
      this.shopStock = {
        cards,
        relic,
        removalPrice: 50 + 10 * (node?.layer ?? 0),
        removalUsed: false,
        healPrice: 30,
        healUsed: false,
      };
    }
    this.render(renderShopScene(this, this.shopStock, this.run.heroes, this.run.deck, this.run.gold));
  }

  private rerenderShop(): void {
    if (!this.run || !this.shopStock) return;
    this.render(renderShopScene(this, this.shopStock, this.run.heroes, this.run.deck, this.run.gold));
  }

  buyShopCard(index: number): void {
    if (!this.run || !this.shopStock) return;
    const entry = this.shopStock.cards[index];
    if (!entry || entry.bought || this.run.gold < entry.price) return;
    this.run.gold -= entry.price;
    entry.bought = true;
    this.run.deck.push({ instanceId: makeId("rcard"), cardId: entry.def.id, upgraded: false });
    if (this.run.stats) this.run.stats.cardsAdded += 1;
    saveRun(this.run);
    this.rerenderShop();
  }

  buyShopRelic(): void {
    if (!this.run || !this.shopStock?.relic) return;
    const r = this.shopStock.relic;
    if (r.bought || this.run.gold < r.price) return;
    this.run.gold -= r.price;
    r.bought = true;
    const wasNew = !this.run.relics.includes(r.def.id);
    if (wasNew) this.run.relics.push(r.def.id);
    if (wasNew && this.run.stats) this.run.stats.relicsCollected += 1;
    saveRun(this.run);
    this.rerenderShop();
  }

  buyShopHeal(): void {
    if (!this.run || !this.shopStock || this.shopStock.healUsed) return;
    if (this.run.gold < this.shopStock.healPrice) return;
    this.run.gold -= this.shopStock.healPrice;
    this.shopStock.healUsed = true;
    for (const h of this.run.heroes) {
      h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * 0.3));
    }
    saveRun(this.run);
    this.rerenderShop();
  }

  openShopRemoval(): void {
    if (!this.run || !this.shopStock || this.shopStock.removalUsed) return;
    if (this.run.gold < this.shopStock.removalPrice) return;
    this.render(renderShopRemovalScene(this, this.run.deck));
  }

  cancelShopRemoval(): void {
    this.rerenderShop();
  }

  confirmShopRemoval(instanceId: string): void {
    if (!this.run || !this.shopStock) return;
    const idx = this.run.deck.findIndex((c) => c.instanceId === instanceId);
    if (idx < 0) return;
    const inst = this.run.deck[idx];
    const def = getCardDef(inst.cardId);
    if (def.rarity === "starter") return;
    this.run.gold -= this.shopStock.removalPrice;
    this.shopStock.removalUsed = true;
    this.run.deck.splice(idx, 1);
    if (this.run.stats) this.run.stats.cardsRemoved += 1;
    saveRun(this.run);
    this.rerenderShop();
  }

  leaveShop(): void {
    if (!this.run) return;
    this.markCurrentNodeCompleted();
    this.shopStock = null;
    this.run.rngState = this.rng.snapshot();
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

function priceForCard(rarity: string, tier: 1 | 2 | 3, rng: RNG): number {
  const base =
    rarity === "rare" ? 90 :
    rarity === "uncommon" ? 55 :
    35;
  const jitter = rng.int(-5, 10);
  const tierBump = (tier - 1) * 10;
  return Math.max(20, base + jitter + tierBump);
}

function priceForRelic(rarity: string, rng: RNG): number {
  const base =
    rarity === "rare" ? 180 :
    rarity === "uncommon" ? 120 :
    80;
  return base + rng.int(-10, 20);
}

// Prevent unused warning on RELICS import; used for typing indirectly.
void RELICS;
