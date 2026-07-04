// Vertical chassis layout for the in-canvas toolbar. Reuses the chassis CUBE
// + HOLE geometry constants and the per-section function map, but lays the
// sections out top-to-bottom in a single column (the canvas toolbar is a
// vertical rail, not a horizontal dock).
//
// The 14 functions stay grouped into the 5 founder-approved sections so each
// button's accent color groups it visually; an engraved section label sits
// above each group.

import {
  CUBE,
  CELL,
  HOLE,
  SECTIONS,
  type ChassisFn,
  type ChassisSection,
} from '../chassis/chassis-config';

export { CUBE, HOLE };

// Single-column geometry. The rail is narrow → one button per row, with a
// short label band between sections.
export const VCOL_PANE_W = HOLE + 0.5; // pane width: cutout + side glass
export const VCOL_CELL = CELL; // vertical pitch between buttons
export const VCOL_LABEL_BAND = 0.55; // height reserved for an engraved section label
export const VCOL_TOP_PAD = 0.35;
export const VCOL_BOTTOM_PAD = 0.35;
export const VCOL_SIDE_PAD = (VCOL_PANE_W - HOLE) / 2;

export const VCOL_PANE_THICK = 0.4;
export const VCOL_PANE_CORNER = 0.18;
export const VCOL_PANE_EDGE_BEVEL = 0.05;
export const VCOL_FRONT_Z = VCOL_PANE_THICK / 2;

export interface VPlacedButton {
  sectionId: string;
  fn: ChassisFn;
  color: string;
  textureKey: string;
  /** world y of the button's center (top = positive, bottom = negative) */
  y: number;
}

export interface VPlacedLabel {
  sectionId: string;
  text: string;
  y: number;
  width: number;
}

export interface VerticalLayout {
  paneW: number;
  paneH: number;
  buttons: VPlacedButton[];
  labels: VPlacedLabel[];
}

/** Build the vertical layout. Sections appear in chassis-config order; each
 *  section's label sits above its buttons (engraved into the glass). */
export function buildVerticalLayout(): VerticalLayout {
  // Total height = top pad + sum(label + button_count * cell) + bottom pad
  let contentH = 0;
  for (const s of SECTIONS) {
    contentH += VCOL_LABEL_BAND + s.fns.length * VCOL_CELL;
  }
  const paneH = VCOL_TOP_PAD + contentH + VCOL_BOTTOM_PAD;
  const halfH = paneH / 2;

  const buttons: VPlacedButton[] = [];
  const labels: VPlacedLabel[] = [];

  // Walk sections top→bottom, placing label, then its buttons.
  let cursorY = halfH - VCOL_TOP_PAD; // top of the first label band
  for (const s of SECTIONS) {
    // Label center is in the middle of the label band.
    const labelY = cursorY - VCOL_LABEL_BAND / 2;
    labels.push({ sectionId: s.id, text: s.label, y: labelY, width: HOLE * 0.9 });
    cursorY -= VCOL_LABEL_BAND;

    // Buttons fill cells going down from cursorY.
    s.fns.forEach((fn, i) => {
      const y = cursorY - VCOL_CELL / 2 - i * VCOL_CELL;
      buttons.push({ sectionId: s.id, fn, color: s.color, textureKey: s.textureKey, y });
    });
    cursorY -= s.fns.length * VCOL_CELL;
  }

  return { paneW: VCOL_PANE_W, paneH, buttons, labels };
}

export const VLAYOUT = buildVerticalLayout();

/** Lookup a button by its tool id (matches CanvasToolbar's ToolGroupId). */
export function findButtonByToolId(id: string): VPlacedButton | undefined {
  return VLAYOUT.buttons.find((b) => b.fn.id === id);
}

/** Find which section a tool id belongs to. */
export function sectionForToolId(id: string): ChassisSection | undefined {
  return SECTIONS.find((s) => s.fns.some((f) => f.id === id));
}
