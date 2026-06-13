// slider-morph-through — THE Slider-Revolution killer (§13 prebuilt-library
// element, category 'slider'). Full-bleed panels that morph THROUGH 3D between
// slides: a front "stage" plane runs a real displacement-mapped wipe while a
// panel set just behind it liquefies into coverage, so a slide doesn't crossfade
// — it dissolves through depth into the next. Framed by polished-chrome rails, a
// refractive liquid-glass bezel with a sweeping specular, a modest MSDF caption,
// and a row of chrome progress pips. Where Slider Revolution fakes 3D with CSS
// transforms, this is GPU displacement + metaball coverage on real PBR geometry
// under studio IBL.
//
// INTEGRATED animation (all real registry primitives, verified registered):
//   • stage      — 'displacement-transition' (displacement category): a
//                  noise-roughened wipe front sweeps the full-bleed plane, mixing
//                  the two slide tints. THE morph-through-3D move.
//   • depth-panel — 'liquefy-reveal' (displacement category): the panel behind
//                  the stage coalesces from a gooey metaball field into solid
//                  coverage, reading as the next slide forming THROUGH the front.
//   • glass-bezel — 'light-sweep' (shimmer category): a specular band sweeps the
//                  refractive bezel so the framing reads as polished liquid glass.
//
// This is a TEMPLATE: every member is a real, editable PrismNode (move / recolor /
// re-skin / swap animation post-place). Photorealism is procedural PBR + IBL
// (free) — no hero imagery needed; the morph IS the spectacle.
//
// Tier: T2 full-fidelity (the transmission bezel + GI catch on the chrome rails
// land at T2). MUST still read clean at T0 — degraded, the stage still shows the
// displacement wipe, the rails read as lit chrome bars, the bezel as a glossy
// frame, the caption as crisp MSDF. Never broken. INV-9.

import { registerElement } from '../registry';
import type {
  ClusterMemberTemplate,
  ElementClusterDefinition,
} from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// ── Full-bleed stage footprint (scene units) — a wide 16:9-ish panel. ─────────
const STAGE_W = 3.2;
const STAGE_H = 1.8;
const PANEL_DEPTH_GAP = 0.12; // how far the morphing panel sits behind the stage.

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
    // ── Depth panel — the slide FORMING behind the stage. A full-bleed plane set
    // back by a small z gap, running 'liquefy-reveal' so it coalesces from a
    // gooey metaball field into solid coverage — the next slide emerging THROUGH
    // the front panel. Lit so its coverage catches the warm key. The primitive
    // swaps its material for the goo-coverage shader at play time.
    {
      localId: 'depth-panel',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Slide depth panel',
      renderMode: 'plane',
      pose: pose(0, 0, -PANEL_DEPTH_GAP),
      footprint: { width: STAGE_W, height: STAGE_H },
      meshPrimitive: { kind: 'plane', params: { width: STAGE_W, height: STAGE_H } },
      materialSpec: {
        baseColor: '#1d2533',
        metalness: 0.3,
        roughness: 0.6,
        clearcoat: 0.15,
        envMapIntensity: 0.7,
      },
      receivesLighting: true,
      // INTEGRATED: the gooey liquefy-into-coverage reveal (offset/slow so it
      // reads as a continuous ambient morph behind the stage wipe).
      animationBindings: [
        {
          id: 'ab-slider-depth-liquefy',
          primitive: 'liquefy-reveal',
          driver: 'time',
          params: { duration: 3.2, wobble: 0.22, viscosity: 0.85 },
          order: 0,
        },
      ],
    },
    // ── Stage — the FRONT full-bleed slide. Runs 'displacement-transition': a
    // noise-roughened wipe front sweeps horizontally, mixing two slide tints.
    // THE morph-through-3D move that smashes Slider Revolution. The primitive
    // swaps its material for the displacement-wipe shader at play time.
    {
      localId: 'stage',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Slide stage',
      renderMode: 'plane',
      pose: pose(0, 0, 0),
      footprint: { width: STAGE_W, height: STAGE_H },
      meshPrimitive: { kind: 'plane', params: { width: STAGE_W, height: STAGE_H } },
      materialSpec: {
        baseColor: '#23304f',
        metalness: 0.2,
        roughness: 0.5,
        envMapIntensity: 0.9,
      },
      receivesLighting: false,
      // INTEGRATED: the displacement-mapped morph-through wipe (the headline
      // move). Horizontal axis, roughened front.
      animationBindings: [
        {
          id: 'ab-slider-stage-morph',
          primitive: 'displacement-transition',
          driver: 'time',
          params: { duration: 2.6, amount: 0.42, axis: 'x' },
          order: 0,
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
    // depth gap between stage + depth-panel + bezel reads, and the chrome rails
    // catch the key. 4:3 tile.
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
    'morph-through-3D slide transition',
    'GPU displacement-mapped wipe',
    'metaball liquefy reveal',
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
