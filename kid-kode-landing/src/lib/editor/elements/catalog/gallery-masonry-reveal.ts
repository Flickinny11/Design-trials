// gallery-masonry-reveal — a photoreal masonry gallery whose tiles stagger-rise
// and wipe in on scroll (§13 prebuilt-library element). A true masonry layout: a
// 3-column grid of beveled panels at VARYING heights, tightly packed (columns
// stagger so the tops/bottoms don't line up — the masonry signature), plus one
// MSDF caption strip. Each tile is a thin clearcoated box (meshPrimitive cube)
// wearing a rich PBR materialSpec in the Observatory Brass palette (brushed
// brass / pale gold / ice-steel / pewter — NEVER purple) so the wall reads
// photoreal standalone, before a pixel of imagery is dropped onto it.
//
// THE SR-SMASHING MOVE — integrated scroll choreography:
//   • Every tile carries a `scroll-stagger-rise` binding (registry name, scroll
//     category, verified). As scroll advances the tile decomposes into bands
//     that RISE from below and fade in, staggered row by row — the masonry wall
//     assembles itself one slat at a time instead of hard-cutting in. Per-tile
//     `stagger` is tuned by column so the three columns cascade out of phase
//     (left column leads, right column trails) — a real diagonal reveal sweep.
//   • Three accent tiles additionally carry a `mask-wipe` binding (registry
//     name, mask category, verified): a soft directional edge-wipe so those
//     panels reveal with a clean swept seam over the rise — the second layer of
//     the choreography. Angles alternate so the wipes fan across the wall.
//
// Both are EXISTING catalog primitives bound by real registry name; nothing here
// adds a renderer or a dependency. Every member is a real, editable PrismNode
// (move / rescale / recolor / re-skin with hero imagery / swap the animation
// post-place). Photorealism is procedural PBR + studio IBL (free) — no imagery
// needed for the element to read best-in-class.
//
// Tier: T1 full-fidelity, clean T0 fallback — the tiles still read as lit
// brushed/glassy panels and the rise still plays without screen-space GI; the
// mask-wipe degrades to a plain reveal. Never broken at T0 (INV-9).

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { MaterialSpec, ScenePosition } from '@/lib/prism-graph/types';

// ── Masonry geometry (cluster-local; origin 0,0,0) ──────────────────────────
// Three columns; tiles of three height classes packed so column seams stagger.
const TILE_W = 1.15;
const TILE_DEPTH = 0.07;
const COL_GAP = 0.14;
const ROW_GAP = 0.14;
const COL_X = [-(TILE_W + COL_GAP), 0, TILE_W + COL_GAP]; // left / center / right

// Premium PBR recipes (Observatory Brass). Geometric members read photoreal from
// material alone — brushed metal, polished chrome, glass, iridescent, obsidian.
const BRUSHED_BRASS: MaterialSpec = {
  baseColor: '#c9a86a',
  metalness: 0.95,
  roughness: 0.32,
  clearcoat: 0.5,
  clearcoatRoughness: 0.22,
  envMapIntensity: 1.3,
};
const POLISHED_GOLD: MaterialSpec = {
  baseColor: '#d8c089',
  metalness: 1.0,
  roughness: 0.1,
  clearcoat: 1.0,
  clearcoatRoughness: 0.08,
  envMapIntensity: 1.55,
};
const ICE_GLASS: MaterialSpec = {
  baseColor: '#bcd4e2',
  metalness: 0.0,
  roughness: 0.06,
  transmission: 0.9,
  ior: 1.5,
  dispersion: 0.04,
  clearcoat: 1.0,
  clearcoatRoughness: 0.06,
  thickness: 0.5,
  envMapIntensity: 1.4,
};
const STEEL_BLUE: MaterialSpec = {
  baseColor: '#8fb0c4',
  metalness: 0.85,
  roughness: 0.24,
  clearcoat: 0.4,
  clearcoatRoughness: 0.18,
  envMapIntensity: 1.25,
};
const PEWTER: MaterialSpec = {
  baseColor: '#aeb9c4',
  metalness: 0.7,
  roughness: 0.28,
  clearcoat: 0.3,
  envMapIntensity: 1.1,
};
const OBSIDIAN: MaterialSpec = {
  baseColor: '#15171f',
  metalness: 0.7,
  roughness: 0.18,
  clearcoat: 1.0,
  clearcoatRoughness: 0.12,
  envMapIntensity: 1.35,
};

const identityPose = (
  x: number,
  y: number,
  z: number,
): ScenePosition => ({
  x,
  y,
  z,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
});

// Column cascade: left column reveals first (tight stagger), right column
// trails (looser stagger) so the rise sweeps diagonally across the wall.
const COL_STAGGER = [0.1, 0.18, 0.26];

interface TileSpec {
  localId: string;
  col: number; // 0..2
  y: number; // center Y of the tile (cluster-local)
  height: number;
  material: MaterialSpec;
  caption: string;
  /** Add a mask-wipe accent reveal on top of the rise. */
  wipe?: { angleDeg: number };
}

// A packed masonry arrangement: column tops align near the same upper line, the
// VARYING heights make the bottoms stagger (the masonry look). Heights chosen so
// each column fills a similar total span with a different number of tiles.
const TOP = 1.55; // shared upper edge of the wall
const tile = (
  localId: string,
  col: number,
  topEdge: number,
  height: number,
  material: MaterialSpec,
  caption: string,
  wipe?: { angleDeg: number },
): TileSpec => ({
  localId,
  col,
  y: topEdge - height / 2,
  height,
  material,
  caption,
  wipe,
});

