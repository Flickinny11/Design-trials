// image-helpers.ts — pure helpers for the Image toolbar group (canvas-spec §5
// Image tools; P3 Task B). PURE + node-testable: no React, no DOM, no store
// imports — tests/editor-build/P3-image-ui-helpers.test.ts exercises these
// directly (same discipline as add-tools/create-element-node.ts and
// text-tools/text-tool-helpers.ts).
//
// Exports:
//   - buildImageNode(opts) — valid input for `useGraphSourceStore.addNode`
//     (which runs it through `applyPlanRendererDefaults`): an image-plane node
//     BORN Populated (it has an artifact: `visual.sourceAsset`). renderMode
//     'sprite', plane sized from the source pixels via imagePlaneSize, spawn
//     point distinct from the Add Text and Add Element spawns.
//   - imagePlaneSize(w, h) — scene-unit plane extent for a source image:
//     width capped at IMAGE_MAX_EXTENT, height from the aspect ratio.
//   - isImageBearingNode(node) — the Replace / presentation-controls gate:
//     an image render mode (sprite / plane / parallax-plane) carrying a
//     `visual.sourceAsset` artifact.
//   - effectiveImageSpec / withImageSpecPatch / withCropPatch — read + build
//     `node.imageSpec` values immutably (whole-object replacement for
//     `updateNode`, the sanctioned toolbar write route). The renderer-side
//     consumer is agent A's `runtime/shared/image-spec.ts`; these are the UI's
//     mirror over the same frozen IMAGE_SPEC_DEFAULT.
//   - normalizeImageUrl(raw) — light URL normalization for the paste-a-link
//     path (no validation theater; the real check is trying to load it).
//   - imageNodeCaption(source?) — the 'New image' caption convention.

import {
  IMAGE_SPEC_DEFAULT,
  type ImageCrop,
  type ImageSpec,
  type PrismNode,
  type ScenePosition,
} from '@/lib/prism-graph/types';

/** Largest plane extent (scene units) a fresh image spawns at. */
export const IMAGE_MAX_EXTENT = 1.2;

/** Canvas-spawn point for Add Image. Same clear lower band as Add Text
 *  (0, -0.8, 0.2) and Add Element (+0.9, -0.8, 0.2), mirrored to −0.9 on x so
 *  the three fresh-node flows never stack. */
export const IMAGE_SPAWN_POSITION: ScenePosition = {
  x: -0.9, y: -0.8, z: 0.2,
  rotationX: 0, rotationY: 0, rotationZ: 0,
  scaleX: 1, scaleY: 1, scaleZ: 1,
};

/** Render modes whose artifact is an image texture in a plane. */
export const IMAGE_RENDER_MODES = ['sprite', 'plane', 'parallax-plane'] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Clamp to the normalized 0..1 range (crop / radius / opacity domain). */
export const clamp01 = (v: number) => clamp(v, 0, 1);

// ── Caption convention ───────────────────────────────────────────────────────

/** Human display name for an image source: a file name (or URL basename),
 *  query/hash stripped, decoded. Never a machine id — returns null when the
 *  source has no human-readable tail (e.g. data:/blob: URIs). */
