// cardstack-swipe-deck — a PHYSICS swipe deck you fling away (§13 card-stack
// element). A fanned stack of premium PBR cards sits on a brushed-brass tray;
// the TOP card is a live, grabbable Tinder-style toss target. Grab it with the
// cursor, whip it, and let go — it sails on real ballistics, rebounds off the
// frame walls, tumbles, and glides home (registry 'throw-physics', pointer /
// hard, verified registered). The deck beneath BREATHES on a slow idle `float`
// (registry 'float', transform / easy, verified registered) so the stack reads
// alive even before you touch it.
//
// This is the SR-smashing move: Slider Revolution fakes a "card swipe" with CSS
// transforms on flat divs. This deck is real 3D geometry wearing physical PBR
// (obsidian, brushed metal, ice glass, brass) under studio IBL, flung by a real
// CPU ballistics integrator with gravity, air drag, restitution, and a spin
// kick — a senior 3D designer reads it as a genuine physical object, not a
// transformed rectangle.
//
// Every member is a real, editable PrismNode (move / scale / recolor / re-skin /
// swap the animation post-place). The three opaque card faces wear premium
// glossy photo-prints (portrait/editorial/product sample imagery) under studio
// IBL; the ice-glass card stays transmissive and the brass tray stays metal.
//
// Tier: T1 full-fidelity, clean T0 fallback — the cards still read as lit,
// stacked, premium panels (obsidian / brass / glass / steel) without
// screen-space GI; the throw + float still run on CPU at T0. INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition, MaterialSpec } from '@/lib/prism-graph/types';

// ── Card footprint (scene units) — a tall, thin swipe card. ──────────────────
const CARD_W = 1.15;
const CARD_H = 1.55;
const CARD_DEPTH = 0.06;

// ── The fanned deck (drawn bottom → top). The top card is the throw target;
// the cards beneath fan back with a small rise + lateral nudge + Z stagger so
// the stack reads as a real deck with depth, not coplanar quads. Premium PBR
// across the Observatory-Brass palette (obsidian / brushed metal / ice glass /
// brass) — NEVER purple. ────────────────────────────────────────────────────
interface DeckCardSpec {
  localId: string;
  caption: string;
  /** Local pose relative to the cluster origin. */
  pose: ScenePosition;
  material: MaterialSpec;
}

