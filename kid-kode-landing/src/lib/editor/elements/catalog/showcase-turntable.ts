// showcase-turntable — a photoreal product turntable (§13 showcase element). A
// premium centerpiece sits on a brushed-metal platter under a moving spotlight,
// the whole rig framed by a polished-chrome accent ring and a soft backdrop so
// it reads photoreal standalone. This is the Slider-Revolution-killer "product
// turntable" trope rendered with real PBR + IBL instead of a CSS sprite spin:
// brushed anisotropic metal, obsidian clearcoat, chrome reflections, and a
// glass cap that catches a pointer-tracked specular hotspot.
//
// COMPOSITION (cluster-local, origin 0,0,0 — the instantiator offsets by the
// drop anchor): a wide pewter backdrop at the rear; a thick brushed-aluminium
// disc as the platter; an obsidian capsule product standing on the platter; a
// polished-chrome torus hugging the platter rim; a small clearcoat-glass cap
// crowning the product; and an MSDF label plate reading the product name.
//
// INTEGRATED animation (3 real registry primitives, all verified registered):
//   • product  — `spin` (transform / time): the centerpiece turns continuously
//     about Y, the turntable motion. Slow, premium, looping.
//   • platter  — `brushed-metal` (shimmer / time): an anisotropic brushed sheen
//     sweeps across the disc, the highlight stretched along the turned grain.
//   • glass cap — `spotlight-follow` (pointer): a bright specular hotspot tracks
//     the cursor across the cap like a stage light gliding over the product —
//     the "moving spotlight". Pointer-driven, so it idles with a faint drift and
//     comes alive on hover (the preview tile's hero gesture).
//
// Photorealism is procedural PBR + lighting (free) — no hero imagery needed.
//
// Tier: T2 full-fidelity (screen-space GI/AO + SSR sweeten the chrome ring and
// glass cap on capable desktops). MUST still read clean at T0: the brushed
// platter, obsidian product, chrome ring, and crisp MSDF label all survive as
// lit PBR surfaces with IBL alone — never broken. INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// Identity scale/rotation pose helper — fill the 9-field ScenePosition with a
// position + optional rotationY/scale so each member declaration stays terse
// while remaining a FULL ScenePosition (all 9 fields present).
function pose(
  x: number,
  y: number,
  z: number,
  opts: Partial<Pick<ScenePosition, 'rotationX' | 'rotationY' | 'rotationZ' | 'scaleX' | 'scaleY' | 'scaleZ'>> = {},
): ScenePosition {
  return {
    x,
    y,
    z,
    rotationX: opts.rotationX ?? 0,
    rotationY: opts.rotationY ?? 0,
    rotationZ: opts.rotationZ ?? 0,
    scaleX: opts.scaleX ?? 1,
    scaleY: opts.scaleY ?? 1,
    scaleZ: opts.scaleZ ?? 1,
  };
}

const PLATTER_RADIUS = 1.45;

