// pricing-pillars-3d — a photoreal 3D pricing table rendered as three standing
// PBR pillars (§13 prebuilt-library element, category 'pricing'). Three beveled
// monoliths stand in a row: the two flanks are cool obsidian/steel, the CENTER
// pillar is taller, gold brass, and FEATURED — the plan you're meant to pick.
// Each pillar wears a rolling MSDF price (renderMode:'text', real glyphs —
// INV-11, never diffusion) that tumbles into place like an odometer reel.
//
// INTEGRATED animation (the SR-smashing move — a real lit 3D pricing rig, not a
// flat CSS table):
//   • center pillar — `scale-pop` (transform): the featured tier overshoots up
//     to full size, drawing the eye, then a continuous `gold-glint` (shimmer,
//     TSL) rakes a warm twinkling gold band across its face like light on
//     polished gold. Two stacked bindings (criterion 13, order 0/1).
//   • all three prices — `text-counter-roll` (text): glyphs roll vertically
//     into place like a slot reel / odometer, each settling in sequence.
//
// Photorealism is procedural PBR + studio IBL (free) — no imagery needed. The
// pillars read as lit brass/obsidian standalone; INV-9 degrades cleanly to T0
// (still lit beveled columns + crisp MSDF prices, just no screen-space GI).
//
// Tier: T2 full-fidelity (the gold-glint emissive band + clearcoat reflections
// sing under GI), clean T0 fallback. Palette: Observatory Brass — brass/gold +
// obsidian/steel + charcoal. NO purple. Every member is a real editable node.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { MaterialSpec, ScenePosition } from '@/lib/prism-graph/types';

// ── Row geometry (cluster-local space, origin 0,0,0) ────────────────────────
const PILLAR_W = 0.92; // footprint width of each column
const PILLAR_D = 0.62; // depth
const COLUMN_GAP = 1.45; // x-spacing between column centers
const SIDE_H = 2.0; // flank pillar height
const CENTER_H = 2.7; // featured pillar — taller
const PRICE_LIFT = 0.55; // how far above a pillar's top the price floats

// Premium PBR recipes (Observatory Brass). Flanks read as cool obsidian/steel;
// the center is warm polished brass so the featured tier separates at a glance.
const OBSIDIAN: MaterialSpec = {
  baseColor: '#15171f',
  metalness: 0.7,
  roughness: 0.18,
  clearcoat: 1.0,
  clearcoatRoughness: 0.12,
  envMapIntensity: 1.25,
};
const STEEL: MaterialSpec = {
  baseColor: '#9fb2c2',
  metalness: 0.92,
  roughness: 0.3,
  clearcoat: 0.6,
  clearcoatRoughness: 0.2,
  envMapIntensity: 1.2,
};
const BRASS: MaterialSpec = {
  baseColor: '#c9a86a',
  metalness: 0.95,
  roughness: 0.26,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  envMapIntensity: 1.45,
  emissive: '#3a2c10',
  emissiveIntensity: 0.18, // faint warm self-glow so the hero tier never reads dead at T0
};

// A full ScenePosition (all 9 fields) at a standing column with a slight inward
// yaw on the flanks so the trio reads as a shallow display arc.
function columnPose(x: number, y: number, yawDeg: number): ScenePosition {
  return {
    x,
    y,
    z: 0,
    rotationX: 0,
    rotationY: (yawDeg * Math.PI) / 180,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };
}

function textPose(x: number, y: number): ScenePosition {
  return {
    x,
    y,
    z: PILLAR_D / 2 + 0.06, // sit just in front of the column face
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };
}