export function imageDisplayName(source: string | null | undefined): string | null {
  if (!source) return null;
  const raw = source.trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return null;
  // Strip query/hash, then scheme + host (a bare hostname is a machine
  // address, not a picture name), then take the last path segment.
  let path = raw.split(/[?#]/)[0];
  const scheme = /^[a-z][a-z0-9+.-]*:\/\//i.exec(path);
  if (scheme || path.startsWith('//')) {
    path = path.slice(scheme ? scheme[0].length : 2);
    const slash = path.indexOf('/');
    path = slash === -1 ? '' : path.slice(slash + 1);
  }
  const tail = path.split('/').filter(Boolean).pop() ?? '';
  if (!tail || !tail.includes('.')) return null; // bare host / no file tail
  // Machine-named files are not names (advocate MUST-FIX 2026-06-10): the
  // upload store content-addresses files as <sha256-hex>.<ext>, and showing
  // that leaks a 64-char hash into the inspector/Replace row. Long hex (or
  // uuid-ish) stems fall back to the friendly default caption instead.
  const stem = tail.slice(0, tail.lastIndexOf('.'));
  if (/^[0-9a-f]{16,}$/i.test(stem) || /^[0-9a-f-]{32,}$/i.test(stem)) return null;
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}

/** The 'New image' caption convention (plain language; mirrors the Add Text /
 *  Add Element fresh-node captions). With a recognizable file name the
 *  caption carries it; otherwise it stays the plain default. */
export function imageNodeCaption(source?: string | null): string {
  const name = imageDisplayName(source);
  return name ? `New image · ${name}` : 'New image';
}

// ── Plane sizing ─────────────────────────────────────────────────────────────

/** Scene-unit plane extent for a source image of `srcWidth`×`srcHeight` px:
 *  width = IMAGE_MAX_EXTENT, height follows the aspect ratio (clamped to a
 *  sane band so a degenerate strip never spawns invisible or viewport-
 *  swallowing). Unknown / invalid dimensions fall back to a square. */
export function imagePlaneSize(
  srcWidth?: number,
  srcHeight?: number,
): { width: number; height: number } {
  const w = typeof srcWidth === 'number' && Number.isFinite(srcWidth) ? srcWidth : 0;
  const h = typeof srcHeight === 'number' && Number.isFinite(srcHeight) ? srcHeight : 0;
  if (w <= 0 || h <= 0) {
    return { width: IMAGE_MAX_EXTENT, height: IMAGE_MAX_EXTENT };
  }
  const aspect = w / h;
  return {
    width: IMAGE_MAX_EXTENT,
    height: clamp(IMAGE_MAX_EXTENT / aspect, 0.06, 3),
  };
}

// ── Node builder (born Populated — it has an artifact) ──────────────────────

/** Build the `addNode` input for a fresh image-plane node under
 *  `parentHubId`. Unlike the Add Element bubble (Stage 0, artifact-less),
 *  an image node is BORN Populated: `visual.sourceAsset` IS its artifact
 *  (upload and URL paths both end as a URL). Minimal-node conventions
 *  mirrored from create-text-node.ts / create-element-node.ts: `codeRef: ''`,
 *  `backendRef: null`, `serviceTag: 'main'`, empty behavior/visual specs. */
export function buildImageNode(opts: {
  parentHubId: string;
  url: string;
  /** Source-image pixel dimensions (from uploadImageAsset or a URL probe). */
  width?: number;
  height?: number;
  /** Optional human source name (file name) for the caption. */
  sourceName?: string;
  caption?: string;
}): Partial<PrismNode> & { parentHubId: string } {
  const size = imagePlaneSize(opts.width, opts.height);
  return {
    parentHubId: opts.parentHubId,
    subtype: 'image',
    serviceTag: 'main',
    renderMode: 'sprite',
    scenePosition: { ...IMAGE_SPAWN_POSITION },
    visual: {
      sourceAsset: opts.url,
      transform: { x: 0, y: 0, z: 0, width: size.width, height: size.height },
      alpha: 1,
    },
    intent: {
      caption: opts.caption ?? imageNodeCaption(opts.sourceName ?? opts.url),
      behaviorSpec: {
        interactions: [],
        apiCalls: [],
        dataBindings: [],
        emits: [],
        listens: [],
        triggersDownstream: [],
      },
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: '',
    backendRef: null,
  };
}

/** True when `node` is an image-bearing node the Replace action and the
 *  presentation controls may target: an image render mode (legacy nodes
 *  without renderMode default to 'sprite') carrying a `visual.sourceAsset`
 *  texture artifact. Text / mesh / bubble nodes are out. */
export function isImageBearingNode(node: PrismNode | null | undefined): boolean {
  if (!node) return false;
  const mode = node.renderMode ?? 'sprite';
  if (!(IMAGE_RENDER_MODES as readonly string[]).includes(mode)) return false;
  return typeof node.visual?.sourceAsset === 'string' && node.visual.sourceAsset.length > 0;
}

// ── imageSpec read + immutable update (whole-object replacement) ────────────

/** Fully-defaulted crop window (the whole frame). */
export const CROP_FULL_FRAME: Required<ImageCrop> = { x: 0, y: 0, width: 1, height: 1 };

export interface EffectiveImageSpec {
  fit: NonNullable<ImageSpec['fit']>;
  crop: Required<ImageCrop>;
  cornerRadius: number;
  opacity: number;
}

/** Resolve an ImageSpec (or absence) over IMAGE_SPEC_DEFAULT so the UI always
 *  renders defined controls. Read-only — never mutates the input. */
export function effectiveImageSpec(spec?: ImageSpec | null): EffectiveImageSpec {
  return {
    fit: spec?.fit ?? IMAGE_SPEC_DEFAULT.fit ?? 'cover',
    crop: { ...CROP_FULL_FRAME, ...(spec?.crop ?? {}) },
    cornerRadius: spec?.cornerRadius ?? IMAGE_SPEC_DEFAULT.cornerRadius ?? 0,
    opacity: spec?.opacity ?? IMAGE_SPEC_DEFAULT.opacity ?? 1,
  };
}

/** Build the NEXT whole `imageSpec` object from the current one plus a patch
 *  (defaults applied; cornerRadius/opacity clamped to 0..1). Pure + immutable:
 *  the returned object is fresh and the inputs are untouched — callers hand
 *  it to `updateNode(nodeId, { imageSpec: next })` as a whole-object
 *  replacement (the sanctioned toolbar write route). */
export function withImageSpecPatch(
  current: ImageSpec | undefined | null,
  patch: Partial<ImageSpec>,
): ImageSpec {
  const merged: ImageSpec = {
    ...IMAGE_SPEC_DEFAULT,
    ...(current ?? {}),
    ...patch,
  };
  if (merged.crop) merged.crop = { ...merged.crop };
  if (typeof merged.cornerRadius === 'number') {
    merged.cornerRadius = clamp01(merged.cornerRadius);
  }
  if (typeof merged.opacity === 'number') {
    merged.opacity = clamp01(merged.opacity);
  }
  return merged;
}

/** Build the NEXT whole `imageSpec` with a crop-window patch (each field
 *  clamped to the normalized 0..1 domain; untouched fields keep their current
 *  values over the full-frame default). */
export function withCropPatch(
  current: ImageSpec | undefined | null,
  patch: Partial<ImageCrop>,
): ImageSpec {
  const base = { ...CROP_FULL_FRAME, ...(current?.crop ?? {}) };
  const next: Required<ImageCrop> = { ...base };
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const v = patch[key];
    if (typeof v === 'number' && Number.isFinite(v)) next[key] = clamp01(v);
  }
  return withImageSpecPatch(current, { crop: next });
}

// ── URL normalization (paste-a-link path) ────────────────────────────────────

/** Lightly normalize a pasted image link. Returns the loadable URL, or null
 *  when the text can't be a fetchable image source. Deliberately NOT a
 *  validator — the caller tries to actually load the result and toasts on
 *  failure. */
export function normalizeImageUrl(raw: string): string | null {
  const s = (raw ?? '').trim();
  if (!s || /\s/.test(s)) return null;
  const lower = s.toLowerCase();
  // Script-ish schemes are never image sources.
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('file:')) {
    return null;
  }
  if (lower.startsWith('data:')) {
    return lower.startsWith('data:image/') ? s : null;
  }
  if (lower.startsWith('blob:')) return s;
  if (lower.startsWith('http://') || lower.startsWith('https://')) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return s; // same-origin asset (what the upload API returns)
  // Bare host form ("example.com/cat.png") — needs a dot in the host segment.
  const host = s.split('/')[0];
  if (host.includes('.') && !host.startsWith('.') && !host.endsWith('.')) {
    return `https://${s}`;
  }
  return null;
}
