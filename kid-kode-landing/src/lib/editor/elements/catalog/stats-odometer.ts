// stats-odometer — a pair of brushed-metal odometer stat counters seated on a
// polished-chrome rail. Each counter is a beveled brushed-metal HOUSING (a thin
// cube wearing a premium anisotropic-steel PBR materialSpec) framing a big MSDF
// number that ROLLS UP into place like a mechanical odometer reel, with a small
// MSDF caption label beneath. A single chrome rail centerpiece ties the two
// counters into one instrument panel.
//
// The SR-smashing move: real mechanical odometer counters. The number glyphs
// cycle vertically and snap home (registry 'text-counter-roll', text category —
// verified registered), reading exactly like a turning drum; meanwhile an
// anisotropic brushed-metal sheen sweeps across each housing along the grain
// (registry 'brushed-metal', shimmer category — verified registered). Slider
// Revolution fakes counters with CSS opacity ticks; this is lit PBR steel with
// a real reel-spin and a real specular sweep along turned-aluminum grain.
//
// This is a TEMPLATE Phase 2 copies: every member is a real, editable PrismNode
// (move/scale/recolor/re-skin/retarget the number text/swap the animation
// post-place). Photorealism is procedural PBR + IBL (free) — no hero imagery.
//
// Tier: T1 full-fidelity, clean T0 fallback — the housings still read as lit
// brushed steel and the numbers still roll without screen-space GI. INV-9.

import { registerElement } from '../registry';
import type {
  ClusterMemberTemplate,
  ElementClusterDefinition,
} from '../contract';
import type { MaterialSpec, ScenePosition } from '@/lib/prism-graph/types';

// Identity pose helper — local cluster space, origin (0,0,0); the instantiator
// offsets x/y/z by the drop anchor.
function pose(
  x: number,
  y: number,
  z: number,
  extra?: Partial<ScenePosition>,
): ScenePosition {
  return {
    x,
    y,
    z,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    ...extra,
  };
}

// Premium PBR recipes (Observatory Brass palette — brass/gold + steel/ice blue
// + charcoal; NEVER purple). Card/data colors are graph data, not chrome.
const BRUSHED_STEEL: MaterialSpec = {
  baseColor: '#9aa6b4', // turned-aluminum steel
  metalness: 0.95,
  roughness: 0.32,
  clearcoat: 0.4,
  clearcoatRoughness: 0.22,
  envMapIntensity: 1.3,
};

const POLISHED_CHROME: MaterialSpec = {
  baseColor: '#cdd4dd',
  metalness: 1.0,
  roughness: 0.08,
  clearcoat: 1.0,
  clearcoatRoughness: 0.06,
  envMapIntensity: 1.6,
};

// Counter layout (cluster-local scene units).
const HOUSING_W = 1.55;
const HOUSING_H = 0.95;
const HOUSING_DEPTH = 0.22;
const COLUMN_X = 1.05; // each counter offset ± from center

interface CounterSeed {
  localId: string;
  x: number;
  number: string; // the odometer value (MSDF glyphs, INV-11)
  label: string;
  brassNumber: boolean; // brass vs ice-blue number tint
}

const COUNTERS: CounterSeed[] = [
  { localId: 'left', x: -COLUMN_X, number: '128K', label: 'ACTIVE USERS', brassNumber: true },
  { localId: 'right', x: COLUMN_X, number: '99.9', label: 'UPTIME %', brassNumber: false },
];

