// cta-magnetic-pedestal — a glowing call-to-action button standing on a lit
// pedestal. The SR-smashing move: the button is CURSOR-REACTIVE 3D hardware. It
// magnetically pulls toward the pointer (a spring reach), CHARGES when the
// cursor lingers close (compresses + trembles + edges heat to brass, then
// springs tall with a crack of light on break-away), and its neon edge tube
// pulses forever like a sign. Slider Revolution's flat CSS buttons can't touch a
// physically-lit brass button on a polished-chrome plinth that reacts to the
// cursor with real spring physics + a TSL neon band.
//
// COMPOSITION (cluster-local, origin 0,0,0): a wide brushed-metal pedestal base,
// a polished-chrome riser column, the brass button puck on top wearing the
// integrated interactions, an obsidian/emissive halo ring framing the button,
// the MSDF call-to-action label floating on the button face (INV-11 — real
// glyphs, never diffusion), and a soft lit floor plane so the whole thing reads
// photoreal standing alone.
//
// INTEGRATED animation (all bindings are REAL Animatable registry names,
// grep-verified in src/lib/prism/animatable/primitives/):
//   • button-body — `magnetic` (pointer): the puck springs toward the cursor.
//   • button-body — `charge-release` (pointer): proximity charges it; break-away
//     releases an overshoot spring + light ring.
//   • button-body — `neon-edge-pulse` (time): an ice-cyan neon tube traces the
//     puck's border and breathes — the ambient idle glow.
//
// Photorealism is procedural PBR + IBL (free): brushed metal, polished chrome,
// brass, obsidian. No fal imagery needed.
//
// Tier: T2 full-fidelity (neon-edge-pulse emissive band + chrome reflections
// bloom richest with screen-space GI). Reads CLEAN at T0 — degraded, it is still
// a lit brass button on a chrome plinth with a crisp MSDF label and a pulsing
// edge band; never broken. INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// Identity pose helper — full 9-field ScenePosition with overrides applied.
function poseAt(over: Partial<ScenePosition>): ScenePosition {
  return {
    x: 0,
    y: 0,
    z: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    ...over,
  };
}

