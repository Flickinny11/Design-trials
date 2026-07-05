// gallery-masonry-reveal — a photoreal masonry gallery: a settled, complete wall
// of beveled panels that breathes with a gentle continuous motion (§13 prebuilt-
// library element). A true masonry layout: a 3-column grid of panels at VARYING
// heights, tightly packed (columns stagger so the tops/bottoms don't line up —
// the masonry signature), plus one MSDF caption strip. Each tile is a thin
// clearcoated box (meshPrimitive cube) wearing a rich PBR materialSpec in the
// Observatory Brass palette (brushed brass / pale gold / ice-steel / pewter /
// obsidian — NEVER purple) so the wall reads photoreal standalone, before a
// pixel of imagery is dropped onto it.
//
// THE INTEGRATED MOTION — always-visible, never-empty (the preview rig plays the
// time loop and does NOT drive scroll/pointer, so every motion below keeps every
// tile FULLY PRESENT at every phase):
//   • Every tile carries a `float` binding (registry name, transform category,
//     defaultDriver 'time'): a gentle continuous bob + micro-tilt. Per-column
//     phase/amplitude make the three columns breathe slightly out of sync so the
//     wall feels alive — but never moves a tile off-screen or fades it out.
//   • Every tile carries a `pointer-tilt-3d` binding (registry name, pointer
//     category, defaultDriver 'pointer'): in the time-loop preview it rests in
//     its settled neutral pose (a complete, premium parallax-card read); in a
//     live host it tilts the whole panel in 3D toward the cursor.
//   • Each tile carries ONE material-matched surface sweep on driver 'time'
//     (`gold-glint` on brass/gold, `metallic-sheen` on steel/pewter/obsidian,
//     `light-sweep` on the ice-glass panel). These add an emissive glint that
//     travels across the surface — pure additive sheen, so the panel is always
//     fully lit and present, just catching the light.
//
// The diagonal scroll-reveal (the masonry wall assembling band-by-band) lives on
// each tile's `scrollBinding` (scroll-timeline space) so it plays in a real host
// on actual scroll — it is intentionally NOT a time-driven animationBinding, so
// the hover preview shows the COMPLETE, SETTLED wall rather than a mid-wipe.
//
// All bindings are EXISTING catalog primitives bound by real registry name;
// nothing here adds a renderer or a dependency. Every member is a real, editable
// PrismNode (move / rescale / recolor / re-skin with hero imagery / swap the
// animation post-place). Photorealism is procedural PBR + studio IBL (free).
//
// Tier: T1 full-fidelity, clean T0 fallback — the tiles still read as lit
// brushed/glassy panels and the float still plays without screen-space GI; the
// surface sweeps degrade gracefully. Never broken, never empty at T0 (INV-9).

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

// Column cascade for the REAL-HOST scroll reveal (scrollBinding, scroll-timeline
// space): left column leads (tight stagger), right column trails (looser
// stagger) so the rise sweeps diagonally across the wall when a host scrolls.
const COL_STAGGER = [0.1, 0.18, 0.26];

// Per-column float phase/amplitude — the three columns breathe slightly out of
// sync (continuous, always-visible idle motion in the preview time loop).
const COL_FLOAT = [
  { speed: 0.85, amplitude: 0.05, tiltDeg: 1.6 }, // left
  { speed: 1.0, amplitude: 0.06, tiltDeg: 2.0 }, // center
  { speed: 0.7, amplitude: 0.045, tiltDeg: 1.4 }, // right
];

/** Material-matched surface sweep: which always-visible emissive glint rides
 *  this tile (all defaultDriver 'time', additive sheen — never hides the tile). */
type SweepKind = 'gold-glint' | 'metallic-sheen' | 'light-sweep';

interface TileSpec {
  localId: string;
  col: number; // 0..2
  y: number; // center Y of the tile (cluster-local)
  height: number;
  material: MaterialSpec;
  caption: string;
  /** The always-visible surface sweep tuned to the panel's material. */
  sweep: SweepKind;
}

