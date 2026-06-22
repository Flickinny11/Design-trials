// ORRERY No.7 — Atelier watch-configurator catalog (F5.1, proxy).
// Pure data + logic: the 11-layer assembly stack, per-layer variants, the
// MaterialSpec each variant applies, the layer→proxy-node map, and the
// constraint rules. No React, no DOM, no THREE — consumed by the configurator
// store (state) and the applier (imperative material swap). Spec:
// docs/prism/ORRERY-NO7-PROTOTYPE-SPEC.md §3.
import type { MaterialSpec } from '@/lib/prism-graph/types';

export type AtelierLayerId =
  | 'movement' | 'case' | 'bezel' | 'dial' | 'hands' | 'indices'
  | 'crown' | 'complications' | 'lume' | 'strap' | 'engraving';

export interface AtelierVariant {
  id: string;
  label: string;
  swatch: string;            // hex shown on the in-3D catalog card
  material?: MaterialSpec;   // applied to the layer's nodeIds (absent for state-only layers)
  priceDelta?: number;       // USD delta from the floor (for the live summary)
}

export interface AtelierLayerDef {
  id: AtelierLayerId;
  label: string;
  order: number;
  nodeIds: string[];         // proxy part nodes this layer's material applies to ([] = state-only)
  defaultVariant: string;
  variants: AtelierVariant[];
  note?: string;             // shown when the layer has no proxy geometry yet (photoreal in F5.3)
}

// Full MeshPhysicalNodeMaterial spec with sensible zeros; override what matters.
function finish(p: Partial<MaterialSpec> & { baseColor: string }): MaterialSpec {
  return {
    baseColor: p.baseColor,
    metalness: p.metalness ?? 1,
    roughness: p.roughness ?? 0.3,
    transmission: p.transmission ?? 0,
    ior: p.ior ?? 1.5,
    dispersion: p.dispersion ?? 0,
    clearcoat: p.clearcoat ?? 0,
    clearcoatRoughness: p.clearcoatRoughness ?? 0.3,
    iridescence: p.iridescence ?? 0,
    iridescenceIOR: p.iridescenceIOR ?? 1.3,
    thickness: p.thickness ?? 0.5,
    emissive: p.emissive ?? '#000000',
    emissiveIntensity: p.emissiveIntensity ?? 0,
    normalScale: p.normalScale ?? 1,
    displacementScale: p.displacementScale ?? 0,
    envMapIntensity: p.envMapIntensity ?? 1.1,
    opacity: p.opacity ?? 1,
    normalMapUrl: p.normalMapUrl ?? null,
    displacementMapUrl: p.displacementMapUrl ?? null,
    baseColorMapUrl: p.baseColorMapUrl ?? null,
    roughnessMapUrl: p.roughnessMapUrl ?? null,
  };
}

// PHASE1 photoreal PBR maps (FLUX.2 height → sharp-derived normal+roughness).
const TEX = '/prism-mock/orrery/meshes/atelier/textures';

const STEEL = { metalness: 1, roughness: 0.18, envMapIntensity: 1.35 };
const BRUSHED = { metalness: 1, roughness: 0.42, envMapIntensity: 1.0 };

