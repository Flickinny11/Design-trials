'use client';

// PRISM PRIMITIVE SYSTEM — P-6 — tile preview helpers.
//
// Preview-only schema/material factories for the palette tiles. Previews must NOT
// consume the real id counters (they are not instantiated nodes), so we build a
// throwaway schema with a fixed id rather than calling the minting makeSchema.

import * as THREE from 'three';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import type { PrimitiveKind, PrimitiveSchema } from '@/components/editor/primitive/primitive-schema';

const DEFAULT_PARAMS = {
  pane: { width: 3.2, height: 2.2, depth: 0.4, cornerRadius: 0.34, bevel: 0.05, radius: 0.38, segments: 24, cutouts: [] },
  cube: { width: 1.4, height: 1.4, depth: 1.4, cornerRadius: 0.16, bevel: 0.05, radius: 0.38, segments: 6, cutouts: [] },
  sphere: { width: 1.4, height: 1.4, depth: 1.4, cornerRadius: 0.16, bevel: 0.05, radius: 0.9, segments: 48, cutouts: [] },
} as const;

const DEFAULT_MAT = {
  pane: { kind: 'glass-clear' as const, tint: '#dbe8f2', contrast: 1 },
  cube: { kind: 'worn-sapphire' as const, tint: '#ffffff', contrast: 1 },
  sphere: { kind: 'worn-bronze' as const, tint: '#ffffff', contrast: 1 },
};

// A fixed-id preview schema (no id minting — previews are not nodes).
export function makeSchema(kind: PrimitiveKind): PrimitiveSchema {
  return {
    nodeId: `preview-${kind}`,
    kind,
    caption: kind,
    params: { ...DEFAULT_PARAMS[kind], cutouts: [] },
    material: { ...DEFAULT_MAT[kind] },
    transform: { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 },
  };
}

// Fallback worn material when a registry material id can't be resolved.
export function defaultMaterialPreview(wornMaps: Record<string, WornMaps>): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial();
  if (wornMaps.sapphire) applyWornMaterial(m, wornMaps.sapphire);
  return m;
}
