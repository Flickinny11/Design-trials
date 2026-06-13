// nav-orbital-ring — a navigation element whose menu items ride a tilted
// orbital ring you rotate to bring an item to the front (§13 / catalog plan,
// NAVIGATION). A polished obsidian torus is the visible orbit track; five
// brushed-brass nav pills (capsule meshes) ride evenly spaced around it, and a
// crisp MSDF label frames the item parked at the front station. The SR-smashing
// move: the ring is alive (ambient `spin` about Y) AND cursor-reactive — every
// pill carries `pointer-orbit` (verified registry name, category 'pointer'), so
// dragging the cursor swings the whole ring like a compass and rotates the next
// item to the front. Real PBR + IBL, not CSS transforms.
//
// This is built entirely from real, editable PrismNode members (move / recolor /
// re-skin / re-bind any pill post-place). Photorealism is procedural PBR +
// lighting (free) — obsidian track + brushed-brass pills + ice-steel accent — so
// NO fal imagery is needed. Palette = Observatory Brass (brass/gold + ice/steel
// blues + charcoal). NO purple.
//
// Tier: T1 full-fidelity, clean T0 fallback — the track still reads as a lit
// obsidian ring and the pills as brushed-brass capsules without screen-space GI
// (INV-9). Text is real MSDF (INV-11), never diffusion.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

const PILL_COUNT = 5;
const RING_RADIUS = 1.55; // pill orbit radius (matches the torus major radius)
const RING_TILT = -0.32; // ring tilted toward camera so the front station reads

// A clean ScenePosition with the 9 required fields populated.
function pose(
  x: number,
  y: number,
  z: number,
  opts?: Partial<Pick<ScenePosition, 'rotationX' | 'rotationY' | 'rotationZ' | 'scaleX' | 'scaleY' | 'scaleZ'>>,
): ScenePosition {
  return {
    x,
    y,
    z,
    rotationX: opts?.rotationX ?? 0,
    rotationY: opts?.rotationY ?? 0,
    rotationZ: opts?.rotationZ ?? 0,
    scaleX: opts?.scaleX ?? 1,
    scaleY: opts?.scaleY ?? 1,
    scaleZ: opts?.scaleZ ?? 1,
  };
}

// Alternating brushed-brass / ice-steel for the nav pills — both physically
// plausible PBR (NEVER purple). The front-most pill (the parked station) wears a
// hotter polished-brass + clearcoat so it reads as "selected".
const PILL_PALETTE = [
  { baseColor: '#c9a86a', metalness: 0.95, roughness: 0.32 }, // brushed brass (front station)
  { baseColor: '#9fc3d6', metalness: 0.72, roughness: 0.24 }, // ice steel
  { baseColor: '#d8c089', metalness: 0.86, roughness: 0.3 }, // pale gold
  { baseColor: '#aebfcb', metalness: 0.62, roughness: 0.22 }, // pewter
  { baseColor: '#cbb06f', metalness: 0.9, roughness: 0.28 }, // antique brass
];

function buildPills(): ClusterMemberTemplate[] {
  const pills: ClusterMemberTemplate[] = [];
  for (let i = 0; i < PILL_COUNT; i++) {
    // i=0 sits at the FRONT station (angle 0 → +Z, nearest the camera).
    const angle = (i / PILL_COUNT) * Math.PI * 2;
    const x = Math.sin(angle) * RING_RADIUS;
    const z = Math.cos(angle) * RING_RADIUS;
    const isFront = i === 0;
    const pal = PILL_PALETTE[i % PILL_PALETTE.length];
    pills.push({
      localId: `pill-${i}`,
      subtype: 'element',
      serviceTag: 'decor',
      caption: isFront ? 'Nav item (front station)' : `Nav item ${i + 1}`,
      renderMode: 'mesh',
      // Capsule laid on its side (rotationZ 90°), then yawed to sit tangent to
      // the ring so it reads as a pill riding the track. The front pill is
      // slightly larger — the parked / focused item.
      pose: pose(x, 0, z, {
        rotationY: angle,
        rotationZ: Math.PI / 2,
        scaleX: isFront ? 1.18 : 1,
        scaleY: isFront ? 1.18 : 1,
        scaleZ: isFront ? 1.18 : 1,
      }),
      footprint: { width: 0.62, height: 0.34 },
      meshPrimitive: {
        kind: 'capsule',
        params: { radius: 0.16, length: 0.34, segments: 32 },
      },
      materialSpec: {
        baseColor: pal.baseColor,
        metalness: pal.metalness,
        roughness: pal.roughness,
        clearcoat: isFront ? 1.0 : 0.5,
        clearcoatRoughness: isFront ? 0.08 : 0.2,
        envMapIntensity: isFront ? 1.45 : 1.3,
        emissive: isFront ? '#3a2c12' : '#000000',
        emissiveIntensity: isFront ? 0.35 : 0,
      },
      receivesLighting: true,
      // INTEGRATED animation: cursor-reactive orbit. `pointer-orbit` swings the
      // pill's azimuth toward the cursor angle (verified registry primitive,
      // category 'pointer') — dragging the cursor rotates the ring and brings
      // the next nav item to the front station. Pointer-driven (the headline
      // interaction of this element).
      animationBindings: [
        {
          id: `ab-nav-orbital-pill-${i}-orbit`,
          primitive: 'pointer-orbit',
          driver: 'pointer',
          params: { gain: 1.0, smoothing: 0.3, lean: true },
          order: 0,
        },
      ],
    });
  }
  return pills;
}

