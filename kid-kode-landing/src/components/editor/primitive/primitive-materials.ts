'use client';

// PRISM PRIMITIVE SYSTEM — the material skin (spec §2).
//
// P-1 ships the founder-APPROVED chassis material set so every primitive MATCHES
// /toolbar-chassis + /keyframe-editor by construction:
//   • glass-*  → the GlassPane transmission look (real refraction off the shared
//                studio IBL, faint smoke tint) — clear / smoke / tinted variants.
//   • worn-*   → applyWornMaterial + the 5 generated jewel-tone PBR sets
//                (emerald/sapphire/bronze/oxblood/gunmetal) — worn brushed alloy,
//                never glossy plastic (F-4).
// Real PBR + transmission + clearcoat under ONE shared HDRI/IBL (spec §2.2).

import * as THREE from 'three';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import { isGlass, WORN_KEY, type PrimitiveMaterial } from './primitive-schema';

// Re-export the chassis worn-map loader so the lab scene streams the SAME sets.
export { useWornMaps } from '@/components/editor/chassis/materials';

// Build a fresh MeshPhysicalMaterial for a primitive material descriptor. The
// caller owns disposal (useMemo + cleanup). `wornMaps` is the loaded record from
// useWornMaps(); glass kinds ignore it.
export function buildPrimitiveMaterial(
  m: PrimitiveMaterial,
  wornMaps: Record<string, WornMaps>,
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial();
  const k = Math.max(0.5, Math.min(1.5, m.contrast));

  if (isGlass(m.kind)) {
    mat.transmission = 1;
    mat.thickness = 0.7;
    mat.ior = 1.5;
    mat.roughness = 0.05 * k;
    mat.metalness = 0;
    mat.clearcoat = 1;
    mat.clearcoatRoughness = 0.17 * k;
    mat.envMapIntensity = 1.05;
    mat.specularIntensity = 0.7;
    mat.transparent = true;
    mat.color = new THREE.Color('#ffffff');
    mat.attenuationColor = new THREE.Color(m.tint);
    // clear → far attenuation (barely tinted); smoke → near (deep smoke);
    // tinted → mid with a saturated attenuation color.
    mat.attenuationDistance =
      m.kind === 'glass-smoke' ? 0.55 : m.kind === 'glass-tinted' ? 1.1 : 1.8;
    mat.needsUpdate = true;
    return mat;
  }

  // worn alloy
  const key = WORN_KEY[m.kind] ?? 'gunmetal';
  const maps = wornMaps[key];
  if (maps) applyWornMaterial(mat, maps);
  // contrast pushes the satin polish: lower roughness floor + a touch more clearcoat.
  mat.roughness = 1; // map carries the range
  mat.clearcoat = 0.08 * k;
  mat.envMapIntensity = 0.95;
  // optional tint over the baked jewel-tone albedo (white = no tint).
  if (m.tint && m.tint.toLowerCase() !== '#ffffff') {
    mat.color = new THREE.Color(m.tint);
  } else {
    mat.color = new THREE.Color('#ffffff');
  }
  mat.needsUpdate = true;
  return mat;
}
