#!/usr/bin/env node
// UI-FIDELITY-2 W3 — ORRERY No.7 flagship showcase graph builder.
//
// Emits the 5-hub live-graph (arrival → movement → materia → celestia →
// acquire): photoreal fal-generated assets as real scene nodes, poured-texture
// MSDF text, a video-texture moment, mesh nodes under the lighting rig, and
// animation bindings across ALL FIVE drivers (time/scroll/pointer/state/event).
//
// Writes public/prism-mock/home/live-graph.json (the boot graph) after
// backing up the previous seed. Re-runnable (deterministic output).

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const livePath = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
const prev = JSON.parse(readFileSync(livePath, 'utf8'));

const A = '/prism-mock/orrery'; // asset root

// ── helpers ────────────────────────────────────────────────────────────────
let order = 0;
const bind = (primitive, driver, params = {}) => ({
  id: `b-${primitive}-${order}`,
  primitive,
  driver,
  params,
  order: order++,
});

const sp = (x, y, z, extra = {}) => ({
  x, y, z,
  rotationX: 0, rotationY: 0, rotationZ: 0,
  scaleX: 1, scaleY: 1, scaleZ: 1,
  ...extra,
});

const baseIntent = (caption) => ({
  caption,
  behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
  stateEffects: [],
  visualSpec: { textContent: [], layers: [] },
  contracts: { inputs: {}, outputs: {} },
});

function node(o) {
  return {
    nodeId: o.id,
    subtype: o.subtype,
    parentHubId: o.hub,
    serviceTag: o.serviceTag ?? 'ui-visual',
    visual: { transform: o.t, alpha: o.alpha ?? 1, ...(o.sourceAsset ? { sourceAsset: o.sourceAsset } : {}) },
    intent: baseIntent(o.caption),
    codeRef: '',
    backendRef: null,
    renderMode: o.renderMode,
    depthMapUrl: o.depthMapUrl ?? null,
    meshUrl: o.meshUrl ?? null,
    ...(o.videoUrl ? { videoUrl: o.videoUrl } : {}),
    cinematicPrimitives: o.prims ?? [],
    scenePosition: o.sp,
    ...(o.textSpec ? { textSpec: o.textSpec } : {}),
    ...(o.bindings ? { animationBindings: o.bindings } : {}),
    ...(o.materialSpec ? { materialSpec: o.materialSpec } : {}),
    ...(o.lightingSpec ? { lightingSpec: o.lightingSpec } : {}),
    ...(o.meshPrimitive ? { meshPrimitive: o.meshPrimitive } : {}),
    ...(o.imageSpec ? { imageSpec: o.imageSpec } : {}),
  };
}

const hub = (hubId, title, caption, bg, lighting, contentHeight = 720) => ({
  hubId,
  title,
  caption,
  layout: {
    viewportWidth: 1280,
    viewportHeight: 720,
    contentHeight,
    backgroundColor: '#03040a',
  },
  background: bg,
  ...(lighting ? { lightingSpec: lighting } : {}),
});

