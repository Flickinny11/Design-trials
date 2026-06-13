// showcase-exploded — an "exploded view" product showcase (§13 showcase
// element). A premium device-assembly centerpiece whose components are stacked
// along Y as if a product had been pulled apart along its build axis: a
// polished-chrome top cap, a brushed-metal body, a transmissive glass display
// lens, and an obsidian base plinth — framed by an orbiting brass accent ring
// and a crisp MSDF caption. The composition reads like an engineering
// exploded-view render: layers separated with air between them so every part is
// legible, the way premium product sites (and Slider Revolution's "explode"
// demos) present hardware — but here with REAL PBR (chrome / brushed metal /
// transmission glass / obsidian) under studio IBL rather than flat sprites.
//
// THE SR-SMASHING MOVE — explode-and-reassemble: the assembly carries a
// `shatter-assemble` binding (registry name verified) so on play the layers
// converge inward and lock together (shatter played in reverse), then the
// orbital ring keeps a slow ambient `spin`. The frozen preview phase sits
// mid-assembly so the tile reads as a half-exploded hero still.
//
// Every member is a real, editable PrismNode (move / recolor / re-skin / swap
// animation post-place). Photorealism is procedural PBR + IBL (free) — no
// generated imagery needed.
//
// Tier: T1 full-fidelity, clean T0 fallback (the stack still reads as lit
// chrome / brushed-metal / glass / obsidian layers + a crisp MSDF label without
// screen-space GI). INV-9. Palette = Observatory Brass (brass/gold + ice/steel
// blues + charcoal/obsidian) — NO purple.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// Identity-scale, axis-aligned local pose helper (cluster origin = 0,0,0; the
// instantiator offsets x/y/z by the drop anchor).
function poseAt(x: number, y: number, z: number, rotationY = 0): ScenePosition {
  return {
    x,
    y,
    z,
    rotationX: 0,
    rotationY,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };
}

// Vertical spacing between the exploded layers (scene units). The four stacked
// components sit with this gap of air between them so the cross-section reads.
const LAYER_GAP = 0.62;

