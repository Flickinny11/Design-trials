// logocloud-orbital — a photoreal "orbital logo cloud" (§13 prebuilt-library,
// category logo-cloud). Partner-logo chips orbit a brass core in a tilted 3D
// ring, wrapped in a real particle ring system (an actual planetary-ring
// "cloud"), with an MSDF caption at the heart. This SMASHES Slider Revolution's
// flat logo strips: instead of a 2D row of greyed marks, the marks are
// individually-materialed PBR plates revolving in true 3D space inside a
// volumetric icy ring — every chip catches the studio IBL differently.
//
// Composition (cluster-local, origin 0,0,0 — the instantiator offsets by the
// drop anchor):
//   • core      — a polished-brass torus hub at the center, the gravitational
//                  anchor of the cloud. It carries the INTEGRATED particle ring
//                  binding 'orbit-rings' (the suggested binding, verified in the
//                  registry): a nested band of icy particles orbiting the core
//                  at Keplerian rates — the literal "cloud" the logos sit in.
//   • chip-0..4 — five partner-logo plates, each a thin beveled chip
//                  (meshPrimitive cube) wearing a DISTINCT premium PBR recipe
//                  (chrome / brushed brass / obsidian / iridescent / glass).
//                  Laid out on a tilted ring; each chip carries a slow 'spin'
//                  about Y so the WHOLE ring revolves like a turntable orbit —
//                  the chips sweep through the particle cloud as they turn.
//   • caption   — REAL MSDF text ('PARTNERS', INV-11, never diffusion) floating
//                  at the core, modest size so it frames inside the cloud.
//
// Photorealism is procedural PBR + IBL (free) — no hero imagery needed; each
// chip is a real, editable PrismNode (move / recolor / re-skin / swap the
// animation after placement). A placed chip can later be skinned with an actual
// partner logo via the Change-Artifact upload wizard (per-face image map).
//
// Tier: T1 full-fidelity, clean T0 fallback — the chips still read as lit
// brushed/chrome/glass plates and the ring still orbits without screen-space GI
// (the particle cloud is additive Points, tier-independent). INV-9.

import { registerElement } from '../registry';
import type {
  ElementClusterDefinition,
  ClusterMemberTemplate,
} from '../contract';
import type { MaterialSpec, ScenePosition } from '@/lib/prism-graph/types';

const CHIP_COUNT = 5;
const RING_RADIUS = 1.55; // ring the chips orbit on
const RING_TILT = -0.32; // radians — tilt the orbital plane toward camera

// Logo-chip footprint (scene units) — a wide, thin plate.
const CHIP_W = 1.0;
const CHIP_H = 0.62;
const CHIP_DEPTH = 0.07;

// Identity pose helper — keeps every member's ScenePosition fully populated
// (all 9 fields) while only overriding what differs.
function pose(p: Partial<ScenePosition>): ScenePosition {
  return {
    x: 0,
    y: 0,
    z: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    ...p,
  };
}

// Five DISTINCT premium chips — Observatory Brass palette (warm brass / gold +
// ice/steel blues + charcoal obsidian; NEVER purple). The first four chips wear
// REAL premium MATERIAL-MACRO scans (brushed brass / sapphire crystal /
// meteorite iron / liquid gold) poured onto the plate via
// baseColorMapUrl — these are the abstract "brand" surfaces, glossy photo-print
// chips that catch the IBL like precious lacquered tiles. The map MULTIPLIES
// baseColor, so each textured chip uses baseColor '#ffffff' to show the scan at
// full richness. The fifth chip stays a transmissive ice GLASS plate (no map) so
// the ring still shimmers with one true refractive surface. Chip data is graph
// data, not chrome — every chip remains a real, re-skinnable PrismNode.
//
// Square-ish material macros sit naturally on the wide chip plate (the scan
// reads as a cropped premium texture); orientation is uniform so no macro looks
// stretched. Images VARY across chips per the catalog WOW bar.
const CHIP_MATERIALS: MaterialSpec[] = [
  // brushed-brass scan — warm key chip, glossy photo-print finish
  {
    baseColor: '#ffffff',
    baseColorMapUrl: '/prism-mock/orrery/materia/brass-macro.png',
    metalness: 0.0,
    roughness: 0.42,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.0,
  },
  // sapphire-crystal macro — cool jewel chip with a faint thin-film sheen
  {
    baseColor: '#ffffff',
    baseColorMapUrl: '/prism-mock/orrery/materia/sapphire-macro.png',
    metalness: 0.0,
    roughness: 0.42,
    iridescence: 0.35,
    iridescenceIOR: 1.3,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.0,
  },
  // meteorite macro — deep charcoal-iron brand surface, lacquered clearcoat
  {
    baseColor: '#ffffff',
    baseColorMapUrl: '/prism-mock/orrery/materia/meteorite-macro.png',
    metalness: 0.0,
    roughness: 0.42,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.0,
  },
  // liquid-gold swirl — glossy abstract brand mark, mirror clearcoat
  {
    baseColor: '#ffffff',
    baseColorMapUrl: '/prism-mock/library-content/abstract-gold.png',
    metalness: 0.0,
    roughness: 0.38,
    clearcoat: 0.7,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.0,
  },
  // glass — transmissive ice plate with dispersion (untouched: keeps one true
  // refractive surface in the ring so the material variety still reads).
  {
    baseColor: '#e6f1f6',
    metalness: 0.0,
    roughness: 0.06,
    transmission: 0.92,
    ior: 1.5,
    dispersion: 0.04,
    thickness: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.5,
  },
];

