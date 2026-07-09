// THREE-D-BACKGROUNDS — preset registry contract (D6).
//
// A background-library entry is a NAMED preset that emits a typed, parameterized
// LAYER STACK (PrismHubBackgroundLayer[]) bound to `PrismHub.background` (A6).
// Each preset declares the customizable controls the Inspector renders and a
// pure `build(params)` that produces the layer stack. Everything is DATA: the
// same schema the editor writes is what the runtime reads (INV-4).

import type {
  PrismHubBackgroundLayer,
  BackgroundLayerParams,
  LightingTier,
} from "../../prism-graph/types";

// ── W-BG catalog metadata ────────────────────────────────────────────────────
// The library grew from 5 presets to a categorized 50+ catalog. Every entry
// carries the catalog axes the picker filters/searches on. All DATA — no
// behaviour lives here.

/** Picker category (one per entry; the picker groups by this). */
export type BackgroundCategoryId =
  | "nebulae" // volumetric gas + light volumes in depth
  | "particles" // scattered fields: stars, embers, motes, weather
  | "deep-space" // starfield deep-dives (far-Z dense fields + travel)
  | "gradient-light" // gradient-light volumes: washes, beams, aurora, horizon
  | "fluid" // fluid overlays: silk, ink, caustic, smoke
  | "plates" // graded cinematic photo plates (R2/R3), depth-parallaxed
  | "captured" // captured 3D scenes (gaussian splat)
  | "minimal"; // flat/2d-native: quiet washes, grain, paper — 2d-first

export const BACKGROUND_CATEGORY_IDS: readonly BackgroundCategoryId[] =
  Object.freeze([
    "nebulae",
    "particles",
    "deep-space",
    "gradient-light",
    "fluid",
    "plates",
    "captured",
    "minimal",
  ] as const);

export const BACKGROUND_CATEGORY_LABELS: Readonly<
  Record<BackgroundCategoryId, string>
> = Object.freeze({
  nebulae: "Nebulae & Volumes",
  particles: "Particles & Stars",
  "deep-space": "Deep Space",
  "gradient-light": "Gradient Light",
  fluid: "Fluid & Silk",
  plates: "Cinematic Plates",
  captured: "Captured Scenes",
  minimal: "Minimal & Flat",
});

/** Motion character — how the background MOVES (a search/filter axis). */
export type BackgroundMotionTag =
  "still" | "calm" | "drift" | "flow" | "pulse" | "energetic";

export const BACKGROUND_MOTION_TAGS: readonly BackgroundMotionTag[] =
  Object.freeze([
    "still",
    "calm",
    "drift",
    "flow",
    "pulse",
    "energetic",
  ] as const);

/** Hub render-mode fitness (W-2D honesty law: '2d' is AFFIRMATIVE — an entry
 *  is only offered on a flat hub when it explicitly carries '2d'). */
export type BackgroundRenderModeTag = "2d" | "3d";

export interface BackgroundParamControl {
  id: keyof BackgroundLayerParams | string;
  label: string;
  type: "knob" | "slider" | "select";
  /** knob/slider range. */
  min?: number;
  max?: number;
  step?: number;
  /** select options. */
  options?: { value: string; label: string }[];
  default: number | string;
}

export interface BackgroundPreset {
  id: string;
  name: string;
  description: string;
  /** One-line tag shown on the picker card (e.g. "warm forge nebula"). */
  tagline: string;
  /** Customizable controls the Inspector renders for this preset. */
  controls: BackgroundParamControl[];
  /** Default params (must satisfy the control defaults). */
  defaultParams: BackgroundLayerParams;
  /** Pure: emit the layer stack for the given params. Deterministic — same
   *  params always produce the same (id-stable) stack so re-apply updates in
   *  place and save/reload round-trips. */
  build(params: BackgroundLayerParams): PrismHubBackgroundLayer[];

  // ── W-BG catalog axes (required on every library entry) ──────────────────
  /** Picker category (single home; search crosses categories). */
  category: BackgroundCategoryId;
  /** Motion character of the composed stack. */
  motion: BackgroundMotionTag;
  /** Hub render-mode fitness. '2d' is affirmative (W-2D honesty law): only
   *  entries tagged '2d' are offered on flat hubs. Every entry lists '3d'
   *  unless it is genuinely depth-meaningless. */
  renderModes: readonly BackgroundRenderModeTag[];
  /** Recommended MINIMUM device tier ('T0' runs everywhere; 'T2' means the
   *  full look needs desktop/WebGPU — lower tiers get the budgeted fallback,
   *  never a hard error). */
  perfTier: LightingTier;
  /** design-grammar family id this entry is derived from (grounded original —
   *  legal doctrine §2: derived from the FAMILY's technique vocabulary, never
   *  a copy of a source). */
  grammarFamily: string;
  /** Free search keywords beyond name/tagline (moods, colours, subjects). */
  keywords: readonly string[];
  /** Baked real-render thumbnail (public URL). Absent → CSS swatch fallback. */
  thumbUrl?: string;
}
