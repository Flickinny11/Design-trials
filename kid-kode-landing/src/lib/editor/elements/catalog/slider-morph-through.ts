// slider-morph-through — THE Slider-Revolution killer (§13 prebuilt-library
// element, category 'slider'). Two STACKED full-bleed panels read as a slide
// morphing THROUGH 3D: an oversized back panel always fills the frame while a
// stage-sized front panel subtly displaces (a slow parallax drift) and catches a
// continuous specular sweep, so the back reads THROUGH the front — depth, not a
// CSS crossfade. Framed by polished-chrome rails, a refractive liquid-glass bezel
// with a sweeping specular, a modest MSDF caption, and a row of chrome progress
// pips. Where Slider Revolution fakes 3D with CSS transforms, this is layered PBR
// geometry with continuous specular + parallax motion under studio IBL.
//
// COVERAGE-PRESERVING by construction (the preview rig plays animationBindings on
// a time loop and never drives scroll/pointer): EVERY bound primitive is a
// CONTINUOUS, always-visible motion — none ever wipes a panel to empty. The two
// stacked panels guarantee the 4:3 tile is FULL at every phase of the loop.
//
// INTEGRATED animation (all real registry primitives, verified registered):
//   • back-panel  — 'metallic-sheen' (shimmer): an oversized full-bleed panel
//                   carries a slow brushed-metal sheen band. Material stays fully
//                   opaque + lit — this layer ALWAYS fills the frame behind the
//                   stage, so the tile is never empty. The slide showing THROUGH.
//   • stage       — 'light-sweep' (shimmer): the front full-bleed panel runs a
//                   crisp specular band glancing across its surface. The material
//                   swap keeps the panel fully covered + lit at every phase.
//   • stage(drift)— 'float' (transform): a gentle slow drift/tilt of the front
//                   panel reads as it subtly DISPLACING over the back — the
//                   morph-through-3D identity, with the back panel showing through.
//   • glass-bezel — 'light-sweep' (shimmer): a specular band sweeps the
//                   refractive bezel so the framing reads as polished liquid glass.
//
// This is a TEMPLATE: every member is a real, editable PrismNode (move / recolor /
// re-skin / swap animation post-place). Photorealism is procedural PBR + IBL
// (free) — no hero imagery needed; the layered depth + specular IS the spectacle.
//
// Tier: T2 full-fidelity (the transmission bezel + GI catch on the chrome rails
// land at T2). MUST still read clean at T0 — degraded, the stacked panels still
// fill the frame with the specular sweep + sheen, the rails read as lit chrome
// bars, the bezel as a glossy frame, the caption as crisp MSDF. Never broken,
// never empty. INV-9.

import { registerElement } from '../registry';
import type {
  ClusterMemberTemplate,
  ElementClusterDefinition,
} from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// ── Full-bleed stage footprint (scene units) — a wide 16:9-ish panel. ─────────
const STAGE_W = 3.2;
const STAGE_H = 1.8;
const PANEL_DEPTH_GAP = 0.12; // how far the back panel sits behind the stage.
// The back panel is OVERSIZED so that however the floating front stage drifts /
// tilts, this always-full layer still covers the whole frame — the tile is never
// empty. The overscan comfortably exceeds the front 'float' amplitude.
const BACK_W = STAGE_W + 0.36;
const BACK_H = STAGE_H + 0.36;

// Identity local pose helper (cluster origin is 0,0,0; the instantiator offsets
// every member by the drop anchor). Keeps each member a full 9-field
// ScenePosition without repeating the rotation/scale boilerplate.
function pose(
  x: number,
  y: number,
  z: number,
  rotationZ = 0,
): ScenePosition {
  return {
    x,
    y,
    z,
    rotationX: 0,
    rotationY: 0,
    rotationZ,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };
}

// Polished-chrome rail recipe (top + bottom framing bars) — physically plausible
// mirror chrome with a clearcoat. Observatory Brass palette: steel chrome that
// picks up the warm key. NEVER purple.
const CHROME_RAIL = {
  baseColor: '#c2c7d2',
  metalness: 1.0,
  roughness: 0.08,
  clearcoat: 1.0,
  clearcoatRoughness: 0.06,
  envMapIntensity: 1.6,
} as const;

// Brass progress pip recipe — warm brushed gold dots.
const BRASS_PIP = {
  baseColor: '#c9a86a',
  metalness: 0.95,
  roughness: 0.3,
  clearcoat: 0.5,
  clearcoatRoughness: 0.2,
  envMapIntensity: 1.3,
} as const;

const RAIL_THICK = 0.07; // rail tube radius.
const PIP_R = 0.055;
const PIP_COUNT = 2; // keep the cluster within the 3–8 member bar (6 base + 2 pips = 8).
const PIP_GAP = 0.26;
const ACTIVE_PIP = 0; // which pip reads as the "current slide".

