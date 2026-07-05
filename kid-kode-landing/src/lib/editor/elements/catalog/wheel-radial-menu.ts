// wheel-radial-menu — a premium radial / "pie" menu wheel (§13 library element,
// category 'wheel'). A polished-chrome hub core sits at the cluster origin,
// circled by a brushed-brass orbital track (torus). Five segment spokes — thin
// beveled tiles in the Observatory-Brass palette (brass / ice-steel / obsidian)
// — ride the ring at even angles, each tilted to face outward like the wedges
// of a radial menu. A modest MSDF label ("MENU", INV-11 real glyphs) is framed
// flat in the hub center.
//
// THE SR-SMASHING MOVE — cursor-reactive segments that SNAP:
//   • Every spoke carries `pointer-orbit` (registry, pointer category, verified):
//     the spokes swing about their own axis to track the cursor's angle around
//     the hub, so the whole wheel feels alive and compass-like as the pointer
//     moves — not a static CSS pie.
//   • The PRIMARY spoke additionally carries `magnet-snap` (registry, pointer
//     category, verified): a real mass+spring sim that YANKS the segment toward
//     the pointer, overshoots, and rings down — reading exactly as "snap to the
//     nearest segment" with genuine magnetic momentum, not an eased glide.
//   • The hub core carries an ambient `spin` (registry, transform, verified) so
//     the polished chrome catches the IBL and the centerpiece breathes.
//
// Photorealism is procedural PBR + studio IBL (free): polished chrome on the
// hub, brushed brass on the ring, brass / ice / obsidian on the spokes — no
// imagery needed. Every member is a real, editable PrismNode (move / recolor /
// re-skin / swap animation post-place).
//
// Tier: T1 full-fidelity; clean T0 fallback (the wheel still reads as a lit
// metal hub + brass ring + faceted spokes + crisp MSDF label without
// screen-space GI). INV-9. NO purple.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

const SPOKE_COUNT = 5;
const RING_RADIUS = 1.55;

// Spoke tile footprint (scene units) — a wide, thin radial wedge-tile.
const SPOKE_W = 0.92;
const SPOKE_H = 0.62;
const SPOKE_DEPTH = 0.07;

// Identity scale/rotation helpers so every pose carries all 9 ScenePosition
// fields explicitly (contract: pose is a full ScenePosition).
const IDENTITY = {
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
} as const;

// Alternating Observatory-Brass palette for the spokes — all physically
// plausible PBR, NEVER purple. (Member colors are graph data, not chrome.)
const SPOKE_PALETTE = [
  { baseColor: '#c9a86a', metalness: 0.95, roughness: 0.32 }, // brushed brass
  { baseColor: '#9fc3d6', metalness: 0.7, roughness: 0.22 }, // ice steel
  { baseColor: '#15171f', metalness: 0.7, roughness: 0.18 }, // obsidian
  { baseColor: '#d8c089', metalness: 0.82, roughness: 0.3 }, // pale gold
  { baseColor: '#aebfcb', metalness: 0.66, roughness: 0.24 }, // frost pewter
];

function spokePose(angle: number): ScenePosition {
  // Lay the spokes flat in the XY plane (the wheel faces +Z, like a dial), each
  // pushed out along its angle and rotated in-plane (rotationZ) so the tile's
  // long edge is tangent to the ring — radial-menu wedges, not billboards.
  const x = Math.cos(angle) * RING_RADIUS;
  const y = Math.sin(angle) * RING_RADIUS;
  return {
    x,
    y,
    z: 0.06,
    rotationX: 0,
    rotationY: 0,
    rotationZ: angle + Math.PI / 2,
    ...IDENTITY,
  };
}

function buildSpokes(): ClusterMemberTemplate[] {
  const spokes: ClusterMemberTemplate[] = [];
  for (let i = 0; i < SPOKE_COUNT; i++) {
    // Start the ring at the top (12 o'clock) and go clockwise so the PRIMARY
    // (i === 0) segment reads as the "active" wedge at the top of the wheel.
    const angle = Math.PI / 2 - (i / SPOKE_COUNT) * Math.PI * 2;
    const pal = SPOKE_PALETTE[i % SPOKE_PALETTE.length];
    const isPrimary = i === 0;

    // Every spoke tracks the cursor angle around the hub (pointer-orbit). The
    // PRIMARY spoke ALSO snaps to the pointer with real magnetic momentum
    // (magnet-snap) — the snap-to-segment headline move. Ids are re-minted per
    // placed node by the instantiator; these are stable template seeds.
    const bindings = isPrimary
      ? [
          {
            id: `ab-wheel-spoke-${i}-orbit`,
            primitive: 'pointer-orbit',
            driver: 'pointer' as const,
            params: { gain: 0.7, smoothing: 0.3, lean: true },
            order: 0,
          },
          {
            id: `ab-wheel-spoke-${i}-snap`,
            primitive: 'magnet-snap',
            driver: 'pointer' as const,
            params: { pull: 180, damping: 2.0, mass: 1.1, overshoot: 0.7 },
            order: 1,
          },
        ]
      : [
          {
            id: `ab-wheel-spoke-${i}-orbit`,
            primitive: 'pointer-orbit',
            driver: 'pointer' as const,
            params: { gain: 0.55, smoothing: 0.28, lean: true },
            order: 0,
          },
        ];

    spokes.push({
      localId: `spoke-${i}`,
      subtype: isPrimary ? 'button' : 'card',
      serviceTag: 'decor',
      caption: isPrimary ? 'Active menu segment' : `Menu segment ${i + 1}`,
      renderMode: 'mesh',
      pose: spokePose(angle),
      footprint: { width: SPOKE_W, height: SPOKE_H },
      meshPrimitive: {
        kind: 'cube',
        params: { width: SPOKE_W, height: SPOKE_H, depth: SPOKE_DEPTH },
      },
      materialSpec: {
        baseColor: pal.baseColor,
        metalness: pal.metalness,
        roughness: pal.roughness,
        clearcoat: isPrimary ? 1.0 : 0.6,
        clearcoatRoughness: isPrimary ? 0.08 : 0.2,
        // The active segment glows faintly so the snap target reads at a glance.
        emissive: isPrimary ? '#c9a86a' : '#000000',
        emissiveIntensity: isPrimary ? 0.18 : 0,
        envMapIntensity: 1.3,
      },
      receivesLighting: true,
      animationBindings: bindings,
    });
  }
  return spokes;
}