// ── HUB 1 · ARRIVAL — the timepiece floats over the orrery rings ───────────
const arrivalNodes = [
  node({
    id: 'orr-arrival-headline', hub: 's1-arrival', subtype: 'headline-text', serviceTag: 'ui-text',
    caption: 'Hero headline — molten brass poured into real MSDF letterforms; light sweeps it on entry, it drifts with scroll and recedes as you descend into the movement.',
    renderMode: 'text',
    t: { x: 0, y: 1.05, z: 0, width: 7.2, height: 0.9 },
    sp: sp(0, 1.05, 0.3),
    textSpec: {
      content: 'Time, machined.',
      fontFamily: 'Inter', fontWeight: 600, fontSize: 0.78,
      letterSpacing: -0.01, align: 'center',
      fill: { kind: 'texture', url: `${A}/materia/brass-macro.png` },
      outline: { color: '#1a1406', width: 0.22 },
      glow: { color: '#d8a73f', intensity: 0.18 },
    },
    bindings: [
      bind('float', 'time', { amplitude: 0.025, periodSec: 7 }),
      bind('scroll-depth-dolly', 'scroll', { intensity: 0.5 }),
    ],
    prims: [{ name: 'kinetic-text', params: { stagger: 0.045, duration: 0.8, effect: 'wave', easing: 'power3.out' }, trigger: 'inview' }],
  }),
  node({
    id: 'orr-arrival-sub', hub: 's1-arrival', subtype: 'subhead-text', serviceTag: 'ui-text',
    caption: 'Sub-line in bone — quiet counterpoint under the molten headline.',
    renderMode: 'text',
    t: { x: 0, y: 0.62, z: 0, width: 5.4, height: 0.3 },
    sp: sp(0, 0.62, 0.25),
    textSpec: {
      content: 'ORRERY No.7 — a celestial movement, eleven years in the making.',
      fontFamily: 'Inter', fontWeight: 400, fontSize: 0.17,
      letterSpacing: 0.04, align: 'center',
      fill: { kind: 'solid', color: '#cfd4e2' },
      glow: { color: '#7fa0c4', intensity: 0.08 },
    },
    bindings: [bind('fade-up', 'time', { delay: 0.5, duration: 1.1 })],
  }),
  node({
    id: 'orr-arrival-watch', hub: 's1-arrival', subtype: 'product-hero', serviceTag: 'ui-3d',
    caption: 'The timepiece itself — photoreal generated 3D under the hub light rig; floats on idle, tilts toward the pointer, glints on click.',
    renderMode: 'mesh', meshUrl: `${A}/meshes/watch.glb`,
    t: { x: 0, y: -1.15, z: 0.6, width: 3.2, height: 3.2 },
    sp: sp(0, -1.25, 0.6, { scaleX: 2.4, scaleY: 2.4, scaleZ: 2.4, rotationX: 0.25 }),
    bindings: [
      bind('float', 'time', { amplitude: 0.06, periodSec: 5 }),
      bind('pointer-tilt-3d', 'pointer', { maxDeg: 9, ease: 0.12 }),
      bind('scale-pop', 'event', { trigger: 'click', factor: 1.05 }),
    ],
  }),
  node({
    id: 'orr-arrival-dust', hub: 's1-arrival', subtype: 'ambience', serviceTag: 'ui-fx',
    caption: 'Cosmic dust ambience — slow drifting particle field behind the product.',
    renderMode: 'plane',
    t: { x: 0, y: 0, z: -1.6, width: 9, height: 5 },
    sp: sp(0, 0, -1.6),
    alpha: 0.85,
    bindings: [bind('cosmic-dust', 'time', { density: 0.5, driftSpeed: 0.16 })],
  }),
];

