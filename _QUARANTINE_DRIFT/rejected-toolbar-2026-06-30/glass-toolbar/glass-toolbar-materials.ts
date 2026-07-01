'use client';

// Glass-toolbar material vocabulary — premium, photoreal, NO glassmorphism.
// All materials are real THREE PBR (MeshPhysicalMaterial / emissive Standard),
// lit by the local studio IBL (StudioEnv) so they read as real metal/glass/gem.
//
// Palette anchors to the Prism DS: per-section jewel-tone anodized metal for icon
// bodies, an arc-cyan emissive for energy accents (blooms when toneMapped:false),
// chrome for tool heads, and a faintly-tinted clear transmission glass for the
// cube buttons + pane.

import * as THREE from 'three';

export const ARC_CYAN = '#1ec8ff';
export const WARN_AMBER = '#ff8c1e';

/** Anodized colored metal — the primary icon body finish (section jewel-tone).
 *  A faint same-color emissive lifts the body so the icon reads through the
 *  glass cube without bloomy artifacts. */
export function makeAnodized(color: string): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.9,
    roughness: 0.22,
    clearcoat: 0.6,
    clearcoatRoughness: 0.28,
    envMapIntensity: 1.35,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.45,
  });
}

/** Polished chrome — tool heads / precision parts. A whisper of cool-white
 *  emissive so the chrome shows through the glass even with soft env light. */
export function makeChrome(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: '#e6e9ee',
    metalness: 1,
    roughness: 0.08,
    envMapIntensity: 1.55,
    emissive: new THREE.Color('#cfd8e6'),
    emissiveIntensity: 0.18,
  });
}

/** Arc-cyan (or given) emissive — energy accents. toneMapped:false → blooms. */
export function makeEmissive(color: string = ARC_CYAN, intensity = 2.2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    toneMapped: false,
    roughness: 0.3,
    metalness: 0.2,
  });
}

/** Faceted gem — transmissive jewel with iridescence + a faint inner glow. */
export function makeGem(color: string): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.02,
    transmission: 0.65,
    thickness: 0.35,
    ior: 1.7,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    iridescence: 0.45,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [120, 520],
    envMapIntensity: 1.4,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.22,
    transparent: true,
  });
}

/**
 * Clear glass for the cube buttons — real refraction off the studio env (NOT a
 * per-instance render target, so 14 cubes stay fast). A whisper of the section
 * color in the attenuation so each button carries its category's hue without
 * becoming opaque. The built-in transmission shares the renderer's single
 * transmission pass, so the bespoke icon inside each cube reads through the glass.
 */
export function makeButtonGlass(tint: string): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    transmission: 1,
    thickness: 0.45,
    ior: 1.46,
    roughness: 0.05,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
    attenuationColor: new THREE.Color(tint),
    attenuationDistance: 2.6,
    envMapIntensity: 1.1,
    specularIntensity: 0.8,
    transparent: true,
  });
}
