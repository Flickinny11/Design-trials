#!/usr/bin/env node
// F4a — DEMO APP shell (persistent header + nav + footer) + a COMPLETE Arrival
// landing composition, authored directly into the LIVE graph.
//
// Scope: SHELL + ARRIVAL ONLY (the other 4 hubs are gated to Logan). This
// script edits public/prism-mock/home/live-graph.json in place:
//   - strips the 3 stray editor-test nodes (uuid ids) on s1-arrival
//   - strips any prior F4a-authored nodes (id prefixes `shell-` / `sec-`
//     / `hero-`) so the script is fully idempotent / re-runnable
//   - repositions the 4 original authored Arrival nodes (headline/sub/watch/
//     dust) to frame the new composition
//   - appends the shell (header bar + brand + 5 nav links + Reserve CTA) and
//     the Arrival sections (hero CTA, hero detail plates, spec ribbon, footer)
//   - adds header-nav navigate edges (decorative topology)
//
// It NEVER touches hubs[]/background[]/lightingSpec/rootNodes (the live
// procedural brass-nebula backgrounds are richer than the legacy orrery
// builder emitted — preserved verbatim). Then run `npm run build:prism`.
//
// Camera (preview-app, s1-arrival, no journey): PerspectiveCamera fov 45 at
// z=10.5 looking at origin. Visible envelope at z~0: Y in [-4.35, 4.35],
// X in [-6.96, 6.96] (aspect 1.6). All authored nodes sit inside that frame.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const livePath = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
const A = '/prism-mock/orrery';
const HUB = 's1-arrival';

// ── palette (warm luxury horology brand content — NOT editor UI brass) ───────
const BRASS_TEX = `${A}/materia/brass-macro.png`;
const METEOR_TEX = `${A}/materia/meteorite-macro.png`;
const SAPPH_TEX = `${A}/materia/sapphire-macro.png`;
const ATELIER_IMG = `${A}/arrival/atelier-craft.png`; // F4a fal flux-2-pro
const CHAMPAGNE = '#d8cdb0';
const BONE = '#cfd4e2';
const DIM = '#8b93a6';
const INK = '#15110a';

// ── helpers ──────────────────────────────────────────────────────────────────
const sp = (x, y, z, extra = {}) => ({
  x, y, z, rotationX: 0, rotationY: 0, rotationZ: 0,
  scaleX: 1, scaleY: 1, scaleZ: 1, ...extra,
});

const baseIntent = (caption) => ({
  caption,
  behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
  stateEffects: [],
  visualSpec: { textContent: [], layers: [] },
  contracts: { inputs: {}, outputs: {} },
});

let ord = 100; // F4a binding order space (existing graph uses 0..39)
const bind = (primitive, driver, params = {}) => ({
  id: `f4a-${primitive}-${ord}`, primitive, driver, params, order: ord++,
});

function tnode(o) {
  // text node
  return {
    nodeId: o.id, subtype: o.subtype ?? 'ui-text-element', parentHubId: HUB,
    serviceTag: 'ui-text',
    visual: { transform: { x: o.sp.x, y: o.sp.y, z: o.sp.z, width: o.w ?? 4, height: o.h ?? 0.4 }, alpha: o.alpha ?? 1 },
    intent: baseIntent(o.caption),
    codeRef: '', backendRef: null,
    renderMode: 'text', depthMapUrl: null, meshUrl: null,
    cinematicPrimitives: o.prims ?? [],
    scenePosition: o.sp,
    textSpec: o.textSpec,
    ...(o.bindings ? { animationBindings: o.bindings } : {}),
    ...(o.fn ? { functionBinding: o.fn } : {}),
    receivesLighting: false,
    depthLayer: o.depthLayer ?? 'foreground-FX',
  };
}

function meshnode(o) {
  // lit primitive-mesh node (slabs / buttons)
  return {
    nodeId: o.id, subtype: o.subtype ?? 'ui-3d-element', parentHubId: HUB,
    serviceTag: 'ui-3d',
    visual: { transform: { x: o.sp.x, y: o.sp.y, z: o.sp.z, width: o.w ?? 1, height: o.h ?? 1 }, alpha: 1 },
    intent: baseIntent(o.caption),
    codeRef: '', backendRef: null,
    renderMode: 'mesh', depthMapUrl: null, meshUrl: null,
    cinematicPrimitives: [],
    scenePosition: o.sp,
    meshPrimitive: o.meshPrimitive,
    materialSpec: o.materialSpec,
    receivesLighting: true,
    ...(o.bindings ? { animationBindings: o.bindings } : {}),
    ...(o.fn ? { functionBinding: o.fn } : {}),
    depthLayer: o.depthLayer ?? 'content',
  };
}

