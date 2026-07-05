// hero-liquid-metal — a molten-chrome hero centerpiece behind a kinetic
// headline (§13 prebuilt-library, hero category). A tall liquid-metal pillar
// (capsule monolith) is the SR-smashing move: its surface flows like mercury —
// bright specular highlights smear and merge across polished chrome — while an
// MSDF headline rises glyph-by-glyph in front of it. Two polished-chrome
// orbital rings (torus) frame the pillar, a brushed-brass plinth grounds it,
// and a softly-lit charcoal backdrop gives the chrome something rich to
// reflect. Every surface is real PBR (no textures), so it reads photoreal
// standalone — decisively past Slider Revolution's CSS-transform sliders.
//
// INTEGRATED animation:
//   • pillar — `liquid-metal-flow` (registry name VERIFIED present, shimmer
//     category): a flowing chrome reflection ripples across the monolith like
//     molten metal — this is the centerpiece's signature motion.
//   • headline — `text-fade-up-each` (registry name VERIFIED present, text
//     category): each glyph rises + fades in, staggered — the kinetic-text
//     flourish framed inside the tile.
//
// Photorealism is procedural PBR + studio IBL (free); no hero imagery needed.
//
// Tier: T2 full-fidelity (the liquid-metal shimmer + clearcoat + transmission
// orbital ring resolve richest with screen-space GI) — but it reads CLEAN at
// T0: the pillar is still a polished-chrome capsule, the rings still read as
// chrome torii, and the MSDF headline is crisp without any GI. INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';

// Observatory Brass palette — warm brass/gold + ice/steel blues + charcoal.
// NEVER purple. These are physically-plausible PBR colors, not chrome tints.
const CHROME = '#dfe6ef'; // polished steel-chrome (cool, near-white)
const BRASS = '#c9a86a'; // warm brushed brass
const CHARCOAL = '#15171f'; // obsidian backdrop
const ICE = '#9fc3d6'; // ice-steel accent