export const LAYERS: AtelierLayerDef[] = [
  {
    id: 'movement', label: 'Movement', order: 1, nodeIds: [], defaultVariant: 'automatic',
    note: 'Live mechanism arrives with the photoreal GLB (F5.3). Selection gates complications + price.',
    variants: [
      { id: 'automatic', label: 'Automatic', swatch: '#c9ced6', priceDelta: 0 },
      { id: 'manual', label: 'Manual Wind', swatch: '#b6bcc4', priceDelta: 1200 },
      { id: 'tourbillon', label: 'Tourbillon', swatch: '#e8c98a', priceDelta: 48000 },
      { id: 'skeleton', label: 'Skeleton', swatch: '#9aa0a8', priceDelta: 9000 },
    ],
  },
  {
    id: 'case', label: 'Case', order: 2, nodeIds: ['orr-atelier-watch-case', 'orr-atelier-watch-lug-tl', 'orr-atelier-watch-lug-tr', 'orr-atelier-watch-lug-bl', 'orr-atelier-watch-lug-br'], defaultVariant: 'steel',
    variants: [
      { id: 'steel', label: 'Steel', swatch: '#c9ced6', material: finish({ baseColor: '#c9ced6', ...STEEL }), priceDelta: 0 },
      { id: 'rose-gold', label: 'Rose Gold', swatch: '#d8a07a', material: finish({ baseColor: '#d8a07a', metalness: 1, roughness: 0.22, envMapIntensity: 1.35 }), priceDelta: 14000 },
      { id: 'titanium', label: 'Titanium', swatch: '#9a9ea4', material: finish({ baseColor: '#9a9ea4', metalness: 1, roughness: 1, envMapIntensity: 1.05, normalMapUrl: `${TEX}/metal-nrm-brushed.png`, normalScale: 0.6, roughnessMapUrl: `${TEX}/metal-rgh-brushed.png` }), priceDelta: 3500 },
      { id: 'black-dlc', label: 'Black DLC', swatch: '#23262b', material: finish({ baseColor: '#23262b', metalness: 1, roughness: 0.34, envMapIntensity: 0.9 }), priceDelta: 2800 },
    ],
  },
  {
    id: 'bezel', label: 'Bezel', order: 3, nodeIds: ['orr-atelier-watch-bezel'], defaultVariant: 'brushed',
    variants: [
      { id: 'brushed', label: 'Brushed', swatch: '#aeb4bd', material: finish({ baseColor: '#aeb4bd', metalness: 1, roughness: 1, envMapIntensity: 1.05, normalMapUrl: `${TEX}/metal-nrm-brushed.png`, normalScale: 0.5, roughnessMapUrl: `${TEX}/metal-rgh-brushed.png` }), priceDelta: 0 },
      { id: 'polished', label: 'Polished', swatch: '#d6dae0', material: finish({ baseColor: '#d6dae0', ...STEEL }), priceDelta: 600 },
      { id: 'gold', label: 'Gold', swatch: '#e8c98a', material: finish({ baseColor: '#e8c98a', metalness: 1, roughness: 0.2, envMapIntensity: 1.4 }), priceDelta: 11000 },
      { id: 'gem-set', label: 'Gem-set', swatch: '#eaf2ff', material: finish({ baseColor: '#eaf2ff', metalness: 0.2, roughness: 0.05, clearcoat: 1, emissive: '#3a6ea5', emissiveIntensity: 0.18, envMapIntensity: 1.6 }), priceDelta: 62000 },
    ],
  },
  {
    id: 'dial', label: 'Dial', order: 4, nodeIds: ['orr-atelier-watch-dial'], defaultVariant: 'orrery',
    variants: [
      // PHASE1 v2 signature (SC-V-O3): the dial IS a working orrery complication —
      // generated photoreal art (FLUX.2): midnight guilloché + aventurine starfield,
      // gold orbital tracks with planet spheres, a moonphase aperture, applied markers.
      { id: 'orrery', label: 'Orrery Celestial', swatch: '#1b2a52', material: finish({ baseColor: '#aab4d0', metalness: 0.5, roughness: 0.5, clearcoat: 0.7, clearcoatRoughness: 0.08, envMapIntensity: 1.3, baseColorMapUrl: `${TEX}/dial-tex-orrery.png` }), priceDelta: 42000 },
      { id: 'navy', label: 'Midnight Navy', swatch: '#16243a', material: finish({ baseColor: '#16243a', metalness: 0.35, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 0.9 }), priceDelta: 0 },
      { id: 'silver', label: 'Silver Sunburst', swatch: '#c4c9d1', material: finish({ baseColor: '#c4c9d1', metalness: 0.85, roughness: 1, clearcoat: 0.5, clearcoatRoughness: 0.12, envMapIntensity: 1.25, normalMapUrl: `${TEX}/dial-nrm-sunburst.png`, normalScale: 0.7, roughnessMapUrl: `${TEX}/dial-rgh-sunburst.png` }), priceDelta: 800 },
      { id: 'black', label: 'Onyx', swatch: '#0c0e12', material: finish({ baseColor: '#0c0e12', metalness: 0.3, roughness: 0.5, clearcoat: 0.7, envMapIntensity: 0.8 }), priceDelta: 0 },
      { id: 'green', label: 'British Racing', swatch: '#123524', material: finish({ baseColor: '#123524', metalness: 0.35, roughness: 0.4, clearcoat: 0.6, envMapIntensity: 0.95 }), priceDelta: 1200 },
      { id: 'salmon', label: 'Salmon', swatch: '#e7a584', material: finish({ baseColor: '#e7a584', metalness: 0.45, roughness: 0.38, clearcoat: 0.55, envMapIntensity: 1.0 }), priceDelta: 2400 },
      { id: 'meteorite', label: 'Meteorite', swatch: '#6b6f78', material: finish({ baseColor: '#6b6f78', metalness: 0.85, roughness: 0.55, clearcoat: 0.4, envMapIntensity: 1.2, baseColorMapUrl: '/prism-mock/orrery/meshes/atelier/textures/dial-tex-meteorite.png' }), priceDelta: 18000 },
      { id: 'guilloche', label: 'Guilloché', swatch: '#1a2a5a', material: finish({ baseColor: '#1a2a5a', metalness: 0.7, roughness: 1, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 1.35, baseColorMapUrl: `${TEX}/dial-tex-guilloche.png`, normalMapUrl: `${TEX}/dial-nrm-guilloche.png`, normalScale: 0.9, roughnessMapUrl: `${TEX}/dial-rgh-guilloche.png` }), priceDelta: 22000 },
      { id: 'aventurine', label: 'Aventurine', swatch: '#0b1a3a', material: finish({ baseColor: '#0b1a3a', metalness: 0.2, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.05, envMapIntensity: 1.4, baseColorMapUrl: '/prism-mock/orrery/meshes/atelier/textures/dial-tex-aventurine.png' }), priceDelta: 35000 },
      { id: 'enamel', label: 'Grand Feu Enamel', swatch: '#f5f0e8', material: finish({ baseColor: '#f5f0e8', metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.3, baseColorMapUrl: '/prism-mock/orrery/meshes/atelier/textures/dial-tex-enamel.png' }), priceDelta: 14000 },
    ],
  },
  {
    id: 'hands', label: 'Hands', order: 5, nodeIds: ['orr-atelier-watch-hand-hour', 'orr-atelier-watch-hand-min'], defaultVariant: 'rhodium',
    variants: [
      { id: 'rhodium', label: 'Rhodium', swatch: '#eef2f8', material: finish({ baseColor: '#eef2f8', metalness: 1, roughness: 0.12, envMapIntensity: 1.4 }), priceDelta: 0 },
      { id: 'gold', label: 'Gold', swatch: '#e8c98a', material: finish({ baseColor: '#e8c98a', metalness: 1, roughness: 0.16, envMapIntensity: 1.4 }), priceDelta: 1800 },
      { id: 'blued', label: 'Blued Steel', swatch: '#2b4f8a', material: finish({ baseColor: '#2b4f8a', metalness: 1, roughness: 0.2, clearcoat: 0.5, envMapIntensity: 1.3 }), priceDelta: 2200 },
    ],
  },
  {
    id: 'indices', label: 'Indices', order: 6, nodeIds: ['orr-atelier-watch-mk-00', 'orr-atelier-watch-mk-01', 'orr-atelier-watch-mk-02', 'orr-atelier-watch-mk-03', 'orr-atelier-watch-mk-04', 'orr-atelier-watch-mk-05', 'orr-atelier-watch-mk-06', 'orr-atelier-watch-mk-07', 'orr-atelier-watch-mk-08', 'orr-atelier-watch-mk-09', 'orr-atelier-watch-mk-10', 'orr-atelier-watch-mk-11'], defaultVariant: 'gold',
    variants: [
      { id: 'gold', label: 'Applied Gold', swatch: '#e8c98a', material: finish({ baseColor: '#e8c98a', metalness: 1, roughness: 0.2, envMapIntensity: 1.4 }), priceDelta: 0 },
      { id: 'rhodium', label: 'Rhodium', swatch: '#dfe4ea', material: finish({ baseColor: '#dfe4ea', metalness: 1, roughness: 0.18, envMapIntensity: 1.4 }), priceDelta: 0 },
      { id: 'diamond', label: 'Diamond', swatch: '#f4f8ff', material: finish({ baseColor: '#f4f8ff', metalness: 0.1, roughness: 0.03, clearcoat: 1, emissive: '#cfe2ff', emissiveIntensity: 0.25, envMapIntensity: 1.7 }), priceDelta: 34000 },
    ],
  },
  {
    id: 'crown', label: 'Crown', order: 7, nodeIds: ['orr-atelier-watch-crown'], defaultVariant: 'steel',
    variants: [
      { id: 'steel', label: 'Steel', swatch: '#c9ced6', material: finish({ baseColor: '#c9ced6', metalness: 1, roughness: 0.2, envMapIntensity: 1.3 }), priceDelta: 0 },
      { id: 'gold', label: 'Gold', swatch: '#e8c98a', material: finish({ baseColor: '#e8c98a', metalness: 1, roughness: 0.2, envMapIntensity: 1.4 }), priceDelta: 2600 },
    ],
  },
  {
    id: 'complications', label: 'Complications', order: 8, nodeIds: [], defaultVariant: 'none',
    note: 'Sub-dial geometry arrives with the photoreal GLBs (F5.3). Gated by Movement.',
    variants: [
      { id: 'none', label: 'None', swatch: '#3a3f47', priceDelta: 0 },
      { id: 'date', label: 'Date', swatch: '#c9ced6', priceDelta: 900 },
      { id: 'gmt', label: 'GMT', swatch: '#3a6ea5', priceDelta: 5400 },
      { id: 'moonphase', label: 'Moonphase', swatch: '#cfe2ff', priceDelta: 8800 },
      { id: 'chrono', label: 'Chronograph', swatch: '#e8c98a', priceDelta: 12500 },
    ],
  },
  {
    id: 'lume', label: 'Lume', order: 9, nodeIds: [], defaultVariant: 'none',
    note: 'Applies an emissive glow to hands + indices (night/UV preview in F5.4).',
    variants: [
      { id: 'none', label: 'None', swatch: '#2a2e35', priceDelta: 0 },
      { id: 'blue', label: 'Blue', swatch: '#1ec8ff', priceDelta: 300 },
      { id: 'green', label: 'Green', swatch: '#5ef08a', priceDelta: 300 },
      { id: 'ice', label: 'Ice', swatch: '#bfe9ff', priceDelta: 450 },
    ],
  },
  {
    id: 'strap', label: 'Strap', order: 10, nodeIds: ['orr-atelier-watch-strap-t0', 'orr-atelier-watch-strap-t1', 'orr-atelier-watch-strap-t2', 'orr-atelier-watch-strap-t3', 'orr-atelier-watch-strap-b0', 'orr-atelier-watch-strap-b1', 'orr-atelier-watch-strap-b2', 'orr-atelier-watch-strap-b3'], defaultVariant: 'black-leather',
    variants: [
      { id: 'black-leather', label: 'Black Leather', swatch: '#2a1d14', material: finish({ baseColor: '#2a1d14', metalness: 0, roughness: 1, envMapIntensity: 0.7, normalMapUrl: `${TEX}/strap-nrm-leather.png`, normalScale: 1.0, roughnessMapUrl: `${TEX}/strap-rgh-leather.png` }), priceDelta: 0 },
      { id: 'brown-alligator', label: 'Brown Alligator', swatch: '#5a3a22', material: finish({ baseColor: '#5a3a22', metalness: 0, roughness: 1, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.8, baseColorMapUrl: `${TEX}/strap-tex-alligator.png`, normalMapUrl: `${TEX}/strap-nrm-leather.png`, normalScale: 1.2, roughnessMapUrl: `${TEX}/strap-rgh-leather.png` }), priceDelta: 3200 },
      { id: 'blue-rubber', label: 'Blue Rubber', swatch: '#1d3a6e', material: finish({ baseColor: '#1d3a6e', metalness: 0, roughness: 0.85, envMapIntensity: 0.5, baseColorMapUrl: '/prism-mock/orrery/meshes/atelier/textures/strap-tex-rubber.png' }), priceDelta: 600 },
      { id: 'steel-bracelet', label: 'Steel Bracelet', swatch: '#c9ced6', material: finish({ baseColor: '#c9ced6', metalness: 1, roughness: 0.28, envMapIntensity: 1.2 }), priceDelta: 4500 },
    ],
  },
  {
    id: 'engraving', label: 'Engraving', order: 11, nodeIds: [], defaultVariant: 'none',
    note: 'Real-time engraved-surface render arrives with the photoreal caseback (F5.3).',
    variants: [
      { id: 'none', label: 'None', swatch: '#3a3f47', priceDelta: 0 },
      { id: 'initials', label: 'Initials', swatch: '#c9ced6', priceDelta: 250 },
      { id: 'message', label: 'Message', swatch: '#e8c98a', priceDelta: 250 },
    ],
  },
];