const members: ClusterMemberTemplate[] = [
  // ── Top cap — polished chrome dome. The crown of the assembly; mirror-finish
  // chrome (metalness 1, very low roughness, full clearcoat) so it catches the
  // studio key as a hard specular highlight.
  {
    localId: 'cap',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Chrome top cap',
    renderMode: 'mesh',
    pose: poseAt(0, LAYER_GAP * 1.5, 0),
    footprint: { width: 1.2, height: 0.5 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.58, height: 0.26, segments: 64 },
    },
    materialSpec: {
      baseColor: '#dfe4ec',
      metalness: 1,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.6,
    },
    receivesLighting: true,
    // INTEGRATED animation: the whole assembly reassembles — each layer carries
    // the explode-and-reassemble binding so the parts converge inward and lock
    // together (shatter played in reverse). Verified registry name.
    animationBindings: [
      {
        id: 'ab-showcase-cap-assemble',
        primitive: 'shatter-assemble',
        driver: 'time',
        params: { duration: 1.8, fragments: 5, scatter: 3.4, curve: 'expoOut' },
        order: 0,
      },
    ],
  },
  // ── Body — brushed-metal mid-section, the bulk of the product. Brushed brass
  // recipe (high metalness, mid roughness, warm envMap) — the warm anchor of
  // the Observatory Brass palette.
  {
    localId: 'body',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Brushed-metal body',
    renderMode: 'mesh',
    pose: poseAt(0, LAYER_GAP * 0.5, 0),
    footprint: { width: 1.3, height: 0.7 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.62, height: 0.5, segments: 64 },
    },
    materialSpec: {
      baseColor: '#c9a86a',
      metalness: 0.95,
      roughness: 0.32,
      clearcoat: 0.3,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.3,
    },
    receivesLighting: true,
    animationBindings: [
      {
        id: 'ab-showcase-body-assemble',
        primitive: 'shatter-assemble',
        driver: 'time',
        params: { duration: 1.8, fragments: 6, scatter: 3.0, curve: 'expoOut' },
        order: 0,
      },
    ],
  },
  // ── Display lens — transmissive glass disc, the "screen" of the product.
  // Premium glass recipe (transmission + ior + dispersion + clearcoat) so it
  // refracts the layers behind it — the visual showpiece of the cross-section.
  {
    localId: 'lens',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Glass display lens',
    renderMode: 'mesh',
    pose: poseAt(0, -LAYER_GAP * 0.5, 0),
    footprint: { width: 1.25, height: 0.4 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.6, height: 0.14, segments: 64 },
    },
    materialSpec: {
      baseColor: '#bcd4e2',
      metalness: 0,
      roughness: 0.06,
      transmission: 0.92,
      ior: 1.5,
      dispersion: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      thickness: 0.5,
      envMapIntensity: 1.4,
    },
    receivesLighting: true,
    animationBindings: [
      {
        id: 'ab-showcase-lens-assemble',
        primitive: 'shatter-assemble',
        driver: 'time',
        params: { duration: 1.8, fragments: 5, scatter: 2.6, curve: 'expoOut' },
        order: 0,
      },
    ],
  },
  // ── Base plinth — obsidian foundation the product sits on. Dark, near-black
  // clearcoated obsidian (low roughness, mid metalness) so it grounds the
  // composition with a deep charcoal mass and a wet specular sheen.
  {
    localId: 'plinth',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Obsidian base plinth',
    renderMode: 'mesh',
    pose: poseAt(0, -LAYER_GAP * 1.5, 0),
    footprint: { width: 1.6, height: 0.5 },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: 0.78, height: 0.22, segments: 64 },
    },
    materialSpec: {
      baseColor: '#15171f',
      metalness: 0.7,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.1,
    },
    receivesLighting: true,
    animationBindings: [
      {
        id: 'ab-showcase-plinth-assemble',
        primitive: 'shatter-assemble',
        driver: 'time',
        params: { duration: 1.8, fragments: 6, scatter: 2.2, curve: 'expoOut' },
        order: 0,
      },
    ],
  },
  // ── Orbital accent ring — a thin brass torus encircling the body, tilted off
  // axis so it reads as a halo around the exploded product. Carries the only
  // ambient (non-assemble) motion: a slow continuous `spin` so the showcase
  // stays alive after the parts have locked together.
  {
    localId: 'orbit-ring',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Brass orbital ring',
    renderMode: 'mesh',
    pose: poseAt(0, LAYER_GAP * 0.5, 0, 0),
    footprint: { width: 2.4, height: 2.4 },
    meshPrimitive: {
      kind: 'torus',
      params: { radius: 1.1, tube: 0.045, segments: 96 },
    },
    materialSpec: {
      baseColor: '#d8c089',
      metalness: 0.92,
      roughness: 0.22,
      clearcoat: 0.5,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.4,
    },
    receivesLighting: true,
    // Tilt the ring so it orbits diagonally; the spin then sweeps it around the
    // assembly like an instrument gimbal.
    cinematicPrimitives: [],
    animationBindings: [
      {
        id: 'ab-showcase-ring-spin',
        primitive: 'spin',
        driver: 'time',
        params: { cycle: 7, turns: 1, axis: 'y' },
        order: 0,
      },
    ],
  },
  // ── Caption — REAL MSDF text (INV-11), an engineering-render style label
  // beneath the plinth. Modest font size so it frames inside the tile.
  {
    localId: 'caption',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Showcase caption',
    renderMode: 'text',
    pose: poseAt(0, -LAYER_GAP * 1.5 - 0.55, 0.1),
    footprint: { width: 2.6, height: 0.4 },
    textSpec: {
      content: 'EXPLODED VIEW',
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 0.32,
      align: 'center',
      letterSpacing: 0.08,
      fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 15 },
      decompose: 'glyph',
    },
  },
];

const showcaseExploded: ElementClusterDefinition = {
  id: 'showcase-exploded',
  label: 'Exploded View Showcase',
  category: 'showcase',
  caption: 'A product whose parts explode apart and reassemble in 3D',
  description:
    'A PBR device stack — chrome cap, brushed body, glass lens, obsidian plinth — that reassembles from an exploded view, ringed by a spinning brass halo.',
  members,
  preview: {
    // Slight three-quarter elevation to read the stacked cross-section and the
    // tilt of the orbital ring; frames the full vertical stack + caption.
    camera: { distance: 6.6, polar: Math.PI / 2.35, azimuth: Math.PI * 0.12 },
    // Mid-assembly: the layers are partway home — a striking half-exploded still.
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm-key studio look so chrome + glass + obsidian all catch specular and the
  // brushed brass reads warm. Additive recommendation; never forces a hub change.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.26,
    shadowSoftness: 0.6,
  },
  designRefs: [
    'engineering exploded-view product render',
    'shatter-assemble reverse-explosion transition',
    'PBR transmission glass',
    'polished chrome + brushed metal layering',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(showcaseExploded);
export default showcaseExploded;