// Left column: tall + short. Center: medium + tall (offset down). Right: short
// + medium + short. Tops cascade so seams never line up across columns.
const TILES: TileSpec[] = [
  tile('tile-l1', 0, TOP, 1.55, BRUSHED_BRASS, 'Gallery tile — feature', { angleDeg: 0 }),
  tile('tile-l2', 0, TOP - 1.55 - ROW_GAP, 0.95, ICE_GLASS, 'Gallery tile — glass'),
  tile('tile-c1', 1, TOP - 0.2, 1.05, POLISHED_GOLD, 'Gallery tile — gold', { angleDeg: 90 }),
  tile('tile-c2', 1, TOP - 0.2 - 1.05 - ROW_GAP, 1.4, OBSIDIAN, 'Gallery tile — obsidian'),
  tile('tile-r1', 2, TOP, 0.9, STEEL_BLUE, 'Gallery tile — steel'),
  tile('tile-r2', 2, TOP - 0.9 - ROW_GAP, 1.0, PEWTER, 'Gallery tile — pewter', { angleDeg: 180 }),
  tile('tile-r3', 2, TOP - 0.9 - 1.0 - 2 * ROW_GAP, 0.78, BRUSHED_BRASS, 'Gallery tile — accent'),
];

function buildTiles(): ClusterMemberTemplate[] {
  const members: ClusterMemberTemplate[] = TILES.map((t) => {
    const bindings: NonNullable<ClusterMemberTemplate['animationBindings']> = [
      {
        // INTEGRATED move: staggered scroll rise — the tile assembles in bands
        // from below as scroll advances. Per-column stagger makes the wall
        // cascade diagonally. Driver 'scroll' (the primitive's native driver;
        // the preview rig maps the master clock to a scroll sweep so the tile
        // still plays when no live host scroll is present).
        id: `ab-masonry-${t.localId}-rise`,
        primitive: 'scroll-stagger-rise',
        driver: 'scroll',
        params: { bands: 5, stagger: COL_STAGGER[t.col] ?? 0.18, lift: 1.3 },
        order: 0,
      },
    ];
    if (t.wipe) {
      bindings.push({
        // SECOND layer: a soft directional edge-wipe reveal on accent tiles —
        // angles fan across the wall. Driver 'time' (the primitive's native
        // driver) so the wipe loops ambiently.
        id: `ab-masonry-${t.localId}-wipe`,
        primitive: 'mask-wipe',
        driver: 'time',
        params: { duration: 1.4, angleDeg: t.wipe.angleDeg, softness: 0.14 },
        order: 1,
      });
    }
    return {
      localId: t.localId,
      subtype: 'card',
      serviceTag: 'decor',
      caption: t.caption,
      renderMode: 'mesh',
      pose: identityPose(COL_X[t.col] ?? 0, t.y, 0),
      footprint: { width: TILE_W, height: t.height },
      meshPrimitive: {
        kind: 'cube',
        params: { width: TILE_W, height: t.height, depth: TILE_DEPTH },
      },
      materialSpec: t.material,
      receivesLighting: true,
      animationBindings: bindings,
    };
  });

  // ── Caption strip — REAL MSDF text (INV-11), framed UNDER the wall. Modest
  // fontSize so it reads as a label inside the composition, never overpowering
  // the tiles.
  members.push({
    localId: 'caption',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Gallery caption',
    renderMode: 'text',
    pose: identityPose(0, -2.0, 0.1),
    footprint: { width: 3.4, height: 0.4 },
    textSpec: {
      content: 'SELECTED WORK',
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 0.34,
      align: 'center',
      letterSpacing: 0.06,
      fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
      decompose: 'glyph',
    },
    // The caption rises with the wall too (its own staggered arrival).
    animationBindings: [
      {
        id: 'ab-masonry-caption-rise',
        primitive: 'scroll-stagger-rise',
        driver: 'scroll',
        params: { bands: 3, stagger: 0.3, lift: 0.9 },
        order: 0,
      },
    ],
  });

  return members;
}

export const galleryMasonryReveal: ElementClusterDefinition = {
  id: 'gallery-masonry-reveal',
  label: 'Masonry Reveal Gallery',
  category: 'gallery',
  caption: 'A masonry wall whose tiles stagger-rise and wipe in on scroll',
  description:
    'Seven PBR masonry tiles that assemble band-by-band as you scroll, with accent edge-wipes.',
  members: buildTiles(),
  preview: {
    // Frame the whole wall straight-on, slightly above, with a touch of
    // three-quarter so the bevels + bottom stagger read. Auto-fit distance is
    // fine for a tile, but pin it so all seven tiles + caption fit a ~4:3 tile.
    camera: { distance: 7.2, polar: Math.PI / 2.25, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Cool studio key with a warm bounce reads the brass + ice palette well;
  // additive recommendation only (never forces a hub-wide change).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.3,
    ambientIntensity: 0.26,
    shadowSoftness: 0.6,
  },
  designRefs: [
    'scroll-staggered masonry reveal',
    'directional mask-wipe transition',
    'PBR transmission glass',
    'kinetic MSDF caption',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(galleryMasonryReveal);
export default galleryMasonryReveal;