const HUB_CORE: ClusterMemberTemplate = {
  localId: 'hub-core',
  subtype: 'element',
  serviceTag: 'decor',
  caption: 'Wheel hub core',
  renderMode: 'mesh',
  pose: {
    x: 0,
    y: 0,
    z: 0,
    rotationX: Math.PI / 2, // lay the cylinder flat so its disc face fronts +Z
    rotationY: 0,
    rotationZ: 0,
    ...IDENTITY,
  },
  footprint: { width: 1.1, height: 1.1 },
  meshPrimitive: {
    kind: 'cylinder',
    params: { radius: 0.52, height: 0.14, segments: 64 },
  },
  // Polished chrome — the premium centerpiece that catches the IBL.
  materialSpec: {
    baseColor: '#d6dae2',
    metalness: 1.0,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.6,
  },
  receivesLighting: true,
  // Ambient slow turntable spin so the polished hub breathes + catches light.
  animationBindings: [
    {
      id: 'ab-wheel-hub-spin',
      primitive: 'spin',
      driver: 'time',
      params: { cycle: 14, turns: 1, axis: 'z' },
      order: 0,
    },
  ],
};

const RING_TRACK: ClusterMemberTemplate = {
  localId: 'ring-track',
  subtype: 'element',
  serviceTag: 'decor',
  caption: 'Wheel orbital track',
  renderMode: 'mesh',
  pose: {
    x: 0,
    y: 0,
    z: 0,
    rotationX: 0, // torus is born in the XY plane — faces +Z, framing the spokes
    rotationY: 0,
    rotationZ: 0,
    ...IDENTITY,
  },
  footprint: { width: RING_RADIUS * 2 + 0.4, height: RING_RADIUS * 2 + 0.4 },
  meshPrimitive: {
    kind: 'torus',
    params: { radius: RING_RADIUS, tube: 0.06, segments: 96 },
  },
  // Brushed brass track binding the spokes into one wheel.
  materialSpec: {
    baseColor: '#c9a86a',
    metalness: 0.95,
    roughness: 0.32,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1.3,
  },
  receivesLighting: true,
};

const HUB_LABEL: ClusterMemberTemplate = {
  localId: 'hub-label',
  subtype: 'text',
  serviceTag: 'decor',
  caption: 'Hub label',
  renderMode: 'text',
  pose: {
    x: 0,
    y: 0,
    z: 0.13, // float just proud of the chrome hub face
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    ...IDENTITY,
  },
  footprint: { width: 0.8, height: 0.3 },
  // Real MSDF (INV-11). Modest fontSize so the word frames inside the hub disc.
  textSpec: {
    content: 'MENU',
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 0.22,
    align: 'center',
    letterSpacing: 0.06,
    fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 20 },
    decompose: 'glyph',
  },
};

export const wheelRadialMenu: ElementClusterDefinition = {
  id: 'wheel-radial-menu',
  label: 'Radial Menu Wheel',
  category: 'wheel',
  caption: 'A chrome-hub radial menu whose segments track and snap to the cursor',
  description:
    'A polished-chrome hub ringed by brass segments that swing toward the pointer and magnetically snap.',
  members: [RING_TRACK, HUB_CORE, ...buildSpokes(), HUB_LABEL],
  preview: {
    // Frame the whole wheel head-on with a slight three-quarter tilt so the
    // chrome hub, brass ring, and all spokes read in a ~4:3 tile.
    camera: { distance: 5.4, polar: Math.PI / 2.3, azimuth: Math.PI * 0.08 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm studio key recommended at place time (additive; never forces a
  // hub-wide change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.3,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'magnetic cursor physics',
    'pointer-tracking radial menu',
    'snap-to-segment momentum',
    'PBR polished chrome + brushed brass',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(wheelRadialMenu);
export default wheelRadialMenu;
