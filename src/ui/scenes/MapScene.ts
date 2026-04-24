import { audio } from "../../engine/AudioManager.js";
import { ENCOUNTER_MAP } from "../../data/encounters.js";
import type { MapNode, RunState } from "../../game/state/RunState.js";
import { clear, el } from "../UIHelpers.js";
import type { GameApp } from "../GameApp.js";

/**
 * Renders the branching map on a canvas, with party & relic summary in the
 * header. Nodes that are reachable from the current position are clickable.
 */
export class MapScene {
  readonly root: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private run: RunState;
  private hoverId: string | null = null;

  constructor(readonly app: GameApp, run: RunState) {
    this.run = run;
    this.root = el("div", { class: "scene map-scene" });
    this.build();
    window.addEventListener("resize", this.onResize);
    requestAnimationFrame(() => this.draw());
  }

  dispose(): void {
    window.removeEventListener("resize", this.onResize);
  }

  private onResize = (): void => this.draw();

  private build(): void {
    // Top bar: party plates + relics + abandon run
    const heroChips = this.run.heroes.map((h) => {
      const chip = el("div", { class: "hero-chip" }, [
        el("span", { class: "swatch" }),
        el("span", { text: h.heroClass.charAt(0).toUpperCase() + h.heroClass.slice(1) }),
        el("span", { class: "dim", style: { fontFamily: "var(--font-mono)" } as Partial<CSSStyleDeclaration>, text: `${h.hp}/${h.maxHp}` }),
      ]);
      return chip;
    });
    const relics = el("div", { class: "relics" });
    for (const id of this.run.relics) {
      relics.appendChild(el("div", { class: "relic", text: "◈", title: id }));
    }
    const right = el("div", { style: { display: "flex", gap: "10px", alignItems: "center" } as Partial<CSSStyleDeclaration> }, [
      el("div", { class: "dim", style: { fontFamily: "var(--font-mono)", fontSize: "12px" } as Partial<CSSStyleDeclaration>, text: `seed ${this.run.seed}` }),
      el("button", { class: "subtle", text: "Abandon", onClick: () => this.app.abandonRun() }),
      el("button", { class: "subtle", text: "Save & Menu", onClick: () => this.app.saveAndExit() }),
    ]);
    const top = el("div", { class: "map-topbar panel", style: { padding: "10px 14px" } as Partial<CSSStyleDeclaration> }, [
      el("div", { class: "party" }, [...heroChips, relics]),
      right,
    ]);
    this.root.appendChild(top);

    const wrap = el("div", { class: "map-canvas-wrap" });
    this.canvas = el("canvas", { class: "map-canvas" }) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    wrap.appendChild(this.canvas);
    this.canvas.addEventListener("mousemove", (ev) => this.onMouseMove(ev));
    this.canvas.addEventListener("click", (ev) => this.onClick(ev));

    wrap.appendChild(this.legend());
    this.root.appendChild(wrap);
  }

  private legend(): HTMLElement {
    const rows = [
      { kind: "combat", color: "#6bb8ff", label: "Combat" },
      { kind: "elite", color: "#c9a8ff", label: "Elite" },
      { kind: "event", color: "#7be8a0", label: "Event" },
      { kind: "rest", color: "#ffe066", label: "Rest" },
      { kind: "upgrade", color: "#ff9a3c", label: "Forge" },
      { kind: "boss", color: "#ff5c5c", label: "Boss" },
    ];
    return el("div", { class: "map-legend" }, rows.map((r) =>
      el("div", { class: "row" }, [
        el("span", { class: "sw", style: { background: r.color } as Partial<CSSStyleDeclaration> }),
        el("span", { text: r.label }),
      ]),
    ));
  }

  private layout(): { nodes: { node: MapNode; x: number; y: number }[]; w: number; h: number } {
    const dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement!;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const layers = Math.max(...this.run.map.map((n) => n.layer)) + 1;
    const cols = Math.max(...this.run.map.map((n) => n.column)) + 1;

    const padX = 70;
    const padY = 40;
    const stepX = (w - padX * 2) / Math.max(1, layers - 1);
    const stepY = (h - padY * 2) / Math.max(1, cols - 1);

    const out: { node: MapNode; x: number; y: number }[] = [];
    for (const n of this.run.map) {
      const x = padX + stepX * n.layer;
      const y = padY + stepY * n.column;
      out.push({ node: n, x, y });
    }
    return { nodes: out, w, h };
  }

