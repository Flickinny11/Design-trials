// T08 — Editor image-edit tools (mask refinement, crop, swap-mesh-for-image).
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L483.
//
// Stub — populated during implementation phase.

import type { PrismLayer, PrismNode, RenderMode } from './types.ts';

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
  fallbackRenderMode?: Exclude<RenderMode, 'mesh' | 'parallax-plane'>;
}

export function swapMeshForImage(node: PrismNode, _opts: SwapMeshForImageOptions = {}): PrismNode {
  return node;
}

export function applyCrop(node: PrismNode, _crop: CropRect): PrismNode {
  return node;
}

export function applyMaskRefinement(node: PrismNode, _layerId: string, _mask: MaskSpec): PrismNode {
  // Reference unused PrismLayer to retain re-export tooling on stub.
  const _l: PrismLayer | undefined = undefined;
  void _l;
  return node;
}
