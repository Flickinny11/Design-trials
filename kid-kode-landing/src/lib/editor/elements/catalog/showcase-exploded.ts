// showcase-exploded — a premium product showcase on a turntable (§13 showcase
// element). A device-assembly centerpiece — a polished-chrome top cap, a
// brushed-metal body, a transmissive glass display lens, and an obsidian base
// plinth — SEATED TOGETHER as one COMPLETE assembled product, framed by an
// orbiting brass accent ring and a crisp MSDF caption. Real PBR (chrome /
// brushed metal / transmission glass / obsidian) under studio IBL — the way
// premium product sites present hardware turntables, not flat sprites.
//
// THE PREVIEW MOTION — a continuous turntable spin. Every layer of the
// assembled product carries a SYNCHRONIZED `spin` (same cycle / axis / origin)
// so the whole product revolves as one solid piece on a turntable, ALWAYS
// fully visible and assembled at every phase of the loop. The brass orbital
// ring keeps its own slow `spin` like an instrument gimbal. There is NO
// time-driven explode/assemble in the preview — the product never scatters.
// (The dramatic "exploded view" separation is reserved for an interactive
// event post-place; the integrated preview animation is the assembled
// turntable so the hover tile reads as a complete premium product throughout.)
//
// Every member is a real, editable PrismNode (move / recolor / re-skin / swap
// animation post-place). Photorealism is procedural PBR + IBL (free) — no
// generated imagery needed.
//
// Tier: T1 full-fidelity, clean T0 fallback (the stack still reads as lit
// chrome / brushed-metal / glass / obsidian layers + a crisp MSDF label without
// screen-space GI). INV-9. Palette = Observatory Brass (brass/gold + ice/steel
// blues + charcoal/obsidian) — NO purple.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// Identity-scale, axis-aligned local pose helper (cluster origin = 0,0,0; the
// instantiator offsets x/y/z by the drop anchor).
function poseAt(x: number, y: number, z: number, rotationY = 0): ScenePosition {
  return {
    x,
    y,
    z,
    rotationX: 0,
    rotationY,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };
}

// Seated-stack Y positions (scene units). The four components rest ON one
// another like a real ASSEMBLED product — no air gaps — recentred so the stack
// midpoint frames near y=0. Heights: plinth 0.22, lens 0.14, body 0.50, cap
// 0.26; each layer's centre is half its own height above the top of the layer
// below, then the whole stack is shifted down by STACK_CENTER so it sits in
// frame.
const STACK_CENTER = 0.45;
const Y_PLINTH = 0.0 - STACK_CENTER; // base, half-height 0.11 → bottom at -0.56
const Y_LENS = 0.18 - STACK_CENTER; // seats on plinth
const Y_BODY = 0.5 - STACK_CENTER; // seats on lens (the bulk)
const Y_CAP = 0.88 - STACK_CENTER; // crowns the body

// One shared turntable: every product layer carries an identical `spin` so the
// assembled product revolves as a single solid piece, fully visible at every
// phase. The orbital ring spins a touch slower for parallax.
const TURNTABLE = { cycle: 9, turns: 1, axis: 'y' as const };

