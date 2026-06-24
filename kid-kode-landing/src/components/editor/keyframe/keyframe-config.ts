// PRISM KEYFRAME EDITOR — locked geometry + track model, in the EXACT design
// language of the founder-approved Toolbar Chassis (route /toolbar-chassis):
// a single thick PANE OF GLASS with REAL THICKNESS, channels MILLED into it
// (true ExtrudeGeometry cuts — no painted lines), worn-metal CUBE knobs seated
// in the channels, and section/track labels ENGRAVED into the glass.
//
// This is the timeline surface of a keyframe / animation editor. The horizontal
// axis is TIME (in SECONDS, never fps). Stacked horizontal grooves are tracks:
//   • the TOP groove is the TIME RULER — the worn-cube PLAYHEAD knob rides it,
//     its x mapped from the current playhead time; a thin vertical worn-metal
//     bar drops from it and sweeps ACROSS the lower grooves as time advances.
//   • each lower groove is one ANIMATABLE PROPERTY of the selected node — a
//     worn-cube FADER knob rides it, its x mapped from the property VALUE.
//     Dragging the fader writes a keyframe at the playhead time and the bound
//     node property updates live; scrubbing the playhead glides every fader to
//     its interpolated value and the bound node animates.
//
// Isolated WebGL editor-chrome (the proven Glb3DPreview / toolbar-chassis idiom
// — never the unified three/webgpu graph scene). Single source of truth for the
// surface's world dimensions, track palette, and the computed layout.

import type { PrismKeyframe, PrismKeyframeCoordinateSpace } from '@/lib/prism-graph/types';

// ── Pane geometry (world units; pane centered at origin, +x right, +y up) ─────
export const PANE_W = 14.4;
export const PANE_THICK = 0.4; // extrude depth — real glass thickness (matches chassis)
export const PANE_CORNER = 0.36; // rounded outer corners (in-plane)
export const PANE_EDGE_BEVEL = 0.05; // front/back rim rounding (milled-glass feel)
export const FRONT_Z = PANE_THICK / 2; // world z of the front glass face

// ── Track / groove geometry ───────────────────────────────────────────────────
export const CHANNEL_H = 0.72; // milled-channel height (per track)
export const CHANNEL_CORNER = 0.18; // channel end-cap radius
export const ROW_PITCH = 1.18; // center-to-center between stacked tracks
export const LABEL_GUTTER = 2.85; // left gutter reserved for the engraved track label
export const SIDE_PAD = 0.62; // pane left/right padding
export const TOP_PAD = 0.62; // pane top padding
export const BOTTOM_PAD = 0.78; // pane bottom padding (engraved title band)

// ── Knob (worn-cube) geometry ──────────────────────────────────────────────────
// Smaller than the chassis button cube. Spins end-over-end on hover (local X),
// so its vertical extent grows to CUBE_K·√2 at 45° — must clear CHANNEL_H.
export const CUBE_K = 0.44;
export const CUBE_K_CORNER = 0.07;
export const CUBE_K_HALF_DIAGONAL = (CUBE_K / 2) * Math.SQRT2; // ≈ 0.311
//   CUBE_K·√2 = 0.622  <  CHANNEL_H = 0.72  → the hover-spin never clips ✓

// ── Timeline ───────────────────────────────────────────────────────────────────
export const DURATION_S = 4; // total timeline length, in SECONDS
export const PLAYHEAD_W = 0.07; // thin vertical scrubber bar (in-plane)

// ── Hover-spin mechanic (reused from the chassis cube) ──────────────────────────
export const SPIN_TURNS = 2.5;
export const SPIN_DURATION = 1.0; // seconds
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Worn-alloy PBR sets live under this dir (shared with the chassis).
export const TEXTURE_DIR = '/prism-mock/editor/textures/chassis-worn';
export const ENV_MAP_URL = '/prism-mock/editor/env/studio.png';
export const FONT_URL = '/fonts/Inter-Variable.ttf';

// ── Animatable property tracks ──────────────────────────────────────────────────
// Each track binds to one numeric property of the selected node. The worn-alloy
// `textureKey` (a chassis jewel-tone set) tints its fader knob; `min`/`max` map a
// value to a horizontal position along the groove.
export interface TrackDef {
  id: string; // property key on the node (e.g. 'posY')
  label: string; // ENGRAVED into the glass at the groove's left
  textureKey: string; // worn-alloy PBR set (emerald|sapphire|bronze|oxblood|gunmetal)
  min: number;
  max: number;
  unit?: string; // engraved value hint
}

