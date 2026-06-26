'use client';

// FABRICS (spec §2.1). Cloth & leather — SHEEN is the defining parameter: the
// retro-reflective rim glow that reads as woven fibre or napped pile rather than
// glossy plastic. Pure dielectric (metalness 0), kept matte-to-soft (roughness
// 0.55–0.95) so no surface ever looks wet or toy-like under the studio HDRI/AgX.
//   • velvet/silk — strong directional sheen, warm or near-white sheenColor.
//   • felt/linen/denim — matte body, faint diffuse sheen on the fibre tips.
//   • suede — soft napped sheen, no specular.
//   • leather (black/oxblood) — semi-gloss with a thin clearcoat for the worn
//     grain, low broad sheen so the hide still reads as skin not vinyl.
// sheenColor lifts the rim toward the light's warmth; sheenRoughness widens
// (matte) or tightens (satin) that rim band. No transmission, no metalness.

import type { MaterialDef } from '../material-types';

// shared cloth substrate: pure dielectric, low IBL so the body stays matte and
// the sheen rim does the lifting (envMapIntensity high washes cloth to plastic).
const CLOTH_BASE = {
  metalness: 0,
  envMapIntensity: 0.55,
  specularIntensity: 0.4,
} as const;

export const FABRICS: MaterialDef[] = [
  {
    id: 'fabric.velvet-red',
    family: 'Fabrics',
    label: 'Red Velvet',
    params: { ...CLOTH_BASE, baseColor: '#7a1220', roughness: 0.92, sheen: 1, sheenRoughness: 0.45, sheenColor: '#d98a6a', specularIntensity: 0.3 },
    swatchTint: '#9c1f30',
  },
  {
    id: 'fabric.velvet-emerald',
    family: 'Fabrics',
    label: 'Emerald Velvet',
    params: { ...CLOTH_BASE, baseColor: '#0f3a2c', roughness: 0.92, sheen: 0.95, sheenRoughness: 0.5, sheenColor: '#5fb98e', specularIntensity: 0.3 },
    swatchTint: '#1c6b4d',
  },
  {
    id: 'fabric.felt-navy',
    family: 'Fabrics',
    label: 'Navy Felt',
    params: { ...CLOTH_BASE, baseColor: '#1b2740', roughness: 0.95, sheen: 0.5, sheenRoughness: 0.85, sheenColor: '#3a4a6b', envMapIntensity: 0.4, specularIntensity: 0.25 },
    swatchTint: '#28385c',
  },
  {
    id: 'fabric.linen-raw',
    family: 'Fabrics',
    label: 'Raw Linen',
    params: { ...CLOTH_BASE, baseColor: '#cabb9c', roughness: 0.9, sheen: 0.4, sheenRoughness: 0.8, sheenColor: '#e8dcc0', envMapIntensity: 0.45, normalScale: 0.6 },
    swatchTint: '#c5b591',
  },
  {
    id: 'fabric.suede-tan',
    family: 'Fabrics',
    label: 'Tan Suede',
    params: { ...CLOTH_BASE, baseColor: '#9a6b3f', roughness: 0.88, sheen: 0.7, sheenRoughness: 0.6, sheenColor: '#caa074', envMapIntensity: 0.4, specularIntensity: 0.2 },
    swatchTint: '#a9763f',
  },
  {
    id: 'fabric.leather-black',
    family: 'Fabrics',
    label: 'Black Leather',
    params: { ...CLOTH_BASE, baseColor: '#14110f', roughness: 0.55, sheen: 0.3, sheenRoughness: 0.5, sheenColor: '#5a544e', clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.7, normalScale: 0.8 },
    swatchTint: '#26211d',
  },
  {
    id: 'fabric.leather-oxblood',
    family: 'Fabrics',
    label: 'Oxblood Leather',
    params: { ...CLOTH_BASE, baseColor: '#3f1418', roughness: 0.58, sheen: 0.32, sheenRoughness: 0.5, sheenColor: '#8a4a3c', clearcoat: 0.38, clearcoatRoughness: 0.38, envMapIntensity: 0.7, normalScale: 0.8 },
    swatchTint: '#5e2024',
  },
  {
    id: 'fabric.denim-blue',
    family: 'Fabrics',
    label: 'Blue Denim',
    params: { ...CLOTH_BASE, baseColor: '#2f4a6b', roughness: 0.9, sheen: 0.45, sheenRoughness: 0.75, sheenColor: '#7a93b3', envMapIntensity: 0.45, normalScale: 0.7 },
    swatchTint: '#3a597f',
  },
  {
    id: 'fabric.silk-champagne',
    family: 'Fabrics',
    label: 'Champagne Silk',
    params: { ...CLOTH_BASE, baseColor: '#c9b58a', roughness: 0.55, sheen: 1, sheenRoughness: 0.3, sheenColor: '#f5ecd8', envMapIntensity: 0.75, specularIntensity: 0.6 },
    swatchTint: '#cdba8e',
  },
];
