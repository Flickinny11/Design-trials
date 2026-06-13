// marquee-ribbon-flow — a flowing 3D ribbon of words snaking across the scene
// (§13 prebuilt-library element, category `marquee`). This SMASHES the flat,
// CSS-translate marquee strip Slider Revolution ships: instead of a 2-D loop of
// text scrolling left, this is a luminous silk RIBBON of light advected on an
// invisible curl-noise current, with real MSDF words riding the current and
// undulating in 3D like flags on a flowing banner, all flanked by two slim
// brushed-metal rails that trace the ribbon's path and catch studio IBL.
//
// COMPOSITION (cluster-local space, origin 0,0,0 — the instantiator offsets by
// the drop anchor):
//   • ribbon       — a `flow-ribbon` particle stream (subject 'empty'); the
//                     glowing brass→bone current the words ride. The SR-smashing
//                     move: a single coherent advected line that folds + relaxes,
//                     not a flock or a flat strip.
//   • word-craft / word-flow / word-motion — three REAL MSDF text members
//                     (renderMode:'text', INV-11 — never diffusion) spaced along
//                     the snaking path, each rotated + depth-staggered so they
//                     read as words THREADED onto the ribbon. Each undulates with
//                     `text-wave-3d` so the words ripple in 3D as the current
//                     flows past — kinetic typography on a moving banner.
//   • rail-top / rail-bottom — two slim brushed-metal capsule rails arcing along
//                     the ribbon above + below the words; premium PBR (brushed
//                     metal recipe) so the marquee reads as a physical 3D object
//                     with real reflections, not a flat overlay.
//
// INTEGRATED animation (real registry primitives, both verified registered):
//   • ribbon → `flow-ribbon`  (particles, driver:'time') — the snaking current.
//   • each word → `text-wave-3d` (text, driver:'time') — per-glyph 3D undulation.
//
// Photorealism is procedural PBR + IBL (free) + emissive MSDF glyphs — no
// generated hero imagery needed. Palette is Observatory Brass: brass/gold + ice/steel + a
// charcoal rail core (NEVER purple). Card/text colors are graph data, not chrome.
//
// Tier: T1 full-fidelity, clean T0 fallback — at T0 the rails still read as lit
// metal, the words as crisp MSDF, and the ribbon as a soft luminous band even
// without screen-space GI. The ribbon is the only T2-flavored flourish and it
// degrades to a plain additive glow, never broken (INV-9).

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// ── Geometry layout ──────────────────────────────────────────────────────────
// The words + rails sit on a gentle horizontal arc that snakes through depth, so
// the marquee reads as a ribbon curving past the camera rather than a flat row.
// X spread is wide (a banner), Z dips so the centre word sits nearest.
const WORD_X = 1.45; // half-spread of the three words across the ribbon
const WORD_FONT = 0.34; // modest em height — frames inside the marquee band

/** A full ScenePosition (all 9 fields) with sane scale/rotation defaults. */
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

// Three words spaced along the snaking path. Each is depth-staggered + yaw-turned
// so it faces the curving current, and tilted slightly so the trio reads as text
// threaded onto one ribbon, not three labels in a row.
const WORDS: { localId: string; content: string; x: number; y: number; z: number; ry: number; rz: number; fill: { from: string; to: string }; phase: number }[] = [
  {
    localId: 'word-craft',
    content: 'CRAFT',
    x: -WORD_X,
    y: 0.34,
    z: -0.35,
    ry: 0.34,
    rz: 0.05,
    fill: { from: '#e8d6a6', to: '#c9a86a' }, // warm brass
    phase: 0,
  },
  {
    localId: 'word-flow',
    content: 'FLOW',
    x: 0,
    y: -0.04,
    z: 0.28,
    ry: 0,
    rz: -0.03,
    fill: { from: '#f2e7c6', to: '#9fc3d6' }, // brass → ice (the bridge)
    phase: 0.5,
  },
  {
    localId: 'word-motion',
    content: 'MOTION',
    x: WORD_X,
    y: 0.3,
    z: -0.4,
    ry: -0.34,
    rz: -0.05,
    fill: { from: '#bcd4e2', to: '#7f9cb0' }, // cool ice steel
    phase: 1.0,
  },
];

