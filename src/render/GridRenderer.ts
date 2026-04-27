import type { GridPos, UnitId } from "../core/Types.js";
import type { CombatState, Intent } from "../game/state/CombatState.js";
import type { Unit } from "../game/units/UnitTypes.js";
import { drawUnitSprite, hexWithAlpha } from "./SpriteFactory.js";

/**
 * Canvas-based grid renderer. Stateless w.r.t. the DOM — it reads the
 * CombatState and draws the whole battlefield every frame. Overlays for
 * targeting, hover, intents are drawn on top with alpha blending.
 */

export interface RenderOverlay {
  hoverTile: GridPos | null;
  selectedTiles: GridPos[];
  validTiles: GridPos[];
  hoverIntent: Intent | null;
  showIntents: boolean;
  activeHeroId: UnitId | null;
  cameraShake: number;
  /** Floating damage numbers to render in screen space. */
  floaters: { id: string; pos: GridPos; text: string; kind: "damage" | "heal" | "shield"; start: number }[];
  movementRange?: GridPos[];
  attackRange?: GridPos[];
  targetLine?: { from: GridPos; to: GridPos } | null;
  presentation?: {
    moveTweens: Map<UnitId, { from: GridPos; to: GridPos; start: number; duration: number }>;
    hitFlashes: Map<UnitId, number>;
    shieldPulses: Map<UnitId, number>;
    dissolves: Map<UnitId, number>;
    projectiles: { id: string; from: GridPos; to: GridPos; start: number; duration: number }[];
  };
}

