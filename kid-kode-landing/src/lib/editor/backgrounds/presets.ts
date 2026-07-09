// THREE-D-BACKGROUNDS — launch preset library (D6 / A6).
//
// Each preset is a droppable, customizable asset that writes a layer STACK onto
// `PrismHub.background`. The stack is composited back-to-front by the R3F render
// layer (P1+): far volumetric env → depth-scattered particle field → near
// camera-locked motes (+ optional splat on Observatory Deep, P3). Every layer is
// camera-journey-ready because it lives in scene Z and is read against the hub's
// `cameraKeyframes` journey — no special-casing (D5).
//
// Pure DATA + pure builders: `build(params)` is deterministic and id-stable so
// re-applying a preset with new params updates layers in place and save/reload
// round-trips (C9/C10).

import type {
  PrismHubBackgroundLayer,
  BackgroundLayerParams,
} from "../../prism-graph/types";
import type { BackgroundPreset, BackgroundParamControl } from "./types";
import { BACKGROUND_PALETTE_IDS, getBackgroundPalette } from "./palettes";

// Shared control set — every preset exposes the same four live knobs plus its
// palette select (the palette OPTIONS differ per preset so each stays on-brand).
function sharedControls(
  paletteOptions: { value: string; label: string }[],
  defaultPalette: string,
): BackgroundParamControl[] {
  return [
    {
      id: "palette",
      label: "Palette",
      type: "select",
      options: paletteOptions,
      default: defaultPalette,
    },
    {
      id: "density",
      label: "Density",
      type: "slider",
      min: 0.15,
      max: 1,
      step: 0.01,
      default: 0.6,
    },
    {
      id: "drift",
      label: "Drift",
      type: "slider",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
    },
    {
      id: "depthSpread",
      label: "Depth",
      type: "slider",
      min: 0.2,
      max: 1,
      step: 0.01,
      default: 0.6,
    },
    {
      id: "intensity",
      label: "Glow",
      type: "slider",
      min: 0.2,
      max: 1,
      step: 0.01,
      default: 0.7,
    },
  ];
}

const ALL_PALETTE_OPTIONS = BACKGROUND_PALETTE_IDS.map((id) => ({
  value: id,
  label: getBackgroundPalette(id).label,
}));

/** Merge user params over a preset's defaults (defaults fill any missing key). */
export function mergeParams(
  preset: BackgroundPreset,
  params?: BackgroundLayerParams,
): BackgroundLayerParams {
  return { ...preset.defaultParams, ...(params ?? {}) };
}

// ── Brass Nebula ─────────────────────────────────────────────────────────────
const brassNebula: BackgroundPreset = {
  id: "brass-nebula",
  category: "nebulae",
  motion: "drift",
  renderModes: ["3d"],
  perfTier: "T1",
  grammarFamily: "particle-field-hero",
  keywords: ["chrome", "forge", "gas", "clouds", "embers", "atmosphere"],
  name: "Brass Nebula",
  description:
    "A warm forge nebula: brass gas clouds raymarched in depth, drifting embers scattered through real Z, and fine motes near the lens.",
  tagline: "warm forge nebula",
  controls: sharedControls(ALL_PALETTE_OPTIONS, "brass"),
  defaultParams: {
    palette: "brass",
    density: 0.5,
    drift: 0.5,
    depthSpread: 0.65,
    intensity: 0.56,
  },
  build(params) {
    const p = { ...this.defaultParams, ...params };
    return [
      {
        id: "brass-nebula-env",
        attachment: "infinite-environment",
        kind: "volumetric-nebula",
        z: -400,
        opacity: 1,
        parallaxDepth: 0.95,
        presetId: this.id,
        params: p,
      },
      {
        id: "brass-nebula-scatter",
        attachment: "world",
        kind: "particle-field",
        z: -150,
        opacity: 1,
        parallaxDepth: 0.6,
        presetId: this.id,
        params: { ...p, variant: "embers" },
      },
      {
        id: "brass-nebula-motes",
        attachment: "camera-locked",
        kind: "particle-field",
        z: -30,
        opacity: 0.8,
        parallaxDepth: 0.1,
        presetId: this.id,
        params: { ...p, variant: "motes", density: (p.density ?? 0.6) * 0.4 },
      },
    ];
  },
};