// ── HUB 2 · MOVEMENT — exploded mechanism ──────────────────────────────────
const movementNodes = [
  node({
    id: 'orr-movement-title', hub: 's2-movement', subtype: 'section-text', serviceTag: 'ui-text',
    caption: 'Section title — engraved into the dark, decodes on entry.',
    renderMode: 'text',
    t: { x: -2.1, y: 1.15, z: 0, width: 4.4, height: 0.52 },
    sp: sp(-2.1, 1.15, 0.2),
    textSpec: {
      content: 'The Movement',
      fontFamily: 'Inter', fontWeight: 600, fontSize: 0.46,
      letterSpacing: 0.005, align: 'left',
      fill: { kind: 'gradient', from: '#e8d9ac', to: '#8a6f2e', angleDeg: 90 },
      outline: { color: '#120e04', width: 0.24 },
    },
    bindings: [bind('decode-text', 'time', { durationSec: 1.1 })],
  }),
  node({
    id: 'orr-movement-gear-a', hub: 's2-movement', subtype: 'mechanism-3d', serviceTag: 'ui-3d',
    caption: 'Skeletonized brass gear — real generated 3D, turning forever on the time driver.',
    renderMode: 'mesh', meshUrl: `${A}/meshes/gear-a.glb`,
    t: { x: -1.7, y: -0.3, z: 0.4, width: 1.7, height: 1.7 },
    sp: sp(-1.7, -0.3, 0.4, { scaleX: 1.3, scaleY: 1.3, scaleZ: 1.3 }),
    bindings: [
      bind('spin', 'time', { axis: 'z', periodSec: 14 }),
      bind('scroll-rotate-3d', 'scroll', { axis: 'y', degrees: 35 }),
    ],
  }),
  node({
    id: 'orr-movement-tourbillon', hub: 's2-movement', subtype: 'mechanism-3d', serviceTag: 'ui-3d',
    caption: 'The tourbillon cage — counter-rotating heart of the movement; leans toward the cursor.',
    renderMode: 'mesh', meshUrl: `${A}/meshes/tourbillon.glb`,
    t: { x: 1.5, y: -0.25, z: 0.7, width: 2.0, height: 2.0 },
    sp: sp(1.5, -0.25, 0.7, { scaleX: 1.55, scaleY: 1.55, scaleZ: 1.55, rotationX: 0.3 }),
    bindings: [
      bind('spin', 'time', { axis: 'z', periodSec: -9 }),
      bind('pointer-tilt-3d', 'pointer', { maxDeg: 12, ease: 0.1 }),
      bind('scale-pop', 'event', { trigger: 'click', factor: 1.12 }),
    ],
  }),
  node({
    id: 'orr-movement-macro', hub: 's2-movement', subtype: 'macro-photo',
    caption: 'Macro photography plane — 4MP generated movement interior, parallax-anchored.',
    renderMode: 'plane', sourceAsset: `${A}/movement/backdrop.png`,
    t: { x: 0.1, y: 0.2, z: -1.2, width: 8.4, height: 4.7 },
    sp: sp(0.1, 0.2, -1.2),
    alpha: 0.92,
    bindings: [bind('parallax', 'pointer', { intensity: 0.06 })],
  }),
  node({
    id: 'orr-movement-spec', hub: 's2-movement', subtype: 'spec-text', serviceTag: 'ui-text',
    caption: 'Specification micro-copy — tabular, instrument-grade.',
    renderMode: 'text',
    t: { x: -2.15, y: -1.25, z: 0, width: 3.6, height: 0.5 },
    sp: sp(-2.15, -1.25, 0.15),
    textSpec: {
      content: '311 components — 27 jewels\n28,800 vph — 96h reserve',
      fontFamily: 'Inter', fontWeight: 400, fontSize: 0.13,
      letterSpacing: 0.06, lineHeight: 1.6, align: 'left',
      fill: { kind: 'solid', color: '#9aa3b8' },
    },
    bindings: [bind('scroll-stagger-rise', 'scroll', { distancePx: 30 })],
  }),
];

