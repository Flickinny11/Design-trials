// gallery-depth-wall — a tilt-reactive depth-wall gallery (§13 element). A 3×2
// grid wall of framed panels floating at STAGGERED depths (columns step back in
// Z), each panel a thin beveled box wearing a premium PBR materialSpec —
// alternating brushed brass, polished obsidian, and ice-tinted glass — so the
// wall reads photoreal standalone. The frame-and-inlay look comes from the
// clearcoat + low-roughness edge catch, not from textures.
//
// THE SR-SMASHING MOVE: the whole wall is cursor-reactive. Every panel carries a
// `pointer-tilt-3d` binding (real registry primitive, POINTER driver) so each
// framed panel tilts in 3D toward the cursor like a premium trading card, with a
// center-lift that scales the panel toward the viewer when faced straight on.
// Layered on top, a `parallax` binding (real registry primitive, SCROLL driver)
// shifts each panel vertically by a DEPTH-WEIGHTED amount — front panels travel
// farther than the recessed back column — so scrolling reveals genuine 3D
// parallax through the wall, not a flat CSS translate. Slider-Revolution does
// this with stacked 2D layers; this is real PBR geometry at real Z depth.
//
// An MSDF headline (renderMode:'text', real glyphs — INV-11, never diffusion)
// frames the wall along the bottom edge, sized modestly so it sits inside the
// composition rather than overpowering the panels.
//
// Every member is a real, editable PrismNode (move/scale/recolor/re-skin/swap
// animation post-place). Photorealism is procedural PBR + IBL (free) — no hero
// imagery needed.
//
// Tier: T1 full-fidelity, clean T0 fallback — the panels still read as lit,
// depth-staggered brushed/obsidian/glass cards (just without screen-space GI)
// and the tilt/parallax still play. INV-9.

import type { AnimationBinding } from '@/lib/prism-graph/types';
import type { ClusterMemberTemplate, ElementClusterDefinition } from '../contract';
import { registerElement } from '../registry';

// 3 columns × 2 rows of panels.
const COLS = 3;
const ROWS = 2;

// Panel footprint (scene units) — an upright, thin framed panel.
const PANEL_W = 1.12;
const PANEL_H = 1.36;
const PANEL_DEPTH = 0.07;

// Grid spacing.
const COL_GAP = 1.45;
const ROW_GAP = 1.62;

// Depth stagger: each column steps back in Z so the wall has real parallax
// depth. Column 0 is closest, column 2 is furthest.
const COL_Z_STEP = -0.55;

// Per-panel premium PBR recipes (Observatory Brass: warm brass/gold + cool
// ice/steel + charcoal obsidian — NEVER purple). The grid cycles through these
// so adjacent panels contrast in material, not just color.
const PANEL_MATERIALS = [
  // brushed brass
  { baseColor: '#c9a86a', metalness: 0.95, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.22, envMapIntensity: 1.3 },
  // polished obsidian (charcoal, clearcoated)
  { baseColor: '#15171f', metalness: 0.7, roughness: 0.18, clearcoat: 1.0, clearcoatRoughness: 0.1, envMapIntensity: 1.25 },
  // ice-tinted glass inlay
  { baseColor: '#aecbdd', metalness: 0.2, roughness: 0.06, transmission: 0.86, ior: 1.5, dispersion: 0.04, thickness: 0.4, clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.5 },
  // pale gold
  { baseColor: '#d8c089', metalness: 0.9, roughness: 0.3, clearcoat: 0.65, clearcoatRoughness: 0.2, envMapIntensity: 1.3 },
  // steel pewter
  { baseColor: '#9fb1bf', metalness: 0.85, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 1.35 },
  // antique brass
  { baseColor: '#b8965a', metalness: 0.92, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 1.3 },
] as const;

// Depth buckets for the compositor: front column reads as 'content', the two
// recessed columns drop to 'midground' / 'background' so the depth ordering is
// honest end-to-end.
const COL_DEPTH_LAYER = ['content', 'midground', 'background'] as const;