function buildCounter(seed: CounterSeed, index: number): ClusterMemberTemplate[] {
  const numberFill = seed.brassNumber
    ? { kind: 'gradient' as const, from: '#e6cf94', to: '#c2a05c', angleDeg: 90 } // brass
    : { kind: 'gradient' as const, from: '#d6e6f2', to: '#9fc3d6', angleDeg: 90 }; // ice steel

  return [
    // ── Housing — the brushed-metal odometer drum frame (lit PBR cube). The
    // brushed-metal sheen primitive swaps this mesh's panel material at runtime
    // and sweeps a stretched anisotropic highlight along the grain.
    {
      localId: `housing-${seed.localId}`,
      subtype: 'element',
      serviceTag: 'decor',
      caption: `Odometer housing ${index + 1}`,
      renderMode: 'mesh',
      pose: pose(seed.x, 0.12, 0),
      footprint: { width: HOUSING_W, height: HOUSING_H },
      meshPrimitive: {
        kind: 'cube',
        params: { width: HOUSING_W, height: HOUSING_H, depth: HOUSING_DEPTH },
      },
      materialSpec: BRUSHED_STEEL,
      receivesLighting: true,
      // INTEGRATED animation #1: anisotropic brushed-metal sheen sweep.
      animationBindings: [
        {
          id: `ab-stats-housing-${seed.localId}-brushed`,
          primitive: 'brushed-metal',
          driver: 'time',
          params: { speed: 0.7, grainFreq: 64, intensity: 1.25, width: 0.2 },
          order: 0,
        },
      ],
    },
    // ── Number — the big MSDF value that ROLLS UP like an odometer reel. Sits
    // just proud of the housing face so it reads as the drum window.
    {
      localId: `number-${seed.localId}`,
      subtype: 'text',
      serviceTag: 'decor',
      caption: `Odometer value ${index + 1}`,
      renderMode: 'text',
      pose: pose(seed.x, 0.2, HOUSING_DEPTH / 2 + 0.03),
      footprint: { width: HOUSING_W * 0.82, height: 0.46 },
      textSpec: {
        content: seed.number,
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 0.42, // modest — frames inside the housing window
        align: 'center',
        letterSpacing: 0.02,
        fill: numberFill,
        decompose: 'glyph',
      },
      // INTEGRATED animation #2: the odometer reel — glyphs cycle vertically and
      // snap home in sequence (registry 'text-counter-roll', verified).
      animationBindings: [
        {
          id: `ab-stats-number-${seed.localId}-roll`,
          primitive: 'text-counter-roll',
          driver: 'time',
          params: { duration: 2.0, spins: 4, stagger: 0.14 },
          order: 0,
        },
      ],
    },
    // ── Label — small MSDF caption beneath the drum (charcoal-ice steel).
    {
      localId: `label-${seed.localId}`,
      subtype: 'text',
      serviceTag: 'decor',
      caption: `Odometer label ${index + 1}`,
      renderMode: 'text',
      pose: pose(seed.x, -0.52, HOUSING_DEPTH / 2 + 0.03),
      footprint: { width: HOUSING_W * 0.9, height: 0.16 },
      textSpec: {
        content: seed.label,
        fontFamily: 'Inter',
        fontWeight: 600,
        fontSize: 0.14, // modest sub-caption
        align: 'center',
        letterSpacing: 0.12,
        fill: { kind: 'solid', color: '#aab7c4' },
        decompose: 'glyph',
      },
    },
  ];
}

function buildMembers(): ClusterMemberTemplate[] {
  // Polished-chrome base rail — a low cylinder lying across the row, seating the
  // two counters on a single instrument bar so the panel reads as one object.
  const rail: ClusterMemberTemplate = {
    localId: 'rail',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Chrome base rail',
    renderMode: 'mesh',
    pose: pose(0, -0.72, 0, { rotationZ: Math.PI / 2 }), // long axis horizontal
    footprint: { width: 3.0, height: 0.18 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.09, height: 3.0, segments: 48 },
    },
    materialSpec: POLISHED_CHROME,
    receivesLighting: true,
  };

  const counters = COUNTERS.flatMap((seed, i) => buildCounter(seed, i));
  return [rail, ...counters]; // 1 rail + 2×(housing+number+label) = 7 members
}

export const statsOdometer: ElementClusterDefinition = {
  id: 'stats-odometer',
  label: 'Odometer Stats',
  category: 'stat-counter',
  caption: 'Brushed-metal counters that roll up to their value',
  description:
    'Two brushed-steel odometer drums on a chrome rail, numbers rolling like a real reel.',
  members: buildMembers(),
  preview: {
    // Frame both counters + the rail head-on with a slight three-quarter tilt so
    // the brushed sheen and the chrome rail both catch the key light in a ~4:3
    // tile.
    camera: { distance: 5.4, polar: Math.PI / 2.2, azimuth: Math.PI * 0.08 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm studio key at place time so the steel + chrome read photoreal
  // standalone (additive; never forces a hub-wide change unless opted in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.28,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'mechanical odometer counter roll',
    'anisotropic brushed-metal sheen',
    'PBR polished chrome',
    'kinetic numeric typography',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(statsOdometer);
export default statsOdometer;
