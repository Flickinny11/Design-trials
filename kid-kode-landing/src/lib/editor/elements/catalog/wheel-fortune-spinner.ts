// wheel-fortune-spinner — a photoreal "prize wheel": a segmented disc, face-on
// to the camera, that spins continuously and a sprung pointer that ticks and
// SETTLES with a satisfying damped overshoot. This is the §13 reference for the
// `wheel` category — built entirely from real PBR primitives + MSDF text, no
// imagery needed.
//
// COMPOSITION (cluster-local, origin 0,0,0, wheel face in the XY plane → +Z):
//   • disc      — a thin polished-chrome cylinder lying flat to camera (the
//                 wheel face the segments sit on). The whole wheel SPINS about
//                 its facing axis.
//   • rim       — a brushed-brass torus framing the disc, also spinning, so the
//                 rim flecks catch the key light as it turns.
//   • seg-0..3  — four radial wedge bars (thin beveled boxes) alternating warm
//                 brass and cool ice steel — the segmented "prizes". They spin
//                 with the disc so the disc reads as one segmented unit.
//   • label     — REAL MSDF text "SPIN" pinned to the disc face (INV-11), modest
//                 size so it frames inside the disc.
//   • pointer   — a chrome cone ticker fixed at 12-o'clock that does NOT spin;
//                 it carries `pendulum-settle` so it swings and damps to rest —
//                 the satisfying overshoot as the wheel "lands".
//
// INTEGRATED animation (real registry primitives, verified):
//   • disc / rim / segments — `spin` about the Z axis (the facing axis), so the
//     segmented disc turns like a real fortune wheel.
//   • pointer — `pendulum-settle` (damped oscillation to a square rest pose):
//     the ticker overshoots and settles, the SR-smashing tactile payoff.
//
// Tier: T1 full-fidelity (chrome/brass PBR + clearcoat read best under studio
// IBL); clean T0 fallback — the disc, rim, wedges, and MSDF label still read as
// lit metal and crisp glyphs without screen-space GI. INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// ── Geometry constants (scene units) ────────────────────────────────────────
const SEG_COUNT = 4;
const DISC_RADIUS = 1.55; // wheel face radius
const DISC_DEPTH = 0.16; // how thick the wheel slab is
const RIM_TUBE = 0.14; // brass rim tube radius
const SEG_LEN = DISC_RADIUS * 0.82; // wedge bar length (inner→outer)
const SEG_W = 0.74; // wedge bar tangential width
const SEG_DEPTH = 0.07; // wedge sits proud of the disc face
const SEG_FACE_Z = DISC_DEPTH / 2 + SEG_DEPTH / 2; // wedges ride on the +Z face

// Identity-scale helper so every pose declares all 9 ScenePosition fields.
function pose(
  x: number,
  y: number,
  z: number,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
): ScenePosition {
  return { x, y, z, rotationX, rotationY, rotationZ, scaleX: 1, scaleY: 1, scaleZ: 1 };
}

// Alternating premium palette: warm brass + cool ice steel (Observatory Brass,
// NEVER purple). Both physically-plausible PBR brushed metals.
const SEG_PALETTE = [
  { baseColor: '#c9a86a', metalness: 0.95, roughness: 0.32 }, // brass
  { baseColor: '#9fc3d6', metalness: 0.88, roughness: 0.26 }, // ice steel
];

// The wheel SPINS about its facing (Z) axis; a slow continuous turntable so the
// segments sweep past the fixed pointer. Shared cycle keeps the disc coherent.
const SPIN_CYCLE = 7;
function spinBinding(localId: string) {
  return [
    {
      id: `ab-wheel-spin-${localId}`,
      primitive: 'spin',
      driver: 'time' as const,
      params: { cycle: SPIN_CYCLE, turns: 1, axis: 'z' },
      order: 0,
    },
  ];
}

function buildSegments(): ClusterMemberTemplate[] {
  const segs: ClusterMemberTemplate[] = [];
  // Center each wedge bar at mid-radius, rotated about Z to its slot, and shove
  // it just proud of the disc face so the segmented pattern catches light.
  const midR = SEG_LEN / 2 + 0.06;
  for (let i = 0; i < SEG_COUNT; i++) {
    const angle = (i / SEG_COUNT) * Math.PI * 2;
    const x = Math.cos(angle) * midR;
    const y = Math.sin(angle) * midR;
    const pal = SEG_PALETTE[i % SEG_PALETTE.length];
    segs.push({
      localId: `seg-${i}`,
      subtype: 'element',
      serviceTag: 'decor',
      caption: `Wheel segment ${i + 1}`,
      renderMode: 'mesh',
      // Bar points radially outward: its long axis is the box width, rotated by
      // `angle` about Z so it lies along the spoke; sits on the +Z disc face.
      pose: pose(x, y, SEG_FACE_Z, 0, 0, angle),
      footprint: { width: SEG_LEN, height: SEG_W },
      meshPrimitive: {
        kind: 'cube',
        params: { width: SEG_LEN, height: SEG_W, depth: SEG_DEPTH },
      },
      materialSpec: {
        baseColor: pal.baseColor,
        metalness: pal.metalness,
        roughness: pal.roughness,
        clearcoat: 0.7,
        clearcoatRoughness: 0.18,
        envMapIntensity: 1.3,
      },
      receivesLighting: true,
      // The whole segmented disc spins as one — every segment shares the spin.
      animationBindings: spinBinding(`seg-${i}`),
    });
  }
  return segs;
}