// A glossy "photo print / poster / screen" surface: the base color map MULTIPLIES
// baseColor, so baseColor goes pure white and we keep a clearcoated PBR sheen.
const PHOTO_PRINT: Omit<MaterialSpec, 'baseColorMapUrl'> = {
  baseColor: '#ffffff',
  metalness: 0.0,
  roughness: 0.42,
  clearcoat: 0.6,
  clearcoatRoughness: 0.12,
  envMapIntensity: 1.0,
};
/** Build a per-tile photo-print materialSpec wearing the given image. */
const photo = (url: string): MaterialSpec => ({ ...PHOTO_PRINT, baseColorMapUrl: url });

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
  sweep: SweepKind,
): TileSpec => ({
  localId,
  col,
  y: topEdge - height / 2,
  height,
  material,
  caption,
  sweep,
});

// Left column: tall + short. Center: medium + tall (offset down). Right: short
// + medium + short. Tops cascade so seams never line up across columns. Each
// tile's surface sweep is matched to its material (gold-glint on brass/gold,
// metallic-sheen on steel/pewter/obsidian, light-sweep on the ice glass).
// Six tiles wear premium sample imagery on their front face — a photo print look
// (PHOTO_PRINT material ⊕ baseColorMapUrl). Orientation is matched to footprint:
// the tall l1/c2 cards take PORTRAIT images, the wide r1/r3 panels take LANDSCAPE,
// the squarish c1/r2 tiles take SQUARE. The ICE_GLASS tile (l2) keeps NO image so
// it stays transmissive glass — the one clear pane in a wall of photographs. The
// surface sweep stays material-matched (gold/metallic/light) atop the photo.
const IMG_BASE = '/prism-mock/library-content/';
const TILES: TileSpec[] = [
  tile('tile-l1', 0, TOP, 1.55, photo(IMG_BASE + 'editorial-silk.png'), 'Gallery tile — silk', 'gold-glint'), // portrait → tall
  tile('tile-l2', 0, TOP - 1.55 - ROW_GAP, 0.95, ICE_GLASS, 'Gallery tile — glass', 'light-sweep'), // GLASS — intentionally no image
  tile('tile-c1', 1, TOP - 0.2, 1.05, photo(IMG_BASE + 'portrait-a.png'), 'Gallery tile — portrait', 'metallic-sheen'), // square → squarish
  tile('tile-c2', 1, TOP - 0.2 - 1.05 - ROW_GAP, 1.4, photo(IMG_BASE + 'product-scent.png'), 'Gallery tile — scent', 'gold-glint'), // portrait → tall
  tile('tile-r1', 2, TOP, 0.9, photo(IMG_BASE + 'landscape-dune.png'), 'Gallery tile — dune', 'metallic-sheen'), // landscape → wide
  tile('tile-r2', 2, TOP - 0.9 - ROW_GAP, 1.0, photo(IMG_BASE + 'abstract-gold.png'), 'Gallery tile — gold', 'gold-glint'), // square → square
  tile('tile-r3', 2, TOP - 0.9 - 1.0 - 2 * ROW_GAP, 0.78, photo(IMG_BASE + 'arch-warm.png'), 'Gallery tile — atrium', 'metallic-sheen'), // landscape → wide
];

// The always-visible surface sweep params, tuned per material so the glint
// reads premium without ever washing the panel out (all defaultDriver 'time').
const SWEEP_PARAMS: Record<SweepKind, Record<string, number | string>> = {
  'gold-glint': { speed: 0.8, width: 0.16, intensity: 1.2, tint: '#ffd479' },
  'metallic-sheen': { speed: 0.7, width: 0.12, brightness: 1.15, tint: '#dfe7ff' },
  'light-sweep': { speed: 0.6, width: 0.16, intensity: 1.0, angleDeg: 35, tint: '#dff1ff' },
};