// ── HUB 3 · MATERIA — the materials, poured ────────────────────────────────
const materiaNodes = [
  node({
    id: 'orr-materia-title', hub: 's3-materia', subtype: 'headline-text', serviceTag: 'ui-text',
    caption: 'Materials litany — each word poured from its own substance (meteorite texture fill).',
    renderMode: 'text',
    t: { x: 0, y: 1.1, z: 0, width: 7.6, height: 0.66 },
    sp: sp(0, 1.1, 0.25),
    textSpec: {
      content: 'Brass. Sapphire. Meteorite.',
      fontFamily: 'Inter', fontWeight: 600, fontSize: 0.55,
      letterSpacing: -0.005, align: 'center',
      fill: { kind: 'texture', url: `${A}/materia/meteorite-macro.png` },
      outline: { color: '#0c0a04', width: 0.22 },
      glow: { color: '#c9a13b', intensity: 0.12 },
    },
    bindings: [bind('float', 'time', { amplitude: 0.02, periodSec: 8 })],
  }),
  node({
    id: 'orr-materia-brass', hub: 's3-materia', subtype: 'material-swatch',
    caption: 'Guilloché brass macro — magnetic swatch, shines under the pointer.',
    renderMode: 'plane', sourceAsset: `${A}/materia/brass-macro.png`,
    t: { x: -2.3, y: -0.35, z: 0.3, width: 1.9, height: 1.9 },
    sp: sp(-2.3, -0.35, 0.3),
    imageSpec: { cornerRadiusPx: 26 },
    bindings: [
      bind('magnetic', 'pointer', { strengthPx: 14, radiusPx: 200 }),
      bind('pointer-shine', 'pointer', { intensity: 0.5 }),
      bind('scroll-stagger-rise', 'scroll', { distancePx: 60, index: 0 }),
    ],
  }),
  node({
    id: 'orr-materia-sapphire', hub: 's3-materia', subtype: 'material-swatch',
    caption: 'Sapphire macro — the crystal that domes the orrery.',
    renderMode: 'plane', sourceAsset: `${A}/materia/sapphire-macro.png`,
    t: { x: 0, y: -0.35, z: 0.3, width: 1.9, height: 1.9 },
    sp: sp(0, -0.35, 0.3),
    imageSpec: { cornerRadiusPx: 26 },
    bindings: [
      bind('magnetic', 'pointer', { strengthPx: 14, radiusPx: 200 }),
      bind('pointer-shine', 'pointer', { intensity: 0.55 }),
      bind('scroll-stagger-rise', 'scroll', { distancePx: 60, index: 1 }),
    ],
  }),
  node({
    id: 'orr-materia-meteorite', hub: 's3-materia', subtype: 'material-swatch',
    caption: 'Meteorite macro — Widmanstätten lattice, four billion years old.',
    renderMode: 'plane', sourceAsset: `${A}/materia/meteorite-macro.png`,
    t: { x: 2.3, y: -0.35, z: 0.3, width: 1.9, height: 1.9 },
    sp: sp(2.3, -0.35, 0.3),
    imageSpec: { cornerRadiusPx: 26 },
    bindings: [
      bind('magnetic', 'pointer', { strengthPx: 14, radiusPx: 200 }),
      bind('pointer-shine', 'pointer', { intensity: 0.5 }),
      bind('scroll-stagger-rise', 'scroll', { distancePx: 60, index: 2 }),
    ],
  }),
  node({
    id: 'orr-materia-pour', hub: 's3-materia', subtype: 'video-moment',
    caption: 'THE VIDEO MOMENT — molten brass pours forever (seamless generated loop as a real video texture).',
    renderMode: 'plane', videoUrl: `${A}/video/molten-pour.mp4`,
    sourceAsset: `${A}/refs/molten-pour-frame.png`,
    t: { x: 0, y: -1.78, z: 0.1, width: 4.2, height: 2.36 },
    sp: sp(0, -1.78, 0.1),
    imageSpec: { cornerRadiusPx: 22 },
    bindings: [
      bind('embers', 'time', { density: 0.35 }),
      bind('scroll-zoom', 'scroll', { from: 0.96, to: 1.04 }),
    ],
  }),
];

// ── HUB 4 · CELESTIA — the planetarium ─────────────────────────────────────
const planet = (id, x, z, tex, r, periodSec, idx) =>
  node({
    id, hub: 's4-celestia', subtype: 'planet-3d', serviceTag: 'ui-3d',
    caption: `Orbiting body ${idx + 1} — stone sphere under the rig; click to relight the system (state driver).`,
    renderMode: 'mesh',
    meshPrimitive: { kind: 'sphere', params: { radius: r, widthSegments: 48, heightSegments: 32 } },
    t: { x, y: -0.1, z, width: r * 2, height: r * 2 },
    sp: sp(x, -0.1, z),
    materialSpec: { baseColorMapUrl: tex, roughness: 0.35, metalness: idx === 1 ? 0.85 : 0.05 },
    bindings: [
      bind('orbit-rings', 'time', { radius: Math.abs(x) || 1, periodSec, axis: 'y' }),
      bind('spin', 'time', { axis: 'y', periodSec: 21 + idx * 6 }),
      bind('neon-edge-pulse', 'state', { state: 'selected', color: '#d8a73f' }),
    ],
  });