function buildChips(): ClusterMemberTemplate[] {
  const chips: ClusterMemberTemplate[] = [];
  for (let i = 0; i < CHIP_COUNT; i++) {
    const angle = (i / CHIP_COUNT) * Math.PI * 2;
    const x = Math.sin(angle) * RING_RADIUS;
    const z = Math.cos(angle) * RING_RADIUS;
    // Lift around the tilted plane so the ring reads as an inclined orbit, not
    // a flat disc — chips at the back ride higher.
    const y = Math.sin(angle) * RING_RADIUS * Math.sin(RING_TILT);
    const mat = CHIP_MATERIALS[i % CHIP_MATERIALS.length];
    chips.push({
      localId: `chip-${i}`,
      subtype: 'card',
      serviceTag: 'decor',
      caption: `Partner logo ${i + 1}`,
      renderMode: 'mesh',
      // Each chip faces outward from the ring axis (billboarded by its azimuth)
      // and inherits the plane tilt so it banks with the orbit.
      pose: pose({
        x,
        y,
        z,
        rotationX: RING_TILT,
        rotationY: angle,
      }),
      footprint: { width: CHIP_W, height: CHIP_H },
      meshPrimitive: {
        kind: 'cube',
        params: { width: CHIP_W, height: CHIP_H, depth: CHIP_DEPTH },
      },
      materialSpec: mat,
      receivesLighting: true,
      // INTEGRATED animation: a slow turntable 'spin' about Y (registry
      // 'spin', transform, verified registered). Every chip turns in lockstep
      // so the whole ring revolves — the logos sweep through the orbital cloud.
      animationBindings: [
        {
          id: `ab-logocloud-chip-${i}`,
          primitive: 'spin',
          driver: 'time',
          params: { cycle: 6, turns: 1, axis: 'y' },
          order: 0,
        },
      ],
    });
  }
  return chips;
}

const logocloudOrbital: ElementClusterDefinition = {
  id: 'logocloud-orbital',
  label: 'Orbital Logo Cloud',
  category: 'logo-cloud',
  caption: 'Partner logos orbiting a brass core inside a 3D particle ring',
  description: 'Five PBR logo chips revolve through an icy particle ring around a brass hub.',
  members: [
    // ── Core — polished-brass torus hub at the heart of the cloud. Carries the
    // INTEGRATED particle ring system ('orbit-rings', particles, verified
    // registered): nested icy bands orbiting the core — the literal "cloud".
    {
      localId: 'core',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Logo cloud core',
      renderMode: 'mesh',
      pose: pose({ rotationX: RING_TILT }),
      footprint: { width: 0.9, height: 0.9 },
      meshPrimitive: {
        kind: 'torus',
        params: { radius: 0.34, tube: 0.1, segments: 64 },
      },
      materialSpec: {
        baseColor: '#c9a86a',
        metalness: 1.0,
        roughness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.5,
      },
      receivesLighting: true,
      animationBindings: [
        {
          id: 'ab-logocloud-core-rings',
          primitive: 'orbit-rings',
          driver: 'time',
          params: { rings: 5, speed: 1.0, tilt: 0.28, size: 0.045 },
          order: 0,
        },
      ],
    },
    ...buildChips(),
    // ── Caption — REAL MSDF text (INV-11), modest size so it frames inside the
    // ring at the core. No animationBinding so it reads as a steady label while
    // the chips and particle cloud revolve around it.
    {
      localId: 'caption',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Logo cloud label',
      renderMode: 'text',
      pose: pose({ z: 0.05 }),
      footprint: { width: 1.6, height: 0.34 },
      textSpec: {
        content: 'PARTNERS',
        fontFamily: 'Inter',
        fontWeight: 600,
        fontSize: 0.3,
        align: 'center',
        letterSpacing: 0.08,
        fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
        decompose: 'glyph',
      },
    },
  ],
  preview: {
    // Three-quarter view from slightly above so the tilted orbital ring + the
    // particle cloud + the core all frame inside a ~4:3 tile.
    camera: { distance: 5.4, polar: Math.PI / 2.4, azimuth: Math.PI * 0.12 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm studio key recommendation at place time (additive; never forces a
  // hub-wide change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.28,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'orbital particle ring system',
    'PBR transmission glass + chrome',
    'thin-film iridescence',
    'turntable 3D revolve',
    'kinetic MSDF typography',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(logocloudOrbital);

export default logocloudOrbital;