const members: ClusterMemberTemplate[] = [
  // ── Left flank — obsidian column (Starter tier) ──────────────────────────
  {
    localId: 'pillar-left',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Starter tier pillar',
    renderMode: 'mesh',
    pose: columnPose(-COLUMN_GAP, SIDE_H / 2, 9),
    footprint: { width: PILLAR_W, height: SIDE_H },
    meshPrimitive: {
      kind: 'cube',
      params: { width: PILLAR_W, height: SIDE_H, depth: PILLAR_D },
    },
    materialSpec: OBSIDIAN,
    receivesLighting: true,
  },
  // ── Center — FEATURED brass column, tallest, gold-accented ────────────────
  {
    localId: 'pillar-center',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Featured tier pillar',
    renderMode: 'mesh',
    pose: columnPose(0, CENTER_H / 2, 0),
    footprint: { width: PILLAR_W, height: CENTER_H },
    meshPrimitive: {
      kind: 'cube',
      params: { width: PILLAR_W, height: CENTER_H, depth: PILLAR_D },
    },
    materialSpec: BRASS,
    receivesLighting: true,
    // INTEGRATED animation (criterion 13 — two stacked bindings):
    //   order 0 — scale-pop: the featured tier overshoots up to full size.
    //   order 1 — gold-glint: a warm twinkling band rakes the brass face.
    animationBindings: [
      {
        id: 'ab-pricing-center-pop',
        primitive: 'scale-pop',
        driver: 'time',
        params: { duration: 1.0, startScale: 0.78, spinDeg: 0, curve: 'backOut' },
        order: 0,
      },
      {
        id: 'ab-pricing-center-glint',
        primitive: 'gold-glint',
        driver: 'time',
        params: { speed: 0.8, width: 0.18, intensity: 1.5, twinkle: 8, tint: '#ffd479' },
        order: 1,
      },
    ],
  },
  // ── Right flank — steel column (Scale tier) ──────────────────────────────
  {
    localId: 'pillar-right',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Scale tier pillar',
    renderMode: 'mesh',
    pose: columnPose(COLUMN_GAP, SIDE_H / 2, -9),
    footprint: { width: PILLAR_W, height: SIDE_H },
    meshPrimitive: {
      kind: 'cube',
      params: { width: PILLAR_W, height: SIDE_H, depth: PILLAR_D },
    },
    materialSpec: STEEL,
    receivesLighting: true,
  },
  // ── Prices — REAL MSDF text (INV-11), rolling into place like an odometer ──
  // fontSize kept modest (≤0.45) so each price frames inside its column face.
  {
    localId: 'price-left',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Starter price',
    renderMode: 'text',
    pose: textPose(-COLUMN_GAP, SIDE_H + PRICE_LIFT),
    footprint: { width: PILLAR_W, height: 0.45 },
    textSpec: {
      content: '$19',
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 0.34,
      align: 'center',
      letterSpacing: 0.02,
      fill: { kind: 'solid', color: '#c7d2dc' },
      decompose: 'glyph',
    },
    animationBindings: [
      {
        id: 'ab-pricing-price-left-roll',
        primitive: 'text-counter-roll',
        driver: 'time',
        params: { duration: 1.6, spins: 3, stagger: 0.16 },
        order: 0,
      },
    ],
  },
  {
    localId: 'price-center',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Featured price',
    renderMode: 'text',
    pose: textPose(0, CENTER_H + PRICE_LIFT),
    footprint: { width: PILLAR_W, height: 0.5 },
    textSpec: {
      content: '$49',
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 0.44, // featured price reads largest (still modest, frames in-tile)
      align: 'center',
      letterSpacing: 0.02,
      // Warm gold gradient ties the price to the brass featured column.
      fill: { kind: 'gradient', from: '#f0dca6', to: '#c9a86a', angleDeg: 18 },
      decompose: 'glyph',
    },
    animationBindings: [
      {
        id: 'ab-pricing-price-center-roll',
        primitive: 'text-counter-roll',
        driver: 'time',
        params: { duration: 1.9, spins: 4, stagger: 0.18 },
        order: 0,
      },
    ],
  },
  {
    localId: 'price-right',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Scale price',
    renderMode: 'text',
    pose: textPose(COLUMN_GAP, SIDE_H + PRICE_LIFT),
    footprint: { width: PILLAR_W, height: 0.45 },
    textSpec: {
      content: '$99',
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 0.34,
      align: 'center',
      letterSpacing: 0.02,
      fill: { kind: 'solid', color: '#c7d2dc' },
      decompose: 'glyph',
    },
    animationBindings: [
      {
        id: 'ab-pricing-price-right-roll',
        primitive: 'text-counter-roll',
        driver: 'time',
        params: { duration: 1.6, spins: 3, stagger: 0.16 },
        order: 0,
      },
    ],
  },
];

const pricingPillars3d: ElementClusterDefinition = {
  id: 'pricing-pillars-3d',
  label: '3D Pricing Pillars',
  category: 'pricing',
  caption: 'Three lit PBR pillars with rolling prices, the featured tier in gold',
  description:
    'A 3D pricing rig: obsidian + steel flanks around a taller gold-glinting featured column, with odometer-rolling MSDF prices.',
  members,
  preview: {
    // Frame all three columns in a ~4:3 tile from a slight three-quarter, eye-
    // level-ish angle so the center pillar's extra height + gold sheen read.
    camera: { distance: 7.4, polar: Math.PI / 2.25, azimuth: Math.PI * 0.08 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T2',
  },
  // Warm-key studio recommendation so the brass catches a specular and the
  // obsidian flanks pick up clearcoat reflections (additive; never forced).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.26,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'PBR clearcoat metal columns',
    'gold raking-light specular sweep',
    'odometer counter-roll typography',
    'featured-tier emphasis hierarchy',
  ],
  tier: 'T2',
  featured: true,
};

registerElement(pricingPillars3d);
export default pricingPillars3d;
