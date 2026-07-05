// featuregrid-depth-pop — a 3×2 grid of premium feature cards that read COMPLETE
// and gently alive at all times (§13 prebuilt-library element). Each card is a
// thick beveled box (meshPrimitive cube). FIVE of the six cards now wear a REAL
// premium sample image on their front face (a glossy photo-print materialSpec:
// `baseColorMapUrl` over a pure-white base, low-roughness clearcoat for a
// poster-under-glass read) so the content surfaces are populated and photoreal,
// not flat panels. The sixth tile stays a transmissive ICE_GLASS pane for one
// real glass read. All imagery is square, matched to the square card footprint,
// and VARIES across the grid (gold swirl, iridescent glass, sapphire, brass,
// meteorite) so no image repeats. Palette stays Observatory Brass, NEVER purple.
// A centered MSDF heading (real letterforms, INV-11) frames the section above the
// grid. Seven members total (6 cards + 1 heading) — squarely premium, not bloated.
//
// THE AMBIENT MOTION (always-visible, never popping): the dominant time-driven
// motion is a CONTINUOUS gentle FLOAT — the whole grid bobs and drifts buoyantly,
// so the cards are FULLY PRESENT at full scale at EVERY phase of the loop. Float
// speed/amplitude/tilt are staggered per card (a column+row phase offset) so the
// grid reads as an organic, alive surface rather than a single rigid block — but
// it NEVER reveals/scales-in from nothing. (The old `depth-pop` time binding,
// which rushed cards forward from deep in Z and left them tiny/absent for part of
// the loop, is REMOVED — that was the empty-black-preview defect.)
//
// THE PREMIUM LIVE FEEL (cursor, post-place): two pointer-driven bindings make
// each placed card behave like a premium trading card:
//   • `pointer-tilt-3d` — the whole card parallax-tilts in 3D toward the cursor,
//     catching the studio IBL as it faces you. With no pointer it rests dead-on
//     (steady, fully present), so it is always safe in the no-pointer preview rig.
//   • `proximity-rim-glow` — a warm brass rim light kindles along the card's
//     pointer-facing edge as the cursor nears, on a NON-DESTRUCTIVE additive
//     overlay shell (the card's own PBR material is never touched). Off at rest,
//     so it can never wipe or empty the card.
// All four motions keep the card's geometry + premium PBR surface fully intact —
// nothing here ever decomposes, scales from zero, or hides the artifact.
//
// Every member is a real, editable PrismNode (move / recolor / re-skin / swap
// the image or animation post-place). Photorealism is real sample imagery on a
// glossy photo-print PBR surface + studio IBL, with the glass tile carried by
// procedural transmission.
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

// The one real GLASS tile in the grid — a transmissive ice-steel pane (kept
// untouched: transmission > 0.3 means it must stay refractive glass, never
// wear an opaque photo). The other five tiles are photo-print surfaces below.
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

// PREMIUM PHOTO-PRINT recipe (UI-WOW): each non-glass card's front face wears a
// real sample image via `baseColorMapUrl` (the map MULTIPLIES baseColor, so
// baseColor is pure #ffffff to show the photo undimmed). The glossy
// clearcoat + low roughness give a poster/screen "photo print under glass"
// read that catches the studio IBL. receivesLighting stays true so the print
// still sits in the lit scene. Square images go on these square feature tiles
// (footprint CARD_W === CARD_H), and they VARY across the grid (glossy gold
// swirl → iridescent glass → sapphire → brass → meteorite) so no image repeats.
function photoCard(url: string): MaterialSpec {
  return {
    baseColor: '#ffffff',
    baseColorMapUrl: url,
    metalness: 0,
    roughness: 0.42,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.0,
  };
}

