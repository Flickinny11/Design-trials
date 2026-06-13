// featuregrid-depth-pop — a 3×2 grid of premium feature cards that POP FORWARD
// out of depth as they enter view (§13 prebuilt-library element). Each card is
// a thick beveled box (meshPrimitive cube) wearing a rich PBR materialSpec drawn
// from the Observatory Brass palette (warm brass / pale gold + cool ice-steel +
// charcoal obsidian, NEVER purple) so it reads photoreal standalone — the deep
// cube + clearcoat does the layered-bevel work without extra geometry. A
// centered MSDF heading (real letterforms, INV-11) frames the section above the
// grid. Seven members total (6 cards + 1 heading) — squarely premium, not bloated.
//
// THE SR-SMASHING MOVE: every card carries TWO integrated bindings —
//   1. `depth-pop` (time driver): the card rushes forward from deep in Z to its
//      resting plane, scaling up with a perspective ramp and fading in. Per-card
//      `duration` is staggered column-by-column / row-by-row so the grid pops in
//      as a left-to-right, top-to-bottom WAVE rather than all at once.
//   2. `scroll-stagger-rise` (scroll driver): as the section scrolls into view
//      the same cards decompose into staggered rows that rise and settle — the
//      scroll choreography Slider Revolution fakes with CSS, here done as real
//      decomposed geometry riding live PBR materials.
// The two bindings stack (order 0 + order 1) so the element is alive both
// ambiently (time) and on scroll — best-in-class out of the box.
//
// Every member is a real, editable PrismNode (move / recolor / re-skin / swap
// the animation post-place). Photorealism is procedural PBR + studio IBL (free)
// — no generated imagery needed.
//
// Tier: T1 full-fidelity (clean fallback to T0 — the cards still read as lit,
// beveled brushed/obsidian/glass panels without screen-space GI). INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { MaterialSpec } from '@/lib/prism-graph/types';

// ── Grid geometry (cluster-local space, origin 0,0,0) ────────────────────────
const COLS = 3;
const ROWS = 2;
const COL_GAP = 1.55; // horizontal spacing between card centers
const ROW_GAP = 1.7; // vertical spacing between card centers
const GRID_Y_OFFSET = -0.25; // nudge the grid down so the heading clears it

// Card footprint (scene units) — a square feature tile with real depth so the
// beveled edge catches the rim light under PBR + IBL (no extra backing geometry
// needed — the depth + clearcoat carry the layered read).
const CARD_W = 1.32;
const CARD_H = 1.32;
const CARD_DEPTH = 0.16;

// Premium PBR recipes from the catalog plan, all physically plausible and in the
// Observatory Brass palette. Cards cycle through these so the grid alternates
// brushed metal, obsidian, polished chrome, iridescent and glass reads.
const BRUSHED_BRASS: MaterialSpec = {
  baseColor: '#c9a86a',
  metalness: 0.95,
  roughness: 0.32,
  clearcoat: 0.5,
  clearcoatRoughness: 0.25,
  envMapIntensity: 1.3,
};
const OBSIDIAN: MaterialSpec = {
  baseColor: '#15171f',
  metalness: 0.7,
  roughness: 0.18,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
  envMapIntensity: 1.4,
};
const POLISHED_CHROME: MaterialSpec = {
  baseColor: '#aebfcb',
  metalness: 1,
  roughness: 0.08,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
  envMapIntensity: 1.6,
};
const ICE_GLASS: MaterialSpec = {
  baseColor: '#9fc3d6',
  metalness: 0,
  roughness: 0.06,
  transmission: 0.92,
  ior: 1.5,
  dispersion: 0.04,
  thickness: 0.5,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
  envMapIntensity: 1.4,
};
const IRIDESCENT_STEEL: MaterialSpec = {
  baseColor: '#b6d0dd',
  metalness: 0.6,
  roughness: 0.25,
  iridescence: 0.8,
  iridescenceIOR: 1.3,
  clearcoat: 0.7,
  clearcoatRoughness: 0.18,
  envMapIntensity: 1.5,
};
const PALE_GOLD: MaterialSpec = {
  baseColor: '#d8c089',
  metalness: 0.88,
  roughness: 0.28,
  clearcoat: 0.6,
  clearcoatRoughness: 0.22,
  envMapIntensity: 1.35,
};

