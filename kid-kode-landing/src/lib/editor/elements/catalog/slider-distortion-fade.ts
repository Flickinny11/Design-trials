// slider-distortion-fade — a photoreal full-bleed slider that ALWAYS presents a
// complete, premium front slide. The earlier build crossfaded THROUGH reveal
// transitions (swirl-warp + wave-distort-in) on driver:time, which fade opacity
// 0→1 and twist the geometry away — so on the cluster preview's time loop the
// live slide went empty/garbled for part of the cycle. The preview rig does NOT
// drive scroll/pointer; a reveal/transition primitive there leaves the element
// absent. FIX: both moving members now carry CONTINUOUS, full-coverage motions
// that never wipe coverage, so the slider reads complete at every loop phase.
//
// Composition reads as a real slider:
//   • slide-current  — the centerpiece GLASS slide, always full-frame, gently
//                       floating (buoyant idle bob/tilt) so the transmission +
//                       dispersion glass refracts the rail + dots behind it.
//   • slide-incoming — the next slide queued behind-right, a polished ice-steel
//                       panel raked by a continuous diagonal light-sweep.
//   • slide-outgoing — the departing slide behind-left (polished obsidian).
//   • frame-rail     — a polished-brass track the slides ride on.
//   • dot-active / dot-rest-1 / dot-rest-2 — brass + ice pagination dots.
//   • caption        — a real MSDF label (INV-11, never diffusion).
//
// INTEGRATED animation (both CONTINUOUS, coverage-safe; never reveal/transition):
//   • slide-current  carries `float` (registry, transform category, subject:card,
//     driver:time, looping) — a buoyant idle bob/tilt that NEVER swaps the glass
//     material or touches opacity, so the premium transmission+dispersion glass
//     stays full-frame at every phase.
//   • slide-incoming carries `light-sweep` (registry, shimmer category,
//     subject:card, driver:time, looping) — a single clean specular band glances
//     diagonally across the panel forever, full coverage at every phase. Together
//     they read as a live, premium glass slider — never an empty crossfade gap.
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

  // ── slide-incoming — the NEXT slide, queued behind-right: a polished
  // ice-steel panel that stays FULL-FRAME at every phase while a continuous
  // diagonal specular band rakes across it (light-sweep). A lit plane wearing a
  // cool ice-steel PBR. Carries `light-sweep` (continuous, coverage-safe).
  {
    localId: 'slide-incoming',
    subtype: 'card',
    serviceTag: 'decor',
    caption: 'Next slide',
    renderMode: 'mesh',
    pose: poseAt(1.35, 0.06, -0.7, { rotationY: -0.42, scaleX: 0.86, scaleY: 0.86, scaleZ: 0.86 }),
    footprint: { width: SLIDE_W, height: SLIDE_H },
    meshPrimitive: {
      // A finely-tessellated plane so the lit panel reads smoothly under the
      // raking specular band (light-sweep lives in emissive over the surface).
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
    // INTEGRATED animation: a single clean specular band glances diagonally
    // across the panel forever — CONTINUOUS, never reveals/fades. The panel is
    // fully present at every loop phase (no empty crossfade gap).
    animationBindings: [
      {
        id: 'ab-slider-distortion-incoming-sweep',
        primitive: 'light-sweep',
        driver: 'time',
        params: { speed: 0.8, width: 0.16, angleDeg: 35, intensity: 1.5, tint: '#bfe0f0' },
        order: 0,
      },
    ],
  },

  // ── slide-current — the live centerpiece slide, ALWAYS full-frame. Premium
  // dispersive GLASS (transmission + dispersion + clearcoat) so it refracts the
  // rail + dots behind it. Carries `float` (subject:card) — a buoyant idle
  // bob/tilt that NEVER swaps the glass material or fades opacity, so the glass
  // is complete and refracting at every loop phase (the SR-killer move is now a
  // permanently-present premium glass slide, not an empty distortion gap).
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
    // INTEGRATED animation: a gentle buoyant float (bob + slow tilt). CONTINUOUS
    // and transform-only — it never swaps the glass material nor touches
    // opacity/coverage, so the premium transmission+dispersion glass slide stays
    // complete and refracting at EVERY loop phase.
    animationBindings: [
      {
        id: 'ab-slider-distortion-current-float',
        primitive: 'float',
        driver: 'time',
        params: { speed: 0.9, amplitude: 0.07, tiltDeg: 3.5 },
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
  caption: 'A premium glass slide on a brass rail, always full-frame',
  description: 'A dispersive glass slide floats on a polished-brass rail while the next panel is raked by a continuous light-sweep — a complete, premium 3D slider at every phase.',
  members,
  preview: {
    // Frame the full slider — live slide centered, flanking slides + rail + dots
    // in the ~4:3 tile, three-quarter from slightly above so the depth-stack and
    // glass refraction read. With continuous motions the slider is complete at
    // every phase, so the frozen still is always a full premium frame.
    camera: { distance: 6.4, polar: Math.PI / 2.35, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.45,
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
    'buoyant float / idle motion',
    'continuous diagonal light-sweep specular',
    'PBR transmission + dispersion glass',
    'polished-brass machined hardware',
  ],
  tier: 'T2',
  featured: true,
};

registerElement(sliderDistortionFade);
export default sliderDistortionFade;