export const TRACKS: TrackDef[] = [
  { id: 'posY', label: 'RISE', textureKey: 'sapphire', min: -1.5, max: 1.5 },
  { id: 'scale', label: 'SCALE', textureKey: 'emerald', min: 0.35, max: 1.85 },
  { id: 'rotZ', label: 'SPIN', textureKey: 'bronze', min: -Math.PI, max: Math.PI, unit: 'rad' },
  { id: 'opacity', label: 'FADE', textureKey: 'oxblood', min: 0.12, max: 1 },
];

export const TRACK_IDS = TRACKS.map((t) => t.id);

// The default rest value for each property (the node's identity pose).
export const TRACK_REST: Record<string, number> = {
  posY: 0,
  scale: 1,
  rotZ: 0,
  opacity: 1,
};

// Coordinate space for the node's keyframes (INV-21 — every PrismKeyframe MUST
// declare one of the canonical 5). These keyframes animate a node-local transform
// within the scene, so they live in 'hub-scene'.
export const KEYFRAME_SPACE: PrismKeyframeCoordinateSpace = 'hub-scene';

// ── Computed layout ─────────────────────────────────────────────────────────────
export interface PlacedTrack extends TrackDef {
  rowIndex: number;
  y: number; // groove center y (pane-centered)
}

export interface KeyframeLayout {
  paneW: number;
  paneH: number;
  trackLeftX: number; // left end of the live track span (value/time = min)
  trackRightX: number; // right end (value/time = max)
  trackSpan: number;
  rulerY: number; // the TIME ruler groove center y
  tracks: PlacedTrack[];
  bottomBandY: number; // engraved title baseline
  subjectY: number; // bound-node anchor (above the pane)
}

export function buildLayout(): KeyframeLayout {
  const paneW = PANE_W;
  const rowCount = TRACKS.length + 1; // +1 ruler
  const bandH = rowCount * ROW_PITCH;
  const paneH = TOP_PAD + bandH + BOTTOM_PAD;
  const halfH = paneH / 2;

  const trackLeftX = -paneW / 2 + SIDE_PAD + LABEL_GUTTER;
  const trackRightX = paneW / 2 - SIDE_PAD;
  const trackSpan = trackRightX - trackLeftX;

  // Rows top→bottom: ruler first, then property tracks.
  const firstRowY = halfH - TOP_PAD - ROW_PITCH / 2;
  const rulerY = firstRowY;

  const tracks: PlacedTrack[] = TRACKS.map((t, i) => ({
    ...t,
    rowIndex: i + 1,
    y: firstRowY - (i + 1) * ROW_PITCH,
  }));

  const bottomBandY = -halfH + BOTTOM_PAD * 0.5;
  const subjectY = halfH + 1.85;

  return {
    paneW,
    paneH,
    trackLeftX,
    trackRightX,
    trackSpan,
    rulerY,
    tracks,
    bottomBandY,
    subjectY,
  };
}

export const LAYOUT = buildLayout();

// ── Axis mappings ───────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** property value → world x along its groove */
export function valueToX(track: TrackDef, value: number): number {
  const k = (clamp(value, track.min, track.max) - track.min) / (track.max - track.min);
  return LAYOUT.trackLeftX + k * LAYOUT.trackSpan;
}

/** world x along a groove → property value */
export function xToValue(track: TrackDef, x: number): number {
  const k = clamp((x - LAYOUT.trackLeftX) / LAYOUT.trackSpan, 0, 1);
  return track.min + k * (track.max - track.min);
}

/** playhead time (seconds) → world x along the ruler */
export function timeToX(timeS: number): number {
  const k = clamp(timeS / DURATION_S, 0, 1);
  return LAYOUT.trackLeftX + k * LAYOUT.trackSpan;
}

/** world x along the ruler → playhead time (seconds) */
export function xToTime(x: number): number {
  const k = clamp((x - LAYOUT.trackLeftX) / LAYOUT.trackSpan, 0, 1);
  return k * DURATION_S;
}

export type { PrismKeyframe };
