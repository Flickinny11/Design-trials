// testimonial-float-glass — three frosted-glass quote cards suspended at
// VARIED DEPTHS, each gently floating, with the frost itself creeping across
// the glass. The SR-smashing move: this is not a CSS backdrop-filter blur — it
// is real MeshPhysicalNodeMaterial transmission (ior 1.5, thickness, clearcoat)
// with a live `frosted-glass` roughness-sweep that clouds each pane clear→frost
// →clear, while a per-card `float` gives buoyant bob+tilt at staggered speeds so
// the three panes drift at independent depths like glass leaves on water.
//
// Composition (cluster-local origin 0,0,0): three thin glass slabs fanned across
// X and pushed to three distinct Z planes (foreground / mid / back), each with a
// short MSDF quote pulled just in front of its pane (real glyphs — INV-11, never
// diffusion). A slim brass rail sits beneath as a grounding accent so the floats
// read against structure. Palette: ice/steel-blue tinted glass + Observatory
// brass accent (NO purple). Photorealism is procedural PBR + IBL (free); no
// hero imagery needed.
//
// Every member is a real, editable PrismNode — move/recolor/re-skin/swap the
// animation post-place exactly like a hand-authored node.
//
// Tier: T1 full-fidelity. Clean T0 fallback: without screen-space transmission
// the slabs still read as lit, lightly-tinted translucent cards with crisp MSDF
// quotes — degraded, never broken (INV-9).

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// ── Card geometry (scene units) — a wide, thin glass slab. ───────────────────
const CARD_W = 1.45;
const CARD_H = 1.0;
const CARD_DEPTH = 0.07;

// Three panes, each at its own depth plane so the cluster reads with real
// parallax: foreground (closest, largest float), mid, back (furthest, calmest).
// Tinted ice/steel-blue glass; transmission carries the frost, not the color.
const CARDS = [
  {
    localId: 'glass-card-front',
    x: -1.35,
    y: 0.18,
    z: 0.85,
    rotationY: 0.22,
    tilt: 0.04,
    tint: '#bcd4e2', // pale ice
    floatSpeed: 0.95,
    floatAmp: 0.2,
    quote: 'It just\nworks.',
    author: '— Maya R.',
  },
  {
    localId: 'glass-card-mid',
    x: 0.05,
    y: -0.12,
    z: 0.0,
    rotationY: -0.05,
    tilt: -0.02,
    tint: '#a9c5d8', // steel blue
    floatSpeed: 0.7,
    floatAmp: 0.15,
    quote: 'Best in\nclass.',
    author: '— Dev T.',
  },
  {
    localId: 'glass-card-back',
    x: 1.45,
    y: 0.34,
    z: -0.9,
    rotationY: -0.26,
    tilt: 0.03,
    tint: '#c6d6df', // frost white-blue
    floatSpeed: 0.55,
    floatAmp: 0.11,
    quote: 'Stunning\ndepth.',
    author: '— Lena K.',
  },
] as const;

function pose(
  x: number,
  y: number,
  z: number,
  rotationY = 0,
  rotationZ = 0,
): ScenePosition {
  return {
    x,
    y,
    z,
    rotationX: 0,
    rotationY,
    rotationZ,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };
}

