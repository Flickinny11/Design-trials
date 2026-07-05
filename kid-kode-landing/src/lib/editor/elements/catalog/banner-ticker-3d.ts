// banner-ticker-3d — an extruded 3D ticker banner: a word rides a brushed-brass
// rail and is endlessly repeated as it scrolls, every glyph punched forward out
// of the strip so the marquee reads as solid 3D type, not a CSS scroll. The
// SR-smashing move: a stadium-style ticker board rendered with real PBR — a
// brass plinth, an obsidian back-rail for depth, two polished-chrome end-caps
// framing the strip like a marquee sign, and an MSDF word that BOTH extrudes
// (glyphs gain depth, `text-extrude`) AND marches (ghost echoes trail it in an
// infinite belt, `scroll-marquee`) so the words repeat forever down the rail.
//
// INTEGRATED animation:
//   • ticker — `scroll-marquee` (registry 'scroll-marquee', scroll category,
//     verified registered): the text becomes an endless belt; ghost echoes of
//     the live word trail it laterally, wrapping in both directions — the
//     repeating-words ticker. Scroll-driven, with a time-fallback sweep so the
//     library tile animates without a host scroll.
//   • ticker — `text-extrude` (registry 'text-extrude', text category,
//     verified registered): each glyph punches forward (position.z 0→depth) in
//     staggered sequence with a back-overshoot pop, so the marching word reads
//     as extruded 3D letterforms rather than a flat decal. Two integrated
//     bindings stacked on one member (order 0 then 1).
//
// This is a TEMPLATE Phase 2 copies: every member is a real, editable PrismNode
// (move/scale/recolor/re-skin/swap animation post-place). Photorealism is
// procedural PBR + IBL (free) — no hero imagery needed for this element.
//
// Tier: T1 full-fidelity, clean T0 fallback — the brass rail, obsidian back,
// chrome caps and crisp MSDF word all still read as lit metal + sharp glyphs
// without screen-space GI (INV-9). Palette: Observatory Brass (brass/gold +
// obsidian + polished-chrome) and an ice-blue text gradient. No purple.

import { registerElement } from '../registry';
import type { ClusterMemberTemplate, ElementClusterDefinition } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// ── Strip geometry (scene units) ─────────────────────────────────────────────
const RAIL_LENGTH = 4.6; // the long horizontal ticker bed
const RAIL_HEIGHT = 0.7;
const RAIL_DEPTH = 0.34;
const CAP_WIDTH = 0.26; // polished-chrome end-caps that frame the strip
const CAP_OVERHANG = 0.12; // caps stand slightly taller than the rail

/** A full ScenePosition with all 9 fields, identity rotation/scale unless set. */
function pose(
  x: number,
  y: number,
  z: number,
  over: Partial<ScenePosition> = {},
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
    ...over,
  };
}

