import { audio } from "../../engine/AudioManager.js";
import { getCardDef } from "../../data/cards.js";
import { RELIC_MAP } from "../../data/relics.js";
import type { CardInstance } from "../../game/cards/CardTypes.js";
import type { CombatController } from "../../game/combat/CombatController.js";
import { computeAffectedTiles, isValidTarget, unitAt } from "../../game/combat/TargetingSystem.js";
import type { GridPos, UnitId } from "../../core/Types.js";
import type { Unit } from "../../game/units/UnitTypes.js";
import { GridRenderer, type RenderOverlay } from "../../render/GridRenderer.js";
import { cardTooltip, renderCard, formatKeywords } from "../CardView.js";
import { attachTooltip, clear, el } from "../UIHelpers.js";
import type { GameApp } from "../GameApp.js";

/**
 * Combat scene. Manages targeting UX, end-turn flow, and rendering for a
 * single combat. Relies on the CombatController for simulation — no game
 * rules live in this file.
 */
export class CombatScene {
  readonly root: HTMLElement;
  readonly controller: CombatController;
  private canvas!: HTMLCanvasElement;
  private renderer!: GridRenderer;
  private enemyListEl!: HTMLElement;
  private partyHudEl!: HTMLElement;
  private handEl!: HTMLElement;
  private logEl!: HTMLElement;
  private turnIndicatorEl!: HTMLElement;
  private energyEl!: HTMLElement;
  private endTurnBtn!: HTMLButtonElement;
  private debugEl!: HTMLElement;

  private selectedCard: CardInstance | null = null;
  private selectedHeroId: UnitId | null = null;
  private overlay: RenderOverlay = {
    hoverTile: null,
    selectedTiles: [],
    validTiles: [],
    hoverIntent: null,
    showIntents: true,
    activeHeroId: null,
    cameraShake: 0,
    floaters: [],
  };
  private animTick: number | null = null;

  constructor(readonly app: GameApp, controller: CombatController) {
    this.controller = controller;
    this.root = el("div", { class: "scene combat-scene" });
    this.build();
    this.selectedHeroId = this.controller.heroes()[0]?.id ?? null;
    this.overlay.activeHeroId = this.selectedHeroId;
    this.startRenderLoop();
    this.controller.events.on("damageDealt", (p) => this.pushFloater(p.defenderId, `-${p.amount}`, "damage"));
    this.controller.events.on("combatEnded", (p) => this.handleCombatEnd(p.victory));
    this.controller.events.on("stateChanged", () => this.rebuildSidebar());
    this.controller.events.on("turnStart", (p) => {
      audio.play("turnStart");
      if (p.side === "player") this.overlay.cameraShake = 0;
    });
  }

  dispose(): void {
    if (this.animTick !== null) cancelAnimationFrame(this.animTick);
    document.removeEventListener("keydown", this.onKeyDown);
  }