const celestiaNodes = [
  node({
    id: 'orr-celestia-title', hub: 's4-celestia', subtype: 'headline-text', serviceTag: 'ui-text',
    caption: 'Constellation headline — kinetic letterforms over the star field.',
    renderMode: 'text',
    t: { x: 0, y: 1.25, z: 0.2, width: 6.8, height: 0.6 },
    sp: sp(0, 1.25, 0.2),
    textSpec: {
      content: 'A sky on your wrist.',
      fontFamily: 'Inter', fontWeight: 600, fontSize: 0.5,
      align: 'center',
      fill: { kind: 'gradient', from: '#dfe6f5', to: '#8fa7cb', angleDeg: 90 },
      glow: { color: '#9db8e0', intensity: 0.22 },
      outline: { color: '#060910', width: 0.2 },
    },
    prims: [{ name: 'kinetic-text', params: { stagger: 0.05, duration: 0.9, effect: 'rise', easing: 'power3.out' }, trigger: 'inview' }],
    bindings: [bind('fade-vignette', 'scroll', { intensity: 0.3 })],
  }),
  planet('orr-celestia-planet-lapis', -2.2, -0.2, `${A}/celestia/planet-marble.png`, 0.52, 38, 0),
  planet('orr-celestia-planet-brass', 0.4, -0.6, `${A}/celestia/planet-brass.png`, 0.34, 26, 1),
  planet('orr-celestia-planet-obsidian', 2.4, 0.1, `${A}/celestia/planet-obsidian.png`, 0.42, 49, 2),
  node({
    id: 'orr-celestia-stars', hub: 's4-celestia', subtype: 'ambience', serviceTag: 'ui-fx',
    caption: 'Galaxy particle field — the deep bench of stars behind the orrery.',
    renderMode: 'plane',
    t: { x: 0, y: 0, z: -1.8, width: 10, height: 5.6 },
    sp: sp(0, 0, -1.8),
    alpha: 0.9,
    bindings: [bind('galaxy-particles', 'time', { density: 0.6, twinkle: 0.4 })],
  }),
];

