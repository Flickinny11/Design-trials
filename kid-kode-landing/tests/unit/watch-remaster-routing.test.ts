// W-PHOTO D6 — the route planner APPLIED to the mock watch app.
//
// The acceptance test "apply the route planner to the mock watch app": each
// scene's hero element is fed through planRoute, and the decision drives how it
// is (or would be) built. This suite is the recorded application + rationale.
//
// The configurator watch routes R1 (realtime PBR — the ONLY route that lets the
// user rotate/configure it live) and receives the D6 node-local cinematic floor
// (imperfection breakup + contact shadow). The celestial/atelier backdrops route
// R2 (photographic composite — the celestia-hero pipeline). A captured
// observatory environment would route R4.

import { describe, it, expect } from "vitest";
import {
  deriveInputsFromIntent,
  planRoute,
  routeToRealization,
  type RenderRoute,
} from "@/lib/render-routes";

interface SceneElement {
  scene: string;
  element: string;
  intent: string;
  expect: RenderRoute;
}

// The six ORRERY No.7 scenes + their hero elements, described in natural language
// so the planner's intent derivation is exercised end-to-end.
const WATCH_APP: SceneElement[] = [
  {
    scene: "s1-arrival",
    element: "hero watch",
    intent: "a photoreal watch the user can rotate and configure",
    expect: "R1",
  },
  {
    scene: "s2-movement",
    element: "tourbillon movement",
    intent:
      "a photoreal mechanical tourbillon the user can rotate and configure in true 3d",
    expect: "R1",
  },
  {
    scene: "s3-materia",
    element: "materials backdrop",
    intent: "a photoreal studio product tableau, still, parallax on scroll",
    expect: "R2",
  },
  {
    scene: "s4-celestia",
    element: "celestial tableau",
    intent:
      "a photoreal celestial atelier backdrop, parallax hero, floating garnish",
    expect: "R2",
  },
  {
    scene: "s5-acquire",
    element: "acquire card",
    intent: "a photoreal watch the user can rotate and customize",
    expect: "R1",
  },
  {
    scene: "s6-atelier",
    element: "configurator watch",
    intent: "a photoreal watch to customize and rotate in true 3d",
    expect: "R1",
  },
];

describe("route planner applied to the watch app (D6)", () => {
  const rows: string[] = [];
  for (const el of WATCH_APP) {
    it(`${el.scene} / ${el.element} → ${el.expect}`, () => {
      const inputs = deriveInputsFromIntent({ text: el.intent });
      const decision = planRoute(inputs);
      rows.push(
        `${el.scene.padEnd(12)} ${el.element.padEnd(22)} → ${decision.route} (fb ${decision.fallback ?? "-"})`,
      );
      expect(decision.route).toBe(el.expect);
    });
  }

  it("R1 watch elements realize as mesh + the cinematic floor; R2 as parallax-plane", () => {
    const r1 = routeToRealization("R1");
    expect(r1.renderMode).toBe("mesh");
    expect(r1.cinematicFloor).toContain("contact-shadow");
    expect(r1.cinematicFloor).toContain("imperfection-veil");
    const r2 = routeToRealization("R2");
    expect(r2.renderMode).toBe("parallax-plane");
    // eslint-disable-next-line no-console
    console.log("\nWATCH-APP ROUTE MAP\n" + rows.join("\n") + "\n");
  });
});
