'use client';

/**
 * Ceramics — Prism material family.
 *
 * Fired clay and glaze, authored as analytic MeshPhysicalMaterial parameters
 * for a studio HDRI + AgX pipeline. The family spans the two physical poles of
 * ceramic surfacing:
 *
 *   - GLAZED bodies (porcelain, celadon, cobalt, raku, bone china, black-glaze):
 *     a vitreous glass coat over an opaque clay body. Modelled as a low-roughness
 *     dielectric body wearing a clearcoat (0.6–1.0) with low clearcoatRoughness —
 *     the coat is the wet, reflective skin; the body color sits beneath it.
 *   - UNGLAZED bodies (terracotta, stoneware): bare fired clay. No clearcoat,
 *     high roughness, low envMapIntensity — light scatters in the porous surface
 *     rather than reflecting off it, so these read matte and dry, never plastic.
 *
 * Bone china carries a faint transmission to fake the famous sub-surface glow of
 * a thin-walled translucent body; the warm attenuation keeps it ivory, not blue.
 * All dielectric (metalness 0). No metalness, no dispersion — these are clay.
 */

import type { MaterialDef } from '../material-types';

export const CERAMICS: MaterialDef[] = [
  {
    id: 'ceramic.porcelain',
    family: 'Ceramics',
    label: 'Glazed Porcelain',
    params: {
      baseColor: '#f4f1ea',
      metalness: 0,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      specularIntensity: 1,
      envMapIntensity: 1.1,
    },
    swatchTint: '#f4f1ea',
  },
  {
    id: 'ceramic.bone-china',
    family: 'Ceramics',
    label: 'Bone China',
    params: {
      baseColor: '#f6efe2',
      metalness: 0,
      roughness: 0.3,
      transmission: 0.18,
      ior: 1.49,
      thickness: 0.4,
      attenuationColor: '#e7d6b8',
      attenuationDistance: 1.2,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
      specularIntensity: 1,
      envMapIntensity: 1.05,
    },
    swatchTint: '#f3e9d6',
  },
  {
    id: 'ceramic.celadon',
    family: 'Ceramics',
    label: 'Celadon Glaze',
    params: {
      baseColor: '#bcd6c4',
      metalness: 0,
      roughness: 0.28,
      transmission: 0.1,
      ior: 1.5,
      thickness: 0.5,
      attenuationColor: '#8fb6a0',
      attenuationDistance: 1,
      clearcoat: 0.9,
      clearcoatRoughness: 0.07,
      envMapIntensity: 1.1,
    },
    swatchTint: '#a6c9b3',
  },
  {
    id: 'ceramic.cobalt-glaze',
    family: 'Ceramics',
    label: 'Cobalt Glaze',
    params: {
      baseColor: '#1f3f8f',
      metalness: 0,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      specularIntensity: 1,
      envMapIntensity: 1.2,
    },
    swatchTint: '#26489c',
  },
  {
    id: 'ceramic.raku-crackle',
    family: 'Ceramics',
    label: 'Raku Crackle',
    params: {
      baseColor: '#23211e',
      metalness: 0,
      roughness: 0.45,
      clearcoat: 0.7,
      clearcoatRoughness: 0.22,
      envMapIntensity: 0.85,
      wear: 0.5,
    },
    swatchTint: '#2b2825',
  },
  {
    id: 'ceramic.black-glaze',
    family: 'Ceramics',
    label: 'Black Glaze',
    params: {
      baseColor: '#0e0e10',
      metalness: 0,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      specularIntensity: 1,
      envMapIntensity: 1.25,
    },
    swatchTint: '#161618',
  },
  {
    id: 'ceramic.terracotta',
    family: 'Ceramics',
    label: 'Matte Terracotta',
    params: {
      baseColor: '#a8542f',
      metalness: 0,
      roughness: 0.82,
      specularIntensity: 0.35,
      envMapIntensity: 0.45,
      wear: 0.3,
    },
    swatchTint: '#a8542f',
  },
  {
    id: 'ceramic.stoneware',
    family: 'Ceramics',
    label: 'Unglazed Stoneware',
    params: {
      baseColor: '#8d8a82',
      metalness: 0,
      roughness: 0.88,
      specularIntensity: 0.3,
      envMapIntensity: 0.4,
      wear: 0.35,
    },
    swatchTint: '#8d8a82',
  },
];