// ── HUB 5 · ACQUIRE — the pedestal ─────────────────────────────────────────
const acquireNodes = [
  node({
    id: 'orr-acquire-pedestal', hub: 's5-acquire', subtype: 'stage-3d', serviceTag: 'ui-3d',
    caption: 'Obsidian pedestal with brass inlay — generated 3D stage for the closing beat.',
    renderMode: 'mesh', meshUrl: `${A}/meshes/pedestal.glb`,
    t: { x: 0, y: -1.5, z: 0.2, width: 2.2, height: 1.6 },
    sp: sp(0, -1.5, 0.2, { scaleX: 1.6, scaleY: 1.6, scaleZ: 1.6 }),
    bindings: [bind('fade-up', 'time', { delay: 0.2, duration: 0.9 })],
  }),
  node({
    id: 'orr-acquire-watch', hub: 's5-acquire', subtype: 'product-hero', serviceTag: 'ui-3d',
    caption: 'The timepiece, at rest on its pedestal — slow turntable; click for a glint pass.',
    renderMode: 'mesh', meshUrl: `${A}/meshes/watch.glb`,
    t: { x: 0, y: -0.35, z: 0.45, width: 2.0, height: 2.0 },
    sp: sp(0, -0.5, 0.45, { scaleX: 1.45, scaleY: 1.45, scaleZ: 1.45, rotationX: 0.18 }),
    bindings: [
      bind('spin', 'time', { axis: 'y', periodSec: 24 }),
      bind('scale-pop', 'event', { trigger: 'click', factor: 1.05 }),
      bind('pointer-orbit', 'pointer', { maxDeg: 6 }),
    ],
  }),
  node({
    id: 'orr-acquire-cta', hub: 's5-acquire', subtype: 'cta-text', serviceTag: 'ui-text',
    caption: 'Closing line + call to action — brass-poured, magnetic, pops on click (event driver).',
    renderMode: 'text',
    t: { x: 0, y: 1.0, z: 0.2, width: 6.4, height: 0.85 },
    sp: sp(0, 1.0, 0.2),
    textSpec: {
      content: 'Eleven made.\nOne is yours.',
      fontFamily: 'Inter', fontWeight: 600, fontSize: 0.4,
      lineHeight: 1.35, align: 'center',
      fill: { kind: 'texture', url: `${A}/materia/brass-macro.png` },
      outline: { color: '#14100a', width: 0.22 },
      glow: { color: '#d8a73f', intensity: 0.2 },
    },
    bindings: [
      bind('magnetic', 'pointer', { strengthPx: 10, radiusPx: 260 }),
      bind('scale-pop', 'event', { trigger: 'click', factor: 1.06 }),
      bind('float', 'time', { amplitude: 0.02, periodSec: 9 }),
    ],
  }),
  node({
    id: 'orr-acquire-reserve', hub: 's5-acquire', subtype: 'spec-text', serviceTag: 'ui-text',
    caption: 'Reservation micro-copy.',
    renderMode: 'text',
    t: { x: 0, y: 2.0, z: 0.1, width: 4.2, height: 0.22 },
    sp: sp(0, 2.0, 0.1),
    textSpec: {
      content: 'ATELIER PRISM — BY APPOINTMENT',
      fontFamily: 'Inter', fontWeight: 400, fontSize: 0.11,
      letterSpacing: 0.22, align: 'center',
      fill: { kind: 'solid', color: '#9aa3b8' },
    },
    bindings: [bind('fade-up', 'time', { delay: 0.6, duration: 1.0 })],
  }),
];

// ── hubs + lighting ────────────────────────────────────────────────────────
const warmKey = (intensity = 1.1) => ({
  lights: [
    { id: 'key', type: 'directional', color: '#f2d9a0', intensity, position: { x: -3, y: 4, z: 5 }, castShadow: true },
    { id: 'rim', type: 'directional', color: '#7fa0c4', intensity: 0.35, position: { x: 4, y: -2, z: -3 } },
  ],
  env: { preset: 'night', intensity: 0.5 },
  shadowSoftness: 0.7,
});

