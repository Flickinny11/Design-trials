'use client';

// GEMS (spec §2.1). Faceted transmissive crystals — high IOR, real chromatic
// dispersion (fire), deep saturated attenuation so light pools colour through the
// body. ruby / sapphire / emerald / amethyst / amber / diamond. Reads best on the
// cube/sphere primitives where facet reflections and through-body colour show.

import type { MaterialDef } from '../material-types';

const GEM_BASE = {
  baseColor: '#ffffff',
  metalness: 0,
  roughness: 0.02,
  transmission: 1,
  clearcoat: 0.6,
  clearcoatRoughness: 0.06,
  envMapIntensity: 1.2,
  specularIntensity: 1,
} as const;

export const GEMS: MaterialDef[] = [
  {
    id: 'gem.ruby',
    family: 'Gems',
    label: 'Ruby',
    params: { ...GEM_BASE, ior: 1.77, dispersion: 2.2, thickness: 0.9, attenuationColor: '#9c0f2e', attenuationDistance: 0.45 },
    swatchTint: '#c41e45',
  },
  {
    id: 'gem.sapphire',
    family: 'Gems',
    label: 'Sapphire',
    params: { ...GEM_BASE, ior: 1.77, dispersion: 2.0, thickness: 0.9, attenuationColor: '#11357f', attenuationDistance: 0.5 },
    swatchTint: '#2a55b5',
  },
  {
    id: 'gem.emerald',
    family: 'Gems',
    label: 'Emerald',
    params: { ...GEM_BASE, ior: 1.58, dispersion: 1.4, thickness: 0.9, attenuationColor: '#0d6b46', attenuationDistance: 0.5 },
    swatchTint: '#1f9466',
  },
  {
    id: 'gem.amethyst',
    family: 'Gems',
    label: 'Amethyst',
    params: { ...GEM_BASE, ior: 1.55, dispersion: 1.6, thickness: 0.9, attenuationColor: '#6a2f9c', attenuationDistance: 0.55 },
    swatchTint: '#8a4fc4',
  },
  {
    id: 'gem.amber',
    family: 'Gems',
    label: 'Amber',
    params: { ...GEM_BASE, ior: 1.55, roughness: 0.06, dispersion: 0.8, thickness: 1.1, clearcoat: 0.4, attenuationColor: '#a85a14', attenuationDistance: 0.7 },
    swatchTint: '#d2842a',
  },
  {
    id: 'gem.diamond',
    family: 'Gems',
    label: 'Diamond',
    params: { ...GEM_BASE, ior: 2.42, dispersion: 4.5, thickness: 0.8, attenuationColor: '#f2f6ff', attenuationDistance: 2.5, envMapIntensity: 1.35 },
    swatchTint: '#dbe7f5',
  },
  {
    id: 'gem.citrine',
    family: 'Gems',
    label: 'Citrine',
    params: { ...GEM_BASE, ior: 1.55, dispersion: 1.5, thickness: 0.9, attenuationColor: '#c8861a', attenuationDistance: 0.6 },
    swatchTint: '#e0a734',
  },
];
