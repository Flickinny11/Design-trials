'use client';

// GENERATED (spec §2.4) — prompt-to-texture materials. Each is a matched-latent +
// delit PBR set produced by the committed FLUX pipeline (.assetgen/gen-material.sh
// -> derive-material-pbr.mjs): albedo/normal/rough/metal/ao ALL derived from ONE
// generated plate (matched latent), with lighting divided out of the albedo
// (delit). These three SEEDS shipped real (committed under
// /prism-mock/editor/textures/generated/<id>/); LIVE generations register at
// runtime via registerGeneratedMaterial() and load their maps imperatively.

import type { MaterialDef } from '../material-types';

const GEN_DIR = '/prism-mock/editor/textures/generated';

export const GENERATED_SEED: MaterialDef[] = [
  {
    id: 'generated.brushed-copper',
    family: 'Generated',
    label: 'Brushed Copper',
    params: { baseColor: '#ffffff', metalness: 1, roughness: 1, clearcoat: 0.08, clearcoatRoughness: 0.55, normalScale: 1.1, envMapIntensity: 0.98, anisotropy: 0.35, anisotropyRotation: Math.PI / 2 },
    maps: { source: 'generated', dir: `${GEN_DIR}/brushed-copper`, repeat: [1.5, 1.5] },
    swatchTint: '#b5734f',
  },
  {
    id: 'generated.carrara-marble',
    family: 'Generated',
    label: 'Carrara Marble',
    params: { baseColor: '#ffffff', metalness: 0, roughness: 1, clearcoat: 0.5, clearcoatRoughness: 0.2, normalScale: 0.8, envMapIntensity: 0.95 },
    maps: { source: 'generated', dir: `${GEN_DIR}/carrara-marble`, repeat: [1.25, 1.25] },
    swatchTint: '#e9e6df',
  },
  {
    id: 'generated.walnut-grain',
    family: 'Generated',
    label: 'Walnut Grain',
    params: { baseColor: '#ffffff', metalness: 0, roughness: 1, clearcoat: 0.28, clearcoatRoughness: 0.35, normalScale: 1.0, envMapIntensity: 0.82 },
    maps: { source: 'generated', dir: `${GEN_DIR}/walnut-grain`, repeat: [1.4, 1.4] },
    swatchTint: '#6b4a30',
  },
];