// Card order reads brass → obsidian → chrome (top row), then iridescent → glass
// → pale-gold (bottom row): a balanced, premium mix per column.
const CARD_MATERIALS: MaterialSpec[] = [
  BRUSHED_BRASS,
  OBSIDIAN,
  POLISHED_CHROME,
  IRIDESCENT_STEEL,
  ICE_GLASS,
  PALE_GOLD,
];

function buildCards(): ClusterMemberTemplate[] {
  const cards: ClusterMemberTemplate[] = [];
  const xStart = -((COLS - 1) * COL_GAP) / 2;
  const yStart = ((ROWS - 1) * ROW_GAP) / 2 + GRID_Y_OFFSET;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const x = xStart + c * COL_GAP;
      const y = yStart - r * ROW_GAP;
      const mat = CARD_MATERIALS[i % CARD_MATERIALS.length];

      // Stagger the depth-pop duration so the grid pops in as a wave: cards
      // closer to top-left land first (shorter pop), bottom-right last. Each
      // card still rushes from the same depth, so the wave reads as a coherent
      // pop-forward of the whole grid.
      const popDuration = 0.9 + (c + r) * 0.18;

      // The feature card — premium PBR surface, carrying BOTH integrated
      // bindings (ambient depth-pop on time + scroll-stagger-rise on scroll).
      cards.push({
        localId: `card-${i}`,
        subtype: 'card',
        serviceTag: 'decor',
        caption: `Feature card ${i + 1}`,
        renderMode: 'mesh',
        pose: {
          x,
          y,
          z: 0,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
        footprint: { width: CARD_W, height: CARD_H },
        meshPrimitive: {
          kind: 'cube',
          params: { width: CARD_W, height: CARD_H, depth: CARD_DEPTH },
        },
        materialSpec: mat,
        receivesLighting: true,
        // INTEGRATED animation — TWO real registry primitives, stacked.
        animationBindings: [
          {
            // depth-pop: rush forward from deep in Z, scale up + fade in.
            // Staggered duration per card → the grid pops in as a wave.
            id: `ab-fg-pop-${i}`,
            primitive: 'depth-pop',
            driver: 'time',
            params: { duration: popDuration, depth: 7, curve: 'expoOut' },
            order: 0,
          },
          {
            // scroll-stagger-rise: on scroll, the card's rows arrive one by one.
            id: `ab-fg-rise-${i}`,
            primitive: 'scroll-stagger-rise',
            driver: 'scroll',
            params: { bands: 5, stagger: 0.18, lift: 1.2 },
            order: 1,
          },
        ],
      });
    }
  }
  return cards;
}

const featuregridDepthPop: ElementClusterDefinition = {
  id: 'featuregrid-depth-pop',
  label: 'Depth Pop Feature Grid',
  category: 'feature-grid',
  caption: 'A 3×2 grid of PBR feature cards that pop forward out of depth',
  description:
    'Premium feature tiles that rush forward from deep in Z as they enter view, popping in as a left-to-right wave with scroll-staggered row reveals.',
  members: [
    // ── Section heading — REAL MSDF text (INV-11), framed above the grid.
    {
      localId: 'heading',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Feature grid heading',
      renderMode: 'text',
      pose: {
        x: 0,
        y: 2.0,
        z: 0.15,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 3.2, height: 0.5 },
      textSpec: {
        content: 'WHY IT WINS',
        fontFamily: 'Inter',
        fontWeight: 700,
        // Modest relative to the cluster so it frames cleanly above the tiles.
        fontSize: 0.38,
        align: 'center',
        letterSpacing: 0.05,
        fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
        decompose: 'glyph',
      },
    },
    ...buildCards(),
  ],
  preview: {
    // Frame the whole 3×2 grid + heading head-on with a slight high three-
    // quarter so the pop-forward depth is legible in a ~4:3 tile.
    camera: { distance: 6.6, polar: Math.PI / 2.3, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm-key studio look at place time (additive; never forces a hub-wide
  // change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.3,
    ambientIntensity: 0.28,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'depth-pop reveal-on-enter',
    'scroll-stagger choreography',
    'PBR brushed-metal + obsidian feature cards',
    'transmission glass tile',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(featuregridDepthPop);
export default featuregridDepthPop;
