// PRISM TOOLBAR CHASSIS — locked geometry + material language (founder's vision).
//
// This is the single source of truth for the chassis's world dimensions and the
// editorial stone/metal palette. The chassis is a REVIEWABLE object built in the
// app's R3F/Three engine (isolated WebGL canvas, the proven Glb3DPreview idiom —
// it never touches the unified three/webgpu graph scene). It does NOT replace the
// production toolbar; the founder approves the chassis first.
//
// THE LOCKED VISION (do not reinterpret the form):
//   • A single PANE OF GLASS WITH REAL THICKNESS — a thick slab (extrude depth
//     ~0.40, rounded outer corners ~0.34) built from an extruded rounded-rect.
//   • A rectangular CUTOUT milled through the glass for EACH button — rounded-rect
//     holes (~0.98 × 0.98, corner ~0.17), in a row, pitch ~1.22.
//   • Each button is a ROUNDED-CORNERED CUBE (side ~0.58, corner ~0.085) of a
//     curated editorial stone or metal, seated in its cutout — sized so its
//     rotating diagonal stays inside the hole and it never clips the glass during
//     the hover spin (cube half-side × √2 < hole half-height).

// ── World geometry (units) ──────────────────────────────────────────────────
export const PANE_W = 8.3; // glass pane width
export const PANE_H = 2.3; // glass pane height (single editorial row)
export const PANE_THICK = 0.4; // extrude depth — real glass thickness
export const PANE_CORNER = 0.34; // rounded outer corners (in-plane)
export const PANE_EDGE_BEVEL = 0.05; // front/back rim rounding (milled-glass feel)

export const HOLE = 0.98; // cutout side (square-ish rounded rect)
export const HOLE_CORNER = 0.17; // cutout corner radius
export const PITCH = 1.22; // center-to-center spacing of the cutout row

export const CUBE = 0.58; // rounded-cube side
export const CUBE_CORNER = 0.085; // rounded-cube corner radius

// Invariant proof (kept here so it is unmissable): the cube's rotating diagonal
// must clear the hole. half-diagonal = (CUBE/2)·√2 must be < HOLE/2.
export const CUBE_HALF_DIAGONAL = (CUBE / 2) * Math.SQRT2; // ≈ 0.410
export const HOLE_HALF = HOLE / 2; // = 0.490  → 0.410 < 0.490 ✓ (never clips)

export type ChassisMaterialKind = 'stone' | 'metal';

export interface ChassisButton {
  id: string;
  label: string;
  kind: ChassisMaterialKind;
  /** stone: albedo texture key under /textures/chassis/<key>.png */
  textureKey?: string;
  /** metal: base reflectance color */
  color?: string;
  roughness?: number;
  /** brushed-metal directional streak (0 = isotropic) */
  anisotropy?: number;
  /** abstract geometric placeholder mark engraved on the cube faces */
  mark: 'ring' | 'square' | 'triangle' | 'bars' | 'dot-grid' | 'chevron';
}

// The curated, editorial, fashionable palette — NOT candy colors. Carrara marble,
// black onyx, malachite, then brass, brushed steel, copper. One distinct material
// per cutout so the chassis reads as a material-language review piece.
export const CHASSIS_BUTTONS: ChassisButton[] = [
  { id: 'carrara', label: 'Carrara', kind: 'stone', textureKey: 'carrara', mark: 'ring' },
  { id: 'onyx', label: 'Black Onyx', kind: 'stone', textureKey: 'onyx', mark: 'square' },
  { id: 'malachite', label: 'Malachite', kind: 'stone', textureKey: 'malachite', mark: 'triangle' },
  { id: 'brass', label: 'Brass', kind: 'metal', color: '#b5894e', roughness: 0.26, anisotropy: 0, mark: 'bars' },
  { id: 'steel', label: 'Brushed Steel', kind: 'metal', color: '#c7ccd2', roughness: 0.4, anisotropy: 0.85, mark: 'dot-grid' },
  { id: 'copper', label: 'Copper', kind: 'metal', color: '#b56a40', roughness: 0.3, anisotropy: 0, mark: 'chevron' },
];

/** World-X of cutout / button `i` (0 = leftmost), row centered on x=0. */
export function buttonX(i: number, n: number): number {
  return (i - (n - 1) / 2) * PITCH;
}

// ── Spin mechanic (hover) ─────────────────────────────────────────────────────
// On hover the cube spins end-over-end on its local X axis: 3.5 full rotations,
// accelerating then smoothly decelerating (easeInOutCubic) over ~1.15s. Because
// the cube is smaller than the cutout, you SEE THROUGH the hole to the backdrop
// as the cube turns edge-on — the signature reveal.
export const SPIN_TURNS = 3.5;
export const SPIN_DURATION = 1.15; // seconds

/** easeInOutCubic — accelerate, then smoothly decelerate. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Environment + backdrop ────────────────────────────────────────────────────
export const ENV_MAP_URL = '/prism-mock/editor/env/studio.png'; // equirect studio map
export const TEXTURE_DIR = '/prism-mock/editor/textures/chassis';
