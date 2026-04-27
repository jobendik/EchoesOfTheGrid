import { resolveAsset } from "../data/assets.js";
import { assetCache } from "./AssetCache.js";
import type { AssetKey } from "../core/Types.js";

/**
 * Procedural sprite drawing. All placeholder art is drawn directly to a
 * canvas 2D context based on the asset manifest. Swapping to real sprites
 * is purely a config change in `src/data/assets.ts` + uploading an image
 * and setting `productionPath`.
 */

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  size: number;
}

export function drawUnitSprite(
  ctx: CanvasRenderingContext2D,
  assetKey: AssetKey,
  cx: number,
  cy: number,
  size: number,
  side: "player" | "enemy",
): void {
  const entry = resolveAsset(assetKey);
  const color = entry?.color ?? (side === "player" ? "#6bb8ff" : "#ff6b7a");
  const shape = entry?.shape ?? "circle";
  const half = size * 0.42;

  const productionImage = assetCache.getImage(assetKey);
  if (productionImage) {
    const w = size * 0.88;
    const h = size * 0.88;
    ctx.drawImage(productionImage, cx - w / 2, cy - h / 2, w, h);
    return;
  }

  // Glow
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.6);
  grad.addColorStop(0, hexWithAlpha(color, 0.4));
  grad.addColorStop(1, hexWithAlpha(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, size * 0.6, 0, Math.PI * 2); ctx.fill();

  // Body
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 2;
  drawShape(ctx, shape, half);
  ctx.fill();
  ctx.stroke();

  // Highlight ring
  ctx.strokeStyle = hexWithAlpha(color, 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, half + 4, 0, Math.PI * 2); ctx.stroke();

  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: string, r: number): void {
  switch (shape) {
    case "triangle":
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.95, r * 0.8);
      ctx.lineTo(-r * 0.95, r * 0.8);
      ctx.closePath();
      break;
    case "square":
      ctx.beginPath();
      ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
      break;
    case "diamond":
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      break;
    case "hex": {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "star": {
      ctx.beginPath();
      const spikes = 5;
      for (let i = 0; i < spikes * 2; i++) {
        const rr = i % 2 === 0 ? r : r * 0.45;
        const a = (Math.PI / spikes) * i - Math.PI / 2;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "blade": {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.6, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.6, 0);
      ctx.closePath();
      break;
    }
    case "shield": {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r, -r * 0.3, r * 0.6, r * 0.9);
      ctx.quadraticCurveTo(0, r, -r * 0.6, r * 0.9);
      ctx.quadraticCurveTo(-r, -r * 0.3, 0, -r);
      ctx.closePath();
      break;
    }
    case "orb":
    case "circle":
    default:
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      break;
  }
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
