// W-BG — library entry factory.
//
// 55+ catalog entries share one deterministic construction path: a PresetDef
// (pure data: catalog axes + defaults + a layer-spec list) becomes a
// BackgroundPreset whose `build(params)` emits an id-stable layer stack
// (`<presetId>-<suffix>`), exactly like the hand-rolled launch presets — so
// re-apply updates in place and save/reload round-trips (C9/C10) hold for the
// whole catalog by construction.

import type {
  PrismHubBackgroundLayer,
  BackgroundLayerParams,
  PrismHubBackgroundAttachment,
  BackgroundLayerKind,
  LightingTier,
  RenderMode,
} from "../../../prism-graph/types";
import type {
  BackgroundPreset,
  BackgroundParamControl,
  BackgroundCategoryId,
  BackgroundMotionTag,
  BackgroundRenderModeTag,
} from "../types";
import { BACKGROUND_PALETTE_IDS, getBackgroundPalette } from "../palettes";

export interface LayerSpec {
  /** Layer id = `${presetId}-${suffix}` (id-stable across rebuilds). */
  suffix: string;
  kind: BackgroundLayerKind;
  attachment?: PrismHubBackgroundAttachment;
  z?: number;
  opacity?: number;
  parallaxDepth?: number;
  minTier?: LightingTier;
  sourceUrl?: string;
  depthMapUrl?: string;
  renderMode?: RenderMode;
  /** Per-layer param overrides merged over the preset params. A function form
   *  receives the merged preset params for derived values (e.g. scaled
   *  density), mirroring the launch presets' hand-rolled math. */
  params?:
    | Partial<BackgroundLayerParams>
    | ((p: BackgroundLayerParams) => Partial<BackgroundLayerParams>);
}

const DEFAULT_ATTACHMENT: Record<
  BackgroundLayerKind,
  PrismHubBackgroundAttachment
> = {
  "volumetric-nebula": "infinite-environment",
  "gradient-volume": "infinite-environment",
  "particle-field": "world",
  "fluid-overlay": "world",
  "parallax-plane": "world",
  image: "world",
  splat: "world",
};

const DEFAULT_Z: Record<BackgroundLayerKind, number> = {
  "volumetric-nebula": -430,
  "gradient-volume": -430,
  "particle-field": -150,
  "fluid-overlay": -60,
  "parallax-plane": -46,
  image: -46,
  splat: -26,
};

const DEFAULT_PARALLAX: Record<BackgroundLayerKind, number> = {
  "volumetric-nebula": 0.95,
  "gradient-volume": 0.95,
  "particle-field": 0.6,
  "fluid-overlay": 0.5,
  "parallax-plane": 0.8,
  image: 0.8,
  splat: 0.5,
};

/** The shared live-knob control set every catalog entry exposes (same contract
 *  the launch presets established: palette select + four sliders). */
export function catalogControls(
  defaultPalette: string,
  paletteIds: readonly string[] = BACKGROUND_PALETTE_IDS,
): BackgroundParamControl[] {
  return [
    {
      id: "palette",
      label: "Palette",
      type: "select",
      options: paletteIds.map((id) => ({
        value: id,
        label: getBackgroundPalette(id).label,
      })),
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

export interface PresetDef {
  id: string;
  name: string;
  description: string;
  tagline: string;
  category: BackgroundCategoryId;
  motion: BackgroundMotionTag;
  renderModes: readonly BackgroundRenderModeTag[];
  perfTier: LightingTier;
  grammarFamily: string;
  keywords: readonly string[];
  defaults: BackgroundLayerParams;
  layers: LayerSpec[];
  /** Restrict the palette select (defaults to the full palette set). */
  paletteIds?: readonly string[];
}

export function makePreset(def: PresetDef): BackgroundPreset {
  const { layers, defaults, paletteIds, ...meta } = def;
  return {
    ...meta,
    controls: catalogControls(String(defaults.palette ?? "deep"), paletteIds),
    defaultParams: defaults,
    thumbUrl: `/three-d-bg/thumbs/${def.id}.webp`,
    build(params: BackgroundLayerParams): PrismHubBackgroundLayer[] {
      const p = { ...defaults, ...params };
      return layers.map((l) => {
        const overrides =
          typeof l.params === "function" ? l.params(p) : (l.params ?? {});
        const layer: PrismHubBackgroundLayer = {
          id: `${def.id}-${l.suffix}`,
          attachment: l.attachment ?? DEFAULT_ATTACHMENT[l.kind],
          kind: l.kind,
          z: l.z ?? DEFAULT_Z[l.kind],
          opacity: l.opacity ?? 1,
          parallaxDepth: l.parallaxDepth ?? DEFAULT_PARALLAX[l.kind],
          presetId: def.id,
          params: { ...p, ...overrides },
        };
        if (l.sourceUrl) layer.sourceUrl = l.sourceUrl;
        if (l.depthMapUrl) layer.depthMapUrl = l.depthMapUrl;
        if (l.renderMode) layer.renderMode = l.renderMode;
        if (l.minTier) layer.minTier = l.minTier;
        return layer;
      });
    },
  };
}
