'use client';

// GLASS (spec §2.1). Real transmission glass — the founder-approved GlassPane look
// (transmission 1, ior 1.5, thin clear coat, faint smoke/tint attenuation under the
// shared studio IBL). clear / smoke / frosted / tinted variants. "liquid" is the
// fluid-glass entry-point (P-3 adds flow); here it ships as a thick, slow-IOR slab.

import type { MaterialDef } from '../material-types';

const GLASS_BASE = {
  baseColor: '#ffffff',
  metalness: 0,
  transmission: 1,
  ior: 1.5,
  clearcoat: 1,
  specularIntensity: 0.7,
  envMapIntensity: 1.05,
} as const;

export const GLASSES: MaterialDef[] = [
  {
    id: 'glass.clear',
    family: 'Glass',
    label: 'Clear Glass',
    params: { ...GLASS_BASE, roughness: 0.05, thickness: 0.7, clearcoatRoughness: 0.17, attenuationColor: '#dbe8f2', attenuationDistance: 1.8 },
    swatchTint: '#cfe0ef',
  },
  {
    id: 'glass.smoke',
    family: 'Glass',
    label: 'Smoke Glass',
    params: { ...GLASS_BASE, roughness: 0.07, thickness: 0.9, clearcoatRoughness: 0.2, attenuationColor: '#7b8696', attenuationDistance: 0.55 },
    swatchTint: '#8a94a3',
  },
  {
    id: 'glass.frosted',
    family: 'Glass',
    label: 'Frosted Glass',
    params: { ...GLASS_BASE, roughness: 0.42, thickness: 0.8, clearcoat: 0.5, clearcoatRoughness: 0.5, attenuationColor: '#e6eef6', attenuationDistance: 1.2 },
    swatchTint: '#dce6ef',
  },
  {
    id: 'glass.tinted-blue',
    family: 'Glass',
    label: 'Tinted Azure',
    params: { ...GLASS_BASE, roughness: 0.05, thickness: 1.0, clearcoatRoughness: 0.17, attenuationColor: '#3f8fd6', attenuationDistance: 1.1 },
    swatchTint: '#4f9fe6',
  },
  {
    id: 'glass.tinted-amber',
    family: 'Glass',
    label: 'Tinted Amber',
    params: { ...GLASS_BASE, roughness: 0.06, thickness: 1.0, clearcoatRoughness: 0.18, attenuationColor: '#d68a3f', attenuationDistance: 1.0 },
    swatchTint: '#e6a34f',
  },
  {
    id: 'glass.liquid',
    family: 'Glass',
    label: 'Liquid Glass',
    params: { ...GLASS_BASE, roughness: 0.04, thickness: 1.6, ior: 1.45, dispersion: 1.2, clearcoatRoughness: 0.12, attenuationColor: '#bfe3ea', attenuationDistance: 1.4 },
    swatchTint: '#a9d6df',
  },
];