// ── Ice Field ────────────────────────────────────────────────────────────────
const iceField: BackgroundPreset = {
  id: "ice-field",
  category: "nebulae",
  motion: "calm",
  renderModes: ["3d"],
  perfTier: "T1",
  grammarFamily: "particle-field-hero",
  keywords: ["ice", "cold", "crystal", "clean", "calm", "informational"],
  name: "Ice Field",
  description:
    "A cold, clean field: thin ice-blue volumetrics, a bright scattered crystal starfield, and a crisp deep base — informational and calm.",
  tagline: "cold crystal field",
  controls: sharedControls(ALL_PALETTE_OPTIONS, "ice"),
  defaultParams: {
    palette: "ice",
    density: 0.38,
    drift: 0.32,
    depthSpread: 0.7,
    intensity: 0.6,
  },
  build(params) {
    const p = { ...this.defaultParams, ...params };
    return [
      {
        id: "ice-field-env",
        attachment: "infinite-environment",
        kind: "volumetric-nebula",
        z: -420,
        opacity: 1,
        parallaxDepth: 0.96,
        presetId: this.id,
        params: p,
      },
      {
        id: "ice-field-scatter",
        attachment: "world",
        kind: "particle-field",
        z: -160,
        opacity: 1,
        parallaxDepth: 0.62,
        presetId: this.id,
        params: {
          ...p,
          variant: "crystals",
          density: Math.min(1, (p.density ?? 0.42) + 0.25),
        },
      },
    ];
  },
};

// ── Observatory Deep ─────────────────────────────────────────────────────────
// Deep graphite void with a brass core glow and a dense deep starfield. A
// Gaussian-splat "captured environment" layer is grafted in P3 (desktop/T2 only,
// minTier 'T2'); until then this is the procedural deep-space preset.
const observatoryDeep: BackgroundPreset = {
  id: "observatory-deep",
  category: "deep-space",
  motion: "calm",
  renderModes: ["3d"],
  perfTier: "T1",
  grammarFamily: "parallax-zoom-deep-dive",
  keywords: ["space", "void", "stars", "deep", "graphite", "observatory"],
  name: "Observatory Deep",
  description:
    "Deep space from the observatory: a graphite void with a slow brass core glow and a dense, far-scattered starfield. Splat-ready on desktop.",
  tagline: "deep graphite void",
  controls: sharedControls(ALL_PALETTE_OPTIONS, "deep"),
  defaultParams: {
    palette: "deep",
    density: 0.42,
    drift: 0.22,
    depthSpread: 0.85,
    intensity: 0.5,
  },
  build(params) {
    const p = { ...this.defaultParams, ...params };
    return [
      {
        id: "observatory-deep-env",
        attachment: "infinite-environment",
        kind: "volumetric-nebula",
        z: -460,
        opacity: 1,
        parallaxDepth: 0.97,
        presetId: this.id,
        params: p,
      },
      {
        id: "observatory-deep-scatter",
        attachment: "world",
        kind: "particle-field",
        z: -200,
        opacity: 1,
        parallaxDepth: 0.7,
        presetId: this.id,
        params: {
          ...p,
          variant: "starfield",
          density: Math.min(1, (p.density ?? 0.5) + 0.35),
        },
      },
    ];
  },
};

// ── Cosmic Drift (HYBRID: fal plate + depth parallax + procedural veil) ──────
// The image+real-3D hybrid (A6): a photoreal deep-space PLATE (fal flux-2),
// depth-displaced (fal depth-anything/v2) so it parallaxes with the camera, with
// a thin translucent procedural nebula veil + a starfield layered IN FRONT in
// real Z. The plate URLs are PUBLIC asset paths (INV-7: generated server-side,
// no secret in the graph). Generated once + reusable (D8).
const COSMIC_PLATE = "/three-d-bg/cosmic-plate.png";
const COSMIC_DEPTH = "/three-d-bg/cosmic-plate-depth.png";
const cosmicDrift: BackgroundPreset = {
  id: "cosmic-drift",
  category: "plates",
  motion: "drift",
  renderModes: ["3d"],
  perfTier: "T1",
  grammarFamily: "layered-photo-parallax-hero",
  keywords: ["photo", "space", "parallax", "plate", "photoreal", "hybrid"],
  name: "Cosmic Drift",
  description:
    "The hybrid: a photoreal deep-space plate depth-displaced for real parallax, a thin brass nebula veil drifting in front, and a scattered starfield — image + procedural + real-3D.",
  tagline: "photoreal depth parallax",
  controls: sharedControls(ALL_PALETTE_OPTIONS, "brass"),
  defaultParams: {
    palette: "brass",
    density: 0.32,
    drift: 0.4,
    depthSpread: 0.8,
    intensity: 0.55,
  },
  build(params) {
    const p = { ...this.defaultParams, ...params };
    return [
      {
        id: "cosmic-drift-plate",
        attachment: "world",
        kind: "parallax-plane",
        sourceUrl: COSMIC_PLATE,
        depthMapUrl: COSMIC_DEPTH,
        renderMode: "parallax-plane",
        z: -46,
        opacity: 1,
        parallaxDepth: 0.8,
        presetId: this.id,
        params: p,
      },
      {
        id: "cosmic-drift-veil",
        attachment: "infinite-environment",
        kind: "volumetric-nebula",
        z: -420,
        opacity: 0.4, // veil strength — the plate leads, the veil is a subtle accent
        parallaxDepth: 0.95,
        presetId: this.id,
        // THIN veil over the plate (the plate leads; the veil is a subtle drifting
        // accent), translucent so the photoreal plate shows through.
        params: {
          ...p,
          density: 0.16,
          intensity: Math.min(0.45, p.intensity ?? 0.45),
        },
      },
      {
        id: "cosmic-drift-scatter",
        attachment: "world",
        kind: "particle-field",
        z: -120,
        opacity: 1,
        parallaxDepth: 0.6,
        presetId: this.id,
        params: { ...p, variant: "starfield" },
      },
    ];
  },
};