function buildPips(): ClusterMemberTemplate[] {
  const pips: ClusterMemberTemplate[] = [];
  // Center the row of pips along x, just below the stage.
  const rowWidth = (PIP_COUNT - 1) * PIP_GAP;
  const x0 = -rowWidth / 2;
  for (let i = 0; i < PIP_COUNT; i++) {
    const active = i === ACTIVE_PIP;
    pips.push({
      localId: `pip-${i}`,
      subtype: 'element',
      serviceTag: 'decor',
      caption: `Slide marker ${i + 1}`,
      renderMode: 'mesh',
      // Active pip sits a touch larger + forward so it reads as "current".
      pose: {
        ...pose(x0 + i * PIP_GAP, -STAGE_H / 2 - 0.18, 0.04),
        scaleX: active ? 1.5 : 1,
        scaleY: active ? 1.5 : 1,
        scaleZ: active ? 1.5 : 1,
      },
      footprint: { width: PIP_R * 2, height: PIP_R * 2 },
      meshPrimitive: { kind: 'sphere', params: { radius: PIP_R, segments: 32 } },
      materialSpec: active
        ? { ...BRASS_PIP, emissive: '#7a5e26', emissiveIntensity: 0.5 }
        : { ...BRASS_PIP, baseColor: '#8d7a52', roughness: 0.42 },
      receivesLighting: true,
    });
  }
  return pips;
}

