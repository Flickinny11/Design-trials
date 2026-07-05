'use client';

// populate-element-images — load atlas-0.avif + atlas-regions.json at editor
// boot, extract each region as a canvas → dataURL, dispatch into
// useElementImageStore.setImages(...). This lights up the GlassNode inner
// sphere texture path (already wired in GraphScene.tsx) so each node visibly
// carries its element image when zoomed in.
//
// UI-FIDELITY-2 W2 adds a second, independent SOURCE-ASSET lane: the atlas
// only covers the baked mock-app region keys, so the live editor graph's
// nodes (home-*) had no element image at all and the Inspector's "Element
// Image" well fell back to its generic gradient placeholder. The new lane
// derives each node's element image from its ACTUAL artifact image
// (`visual.sourceAsset`) and tracks source-graph changes (boot load, image
// upload, Replace) via a store subscription.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 4.

import { useElementImageStore } from '@/stores/useElementImageStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { PrismNode } from '@/lib/prism-graph/types';

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

// ── Source-asset lane (UI-FIDELITY-2 W2) ────────────────────────────────────
// Element images keyed by nodeId (the view-model maps `id: node.nodeId`, so
// Inspector's `images[node.id]` lookup and GraphScene both pick these up).
// Longest edge capped so the dataURLs stay store-friendly.
const MAX_ELEMENT_IMAGE_EDGE = 512;
// nodeId → the sourceAsset URL already extracted, so a node is only
// re-processed when its asset actually changes (the Image group's Replace).
const processedAssetByNode = new Map<string, string>();
let sourceLaneInstalled = false;

async function extractSourceAssetImage(url: string): Promise<string | null> {
  try {
    const img = await loadImage(url);
    const scale = Math.min(
      1,
      MAX_ELEMENT_IMAGE_EDGE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1),
    );
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } catch {
    // Decorative — a missing or CORS-tainted asset just keeps the well
    // fallback; the next graph emit retries (see the delete below).
    return null;
  }
}

async function populateFromSourceAssets(nodes: PrismNode[]): Promise<void> {
  if (typeof window === 'undefined') return;
  const pending: Array<{ nodeId: string; asset: string }> = [];
  for (const n of nodes) {
    const asset = n.visual?.sourceAsset;
    if (!asset) continue;
    if (processedAssetByNode.get(n.nodeId) === asset) continue;
    pending.push({ nodeId: n.nodeId, asset });
  }
  if (pending.length === 0) return;
  // Mark before the async work so a rapid second store emit can't double-load.
  for (const p of pending) processedAssetByNode.set(p.nodeId, p.asset);

  const entries = await Promise.all(
    pending.map(async (p) => ({ ...p, dataUrl: await extractSourceAssetImage(p.asset) })),
  );
  const batch: Record<string, string> = {};
  for (const e of entries) {
    if (e.dataUrl) batch[e.nodeId] = e.dataUrl;
    else processedAssetByNode.delete(e.nodeId);
  }
  if (Object.keys(batch).length > 0) {
    useElementImageStore.getState().setImages(batch);
  }
}

function installSourceAssetLane(): void {
  if (sourceLaneInstalled) return;
  sourceLaneInstalled = true;
  // Immediate pass over whatever the source store already holds, then track
  // every nodes-array swap (the async boot load lands as one of these). The
  // store mounts subscribeWithSelector, so the selector form is available.
  void populateFromSourceAssets(useGraphSourceStore.getState().nodes);
  useGraphSourceStore.subscribe(
    (s) => s.nodes,
    (nodes) => {
      void populateFromSourceAssets(nodes);
    },
  );
}

export async function populateElementImages(): Promise<void> {
  if (typeof window === 'undefined') return;
  // The source-asset lane is independent of the atlas lane — install it first
  // so a missing atlas never blanks the live graph's element images.
  installSourceAssetLane();
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