// ── Captured Observatory (SPLAT: desktop/T2 captured environment) ────────────
// A photoreal CAPTURED environment (fal plate + depth) rendered as 3D gaussian
// sprites the camera flies through (A5). The splat layer is `minTier: 'T2'` — on
// mobile/T0 it drops and the procedural deep nebula renders as the documented
// fallback (C7). Spark 2.0 is the documented .spz/.sog decode seam (see
// SplatLayer). The graph holds only public asset URLs (INV-7).
const CAPTURE_PLATE = "/three-d-bg/capture-observatory.png";
const CAPTURE_DEPTH = "/three-d-bg/capture-observatory-depth.png";
const capturedObservatory: BackgroundPreset = {
  id: "captured-observatory",
  category: "captured",
  motion: "calm",
  renderModes: ["3d"],
  perfTier: "T2",
  grammarFamily: "layered-photo-parallax-hero",
  keywords: [
    "splat",
    "captured",
    "gaussian",
    "hall",
    "photoreal",
    "flythrough",
  ],
  name: "Captured Observatory",
  description:
    "A photoreal captured brass-observatory hall rendered as 3D gaussian splats you fly through (desktop/T2). On lighter devices it falls back to a deep procedural nebula — no hard error.",
  tagline: "captured 3D gaussian scene",
  controls: sharedControls(ALL_PALETTE_OPTIONS, "deep"),
  defaultParams: {
    palette: "deep",
    density: 0.4,
    drift: 0.3,
    depthSpread: 0.85,
    intensity: 0.5,
  },
  build(params) {
    const p = { ...this.defaultParams, ...params };
    return [
      {
        id: "captured-observatory-nebula",
        attachment: "infinite-environment",
        kind: "volumetric-nebula",
        z: -460,
        opacity: 1,
        parallaxDepth: 0.97,
        presetId: this.id,
        // Deep atmosphere — surrounds the splat on T2, and IS the fallback on T0.
        params: { ...p, density: 0.42 },
      },
      {
        id: "captured-observatory-splat",
        attachment: "world",
        kind: "splat",
        sourceUrl: CAPTURE_PLATE,
        depthMapUrl: CAPTURE_DEPTH,
        z: -26,
        opacity: 1,
        parallaxDepth: 0.5,
        minTier: "T2", // desktop/T2 only; drops to the nebula fallback below
        presetId: this.id,
        params: p,
      },
    ];
  },
};

export const BACKGROUND_PRESETS: readonly BackgroundPreset[] = Object.freeze([
  brassNebula,
  iceField,
  observatoryDeep,
  cosmicDrift,
  capturedObservatory,
]);

export function getBackgroundPreset(
  id: string | undefined,
): BackgroundPreset | undefined {
  return BACKGROUND_PRESETS.find((preset) => preset.id === id);
}

/**
 * Apply a preset → the PrismHubBackgroundLayer[] to write onto a hub's
 * `background`. Returns `[]` for an unknown id (caller treats as "clear"). The
 * caller persists via `useGraphSourceStore.updateHub(hubId, { background })`
 * (additive, INV-2/INV-5 — only `hub.background` is written).
 */
export function applyBackgroundPreset(
  presetId: string,
  params?: BackgroundLayerParams,
): PrismHubBackgroundLayer[] {
  const preset = getBackgroundPreset(presetId);
  if (!preset) return [];
  return preset.build(mergeParams(preset, params));
}

/** Read the active preset id off an existing layer stack (for the Inspector). */
export function presetIdOfBackground(
  layers: readonly PrismHubBackgroundLayer[] | undefined,
): string | undefined {
  return layers?.find((l) => l.presetId)?.presetId;
}

/** Read the effective params off an existing layer stack (env layer wins). */
export function paramsOfBackground(
  layers: readonly PrismHubBackgroundLayer[] | undefined,
): BackgroundLayerParams | undefined {
  const env = layers?.find((l) => l.kind === "volumetric-nebula" && l.params);
  return env?.params ?? layers?.find((l) => l.params)?.params;
}