  private draw(): void {
    const { nodes, w, h } = this.layout();
    const { ctx } = this;
    ctx.clearRect(0, 0, w, h);

    const idToPos = new Map(nodes.map((x) => [x.node.id, { x: x.x, y: x.y }]));

    // Edges
    ctx.lineWidth = 2;
    for (const { node, x, y } of nodes) {
      for (const nextId of node.next) {
        const to = idToPos.get(nextId);
        if (!to) continue;
        const active = node.completed || node.id === this.run.currentNodeId;
        ctx.strokeStyle = active ? "rgba(155, 232, 255, 0.6)" : "rgba(120, 140, 200, 0.18)";
        ctx.beginPath();
        ctx.moveTo(x, y);
        const midX = (x + to.x) / 2;
        ctx.bezierCurveTo(midX, y, midX, to.y, to.x, to.y);
        ctx.stroke();
      }
    }

    // Nodes
    for (const { node, x, y } of nodes) {
      const reach = this.isReachable(node);
      const color = kindColor(node.kind);
      const current = node.id === this.run.currentNodeId;
      const r = current ? 22 : 17;

      // Halo
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
      grd.addColorStop(0, color + "55");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(x, y, r * 2, 0, Math.PI * 2); ctx.fill();

      // Body
      ctx.fillStyle = node.completed
        ? "#1a2640"
        : reach
          ? color
          : "#17223d";
      ctx.strokeStyle = node.completed ? "#4a5a8a" : reach ? "#fff" : "#3a4a7a";
      ctx.lineWidth = current ? 3 : 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // Icon
      ctx.fillStyle = node.completed ? "#6a7590" : "#0b1018";
      ctx.font = `700 ${Math.floor(r * 1.1)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(kindGlyph(node.kind), x, y + 1);

      // Hover label
      if (this.hoverId === node.id) {
        ctx.fillStyle = "rgba(12,18,32,0.95)";
        ctx.strokeStyle = "#3a4a7a";
        const label = this.nodeLabel(node);
        ctx.font = "12px var(--font-ui)";
        const metrics = ctx.measureText(label);
        const labelW = metrics.width + 14;
        const labelH = 22;
        ctx.beginPath();
        roundRect(ctx, x - labelW / 2, y - r - labelH - 8, labelW, labelH, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#e7ecf5";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x, y - r - labelH / 2 - 8);
      }
    }

    requestAnimationFrame(() => this.draw());
  }

  private isReachable(node: MapNode): boolean {
    if (node.completed) return false;
    if (this.run.currentNodeId === null) {
      // Starting — first layer is reachable
      return node.layer === 0;
    }
    const cur = this.run.map.find((n) => n.id === this.run.currentNodeId);
    if (!cur) return node.layer === 0;
    return cur.next.includes(node.id);
  }

  private nodeLabel(n: MapNode): string {
    if (n.kind === "event") return "Mystery Event";
    const enc = ENCOUNTER_MAP.get(n.encounterId);
    return enc?.name ?? n.kind;
  }

  private onMouseMove(ev: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const { nodes } = this.layout();
    let hover: string | null = null;
    for (const { node, x, y } of nodes) {
      if ((px - x) ** 2 + (py - y) ** 2 <= 22 * 22) {
        hover = node.id;
        break;
      }
    }
    if (hover !== this.hoverId) {
      this.hoverId = hover;
    }
  }

  private onClick(ev: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const { nodes } = this.layout();
    for (const { node, x, y } of nodes) {
      if ((px - x) ** 2 + (py - y) ** 2 <= 22 * 22) {
        if (!this.isReachable(node)) return;
        audio.play("mapNode");
        this.app.enterNode(node);
        return;
      }
    }
  }

  rebuild(run: RunState): void {
    this.run = run;
    clear(this.root);
    this.build();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function kindColor(k: MapNode["kind"]): string {
  switch (k) {
    case "elite": return "#c9a8ff";
    case "boss": return "#ff5c5c";
    case "event": return "#7be8a0";
    case "rest": return "#ffe066";
    case "upgrade": return "#ff9a3c";
    case "shop": return "#9be8ff";
    default: return "#6bb8ff";
  }
}

function kindGlyph(k: MapNode["kind"]): string {
  switch (k) {
    case "elite": return "★";
    case "boss": return "☀";
    case "event": return "?";
    case "rest": return "❦";
    case "upgrade": return "⚒";
    case "shop": return "$";
    default: return "⚔";
  }
}
