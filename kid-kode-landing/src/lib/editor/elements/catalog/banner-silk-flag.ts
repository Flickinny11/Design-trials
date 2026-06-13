// banner-silk-flag — a silk banner rippling in wind, with a headline laid across
// it (§13 prebuilt-library, category `banner`). The SR-smashing move: instead of
// a CSS-flutter sprite, the cloth is a REAL XPBD wind-driven silk — a coarse
// pinned particle grid pushed by a steady breeze + swelling gusts + hashed
// turbulence (registry `flag-wind-sim`, `wave` category, subject `plane`,
// verified registered), so flapping ripples genuinely propagate from the pole
// down the free trailing edge. It is hung on a brushed-metal pole with a polished
// chrome finial, and a glyph-by-glyph MSDF headline (INV-11, never diffusion)
// reads across the silk.
//
// COMPOSITION (cluster-local origin 0,0,0; the instantiator offsets by the drop
// anchor): the pole stands on the LEFT, the silk plane hangs to its RIGHT pinned
// at its own left edge (matching flag-wind-sim's pole convention), a finial caps
// the pole, and the headline floats just in front of the silk's center.
//
// INTEGRATED animation:
//   • silk — `flag-wind-sim` (time-driven): emergent flapping cloth.
//   • pole — `light-sweep` (time-driven): one crisp specular streak glances down
//     the brushed metal so the pole reads photoreal even at rest.
//   • headline — `text-fade-up-each` (time-driven): each glyph rises + fades in,
//     staggered — the kinetic-typography flourish.
//
// Photorealism is procedural PBR + IBL (free): a satin silk material (low
// metalness, soft clearcoat sheen, a whisper of iridescence for the warp/weft
// shimmer) on the cloth, brushed metal on the pole, polished chrome on the
// finial. No fal imagery needed.
//
// Tier: T1 full-fidelity, clean T0 fallback (INV-9) — the silk still reads as a
// lit, rippling satin plane and the headline as crisp MSDF glyphs without
// screen-space GI; the cloth sim itself runs coarser (but never broken) at T0.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';

// ── Layout constants (cluster-local scene units) ───────────────────────────
// The silk plane is built at its native footprint; flag-wind-sim pins the
// plane's LEFT edge, so we seat the plane to the RIGHT of the pole and let the
// free trailing edge stream off toward +x.
const FLAG_W = 3.0;
const FLAG_H = 1.9;
const POLE_X = -FLAG_W / 2 - 0.18; // pole sits just left of the silk's pinned edge
const POLE_H = FLAG_H + 1.0; // pole rises above the cloth for the finial
const FLAG_CENTER_X = 0.04; // tiny offset so the cloth visually hugs the pole

