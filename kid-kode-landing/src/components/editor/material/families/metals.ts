'use client';

// METALS (spec §2.1). Two kinds:
//  • WORN SEEDS — the 5 committed chassis-worn jewel-tone alloys, referencing the
//    baked PBR sets so they match /toolbar-chassis exactly (the aesthetic bar).
//  • ANALYTIC ALLOYS — pure-param metals (brass/steel/copper/gold/titanium/
//    chrome/gunmetal + aged variants). metalness≈1, the baseColor is the specular
//    F0 tint, roughness sets polish, a whisper of clearcoat + anisotropy reads as
//    brushed/satin — never glossy plastic (F-4).

import type { MaterialDef } from '../material-types';

// brushed directional grain shared by polished alloys.
const ANISO = { anisotropy: 0.35, anisotropyRotation: Math.PI / 2 };

export const METALS: MaterialDef[] = [
  // ── worn jewel-tone seeds (textured) ──
  {
    id: 'metal.worn-emerald',
    family: 'Metals',
    label: 'Worn Emerald',
    params: { baseColor: '#ffffff', metalness: 1, roughness: 1, clearcoat: 0.08, clearcoatRoughness: 0.65, envMapIntensity: 0.95, normalScale: 1.35, anisotropy: 0.4, anisotropyRotation: Math.PI / 2 },
    maps: { source: 'worn', wornKey: 'emerald', repeat: [1, 1] },
    swatchTint: '#2f9e74',
  },
  {
    id: 'metal.worn-sapphire',
    family: 'Metals',
    label: 'Worn Sapphire',
    params: { baseColor: '#ffffff', metalness: 1, roughness: 1, clearcoat: 0.08, clearcoatRoughness: 0.65, envMapIntensity: 0.95, normalScale: 1.35, anisotropy: 0.4, anisotropyRotation: Math.PI / 2 },
    maps: { source: 'worn', wornKey: 'sapphire', repeat: [1, 1] },
    swatchTint: '#3f6fd6',
  },
  {
    id: 'metal.worn-bronze',
    family: 'Metals',
    label: 'Aged Bronze',
    params: { baseColor: '#ffffff', metalness: 1, roughness: 1, clearcoat: 0.08, clearcoatRoughness: 0.65, envMapIntensity: 0.95, normalScale: 1.35, anisotropy: 0.4, anisotropyRotation: Math.PI / 2 },
    maps: { source: 'worn', wornKey: 'bronze', repeat: [1, 1] },
    swatchTint: '#b07a36',
  },
  {
    id: 'metal.worn-oxblood',
    family: 'Metals',
    label: 'Oxblood Alloy',
    params: { baseColor: '#ffffff', metalness: 1, roughness: 1, clearcoat: 0.08, clearcoatRoughness: 0.65, envMapIntensity: 0.95, normalScale: 1.35, anisotropy: 0.4, anisotropyRotation: Math.PI / 2 },
    maps: { source: 'worn', wornKey: 'oxblood', repeat: [1, 1] },
    swatchTint: '#9c3447',
  },
  {
    id: 'metal.worn-gunmetal',
    family: 'Metals',
    label: 'Gunmetal',
    params: { baseColor: '#ffffff', metalness: 1, roughness: 1, clearcoat: 0.08, clearcoatRoughness: 0.65, envMapIntensity: 0.95, normalScale: 1.35, anisotropy: 0.4, anisotropyRotation: Math.PI / 2 },
    maps: { source: 'worn', wornKey: 'gunmetal', repeat: [1, 1] },
    swatchTint: '#6b727c',
  },

  // ── analytic alloys (pure-param) ──
  {
    id: 'metal.gold',
    family: 'Metals',
    label: 'Polished Gold',
    params: { baseColor: '#e6b64d', metalness: 1, roughness: 0.22, clearcoat: 0.18, clearcoatRoughness: 0.25, envMapIntensity: 1.05, ...ANISO },
  },
  {
    id: 'metal.brass',
    family: 'Metals',
    label: 'Brushed Brass',
    params: { baseColor: '#c9a85e', metalness: 1, roughness: 0.34, clearcoat: 0.1, clearcoatRoughness: 0.5, envMapIntensity: 1.0, anisotropy: 0.55, anisotropyRotation: Math.PI / 2 },
  },
  {
    id: 'metal.copper',
    family: 'Metals',
    label: 'Copper',
    params: { baseColor: '#c4795a', metalness: 1, roughness: 0.3, clearcoat: 0.12, clearcoatRoughness: 0.4, envMapIntensity: 1.0, ...ANISO },
  },
  {
    id: 'metal.steel',
    family: 'Metals',
    label: 'Polished Steel',
    params: { baseColor: '#c2c6cd', metalness: 1, roughness: 0.16, clearcoat: 0.1, clearcoatRoughness: 0.2, envMapIntensity: 1.1, ...ANISO },
  },
  {
    id: 'metal.titanium',
    family: 'Metals',
    label: 'Titanium',
    params: { baseColor: '#9a9aa3', metalness: 1, roughness: 0.44, clearcoat: 0.06, clearcoatRoughness: 0.6, envMapIntensity: 0.95, anisotropy: 0.5, anisotropyRotation: Math.PI / 2 },
  },
  {
    id: 'metal.chrome',
    family: 'Metals',
    label: 'Chrome',
    params: { baseColor: '#e9ebef', metalness: 1, roughness: 0.045, clearcoat: 0.4, clearcoatRoughness: 0.05, envMapIntensity: 1.25 },
  },
  {
    id: 'metal.gunmetal-clean',
    family: 'Metals',
    label: 'Graphite Gunmetal',
    params: { baseColor: '#5b6068', metalness: 1, roughness: 0.4, clearcoat: 0.08, clearcoatRoughness: 0.55, envMapIntensity: 0.9, ...ANISO },
  },
  {
    id: 'metal.rose-gold',
    family: 'Metals',
    label: 'Rose Gold',
    params: { baseColor: '#d99878', metalness: 1, roughness: 0.24, clearcoat: 0.16, clearcoatRoughness: 0.28, envMapIntensity: 1.05, ...ANISO },
  },
];
