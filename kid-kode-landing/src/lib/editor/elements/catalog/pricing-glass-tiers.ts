// pricing-glass-tiers — three glass pricing-tier cards standing in a row, the
// center (featured) tier raised + pushed forward, with a clean specular light
// sweep gliding across it. The SR-smashing move: real refractive thick-glass
// tiers (transmission + ior + beveled chamfer that genuinely glints) instead of
// the flat blurred-`backdrop-filter` "glassmorphism" everyone ships — and the
// featured tier catches a moving light streak so the eye lands on it.
//
// Composition (cluster-local, origin 0,0,0):
//   • 3 upright thin-glass slabs in a row (x = -1.7, 0, +1.7). The middle slab
//     is taller, scaled up, and nudged +z toward the camera so it reads as the
//     recommended plan.
//   • A slim brass accent bar caps the top of each slab (Observatory Brass —
//     polished brass cylinder), giving the cool glass a warm anchor.
//   • A small brass crown torus floats above the featured slab as its "badge".
//   • Per-slab MSDF tier labels (BASIC / PRO / SCALE) sit framed inside each
//     slab face — real glyphs (INV-11), modest fontSize so they live inside the
//     tile, ice/brass gradient fill.
//
// INTEGRATED animation:
//   • every slab carries `bevel-glass` (registry 'bevel-glass', glass category,
//     verified) — the chamfered borders glint + the rim breathes, so the glass
//     reads thick and real even when frozen.
//   • the featured (center) slab ALSO carries `light-sweep` (registry
//     'light-sweep', shimmer category, verified) — a crisp diagonal specular
//     band glances across it on a loop, spotlighting the recommended tier.
//
// This is a TEMPLATE: every member is a real, editable PrismNode (move / recolor
// / re-skin / retier / swap the animation post-place). Photorealism is
// procedural PBR transmission glass + brass PBR + IBL (free) — no imagery needed.
//
// Tier: T2 full-fidelity (transmission + dispersion read best with screen-space
// GI), but it MUST still read clean at T0 — degraded, the slabs fall back to
// lit beveled panels with a brass cap and crisp MSDF labels; never broken. INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// ── Layout (scene units) ─────────────────────────────────────────────────────
const SLAB_W = 1.3;
const SLAB_H = 2.0;
const SLAB_DEPTH = 0.16;
const ROW_GAP = 1.7; // x-offset of the side tiers from center

// Tier definitions left→right. The center tier is the featured "recommended"
// plan: taller, scaled up, pushed toward the camera, and it gets the sweep.
interface TierDef {
  localId: string;
  x: number;
  z: number;
  /** Vertical lift so the featured tier rises above its neighbours. */
  yLift: number;
  /** Uniform scale of the slab group (featured reads larger). */
  scale: number;
  label: string;
  /** Glass tint baseColor (subtle — ice/steel; the featured tier warms toward brass). */
  tint: string;
  featured: boolean;
}

const TIERS: TierDef[] = [
  {
    localId: 'tier-basic',
    x: -ROW_GAP,
    z: 0,
    yLift: 0,
    scale: 0.92,
    label: 'BASIC',
    tint: '#aebfcb', // pewter ice
    featured: false,
  },
  {
    localId: 'tier-pro',
    x: 0,
    z: 0.55, // nudged forward — recommended plan
    yLift: 0.22,
    scale: 1.08,
    label: 'PRO',
    tint: '#d8c089', // warm pale gold — the hero tier glows brass
    featured: true,
  },
  {
    localId: 'tier-scale',
    x: ROW_GAP,
    z: 0,
    yLift: 0,
    scale: 0.92,
    label: 'SCALE',
    tint: '#9fc3d6', // ice steel blue
    featured: false,
  },
];

/** A full ScenePosition (all 9 fields) from a partial; identity defaults. */
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