function buildWords(): ClusterMemberTemplate[] {
  return WORDS.map((w, i) => ({
    localId: w.localId,
    subtype: 'text',
    serviceTag: 'decor',
    caption: `Marquee word "${w.content}"`,
    renderMode: 'text' as const,
    pose: pose(w.x, w.y, w.z, w.ry, w.rz),
    footprint: { width: 1.5, height: 0.5 },
    textSpec: {
      content: w.content,
      fontFamily: 'Inter',
      fontWeight: 800,
      fontSize: WORD_FONT,
      align: 'center' as const,
      letterSpacing: 0.06,
      fill: { kind: 'gradient' as const, from: w.fill.from, to: w.fill.to, angleDeg: 12 },
      // A soft brass glow so the words read as lit + riding a luminous current.
      glow: { color: '#e8d6a6', intensity: 0.35 },
      decompose: 'glyph' as const,
    },
    // INTEGRATED animation: per-glyph 3D undulation, staggered per word (phaseStep
    // offset via per-word speed jitter) so the trio ripples like a flowing banner.
    animationBindings: [
      {
        id: `ab-marquee-ribbon-${w.localId}-wave`,
        primitive: 'text-wave-3d',
        driver: 'time' as const,
        params: {
          speed: 2.4 + i * 0.25, // slight per-word desync → a travelling ripple
          amplitude: 0.16,
          tilt: 0.28,
          phaseStep: 0.7,
        },
        order: 0,
      },
    ],
  }));
}

// Two slim brushed-metal rails arcing above + below the words, tracing the
// ribbon's path. Capsules give a soft pill cross-section that catches a long
// specular streak — the "physical banner spine" that anchors the words in 3D.
const RAIL_LEN = 3.4;
function buildRails(): ClusterMemberTemplate[] {
  const railMat = {
    // Brushed-metal premium PBR recipe (brass).
    baseColor: '#c9a86a',
    metalness: 0.95,
    roughness: 0.32,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1.3,
  };
  return [
    {
      localId: 'rail-top',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Ribbon rail (top)',
      renderMode: 'mesh' as const,
      // Laid horizontally (capsule long axis is Y → rotate onto Z/X), arcing back.
      pose: pose(0, 0.62, -0.18, 0, Math.PI / 2),
      footprint: { width: RAIL_LEN, height: 0.16 },
      meshPrimitive: {
        kind: 'capsule' as const,
        params: { radius: 0.045, length: RAIL_LEN, segments: 24 },
      },
      materialSpec: railMat,
      receivesLighting: true,
    },
    {
      localId: 'rail-bottom',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Ribbon rail (bottom)',
      renderMode: 'mesh' as const,
      pose: pose(0, -0.46, -0.18, 0, Math.PI / 2),
      footprint: { width: RAIL_LEN, height: 0.16 },
      meshPrimitive: {
        kind: 'capsule' as const,
        params: { radius: 0.045, length: RAIL_LEN, segments: 24 },
      },
      // Cool ice-steel for the lower rail (the palette's second metal).
      materialSpec: {
        baseColor: '#9fc3d6',
        metalness: 0.9,
        roughness: 0.28,
        clearcoat: 0.5,
        clearcoatRoughness: 0.22,
        envMapIntensity: 1.25,
      },
      receivesLighting: true,
    },
  ];
}

// The luminous current the words ride — a `flow-ribbon` particle stream
// (subject:'empty'; the geometry IS the animation, so it carries no
// meshPrimitive). Sits centred, threading between the two rails.
const ribbon: ClusterMemberTemplate = {
  localId: 'ribbon',
  subtype: 'element',
  serviceTag: 'decor',
  caption: 'Flowing light ribbon',
  renderMode: 'mesh',
  pose: pose(0, 0.05, -0.05),
  footprint: { width: 3.2, height: 1.6 },
  // INTEGRATED animation: the snaking silk current (brass head → bone tail).
  animationBindings: [
    {
      id: 'ab-marquee-ribbon-flow',
      primitive: 'flow-ribbon',
      driver: 'time',
      params: {
        speed: 0.5,
        width: 0.34,
        turbulence: 0.55,
        density: 170,
        size: 0.06,
        headColor: '#ffcf8c', // brass
        tailColor: '#eef0ea', // bone
      },
      order: 0,
    },
  ],
};

const marqueeRibbonFlow: ElementClusterDefinition = {
  id: 'marquee-ribbon-flow',
  label: 'Ribbon Flow Marquee',
  category: 'marquee',
  caption: 'A flowing 3D ribbon of words snaking across the scene',
  description:
    'MSDF words ride a luminous silk current between brushed-metal rails — a kinetic 3D marquee, not a flat strip.',
  members: [ribbon, ...buildWords(), ...buildRails()],
  preview: {
    // Frame the full ~3.4-wide banner three-quarter, slightly above, so the
    // snaking depth + the rail reflections both read in a ~4:3 tile.
    camera: { distance: 5.6, polar: Math.PI / 2.3, azimuth: Math.PI * 0.08 },
    frozenPhase: 0.4,
    loopSeconds: 7,
    tier: 'T1',
  },
  // Warm studio key so the brass rails glint + the ribbon's glow reads against a
  // soft env (additive recommendation; never forces a hub-wide change).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.25,
    ambientIntensity: 0.3,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'curl-noise flow-field ribbon',
    'kinetic typography on a 3D banner',
    'brushed-metal PBR + studio IBL',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(marqueeRibbonFlow);
export default marqueeRibbonFlow;
