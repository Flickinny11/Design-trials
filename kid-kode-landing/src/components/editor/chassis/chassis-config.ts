// PRISM TOOLBAR CHASSIS — locked geometry + the founder's refined material/layout
// language. Single source of truth for the chassis's world dimensions, the grouped
// section palette, the function→section mapping, and the computed grid layout.
//
// The chassis is a REVIEWABLE object built in the app's R3F/Three engine (an
// isolated WebGL canvas, the proven Glb3DPreview idiom — it never touches the
// unified three/webgpu graph scene). It does NOT replace the production toolbar.
//
// LOCKED VISION (do not reinterpret the form):
//   • A single PANE OF GLASS WITH REAL THICKNESS (extruded rounded-rect Shape).
//   • A rounded-rect CUTOUT milled through the glass for EACH button.
//   • Each button is a ROUNDED-CORNERED CUBE seated in its cutout, sized so its
//     rotating diagonal stays inside the hole (never clips the glass on spin).
//   • On HOVER each cube spins end-over-end on its local X axis (~3.5 turns,
//     easeInOutCubic) — you SEE THROUGH the cutout as it turns edge-on.
//
// FOUNDER'S REFINEMENTS (this run):
//   1. Material reads as worn metal/stone (Iron-Man-armor finish) via real PBR
//      maps, not glossy plastic.
//   2. A FEW rich colors, GROUPED BY FUNCTION — one jewel-tone-metallic color per
//      logical category (Create / Transform / Scene / Logic / Output).
//   3. GRID layout in labeled SECTIONS (rows × columns per section).
//   4. SECTION LABELS ENGRAVED INTO THE GLASS (in-engine, never DOM).

// ── Button + pane geometry (units) ──────────────────────────────────────────
export const CUBE = 0.5; // rounded-cube side
export const CUBE_CORNER = 0.075; // rounded-cube corner radius

export const HOLE = 0.8; // cutout side (square-ish rounded rect)
export const HOLE_CORNER = 0.15; // cutout corner radius
export const CELL = 1.0; // grid pitch (center-to-center), both axes

// Invariant proof: the cube's rotating diagonal must clear the hole. The cube
// spins on its local X axis, so its projected HEIGHT grows to CUBE·√2 at 45°.
// half-diagonal = (CUBE/2)·√2 must stay < HOLE/2.
export const CUBE_HALF_DIAGONAL = (CUBE / 2) * Math.SQRT2; // ≈ 0.354
export const HOLE_HALF = HOLE / 2; // = 0.400 → 0.354 < 0.400 ✓ (never clips)

export const PANE_THICK = 0.4; // extrude depth — real glass thickness
export const PANE_CORNER = 0.34; // rounded outer corners (in-plane)
export const PANE_EDGE_BEVEL = 0.05; // front/back rim rounding (milled-glass feel)
export const FRONT_Z = PANE_THICK / 2; // world z of the front glass face

// ── Layout constants ────────────────────────────────────────────────────────
export const SECTION_GAP = 0.55; // horizontal gap between sections
export const SIDE_PAD = 0.65; // pane left/right padding
export const TOP_PAD = 0.45; // pane top padding (above the engraved labels)
export const BOTTOM_PAD = 0.5; // pane bottom padding
export const LABEL_BAND = 0.6; // height reserved for the engraved section label

// ── Functions, sections, palette ────────────────────────────────────────────
// The REAL canvas-editor toolbar (src/components/editor/overlays/CanvasToolbar.tsx)
// exposes 14 top-level functions. We group all 14 into 5 logical categories, each
// with ONE rich jewel-tone-metallic color that tints its worn-alloy plate.

export interface ChassisFn {
  id: string; // matches CanvasToolbar ToolGroupId
  label: string; // tooltip / human name
  /** abstract engraved face glyph (NOT emoji/Lucide — a milled mark) */
  glyph: FaceGlyph;
}

export type FaceGlyph =
  | 'move'
  | 'group'
  | 'plus'
  | 'layers'
  | 'image'
  | 'cube'
  | 'palette'
  | 'sparkle'
  | 'code'
  | 'text'
  | 'wand'
  | 'link'
  | 'bulb'
  | 'hammer';

export interface ChassisSection {
  id: string;
  label: string; // ENGRAVED into the glass above the grid
  /** worn-alloy PBR map key under /textures/chassis-worn/<key>-{albedo,rough,normal,metal,ao}.png */
  textureKey: string;
  /** jewel-tone-metallic tint multiplied over the worn albedo (the section color) */
  color: string;
  cols: number; // grid columns for this section
  fns: ChassisFn[];
}