const members: ClusterMemberTemplate[] = [
  // ── Floor — a broad, softly-lit charcoal plane the pedestal sits on, laid
  // flat (rotated -90° about X). Opted into lighting so it catches a subtle
  // pool of light + the chrome/brass reflections, giving the cluster ground.
  {
    localId: 'floor',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Stage floor',
    renderMode: 'mesh',
    pose: poseAt({ y: -1.1, rotationX: -Math.PI / 2 }),
    footprint: { width: 6, height: 6 },
    meshPrimitive: { kind: 'plane', params: { width: 6, height: 6 } },
    materialSpec: {
      baseColor: '#1b1e26', // charcoal
      metalness: 0.4,
      roughness: 0.5,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.9,
    },
    receivesLighting: true,
  },

  // ── Pedestal base — a wide, low brushed-metal disc. The grounded plinth.
  {
    localId: 'pedestal-base',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Pedestal base',
    renderMode: 'mesh',
    pose: poseAt({ y: -0.9 }),
    footprint: { width: 2.4, height: 2.4 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 1.15, height: 0.32, segments: 64 },
    },
    materialSpec: {
      baseColor: '#aebfcb', // pewter / brushed metal
      metalness: 0.95,
      roughness: 0.32,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
      envMapIntensity: 1.3,
    },
    receivesLighting: true,
  },

  // ── Pedestal column — a polished-chrome riser lifting the button into focus.
  {
    localId: 'pedestal-column',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Pedestal column',
    renderMode: 'mesh',
    pose: poseAt({ y: -0.4 }),
    footprint: { width: 1.4, height: 1 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.62, height: 0.7, segments: 64 },
    },
    materialSpec: {
      baseColor: '#dfe6ec', // near-white polished chrome
      metalness: 1.0,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.6,
    },
    receivesLighting: true,
  },

  // ── Halo ring — an obsidian torus framing the button, faintly emissive in
  // ice-cyan so it reads as a glowing seat for the CTA puck.
  {
    localId: 'halo-ring',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Glow halo',
    renderMode: 'mesh',
    pose: poseAt({ y: 0.02, rotationX: -Math.PI / 2 }),
    footprint: { width: 1.5, height: 1.5 },
    meshPrimitive: {
      kind: 'torus',
      params: { radius: 0.66, tube: 0.05, segments: 96 },
    },
    materialSpec: {
      baseColor: '#15171f', // obsidian
      metalness: 0.7,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      emissive: '#5fd4e6', // ice-cyan glow
      emissiveIntensity: 1.4,
      envMapIntensity: 1.2,
    },
    receivesLighting: true,
  },

  // ── Button body — the brass CTA puck. The interactive centerpiece: it pulls
  // toward the cursor (magnetic), charges + releases on proximity, and its neon
  // border tube pulses forever. A low brass cylinder on top of the column.
  {
    localId: 'button-body',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'CTA button',
    renderMode: 'mesh',
    pose: poseAt({ y: 0.16 }),
    footprint: { width: 1.25, height: 1.25 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.6, height: 0.22, segments: 64 },
    },
    materialSpec: {
      baseColor: '#c9a86a', // brass / gold
      metalness: 0.95,
      roughness: 0.28,
      clearcoat: 0.8,
      clearcoatRoughness: 0.16,
      emissive: '#3a2f15', // warm brass under-glow
      emissiveIntensity: 0.35,
      envMapIntensity: 1.4,
    },
    receivesLighting: true,
    // INTEGRATED animation — three stacked bindings make this read as live
    // cursor-reactive hardware out of the box (all swappable via the Picker).
    animationBindings: [
      {
        // Pointer pull: the puck springs toward the live cursor.
        id: 'ab-cta-magnetic',
        primitive: 'magnetic',
        driver: 'pointer',
        params: { maxOffset: 0.32, strength: 0.18 },
        order: 0,
      },
      {
        // Proximity charge → break-away release (compress + tremble + crack).
        id: 'ab-cta-charge',
        primitive: 'charge-release',
        driver: 'pointer',
        params: { chargeRate: 2.0, compressionDepth: 0.18, tremble: 0.4, overshoot: 0.34 },
        order: 1,
      },
      {
        // Ambient neon edge tube, breathing in ice-cyan — the idle glow.
        id: 'ab-cta-neon',
        primitive: 'neon-edge-pulse',
        driver: 'time',
        params: { speed: 2.4, thickness: 0.1, baseGlow: 0.7, pulseGlow: 1.8, color: '#5fd4e6' },
        order: 2,
      },
    ],
  },

  // ── Label — REAL MSDF text (INV-11) on the button face, modest size so it
  // frames cleanly inside the puck. Brass→ice gradient fill.
  {
    localId: 'cta-label',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'CTA label',
    renderMode: 'text',
    pose: poseAt({ y: 0.29, z: 0.001, rotationX: -Math.PI / 2 }),
    footprint: { width: 0.95, height: 0.3 },
    textSpec: {
      content: 'GET STARTED',
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 0.16,
      align: 'center',
      letterSpacing: 0.03,
      fill: { kind: 'gradient', from: '#f0dca8', to: '#bfe2ec', angleDeg: 18 },
      decompose: 'glyph',
    },
    receivesLighting: false,
  },
];

const ctaMagneticPedestal: ElementClusterDefinition = {
  id: 'cta-magnetic-pedestal',
  label: 'Magnetic CTA Pedestal',
  category: 'cta',
  caption: 'A glowing CTA button on a lit pedestal that pulls the cursor + charges on press',
  description: 'A brass CTA puck on a chrome plinth — magnetic, charges + releases, neon edge pulse.',
  members,
  preview: {
    // Three-quarter view from slightly above, framing the full pedestal + label
    // inside a ~4:3 tile.
    camera: { distance: 5.0, polar: Math.PI / 2.55, azimuth: Math.PI * 0.12 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T2',
  },
  // Warm-key studio look so the brass + chrome + neon all sing; never forces a
  // hub-wide change unless the placement opts in.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.26,
    shadowSoftness: 0.6,
  },
  designRefs: [
    'magnetic cursor physics',
    'press-and-release charge spring',
    'neon edge-glow tube (TSL emissive band)',
    'PBR brushed-metal + polished-chrome pedestal',
  ],
  tier: 'T2',
  featured: true,
};

registerElement(ctaMagneticPedestal);
export default ctaMagneticPedestal;