const members: ClusterMemberTemplate[] = [
  // ── Back-rail — an obsidian slab behind the brass bed, giving the strip
  // depth and a dark field for the chrome + glyphs to reflect against.
  {
    localId: 'back-rail',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Ticker back rail',
    renderMode: 'mesh',
    pose: pose(0, 0, -0.28),
    footprint: { width: RAIL_LENGTH + 0.3, height: RAIL_HEIGHT + 0.34 },
    meshPrimitive: {
      kind: 'cube',
      params: { width: RAIL_LENGTH + 0.3, height: RAIL_HEIGHT + 0.34, depth: 0.18 },
    },
    // Obsidian: near-black, semi-metallic, glassy clearcoat (premium recipe).
    materialSpec: {
      baseColor: '#15171f',
      metalness: 0.7,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.1,
    },
    receivesLighting: true,
    depthLayer: 'background',
  },
  // ── Rail bed — the brushed-brass extruded plinth the words ride along. The
  // hero surface of the banner: warm brass, high metalness, a touch of
  // clearcoat so the studio key glances across it.
  {
    localId: 'rail-bed',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Ticker brass rail',
    renderMode: 'mesh',
    pose: pose(0, 0, 0),
    footprint: { width: RAIL_LENGTH, height: RAIL_HEIGHT },
    meshPrimitive: {
      kind: 'cube',
      params: { width: RAIL_LENGTH, height: RAIL_HEIGHT, depth: RAIL_DEPTH },
    },
    // Brushed metal recipe (brass).
    materialSpec: {
      baseColor: '#c9a86a',
      metalness: 0.95,
      roughness: 0.32,
      clearcoat: 0.5,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1.3,
    },
    receivesLighting: true,
  },
  // ── Left end-cap — a polished-chrome post framing the strip like a marquee
  // board edge; mirror-bright so it anchors the composition.
  {
    localId: 'cap-left',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Ticker end cap (left)',
    renderMode: 'mesh',
    pose: pose(-(RAIL_LENGTH / 2 + CAP_WIDTH / 2 - 0.02), 0, 0.02),
    footprint: { width: CAP_WIDTH, height: RAIL_HEIGHT + CAP_OVERHANG },
    meshPrimitive: {
      kind: 'cube',
      params: { width: CAP_WIDTH, height: RAIL_HEIGHT + CAP_OVERHANG, depth: RAIL_DEPTH + 0.06 },
    },
    // Polished chrome recipe.
    materialSpec: {
      baseColor: '#d6dde6',
      metalness: 1.0,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.6,
    },
    receivesLighting: true,
  },
  // ── Right end-cap — mirror of the left, completing the marquee frame.
  {
    localId: 'cap-right',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Ticker end cap (right)',
    renderMode: 'mesh',
    pose: pose(RAIL_LENGTH / 2 + CAP_WIDTH / 2 - 0.02, 0, 0.02),
    footprint: { width: CAP_WIDTH, height: RAIL_HEIGHT + CAP_OVERHANG },
    meshPrimitive: {
      kind: 'cube',
      params: { width: CAP_WIDTH, height: RAIL_HEIGHT + CAP_OVERHANG, depth: RAIL_DEPTH + 0.06 },
    },
    materialSpec: {
      baseColor: '#d6dde6',
      metalness: 1.0,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.6,
    },
    receivesLighting: true,
  },
  // ── Ticker word — REAL MSDF text (INV-11), riding the rail just proud of the
  // brass face. This is the animated member: it BOTH extrudes (glyphs punch
  // forward) AND marches (ghost echoes wrap the strip), so the marquee reads
  // as repeating 3D type. Modest fontSize so the word frames inside the bed.
  {
    localId: 'ticker-word',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Ticker word',
    renderMode: 'text',
    pose: pose(0, 0, RAIL_DEPTH / 2 + 0.04),
    footprint: { width: 2.4, height: 0.42 },
    textSpec: {
      content: 'NOW SHOWING',
      fontFamily: 'Inter',
      fontWeight: 800,
      fontSize: 0.38,
      align: 'center',
      letterSpacing: 0.06,
      // Ice-blue → pale-gold gradient pigment poured into real letterforms.
      fill: { kind: 'gradient', from: '#dfeaf2', to: '#c9a86a', angleDeg: 0 },
      decompose: 'glyph',
    },
    receivesLighting: false, // MSDF glyphs carry their own fill; stay crisp/unlit
    depthLayer: 'foreground-FX',
    // INTEGRATED animation — two stacked bindings on the word:
    //   order 0: scroll-marquee → endless belt of ghost echoes (the ticker).
    //   order 1: text-extrude  → glyphs punch forward (the 3D extrusion).
    animationBindings: [
      {
        id: 'ab-banner-ticker-marquee',
        primitive: 'scroll-marquee',
        driver: 'scroll',
        params: { gap: 0.45, ghosts: 3, dim: 0.5, reverse: false },
        order: 0,
      },
      {
        id: 'ab-banner-ticker-extrude',
        primitive: 'text-extrude',
        driver: 'time',
        params: { duration: 1.6, depth: 0.28, stagger: 0.55 },
        order: 1,
      },
    ],
  },
];

const bannerTicker3d: ElementClusterDefinition = {
  id: 'banner-ticker-3d',
  label: '3D Ticker Banner',
  category: 'banner',
  caption: 'An extruded brass ticker rail scrolling repeating words',
  description: 'A brushed-brass marquee rail where extruded MSDF words march in an endless belt.',
  members,
  preview: {
    // Frame the whole rail from a slight three-quarter so the extrusion depth
    // and the chrome end-caps read; the long strip fits a ~4:3 tile.
    camera: { distance: 6.4, polar: Math.PI / 2.3, azimuth: Math.PI * 0.08 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm studio key at place time so the brass + chrome catch a glancing
  // highlight (additive; never forces a hub-wide change unless opted in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.3,
    ambientIntensity: 0.26,
    shadowSoftness: 0.5,
  },
  designRefs: [
    'infinite scroll marquee belt',
    'extruded 3D kinetic typography',
    'brushed-metal PBR signage',
    'polished-chrome framing',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(bannerTicker3d);
export default bannerTicker3d;