function planenode(o) {
  // image plane node (framed macro plates)
  return {
    nodeId: o.id, subtype: o.subtype ?? 'ui-visual-element', parentHubId: HUB,
    serviceTag: 'ui-visual',
    visual: { transform: { x: o.sp.x, y: o.sp.y, z: o.sp.z, width: o.w ?? 1.8, height: o.h ?? 2.2 }, alpha: 1, sourceAsset: o.sourceAsset, opaque: true },
    intent: baseIntent(o.caption),
    codeRef: '', backendRef: null,
    renderMode: 'plane', depthMapUrl: null, meshUrl: null,
    cinematicPrimitives: [],
    scenePosition: o.sp,
    imageSpec: { cornerRadius: 0.12, fit: 'cover', opacity: 1 },
    receivesLighting: false,
    ...(o.bindings ? { animationBindings: o.bindings } : {}),
    depthLayer: o.depthLayer ?? 'midground',
  };
}

// ── material recipes (real lit metal — beveled, clearcoated, NOT flat) ───────
const GUNMETAL = {
  baseColor: '#171b22', metalness: 0.82, roughness: 0.34,
  clearcoat: 0.35, clearcoatRoughness: 0.4,
  emissive: '#2a1d08', emissiveIntensity: 0.1, envMapIntensity: 1.1,
};
const BRASS_METAL = {
  baseColor: '#b07f33', metalness: 0.95, roughness: 0.24,
  clearcoat: 0.6, clearcoatRoughness: 0.22,
  emissive: '#4a3210', emissiveIntensity: 0.22, envMapIntensity: 1.3,
};
const BRASS_HAIRLINE = {
  baseColor: '#caa24a', metalness: 0.95, roughness: 0.2,
  clearcoat: 0.5, emissive: '#3a2a0c', emissiveIntensity: 0.18, envMapIntensity: 1.25,
};

const NAV = [
  { key: 'arrival', label: 'Arrival', hub: 's1-arrival', x: -1.55, active: true },
  { key: 'movement', label: 'The Movement', hub: 's2-movement', x: -0.05 },
  { key: 'materia', label: 'Materia', hub: 's3-materia', x: 1.35 },
  { key: 'celestia', label: 'Celestia', hub: 's4-celestia', x: 2.45 },
  { key: 'acquire', label: 'Acquire', hub: 's5-acquire', x: 3.55 },
];

