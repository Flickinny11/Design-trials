// RENDER-ROUTES — the decision engine.
//
// `planRoute(inputs)` scores all four routes against the inputs, disqualifies
// any that violate a hard constraint, and returns the best survivor with a
// human rationale + a fallback. The scoring is deterministic and fully
// explainable (every point has a `reason`), so the decision table in
// ROUTE-PLANNER.md is reproducible and Conductor can log WHY it picked a route.
//
// Design note: we score rather than cascade so the table is transparent and a
// tie or near-tie surfaces as low confidence (Conductor can then ask the user).

import {
  BYTE_RANK,
  INTERACTION_RANK,
  MOTION_RANK,
  REALISM_RANK,
  RENDER_ROUTES,
  ROUTE_LABELS,
  type RenderRoute,
  type RouteDecision,
  type RouteInputs,
  type RouteScore,
  type SourceKind,
} from "./types";

/** Routes each source kind can plausibly feed (before other constraints). */
const SOURCE_ROUTES: Record<SourceKind, RenderRoute[]> = {
  procedural: ["R1"], // shader/geometry only → realtime
  photo: ["R2", "R1"], // a still → composite, or a textured plane in a 3D scene
  capture: ["R4", "R2"], // a 3DGS capture → splat, or its RGBD as depth-parallax
  mesh: ["R1", "R3"], // a GLB → realtime or baked
};