function buildPanels(): ClusterMemberTemplate[] {
  const panels: ClusterMemberTemplate[] = [];
  const xCenter = ((COLS - 1) * COL_GAP) / 2;
  const yCenter = ((ROWS - 1) * ROW_GAP) / 2;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      const x = c * COL_GAP - xCenter;
      const y = yCenter - r * ROW_GAP + 0.45; // lift the wall above the label
      const z = c * COL_Z_STEP; // columns step back in Z
      const mat = PANEL_MATERIALS[idx % PANEL_MATERIALS.length];

      // Depth-weighted parallax: closer panels (front column) travel farther on
      // scroll than the recessed back column, so the wall parallaxes in 3D.
      const parallaxDepth = 1.6 - c * 0.45; // col0≈1.6, col1≈1.15, col2≈0.7

      const bindings: AnimationBinding[] = [
        // INTEGRATED #1 — cursor-reactive 3D tilt (POINTER driver). Each panel
        // tilts toward the pointer like a premium trading card, with a slight
        // center-lift rise when faced straight on.
        {
          id: `ab-depthwall-tilt-${idx}`,
          primitive: 'pointer-tilt-3d',
          driver: 'pointer',
          params: { maxTiltDeg: 16, smoothing: 0.22, lift: 0.18, invert: false },
          order: 0,
        },
        // INTEGRATED #2 — depth-weighted scroll parallax (SCROLL driver).
        {
          id: `ab-depthwall-parallax-${idx}`,
          primitive: 'parallax',
          driver: 'scroll',
          params: { range: 1.2, depth: parallaxDepth, axis: 'y' },
          order: 1,
        },
      ];

      panels.push({
        localId: `panel-${idx}`,
        subtype: 'card',
        serviceTag: 'decor',
        caption: `Gallery panel ${idx + 1}`,
        renderMode: 'mesh',
        pose: {
          x,
          y,
          z,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
        footprint: { width: PANEL_W, height: PANEL_H },
        meshPrimitive: {
          kind: 'cube',
          params: { width: PANEL_W, height: PANEL_H, depth: PANEL_DEPTH },
        },
        materialSpec: { ...mat },
        receivesLighting: true,
        depthLayer: COL_DEPTH_LAYER[c % COL_DEPTH_LAYER.length],
        animationBindings: bindings,
      });
    }
  }
  return panels;
}

const panels = buildPanels();

// MSDF headline framing the wall along the bottom edge. Modest fontSize so it
// frames inside the composition rather than dominating it.
const label: ClusterMemberTemplate = {
  localId: 'wall-label',
  subtype: 'text',
  serviceTag: 'decor',
  caption: 'Gallery label',
  renderMode: 'text',
  pose: {
    x: 0,
    y: -1.95,
    z: 0.1,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  },
  footprint: { width: 3.2, height: 0.45 },
  textSpec: {
    content: 'DEPTH WALL',
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 0.38,
    align: 'center',
    letterSpacing: 0.05,
    fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
    decompose: 'glyph',
  },
};

export const galleryDepthWall: ElementClusterDefinition = {
  id: 'gallery-depth-wall',
  label: 'Depth Wall Gallery',
  category: 'gallery',
  caption: 'A grid wall of framed panels that tilt with the cursor',
  description: 'Six depth-staggered PBR panels — cursor-tilt + scroll parallax.',
  members: [...panels, label],
  preview: {
    // Frame the whole 3×2 wall slightly off-axis so the column depth-stagger
    // reads as parallax, three-quarter from a touch above.
    camera: { distance: 6.6, polar: Math.PI / 2.25, azimuth: Math.PI * 0.08 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm-key studio look so the brass catches the light and the glass panel
  // refracts (additive; never forces a hub-wide change unless opted in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.3,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'magnetic cursor physics',
    'pointer parallax tilt (3D trading-card)',
    'depth-weighted scroll parallax',
    'PBR transmission glass',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(galleryDepthWall);
export default galleryDepthWall;