function buildNew() {
  const out = [];

  // ============================ SHELL · HEADER ===============================
  // Header bar — a real beveled gunmetal slab spanning the top, brass-lit edge.
  out.push(meshnode({
    id: 'shell-header-bar', subtype: 'app-header',
    caption: 'Persistent app header bar — machined gunmetal slab with a brass-lit leading edge; the chrome the whole app hangs from.',
    sp: sp(0, 3.78, -0.15), w: 13.8, h: 0.6,
    meshPrimitive: { kind: 'cube', params: { width: 13.8, height: 0.6, depth: 0.16 } },
    materialSpec: GUNMETAL, depthLayer: 'overlay',
  }));
  // Header hairline — thin brass rule riding the bar's lower lip for depth.
  out.push(meshnode({
    id: 'shell-header-rule', subtype: 'app-header-rule',
    caption: 'Brass hairline rule under the header — a lit edge that reads as machined inlay.',
    sp: sp(0, 3.46, -0.05), w: 13.8, h: 0.03,
    meshPrimitive: { kind: 'cube', params: { width: 13.8, height: 0.035, depth: 0.05 } },
    materialSpec: BRASS_HAIRLINE, depthLayer: 'overlay',
  }));
  // Brand wordmark (left) — poured brass, navigates home.
  out.push(tnode({
    id: 'shell-brand-mark', subtype: 'brand-wordmark',
    caption: 'Brand wordmark in the header — ORRERY No.7 poured in brass; clicking returns to Arrival.',
    sp: sp(-5.35, 3.78, 0.08), w: 3.2, h: 0.3,
    textSpec: {
      content: 'ORRERY No.7', fontFamily: 'Inter', fontWeight: 600, fontSize: 0.2,
      letterSpacing: 0.02, align: 'left',
      fill: { kind: 'texture', url: BRASS_TEX },
      outline: { color: INK, width: 0.2 }, glow: { color: '#d8a73f', intensity: 0.12 },
    },
    fn: { kind: 'navigate', hubId: 's1-arrival' },
    bindings: [bind('magnetic', 'pointer', { strengthPx: 6, radiusPx: 150 })],
    depthLayer: 'overlay',
  }));

  // Nav links (5) — champagne, hover-glow, each navigates to its hub.
  for (const n of NAV) {
    out.push(tnode({
      id: `shell-nav-${n.key}`, subtype: 'nav-link',
      caption: `Header nav link "${n.label}" — navigates to the ${n.label} hub on click.`,
      sp: sp(n.x, 3.78, 0.08), w: 1.4, h: 0.24,
      textSpec: {
        content: n.label, fontFamily: 'Inter', fontWeight: n.active ? 600 : 500, fontSize: 0.135,
        letterSpacing: 0.03, align: 'center',
        ...(n.active
          ? { fill: { kind: 'texture', url: BRASS_TEX }, glow: { color: '#d8a73f', intensity: 0.14 } }
          : { fill: { kind: 'solid', color: CHAMPAGNE }, glow: { color: '#7fa0c4', intensity: 0.05 } }),
        outline: { color: INK, width: 0.18 },
      },
      fn: { kind: 'navigate', hubId: n.hub },
      bindings: [bind('magnetic', 'pointer', { strengthPx: 5, radiusPx: 110 })],
      depthLayer: 'overlay',
    }));
  }

  // Header CTA — brass button slab + label, navigates to Acquire.
  out.push(meshnode({
    id: 'shell-header-cta-slab', subtype: 'cta-button',
    caption: 'Header call-to-action button — solid brass pill slab; reserve flow, pops on click, leans to the cursor.',
    sp: sp(5.55, 3.78, 0.02), w: 1.7, h: 0.46,
    meshPrimitive: { kind: 'cube', params: { width: 1.7, height: 0.46, depth: 0.14 } },
    materialSpec: BRASS_METAL,
    fn: { kind: 'navigate', hubId: 's5-acquire' },
    bindings: [
      bind('magnetic', 'pointer', { strengthPx: 8, radiusPx: 170 }),
      bind('scale-pop', 'event', { trigger: 'click', factor: 1.06 }),
    ],
    depthLayer: 'overlay',
  }));
  out.push(tnode({
    id: 'shell-header-cta-label', subtype: 'cta-label',
    caption: 'Reserve label riding the header CTA slab.',
    sp: sp(5.55, 3.78, 0.13), w: 1.6, h: 0.2,
    textSpec: {
      content: 'Reserve', fontFamily: 'Inter', fontWeight: 600, fontSize: 0.135,
      letterSpacing: 0.04, align: 'center', fill: { kind: 'solid', color: INK },
    },
    fn: { kind: 'navigate', hubId: 's5-acquire' },
    depthLayer: 'overlay',
  }));

  // ============================ HERO · CTA + plates ==========================
  // Primary hero CTA — brass pill slab + label, magnetic, pops, navigates.
  out.push(meshnode({
    id: 'hero-cta-slab', subtype: 'cta-button',
    caption: 'Primary hero call-to-action — a brass pill that draws to the cursor and pops on click; opens the reservation hub.',
    sp: sp(0, 0.7, 0.18), w: 3.3, h: 0.56,
    meshPrimitive: { kind: 'cube', params: { width: 3.3, height: 0.56, depth: 0.16 } },
    materialSpec: BRASS_METAL,
    fn: { kind: 'navigate', hubId: 's5-acquire' },
    bindings: [
      bind('magnetic', 'pointer', { strengthPx: 12, radiusPx: 240 }),
      bind('scale-pop', 'event', { trigger: 'click', factor: 1.07 }),
      bind('float', 'time', { amplitude: 0.012, periodSec: 8 }),
    ],
    depthLayer: 'content',
  }));
  out.push(tnode({
    id: 'hero-cta-label', subtype: 'cta-label',
    caption: 'Reserve Your No.7 — the label on the primary hero CTA.',
    sp: sp(0, 0.7, 0.3), w: 3.1, h: 0.24,
    textSpec: {
      content: 'RESERVE YOUR No.7', fontFamily: 'Inter', fontWeight: 600, fontSize: 0.145,
      letterSpacing: 0.05, align: 'center', fill: { kind: 'solid', color: INK },
    },
    fn: { kind: 'navigate', hubId: 's5-acquire' },
    bindings: [bind('float', 'time', { amplitude: 0.012, periodSec: 8 })],
    depthLayer: 'content',
  }));

  // Hero detail plates — framed material macros flanking the watch (imagery).
  out.push(planenode({
    id: 'hero-plate-brass', subtype: 'gallery-plate',
    caption: 'Hero detail plate (left) — guilloché brass macro in a framed plate, drifts and tilts on scroll.',
    sp: sp(-5.45, -0.05, 0.1, { rotationY: 0.26 }), w: 1.55, h: 2.0,
    sourceAsset: BRASS_TEX,
    bindings: [
      bind('float', 'time', { amplitude: 0.03, periodSec: 9 }),
      bind('scroll-rotate-3d', 'scroll', { axis: 'y', degrees: 10 }),
    ],
  }));
  out.push(planenode({
    id: 'hero-plate-sapphire', subtype: 'gallery-plate',
    caption: 'Hero detail plate (right) — sapphire crystal macro in a framed plate, drifts and tilts on scroll.',
    sp: sp(5.45, -0.05, 0.1, { rotationY: -0.26 }), w: 1.55, h: 2.0,
    sourceAsset: SAPPH_TEX,
    bindings: [
      bind('float', 'time', { amplitude: 0.03, periodSec: 10 }),
      bind('scroll-rotate-3d', 'scroll', { axis: 'y', degrees: -10 }),
    ],
  }));

  // ===================== SECTION · ATELIER (feature + imagery) ===============
  // A real editorial imagery section: photoreal atelier plate (left) + a
  // feature headline & body (right). Sits between the hero and the watch's
  // lower presence, reading as a distinct "how it's made" band. Wide 16:9
  // photoreal plate generated with fal flux-2-pro (atelier-craft.png).
  out.push(planenode({
    id: 'sec-atelier-plate', subtype: 'feature-image',
    caption: 'Atelier feature image — a watchmaker setting a ruby jewel into the brass movement; photoreal editorial plate, drifts on idle, parallax-tilts on scroll.',
    sp: sp(-3.55, -2.0, 0.45, { rotationY: 0.16 }), w: 3.5, h: 1.97,
    sourceAsset: ATELIER_IMG,
    bindings: [
      bind('float', 'time', { amplitude: 0.018, periodSec: 11 }),
      bind('scroll-rotate-3d', 'scroll', { axis: 'y', degrees: 6 }),
      bind('scale-pop', 'event', { trigger: 'click', factor: 1.03 }),
    ],
    depthLayer: 'content',
  }));
  out.push(tnode({
    id: 'sec-atelier-eyebrow', subtype: 'section-eyebrow',
    caption: 'Atelier section eyebrow.',
    sp: sp(3.45, -1.42, 0.5), w: 4.6, h: 0.18,
    textSpec: {
      content: 'HAND-FINISHED IN GENEVA', fontFamily: 'Inter', fontWeight: 500, fontSize: 0.098,
      letterSpacing: 0.3, align: 'center', fill: { kind: 'solid', color: DIM },
    },
    bindings: [bind('fade-up', 'time', { delay: 0.25, duration: 0.9 })],
  }));
  out.push(tnode({
    id: 'sec-atelier-title', subtype: 'feature-title',
    caption: 'Atelier feature title.',
    sp: sp(3.45, -2.02, 0.5), w: 5.2, h: 0.6,
    textSpec: {
      content: 'Eleven years.\nOne hand.', fontFamily: 'Inter', fontWeight: 600, fontSize: 0.32,
      lineHeight: 1.16, letterSpacing: -0.005, align: 'center',
      fill: { kind: 'gradient', from: '#e8d9ac', to: '#8a6f2e', angleDeg: 90 },
      outline: { color: INK, width: 0.22 },
    },
    bindings: [bind('fade-up', 'time', { delay: 0.35, duration: 1.0 })],
  }));
  out.push(tnode({
    id: 'sec-atelier-body', subtype: 'feature-body',
    caption: 'Atelier feature body copy.',
    sp: sp(3.45, -2.62, 0.5), w: 5.6, h: 0.5,
    textSpec: {
      content: 'Every jewel set, every wheel finished by a single master at the\nbench — the movement assembled the way it was a century ago.',
      fontFamily: 'Inter', fontWeight: 400, fontSize: 0.108, lineHeight: 1.5,
      letterSpacing: 0.02, align: 'center', fill: { kind: 'solid', color: BONE },
    },
    bindings: [bind('fade-up', 'time', { delay: 0.45, duration: 1.0 })],
  }));

  // ===================== SECTION · SPEC STRIP (compact) ======================
  // A compact instrument-grade specification strip seated on a thin gunmetal
  // shelf, just above the footer — the "spec/feature" band without crowding.
  out.push(meshnode({
    id: 'sec-spec-rail', subtype: 'spec-rail',
    caption: 'Spec strip rail — a thin gunmetal shelf that seats the specification figures with real depth.',
    sp: sp(0, -3.16, -0.05), w: 11.2, h: 0.5,
    meshPrimitive: { kind: 'cube', params: { width: 11.2, height: 0.5, depth: 0.12 } },
    materialSpec: { ...GUNMETAL, emissiveIntensity: 0.06, baseColor: '#12151c' },
    depthLayer: 'background',
  }));
  out.push(meshnode({
    id: 'sec-spec-rail-edge', subtype: 'spec-rail-edge',
    caption: 'Brass hairline along the spec strip top edge.',
    sp: sp(0, -2.93, 0.02), w: 11.2, h: 0.025,
    meshPrimitive: { kind: 'cube', params: { width: 11.2, height: 0.028, depth: 0.05 } },
    materialSpec: BRASS_HAIRLINE, depthLayer: 'content',
  }));
  out.push(tnode({
    id: 'sec-spec-strip', subtype: 'spec-strip',
    caption: 'Specification strip — instrument-grade figures: components, jewels, reserve, edition.',
    sp: sp(0, -3.16, 0.12), w: 10.6, h: 0.3,
    textSpec: {
      content: '311 COMPONENTS      27 JEWELS      28,800 VPH      96H RESERVE      11 MADE',
      fontFamily: 'Inter', fontWeight: 500, fontSize: 0.125, letterSpacing: 0.12,
      align: 'center', fill: { kind: 'solid', color: CHAMPAGNE },
      outline: { color: INK, width: 0.18 }, glow: { color: '#d8a73f', intensity: 0.06 },
    },
    bindings: [bind('fade-up', 'time', { delay: 0.4, duration: 0.95 })],
  }));

  // ============================ SHELL · FOOTER ===============================
  out.push(meshnode({
    id: 'shell-footer-bar', subtype: 'app-footer',
    caption: 'Persistent app footer bar — machined gunmetal slab anchoring the page.',
    sp: sp(0, -3.85, -0.15), w: 13.8, h: 0.74,
    meshPrimitive: { kind: 'cube', params: { width: 13.8, height: 0.74, depth: 0.16 } },
    materialSpec: GUNMETAL, depthLayer: 'overlay',
  }));
  out.push(meshnode({
    id: 'shell-footer-rule', subtype: 'app-footer-rule',
    caption: 'Brass hairline along the footer top edge.',
    sp: sp(0, -3.49, -0.05), w: 13.8, h: 0.03,
    meshPrimitive: { kind: 'cube', params: { width: 13.8, height: 0.035, depth: 0.05 } },
    materialSpec: BRASS_HAIRLINE, depthLayer: 'overlay',
  }));
  out.push(tnode({
    id: 'shell-footer-brand', subtype: 'footer-brand',
    caption: 'Footer brand mark.',
    sp: sp(-5.35, -3.7, 0.08), w: 3, h: 0.24,
    textSpec: {
      content: 'ORRERY No.7', fontFamily: 'Inter', fontWeight: 600, fontSize: 0.155,
      letterSpacing: 0.02, align: 'left', fill: { kind: 'texture', url: BRASS_TEX },
      outline: { color: INK, width: 0.2 },
    },
    fn: { kind: 'navigate', hubId: 's1-arrival' },
    depthLayer: 'overlay',
  }));
  out.push(tnode({
    id: 'shell-footer-legal', subtype: 'footer-legal',
    caption: 'Footer legal line.',
    sp: sp(-5.35, -3.99, 0.08), w: 5, h: 0.16,
    textSpec: {
      content: '© ATELIER PRISM · GENEVA — ELEVEN MADE, ONE IS YOURS',
      fontFamily: 'Inter', fontWeight: 400, fontSize: 0.08, letterSpacing: 0.1,
      align: 'left', fill: { kind: 'solid', color: DIM },
    },
    depthLayer: 'overlay',
  }));
  out.push(tnode({
    id: 'shell-footer-links', subtype: 'footer-links',
    caption: 'Footer link column — the hub trail.',
    sp: sp(2.6, -3.7, 0.08), w: 6, h: 0.2,
    textSpec: {
      content: 'MOVEMENT      MATERIA      CELESTIA      ACQUIRE',
      fontFamily: 'Inter', fontWeight: 500, fontSize: 0.1, letterSpacing: 0.14,
      align: 'center', fill: { kind: 'solid', color: CHAMPAGNE },
    },
    depthLayer: 'overlay',
  }));
  out.push(tnode({
    id: 'shell-footer-social', subtype: 'footer-social',
    caption: 'Footer social line.',
    sp: sp(2.6, -3.99, 0.08), w: 6, h: 0.16,
    textSpec: {
      content: 'INSTAGRAM · X · THE JOURNAL',
      fontFamily: 'Inter', fontWeight: 400, fontSize: 0.082, letterSpacing: 0.16,
      align: 'center', fill: { kind: 'solid', color: DIM },
    },
    depthLayer: 'overlay',
  }));

  return out;
}

