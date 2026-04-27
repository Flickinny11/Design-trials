// Load the AVIF atlas into a single PIXI Texture and expose a getTexture(region)
// helper that slices it into sub-textures on demand.

import * as PIXI from "pixi.js";
import type { AtlasRegions, Region } from "./prism-loader";

export interface Atlas {
  baseTexture: PIXI.Texture;
  getTexture(
    region: Region | { x: number; y: number; w: number; h: number },
  ): PIXI.Texture;
  regions: AtlasRegions["regions"];
  destroy(): void;
}

export async function loadAtlas(
  buf: ArrayBuffer,
  regions: AtlasRegions,
): Promise<Atlas> {
  const blob = new Blob([buf], { type: "image/avif" });
  const bitmap = await createImageBitmap(blob);
  const source = new PIXI.ImageSource({ resource: bitmap });
  const baseTexture = new PIXI.Texture({ source });
  const subCache = new Map<string, PIXI.Texture>();

  function getTexture(
    region: Region | { x: number; y: number; w: number; h: number },
  ): PIXI.Texture {
    const key = `${region.x}:${region.y}:${region.w}:${region.h}`;
    const cached = subCache.get(key);
    if (cached) return cached;
    const frame = new PIXI.Rectangle(region.x, region.y, region.w, region.h);
    const tex = new PIXI.Texture({ source, frame });
    subCache.set(key, tex);
    return tex;
  }

  return {
    baseTexture,
    getTexture,
    regions: regions.regions,
    destroy() {
      for (const t of subCache.values()) t.destroy(false);
      baseTexture.destroy(false);
      source.destroy();
    },
  };
}