function buildMembers(): ClusterMemberTemplate[] {
  const members: ClusterMemberTemplate[] = [];

  CARDS.forEach((c, i) => {
    // ── The glass pane — a thin transmissive slab. The `frosted-glass`
    //    primitive swaps in a MeshPhysicalNodeMaterial and sweeps a frost band
    //    across it; the materialSpec below is the standalone/T0 look so the
    //    pane still reads as tinted clearcoated glass before the primitive
    //    binds. The `float` binding gives this card its buoyant drift; each
    //    pane floats at its own speed/amplitude → independent depth motion.
    members.push({
      localId: c.localId,
      subtype: 'card',
      serviceTag: 'decor',
      caption: `Glass quote card ${i + 1}`,
      renderMode: 'mesh',
      pose: pose(c.x, c.y, c.z, c.rotationY, c.tilt),
      footprint: { width: CARD_W, height: CARD_H },
      meshPrimitive: {
        kind: 'cube',
        params: { width: CARD_W, height: CARD_H, depth: CARD_DEPTH },
      },
      materialSpec: {
        baseColor: c.tint,
        metalness: 0.0,
        roughness: 0.06,
        transmission: 0.92,
        ior: 1.5,
        dispersion: 0.04,
        thickness: 0.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.35,
        opacity: 1,
      },
      receivesLighting: true,
      animationBindings: [
        // INTEGRATED #1 — frost creeps across the pane (clear→frost→clear),
        // real transmissive glass (registry 'frosted-glass', glass category,
        // verified registered). Staggered speeds so the three panes frost out
        // of phase with one another.
        {
          id: `ab-${c.localId}-frost`,
          primitive: 'frosted-glass',
          driver: 'time',
          params: { speed: 0.55 + i * 0.18, frostiness: 0.82, grain: 0.35 },
          order: 0,
        },
        // INTEGRATED #2 — buoyant float (gentle bob + tilt; registry 'float',
        // transform category, verified registered). Per-card speed/amplitude
        // give the varied-depth drift.
        {
          id: `ab-${c.localId}-float`,
          primitive: 'float',
          driver: 'time',
          params: { speed: c.floatSpeed, amplitude: c.floatAmp, tiltDeg: 6 },
          order: 1,
        },
      ],
    });

    // ── The quote — REAL MSDF text (INV-11) pulled just in front of its pane,
    //    sharing the pane's depth + tilt so it floats with the glass. Modest
    //    fontSize so two short lines frame inside the slab. The text rides the
    //    same `float` rhythm as its card for cohesion.
    members.push({
      localId: `${c.localId}-quote`,
      subtype: 'text',
      serviceTag: 'decor',
      caption: `Quote ${i + 1}`,
      renderMode: 'text',
      pose: pose(c.x, c.y + 0.12, c.z + CARD_DEPTH * 0.5 + 0.03, c.rotationY, c.tilt),
      footprint: { width: CARD_W * 0.82, height: 0.62 },
      textSpec: {
        content: c.quote,
        fontFamily: 'Inter',
        fontWeight: 600,
        fontSize: 0.3,
        align: 'center',
        lineHeight: 1.1,
        letterSpacing: 0.01,
        fill: { kind: 'gradient', from: '#f1efe8', to: '#cfe0ea', angleDeg: 90 },
        decompose: 'glyph',
      },
      animationBindings: [
        {
          id: `ab-${c.localId}-quote-float`,
          primitive: 'float',
          driver: 'time',
          params: { speed: c.floatSpeed, amplitude: c.floatAmp, tiltDeg: 6 },
          order: 0,
        },
      ],
    });
  });

  // ── Brass grounding rail — a slim Observatory-brass bar beneath the panes so
  //    the floating glass reads against warm structure (warm/cool contrast).
  //    Polished brass PBR; sits low, gently floats with the slowest rhythm.
  members.push({
    localId: 'brass-rail',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Brass grounding rail',
    renderMode: 'mesh',
    pose: pose(0.05, -1.05, -0.05),
    footprint: { width: 4.0, height: 0.12 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.05, height: 3.7, segments: 48 },
    },
    materialSpec: {
      baseColor: '#c9a86a',
      metalness: 0.95,
      roughness: 0.3,
      clearcoat: 0.5,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.35,
    },
    receivesLighting: true,
    // Lay the cylinder on its side (long axis → X) to read as a horizontal rail.
    animationBindings: [
      {
        id: 'ab-brass-rail-float',
        primitive: 'float',
        driver: 'time',
        params: { speed: 0.45, amplitude: 0.06, tiltDeg: 1.5 },
        order: 0,
      },
    ],
  });

  return members;
}

// Lay the rail on its side: rotate the cylinder so its long axis points along X.
const members = buildMembers();
const rail = members.find((m) => m.localId === 'brass-rail');
if (rail) rail.pose.rotationZ = Math.PI / 2;

const testimonialFloatGlass: ElementClusterDefinition = {
  id: 'testimonial-float-glass',
  label: 'Floating Glass Quotes',
  category: 'testimonial',
  caption: 'Frosted-glass quote cards drifting at varied depths',
  description:
    'Three transmissive glass quote panes floating at independent depths, frost creeping across each.',
  members,
  preview: {
    // Three-quarter view from slightly above, framing all three depth planes +
    // the brass rail in a ~4:3 tile. Auto-fit distance left to the rig is fine;
    // a fixed distance keeps the depth fan legible.
    camera: { distance: 6.4, polar: Math.PI / 2.3, azimuth: Math.PI * 0.08 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Cool studio key with a soft env so the glass picks up clean specular edges
  // and the brass rail catches a warm rim. Additive recommendation only.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.3,
    ambientIntensity: 0.3,
    shadowSoftness: 0.6,
  },
  designRefs: [
    'PBR transmission glass',
    'frosted-glass roughness sweep',
    'varied-depth float parallax',
    'kinetic MSDF typography',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(testimonialFloatGlass);
export default testimonialFloatGlass;
