// slider-distortion-fade — a photoreal full-bleed slider whose slides crossfade
// THROUGH a liquid swirl/ripple distortion instead of a flat opacity dissolve
// (the Slider-Revolution-killing move). Composition reads as a real slider:
//   • slide-current  — the centerpiece glass slide caught mid-crossfade, its
//                       surface twisted into a whirlpool that unwinds to flat.
//   • slide-incoming — the next slide queued behind-right, rippling in from a
//                       strong sine warp that calms to a resting surface.
//   • slide-outgoing — the departing slide behind-left (polished obsidian).
//   • frame-rail     — a polished-brass track the slides ride on.
//   • dot-active / dot-rest-1 / dot-rest-2 — brass + ice pagination dots.
//   • caption        — a real MSDF label (INV-11, never diffusion).
//
// INTEGRATED animation:
//   • slide-current  carries `swirl-warp` (registry, displacement category,
//     subject:card, driver:time, VERIFIED) — the whirlpool crossfade twist.
//   • slide-incoming carries `wave-distort-in` (registry, displacement,
//     subject:plane, driver:time, VERIFIED) — the rippling settle of the next
//     slide. Together they read as one liquid distortion crossfade.
//
// Photorealism is procedural PBR + IBL (free): glass transmission/dispersion on
// the live slide, polished obsidian clearcoat on the outgoing slide, brushed/
// chrome brass on the rail and dots. Palette = Observatory Brass (warm brass +
// ice/steel blue + charcoal); NO purple. No fal imagery needed.
//
// Tier: T2 full-fidelity (transmission + dispersion + screen-space GI read
// best at T2) — but reads CLEAN at T0: the slide still presents as a lit glass
// panel on a brass rail with crisp MSDF caption, never broken. INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// Slide panel footprint (scene units) — a wide 16:10-ish full-bleed slide.
const SLIDE_W = 2.4;
const SLIDE_H = 1.5;
const SLIDE_DEPTH = 0.07;

// Pagination dot radius + spacing along the bottom rail.
const DOT_RADIUS = 0.07;
const DOT_GAP = 0.34;
const DOT_Y = -1.18;

/** A full ScenePosition (all 9 fields) at a translation, identity rot/scale. */
function poseAt(
  x: number,
  y: number,
  z: number,
  overrides: Partial<ScenePosition> = {},
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
    ...overrides,
  };
}