// ── apply to live graph ──────────────────────────────────────────────────────
const g = JSON.parse(readFileSync(livePath, 'utf8'));

const STRAY = new Set([
  '7cdfb833-aea8-4a8d-afcf-a1f8c659ccc1',
  'cf8ea5d0-9f37-4a2a-bd75-8574fadd76d2',
  '9a05c772-55d3-4bfd-ac2c-204ca3593ed4',
]);
const isF4a = (id) => /^(shell-|sec-|hero-)/.test(id || '');

// 1) drop strays + any prior F4a nodes (idempotent re-run)
const before = g.nodes.length;
g.nodes = g.nodes.filter((n) => !STRAY.has(n.nodeId) && !isF4a(n.nodeId));

// 2) reposition the 4 original authored Arrival nodes to frame the composition
const reposition = {
  'orr-arrival-headline': { y: 2.5, z: 0.3 },
  'orr-arrival-sub': { y: 1.92, z: 0.25 },
  'orr-arrival-watch': { y: -0.4, z: 0.6 },
  // dust stays at origin (ambience full-bleed)
};
for (const n of g.nodes) {
  const r = reposition[n.nodeId];
  if (r && n.scenePosition) {
    n.scenePosition.x = r.x ?? n.scenePosition.x;
    n.scenePosition.y = r.y;
    n.scenePosition.z = r.z ?? n.scenePosition.z;
    if (n.visual?.transform) { n.visual.transform.y = r.y; n.visual.transform.z = r.z ?? n.visual.transform.z; }
  }
}
// the watch is the hero centerpiece — sized to sit in the upper-center without
// crowding the lower feature/spec bands.
const watch = g.nodes.find((n) => n.nodeId === 'orr-arrival-watch');
if (watch?.scenePosition) { watch.scenePosition.scaleX = watch.scenePosition.scaleY = watch.scenePosition.scaleZ = 1.7; }

// 3) append new shell + section nodes
const created = buildNew();
g.nodes.push(...created);

// 4) header-nav navigate edges (decorative topology; navigation is functionBinding-driven)
const navEdgeIds = new Set(['shell-nav-arrival','shell-nav-movement','shell-nav-materia','shell-nav-celestia','shell-nav-acquire']);
g.edges = (g.edges || []).filter((e) => !navEdgeIds.has(e.from));
for (const n of NAV) {
  g.edges.push({ from: `shell-nav-${n.key}`, to: n.hub, type: 'navigates-to', event: '' });
}

if (!existsSync(`${livePath}.pre-f4a-backup`)) {
  copyFileSync(livePath, `${livePath}.pre-f4a-backup`);
  console.log('backed up → live-graph.json.pre-f4a-backup');
}
writeFileSync(livePath, JSON.stringify(g, null, 1) + '\n');

const arrivalCount = g.nodes.filter((n) => n.parentHubId === HUB).length;
console.log(`[build-arrival-shell] nodes ${before} → ${g.nodes.length} (created ${created.length}); arrival hub now ${arrivalCount} nodes`);
console.log(`[build-arrival-shell] strays removed; shell + arrival sections authored.`);
