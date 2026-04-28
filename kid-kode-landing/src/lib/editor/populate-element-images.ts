'use client';

// populate-element-images — load atlas-0.avif + atlas-regions.json at editor
// boot, extract each region as a canvas → dataURL, dispatch into
// useElementImageStore.setImages(...). This lights up the GlassNode inner
// sphere texture path (already wired in GraphScene.tsx) so each node visibly
// carries its element image when zoomed in.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 4.

import { useElementImageStore } from '@/stores/useElementImageStore';

const ATLAS_REGIONS_URL = '/prism-assets/atlas-regions.json';
const ATLAS_IMAGE_URL = '/prism-assets/atlas-0.avif';

interface AtlasRegion {
  atlasId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hash: string;
  kind: string;
  nativeWidth: number;
  nativeHeight: number;
}

interface AtlasRegionsFile {
  schemaVersion: string;
  atlasFile: string;
  atlasWidth: number;
  atlasHeight: number;
  regionCount: number;
  regions: Record<string, AtlasRegion>;
}

let populated = false;
let inFlight: Promise<void> | null = null;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${url}`));
    img.src = url;
  });
}

export async function populateElementImages(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (populated) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const regionsRes = await fetch(ATLAS_REGIONS_URL, { cache: 'force-cache' });
    if (!regionsRes.ok) throw new Error(`atlas-regions.json fetch failed: ${regionsRes.status}`);
    const regionsJson = (await regionsRes.json()) as AtlasRegionsFile;

    const atlasImg = await loadImage(ATLAS_IMAGE_URL);

    const batch: Record<string, string> = {};
    for (const [regionKey, region] of Object.entries(regionsJson.regions)) {
      // Skip frame variants — base nodes carry their own region; per-frame
      // variants live under `<nodeId>/frame-NNN` and would collide.
      if (regionKey.includes('/')) continue;
      // Skip degenerate 2x2 placeholder regions (text rendered via msdf at
      // runtime; build-time stubs hold a slot only).
      if (region.w <= 4 && region.h <= 4) continue;

      const canvas = document.createElement('canvas');
      canvas.width = region.w;
      canvas.height = region.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(
        atlasImg,
        region.x, region.y, region.w, region.h,
        0, 0, region.w, region.h
      );
      batch[regionKey] = canvas.toDataURL('image/png');
    }

    if (Object.keys(batch).length > 0) {
      useElementImageStore.getState().setImages(batch);
    }
    populated = true;
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}
