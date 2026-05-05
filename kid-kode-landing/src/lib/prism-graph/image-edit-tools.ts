// T08 — Editor image-edit tools (mask refinement, crop, swap-mesh-for-image).
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L483 — "Image-edit mode —
// masking and crop tools become essential. The user-flagged 'swap code for
// image' → 'swap mesh for image' preserves all behavior code; the renderer
// just falls back to a flat texture from the FLUX.2 image."
//
// Operates on the canonical PrismNode shape (additive renderer-migration
// fields per spec §4). All operations are non-mutating; callers receive a
// fresh node tree to feed back into the editor's source store.

import type {
  PrismLayer,
  PrismNode,
  PrismVisual,
  PrismVisualSpec,
  RenderMode,
} from './types.ts';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MaskSpec {
  shape: string;
  radius?: number;
  [k: string]: unknown;
}

export interface SwapMeshForImageOptions {
  /** Default 'sprite' — the spec calls for "a flat texture from the FLUX.2
   *  image", which in this repo's render-mode taxonomy is 'sprite'. */
  fallbackRenderMode?: Exclude<RenderMode, 'mesh' | 'parallax-plane'>;
}

function cloneNode(node: PrismNode): PrismNode {
  return JSON.parse(JSON.stringify(node)) as PrismNode;
}

export function swapMeshForImage(
  node: PrismNode,
  opts: SwapMeshForImageOptions = {},
): PrismNode {
  const fallback: RenderMode = opts.fallbackRenderMode ?? 'sprite';
  const next = cloneNode(node);
  next.renderMode = fallback;
  next.meshUrl = null;
  return next;
}

export function applyCrop(node: PrismNode, crop: CropRect): PrismNode {
  if (crop.width < 0 || crop.height < 0) return node;
  const next = cloneNode(node);
  const v: PrismVisual = next.visual;
  v.transform = {
    x: crop.x,
    y: crop.y,
    width: crop.width,
    height: crop.height,
    z: v.transform.z,
  };
  return next;
}

export function applyMaskRefinement(
  node: PrismNode,
  layerId: string,
  mask: MaskSpec,
): PrismNode {
  const target = node.intent.visualSpec.layers.find((l) => l.id === layerId);
  if (!target) return node;
  const next = cloneNode(node);
  const vs: PrismVisualSpec = next.intent.visualSpec;
  vs.layers = vs.layers.map((l: PrismLayer) =>
    l.id === layerId ? { ...l, mask: { ...mask } } : l,
  );
  return next;
}