const members: ClusterMemberTemplate[] = [
  // ── Pole — a tall brushed-metal cylinder the silk is pinned to. A single
  // specular streak (light-sweep) glances down it so it reads photoreal at rest.
  {
    localId: 'pole',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Banner pole',
    renderMode: 'mesh',
    pose: {
      x: POLE_X,
      y: 0.1,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    footprint: { width: 0.18, height: POLE_H },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.07, height: POLE_H, segments: 48 },
    },
    // Brushed metal: high metalness, mid-low roughness, strong env reflections.
    materialSpec: {
      baseColor: '#c9a86a',
      metalness: 0.95,
      roughness: 0.32,
      clearcoat: 0.4,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.3,
    },
    receivesLighting: true,
    // INTEGRATED animation: a clean specular band glances diagonally down the
    // pole (registry 'light-sweep', shimmer category, verified registered).
    animationBindings: [
      {
        id: 'ab-banner-pole-sweep',
        primitive: 'light-sweep',
        driver: 'time',
        params: { speed: 0.7, width: 0.16, angleDeg: 78, intensity: 1.4, tint: '#f4e6c4' },
        order: 0,
      },
    ],
  },
  // ── Finial — a polished-chrome sphere capping the pole (premium detail catch).
  {
    localId: 'finial',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Pole finial',
    renderMode: 'mesh',
    pose: {
      x: POLE_X,
      y: 0.1 + POLE_H / 2 + 0.04,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    footprint: { width: 0.34, height: 0.34 },
    meshPrimitive: {
      kind: 'sphere',
      params: { radius: 0.16, segments: 48 },
    },
    // Polished chrome: full metalness, near-zero roughness, full clearcoat.
    materialSpec: {
      baseColor: '#dfe4ec',
      metalness: 1.0,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.6,
    },
    receivesLighting: true,
  },
  // ── Silk — the centerpiece: a high-segment plane bearing a satin PBR material,
  // rippling as a REAL wind-driven XPBD cloth. flag-wind-sim caches this plane's
  // base vertices and pins its LEFT edge to the pole.
  {
    localId: 'silk',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Silk banner',
    renderMode: 'mesh',
    pose: {
      x: FLAG_CENTER_X,
      y: 0.35,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    footprint: { width: FLAG_W, height: FLAG_H },
    // Dense plane so the cloth ripples read smooth (the sim resamples onto it).
    meshPrimitive: {
      kind: 'plane',
      params: { width: FLAG_W, height: FLAG_H, segments: 64 },
    },
    // Satin silk: low metalness, soft sheen via clearcoat, a whisper of
    // iridescence for the warp/weft shimmer. Warm brass-gold weave (no purple).
    materialSpec: {
      baseColor: '#c9a86a',
      metalness: 0.25,
      roughness: 0.42,
      clearcoat: 0.55,
      clearcoatRoughness: 0.35,
      iridescence: 0.25,
      iridescenceIOR: 1.3,
      envMapIntensity: 1.0,
    },
    receivesLighting: true,
    // INTEGRATED animation: real XPBD wind-driven cloth (registry
    // 'flag-wind-sim', wave category, verified registered).
    animationBindings: [
      {
        id: 'ab-banner-silk-wind',
        primitive: 'flag-wind-sim',
        driver: 'time',
        params: { wind: 5.5, gust: 0.6, stiffness: 0.5, gravity: 3.0 },
        order: 0,
      },
    ],
  },
  // ── Headline — REAL MSDF text (INV-11) laid across the silk, rising
  // glyph-by-glyph. Modest fontSize so it frames inside the cluster tile.
  {
    localId: 'headline',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Banner headline',
    renderMode: 'text',
    pose: {
      x: FLAG_CENTER_X + 0.1,
      y: 0.35,
      z: 0.22, // float just in front of the silk surface
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    footprint: { width: 2.4, height: 0.5 },
    textSpec: {
      content: 'UNFURL',
      fontFamily: 'Inter',
      fontWeight: 800,
      fontSize: 0.4,
      align: 'center',
      letterSpacing: 0.05,
      fill: { kind: 'gradient', from: '#f1e0b0', to: '#acd0e2', angleDeg: 18 },
      decompose: 'glyph',
    },
    // INTEGRATED animation: a kinetic per-glyph rise-and-fade reveal (registry
    // 'text-fade-up-each', text category, verified registered).
    animationBindings: [
      {
        id: 'ab-banner-headline-reveal',
        primitive: 'text-fade-up-each',
        driver: 'time',
        params: { duration: 1.1, stagger: 0.08, rise: 0.35 },
        order: 0,
      },
    ],
  },
];

const bannerSilkFlag: ElementClusterDefinition = {
  id: 'banner-silk-flag',
  label: 'Silk Flag Banner',
  category: 'banner',
  caption: 'A silk banner rippling in real wind, headline streaming across it',
  description: 'A wind-driven XPBD silk flag on a brushed pole, with a kinetic MSDF headline.',
  members,
  preview: {
    // Frame the whole banner three-quarter, slightly above, so the pole, the
    // streaming silk, and the headline all fit a ~4:3 tile.
    camera: { distance: 6.4, polar: Math.PI / 2.2, azimuth: Math.PI * 0.12 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm studio key + soft fill at place time (additive; never forces a hub-wide
  // change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.15,
    ambientIntensity: 0.3,
    shadowSoftness: 0.6,
  },
  designRefs: [
    'real XPBD wind-driven cloth simulation',
    'satin silk PBR (clearcoat sheen + iridescent weave)',
    'kinetic typography reveal',
    'brushed-metal specular sweep',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(bannerSilkFlag);

export default bannerSilkFlag;
