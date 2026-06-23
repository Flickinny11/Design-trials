'use client';

// Chassis material factory. Builds the per-button stone/metal material props.
//
// Stones (Carrara, onyx, malachite) read photoreal from a real FLUX-generated
// albedo (veining/banding) map + a faint derived normal, polished with a clearcoat
// and reflecting the studio environment. Metals (brass, brushed steel, copper) are
// genuine PBR: metalness 1, correct hue, tuned roughness, brushed streak via
// anisotropy, high envMapIntensity. Until the albedo maps are present the stones
// fall back to a tuned procedural base color (so the scene always renders).

import * as THREE from 'three';
import type { ChassisButton } from './chassis-config';

// Tuned base colors for the stones (used as the procedural fallback AND as a
// subtle multiply over the albedo so each reads in its true family).
export const STONE_BASE: Record<string, string> = {
  carrara: '#efeae2', // warm white
  onyx: '#1a1a1f', // deep near-black
  malachite: '#1f7a5a', // rich emerald
};

export interface StoneMaps {
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
}

/** Apply stone material params to a MeshPhysicalMaterial. */
export function applyStoneMaterial(mat: THREE.MeshPhysicalMaterial, btn: ChassisButton, maps?: StoneMaps) {
  const base = STONE_BASE[btn.textureKey ?? ''] ?? '#cccccc';
  if (maps?.map) {
    mat.map = maps.map;
    mat.color = new THREE.Color('#ffffff');
  } else {
    mat.color = new THREE.Color(base);
  }
  if (maps?.normalMap) {
    mat.normalMap = maps.normalMap;
    mat.normalScale = new THREE.Vector2(0.35, 0.35);
  }
  mat.metalness = 0;
  mat.roughness = btn.id === 'onyx' ? 0.08 : 0.22; // polished; onyx is glassiest
  mat.clearcoat = 1;
  mat.clearcoatRoughness = 0.06;
  mat.envMapIntensity = 1.15;
  mat.needsUpdate = true;
}

/** Apply metal material params to a MeshPhysicalMaterial. */
export function applyMetalMaterial(mat: THREE.MeshPhysicalMaterial, btn: ChassisButton, streakMap?: THREE.Texture) {
  mat.color = new THREE.Color(btn.color ?? '#b08d57');
  mat.metalness = 1;
  mat.roughness = btn.roughness ?? 0.3;
  mat.clearcoat = 0.25;
  mat.clearcoatRoughness = 0.4;
  mat.envMapIntensity = 1.7;
  // Brushed streak: anisotropic highlight + a fine directional roughness map.
  if (btn.anisotropy && btn.anisotropy > 0) {
    mat.anisotropy = btn.anisotropy;
    mat.anisotropyRotation = Math.PI / 2; // streak runs vertically across the face
    if (streakMap) {
      mat.roughnessMap = streakMap;
      mat.anisotropyMap = streakMap;
    }
  }
  mat.needsUpdate = true;
}