const navOrbitalRing: ElementClusterDefinition = {
  id: 'nav-orbital-ring',
  label: 'Orbital Ring Nav',
  category: 'navigation',
  caption: 'Nav items riding an orbital ring you rotate to bring one to the front',
  description: 'Brushed-brass nav pills orbit a polished obsidian ring — drag the cursor to swing the next item front.',
  members: [
    // ── Orbit track — a polished obsidian torus, the visible ring the pills
    // ride. Tilted toward the camera so the front station reads as "selected".
    // Carries the ambient `spin` (time-driven) so the ring is alive even before
    // the cursor touches it.
    {
      localId: 'ring-track',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Orbit track',
      renderMode: 'mesh',
      pose: pose(0, 0, 0, { rotationX: RING_TILT }),
      footprint: { width: 3.3, height: 3.3 },
      meshPrimitive: {
        kind: 'torus',
        params: { radius: RING_RADIUS, tube: 0.07, segments: 96 },
      },
      materialSpec: {
        baseColor: '#15171f',
        metalness: 0.7,
        roughness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.5,
      },
      receivesLighting: true,
      // INTEGRATED animation: a slow ambient turntable so the ring breathes
      // (verified registry primitive 'spin', category 'transform').
      animationBindings: [
        {
          id: 'ab-nav-orbital-ring-spin',
          primitive: 'spin',
          driver: 'time',
          params: { cycle: 14, turns: 1, axis: 'y' },
          order: 0,
        },
      ],
    },
    // ── Hub cap — a small ice-steel sphere at the ring center, the navigational
    // anchor the pills orbit. Pure procedural PBR.
    {
      localId: 'hub-cap',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Ring hub',
      renderMode: 'mesh',
      pose: pose(0, 0, 0),
      footprint: { width: 0.6, height: 0.6 },
      meshPrimitive: {
        kind: 'sphere',
        params: { radius: 0.26, segments: 48 },
      },
      materialSpec: {
        baseColor: '#aebfcb',
        metalness: 0.85,
        roughness: 0.16,
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.4,
      },
      receivesLighting: true,
    },
    // ── Nav pills riding the ring (each cursor-reactive via pointer-orbit).
    ...buildPills(),
    // ── Front-station label — REAL MSDF text (INV-11) naming the item parked at
    // the front. Modest fontSize so it frames inside the station, not over the
    // whole ring. Sits just in front of the focused pill.
    {
      localId: 'front-label',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Front station label',
      renderMode: 'text',
      pose: pose(0, -0.55, RING_RADIUS + 0.32),
      footprint: { width: 1.6, height: 0.36 },
      textSpec: {
        content: 'EXPLORE',
        fontFamily: 'Inter',
        fontWeight: 600,
        fontSize: 0.3,
        align: 'center',
        letterSpacing: 0.06,
        fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
        decompose: 'glyph',
      },
    },
  ],
  preview: {
    // Frame the whole tilted ring three-quarter from slightly above so all five
    // pills + the front label read in a ~4:3 tile.
    camera: { distance: 5.6, polar: Math.PI / 2.35, azimuth: Math.PI * 0.08 },
    frozenPhase: 0.4,
    loopSeconds: 7,
    tier: 'T1',
  },
  // Warm-key studio look recommendation at place time (additive; never forces a
  // hub-wide change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.28,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'magnetic cursor physics',
    'PBR clearcoat metal',
    '3D rotating orbital navigation',
    'kinetic MSDF typography',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(navOrbitalRing);
export default navOrbitalRing;
