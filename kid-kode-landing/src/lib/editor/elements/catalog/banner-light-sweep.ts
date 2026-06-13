// banner-light-sweep — a premium brushed-metal banner plate with a sweeping
// specular highlight and an MSDF headline (§13 prebuilt-library element,
// category `banner`). The SR-smashing move: a single crisp specular band
// glances diagonally across a real brushed-metal plate (light-sweep), with a
// secondary raking sheen raking along a polished brass rail (metallic-sheen) —
// the kind of "light catching machined metal" moment Slider Revolution fakes
// with a CSS gradient, here rendered with real PBR + IBL.
//
// Composition (cluster-local, origin 0,0,0): a charcoal backdrop panel for
// depth + reflection structure, a wide thin brushed-metal PLATE as the
// centerpiece, a slim polished-brass accent RAIL beneath it, two polished
// end-cap STUDS that bracket the plate, and a modest MSDF headline that frames
// inside the plate. Every member is a real, editable PrismNode.
//
// INTEGRATED animation:
//   • plate — `light-sweep` (shimmer; registry-verified): one bright specular
//     band sweeps diagonally across the brushed surface, looping forever. This
//     is the headline move.
//   • rail  — `metallic-sheen` (shimmer; registry-verified): a narrow raking
//     band rakes along the brass rail, a half-beat offset feel from the plate.
//
// Both primitives swap the host MESH's material at runtime (subject must be a
// Mesh), so they are bound only to the geometric plate + rail members — never
// to the text or the unlit backdrop.
//
// Photorealism is procedural PBR + studio IBL (free) — no hero imagery needed.
//
// Tier: T1 full-fidelity; clean T0 fallback — the plate still reads as a lit
// brushed-metal slab with a crisp MSDF headline even without screen-space GI.
// The sweep/sheen are emissive-band shaders that degrade to a static gloss, so
// the banner is never broken at T0 (INV-9).

import { registerElement } from '../registry';
import type { ElementClusterDefinition } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// Identity pose helper — keeps every member's local pose readable + complete
// (all 9 ScenePosition fields), then overrides only the axes that matter.
const pose = (p: Partial<ScenePosition>): ScenePosition => ({
  x: 0,
  y: 0,
  z: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  ...p,
});

// Plate geometry (scene units): a wide, shallow banner slab.
const PLATE_W = 4.0;
const PLATE_H = 1.2;
const PLATE_DEPTH = 0.12;