// Helper: a full ScenePosition with sensible scale defaults.
function pose(
  x: number,
  y: number,
  z: number,
  rotationZ: number,
  rotationY = 0,
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

const DECK: DeckCardSpec[] = [
  // ── Card 4 (deepest in the fan) — obsidian, the dark anchor of the stack.
  {
    localId: 'card-back',
    caption: 'Swipe card (back)',
    pose: pose(-0.16, -0.06, -0.18, 0.14),
    material: {
      // premium glossy photo-print: editorial silk on the deep card face
      baseColor: '#ffffff',
      baseColorMapUrl: '/prism-mock/library-content/editorial-silk.png',
      metalness: 0.0,
      roughness: 0.42,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.0,
    },
  },
  // ── Card 3 — pewter brushed metal (cool counterweight to the brass).
  {
    localId: 'card-mid-2',
    caption: 'Swipe card (mid)',
    pose: pose(0.1, -0.02, -0.12, -0.09),
    material: {
      // premium glossy photo-print: studio product shot on the mid card face
      baseColor: '#ffffff',
      baseColorMapUrl: '/prism-mock/library-content/product-scent.png',
      metalness: 0.0,
      roughness: 0.42,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.0,
    },
  },
  // ── Card 2 — ice / steel-blue glass, lightly transmissive for depth.
  {
    localId: 'card-mid-1',
    caption: 'Swipe card (front-mid)',
    pose: pose(-0.05, 0.02, -0.06, 0.05),
    material: {
      // glass recipe (steel-blue tint)
      baseColor: '#9fc3d6',
      metalness: 0.0,
      roughness: 0.06,
      transmission: 0.9,
      ior: 1.5,
      dispersion: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      thickness: 0.5,
      envMapIntensity: 1.5,
    },
  },
  // ── Card 1 (TOP) — polished brass: the hero swipe card you fling. This is
  // the live throw target, so it sits front-and-square at the fan apex.
  {
    localId: 'card-top',
    caption: 'Swipe card (top — flingable)',
    pose: pose(0.0, 0.06, 0.0, 0.0),
    material: {
      // premium glossy photo-print: editorial portrait on the hero swipe face
      baseColor: '#ffffff',
      baseColorMapUrl: '/prism-mock/library-content/portrait-a.png',
      metalness: 0.0,
      roughness: 0.42,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.0,
    },
  },
];

function buildMembers(): ClusterMemberTemplate[] {
  const members: ClusterMemberTemplate[] = DECK.map((c) => ({
    localId: c.localId,
    subtype: 'card',
    serviceTag: 'decor',
    caption: c.caption,
    renderMode: 'mesh' as const,
    pose: c.pose,
    footprint: { width: CARD_W, height: CARD_H },
    meshPrimitive: {
      kind: 'cube' as const,
      params: { width: CARD_W, height: CARD_H, depth: CARD_DEPTH },
    },
    materialSpec: c.material,
    receivesLighting: true,
    // INTEGRATED idle animation: a slow buoyant float so the WHOLE deck
    // breathes when the cursor is away. The top card additionally carries the
    // throw interaction (added below) — float covers the ambient/frozen-tile
    // state, throw-physics covers the engaged gesture.
    animationBindings: [
      {
        id: `ab-swipe-${c.localId}-float`,
        primitive: 'float',
        driver: 'time' as const,
        params: { speed: 0.7, amplitude: 0.05, tiltDeg: 2.5 },
        order: 0,
      },
    ],
  }));

  // ── The TOP card is the flingable hero — give it the real throw-physics
  // interaction (grab, whip, ballistic toss, wall rebounds, glide home). Its
  // ambient float stays as order:0; the throw layers on top as order:1 so the
  // engaged gesture overrides the idle bob. ──
  const top = members[members.length - 1];
  top.animationBindings = [
    ...(top.animationBindings ?? []),
    {
      id: 'ab-swipe-card-top-throw',
      primitive: 'throw-physics',
      driver: 'pointer',
      params: { power: 1.35, gravity: 2.2, bounciness: 0.62, drag: 0.8 },
      order: 1,
    },
  ];

  // ── A brushed-brass tray the deck rests on — gives the stack a ground plane
  // to cast onto and reflect, so the fling reads as a card leaving a real
  // surface. Lit, low and wide, set behind/below the deck. ──
  const tray: ClusterMemberTemplate = {
    localId: 'tray',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Deck tray',
    renderMode: 'mesh',
    pose: pose(0, -0.92, -0.1, 0, 0),
    footprint: { width: 2.4, height: 1.8 },
    meshPrimitive: {
      kind: 'cube',
      params: { width: 2.4, height: 0.12, depth: 1.8 },
    },
    materialSpec: {
      // brushed metal, warm brass tint
      baseColor: '#8a734a',
      metalness: 0.95,
      roughness: 0.34,
      clearcoat: 0.4,
      clearcoatRoughness: 0.24,
      envMapIntensity: 1.2,
    },
    receivesLighting: true,
  };

  // ── A modest MSDF caption above the deck (real glyphs — INV-11, never
  // diffusion). Kept small relative to the cards so it frames cleanly. ──
  const label: ClusterMemberTemplate = {
    localId: 'label',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Deck label',
    renderMode: 'text',
    pose: pose(0, 1.25, 0.1, 0, 0),
    footprint: { width: 2.0, height: 0.4 },
    textSpec: {
      content: 'SWIPE',
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 0.34,
      align: 'center',
      letterSpacing: 0.06,
      fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
      decompose: 'glyph',
    },
    receivesLighting: false,
  };

  // Tray first (drawn behind/under), then the fanned deck, then the label.
  return [tray, ...members, label];
}

const cardstackSwipeDeck: ElementClusterDefinition = {
  id: 'cardstack-swipe-deck',
  label: 'Swipe Deck',
  category: 'card-stack',
  caption: 'A physics deck of cards you fling away in real 3D',
  description: 'A fanned PBR card stack on a brass tray — grab the top card and throw it.',
  members: buildMembers(),
  preview: {
    // Frame the whole fanned stack + tray + label from a three-quarter front
    // angle, slightly above, so the depth of the fan reads.
    camera: { distance: 5.6, polar: Math.PI / 2.35, azimuth: Math.PI * 0.08 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm-key studio look at place time (additive recommendation; never forces a
  // hub-wide change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.26,
    shadowSoftness: 0.5,
  },
  designRefs: [
    'throw / fling cursor physics',
    'PBR transmission glass',
    'brushed-metal + obsidian PBR stack',
    'kinetic MSDF caption',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(cardstackSwipeDeck);
export default cardstackSwipeDeck;