function buildTier(t: TierDef): ClusterMemberTemplate[] {
  const members: ClusterMemberTemplate[] = [];
  const slabH = SLAB_H * t.scale;
  const slabW = SLAB_W * t.scale;
  const baseY = t.yLift;

  // ── The glass slab ──────────────────────────────────────────────────────
  // Thick refractive glass: transmission + ior + clearcoat + a tiny dispersion.
  // The `bevel-glass` binding swaps in a chamfered-normal material at play time
  // for the glinting rim; the materialSpec below is the standalone / frozen /
  // T0-fallback look (still reads as luminous thick glass without the binding).
  members.push({
    localId: t.localId,
    subtype: 'card',
    serviceTag: 'decor',
    caption: `${t.label} tier glass card`,
    renderMode: 'mesh',
    pose: pose({ x: t.x, y: baseY, z: t.z }),
    footprint: { width: slabW, height: slabH },
    meshPrimitive: {
      kind: 'cube',
      params: { width: slabW, height: slabH, depth: SLAB_DEPTH },
    },
    materialSpec: {
      baseColor: t.tint,
      metalness: 0.0,
      roughness: 0.06,
      transmission: 0.92,
      ior: 1.5,
      dispersion: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      thickness: 0.5,
      envMapIntensity: 1.4,
      opacity: 1,
    },
    receivesLighting: true,
    // INTEGRATED animation #1: beveled-glass rim glint on every tier. Featured
    // tier gets a faster, brighter shimmer to draw the eye; side tiers calmer.
    animationBindings: [
      {
        id: `ab-${t.localId}-bevel`,
        primitive: 'bevel-glass',
        driver: 'time',
        params: {
          bevel: 0.18,
          thickness: t.featured ? 1.7 : 1.3,
          ior: 1.5,
          shimmer: t.featured ? 0.7 : 0.4,
        },
        order: 0,
      },
      // INTEGRATED animation #2 (featured only): a crisp specular light sweep
      // glides diagonally across the recommended tier, spotlighting it.
      ...(t.featured
        ? [
            {
              id: `ab-${t.localId}-sweep`,
              primitive: 'light-sweep',
              driver: 'time' as const,
              params: {
                speed: 0.8,
                width: 0.16,
                angleDeg: 32,
                intensity: 1.8,
                tint: '#f3e4bb', // warm brass-white streak
              },
              order: 1,
            },
          ]
        : []),
    ],
  });

  // ── Brass accent crown — a slim polished-brass bar across the top of the
  // FEATURED slab only: the Observatory Brass "recommended plan" crown, warm
  // metal against the cool glass. (Side tiers stay pure glass so the eye reads
  // the brass-capped middle tier as the hero.) Keeps the member count tight.
  if (t.featured) {
    members.push({
      localId: `${t.localId}-cap`,
      subtype: 'element',
      serviceTag: 'decor',
      caption: `${t.label} tier brass crown`,
      renderMode: 'mesh',
      pose: pose({
        x: t.x,
        y: baseY + slabH / 2 + 0.06,
        z: t.z,
        // lay the cylinder on its side so it reads as a horizontal bar
        rotationZ: Math.PI / 2,
      }),
      footprint: { width: slabW, height: 0.12 },
      meshPrimitive: {
        kind: 'cylinder',
        params: { radius: 0.05, height: slabW * 0.92, segments: 32 },
      },
      materialSpec: {
        // polished chrome-ish brass: high metalness, low roughness, clearcoat
        baseColor: '#c9a86a',
        metalness: 0.95,
        roughness: 0.16,
        clearcoat: 1.0,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.5,
      },
      receivesLighting: true,
    });
  }

  // ── MSDF tier label — real glyphs (INV-11), framed inside the slab face.
  // Modest fontSize so the word lives inside the tile, ice→brass gradient fill.
  members.push({
    localId: `${t.localId}-label`,
    subtype: 'text',
    serviceTag: 'decor',
    caption: `${t.label} tier label`,
    renderMode: 'text',
    pose: pose({
      x: t.x,
      y: baseY + slabH * 0.18,
      z: t.z + SLAB_DEPTH / 2 + 0.02, // sit just in front of the glass face
    }),
    footprint: { width: slabW * 0.82, height: 0.34 },
    textSpec: {
      content: t.label,
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: t.featured ? 0.34 : 0.3,
      align: 'center',
      letterSpacing: 0.06,
      fill: { kind: 'gradient', from: '#f0e2b6', to: '#9fc3d6', angleDeg: 18 },
      decompose: 'glyph',
    },
  });

  return members;
}

const pricingGlassTiers: ElementClusterDefinition = {
  id: 'pricing-glass-tiers',
  label: 'Glass Pricing Tiers',
  category: 'pricing',
  caption: 'Three refractive glass tiers with a sweep on the featured plan',
  description:
    'Thick refractive-glass pricing cards in a row — the recommended tier rises forward and catches a sweeping light streak.',
  members: TIERS.flatMap(buildTier),
  preview: {
    // Frame all three slabs three-quarter, slightly above, so the forward
    // featured tier and the brass caps all read in a ~4:3 tile.
    camera: { distance: 7.4, polar: Math.PI / 2.25, azimuth: Math.PI * 0.08 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T2',
  },
  // Warm studio key + soft shadows so the brass caps glint and the glass picks
  // up real environment reflections (additive recommendation at place time).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.26,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'PBR transmission glass',
    'beveled-glass refraction',
    'specular light-sweep highlight',
    'Observatory Brass accent metalwork',
  ],
  tier: 'T2',
  featured: true,
};

registerElement(pricingGlassTiers);
export default pricingGlassTiers;