  private build(): void {
    const state = this.controller.state;

    // Top bar
    this.turnIndicatorEl = el("div", { class: "turn-indicator", text: `Turn ${state.turn}` });
    this.energyEl = el("div", { class: "stat" }, [
      el("span", { style: { color: "var(--c-energy)", fontSize: "20px", fontWeight: "700" } as Partial<CSSStyleDeclaration>, text: "◆" }),
      el("span", { style: { fontFamily: "var(--font-mono)", fontWeight: "600", fontSize: "16px" } as Partial<CSSStyleDeclaration>, id: "energy-value", text: "0/0" }),
      el("span", { class: "dim", text: "energy" }),
    ]);
    this.endTurnBtn = el("button", {
      class: "primary",
      text: "End Turn ⏎",
      onClick: () => this.endTurn(),
    }) as HTMLButtonElement;
    const backBtn = el("button", { class: "subtle", text: "↩ Map", onClick: () => this.app.returnToMapAbandon() });

    this.root.appendChild(el("div", { class: "combat-top panel", style: { padding: "10px 14px" } as Partial<CSSStyleDeclaration> }, [
      el("div", { class: "stat" }, [this.turnIndicatorEl]),
      this.energyEl,
      el("div", { class: "actions" }, [backBtn, this.endTurnBtn]),
    ]));

    // Main area: battlefield + side
    const main = el("div", { class: "combat-main" });
    const bf = el("div", { class: "battlefield" });
    this.canvas = el("canvas", {}) as HTMLCanvasElement;
    bf.appendChild(this.canvas);
    this.canvas.addEventListener("mousemove", (ev) => this.onCanvasMouseMove(ev));
    this.canvas.addEventListener("mouseleave", () => (this.overlay.hoverTile = null));
    this.canvas.addEventListener("click", (ev) => this.onCanvasClick(ev));
    this.renderer = new GridRenderer(this.canvas);

    const side = el("div", { class: "side-panel" });
    this.enemyListEl = el("div", { class: "enemy-list" });
    this.logEl = el("div", { class: "combat-log" });
    side.appendChild(this.enemyListEl);
    side.appendChild(el("div", { class: "panel", style: { padding: "8px 12px" } as Partial<CSSStyleDeclaration> }, [
      renderRelics(this.controller),
    ]));
    side.appendChild(this.logEl);

    main.appendChild(bf);
    main.appendChild(side);
    this.root.appendChild(main);

    // Party HUD
    this.partyHudEl = el("div", { class: "party-hud" });
    this.root.appendChild(this.partyHudEl);

    // Hand
    this.handEl = el("div", { class: "hand-bar" });
    this.root.appendChild(this.handEl);

    // Debug overlay
    this.debugEl = el("div", { class: "debug-overlay", style: { display: "none" } as Partial<CSSStyleDeclaration> });
    this.root.appendChild(this.debugEl);

    // Kb shortcuts
    document.addEventListener("keydown", this.onKeyDown);

    this.rebuildSidebar();
  }

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (this.controller.state.phase !== "player_turn") return;
    if (ev.key === "Enter") this.endTurn();
    else if (ev.key === "Escape") {
      this.selectedCard = null;
      this.rebuildSidebar();
    } else if (ev.key === "`" || ev.key === "F1") {
      this.controller.state.debug.overlay = !this.controller.state.debug.overlay;
      this.debugEl.style.display = this.controller.state.debug.overlay ? "block" : "none";
    } else if (/^[1-9]$/.test(ev.key)) {
      const idx = parseInt(ev.key, 10) - 1;
      const card = this.controller.state.hand[idx];
      if (card) this.onCardClick(card);
    } else if (ev.key === "Tab") {
      ev.preventDefault();
      const heroes = this.controller.heroes();
      const i = heroes.findIndex((h) => h.id === this.selectedHeroId);
      const next = heroes[(i + 1) % heroes.length];
      this.selectedHeroId = next?.id ?? null;
      this.overlay.activeHeroId = this.selectedHeroId;
      this.rebuildSidebar();
    }
  };

  private startRenderLoop(): void {
    const loop = (): void => {
      this.renderer.resize(this.controller.state);
      if (this.overlay.cameraShake > 0) this.overlay.cameraShake = Math.max(0, this.overlay.cameraShake - 0.4);
      this.renderer.draw(this.controller.state, this.overlay);
      this.renderLog();
      this.renderDebug();
      this.animTick = requestAnimationFrame(loop);
    };
    this.animTick = requestAnimationFrame(loop);
  }

  private rebuildSidebar(): void {
    this.rebuildEnemyList();
    this.rebuildPartyHud();
    this.rebuildHand();
    this.turnIndicatorEl.textContent = `Turn ${this.controller.state.turn} · ${this.controller.state.phase === "player_turn" ? "Your Turn" : this.controller.state.phase}`;
    const energySpan = this.energyEl.querySelector("#energy-value") as HTMLElement | null;
    if (energySpan) energySpan.textContent = `${this.controller.state.player.energy}/${this.controller.state.player.maxEnergy}`;
  }

  private rebuildEnemyList(): void {
    clear(this.enemyListEl);
    this.enemyListEl.appendChild(el("h3", { style: { fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-fg-dim)", margin: "0 0 4px 0" } as Partial<CSSStyleDeclaration>, text: "Enemies" }));
    for (const enemy of this.controller.enemies()) {
      this.enemyListEl.appendChild(this.renderEnemyRow(enemy));
    }
  }

  private renderEnemyRow(enemy: Unit): HTMLElement {
    const intent = this.controller.getIntent(enemy.id);
    const hpPct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
    const row = el("div", {
      class: "enemy-row",
      onMouseEnter: () => {
        this.overlay.hoverIntent = intent ?? null;
      },
      onMouseLeave: () => {
        this.overlay.hoverIntent = null;
      },
    }, [
      el("div", { class: "portrait", text: intentIcon(enemy) }),
      el("div", {}, [
        el("div", { class: "name", text: enemy.name }),
        el("div", { class: "hpbar-mini" }, [el("div", { style: { width: `${hpPct}%` } as Partial<CSSStyleDeclaration> })]),
        el("div", { class: "dim", style: { fontSize: "11px", marginTop: "2px" } as Partial<CSSStyleDeclaration>, text: `${enemy.hp}/${enemy.maxHp} HP` }),
      ]),
      el("div", { class: "intent" }, [
        el("div", { class: "icon", text: intent?.icon ?? "·" }),
        intent?.predictedDamage !== undefined
          ? el("div", { class: "predicted", text: String(intent.predictedDamage) })
          : el("div", { class: "dim", style: { fontSize: "11px" } as Partial<CSSStyleDeclaration>, text: intent?.kind ?? "" }),
      ]),
    ]);
    attachTooltip(row, () => {
      const def = intent?.reason ?? "Awaiting orders.";
      const statuses = Object.entries(enemy.statuses)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ");
      return `
        <div class="name">${enemy.name}</div>
        <div class="dim">${enemy.enemyKind}</div>
        <div style="margin-top:6px;">${def}</div>
        ${statuses ? `<div class="keyword" style="margin-top:4px;">Statuses: ${statuses}</div>` : ""}
      `;
    });
    return row;
  }

  private rebuildPartyHud(): void {
    clear(this.partyHudEl);
    for (const hero of this.controller.heroes()) {
      const hpPct = Math.max(0, (hero.hp / hero.maxHp) * 100);
      const active = hero.id === this.selectedHeroId;
      const plate = el("div", {
        class: `hero-plate ${active ? "active" : ""}`,
        onClick: () => {
          this.selectedHeroId = hero.id;
          this.overlay.activeHeroId = hero.id;
          audio.play("cardHover");
          this.rebuildSidebar();
        },
      }, [
        el("div", { class: "name-row" }, [
          el("div", { class: "name", text: hero.name }),
          el("div", { class: "hp-text", text: `${hero.hp}/${hero.maxHp}` }),
        ]),
        el("div", { class: "hpbar" }, [
          el("div", { class: "fill", style: { width: `${hpPct}%` } as Partial<CSSStyleDeclaration> }),
        ]),
        el("div", { class: "status-pills" }, renderStatusPills(hero)),
      ]);
      this.partyHudEl.appendChild(plate);
    }
  }

  private rebuildHand(): void {
    clear(this.handEl);
    for (const [idx, card] of this.controller.state.hand.entries()) {
      const cost = this.controller.effectiveCost(card);
      const caster = this.activeHero();
      const disabled =
        !caster ||
        this.controller.state.phase !== "player_turn" ||
        this.controller.state.player.energy < cost ||
        getCardDef(card.defId).unplayable === true;
      const node = renderCard(card, {
        selected: this.selectedCard === card,
        disabled,
        cost,
        onClick: () => this.onCardClick(card),
      });
      attachTooltip(node, () => cardTooltip(card));
      // Key hint
      node.appendChild(el("div", {
        style: { position: "absolute", bottom: "-10px", left: "50%", transform: "translateX(-50%)", background: "var(--c-bg-2)", border: "1px solid var(--c-border)", borderRadius: "4px", padding: "0 4px", fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--c-fg-muted)" } as Partial<CSSStyleDeclaration>,
        text: `${idx + 1}`,
      }));
      this.handEl.appendChild(node);
    }
    // Piles info
    const info = el("div", {
      style: { position: "absolute", right: "30px", bottom: "20px", display: "flex", gap: "14px", color: "var(--c-fg-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" } as Partial<CSSStyleDeclaration>,
      text: `draw ${this.controller.state.drawPile.length} · discard ${this.controller.state.discardPile.length} · exhaust ${this.controller.state.exhaustPile.length}`,
    });
    this.handEl.appendChild(info);
  }

  private renderLog(): void {
    // Only the last 40 entries for performance.
    const entries = this.controller.state.log.slice(-40);
    const existingCount = this.logEl.childElementCount;
    if (existingCount === entries.length) return;
    clear(this.logEl);
    for (const entry of entries) {
      this.logEl.appendChild(el("div", { class: `log-entry ${entry.kind}`, html: formatKeywords(entry.text) }));
    }
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  private renderDebug(): void {
    if (!this.controller.state.debug.overlay) return;
    const s = this.controller.state;
    const intentLines: string[] = [];
    for (const intent of s.intents.values()) {
      const e = s.units.get(intent.enemyId);
      intentLines.push(`${e?.name ?? "?"}: ${intent.kind}${intent.predictedDamage !== undefined ? ` (${intent.predictedDamage})` : ""} — ${intent.reason}`);
    }
    this.debugEl.innerHTML = `
      <h4>Debug</h4>
      <div class="dbg-row"><span>Turn</span><span>${s.turn} (${s.phase})</span></div>
      <div class="dbg-row"><span>Energy</span><span>${s.player.energy}/${s.player.maxEnergy}</span></div>
      <div class="dbg-row"><span>Hand</span><span>${s.hand.length}</span></div>
      <div class="dbg-row"><span>Draw/Discard</span><span>${s.drawPile.length}/${s.discardPile.length}</span></div>
      <div class="dbg-row"><span>Relics</span><span>${s.player.relics.length}</span></div>
      <div class="dbg-row"><span>Attacks this turn</span><span>${s.player.attacksThisTurn}</span></div>
      <div class="dbg-row"><span>Seed</span><span>${this.app.runSeedLabel()}</span></div>
      <div style="margin-top:8px;"><strong>Intents</strong></div>
      ${intentLines.map((l) => `<div style="margin-top:2px;">${l}</div>`).join("")}
    `;
  }

  // ── Interactions ────────────────────────────────────────────────────────

  private activeHero(): Unit | undefined {
    if (!this.selectedHeroId) return this.controller.heroes()[0];
    return this.controller.state.units.get(this.selectedHeroId) ?? this.controller.heroes()[0];
  }

  private onCardClick(card: CardInstance): void {
    if (this.controller.state.phase !== "player_turn") return;
    const def = getCardDef(card.defId);
    if (def.unplayable) { audio.play("invalid"); return; }
    if (this.selectedCard === card) {
      // If card has no target, play immediately.
      if (def.targeting.kind === "self" || def.targeting.kind === "none" || def.targeting.kind === "allEnemies" || def.targeting.kind === "allAllies") {
        this.tryPlay(card, null);
        return;
      }
      this.selectedCard = null;
    } else {
      this.selectedCard = card;
      audio.play("cardSelect");
    }
    this.recomputeValidTiles();
    this.rebuildSidebar();
  }

  private recomputeValidTiles(): void {
    this.overlay.validTiles = [];
    this.overlay.selectedTiles = [];
    const card = this.selectedCard;
    if (!card) return;
    const def = getCardDef(card.defId);
    const caster = this.activeHero();
    if (!caster) return;
    for (const tile of this.controller.state.grid.all()) {
      if (isValidTarget(this.controller.state, caster, def, tile)) {
        this.overlay.validTiles.push(tile);
      }
    }
  }

  private onCanvasMouseMove(ev: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const p = this.renderer.pickTile(ev.clientX - rect.left, ev.clientY - rect.top, this.controller.state);
    this.overlay.hoverTile = p;
    this.overlay.selectedTiles = [];
    if (this.selectedCard && p) {
      const caster = this.activeHero();
      const def = getCardDef(this.selectedCard.defId);
      if (caster && isValidTarget(this.controller.state, caster, def, p)) {
        this.overlay.selectedTiles = computeAffectedTiles(this.controller.state, caster, def, p);
      }
    }
    // Hover intent for enemies
    if (p) {
      const u = unitAt(this.controller.state, p);
      if (u && u.side === "enemy") {
        this.overlay.hoverIntent = this.controller.getIntent(u.id) ?? null;
      }
    }
  }

  private onCanvasClick(ev: MouseEvent): void {
    if (this.controller.state.phase !== "player_turn") return;
    const rect = this.canvas.getBoundingClientRect();
    const p = this.renderer.pickTile(ev.clientX - rect.left, ev.clientY - rect.top, this.controller.state);
    if (!p) return;
    const card = this.selectedCard;
    if (card) {
      this.tryPlay(card, p);
      return;
    }
    // No card: maybe selecting a hero
    const u = unitAt(this.controller.state, p);
    if (u && u.side === "player") {
      this.selectedHeroId = u.id;
      this.overlay.activeHeroId = u.id;
      audio.play("cardHover");
      this.rebuildSidebar();
    }
  }

  private tryPlay(card: CardInstance, target: GridPos | null): void {
    const caster = this.activeHero();
    if (!caster) return;
    const ok = this.controller.playCard(card, caster.id, target);
    if (!ok) {
      audio.play("invalid");
      return;
    }
    audio.play("cardPlay");
    this.overlay.cameraShake = 2;
    this.selectedCard = null;
    this.recomputeValidTiles();
    this.rebuildSidebar();
  }

  private endTurn(): void {
    if (this.controller.state.phase !== "player_turn") return;
    audio.play("cardHover");
    this.selectedCard = null;
    this.overlay.validTiles = [];
    this.overlay.selectedTiles = [];
    this.controller.endPlayerTurn();
    this.rebuildSidebar();
    // Resolve enemy turn with a brief delay for readability
    window.setTimeout(() => {
      this.controller.resolveEnemyTurn();
      this.overlay.cameraShake = 6;
      audio.play("enemyAttack");
      this.rebuildSidebar();
    }, 400);
  }

  private pushFloater(defenderId: UnitId, text: string, kind: "damage" | "heal" | "shield"): void {
    const u = this.controller.state.units.get(defenderId);
    if (!u) return;
    this.overlay.floaters.push({
      id: `${Date.now()}-${Math.random()}`,
      pos: { x: u.pos.x, y: u.pos.y },
      text,
      kind,
      start: performance.now(),
    });
    if (kind === "damage") this.overlay.cameraShake = Math.max(this.overlay.cameraShake, 4);
    audio.play("hit");
  }

  private handleCombatEnd(victory: boolean): void {
    window.setTimeout(() => {
      if (victory) {
        audio.play("victory");
        this.app.onCombatVictory();
      } else {
        audio.play("defeat");
        this.app.onCombatDefeat();
      }
    }, 700);
  }
}

function intentIcon(enemy: Unit): string {
  const ek = enemy.enemyKind ?? "";
  if (ek.includes("drone")) return "◭";
  if (ek.includes("brute")) return "■";
  if (ek.includes("sniper")) return "◆";
  if (ek.includes("bomber")) return "✷";
  if (ek.includes("leaper")) return "▲";
  if (ek.includes("warden")) return "★";
  if (ek.includes("parasite")) return "●";
  if (ek.includes("sentinel")) return "◉";
  if (ek.includes("boss")) return "☀";
  if (ek.includes("shield")) return "◈";
  return "?";
}

function renderStatusPills(u: Unit): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const [k, v] of Object.entries(u.statuses)) {
    if (!v || v <= 0) continue;
    out.push(el("span", { class: "status-pill", text: `${k} ${v}` }));
  }
  return out;
}

function renderRelics(controller: CombatController): HTMLElement {
  const row = el("div", {}, [
    el("div", {
      style: { fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-fg-dim)", marginBottom: "6px" } as Partial<CSSStyleDeclaration>,
      text: "Relics",
    }),
  ]);
  const wrap = el("div", { class: "relics" });
  if (controller.state.player.relics.length === 0) {
    wrap.appendChild(el("div", { class: "dim", style: { fontSize: "12px" } as Partial<CSSStyleDeclaration>, text: "No relics yet" }));
  }
  for (const id of controller.state.player.relics) {
    const def = RELIC_MAP.get(id);
    if (!def) continue;
    const chip = el("div", { class: "relic", text: "◈" });
    attachTooltip(chip, () => `<div class="name">${def.name}</div><div>${def.description}</div>`);
    wrap.appendChild(chip);
  }
  row.appendChild(wrap);
  return row;
}