// The curated palette — a fashionable jewel-tone-metallic family. One color per
// section; it tints the shared worn-alloy finish (deep-maroon worn alloy, etc.).
export const SECTIONS: ChassisSection[] = [
  {
    id: 'create',
    label: 'CREATE',
    textureKey: 'emerald',
    color: '#2f9e74', // deep emerald
    cols: 3,
    fns: [
      { id: 'add', label: 'Add', glyph: 'plus' },
      { id: 'library', label: 'Elements', glyph: 'layers' },
      { id: 'image', label: 'Image', glyph: 'image' },
      { id: 'object3d', label: '3D Object', glyph: 'cube' },
      { id: 'text', label: 'Text', glyph: 'text' },
    ],
  },
  {
    id: 'transform',
    label: 'TRANSFORM',
    textureKey: 'sapphire',
    color: '#3f6fd6', // deep sapphire
    cols: 2,
    fns: [
      { id: 'transform', label: 'Transform', glyph: 'move' },
      { id: 'selection', label: 'Selection', glyph: 'group' },
    ],
  },
  {
    id: 'scene',
    label: 'SCENE',
    textureKey: 'bronze',
    color: '#b07a36', // aged bronze / amber
    cols: 2,
    fns: [
      { id: 'background', label: 'Background', glyph: 'palette' },
      { id: 'lighting', label: 'Lighting', glyph: 'bulb' },
    ],
  },
  {
    id: 'logic',
    label: 'LOGIC',
    textureKey: 'oxblood',
    color: '#9c3447', // deep maroon / oxblood
    cols: 2,
    fns: [
      { id: 'promptEdit', label: 'Prompt Edit', glyph: 'code' },
      { id: 'changeArtifact', label: 'Change Artifact', glyph: 'sparkle' },
      { id: 'animation', label: 'Animation', glyph: 'wand' },
      { id: 'function', label: 'Function', glyph: 'link' },
    ],
  },
  {
    id: 'output',
    label: 'OUTPUT',
    textureKey: 'gunmetal',
    color: '#6b727c', // gunmetal
    cols: 1,
    fns: [{ id: 'build', label: 'Build', glyph: 'hammer' }],
  },
];

export const TEXTURE_DIR = '/prism-mock/editor/textures/chassis-worn';
export const ENV_MAP_URL = '/prism-mock/editor/env/studio.png';

// ── Spin mechanic (hover) ────────────────────────────────────────────────────
// On hover the cube spins end-over-end on its local X axis: 3.5 full rotations,
// accelerating then smoothly decelerating (easeInOutCubic) over ~1.15s. Because
// the cube is smaller than its cutout, you SEE THROUGH the hole to the backdrop
// as the cube turns edge-on — the signature reveal.
export const SPIN_TURNS = 3.5;
export const SPIN_DURATION = 1.15; // seconds

/** easeInOutCubic — accelerate, then smoothly decelerate. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Computed grid layout ─────────────────────────────────────────────────────
// One pass over SECTIONS produces every button's world position, every engraved
// label's position + size, and the pane dimensions. Coordinate frame: pane is
// centered at the origin, +x right, +y up, front face at +z (= FRONT_Z).

export interface PlacedButton {
  sectionId: string;
  fn: ChassisFn;
  color: string;
  textureKey: string;
  x: number;
  y: number;
}

export interface PlacedLabel {
  sectionId: string;
  text: string;
  x: number;
  y: number;
  width: number; // section grid width (for sizing the engraved type)
}

export interface ChassisLayout {
  paneW: number;
  paneH: number;
  maxRows: number;
  buttons: PlacedButton[];
  labels: PlacedLabel[];
}

function sectionRows(s: ChassisSection): number {
  return Math.ceil(s.fns.length / s.cols);
}

export function buildLayout(): ChassisLayout {
  const maxRows = Math.max(...SECTIONS.map(sectionRows));
  const gridBandH = maxRows * CELL;

  // Pane dimensions.
  const contentW =
    SECTIONS.reduce((w, s) => w + s.cols * CELL, 0) + SECTION_GAP * (SECTIONS.length - 1);
  const paneW = contentW + SIDE_PAD * 2;
  const paneH = TOP_PAD + LABEL_BAND + gridBandH + BOTTOM_PAD;
  const halfH = paneH / 2;

  // Vertical bands (y, pane-centered).
  const labelTopY = halfH - TOP_PAD; // top of the engraved-label band
  const labelY = labelTopY - LABEL_BAND * 0.5; // engraved label baseline center
  const gridTopY = labelTopY - LABEL_BAND; // top of the grid band
  const gridBandCenterY = gridTopY - gridBandH / 2;

  const buttons: PlacedButton[] = [];
  const labels: PlacedLabel[] = [];

  // Walk sections left→right.
  let cursorX = -contentW / 2; // left edge of the current section
  for (const s of SECTIONS) {
    const sectionW = s.cols * CELL;
    const centerX = cursorX + sectionW / 2;
    const rows = sectionRows(s);
    // Vertically center this section's grid within the common grid band.
    const topRowY = gridBandCenterY + ((rows - 1) / 2) * CELL;

    s.fns.forEach((fn, i) => {
      const row = Math.floor(i / s.cols);
      // buttons in this row (last row may be partial → centered)
      const rowCount = Math.min(s.cols, s.fns.length - row * s.cols);
      const colInRow = i - row * s.cols;
      const rowLeftOffset = (s.cols - rowCount) / 2; // center a partial row
      const x = cursorX + CELL / 2 + (colInRow + rowLeftOffset) * CELL;
      const y = topRowY - row * CELL;
      buttons.push({ sectionId: s.id, fn, color: s.color, textureKey: s.textureKey, x, y });
    });

    labels.push({ sectionId: s.id, text: s.label, x: centerX, y: labelY, width: sectionW });
    cursorX += sectionW + SECTION_GAP;
  }

  return { paneW, paneH, maxRows, buttons, labels };
}

export const LAYOUT = buildLayout();