export const PRICE_FLOOR = 38000; // ORRERY No.7 base, USD

export const LAYERS_BY_ID: Record<AtelierLayerId, AtelierLayerDef> =
  Object.fromEntries(LAYERS.map((l) => [l.id, l])) as Record<AtelierLayerId, AtelierLayerDef>;

export type AtelierBuild = Record<AtelierLayerId, string>;

export const DEFAULT_BUILD: AtelierBuild = Object.fromEntries(
  LAYERS.map((l) => [l.id, l.defaultVariant]),
) as AtelierBuild;

export function variantOf(layer: AtelierLayerId, variantId: string): AtelierVariant | undefined {
  return LAYERS_BY_ID[layer]?.variants.find((v) => v.id === variantId);
}

// Constraint-as-feature (SC-O3): illegal combos return a reason, never a dead end.
export function constraintReason(
  layer: AtelierLayerId,
  variantId: string,
  build: AtelierBuild,
): string | null {
  if (layer === 'complications') {
    const mv = build.movement;
    if (variantId === 'moonphase' && !(mv === 'automatic' || mv === 'tourbillon')) {
      return 'Moonphase requires the Automatic or Tourbillon movement.';
    }
    if (variantId === 'chrono' && mv === 'tourbillon') {
      return 'Chronograph is not available with the Tourbillon movement.';
    }
  }
  if (layer === 'indices' && variantId === 'diamond' && build.dial === 'meteorite') {
    return 'Diamond indices are not set on a meteorite dial.';
  }
  return null;
}

// Re-validate the whole build when a gating layer changes; returns layers whose
// current selection became illegal (caller resets them to default).
export function invalidSelections(build: AtelierBuild): AtelierLayerId[] {
  return (Object.keys(build) as AtelierLayerId[]).filter(
    (l) => constraintReason(l, build[l], build) !== null,
  );
}

export function totalPrice(build: AtelierBuild): number {
  let sum = PRICE_FLOOR;
  for (const l of LAYERS) {
    const v = variantOf(l.id, build[l.id]);
    if (v?.priceDelta) sum += v.priceDelta;
  }
  return sum;
}
