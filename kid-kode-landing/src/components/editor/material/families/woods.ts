'use client';

/**
 * Woods family — Prism material library.
 *
 * Eight finished and raw woods spanning the real tonal range: dark warm
 * walnut, mid honey oak, deep red-brown mahogany, near-black satin ebony,
 * pale maple, warm-yellow bamboo, oily mid-brown teak, and grey weathered
 * driftwood. All wood is dielectric (metalness 0) with satin-to-matte
 * roughness (0.45–0.8). Finished/lacquered species (walnut, oak, mahogany,
 * ebony) carry a thin clearcoat for the surface-film sheen of a French-
 * polished or lacquered panel; raw and weathered species (maple, bamboo,
 * teak, driftwood) carry little or none. Driftwood leans on high roughness
 * plus wear for its sun-bleached, eroded look. Tuned to read as real
 * timber under a studio HDRI + AgX tonemap — never glossy plastic.
 */

import type { MaterialDef } from '../material-types';

export const WOODS: MaterialDef[] = [
  {
    id: 'wood.walnut',
    family: 'Woods',
    label: 'Black Walnut',
    params: {
      baseColor: '#4a2f1d',
      metalness: 0,
      roughness: 0.5,
      clearcoat: 0.35,
      clearcoatRoughness: 0.32,
      envMapIntensity: 0.8,
      specularIntensity: 0.7,
      anisotropy: 0.25,
      anisotropyRotation: 0,
      normalScale: 1,
      wear: 0.1,
    },
    swatchTint: '#4a2f1d',
  },
  {
    id: 'wood.oak',
    family: 'Woods',
    label: 'Honey Oak',
    params: {
      baseColor: '#9c6f3f',
      metalness: 0,
      roughness: 0.52,
      clearcoat: 0.3,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.78,
      specularIntensity: 0.65,
      anisotropy: 0.28,
      anisotropyRotation: 0,
      normalScale: 1,
      wear: 0.12,
    },
    swatchTint: '#9c6f3f',
  },
  {
    id: 'wood.mahogany',
    family: 'Woods',
    label: 'Mahogany',
    params: {
      baseColor: '#5c2c1d',
      metalness: 0,
      roughness: 0.46,
      clearcoat: 0.42,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.85,
      specularIntensity: 0.72,
      anisotropy: 0.3,
      anisotropyRotation: 0,
      normalScale: 1,
      wear: 0.08,
    },
    swatchTint: '#6e3522',
  },
  {
    id: 'wood.ebony',
    family: 'Woods',
    label: 'Satin Ebony',
    params: {
      baseColor: '#1c1611',
      metalness: 0,
      roughness: 0.45,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.7,
      specularIntensity: 0.7,
      anisotropy: 0.2,
      anisotropyRotation: 0,
      normalScale: 1,
      wear: 0.06,
    },
    swatchTint: '#241c15',
  },
  {
    id: 'wood.maple',
    family: 'Woods',
    label: 'Pale Maple',
    params: {
      baseColor: '#d8b88a',
      metalness: 0,
      roughness: 0.62,
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.62,
      specularIntensity: 0.5,
      anisotropy: 0.18,
      anisotropyRotation: 0,
      normalScale: 0.85,
      wear: 0.14,
    },
    swatchTint: '#d8b88a',
  },
  {
    id: 'wood.bamboo',
    family: 'Woods',
    label: 'Bamboo',
    params: {
      baseColor: '#c9a45c',
      metalness: 0,
      roughness: 0.58,
      clearcoat: 0.15,
      clearcoatRoughness: 0.45,
      envMapIntensity: 0.66,
      specularIntensity: 0.52,
      anisotropy: 0.32,
      anisotropyRotation: 0,
      normalScale: 0.9,
      wear: 0.1,
    },
    swatchTint: '#c9a45c',
  },
  {
    id: 'wood.teak',
    family: 'Woods',
    label: 'Oiled Teak',
    params: {
      baseColor: '#8a5a33',
      metalness: 0,
      roughness: 0.55,
      clearcoat: 0.18,
      clearcoatRoughness: 0.42,
      envMapIntensity: 0.72,
      specularIntensity: 0.6,
      anisotropy: 0.26,
      anisotropyRotation: 0,
      normalScale: 0.95,
      wear: 0.16,
    },
    swatchTint: '#8a5a33',
  },
  {
    id: 'wood.driftwood',
    family: 'Woods',
    label: 'Weathered Driftwood',
    params: {
      baseColor: '#9a948a',
      metalness: 0,
      roughness: 0.8,
      envMapIntensity: 0.45,
      specularIntensity: 0.35,
      anisotropy: 0.22,
      anisotropyRotation: 0,
      normalScale: 1.2,
      wear: 0.65,
    },
    swatchTint: '#9a948a',
  },
];