const bannerLightSweep: ElementClusterDefinition = {
  id: 'banner-light-sweep',
  label: 'Light Sweep Banner',
  category: 'banner',
  caption: 'A brushed-metal plate with a sweeping specular highlight',
  description:
    'A premium brushed-metal banner — a crisp light band sweeps the plate while a brass rail rakes beneath.',
  members: [
    // ── Backdrop — a charcoal pewter panel behind the banner so the plate has
    // structure to reflect and the composition reads with depth. Unlit-by-
    // default plane opted into lighting for a soft gradient catch.
    {
      localId: 'backdrop',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Banner backdrop',
      renderMode: 'mesh',
      pose: pose({ y: 0, z: -0.6 }),
      footprint: { width: 5.2, height: 2.2 },
      meshPrimitive: {
        kind: 'plane',
        params: { width: 5.2, height: 2.2 },
      },
      materialSpec: {
        baseColor: '#1b2029',
        metalness: 0.3,
        roughness: 0.6,
        clearcoat: 0.15,
        envMapIntensity: 0.7,
      },
      receivesLighting: true,
    },
    // ── Plate — the brushed-metal centerpiece. Premium brushed-metal PBR
    // (high metalness, mid-low roughness, lifted env reflection). Carries the
    // headline `light-sweep` band.
    {
      localId: 'plate',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Brushed-metal plate',
      renderMode: 'mesh',
      pose: pose({ y: 0.18, z: 0 }),
      footprint: { width: PLATE_W, height: PLATE_H },
      meshPrimitive: {
        kind: 'cube',
        params: { width: PLATE_W, height: PLATE_H, depth: PLATE_DEPTH },
      },
      materialSpec: {
        baseColor: '#b9c2d2',
        metalness: 0.95,
        roughness: 0.32,
        clearcoat: 0.5,
        clearcoatRoughness: 0.18,
        envMapIntensity: 1.3,
      },
      receivesLighting: true,
      // INTEGRATED animation: a single crisp specular band sweeps diagonally
      // across the brushed surface, looping. Registry primitive 'light-sweep'
      // (shimmer category, verified registered). Tint pushed warm-ice so the
      // streak reads as light, not a colored overlay.
      animationBindings: [
        {
          id: 'ab-banner-plate-sweep',
          primitive: 'light-sweep',
          driver: 'time',
          params: { speed: 0.9, width: 0.12, angleDeg: 32, intensity: 1.7, tint: '#eaf1ff' },
          order: 0,
        },
      ],
    },
    // ── Rail — a slim polished-brass accent bar beneath the plate. Carries a
    // secondary `metallic-sheen` raking band so the two metals catch light at
    // different rhythms. Polished-brass PBR (near-chrome metalness, very low
    // roughness, clearcoat).
    {
      localId: 'rail',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Brass accent rail',
      renderMode: 'mesh',
      pose: pose({ y: -0.62, z: 0.02, rotationZ: Math.PI / 2 }),
      footprint: { width: 3.6, height: 0.12 },
      meshPrimitive: {
        // A thin cylinder laid horizontal (rotated 90° about Z) reads as a
        // machined rail with rounded ends.
        kind: 'cylinder',
        params: { radius: 0.055, height: 3.6, segments: 48 },
      },
      materialSpec: {
        baseColor: '#c9a86a',
        metalness: 1.0,
        roughness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.5,
      },
      receivesLighting: true,
      animationBindings: [
        {
          id: 'ab-banner-rail-sheen',
          primitive: 'metallic-sheen',
          driver: 'time',
          params: { speed: 1.1, width: 0.1, brightness: 1.5, tint: '#ffe9c2' },
          order: 0,
        },
      ],
    },
    // ── Stud (left) — a polished end-cap that brackets the plate. Polished
    // chrome/brass detail; no band binding (a quiet specular accent).
    {
      localId: 'stud-left',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'End cap (left)',
      renderMode: 'mesh',
      pose: pose({ x: -2.1, y: 0.18, z: 0.06 }),
      footprint: { width: 0.36, height: 0.36 },
      meshPrimitive: {
        kind: 'sphere',
        params: { radius: 0.18, segments: 48 },
      },
      materialSpec: {
        baseColor: '#d8c089',
        metalness: 1.0,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.6,
      },
      receivesLighting: true,
    },
    // ── Stud (right) — the mirrored end-cap.
    {
      localId: 'stud-right',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'End cap (right)',
      renderMode: 'mesh',
      pose: pose({ x: 2.1, y: 0.18, z: 0.06 }),
      footprint: { width: 0.36, height: 0.36 },
      meshPrimitive: {
        kind: 'sphere',
        params: { radius: 0.18, segments: 48 },
      },
      materialSpec: {
        baseColor: '#d8c089',
        metalness: 1.0,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.6,
      },
      receivesLighting: true,
    },
    // ── Headline — REAL MSDF text (INV-11), modest size so it frames inside the
    // plate. A warm brass→ice gradient fill ties it to the metals.
    {
      localId: 'headline',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Banner headline',
      renderMode: 'text',
      pose: pose({ y: 0.2, z: 0.12 }),
      footprint: { width: 3.4, height: 0.4 },
      textSpec: {
        content: 'PRECISION CRAFTED',
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 0.34,
        align: 'center',
        letterSpacing: 0.06,
        fill: { kind: 'gradient', from: '#f0e3bd', to: '#aecadb', angleDeg: 12 },
        decompose: 'glyph',
      },
    },
  ],
  preview: {
    // Frame the full plate + rail + studs head-on, a touch above, slight
    // three-quarter so the sweep + reflections read in a ~4:3 tile.
    camera: { distance: 6.4, polar: Math.PI / 2.2, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm-key studio look at place time (additive; never forces a hub-wide
  // change unless the placement opts in). Lifted env so the brushed + polished
  // metals catch the IBL.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.26,
    shadowSoftness: 0.5,
  },
  designRefs: [
    'sweeping specular light-band (light-sweep)',
    'brushed-metal PBR plate',
    'polished-brass metallic sheen rake',
    'kinetic MSDF headline framing',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(bannerLightSweep);
export default bannerLightSweep;
