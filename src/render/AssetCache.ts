import { resolveAsset } from "../data/assets.js";
import type { AssetKey } from "../core/Types.js";

/** Lightweight image cache with graceful fallback for missing production files. */
export class AssetCache {
  private images = new Map<AssetKey, HTMLImageElement | null>();
  private loading = new Set<AssetKey>();

  getImage(key: AssetKey): HTMLImageElement | null {
    if (this.images.has(key)) return this.images.get(key) ?? null;
    const entry = resolveAsset(key);
    if (!entry?.productionPath || typeof window === "undefined") {
      this.images.set(key, null);
      return null;
    }
    this.images.set(key, null);
    this.loading.add(key);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      this.images.set(key, img);
      this.loading.delete(key);
    };
    img.onerror = () => {
      this.images.set(key, null);
      this.loading.delete(key);
    };
    img.src = entry.productionPath;
    return null;
  }

  hasPendingLoads(): boolean {
    return this.loading.size > 0;
  }
}

export const assetCache = new AssetCache();
