'use client';

// Composite member materials — the founder-approved glass / worn-alloy vocabulary
// (P-1/P-2/P-3), so every composite member MATCHES /toolbar-chassis by construction.
//   • glass-*       → the chassis transmission-glass pane recipe (clear / tinted / active).
//   • worn-*        → applyWornMaterial + the generated jewel-tone PBR sets.
//   • liquid-glass  → handled by the DropdownNode (the P-3 FluidSurface), not here.
//
// Runs on the WebGPURenderer (the /fluid-lab idiom) — standard MeshPhysicalMaterial
// is auto-wrapped to a node material there (the FluidInspector proves this works).

import * as THREE from 'three';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import type { MemberMaterial } from './composite-schema';

const WORN_KEY: Partial<Record<MemberMaterial, string>> = {
  'worn-sapphire': 'sapphire',
  'worn-bronze': 'bronze',
  'worn-emerald': 'emerald',
  'worn-gunmetal': 'gunmetal',
};

function glassMaterial(opts: { tint: string; transmission: number; emissive?: string; emissiveIntensity?: number; clearcoatRoughness?: number }) {
  const m = new THREE.MeshPhysicalMaterial({
    transmission: opts.transmission,
    thickness: 0.6,
    ior: 1.5,
    roughness: 0.06,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.18,
    attenuationColor: new THREE.Color(opts.tint),
    attenuationDistance: 1.9,
    envMapIntensity: 1.05,
    specularIntensity: 0.7,
    transparent: true,
  });
  if (opts.emissive) {
    m.emissive = new THREE.Color(opts.emissive);
    m.emissiveIntensity = opts.emissiveIntensity ?? 0.3;
  }
  return m;
}

export function buildMemberMaterial(material: MemberMaterial, maps: Record<string, WornMaps>): THREE.MeshPhysicalMaterial {
  const wornKey = WORN_KEY[material];
  if (wornKey && maps[wornKey]) {
    const m = new THREE.MeshPhysicalMaterial();
    applyWornMaterial(m, maps[wornKey]);
    return m;
  }
  switch (material) {
    case 'glass-clear':
      return glassMaterial({ tint: '#dbe8f2', transmission: 1 });
    case 'glass-tab':
      return glassMaterial({ tint: '#cfe0ee', transmission: 0.92 });
    case 'glass-tab-active':
      return glassMaterial({ tint: '#a9d6ff', transmission: 0.9, emissive: '#1d3346', emissiveIntensity: 0.34, clearcoatRoughness: 0.14 });
    default:
      // liquid-glass falls through to a clear pane here (DropdownNode renders the
      // real flowing surface); any unmapped worn key degrades to clear glass.
      return glassMaterial({ tint: '#dbe8f2', transmission: 1 });
  }
}
