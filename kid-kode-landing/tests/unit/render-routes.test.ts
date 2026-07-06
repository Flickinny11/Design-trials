// W-PHOTO D1 — route-planner decision table + intent derivation.
//
// These cases are the requirements ledger for the planner: each maps a real
// design-grammar family / element to the route it must choose. If the scoring
// changes, these lock the intended behaviour and the printed matrix keeps
// ROUTE-PLANNER.md honest.

import { describe, expect, it } from "vitest";
import {
  RENDER_ROUTES,
  deriveInputsFromIntent,
  planRoute,
  routeToRealization,
  scoreRoutes,
  type RenderRoute,
  type RouteInputs,
} from "@/lib/render-routes";

interface Case {
  name: string;
  inputs: RouteInputs;
  expect: RenderRoute;
}

const CASES: Case[] = [
  {
    name: "watch configurator (rotate/customize in true 3D)",
    inputs: {
      interaction: "manipulate",
      realism: "photoreal",
      byteBudget: "generous",
      motion: "responsive",
    },
    expect: "R1",
  },
  {
    name: "layered-photo-parallax-hero",
    inputs: {
      interaction: "parallax",
      realism: "photoreal",
      byteBudget: "moderate",
      motion: "continuous",
      sourceKind: "photo",
    },
    expect: "R2",
  },
  {
    name: "editorial-product-gallery (still, tight budget)",
    inputs: {
      interaction: "none",
      realism: "photoreal",
      byteBudget: "tight",
      motion: "ambient",
      sourceKind: "photo",
    },
    expect: "R2",
  },
  {
    name: "captured-environment fly-through",
    inputs: {
      interaction: "navigate",
      realism: "photoreal",
      byteBudget: "generous",
      motion: "ambient",
      sourceKind: "capture",
    },
    expect: "R4",
  },
  {
    name: "navigable product, mesh source, no capture",
    inputs: {
      interaction: "navigate",
      realism: "high",
      byteBudget: "moderate",
      motion: "ambient",
      sourceKind: "mesh",
    },
    expect: "R3",
  },
  {
    name: "splat under tight budget downgrades to composite",
    inputs: {
      interaction: "parallax",
      realism: "photoreal",
      byteBudget: "tight",
      motion: "ambient",
      sourceKind: "capture",
    },
    expect: "R2",
  },
  {
    name: "stylized procedural particle hero",
    inputs: {
      interaction: "parallax",
      realism: "stylized",
      byteBudget: "moderate",
      motion: "responsive",
      sourceKind: "procedural",
    },
    expect: "R1",
  },
];

describe("route planner", () => {
  for (const c of CASES) {
    it(`routes ${c.name} → ${c.expect}`, () => {
      const d = planRoute(c.inputs);
      expect(d.route).toBe(c.expect);
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
      expect(d.rationale).toContain(c.expect);
    });
  }

  it("always returns a survivor (R1 is the guaranteed floor)", () => {
    const d = planRoute({
      interaction: "manipulate",
      realism: "stylized",
      byteBudget: "tight",
      motion: "static",
    });
    expect(RENDER_ROUTES).toContain(d.route);
    expect(d.scores.filter((s) => !s.disqualified).length).toBeGreaterThan(0);
  });

  it("every route is reachable from some input", () => {
    const reached = new Set(CASES.map((c) => planRoute(c.inputs).route));
    // R1,R2,R3,R4 all appear across the cases above
    for (const r of RENDER_ROUTES) expect(reached.has(r)).toBe(true);
  });

  it("scoreRoutes puts survivors before disqualified and sorts by fit", () => {
    const scores = scoreRoutes({
      interaction: "navigate",
      realism: "photoreal",
      byteBudget: "tight",
      motion: "ambient",
      sourceKind: "capture",
    });
    // R4 disqualified (tight budget); a survivor must lead
    expect(scores[0].disqualified).toBe(false);
    const dqIndex = scores.findIndex((s) => s.disqualified);
    if (dqIndex >= 0) {
      for (let i = dqIndex; i < scores.length; i++)
        expect(scores[i].disqualified).toBe(true);
    }
  });

  it("routeToRealization maps R4 to a null renderMode (codeRef/owned canvas, not a RenderMode)", () => {
    expect(routeToRealization("R4").renderMode).toBeNull();
    expect(routeToRealization("R1").renderMode).toBe("mesh");
    expect(routeToRealization("R2").renderMode).toBe("parallax-plane");
  });
});

describe("intent derivation", () => {
  it("parses interaction/realism/motion/source from text", () => {
    const inputs = deriveInputsFromIntent({
      text: "a photoreal watch the user can configure and rotate",
    });
    expect(inputs.interaction).toBe("manipulate");
    expect(inputs.realism).toBe("photoreal");
  });

  it("explicit fields win over text", () => {
    const inputs = deriveInputsFromIntent({
      text: "static backdrop",
      interaction: "manipulate",
    });
    expect(inputs.interaction).toBe("manipulate");
  });

  it("falls back to conservative defaults", () => {
    const inputs = deriveInputsFromIntent({ text: "" });
    expect(inputs.interaction).toBe("none");
    expect(inputs.realism).toBe("high");
    expect(inputs.byteBudget).toBe("moderate");
    expect(inputs.motion).toBe("ambient");
  });
});

// Prints the decision matrix used to author ROUTE-PLANNER.md. Kept as a test so
// the doc can be regenerated + verified against the live scoring at any time.
describe("decision matrix (doc source)", () => {
  it("dumps the canonical matrix", () => {
    const rows = CASES.map((c) => {
      const d = planRoute(c.inputs);
      return `${d.route}  conf=${d.confidence.toFixed(2)}  fb=${d.fallback ?? "-"}  | ${c.name}`;
    });
    // eslint-disable-next-line no-console
    console.log("\nROUTE DECISION MATRIX\n" + rows.join("\n") + "\n");
    expect(rows.length).toBe(CASES.length);
  });
});