const members: ClusterMemberTemplate[] = [
  // ── frame-rail — a polished-brass track the slides ride on. A thin, wide
  // cylinder laid on its side under the slides; brushed/polished brass PBR so
  // it catches a hot specular sweep and reads as a real machined rail.
  {
    localId: 'frame-rail',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Slider rail',
    renderMode: 'mesh',
    pose: poseAt(0, -0.92, -0.05, { rotationZ: Math.PI / 2 }),
    footprint: { width: 3.0, height: 0.18 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.09, height: 3.0, segments: 48 },
    },
    materialSpec: {
      baseColor: '#c9a86a', // brass
      metalness: 0.95,
      roughness: 0.32,
      clearcoat: 0.5,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.3,
    },
    receivesLighting: true,
  },

  // ── slide-outgoing — the slide that just left, parked behind-left in
  // polished obsidian. Slightly receded + tilted so it reads as depth-stacked
  // behind the live slide. Obsidian recipe: near-black, high clearcoat.
  {
    localId: 'slide-outgoing',
    subtype: 'card',
    serviceTag: 'decor',
    caption: 'Previous slide',
    renderMode: 'mesh',
    pose: poseAt(-1.35, 0.06, -0.7, { rotationY: 0.42, scaleX: 0.86, scaleY: 0.86, scaleZ: 0.86 }),
    footprint: { width: SLIDE_W, height: SLIDE_H },
    meshPrimitive: {
      kind: 'cube',
      params: { width: SLIDE_W, height: SLIDE_H, depth: SLIDE_DEPTH },
    },
    materialSpec: {
      baseColor: '#15171f', // obsidian
      metalness: 0.7,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.4,
    },
    receivesLighting: true,
  },

  // ── slide-incoming — the NEXT slide, queued behind-right, rippling in from a
  // strong sine warp that calms to flat. A lit plane (so the warp displaces
  // visible vertices) wearing a cool ice-steel PBR. Carries `wave-distort-in`.
  {
    localId: 'slide-incoming',
    subtype: 'card',
    serviceTag: 'decor',
    caption: 'Next slide',
    renderMode: 'mesh',
    pose: poseAt(1.35, 0.06, -0.7, { rotationY: -0.42, scaleX: 0.86, scaleY: 0.86, scaleZ: 0.86 }),
    footprint: { width: SLIDE_W, height: SLIDE_H },
    meshPrimitive: {
      // A finely-tessellated plane so the CPU vertex ripple of wave-distort-in
      // has geometry to displace (the warp travels across the surface).
      kind: 'plane',
      params: { width: SLIDE_W, height: SLIDE_H, segments: 48 },
    },
    materialSpec: {
      baseColor: '#9fc3d6', // ice steel
      metalness: 0.55,
      roughness: 0.22,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.2,
    },
    receivesLighting: true,
    // INTEGRATED animation: the incoming slide ripples in from a sine warp and
    // settles flat — the liquid half of the distortion crossfade.
    animationBindings: [
      {
        id: 'ab-slider-distortion-incoming-wave',
        primitive: 'wave-distort-in',
        driver: 'time',
        params: { duration: 2.2, freq: 8, amplitude: 0.5 },
        order: 0,
      },
    ],
  },

  // ── slide-current — the live centerpiece slide, caught mid-crossfade with its
  // surface twisted into a whirlpool that unwinds to flat. Premium dispersive
  // GLASS (transmission + dispersion + clearcoat) so the swirl refracts the
  // rail + dots behind it. Carries `swirl-warp` (subject:card).
  {
    localId: 'slide-current',
    subtype: 'card',
    serviceTag: 'decor',
    caption: 'Active slide',
    renderMode: 'mesh',
    pose: poseAt(0, 0.1, 0.05),
    footprint: { width: SLIDE_W, height: SLIDE_H },
    meshPrimitive: {
      kind: 'cube',
      params: { width: SLIDE_W, height: SLIDE_H, depth: SLIDE_DEPTH },
    },
    materialSpec: {
      baseColor: '#dfe9f2', // bright ice glass
      metalness: 0.0,
      roughness: 0.06,
      transmission: 0.92,
      ior: 1.5,
      dispersion: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      thickness: 0.5,
      envMapIntensity: 1.6,
    },
    receivesLighting: true,
    // INTEGRATED animation: the whirlpool crossfade twist that unwinds to flat
    // as the slide resolves — the SR-killer distortion move.
    animationBindings: [
      {
        id: 'ab-slider-distortion-current-swirl',
        primitive: 'swirl-warp',
        driver: 'time',
        params: { duration: 2.2, swirl: 4.5, curve: 'expoOut', tint: '#c9a86a' },
        order: 0,
      },
    ],
  },

  // ── dot-active — the active pagination dot, bright brass under the live
  // slide. Small polished-chrome-brass sphere.
  {
    localId: 'dot-active',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Active page dot',
    renderMode: 'mesh',
    pose: poseAt(0, DOT_Y, 0.1, { scaleX: 1.35, scaleY: 1.35, scaleZ: 1.35 }),
    footprint: { width: DOT_RADIUS * 2, height: DOT_RADIUS * 2 },
    meshPrimitive: {
      kind: 'sphere',
      params: { radius: DOT_RADIUS, segments: 32 },
    },
    materialSpec: {
      baseColor: '#e8d6a6', // bright gold
      metalness: 1.0,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.6,
    },
    receivesLighting: true,
  },

  // ── dot-rest-1 — a resting (inactive) pagination dot, dimmer ice/steel.
  {
    localId: 'dot-rest-1',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Page dot',
    renderMode: 'mesh',
    pose: poseAt(-DOT_GAP, DOT_Y, 0.1),
    footprint: { width: DOT_RADIUS * 2, height: DOT_RADIUS * 2 },
    meshPrimitive: {
      kind: 'sphere',
      params: { radius: DOT_RADIUS, segments: 32 },
    },
    materialSpec: {
      baseColor: '#aebfcb', // pewter / steel
      metalness: 0.85,
      roughness: 0.24,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.2,
    },
    receivesLighting: true,
  },

  // ── dot-rest-2 — the third resting pagination dot.
  {
    localId: 'dot-rest-2',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Page dot',
    renderMode: 'mesh',
    pose: poseAt(DOT_GAP, DOT_Y, 0.1),
    footprint: { width: DOT_RADIUS * 2, height: DOT_RADIUS * 2 },
    meshPrimitive: {
      kind: 'sphere',
      params: { radius: DOT_RADIUS, segments: 32 },
    },
    materialSpec: {
      baseColor: '#aebfcb', // pewter / steel
      metalness: 0.85,
      roughness: 0.24,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.2,
    },
    receivesLighting: true,
  },

  // ── caption — a REAL MSDF label (INV-11), modest size so it frames inside
  // the tile above the live slide. Gradient fill in the brass→ice palette.
  {
    localId: 'caption',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Slide caption',
    renderMode: 'text',
    pose: poseAt(0, 1.02, 0.1),
    footprint: { width: 2.4, height: 0.4 },
    textSpec: {
      content: 'DISTORTION FADE',
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 0.32,
      align: 'center',
      letterSpacing: 0.05,
      fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
      decompose: 'glyph',
    },
    receivesLighting: false,
  },
];

const sliderDistortionFade: ElementClusterDefinition = {
  id: 'slider-distortion-fade',
  label: 'Distortion Fade Slider',
  category: 'slider',
  caption: 'Slides crossfade through a liquid swirl + ripple distortion',
  description: 'A glass slide twists out of a whirlpool while the next ripples in — a 3D distortion crossfade.',
  members,
  preview: {
    // Frame the full slider — live slide centered, flanking slides + rail + dots
    // in the ~4:3 tile, three-quarter from slightly above so the depth-stack and
    // glass refraction read.
    camera: { distance: 6.4, polar: Math.PI / 2.35, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T2',
  },
  // Warm studio key + soft fill so the glass slide refracts and the brass rail
  // sweeps. Additive recommendation; never forces a hub-wide change.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.4,
    ambientIntensity: 0.26,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'swirl/whirlpool distortion transition',
    'wave-ripple settle transition',
    'PBR transmission + dispersion glass',
    'polished-brass machined hardware',
  ],
  tier: 'T2',
  featured: true,
};

registerElement(sliderDistortionFade);
export default sliderDistortionFade;
