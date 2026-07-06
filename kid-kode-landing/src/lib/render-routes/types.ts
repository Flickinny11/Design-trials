// RENDER-ROUTES — the four-route rendering taxonomy (W-PHOTO D1).
//
// The premium web kills "looks digital" not by pushing one renderer to film
// quality, but by CHOOSING the right rendering strategy per element. This module
// is the typed decision layer that Conductor / prompt-to-node consult to pick a
// route for each element from four inputs: how much INTERACTION the element
// needs, how high its REALISM bar is, the BYTE budget, and its MOTION need.
//
// The four routes (PRISM-DESIGN-SUPREMACY-PLAN §1):
//   R1 realtime PBR      — real geometry + PBR + the cinematic floor (D4).
//                          The only route that manipulates/relights live.
//   R2 photo composite   — photographic imagery cut out, depth-mapped, shadow-
//                          plated, graded, assembled as a layered parallax scene
//                          (D2). The industry's photoreal method for heroes/
//                          galleries. Cheapest bytes for the highest realism.
//   R3 baked hybrid      — real geometry with BAKED lighting/shadow/AO. Navigable
//                          3D at a fraction of realtime cost; no live relight.
//   R4 gaussian splat    — a captured/generated 3DGS volume flown through with
//                          true parallax (D5). Photoreal captured 3D, large bytes.
//
// This file is pure types + ordinal scales. The decision lives in `planner.ts`;
// the route→Prism-realization mapping lives in `realization.ts`.

import type { RenderMode } from "@/lib/prism-graph/types";

export type RenderRoute = "R1" | "R2" | "R3" | "R4";

export const RENDER_ROUTES: readonly RenderRoute[] = [
  "R1",
  "R2",
  "R3",
  "R4",
] as const;

/** Human labels for docs / UI / flight-record attributes. */
export const ROUTE_LABELS: Record<RenderRoute, string> = {
  R1: "Realtime PBR",
  R2: "Photographic composite",
  R3: "Baked hybrid",
  R4: "Gaussian splat",
};

// ---------------------------------------------------------------------------
// Decision inputs — ordinal scales (low → high). The planner ranks by these.
// ---------------------------------------------------------------------------

/** How much the user directly drives THIS element. */
export type InteractionNeed =
  | "none" // decorative / read-only
  | "parallax" // reacts to scroll/cursor with depth, but not navigated
  | "navigate" // camera moves THROUGH / AROUND it (fly-through, orbit)
  | "manipulate"; // user rotates / configures / edits it in true 3D

/** The realism ceiling the element must reach to not "look digital". */
export type RealismBar =
  | "stylized" // deliberately non-photoreal (illustration, procedural)
  | "high" // crafted 3D, believable but clearly rendered
  | "photoreal"; // must read as a photograph

/** How many bytes we can spend on this element's assets. */
export type ByteBudget = "tight" | "moderate" | "generous";

/** The motion character the element must sustain. */
export type MotionNeed =
  | "static" // no motion
  | "ambient" // slow idle float / breathing loop
  | "continuous" // always-moving (carousel drift, orbit)
  | "responsive"; // must react live to cursor/scroll velocity

/** Where the element's visual source comes from (gates R2/R4). */
export type SourceKind =
  | "procedural" // generated geometry/shader, no imagery
  | "photo" // a still image (uploaded or FLUX-generated)
  | "capture" // a 3DGS / photogrammetry capture
  | "mesh"; // an authored/generated 3D mesh (GLB)

export interface RouteInputs {
  interaction: InteractionNeed;
  realism: RealismBar;
  byteBudget: ByteBudget;
  motion: MotionNeed;
  /** Optional. When omitted the planner infers a permissive default per route. */
  sourceKind?: SourceKind;
}

// ---------------------------------------------------------------------------
// Decision outputs
// ---------------------------------------------------------------------------

export interface RouteScore {
  route: RenderRoute;
  /** 0..1 fitness for the given inputs (higher = better match). */
  fit: number;
  /** A hard constraint eliminated this route regardless of fit. */
  disqualified: boolean;
  /** Human-readable reasons that drove fit / disqualification. */
  reasons: string[];
}

export interface RouteDecision {
  route: RenderRoute;
  /** 0..1 — margin of the winner over the runner-up, clamped. */
  confidence: number;
  rationale: string;
  /** Best non-disqualified alternative, or null if only one survived. */
  fallback: RenderRoute | null;
  /** Every route's score, for transparency / debugging / the decision table. */
  scores: RouteScore[];
  inputs: RouteInputs;
}

// ---------------------------------------------------------------------------
// Route → concrete Prism realization (how a chosen route is actually built)
// ---------------------------------------------------------------------------

export type RoutePipeline =
  "realtime-pbr" | "photo-composite" | "baked-hybrid" | "gaussian-splat";

export interface RouteRealization {
  route: RenderRoute;
  pipeline: RoutePipeline;
  /** The `PrismNode.renderMode` this route maps to, or null (R4 = codeRef/owned canvas). */
  renderMode: RenderMode | null;
  /** Asset-slot fields the graph must populate for this route. */
  assetSlots: string[];
  /** Animatable-catalog primitive ids typically attached for this route. */
  primitives: string[];
  /** Cinematic-floor pieces (node-local, D4) typically applied for this route. */
  cinematicFloor: string[];
  notes: string;
}

// Ordinal ranks (module-internal; exported for the planner + tests).
export const INTERACTION_RANK: Record<InteractionNeed, number> = {
  none: 0,
  parallax: 1,
  navigate: 2,
  manipulate: 3,
};
export const REALISM_RANK: Record<RealismBar, number> = {
  stylized: 0,
  high: 1,
  photoreal: 2,
};
export const BYTE_RANK: Record<ByteBudget, number> = {
  tight: 0,
  moderate: 1,
  generous: 2,
};
export const MOTION_RANK: Record<MotionNeed, number> = {
  static: 0,
  ambient: 1,
  continuous: 2,
  responsive: 3,
};