function score(route: RenderRoute, inputs: RouteInputs): RouteScore {
  const i = INTERACTION_RANK[inputs.interaction];
  const r = REALISM_RANK[inputs.realism];
  const b = BYTE_RANK[inputs.byteBudget];
  const m = MOTION_RANK[inputs.motion];
  const reasons: string[] = [];
  let fit = 0.5; // neutral prior
  let disqualified = false;

  // Source-kind gate: if a source is declared and it can't feed this route,
  // disqualify (except R1, which can always fall back to procedural/textured).
  if (
    inputs.sourceKind &&
    route !== "R1" &&
    !SOURCE_ROUTES[inputs.sourceKind].includes(route)
  ) {
    disqualified = true;
    reasons.push(`source '${inputs.sourceKind}' cannot feed ${route}`);
  }

  switch (route) {
    case "R1": {
      // Realtime PBR is the universal route: it is the ONLY one that manipulates
      // and relights live, and it reaches photoreal via the cinematic floor.
      if (inputs.interaction === "manipulate") {
        fit += 0.4;
        reasons.push("only route with live manipulation + relight");
      }
      if (inputs.motion === "responsive") {
        fit += 0.15;
        reasons.push("drives live cursor/scroll response cleanly");
      }
      // Photoreal + non-interactive is R2 territory — R1 pays geometry cost for
      // a look R2 gets from photographs. Nudge R1 down there.
      if (r === REALISM_RANK.photoreal && i <= INTERACTION_RANK.parallax) {
        fit -= 0.25;
        reasons.push(
          "photoreal + low-interaction is cheaper as a photo composite",
        );
      }
      // Heavy realtime geometry under a tight byte budget is a poor fit.
      if (
        b === BYTE_RANK.tight &&
        (inputs.sourceKind === "mesh" || i >= INTERACTION_RANK.navigate)
      ) {
        fit -= 0.15;
        reasons.push("realtime geometry strains a tight byte budget");
      }
      break;
    }

    case "R2": {
      // Flat/near-flat photographic composite. Cannot be navigated or edited.
      if (i >= INTERACTION_RANK.navigate) {
        disqualified = true;
        reasons.push("a flat composite cannot be navigated/manipulated");
        break;
      }
      if (r === REALISM_RANK.photoreal) {
        fit += 0.35;
        reasons.push("photographs ARE photoreal — the industry method");
      } else if (r === REALISM_RANK.stylized) {
        fit -= 0.1;
        reasons.push("stylized targets rarely need a photo composite");
      }
      if (b === BYTE_RANK.tight) {
        fit += 0.1;
        reasons.push("images are byte-cheap vs realtime scenes");
      }
      // Parallax/ambient/continuous motion all suit a layered composite; only a
      // truly static single image gets no benefit from the layered scene.
      if (inputs.motion === "static") {
        fit -= 0.05;
        reasons.push("layered parallax adds little to a static element");
      } else {
        fit += 0.1;
        reasons.push("layered parallax + independent float loops read alive");
      }
      break;
    }

    case "R3": {
      // Baked hybrid: navigable geometry, static lighting. Its sweet spot is
      // "walk around a 3D thing" without paying realtime-relight cost.
      if (inputs.interaction === "manipulate") {
        fit -= 0.3;
        reasons.push(
          "live material/light editing needs realtime PBR, not baked",
        );
      }
      if (inputs.interaction === "navigate") {
        fit += 0.3;
        reasons.push("navigable geometry with baked lighting — cheap + solid");
      }
      if (r >= REALISM_RANK.high) {
        fit += 0.1;
        reasons.push("baked GI/AO carries a high realism read");
      }
      if (b <= BYTE_RANK.moderate) {
        fit += 0.1;
        reasons.push("baked maps beat realtime lighting on byte budget");
      }
      if (inputs.motion === "responsive") {
        fit -= 0.1;
        reasons.push("baked lighting cannot respond to live light changes");
      }
      break;
    }

    case "R4": {
      // Gaussian splat: photoreal captured 3D, flown through. Large bytes, no
      // per-part editing.
      if (b === BYTE_RANK.tight) {
        disqualified = true;
        reasons.push("splat assets are too large for a tight byte budget");
        break;
      }
      if (inputs.interaction === "manipulate") {
        disqualified = true;
        reasons.push("a splat volume has no editable parts");
        break;
      }
      if (inputs.interaction === "navigate") {
        fit += 0.35;
        reasons.push(
          "fly-through of a real captured volume with true parallax",
        );
      } else {
        fit -= 0.1;
        reasons.push("splat shines when navigated, less so when held still");
      }
      if (r === REALISM_RANK.photoreal) {
        fit += 0.2;
        reasons.push("captured reality is inherently photoreal");
      }
      if (inputs.sourceKind === "capture") {
        fit += 0.15;
        reasons.push("a capture source maps directly to a splat");
      }
      if (b === BYTE_RANK.generous) {
        fit += 0.05;
        reasons.push("generous byte budget affords a splat");
      }
      break;
    }
  }

  // Motion-continuous nudges: any route can loop, but flag the mismatch reasons
  // above rather than here so the table stays legible.
  void m;

  return { route, fit: clamp01(fit), disqualified, reasons };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function scoreRoutes(inputs: RouteInputs): RouteScore[] {
  return RENDER_ROUTES.map((route) => score(route, inputs)).sort((a, b) => {
    // survivors first, then by fit desc, then stable route order for ties
    if (a.disqualified !== b.disqualified) return a.disqualified ? 1 : -1;
    if (b.fit !== a.fit) return b.fit - a.fit;
    return RENDER_ROUTES.indexOf(a.route) - RENDER_ROUTES.indexOf(b.route);
  });
}

export function planRoute(inputs: RouteInputs): RouteDecision {
  const scores = scoreRoutes(inputs);
  const survivors = scores.filter((s) => !s.disqualified);
  // R1 is the guaranteed floor (never disqualified above), so survivors is
  // always non-empty; guard anyway for defensiveness.
  const winner = survivors[0] ?? scores[0];
  const runnerUp = survivors[1] ?? null;
  const confidence = runnerUp
    ? clamp01(winner.fit - runnerUp.fit + 0.15)
    : 0.85;

  const rationale =
    `${ROUTE_LABELS[winner.route]} (${winner.route}) for ` +
    `interaction=${inputs.interaction}, realism=${inputs.realism}, ` +
    `bytes=${inputs.byteBudget}, motion=${inputs.motion}` +
    (inputs.sourceKind ? `, source=${inputs.sourceKind}` : "") +
    `: ${winner.reasons[0] ?? "best overall fit"}.`;

  return {
    route: winner.route,
    confidence,
    rationale,
    fallback: runnerUp ? runnerUp.route : null,
    scores,
    inputs,
  };
}