// Card order (top row): glossy-gold abstract → iridescent-glass abstract →
// sapphire macro. Bottom row: brushed-brass macro → ICE_GLASS (untouched
// transmissive glass tile, kept as the one real glass read) → meteorite macro.
// Five distinct square sample images, one transmissive glass tile.
const CARD_MATERIALS: MaterialSpec[] = [
  photoCard('/prism-mock/library-content/abstract-gold.png'),
  photoCard('/prism-mock/library-content/abstract-glass.png'),
  photoCard('/prism-mock/orrery/materia/sapphire-macro.png'),
  photoCard('/prism-mock/orrery/materia/brass-macro.png'),
  ICE_GLASS,
  photoCard('/prism-mock/orrery/materia/meteorite-macro.png'),
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

      // Stagger the FLOAT per card (column+row phase) so the grid bobs as an
      // organic alive surface rather than one rigid block — but every card stays
      // FULL-SIZE and present at every phase (continuous idle motion, never a
      // reveal). Slight speed/amplitude/tilt variation desynchronizes the bob.
      const phase = c + r; // 0 (top-left) .. 3 (bottom-right)
      const floatSpeed = 0.9 + phase * 0.12;
      const floatAmp = 0.14 + (phase % 2) * 0.04;
      const floatTilt = 5 + phase * 0.8;

      // The feature card — premium PBR surface, carrying its integrated motion:
      // a continuous always-visible FLOAT (time) plus live cursor parallax +
      // rim glow (pointer). NONE of these ever hide or shrink the card.
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
        // INTEGRATED animation — FOUR real registry primitives. The element is
        // alive AND complete at every phase: the time-driven `float` is the
        // dominant always-visible ambient (no reveal, no scale-from-zero), and
        // the two pointer-driven bindings add a premium live feel once placed
        // (and rest fully-present / off in the no-pointer preview rig).
        animationBindings: [
          {
            // float (TIME, dominant ambient): the card bobs + drifts gently in a
            // continuous idle loop — FULL-SIZE and present at every phase. This
            // replaces depth-pop as the time motion so the preview never empties.
            id: `ab-fg-float-${i}`,
            primitive: 'float',
            driver: 'time',
            params: { speed: floatSpeed, amplitude: floatAmp, tiltDeg: floatTilt },
            order: 0,
          },
          {
            // pointer-tilt-3d (POINTER): whole-card parallax tilt toward the
            // cursor, like a premium trading card. Rests dead-on (steady, fully
            // present) with no pointer, so it is preview-safe.
            id: `ab-fg-tilt-${i}`,
            primitive: 'pointer-tilt-3d',
            driver: 'pointer',
            params: { maxTiltDeg: 16, smoothing: 0.22, lift: 0.14 },
            order: 1,
          },
          {
            // proximity-rim-glow (POINTER): a warm brass rim kindles along the
            // pointer-facing edge as the cursor nears — additive overlay, the
            // card's PBR material is never touched. Off at rest → never wipes.
            id: `ab-fg-rim-${i}`,
            primitive: 'proximity-rim-glow',
            driver: 'pointer',
            params: { intensity: 1.5, rimTightness: 3, proximityRange: 0.55, directionalBias: 0.6 },
            order: 2,
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
  caption: 'A 3×2 grid of premium PBR feature cards that gently float and tilt to the cursor',
  description:
    'Premium feature tiles that read complete at all times — the grid bobs in a buoyant continuous float, parallax-tilts in 3D toward the cursor, and kindles a warm brass rim glow on proximity.',
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
    // quarter so the beveled card depth catches the rim light in a ~4:3 tile.
    // The cards are full-size and complete at EVERY phase (continuous float),
    // so the frozen still is always a complete grid; 0.25 lands the bob near
    // its gentle mid-rise for a lively-but-legible poster.
    camera: { distance: 6.6, polar: Math.PI / 2.3, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.25,
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
    'continuous buoyant float (always-present idle motion)',
    'pointer parallax 3D card tilt',
    'proximity rim-glow edge light (Cursify Glow take)',
    'glossy photo-print feature thumbnails (real sample imagery)',
    'transmission glass tile',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(featuregridDepthPop);
export default featuregridDepthPop;
