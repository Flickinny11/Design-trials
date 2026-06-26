'use client';

// STONES (spec §2.1). Real mineral surfaces under the shared studio HDRI/IBL —
// polished slabs vs. raw matte rock. The two physical levers that separate stone
// from "glossy plastic" (F-4):
//   • POLISHED stones (marble / onyx / malachite / lapis) carry a thin clear
//     lacquer coat (clearcoat + low clearcoatRoughness) over a fairly smooth body
//     and full envMapIntensity — the wet, gallery-floor sheen.
//   • RAW stones (granite / travertine / slate) are matte: high roughness, NO
//     clearcoat, and a dialled-down envMapIntensity so they read as dry rock that
//     drinks light instead of bouncing it.
//   • TRANSLUCENT stones (alabaster / jade) get modest transmission (0.3–0.6) +
//     attenuation so light visibly soaks a few mm into the body and tints —
//     never full glass, never opaque.
// baseColor is diffuse albedo; metalness 0 throughout (minerals are dielectric).

import type { MaterialDef } from '../material-types';

export const STONES: MaterialDef[] = [
  {
    id: 'stone.marble-white',
    family: 'Stones',
    label: 'White Marble',
    // Carrara: a touch of transmission + attenuation fakes the milky
    // sub-surface that makes veined marble glow rather than look like paint;
    // clearcoat is the honed-then-polished gallery floor.
    params: { baseColor: '#eceae4', metalness: 0, roughness: 0.28, transmission: 0.12, ior: 1.48, thickness: 0.35, attenuationColor: '#d9d4c8', attenuationDistance: 0.9, clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 1.0 },
    swatchTint: '#e6e3db',
  },
  {
    id: 'stone.marble-grey',
    family: 'Stones',
    label: 'Grey Marble',
    params: { baseColor: '#b7b9bd', metalness: 0, roughness: 0.32, transmission: 0.08, ior: 1.48, thickness: 0.3, attenuationColor: '#9aa0a8', attenuationDistance: 0.8, clearcoat: 0.55, clearcoatRoughness: 0.2, envMapIntensity: 0.95 },
    swatchTint: '#aeb0b4',
  },
  {
    id: 'stone.onyx-black',
    family: 'Stones',
    label: 'Black Onyx',
    // Glassy, near-opaque: a hair of transmission so deep light barely
    // penetrates and saturates to ink; high clearcoat for the wet sheen.
    params: { baseColor: '#15161a', metalness: 0, roughness: 0.1, transmission: 0.18, ior: 1.5, thickness: 0.6, attenuationColor: '#050608', attenuationDistance: 0.18, clearcoat: 0.9, clearcoatRoughness: 0.08, envMapIntensity: 1.15 },
    swatchTint: '#1b1c20',
  },
  {
    id: 'stone.malachite',
    family: 'Stones',
    label: 'Malachite',
    // Banded green copper-carbonate; polished to a deep wet shine.
    params: { baseColor: '#127a55', metalness: 0, roughness: 0.16, transmission: 0.06, ior: 1.66, thickness: 0.3, attenuationColor: '#0a4f37', attenuationDistance: 0.4, clearcoat: 0.85, clearcoatRoughness: 0.1, envMapIntensity: 1.1 },
    swatchTint: '#178a61',
  },
  {
    id: 'stone.lapis-lazuli',
    family: 'Stones',
    label: 'Lapis Lazuli',
    // Deep ultramarine mineral with pyrite fleck; modest specular punch from
    // those metallic inclusions, polished coat over a fairly smooth body.
    params: { baseColor: '#1f3f8f', metalness: 0, roughness: 0.24, ior: 1.5, clearcoat: 0.7, clearcoatRoughness: 0.14, specularIntensity: 0.85, envMapIntensity: 1.05 },
    swatchTint: '#26489c',
  },
  {
    id: 'stone.granite',
    family: 'Stones',
    label: 'Speckled Granite',
    // Raw flamed granite: matte, dry, no coat, dialled-down reflections.
    params: { baseColor: '#74767a', metalness: 0, roughness: 0.82, ior: 1.5, envMapIntensity: 0.55, normalScale: 1.1 },
    swatchTint: '#74767a',
  },
  {
    id: 'stone.travertine',
    family: 'Stones',
    label: 'Travertine',
    // Warm porous limestone; matte and thirsty for light, faint coat to hint
    // at a honed-but-unsealed finish.
    params: { baseColor: '#c8b393', metalness: 0, roughness: 0.74, ior: 1.5, clearcoat: 0.12, clearcoatRoughness: 0.7, envMapIntensity: 0.6, normalScale: 1.0 },
    swatchTint: '#c8b393',
  },
  {
    id: 'stone.slate',
    family: 'Stones',
    label: 'Blue Slate',
    // Dark blue-grey cleaved rock; matte with a slate-flat sheen, low envmap.
    params: { baseColor: '#3a444e', metalness: 0, roughness: 0.66, ior: 1.5, clearcoat: 0.08, clearcoatRoughness: 0.6, envMapIntensity: 0.5, normalScale: 1.2 },
    swatchTint: '#3f4a55',
  },
  {
    id: 'stone.alabaster',
    family: 'Stones',
    label: 'Alabaster',
    // Translucent gypsum: real transmission + warm attenuation so light soaks
    // in and glows; soft satin coat, never glassy-clear.
    params: { baseColor: '#f2ece0', metalness: 0, roughness: 0.4, transmission: 0.45, ior: 1.5, thickness: 1.1, attenuationColor: '#e3d3b6', attenuationDistance: 0.7, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.9 },
    swatchTint: '#ece2d0',
  },
  {
    id: 'stone.jade',
    family: 'Stones',
    label: 'Imperial Jade',
    // Translucent nephrite: deeper green transmission + tight attenuation for
    // that lit-from-within imperial-jade depth; high-polish wet coat.
    params: { baseColor: '#3f9b6f', metalness: 0, roughness: 0.18, transmission: 0.55, ior: 1.66, thickness: 1.2, attenuationColor: '#1f6e44', attenuationDistance: 0.5, clearcoat: 0.75, clearcoatRoughness: 0.1, envMapIntensity: 1.05 },
    swatchTint: '#3f9b6f',
  },
];
