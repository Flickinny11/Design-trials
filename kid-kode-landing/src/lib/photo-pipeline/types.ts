// PHOTO-PIPELINE — the R2 photographic-composite manifest (W-PHOTO D2).
//
// The industry's photoreal web method (PRISM-DESIGN-SUPREMACY-PLAN §1,
// design-grammar/observations/layered-photo-product-hero.md): realism lives in
// the SOURCE IMAGERY + detached shadow + grade, not in geometry. A composite is
// produced by the pipeline (generate → cutout → depth → shadow plate → relight →
// grade) and described by a CompositeManifest — a browser-safe JSON the runtime
// `layered-photo-scene` primitive reads to assemble the layered parallax scene.
//
// This file is PURE TYPES (no sharp / no node) so both the runtime primitive and
// the build orchestrator can import it. Provenance is first-class (I-PROVENANCE):
// every stage records whether it ran a hosted model or a local deterministic pass.

/** Layer roles, back-to-front (the 6-layer z-order from the observation seed). */
export type LayerKind =
  | "backdrop" // full-bleed moody plate (may carry a depth map for parallax)
  | "headline" // oversized display type, INTERLEAVED behind the product
  | "product" // the photographic hero CUTOUT (transparent)
  | "shadow" // the detached soft shadow plate under the product
  | "garnish" // floating ingredient/detail cutouts at varied scale/blur
  | "foreground-glow"; // bloom / particle / lens veil on top

export interface FloatLoop {
  /** Independent idle-float amplitudes (scene units) + rotation (radians). */
  ampX: number;
  ampY: number;
  rotate: number;
  /** Loop period in seconds; phase offsets each garnish so they never sync. */
  period: number;
  phase: number;
}

export interface CompositeLayer {
  id: string;
  kind: LayerKind;
  /** Public path to the baked plate (PNG; product/shadow/garnish carry alpha). */
  assetUrl: string;
  /** Optional depth map (backdrop) → drives tessellated parallax-plane depth. */
  depthMapUrl?: string;
  /** Z-order depth (more negative = further back). */
  z: number;
  /** Base position within the frame (scene units); defaults to 0,0 (centre). */
  x?: number;
  y?: number;
  /** Parallax rate: 0 = locked to camera, 1 = full scene depth reaction. */
  parallaxRate: number;
  /** Per-layer independent idle float (garnish + product bob). Omit = static. */
  float?: FloatLoop;
  scale: number;
  /** Depth-of-field blur in px baked into the plate (garnish separation). */
  blur?: number;
  opacity?: number;
  /** Optional caption text for a `headline` layer (rendered as MSDF, not baked). */
  text?: string;
}

export type CompositeStage =
  "generate" | "cutout" | "depth" | "shadow-plate" | "relight" | "grade";

export interface StageProvenance {
  stage: CompositeStage;
  /** 'live' = a hosted model ran; 'local' = a deterministic in-repo pass. */
  mode: "live" | "local";
  provider?: "replicate" | "local" | "fal" | "tripo";
  model?: string;
  predictionId?: string;
  /** Seconds of model predict time (from Replicate metrics), when live. */
  predictTime?: number;
  costUsd?: number;
  costEstimated?: boolean;
  note?: string;
}

/** Deterministic filmic grade baked into the plates at pipeline time (DEV-6). */
export interface GradeSpec {
  /** Shadow tint (RGB multipliers around 1.0). */
  lift: [number, number, number];
  gamma: number;
  /** Highlight tint (RGB multipliers around 1.0). */
  gain: [number, number, number];
  saturation: number;
  contrast: number;
  /** 0..1 edge darkening. */
  vignette: number;
}

export interface CompositeManifest {
  schemaVersion: "prism-photo-v1";
  id: string;
  createdAt: string;
  route: "R2";
  /** The single saturated brand hue for this state (palette discipline). */
  themeHue: string;
  layers: CompositeLayer[];
  provenance: StageProvenance[];
  grade: GradeSpec;
}

export const PHOTO_MANIFEST_SCHEMA = "prism-photo-v1" as const;