function buildTiles(): ClusterMemberTemplate[] {
  const members: ClusterMemberTemplate[] = TILES.map((t) => {
    const fl = COL_FLOAT[t.col] ?? COL_FLOAT[1];
    const bindings: NonNullable<ClusterMemberTemplate['animationBindings']> = [
      {
        // ALWAYS-VISIBLE motion #1: a gentle continuous bob + micro-tilt. The
        // tile never leaves the frame or fades — it just breathes. Per-column
        // phase/amplitude desync the three columns so the wall feels alive.
        // Driver 'time' (the primitive's native driver) → plays in the loop.
        id: `ab-masonry-${t.localId}-float`,
        primitive: 'float',
        driver: 'time',
        params: { speed: fl.speed, amplitude: fl.amplitude, tiltDeg: fl.tiltDeg },
        order: 0,
      },
      {
        // ALWAYS-VISIBLE motion #2: whole-panel 3D parallax tilt toward the
        // pointer in a live host. Driver 'pointer' → in the time-loop preview
        // (no pointer) it rests at its settled neutral pose, so the tile reads
        // as a complete, premium parallax card. Never hides geometry.
        id: `ab-masonry-${t.localId}-tilt`,
        primitive: 'pointer-tilt-3d',
        driver: 'pointer',
        params: { maxTiltDeg: 12, smoothing: 0.22, lift: 0.1 },
        order: 1,
      },
      {
        // ALWAYS-VISIBLE motion #3: a material-matched emissive sweep that
        // travels across the surface — additive sheen only, so the panel stays
        // fully lit and present, just catching the light. Driver 'time'.
        id: `ab-masonry-${t.localId}-sweep`,
        primitive: t.sweep,
        driver: 'time',
        params: SWEEP_PARAMS[t.sweep],
        order: 2,
      },
    ];
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
      // REAL-HOST scroll reveal (scroll-timeline space): the tile rises from
      // below and fades in as the host scrolls. Per-column ease keeps the
      // diagonal cascade. This is intentionally NOT a time-driven binding, so
      // the hover preview shows the COMPLETE, SETTLED wall — never a mid-wipe.
      scrollBinding: [
        { property: 'translateY', from: -(0.9 + (COL_STAGGER[t.col] ?? 0.18) * 2), to: 0, ease: 'easeOut' },
        { property: 'opacity', from: 0, to: 1, ease: 'easeOut' },
      ],
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
    // The caption breathes with the wall (gentle, always-legible float). Its
    // staggered arrival rides the host scroll via scrollBinding, like the tiles,
    // so the preview keeps the label fully present and readable (INV-11).
    animationBindings: [
      {
        id: 'ab-masonry-caption-float',
        primitive: 'float',
        driver: 'time',
        params: { speed: 0.9, amplitude: 0.035, tiltDeg: 0 },
        order: 0,
      },
    ],
    scrollBinding: [
      { property: 'translateY', from: -0.6, to: 0, ease: 'easeOut' },
      { property: 'opacity', from: 0, to: 1, ease: 'easeOut' },
    ],
  });

  return members;
}

export const galleryMasonryReveal: ElementClusterDefinition = {
  id: 'gallery-masonry-reveal',
  label: 'Masonry Reveal Gallery',
  category: 'gallery',
  caption: 'A complete PBR masonry wall that gently breathes and catches the light',
  description:
    'Seven PBR masonry tiles in a packed wall — a gentle float, pointer-parallax tilt, and a material-matched light sweep. The diagonal stagger-rise plays on scroll in a real host.',
  members: buildTiles(),
  preview: {
    // Frame the whole wall straight-on, slightly above, with a touch of
    // three-quarter so the bevels + bottom stagger read. Auto-fit distance is
    // fine for a tile, but pin it so all seven tiles + caption fit a ~4:3 tile.
    camera: { distance: 7.2, polar: Math.PI / 2.25, azimuth: Math.PI * 0.06 },
    // The wall is COMPLETE at every phase (continuous always-visible motion), so
    // any frozen phase lands a full still; 0.5 sits at the gentle float midpoint.
    frozenPhase: 0.5,
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
    'continuous idle float',
    'pointer-parallax 3D card tilt',
    'travelling metallic light sweep',
    'scroll-staggered masonry reveal',
    'PBR transmission glass',
    'kinetic MSDF caption',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(galleryMasonryReveal);
export default galleryMasonryReveal;
