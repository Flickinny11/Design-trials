// RENDER-ROUTES — route → concrete Prism realization + intent derivation.
//
// `routeToRealization(route)` tells the builder HOW to make a chosen route real
// in the Prism graph: which `renderMode`, which asset-slot fields to populate,
// which Animatable-catalog primitives + cinematic-floor pieces to attach.
// `deriveInputsFromIntent(...)` lets prompt-to-node turn loose intent signals
// (realism keywords, interaction verbs, budget hints) into RouteInputs so the
// planner is reachable from natural-language authoring.
//
// The primitive / floor ids referenced here are the ones this wave ships:
//   layered-photo-scene   — the R2 composite scene primitive (D2)
//   parallax-scroll        — seed cinematic primitive (depth reaction)
//   carousel / loop-column — D3 drivers
//   contact-shadow, imperfection-veil, filmic-post — D4 cinematic floor pieces

import type {
  ByteBudget,
  InteractionNeed,
  MotionNeed,
  RealismBar,
  RenderRoute,
  RouteInputs,
  RouteRealization,
  SourceKind,
} from "./types";

const REALIZATIONS: Record<RenderRoute, RouteRealization> = {
  R1: {
    route: "R1",
    pipeline: "realtime-pbr",
    renderMode: "mesh",
    assetSlots: ["meshUrl", "materialSpec"],
    primitives: ["orbit", "magnetic-cursor"],
    cinematicFloor: ["contact-shadow", "imperfection-veil", "filmic-post"],
    notes:
      "Real geometry + PBR + the D4 cinematic floor. Node-local floor pieces " +
      "(contact shadow, imperfection breakup) run in the single WebGPU scene; " +
      "full-frame filmic post runs on an owned canvas (lab/marketing), never by " +
      "editing SceneRoot/LightingRig (I-ENGINE).",
  },
  R2: {
    route: "R2",
    pipeline: "photo-composite",
    renderMode: "parallax-plane",
    assetSlots: ["sourceUrl", "depthMapUrl", "compositeManifestUrl"],
    primitives: ["layered-photo-scene", "parallax-scroll"],
    cinematicFloor: ["grade-baked-at-pipeline-time"],
    notes:
      "Generated/photographed imagery run through the D2 pipeline (cutout → " +
      "depth → shadow plate → relight → LUT grade) and assembled as a layered " +
      "parallax scene. Grade + shadow are baked into the plates at pipeline " +
      "time, so the runtime needs no post chain — this is how the watch at / " +
      "gets photoreal realism without touching the engine post path (DEV-2).",
  },
  R3: {
    route: "R3",
    pipeline: "baked-hybrid",
    renderMode: "mesh",
    assetSlots: ["meshUrl", "materialSpec", "bakedLightmapUrl"],
    primitives: ["depth-rotate"],
    cinematicFloor: ["contact-shadow"],
    notes:
      "Real geometry with baked lighting/AO in its material maps. Navigable at a " +
      "fraction of realtime-relight cost; no live light response. Uses the mesh " +
      "render lane with a baked lightmap where the material system supports it.",
  },
  R4: {
    route: "R4",
    pipeline: "gaussian-splat",
    renderMode: null, // codeRef / owned-canvas viewer, NOT a new RenderMode (DEV-3)
    assetSlots: ["splatUrl"],
    primitives: ["fly-through"],
    cinematicFloor: [],
    notes:
      "A gaussian-splat capture rendered by the D5 Spark viewer on an owned " +
      "WebGL2 canvas (Spark is WebGL2-only; the editor scene is single-WebGPU, " +
      "INV-1). The graph carries splatUrl; generation/capture is a later wave. " +
      "For in-scene use, the decoded gaussian arrays feed the WebGPU-native " +
      "SplatLayer as its documented swap-in.",
  },
};

export function routeToRealization(route: RenderRoute): RouteRealization {
  return REALIZATIONS[route];
}

// ---------------------------------------------------------------------------
// Intent derivation — natural-language signals → RouteInputs
// ---------------------------------------------------------------------------

export interface IntentSignals {
  /** Free text from the brief / prompt describing the element. */
  text?: string;
  /** Explicit overrides win over text inference. */
  interaction?: InteractionNeed;
  realism?: RealismBar;
  byteBudget?: ByteBudget;
  motion?: MotionNeed;
  sourceKind?: SourceKind;
}

const INTERACTION_HINTS: [RegExp, InteractionNeed][] = [
  [
    /\b(configure|configurator|customi[sz]e|rotate|spin|drag|assemble|try on|edit in 3d)\b/i,
    "manipulate",
  ],
  [
    /\b(fly through|fly-through|walk through|explore|orbit around|navigate|tour|dolly)\b/i,
    "navigate",
  ],
  [/\b(parallax|scroll[- ]?react|depth|tilt|cursor[- ]?react)\b/i, "parallax"],
  [/\b(static|decorative|read[- ]?only|backdrop)\b/i, "none"],
];

const REALISM_HINTS: [RegExp, RealismBar][] = [
  [
    /\b(photo(real|graphic)?|lifelike|as a photograph|studio shot|product shot|hero shot)\b/i,
    "photoreal",
  ],
  [
    /\b(stylized|illustrat|cartoon|abstract|procedural|neon|synthwave)\b/i,
    "stylized",
  ],
  [/\b(crafted|premium 3d|believable|cinematic)\b/i, "high"],
];

const MOTION_HINTS: [RegExp, MotionNeed][] = [
  [
    /\b(react|respond|cursor[- ]?velocity|follow the mouse|magnetic)\b/i,
    "responsive",
  ],
  [
    /\b(carousel|marquee|drift|always[- ]?moving|loop(ing)?|conveyor|filmstrip)\b/i,
    "continuous",
  ],
  [/\b(float|breathe|idle|ambient|drift slowly|gentle)\b/i, "ambient"],
  [/\b(still|static|frozen|no motion)\b/i, "static"],
];

const SOURCE_HINTS: [RegExp, SourceKind][] = [
  [/\b(capture|photogrammetry|3dgs|gaussian splat|scanned)\b/i, "capture"],
  [/\b(photo|image|render|plate|shot)\b/i, "photo"],
  [/\b(mesh|glb|gltf|model|geometry|sculpt)\b/i, "mesh"],
];

function firstMatch<T>(text: string, hints: [RegExp, T][]): T | undefined {
  for (const [re, val] of hints) if (re.test(text)) return val;
  return undefined;
}

/**
 * Turn loose intent signals into RouteInputs. Explicit fields always win;
 * remaining fields are inferred from `text`, falling back to conservative
 * defaults (mid realism/byte, ambient motion, no interaction) so the planner
 * always has a complete input.
 */
export function deriveInputsFromIntent(signals: IntentSignals): RouteInputs {
  const text = signals.text ?? "";
  return {
    interaction:
      signals.interaction ?? firstMatch(text, INTERACTION_HINTS) ?? "none",
    realism: signals.realism ?? firstMatch(text, REALISM_HINTS) ?? "high",
    byteBudget: signals.byteBudget ?? "moderate",
    motion: signals.motion ?? firstMatch(text, MOTION_HINTS) ?? "ambient",
    sourceKind: signals.sourceKind ?? firstMatch(text, SOURCE_HINTS),
  };
}
