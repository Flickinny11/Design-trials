// featuregrid-tilt-cards — a feature grid where each card is a premium 3D
// panel that TILTS toward the cursor and kindles a warm brass rim-glow along
// its pointer-facing edge (§13 catalog element). A 2×2 grid of beveled glass
// cards in cluster-local space; every card wears a real PBR materialSpec
// (smoked-glass transmission over an obsidian core, brass-trim accents) so it
// reads photoreal standalone, and each card carries an MSDF feature label
// floating just proud of its face (renderMode:'text' — INV-11, real glyphs,
// never diffusion).
//
// THE SR-SMASHING MOVE: this is the parallax-trading-card hover, productized as
// a feature section. Slider Revolution fakes card tilt with CSS perspective on
// flat DIVs; here each card is a real lit 3D panel —
//   • pointer-tilt-3d (POINTER): the whole card yaws/pitches to face the cursor
//     with a center-lift, like a premium foil card catching the light;
//   • proximity-rim-glow (POINTER): a fresnel EDGE rim wakes along the card's
//     pointer-facing border as the cursor nears — additive, non-destructive,
//     breathing with distance.
// Both are real registry primitives (grep-verified) on a real PBR card, so the
// look is physical (reflections, transmission, edge-light), not painted-on.
//
// This is a TEMPLATE: every member is a real, editable PrismNode (move / recolor
// / re-skin / swap animation post-place). Photorealism is procedural PBR + IBL
// (free) — no hero imagery needed.
//
// Tier: T1 full-fidelity (clean fallback to T0 — the cards still read as lit
// beveled glass-over-obsidian panels with crisp MSDF labels even without
// screen-space GI; the rim-glow degrades to an unlit additive edge). INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// ── Grid geometry (cluster-local; origin 0,0,0) ─────────────────────────────
// A 2×2 grid of upright cards. Columns at ±COL_X, rows at ±ROW_Y, all on a
// slight z so the labels can float just in front of each face.
const CARD_W = 1.5;
const CARD_H = 1.1;
const CARD_DEPTH = 0.1;
const COL_X = 0.95; // half horizontal pitch
const ROW_Y = 0.72; // half vertical pitch

// Four feature cells: position offset (column, row sign) + label copy + a
// premium accent base color. The accent is the obsidian core tint each card's
// smoked glass sits over — warm brass and cool ice/steel, NEVER purple.
const CELLS = [
  // Each card's face shows a real premium feature thumbnail (abstract / product /
  // material imagery — reads as gallery-grade "feature" art). `image` is mapped
  // onto the card's front face via materialSpec.baseColorMapUrl (it MULTIPLIES a
  // #ffffff base, so the photo shows full-fidelity). Images vary per card and
  // suit the near-square 1.5×1.1 tile footprint. `trim` survives as the emissive
  // brass/ice edge breath that the rim-glow primitive wakes.
  { col: -1, row: 1, label: 'Photoreal\nMaterials', trim: '#c9a86a', image: '/prism-mock/library-content/abstract-gold.png' }, // brass trim — liquid gold swirl
  { col: 1, row: 1, label: 'Cursor\nPhysics', trim: '#9fc3d6', image: '/prism-mock/library-content/product-audio.png' }, // ice trim — premium headphones
  { col: -1, row: -1, label: 'Real-Time\nLighting', trim: '#d8c089', image: '/prism-mock/orrery/materia/sapphire-macro.png' }, // pale gold — sapphire crystal macro
  { col: 1, row: -1, label: 'Edit\nEverything', trim: '#aebfcb', image: '/prism-mock/orrery/refs/watch-hero.png' }, // pewter — luxury astronomical watch
] as const;

const IDENTITY_RS = {
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
} as const;

function pose(x: number, y: number, z: number): ScenePosition {
  return { x, y, z, ...IDENTITY_RS };
}

