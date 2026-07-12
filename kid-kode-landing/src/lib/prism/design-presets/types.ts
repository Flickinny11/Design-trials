// W-VIS D3 — design-preset libraries: first-class numeric presets that kill
// FLAT_VOID and DEAD_LIGHTING at the source. Instead of every generator
// inventing lighting/camera/composition numbers from prose, the design
// director SELECTS from render-proven presets and the generator receives the
// exact numbers. Freeform numbers remain the fallback, never the default.
//
// Catalog discipline (I-V2, per W-BG): every entry is render-proven with a
// committed thumb before it may ship. `thumbUrl` points at the committed
// proof render under /design-presets/thumbs/ — no entry without one.
//
// Coordinate convention: light/camera positions are SUBJECT-RELATIVE, in
// units of the subject's bounding radius (a preset consumer multiplies by
// the actual subject radius; the proof scenes use radius 1). +Y is up, +Z is
// toward the default camera.

export type PresetMood =
  | 'dramatic' | 'clinical' | 'warm' | 'editorial' | 'noir' | 'gallery'
  | 'product' | 'soft' | 'signal' | 'monumental' | 'quiet' | 'kinetic';

export interface PresetLightDef {
  /** Rig role — key/fill/rim are the doctrine trio; extras are named. */
  role: 'key' | 'fill' | 'rim' | 'ambient' | 'practical' | 'kicker';
  type: 'directional' | 'point' | 'spot' | 'ambient' | 'hemisphere';
  /** Hex color. DL2 palette-safe: whites, warm whites, signal red. */
  color: string;
  intensity: number;
  /** Subject-relative position (units of subject bounding radius). */
  position?: [number, number, number];
  /** Aim point, subject-relative. */
  target?: [number, number, number];
  distance?: number;
  decay?: number;
  /** Spot cone half-angle, radians. */
  angle?: number;
  penumbra?: number;
}

export interface LightRigPreset {
  id: string;
  name: string;
  moods: PresetMood[];
  /** What the rig is FOR — one sentence the director reads when selecting. */
  intent: string;
  lights: PresetLightDef[];
  /** Global ambient floor 0..1 (0 = pitch dark shadow side). */
  ambientFloor: number;
  /** Committed proof render (required before ship — I-V2). */
  thumbUrl?: string;
}

export interface CameraFramingPreset {
  id: string;
  name: string;
  moods: PresetMood[];
  intent: string;
  /** Vertical FOV, degrees. */
  fov: number;
  /** Subject-relative camera position (units of subject bounding radius). */
  position: [number, number, number];
  /** Subject-relative look-at point. */
  lookAt: [number, number, number];
  /** Fraction of frame height the subject should occupy (composition check). */
  subjectHeightFraction: number;
  thumbUrl?: string;
}

export type CompositionSpan = '2d' | '3d' | 'both';

export interface CompositionRegion {
  role: 'subject' | 'headline' | 'body' | 'caption' | 'cta' | 'accent' | 'negative' | 'media' | 'nav';
  /** Normalized frame rect [x, y, w, h], origin top-left, 0..1. */
  rect: [number, number, number, number];
  /** 3d layouts: depth offset in subject radii (negative = behind subject plane). */
  depth?: number;
  note?: string;
}

export interface CompositionLayoutPreset {
  id: string;
  name: string;
  span: CompositionSpan;
  moods: PresetMood[];
  intent: string;
  regions: CompositionRegion[];
  /** The single brightest element, decided in advance (playbook §3.1). */
  focalRole: CompositionRegion['role'];
  thumbUrl?: string;
}

/** The L3 schema carrier lives at the schema level (prism-graph/types.ts,
 *  additive on PrismVisualSpec.presetSelections) — re-exported here so preset
 *  consumers have one import surface. */
export type { PrismPresetSelections } from '@/lib/prism-graph/types';