const sliderMorphThrough: ElementClusterDefinition = {
  id: 'slider-morph-through',
  label: 'Morph-Through Slider',
  category: 'slider',
  caption: 'Full-bleed panels that morph THROUGH 3D between slides',
  description:
    'A full-bleed slide displaces and liquefies into the next — a real GPU morph-through, not a CSS crossfade.',
  members: [
    // ── Back panel — the always-full slide showing THROUGH the front. An
    // OVERSIZED full-bleed plane set back by a small z gap; sized larger than the
    // stage so that however the front panel drifts, this layer still fills the
    // whole frame — the tile is NEVER empty. Lit mesh so it catches the warm key.
    // Runs 'metallic-sheen': a slow brushed-metal sheen band that NEVER wipes the
    // panel (material stays fully opaque + lit), so coverage is preserved at every
    // phase of the time loop.
    {
      localId: 'back-panel',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Slide back panel',
      renderMode: 'mesh',
      pose: pose(0, 0, -PANEL_DEPTH_GAP),
      footprint: { width: BACK_W, height: BACK_H },
      meshPrimitive: { kind: 'plane', params: { width: BACK_W, height: BACK_H } },
      materialSpec: {
        // Real hero slide on the back panel: a landscape atrium photo (warm gold,
        // dramatic) maps onto the always-full plane so the layer showing THROUGH
        // is a populated premium image, not a flat dark panel. baseColor stays
        // white so the map reads at full color; glossy-print finish.
        baseColor: '#ffffff',
        baseColorMapUrl: '/prism-mock/library-content/arch-warm.png',
        metalness: 0.0,
        roughness: 0.42,
        clearcoat: 0.6,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.0,
      },
      receivesLighting: true,
      // INTEGRATED: a continuous brushed-metal sheen band. Coverage-preserving —
      // the panel surface is always fully painted; only a soft specular band
      // travels across it. This layer guarantees the frame is never empty.
      animationBindings: [
        {
          id: 'ab-slider-back-sheen',
          primitive: 'metallic-sheen',
          driver: 'time',
          params: { speed: 0.5, width: 0.22, brightness: 1.1, tint: '#9fc3d6' },
          order: 0,
        },
      ],
    },
    // ── Stage — the FRONT full-bleed slide. A lit mesh plane that ALWAYS fills
    // its footprint. Runs 'light-sweep' (a crisp specular band glancing across the
    // surface — material swap keeps it fully opaque + lit) and a gentle 'float'
    // drift so the front panel subtly DISPLACES over the back panel. That layered
    // drift + the back showing through IS the morph-through-3D identity — and
    // because both motions are continuous and coverage-preserving, the panel is
    // never wiped to empty. No reveal/transition primitive here.
    {
      localId: 'stage',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Slide stage',
      renderMode: 'mesh',
      pose: pose(0, 0, 0),
      footprint: { width: STAGE_W, height: STAGE_H },
      meshPrimitive: { kind: 'plane', params: { width: STAGE_W, height: STAGE_H } },
      materialSpec: {
        // The FRONT slide carries a DIFFERENT landscape hero (luxury minimalist
        // interior, travertine/walnut) so the morph-through reads as one slide
        // displacing over another distinct image. White base + glossy clearcoat
        // gives the premium photo-print finish the specular sweep glides across.
        baseColor: '#ffffff',
        baseColorMapUrl: '/prism-mock/library-content/arch-interior.png',
        metalness: 0.0,
        roughness: 0.42,
        clearcoat: 0.6,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.0,
      },
      receivesLighting: true,
      // INTEGRATED: continuous specular sweep + a slow parallax drift. Both keep
      // the panel fully covered at every phase — the back panel shows THROUGH as
      // the front gently displaces.
      animationBindings: [
        {
          id: 'ab-slider-stage-sweep',
          primitive: 'light-sweep',
          driver: 'time',
          params: { speed: 0.8, width: 0.18, angleDeg: 18, intensity: 1.5, tint: '#f3e6c4' },
          order: 0,
        },
        {
          id: 'ab-slider-stage-drift',
          primitive: 'float',
          driver: 'time',
          params: { speed: 0.6, amplitude: 0.05, tiltDeg: 4 },
          order: 1,
        },
      ],
    },
    // ── Glass bezel — a thin refractive liquid-glass frame sitting just in front
    // of the stage. Real transmission + dispersion + clearcoat so the morph reads
    // through polished glass. Runs 'light-sweep' for a sweeping specular band —
    // the premium chrome flourish. (T2 transmission; at T0 it reads as a glossy
    // glass-tinted frame, still clean.)
    {
      localId: 'glass-bezel',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Refractive bezel',
      renderMode: 'mesh',
      pose: pose(0, 0, 0.16),
      footprint: { width: STAGE_W + 0.16, height: STAGE_H + 0.16 },
      meshPrimitive: {
        kind: 'plane',
        params: { width: STAGE_W + 0.16, height: STAGE_H + 0.16 },
      },
      materialSpec: {
        baseColor: '#d7e2ec',
        metalness: 0.0,
        roughness: 0.06,
        transmission: 0.92,
        ior: 1.5,
        dispersion: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        thickness: 0.4,
        envMapIntensity: 1.5,
        opacity: 1,
      },
      receivesLighting: true,
      animationBindings: [
        {
          id: 'ab-slider-bezel-sweep',
          primitive: 'light-sweep',
          driver: 'time',
          params: { speed: 0.7, width: 0.22, angleDeg: 18, intensity: 1.6, tint: '#f3e6c4' },
          order: 0,
        },
      ],
    },
    // ── Top rail — a polished-chrome bar framing the full-bleed slide. A thin
    // cylinder laid horizontally (rotated 90° about Z so its long axis runs x).
    {
      localId: 'rail-top',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Top chrome rail',
      renderMode: 'mesh',
      pose: pose(0, STAGE_H / 2 + RAIL_THICK, 0.12, Math.PI / 2),
      footprint: { width: STAGE_W + 0.24, height: RAIL_THICK * 2 },
      meshPrimitive: {
        kind: 'cylinder',
        params: { radius: RAIL_THICK, height: STAGE_W + 0.24, segments: 48 },
      },
      materialSpec: { ...CHROME_RAIL },
      receivesLighting: true,
    },
    // ── Bottom rail — mirror of the top rail.
    {
      localId: 'rail-bottom',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Bottom chrome rail',
      renderMode: 'mesh',
      pose: pose(0, -STAGE_H / 2 - RAIL_THICK, 0.12, Math.PI / 2),
      footprint: { width: STAGE_W + 0.24, height: RAIL_THICK * 2 },
      meshPrimitive: {
        kind: 'cylinder',
        params: { radius: RAIL_THICK, height: STAGE_W + 0.24, segments: 48 },
      },
      materialSpec: { ...CHROME_RAIL },
      receivesLighting: true,
    },
    // ── Caption — REAL MSDF text (INV-11), framed modestly inside the lower-left
    // of the tile. Small font so it sits as a slide label, not a billboard.
    {
      localId: 'caption',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Slide caption',
      renderMode: 'text',
      pose: pose(-STAGE_W / 2 + 0.95, -STAGE_H / 2 + 0.32, 0.2),
      footprint: { width: 1.7, height: 0.34 },
      textSpec: {
        content: 'MORPH THROUGH',
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 0.3,
        align: 'left',
        letterSpacing: 0.05,
        fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
        decompose: 'glyph',
      },
      // No binding here — the morph IS the motion; the caption stays legible so
      // the tile reads as a slide. (Swappable via the Animation Picker post-place.)
    },
    // ── Progress pips — a row of brass markers showing slide position; the
    // active pip is larger, forward, and gently emissive.
    ...buildPips(),
  ],
  preview: {
    // Frame the full-bleed slide head-on with a slight three-quarter tilt so the
    // depth gap between back-panel + stage + bezel reads, and the chrome rails
    // catch the key. 4:3 tile. The stacked panels keep the frame full at every
    // phase, so any frozenPhase lands a complete still.
    camera: { distance: 5.4, polar: Math.PI / 2.2, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T2',
  },
  // Studio look at place time: a warm key with a touch of env so the chrome
  // rails + glass bezel sparkle. Additive; never forces a hub-wide change.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.4,
    ambientIntensity: 0.26,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'morph-through-3D layered depth (front panel drifts over a back panel)',
    'continuous specular light-sweep',
    'brushed metallic sheen',
    'PBR transmission glass bezel',
    'polished-chrome framing rails',
  ],
  tier: 'T2',
  featured: true,
};

// Self-register on import (idempotent; the registry is last-write-wins). The
// catalog barrel only needs a side-effect import of this module.
registerElement(sliderMorphThrough);

export { sliderMorphThrough };
export default sliderMorphThrough;