export const wheelFortuneSpinner: ElementClusterDefinition = {
  id: 'wheel-fortune-spinner',
  label: 'Fortune Spinner Wheel',
  category: 'wheel',
  caption: 'A segmented prize wheel that spins and settles with a sprung tick',
  description: 'A chrome-and-brass fortune wheel that spins while a sprung pointer ticks and settles.',
  members: [
    // ── Disc — the polished-chrome wheel face the segments ride on. A thin
    // cylinder laid flat to camera (rotated 90° about X so its round face → +Z).
    {
      localId: 'disc',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Wheel face',
      renderMode: 'mesh',
      pose: pose(0, 0, 0, Math.PI / 2, 0, 0),
      footprint: { width: DISC_RADIUS * 2, height: DISC_RADIUS * 2 },
      meshPrimitive: {
        kind: 'cylinder',
        params: { radius: DISC_RADIUS, height: DISC_DEPTH, segments: 96 },
      },
      // Polished chrome — mirror-bright so the segments and rim reflect across it.
      materialSpec: {
        baseColor: '#dfe4ec',
        metalness: 1.0,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.6,
      },
      receivesLighting: true,
      animationBindings: spinBinding('disc'),
    },
    // ── Rim — a brushed-brass torus framing the disc, spinning with it so the
    // rim highlights chase the key light around the wheel.
    {
      localId: 'rim',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Wheel rim',
      renderMode: 'mesh',
      pose: pose(0, 0, 0),
      footprint: { width: (DISC_RADIUS + RIM_TUBE) * 2, height: (DISC_RADIUS + RIM_TUBE) * 2 },
      meshPrimitive: {
        kind: 'torus',
        params: { radius: DISC_RADIUS + RIM_TUBE * 0.4, tube: RIM_TUBE, segments: 96 },
      },
      materialSpec: {
        baseColor: '#c9a86a',
        metalness: 0.95,
        roughness: 0.32,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.35,
      },
      receivesLighting: true,
      animationBindings: spinBinding('rim'),
    },
    // ── Segments — the four alternating brass / ice wedge bars.
    ...buildSegments(),
    // ── Label — REAL MSDF text centered on the disc face (INV-11). Modest size
    // so it frames inside the disc; gentle brass→ice gradient.
    {
      localId: 'label',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Wheel label',
      renderMode: 'text',
      pose: pose(0, 0, SEG_FACE_Z + SEG_DEPTH / 2 + 0.05),
      footprint: { width: 0.9, height: 0.32 },
      textSpec: {
        content: 'SPIN',
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 0.3,
        align: 'center',
        letterSpacing: 0.05,
        fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
        decompose: 'glyph',
      },
    },
    // ── Pointer — the chrome ticker cone fixed at 12-o'clock. It does NOT spin;
    // it carries `pendulum-settle` so it swings and damps to a square rest pose
    // — the satisfying overshoot as the wheel lands on a segment.
    {
      localId: 'pointer',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Wheel pointer',
      renderMode: 'mesh',
      // Above the rim at 12-o'clock, tip pointing DOWN into the wheel (rotated
      // 180° about Z so the cone apex faces -Y).
      pose: pose(0, DISC_RADIUS + RIM_TUBE + 0.26, DISC_DEPTH / 2 + 0.06, 0, 0, Math.PI),
      footprint: { width: 0.36, height: 0.5 },
      meshPrimitive: {
        kind: 'cone',
        params: { radius: 0.18, height: 0.5, segments: 48 },
      },
      // Polished chrome — a bright sprung needle.
      materialSpec: {
        baseColor: '#eef1f6',
        metalness: 1.0,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.6,
      },
      receivesLighting: true,
      // INTEGRATED settle: the ticker swings and damps to rest (overshoot).
      animationBindings: [
        {
          id: 'ab-wheel-pointer-settle',
          primitive: 'pendulum-settle',
          driver: 'time',
          params: { duration: 2.2, startAngleDeg: 34, swings: 4 },
          order: 0,
        },
      ],
    },
  ],
  preview: {
    // Face-on, slightly above and to one side so the chrome catches a rim and
    // the segments read clearly in a ~4:3 tile. Looking down the -Z facing axis.
    camera: { distance: 5.4, polar: Math.PI / 2.25, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.4,
    loopSeconds: 7,
    tier: 'T1',
  },
  // Warm studio key + soft fill so chrome and brass separate; additive — never
  // forces a hub-wide change unless the placement opts in.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.4,
    ambientIntensity: 0.28,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'PBR polished chrome + clearcoat',
    'brushed-metal turntable showcase',
    'damped pendulum settle physics',
    'Slider Revolution 3D rotating disc',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(wheelFortuneSpinner);

export default wheelFortuneSpinner;