function buildMembers(): ClusterMemberTemplate[] {
  const members: ClusterMemberTemplate[] = [];

  CELLS.forEach((cell, i) => {
    const cx = cell.col * COL_X;
    const cy = cell.row * ROW_Y;

    // ── The card — a beveled smoked-glass panel over an obsidian core. Premium
    // PBR: high transmission + clearcoat reads as real glass; the dark accent
    // base + brass/ice trim color gives each card its identity. receivesLighting
    // so the env IBL + 3-point rig sculpt the bevel and the transmission slab.
    members.push({
      localId: `card-${i}`,
      subtype: 'card',
      serviceTag: 'decor',
      caption: `${cell.label.replace('\n', ' ')} card`,
      renderMode: 'mesh',
      pose: pose(cx, cy, 0),
      footprint: { width: CARD_W, height: CARD_H },
      meshPrimitive: {
        kind: 'cube',
        params: { width: CARD_W, height: CARD_H, depth: CARD_DEPTH },
      },
      // Glossy photo-print panel: a real premium feature thumbnail mapped onto
      // the card face (baseColorMapUrl × #ffffff base = full-fidelity image), with
      // a clearcoat "wet print" finish so the rig light and IBL sweep a glossy
      // sheen across the photo. Brass/ice emissive trim breath survives for the
      // rim-glow primitive to wake along the pointer-facing edge.
      materialSpec: {
        baseColor: '#ffffff',
        baseColorMapUrl: cell.image,
        metalness: 0.0,
        roughness: 0.42,
        clearcoat: 0.6,
        clearcoatRoughness: 0.12,
        emissive: cell.trim,
        emissiveIntensity: 0.1,
        envMapIntensity: 1.0,
      },
      receivesLighting: true,
      // INTEGRATED animation: the card faces the cursor in 3D AND its edge wakes
      // with a warm rim-glow as the pointer nears. Both real registry primitives
      // (grep-verified), pointer-driven, stacked by `order`.
      animationBindings: [
        {
          id: `ab-tiltcard-tilt-${i}`,
          primitive: 'pointer-tilt-3d',
          driver: 'pointer',
          params: { maxTiltDeg: 16, smoothing: 0.22, lift: 0.14, invert: false },
          order: 0,
        },
        {
          id: `ab-tiltcard-rim-${i}`,
          primitive: 'proximity-rim-glow',
          driver: 'pointer',
          params: { intensity: 1.7, rimTightness: 3.2, proximityRange: 0.6, directionalBias: 0.65 },
          order: 1,
        },
      ],
    });

    // ── The feature label — REAL MSDF text (INV-11), floating just proud of the
    // card face so it tilts with the card. Modest fontSize (0.3) so the two-line
    // label frames comfortably inside the 1.5×1.1 tile. Brass→ice gradient fill
    // echoes the trim.
    members.push({
      localId: `label-${i}`,
      subtype: 'text',
      serviceTag: 'decor',
      caption: `${cell.label.replace('\n', ' ')} label`,
      renderMode: 'text',
      pose: pose(cx, cy, CARD_DEPTH / 2 + 0.03),
      footprint: { width: CARD_W * 0.82, height: 0.5 },
      textSpec: {
        content: cell.label,
        fontFamily: 'Inter',
        fontWeight: 600,
        fontSize: 0.3,
        align: 'center',
        lineHeight: 1.08,
        letterSpacing: 0.02,
        fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
      },
    });
  });

  return members;
}

const featuregridTiltCards: ElementClusterDefinition = {
  id: 'featuregrid-tilt-cards',
  label: 'Tilt Card Feature Grid',
  category: 'feature-grid',
  caption: 'A grid of glass feature cards that tilt to the cursor and rim-glow',
  description: 'Four beveled glass cards on a 2×2 grid, each tilting toward the pointer with a warm rim-light.',
  members: buildMembers(),
  preview: {
    // Frame the whole 2×2 grid head-on with a slight three-quarter so the bevels
    // + transmission catch the rig light. Auto-fit handles distance; a touch of
    // azimuth shows the card depth.
    camera: { distance: 5.6, polar: Math.PI / 2.1, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm studio key + cool fill so the glass cards read with depth at place time
  // (additive recommendation; never forces a hub-wide change).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.4,
    ambientIntensity: 0.26,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'parallax trading-card 3D tilt',
    'magnetic cursor physics',
    'PBR transmission glass',
    'fresnel edge rim-light',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(featuregridTiltCards);
export default featuregridTiltCards;