const hubs = [
  hub('s1-arrival', 'Arrival',
    'The timepiece floats in deep space over the brass orrery rings — molten headline, drifting dust, scroll descends toward the movement.',
    [
      { id: 'bg-space', attachment: 'parallax', sourceUrl: `${A}/arrival/backdrop.png`, z: -3, parallaxDepth: 0.25, opacity: 1 },
    ],
    warmKey(1.2), 1440),
  hub('s2-movement', 'The Movement',
    'Exploded mechanism — generated gears and tourbillon turning as real lit 3D over macro photography.',
    [
      { id: 'bg-macro', attachment: 'parallax', sourceUrl: `${A}/movement/backdrop.png`, z: -3, parallaxDepth: 0.18, opacity: 0.32 },
    ],
    warmKey(1.0), 1080),
  hub('s3-materia', 'Materia',
    'Brass, sapphire, meteorite — material swatches with magnetic pointer physics and the molten pour video moment.',
    [
      { id: 'bg-still', attachment: 'parallax', sourceUrl: `${A}/materia/backdrop.png`, z: -3, parallaxDepth: 0.15, opacity: 0.6 },
    ],
    warmKey(1.05), 1440),
  hub('s4-celestia', 'Celestia',
    'The planetarium — stone planets orbit a brass armillary under the star field; click a planet to relight the system.',
    [
      { id: 'bg-planetarium', attachment: 'parallax', sourceUrl: `${A}/celestia/backdrop.png`, z: -3.4, parallaxDepth: 0.3, opacity: 0.85 },
    ],
    {
      lights: [
        { id: 'key', type: 'point', color: '#e8d9ac', intensity: 1.3, position: { x: 0, y: 2, z: 2 } },
        { id: 'fill', type: 'directional', color: '#5d7ba6', intensity: 0.3, position: { x: -4, y: -1, z: 3 } },
      ],
      env: { preset: 'night', intensity: 0.65 },
      shadowSoftness: 0.8,
    }, 1080),
  hub('s5-acquire', 'Acquire',
    'The closing beat — the timepiece on its obsidian pedestal under a single warm key; eleven made, one is yours.',
    [
      { id: 'bg-gallery', attachment: 'parallax', sourceUrl: `${A}/acquire/backdrop.png`, z: -3, parallaxDepth: 0.12, opacity: 0.9 },
    ],
    warmKey(1.25), 720),
];

const nodes = [...arrivalNodes, ...movementNodes, ...materiaNodes, ...celestiaNodes, ...acquireNodes];

// NOTE: hub ids carry s1..s5 prefixes — compileAppToPreview orders hubs
// alphabetically by hubId for deterministic hashing, so the prefix IS the
// narrative order (arrival → movement → materia → celestia → acquire).
// narrative edges (decorative graph topology: each hub's hero links forward)
const edges = [
  { from: 'orr-arrival-watch', to: 'orr-movement-tourbillon', type: 'narrative', event: '' },
  { from: 'orr-movement-tourbillon', to: 'orr-materia-pour', type: 'narrative', event: '' },
  { from: 'orr-materia-pour', to: 'orr-celestia-planet-brass', type: 'narrative', event: '' },
  { from: 'orr-celestia-planet-brass', to: 'orr-acquire-watch', type: 'narrative', event: '' },
  { from: 'orr-arrival-headline', to: 'orr-arrival-watch', type: 'contains', event: '' },
];

// root node: carry the previous App_Name_World, updated for the new app
const root = JSON.parse(JSON.stringify(prev.rootNodes[0]));
root.spec.name = 'ORRERY No.7';
root.spec.summary =
  'Flagship showcase — a celestial-mechanics timepiece told across five hubs: arrival, movement, materia, celestia, acquire. Photoreal generated assets as real scene nodes; bindings across all five drivers.';
root.spec.goals = [
  'Story-grade five-hub journey with morph-through navigation',
  'Photoreal generated 3D + 4MP imagery + a seamless video-texture moment',
  'Poured-texture MSDF text; bindings across time/scroll/pointer/state/event',
];
root.hubRegistry = hubs.map((h, i) => ({ hubId: h.hubId, role: i === 0 ? 'landing' : 'chapter' }));

const out = {
  schemaVersion: prev.schemaVersion,
  _comment:
    'ORRERY No.7 — UI-FIDELITY-2 W3 flagship showcase (5 hubs). Generated by scripts/build-orrery-graph.mjs; assets under /prism-mock/orrery (fal.ai, vision-critiqued). hub (singular) kept for wire-compat = hubs[0].',
  hub: hubs[0],
  hubs,
  nodes,
  edges,
  rootNodes: [root],
};

if (!existsSync(`${livePath}.pre-orrery-backup`)) {
  copyFileSync(livePath, `${livePath}.pre-orrery-backup`);
  console.log('backed up previous seed → live-graph.json.pre-orrery-backup');
}
writeFileSync(livePath, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${livePath}: ${hubs.length} hubs, ${nodes.length} nodes, ${edges.length} edges`);