const members: ClusterMemberTemplate[] = [
  // ── Top cap — polished chrome dome. The crown of the assembly; mirror-finish
  // chrome (metalness 1, very low roughness, full clearcoat) so it catches the
  // studio key as a hard specular highlight.
  {
    localId: 'cap',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Chrome top cap',
    renderMode: 'mesh',
    pose: poseAt(0, Y_CAP, 0),
    footprint: { width: 1.2, height: 0.5 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.58, height: 0.26, segments: 64 },
    },
    materialSpec: {
      baseColor: '#dfe4ec',
      metalness: 1,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.6,
    },
    receivesLighting: true,
    // INTEGRATED animation: a continuous turntable `spin` (same cycle/axis as
    // every other layer) so the assembled product revolves as one solid piece,
    // fully visible at every phase. No explode/scatter. Verified registry name.
    animationBindings: [
      {
        id: 'ab-showcase-cap-spin',
        primitive: 'spin',
        driver: 'time',
        params: TURNTABLE,
        order: 0,
      },
    ],
  },
  // ── Body — brushed-metal mid-section, the bulk of the product. Brushed brass
  // recipe (high metalness, mid roughness, warm envMap) — the warm anchor of
  // the Observatory Brass palette.
  {
    localId: 'body',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Brushed-metal body',
    renderMode: 'mesh',
    pose: poseAt(0, Y_BODY, 0),
    footprint: { width: 1.3, height: 0.7 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.62, height: 0.5, segments: 64 },
    },
    materialSpec: {
      baseColor: '#c9a86a',
      metalness: 0.95,
      roughness: 0.32,
      clearcoat: 0.3,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.3,
    },
    receivesLighting: true,
    animationBindings: [
      {
        id: 'ab-showcase-body-spin',
        primitive: 'spin',
        driver: 'time',
        params: TURNTABLE,
        order: 0,
      },
    ],
  },
  // ── Display lens — transmissive glass disc, the "screen" of the product.
  // Premium glass recipe (transmission + ior + dispersion + clearcoat) so it
  // refracts the layers behind it — the visual showpiece of the cross-section.
  {
    localId: 'lens',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Glass display lens',
    renderMode: 'mesh',
    pose: poseAt(0, Y_LENS, 0),
    footprint: { width: 1.25, height: 0.4 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.6, height: 0.14, segments: 64 },
    },
    materialSpec: {
      baseColor: '#bcd4e2',
      metalness: 0,
      roughness: 0.06,
      transmission: 0.92,
      ior: 1.5,
      dispersion: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      thickness: 0.5,
      envMapIntensity: 1.4,
    },
    receivesLighting: true,
    animationBindings: [
      {
        id: 'ab-showcase-lens-spin',
        primitive: 'spin',
        driver: 'time',
        params: TURNTABLE,
        order: 0,
      },
    ],
  },
  // ── Base plinth — obsidian foundation the product sits on. Dark, near-black
  // clearcoated obsidian (low roughness, mid metalness) so it grounds the
  // composition with a deep charcoal mass and a wet specular sheen.
  {
    localId: 'plinth',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Obsidian base plinth',
    renderMode: 'mesh',
    pose: poseAt(0, Y_PLINTH, 0),
    footprint: { width: 1.6, height: 0.5 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.78, height: 0.22, segments: 64 },
    },
    materialSpec: {
      baseColor: '#15171f',
      metalness: 0.7,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.1,
    },
    receivesLighting: true,
    animationBindings: [
      {
        id: 'ab-showcase-plinth-spin',
        primitive: 'spin',
        driver: 'time',
        params: TURNTABLE,
        order: 0,
      },
    ],
  },
  // ── Orbital accent ring — a thin brass torus encircling the assembled body,
  // a halo around the product. Carries a slow continuous `spin` (a touch slower
  // than the product turntable, for parallax) so it sweeps around the assembly
  // like an instrument gimbal while staying always visible.
  {
    localId: 'orbit-ring',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Brass orbital ring',
    renderMode: 'mesh',
    pose: poseAt(0, Y_BODY, 0, 0),
    footprint: { width: 2.4, height: 2.4 },
    meshPrimitive: {
      kind: 'torus',
      params: { radius: 1.1, tube: 0.045, segments: 96 },
    },
    materialSpec: {
      baseColor: '#d8c089',
      metalness: 0.92,
      roughness: 0.22,
      clearcoat: 0.5,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.4,
    },
    receivesLighting: true,
    cinematicPrimitives: [],
    animationBindings: [
      {
        id: 'ab-showcase-ring-spin',
        primitive: 'spin',
        driver: 'time',
        params: { cycle: 13, turns: 1, axis: 'y' },
        order: 0,
      },
    ],
  },
  // ── Caption — REAL MSDF text (INV-11), a product-render style label beneath
  // the assembled plinth. Modest font size so it frames inside the tile.
  {
    localId: 'caption',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Showcase caption',
    renderMode: 'text',
    pose: poseAt(0, Y_PLINTH - 0.41, 0.1),
    footprint: { width: 2.6, height: 0.4 },
    textSpec: {
      content: 'SHOWCASE',
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 0.32,
      align: 'center',
      letterSpacing: 0.08,
      fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 15 },
      decompose: 'glyph',
    },
  },
];

const showcaseExploded: ElementClusterDefinition = {
  id: 'showcase-exploded',
  label: 'Exploded View Showcase',
  category: 'showcase',
  caption: 'A premium assembled product revolving on a 3D turntable',
  description:
    'A PBR device — chrome cap, brushed body, glass lens, obsidian plinth — seated as one assembled product on a slow turntable, ringed by a spinning brass halo.',
  members,
  preview: {
    // Slight three-quarter elevation to read the assembled stack and the brass
    // halo; frames the full seated product + caption. Pulled in a touch now
    // that the layers are seated together rather than spread along Y.
    camera: { distance: 5.9, polar: Math.PI / 2.4, azimuth: Math.PI * 0.12 },
    // Pure turntable: every phase is a complete, fully-assembled still, so the
    // frozen frame just picks a flattering three-quarter angle.
    frozenPhase: 0.12,
    loopSeconds: 9,
    tier: 'T1',
  },
  // Warm-key studio look so chrome + glass + obsidian all catch specular and the
  // brushed brass reads warm. Additive recommendation; never forces a hub change.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.26,
    shadowSoftness: 0.6,
  },
  designRefs: [
    'premium product turntable showcase',
    'continuous spin / revolving hero render',
    'PBR transmission glass',
    'polished chrome + brushed metal layering',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(showcaseExploded);
export default showcaseExploded;