export class GridRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  tileSize = 68;
  offsetX = 0;
  offsetY = 0;
  private lastW = 0;
  private lastH = 0;
  private lastDpr = 0;
  private lastGw = 0;
  private lastGh = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");
    this.ctx = ctx;
  }

  /** Recompute tile size and canvas dimensions based on parent size. */
  resize(state: CombatState): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const gw = state.grid.width, gh = state.grid.height;
    // Skip the (expensive) canvas resize if nothing relevant changed. This
    // avoids trashing the backing store and transform every frame.
    if (w === this.lastW && h === this.lastH && dpr === this.lastDpr && gw === this.lastGw && gh === this.lastGh) {
      return;
    }
    this.lastW = w;
    this.lastH = h;
    this.lastDpr = dpr;
    this.lastGw = gw;
    this.lastGh = gh;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ts = Math.floor(Math.min((w - 40) / gw, (h - 40) / gh));
    this.tileSize = Math.max(36, ts);
    this.offsetX = Math.floor((w - this.tileSize * gw) / 2);
    this.offsetY = Math.floor((h - this.tileSize * gh) / 2);
  }

  /** Convert grid position to canvas center pixel. */
  tileCenter(p: GridPos): { x: number; y: number } {
    return {
      x: this.offsetX + p.x * this.tileSize + this.tileSize / 2,
      y: this.offsetY + p.y * this.tileSize + this.tileSize / 2,
    };
  }

  /** Screen pixel → grid tile (null if outside). */
  pickTile(px: number, py: number, state: CombatState): GridPos | null {
    const gx = Math.floor((px - this.offsetX) / this.tileSize);
    const gy = Math.floor((py - this.offsetY) / this.tileSize);
    if (gx < 0 || gy < 0 || gx >= state.grid.width || gy >= state.grid.height) return null;
    return { x: gx, y: gy };
  }

  draw(state: CombatState, overlay: RenderOverlay): void {
    const { ctx } = this;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    ctx.save();
    if (overlay.cameraShake > 0) {
      const dx = (Math.random() - 0.5) * overlay.cameraShake;
      const dy = (Math.random() - 0.5) * overlay.cameraShake;
      ctx.translate(dx, dy);
    }
    ctx.clearRect(0, 0, w, h);

    this.drawGridTiles(state);
    this.drawTelegraphs(state);
    if (overlay.movementRange?.length) this.drawTileSet(overlay.movementRange, "rgba(123,232,160,0.08)", "rgba(123,232,160,0.28)");
    if (overlay.attackRange?.length) this.drawTileSet(overlay.attackRange, "rgba(255,122,122,0.05)", "rgba(255,122,122,0.25)");
    if (overlay.validTiles.length > 0) this.drawTileSet(overlay.validTiles, "rgba(107,184,255,0.15)", "rgba(107,184,255,0.35)");
    if (overlay.selectedTiles.length > 0) this.drawTileSet(overlay.selectedTiles, "rgba(155,232,255,0.28)", "rgba(155,232,255,0.8)");
    if (overlay.hoverTile) this.drawTileSet([overlay.hoverTile], "rgba(255,255,255,0.06)", "rgba(255,255,255,0.5)");

    // Units
    const heroes: Unit[] = [];
    const enemies: Unit[] = [];
    for (const u of state.units.values()) if (!u.dead) (u.side === "player" ? heroes : enemies).push(u);

    for (const u of heroes) this.drawUnit(u, overlay.activeHeroId === u.id, overlay);
    for (const u of enemies) this.drawUnit(u, false, overlay);

    // Intents
    if (overlay.showIntents || state.debug.revealIntents) this.drawIntents(state);

    // Hover intent details arrow
    if (overlay.hoverIntent) this.drawIntentEmphasis(overlay.hoverIntent, state);

    if (overlay.targetLine) this.drawTargetLine(overlay.targetLine.from, overlay.targetLine.to);
    this.drawProjectiles(overlay);
    // Floating damage numbers
    this.drawFloaters(overlay);

    ctx.restore();
  }

  private drawGridTiles(state: CombatState): void {
    const { ctx, tileSize: ts } = this;
    for (const tile of state.grid.all()) {
      const x = this.offsetX + tile.x * ts;
      const y = this.offsetY + tile.y * ts;
      let base = "#0f1830";
      let stroke = "rgba(120, 140, 200, 0.18)";
      switch (tile.kind) {
        case "blocked":
          base = "#0a0d18"; stroke = "rgba(100,100,100,0.15)"; break;
        case "cover":
          base = "#1a2640"; stroke = "rgba(96, 126, 150, 0.55)"; break;
        case "hazard":
          base = "#2a1508"; stroke = "rgba(255, 154, 60, 0.55)"; break;
        case "energy":
          base = "#25220a"; stroke = "rgba(255, 224, 102, 0.4)"; break;
        case "objective":
          base = "#0a1a2a"; stroke = "rgba(107, 184, 255, 0.6)"; break;
      }
      ctx.fillStyle = base;
      ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, ts - 3, ts - 3);

      if (tile.kind === "hazard") {
        ctx.fillStyle = "rgba(255, 154, 60, 0.25)";
        ctx.font = `${Math.floor(ts * 0.45)}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("☣", x + ts / 2, y + ts / 2 + 2);
      } else if (tile.kind === "cover") {
        ctx.fillStyle = "rgba(96, 126, 150, 0.35)";
        ctx.fillRect(x + ts * 0.3, y + ts * 0.3, ts * 0.4, ts * 0.4);
      } else if (tile.kind === "energy") {
        ctx.fillStyle = "rgba(255, 224, 102, 0.55)";
        ctx.beginPath();
        ctx.arc(x + ts / 2, y + ts / 2, ts * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawTileSet(tiles: GridPos[], fill: string, stroke: string): void {
    const { ctx, tileSize: ts } = this;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    for (const p of tiles) {
      const x = this.offsetX + p.x * ts;
      const y = this.offsetY + p.y * ts;
      ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
      ctx.strokeRect(x + 2.5, y + 2.5, ts - 5, ts - 5);
    }
  }

  private drawUnit(u: Unit, isActive: boolean, overlay: RenderOverlay): void {
    const { ctx, tileSize: ts } = this;
    let { x, y } = this.tileCenter(u.pos);
    const now = performance.now();
    const tween = overlay.presentation?.moveTweens.get(u.id);
    if (tween) {
      const t = Math.max(0, Math.min(1, (now - tween.start) / tween.duration));
      const from = this.tileCenter(tween.from);
      const to = this.tileCenter(tween.to);
      x = from.x + (to.x - from.x) * t;
      y = from.y + (to.y - from.y) * t;
    }

    if (isActive) {
      ctx.strokeStyle = "rgba(255, 224, 102, 0.8)";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        this.offsetX + u.pos.x * ts + 3,
        this.offsetY + u.pos.y * ts + 3,
        ts - 6,
        ts - 6,
      );
      ctx.setLineDash([]);
    }

    drawUnitSprite(ctx, u.spriteKey, x, y - ts * 0.03, ts * 0.95, u.side);
    if (overlay.presentation?.hitFlashes.has(u.id)) {
      ctx.fillStyle = "rgba(255,255,255,0.42)";
      ctx.fillRect(this.offsetX + u.pos.x * ts + 2, this.offsetY + u.pos.y * ts + 2, ts - 4, ts - 4);
    }
    if (overlay.presentation?.shieldPulses.has(u.id)) {
      ctx.strokeStyle = "rgba(107,184,255,0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, ts * 0.44, 0, Math.PI * 2);
      ctx.stroke();
    }
    const dissolving = overlay.presentation?.dissolves.has(u.id);
    if (dissolving) ctx.globalAlpha = 0.35;

    // HP bar
    const hpPct = Math.max(0, u.hp / u.maxHp);
    const barW = ts * 0.78;
    const barX = x - barW / 2;
    const barY = y + ts * 0.36;
    ctx.fillStyle = "#000";
    ctx.globalAlpha = 0.55;
    ctx.fillRect(barX - 1, barY - 1, barW + 2, 7);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(barX, barY, barW, 5);
    const color = u.side === "player" ? "#6bff99" : "#ff6b7a";
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barW * hpPct, 5);

    // HP text
    ctx.fillStyle = "#fff";
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${u.hp}/${u.maxHp}`, x, barY + 7);

    // Shield
    const shield = u.statuses["shield"] ?? 0;
    if (shield > 0) {
      ctx.fillStyle = "rgba(107, 184, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(x - ts * 0.35, y - ts * 0.35, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#021a2a";
      ctx.font = "700 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(shield), x - ts * 0.35, y - ts * 0.35);
    }

    // Status pills (small)
    const statusOrder = ["burn", "poison", "marked", "vulnerable", "weak", "stun", "rooted", "strength", "retaliate"];
    let px = x - ts * 0.35;
    const py = y + ts * 0.22;
    for (const s of statusOrder) {
      const n = u.statuses[s];
      if (!n) continue;
      ctx.fillStyle = statusColor(s);
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = "700 8px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(n), px, py);
      px += 11;
    }
    ctx.globalAlpha = 1;
  }

  private drawTargetLine(from: GridPos, to: GridPos): void {
    const a = this.tileCenter(from);
    const b = this.tileCenter(to);
    const { ctx } = this;
    ctx.strokeStyle = "rgba(155,232,255,0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawProjectiles(overlay: RenderOverlay): void {
    const { ctx } = this;
    const now = performance.now();
    for (const p of overlay.presentation?.projectiles ?? []) {
      const t = Math.max(0, Math.min(1, (now - p.start) / p.duration));
      const a = this.tileCenter(p.from);
      const b = this.tileCenter(p.to);
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      ctx.fillStyle = "rgba(255,190,120,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawIntents(state: CombatState): void {
    const { ctx, tileSize: ts } = this;
    for (const [id, intent] of state.intents) {
      const enemy = state.units.get(id);
      if (!enemy || enemy.dead) continue;
      const { x, y } = this.tileCenter(enemy.pos);

      // Intent icon above enemy
      const icon = intent.icon ?? "?";
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.beginPath();
      ctx.arc(x + ts * 0.3, y - ts * 0.35, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 107, 122, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + ts * 0.3, y - ts * 0.35, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ff9a9a";
      ctx.font = "600 14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, x + ts * 0.3, y - ts * 0.35);
      if (intent.predictedDamage !== undefined) {
        ctx.fillStyle = "#ffe066";
        ctx.font = "700 11px ui-monospace, monospace";
        ctx.fillText(String(intent.predictedDamage), x + ts * 0.3, y - ts * 0.18);
      }

      // Affected tiles preview
      if (intent.affectedTiles.length > 0 && intent.kind !== "wait") {
        ctx.fillStyle = "rgba(255, 107, 122, 0.14)";
        ctx.strokeStyle = "rgba(255, 107, 122, 0.55)";
        ctx.lineWidth = 1;
        for (const p of intent.affectedTiles) {
          const tx = this.offsetX + p.x * ts;
          const ty = this.offsetY + p.y * ts;
          ctx.fillRect(tx + 2, ty + 2, ts - 4, ts - 4);
          ctx.strokeRect(tx + 2.5, ty + 2.5, ts - 5, ts - 5);
        }
      }
    }
  }

  private drawIntentEmphasis(intent: Intent, state: CombatState): void {
    const { ctx, tileSize: ts } = this;
    const enemy = state.units.get(intent.enemyId);
    if (!enemy) return;
    const from = this.tileCenter(enemy.pos);
    if (intent.targetUnitId) {
      const to = state.units.get(intent.targetUnitId);
      if (!to) return;
      const target = this.tileCenter(to.pos);
      ctx.strokeStyle = "rgba(255, 224, 102, 0.75)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(target.x, target.y); ctx.stroke();
      ctx.setLineDash([]);
    } else if (intent.targetTile) {
      const target = this.tileCenter(intent.targetTile);
      ctx.strokeStyle = "rgba(255, 224, 102, 0.75)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(target.x, target.y); ctx.stroke();
      ctx.setLineDash([]);
    }
    void ts;
  }

  private drawTelegraphs(state: CombatState): void {
    const { ctx, tileSize: ts } = this;
    for (const tg of state.telegraphs) {
      for (const p of tg.tiles) {
        const x = this.offsetX + p.x * ts;
        const y = this.offsetY + p.y * ts;
        ctx.fillStyle = hexWithAlpha("#ff9a3c", 0.22);
        ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
        ctx.strokeStyle = "rgba(255, 154, 60, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x + 2.5, y + 2.5, ts - 5, ts - 5);
        ctx.setLineDash([]);
      }
      if (tg.tiles[0]) {
        const p = tg.tiles[Math.floor(tg.tiles.length / 2)];
        const { x, y } = this.tileCenter(p);
        ctx.fillStyle = "#ffb76b";
        ctx.font = "700 11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${tg.label} ${tg.damage}`, x, y - ts * 0.4);
      }
    }
  }

  private drawFloaters(overlay: RenderOverlay): void {
    const now = performance.now();
    const { ctx, tileSize: ts } = this;
    for (let i = overlay.floaters.length - 1; i >= 0; i--) {
      const f = overlay.floaters[i];
      const age = (now - f.start) / 800;
      if (age >= 1) {
        overlay.floaters.splice(i, 1);
        continue;
      }
      const alpha = age < 0.2 ? age / 0.2 : 1 - (age - 0.2) / 0.8;
      const { x, y } = this.tileCenter(f.pos);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = f.kind === "damage" ? "#ff6b7a" : f.kind === "heal" ? "#7be8a0" : "#6bb8ff";
      ctx.font = "700 18px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const dy = -age * ts * 0.8;
      ctx.fillText(f.text, x, y - ts * 0.5 + dy);
      ctx.globalAlpha = 1;
    }
  }
}

function statusColor(id: string): string {
  switch (id) {
    case "burn": return "#ffa257";
    case "poison": return "#7be8a0";
    case "marked": return "#ffe066";
    case "vulnerable": return "#ff7b7b";
    case "weak": return "#c793ff";
    case "stun": return "#d0d0d0";
    case "rooted": return "#8a6d3b";
    case "strength": return "#ff9b6b";
    case "retaliate": return "#c0ff6b";
    default: return "#ccd";
  }
}