const members: ClusterMemberTemplate[] = [
  // ── Backdrop — a large charcoal/obsidian panel behind the hero so the
  // molten chrome has a deep, structured surface to reflect. Opted into
  // lighting for a soft gradient catch; reads as a clean dark slab at T0.
  {
    localId: 'backdrop',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Hero backdrop',
    renderMode: 'mesh',
    pose: {
      x: 0,
      y: 0.3,
      z: -1.6,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    footprint: { width: 5.6, height: 3.4 },
    meshPrimitive: {
      kind: 'plane',
      params: { width: 5.6, height: 3.4 },
    },
    materialSpec: {
      baseColor: CHARCOAL,
      metalness: 0.7,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.9,
    },
    receivesLighting: true,
  },
  // ── Plinth — a brushed-brass disc the pillar rises from, grounding the
  // composition and throwing a warm bounce up into the chrome.
  {
    localId: 'plinth',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Hero plinth',
    renderMode: 'mesh',
    pose: {
      x: 0,
      y: -1.15,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    footprint: { width: 1.7, height: 0.22 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.85, height: 0.18, segments: 64 },
    },
    materialSpec: {
      baseColor: BRASS,
      metalness: 0.95,
      roughness: 0.32,
      clearcoat: 0.4,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.3,
    },
    receivesLighting: true,
  },
  // ── Pillar — THE liquid-metal centerpiece. A tall polished-chrome capsule;
  // the integrated `liquid-metal-flow` shimmer makes its surface flow like
  // molten mercury. Mirror-bright chrome PBR (metalness 1, very low roughness,
  // full clearcoat) so the shimmer reads with maximum specular life.
  {
    localId: 'pillar',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Liquid-metal pillar',
    renderMode: 'mesh',
    pose: {
      x: 0,
      y: 0.05,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    footprint: { width: 0.9, height: 2.1 },
    meshPrimitive: {
      kind: 'capsule',
      params: { radius: 0.42, length: 1.2, segments: 48 },
    },
    materialSpec: {
      baseColor: CHROME,
      metalness: 1.0,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.6,
    },
    receivesLighting: true,
    // INTEGRATED animation: molten-chrome flow across the pillar surface.
    animationBindings: [
      {
        id: 'ab-hero-pillar-liquid',
        primitive: 'liquid-metal-flow',
        driver: 'time',
        params: {
          base: CHARCOAL,
          metal: CHROME,
          flow: 0.9,
          scale: 3.2,
          contrast: 1.15,
        },
        order: 0,
      },
    ],
  },
  // ── Orbital ring (front) — a polished-chrome torus encircling the pillar,
  // tipped toward camera. Premium chrome PBR; frames the centerpiece and
  // catches the studio key as a crisp specular arc.
  {
    localId: 'ring-front',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Chrome orbital ring',
    renderMode: 'mesh',
    pose: {
      x: 0,
      y: 0.05,
      z: 0.05,
      rotationX: 1.18, // ~67.5° — tipped toward camera so it reads as a ring
      rotationY: 0,
      rotationZ: 0.2,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    footprint: { width: 2.6, height: 2.6 },
    meshPrimitive: {
      kind: 'torus',
      params: { radius: 1.18, tube: 0.06, segments: 64 },
    },
    materialSpec: {
      baseColor: CHROME,
      metalness: 1.0,
      roughness: 0.09,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.6,
    },
    receivesLighting: true,
  },
  // ── Orbital ring (back) — a thinner ice-steel torus, larger and tipped the
  // other way, adding depth + a cool counterpoint to the warm plinth.
  {
    localId: 'ring-back',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Ice orbital ring',
    renderMode: 'mesh',
    pose: {
      x: 0,
      y: 0.1,
      z: -0.55,
      rotationX: 1.32,
      rotationY: 0,
      rotationZ: -0.28,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    footprint: { width: 3.2, height: 3.2 },
    meshPrimitive: {
      kind: 'torus',
      params: { radius: 1.5, tube: 0.04, segments: 64 },
    },
    materialSpec: {
      baseColor: ICE,
      metalness: 0.85,
      roughness: 0.16,
      clearcoat: 0.7,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.4,
    },
    receivesLighting: true,
  },
  // ── Headline — REAL MSDF text (INV-11), rising glyph-by-glyph in front of
  // the molten pillar. Modest fontSize so it frames inside the tile.
  {
    localId: 'headline',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Hero headline',
    renderMode: 'text',
    pose: {
      x: 0,
      y: -0.62,
      z: 0.9,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    footprint: { width: 3.0, height: 0.42 },
    textSpec: {
      content: 'MOLTEN',
      fontFamily: 'Inter',
      fontWeight: 800,
      fontSize: 0.4,
      align: 'center',
      letterSpacing: 0.06,
      fill: { kind: 'gradient', from: '#f0e7cf', to: '#9fc3d6', angleDeg: 18 },
      decompose: 'glyph',
    },
    // INTEGRATED animation: kinetic per-glyph rise-and-fade reveal.
    animationBindings: [
      {
        id: 'ab-hero-headline-reveal',
        primitive: 'text-fade-up-each',
        driver: 'time',
        params: { duration: 1.3, stagger: 0.08, rise: 0.42 },
        order: 0,
      },
    ],
  },
];

export const heroLiquidMetal: ElementClusterDefinition = {
  id: 'hero-liquid-metal',
  label: 'Liquid Metal Hero',
  category: 'hero',
  caption: 'A molten-chrome pillar flowing behind a kinetic headline',
  description: 'A liquid-metal centerpiece with chrome orbital rings and a glyph-by-glyph MSDF headline.',
  members,
  preview: {
    // Frame the full stack (rings + pillar + plinth + headline) from a gentle
    // three-quarter, slightly-above angle in a ~4:3 tile.
    camera: { distance: 6.4, polar: Math.PI / 2.2, azimuth: Math.PI * 0.08 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T2',
  },
  // Recommend a crisp studio look at place time (additive; never forces a
  // hub-wide change unless the placement opts in). Lower ambient + strong env
  // so the chrome specular and molten flow stay punchy.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.5,
    ambientIntensity: 0.22,
    shadowSoftness: 0.5,
  },
  designRefs: [
    'liquid-metal molten-chrome shimmer',
    'kinetic typography reveal',
    'photoreal PBR chrome + clearcoat',
    'studio IBL reflections',
  ],
  tier: 'T2',
  featured: true,
};

registerElement(heroLiquidMetal);

export default heroLiquidMetal;