const members: ClusterMemberTemplate[] = [
  // ── Backdrop — a wide, softly-lit charcoal-steel panel behind the rig so the
  // chrome ring + glass cap have structure to reflect and the scene reads with
  // depth. Plane opted into lighting for a gentle gradient catch.
  {
    localId: 'backdrop',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Showcase backdrop',
    renderMode: 'mesh',
    pose: pose(0, 0.9, -1.9),
    footprint: { width: 6, height: 4 },
    meshPrimitive: { kind: 'plane', params: { width: 6, height: 4 } },
    materialSpec: {
      baseColor: '#262b35',
      metalness: 0.3,
      roughness: 0.58,
      clearcoat: 0.18,
      envMapIntensity: 0.85,
    },
    receivesLighting: true,
    depthLayer: 'background',
  },

  // ── Platter — the brushed-aluminium turntable disc. A thick, low cylinder in
  // warm steel; carries the INTEGRATED `brushed-metal` sheen so an anisotropic
  // highlight sweeps along the turned grain (the lathe look). This is the stage
  // the product rotates on.
  {
    localId: 'platter',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Brushed-metal turntable',
    renderMode: 'mesh',
    pose: pose(0, -0.62, 0),
    footprint: { width: PLATTER_RADIUS * 2, height: PLATTER_RADIUS * 2 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: PLATTER_RADIUS, height: 0.22, segments: 96 },
    },
    materialSpec: {
      // Brushed metal recipe (per the catalog plan): high metalness, mid-low
      // roughness, lifted env reflections — warm brushed steel, not purple.
      baseColor: '#aeb4c0',
      metalness: 0.95,
      roughness: 0.32,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.3,
    },
    receivesLighting: true,
    // INTEGRATED animation: a slow brushed-grain sheen sweep (time-driven).
    animationBindings: [
      {
        id: 'ab-showcase-platter-brushed',
        primitive: 'brushed-metal',
        driver: 'time',
        params: { speed: 0.55, grainFreq: 72, intensity: 1.2, width: 0.26 },
        order: 0,
      },
    ],
  },

  // ── Accent ring — a polished-chrome torus hugging the platter rim, the
  // premium frame that catches the studio rig as a crisp specular line. Pure
  // mirror chrome (clearcoat 1, near-zero roughness, lifted env).
  {
    localId: 'accent-ring',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Chrome accent ring',
    renderMode: 'mesh',
    // Lay flat on the platter: rotate the torus so its plane is horizontal.
    pose: pose(0, -0.5, 0, { rotationX: Math.PI / 2 }),
    footprint: { width: PLATTER_RADIUS * 2.1, height: PLATTER_RADIUS * 2.1 },
    meshPrimitive: {
      kind: 'torus',
      params: { radius: PLATTER_RADIUS * 0.99, tube: 0.05, segments: 96 },
    },
    materialSpec: {
      // Polished chrome recipe.
      baseColor: '#dfe4ec',
      metalness: 1.0,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.6,
    },
    receivesLighting: true,
  },

  // ── Product — the obsidian centerpiece, a tall capsule standing on the
  // platter. Deep near-black clearcoat (the "obsidian" recipe) so it reads as a
  // glossy premium object turning under the light. Carries the INTEGRATED
  // `spin` — the turntable rotation about Y.
  {
    localId: 'product',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Showcase product',
    renderMode: 'mesh',
    pose: pose(0, 0.18, 0),
    footprint: { width: 0.9, height: 1.6 },
    meshPrimitive: {
      kind: 'capsule',
      params: { radius: 0.34, length: 0.74, segments: 48 },
    },
    materialSpec: {
      // Obsidian recipe: very dark, mid-metal, low roughness, full clearcoat.
      baseColor: '#15171f',
      metalness: 0.7,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.35,
    },
    receivesLighting: true,
    // INTEGRATED animation: a slow continuous turntable spin about Y.
    animationBindings: [
      {
        id: 'ab-showcase-product-spin',
        primitive: 'spin',
        driver: 'time',
        params: { cycle: 6, turns: 1, axis: 'y' },
        order: 0,
      },
    ],
  },

  // ── Glass cap — a small clearcoat-glass dome crowning the product, the
  // surface the moving spotlight glides over. Carries the INTEGRATED
  // `spotlight-follow` (pointer): a bright specular hotspot tracks the cursor
  // across the cap like a stage light — the headline "moving spotlight" gesture.
  {
    localId: 'spotlight-cap',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Spotlight cap',
    renderMode: 'mesh',
    pose: pose(0, 1.02, 0),
    footprint: { width: 0.7, height: 0.7 },
    meshPrimitive: { kind: 'sphere', params: { radius: 0.3, segments: 64 } },
    materialSpec: {
      // Clearcoat glass recipe — light transmission + dispersion, mirror clearcoat.
      baseColor: '#dce6f2',
      metalness: 0.0,
      roughness: 0.06,
      transmission: 0.9,
      ior: 1.5,
      dispersion: 0.04,
      thickness: 0.4,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.5,
    },
    receivesLighting: true,
    animationBindings: [
      {
        id: 'ab-showcase-cap-spotlight',
        primitive: 'spotlight-follow',
        driver: 'pointer',
        params: { radius: 0.34, intensity: 2.2, tint: '#fff3d8' },
        order: 0,
      },
    ],
  },

  // ── Label — REAL MSDF text (INV-11, never diffusion). A modest brass-to-ice
  // gradient product name on a plate below the platter. fontSize kept small
  // (0.34) so it frames inside the tile.
  {
    localId: 'label',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Product label',
    renderMode: 'text',
    pose: pose(0, -1.12, 0.4),
    footprint: { width: 2.6, height: 0.42 },
    textSpec: {
      content: 'OBSIDIAN ONE',
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 0.34,
      align: 'center',
      letterSpacing: 0.06,
      fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 12 },
      decompose: 'glyph',
    },
  },
];

const showcaseTurntable: ElementClusterDefinition = {
  id: 'showcase-turntable',
  label: 'Turntable Showcase',
  category: 'showcase',
  caption: 'A product turning on a brushed-metal platter under a moving spotlight',
  description:
    'An obsidian centerpiece spins on a brushed-aluminium turntable, framed by a chrome ring, with a pointer-tracked spotlight gliding over its glass cap.',
  members,
  preview: {
    // Three-quarter hero framing from slightly above so the platter, ring,
    // product, cap, and label all sit inside a ~4:3 tile.
    camera: { distance: 6.4, polar: Math.PI / 2.4, azimuth: Math.PI * 0.12 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T2',
  },
  // Warm-key studio recommendation at place time (additive; never forces a
  // hub-wide change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.26,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'turntable product showcase',
    'brushed-metal anisotropic sheen',
    'magnetic spotlight cursor physics',
    'PBR transmission glass cap',
  ],
  tier: 'T2',
  featured: true,
};

registerElement(showcaseTurntable);

export default showcaseTurntable;
