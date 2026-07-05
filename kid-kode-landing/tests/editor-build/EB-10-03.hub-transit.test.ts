// EB-10-03 — Hub transitions: damped cinematic transit between hub-rail anchors.
//
// Spec refs:
//   §10 SC-055  "Hub transitions are deterministic and cinematic (damped camera
//                transit between hub-rail anchors)."
//   §5  INV-23  "Compiled-preview camera is constrained, damped, and bounded.
//                The scene's edges and any blank background are never visible
//                in `preview-hub` or `preview-app`."
//
// The PrismHost wiring (preview-app activeHubId swap → setCameraRail) is
// covered by the verify-editor-runtimes snapshot capture; this file pins the
// pure-data contract: per-hub rail anchors, the transit rail builder, and the
// inter-anchor pose evaluator are deterministic, non-mutating, and produce a
// monotone-damped path between the two hub-rail anchors.

import { describe, expect, it } from 'vitest';

import type {
  CompiledCameraPose,
  CompiledCameraRail,
} from '@/lib/prism-graph/compiled-view';
import {
  deriveHubTransitRail,
  evaluateHubTransit,
  getHubRailAnchor,
} from '@/lib/prism-graph/hub-transit';

// --- Fixtures ----------------------------------------------------------

function pose(x: number, y: number, z: number, fov = 50): CompiledCameraPose {
  return Object.freeze({
    position: Object.freeze([x, y, z + 1200] as const) as readonly [
      number,
      number,
      number,
    ],
    target: Object.freeze([x, y, z] as const) as readonly [number, number, number],
    fov,
  });
}

function makeRail(
  startX: number,
  endX: number,
  damping = 0.18,
): CompiledCameraRail {
  return Object.freeze({
    mode: 'damped-cinematic' as const,
    start: pose(startX - 80, 0, 0),
    end: pose(endX, 0, 0),
    damping,
  });
}

// --- Tests -------------------------------------------------------------

describe('EB-10-03 hub-transit pure surface (SC-055 / INV-23)', () => {
  it('SC-055: getHubRailAnchor returns the rest pose (rail.end) of a hub rail', () => {
    const rail = makeRail(0, 500);
    const anchor = getHubRailAnchor(rail);
    expect(anchor).toBe(rail.end);
  });

  it('SC-055: deriveHubTransitRail builds a damped-cinematic rail between the two hub anchors', () => {
    const fromRail = makeRail(0, 0, 0.22);
    const toRail = makeRail(0, 800, 0.14);
    const transit = deriveHubTransitRail(fromRail, toRail);

    expect(transit.mode).toBe('damped-cinematic');
    // start = fromAnchor (the previous hub's rest pose).
    expect(transit.start.position[0]).toBe(fromRail.end.position[0]);
    expect(transit.start.position[1]).toBe(fromRail.end.position[1]);
    expect(transit.start.position[2]).toBe(fromRail.end.position[2]);
    // end = toAnchor (the destination hub's rest pose).
    expect(transit.end.position[0]).toBe(toRail.end.position[0]);
    expect(transit.end.position[1]).toBe(toRail.end.position[1]);
    expect(transit.end.position[2]).toBe(toRail.end.position[2]);
  });

  it('SC-055: deriveHubTransitRail damping is the gentler (smaller) of the two — slowest cinematic feel wins', () => {
    const stiff = makeRail(0, 0, 0.30);
    const gentle = makeRail(0, 800, 0.08);
    const transit = deriveHubTransitRail(stiff, gentle);
    expect(transit.damping).toBeCloseTo(0.08, 6);
    // Order-independent: same damping selection regardless of arg order.
    const transitRev = deriveHubTransitRail(gentle, stiff);
    expect(transitRev.damping).toBeCloseTo(0.08, 6);
  });

  it('SC-055: deriveHubTransitRail is pure — never mutates either input rail', () => {
    const fromRail = makeRail(0, 0);
    const toRail = makeRail(0, 800);
    const fromSnapshot = JSON.stringify(fromRail);
    const toSnapshot = JSON.stringify(toRail);
    void deriveHubTransitRail(fromRail, toRail);
    expect(JSON.stringify(fromRail)).toBe(fromSnapshot);
    expect(JSON.stringify(toRail)).toBe(toSnapshot);
  });

  it('SC-055: deriveHubTransitRail result is deeply frozen (no downstream mutation)', () => {
    const transit = deriveHubTransitRail(makeRail(0, 0), makeRail(0, 800));
    expect(Object.isFrozen(transit)).toBe(true);
    expect(Object.isFrozen(transit.start)).toBe(true);
    expect(Object.isFrozen(transit.end)).toBe(true);
    expect(Object.isFrozen(transit.start.position)).toBe(true);
    expect(Object.isFrozen(transit.end.target)).toBe(true);
  });

  it('SC-055: evaluateHubTransit at t=0 equals the from-anchor', () => {
    const fromRail = makeRail(0, 0);
    const toRail = makeRail(0, 800);
    const transit = deriveHubTransitRail(fromRail, toRail);
    const at0 = evaluateHubTransit(transit, 0);
    expect(at0.position[0]).toBeCloseTo(fromRail.end.position[0], 6);
    expect(at0.position[1]).toBeCloseTo(fromRail.end.position[1], 6);
    expect(at0.position[2]).toBeCloseTo(fromRail.end.position[2], 6);
    expect(at0.target[0]).toBeCloseTo(fromRail.end.target[0], 6);
  });

  it('SC-055: evaluateHubTransit at t=1 equals the to-anchor', () => {
    const fromRail = makeRail(0, 0);
    const toRail = makeRail(0, 800);
    const transit = deriveHubTransitRail(fromRail, toRail);
    const at1 = evaluateHubTransit(transit, 1);
    expect(at1.position[0]).toBeCloseTo(toRail.end.position[0], 6);
    expect(at1.position[1]).toBeCloseTo(toRail.end.position[1], 6);
    expect(at1.position[2]).toBeCloseTo(toRail.end.position[2], 6);
    expect(at1.target[0]).toBeCloseTo(toRail.end.target[0], 6);
  });

  it('SC-055: evaluateHubTransit at t=0.5 lies strictly between the two anchors (mid-transit frame)', () => {
    // Two hubs offset on X — a horizontal transit so the mid-pose has a
    // distinct X separate from either endpoint. This is the pose the
    // verify-editor-runtimes snapshot proves at runtime.
    const fromRail = makeRail(0, 0);
    const toRail = makeRail(0, 800);
    const transit = deriveHubTransitRail(fromRail, toRail);
    const mid = evaluateHubTransit(transit, 0.5);

    const lo = Math.min(fromRail.end.position[0], toRail.end.position[0]);
    const hi = Math.max(fromRail.end.position[0], toRail.end.position[0]);
    expect(mid.position[0]).toBeGreaterThan(lo);
    expect(mid.position[0]).toBeLessThan(hi);
    // The mid pose is strictly inside the open interval — not at either end.
    expect(mid.position[0]).not.toBe(fromRail.end.position[0]);
    expect(mid.position[0]).not.toBe(toRail.end.position[0]);
  });

  it('SC-055: evaluateHubTransit is monotone along the transit — |pose(t) - fromAnchor| grows non-decreasing as t advances 0→1', () => {
    const fromRail = makeRail(0, 0);
    const toRail = makeRail(0, 800);
    const transit = deriveHubTransitRail(fromRail, toRail);

    const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    const distances = samples.map((t) => {
      const p = evaluateHubTransit(transit, t);
      const dx = p.position[0] - fromRail.end.position[0];
      const dy = p.position[1] - fromRail.end.position[1];
      const dz = p.position[2] - fromRail.end.position[2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    });
    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1] - 1e-9);
    }
  });

  it('SC-055: evaluateHubTransit clamps t outside [0, 1] — input sanitization, no extrapolation past the anchors', () => {
    const fromRail = makeRail(0, 0);
    const toRail = makeRail(0, 800);
    const transit = deriveHubTransitRail(fromRail, toRail);
    const below = evaluateHubTransit(transit, -3);
    const above = evaluateHubTransit(transit, 4);
    expect(below.position[0]).toBeCloseTo(fromRail.end.position[0], 6);
    expect(above.position[0]).toBeCloseTo(toRail.end.position[0], 6);
  });

  it('INV-23: deriveHubTransitRail preserves fov so the framing rule (no scene edges) is carried through the transit', () => {
    // Both hubs share the same fov in the fixture — the transit must NOT
    // emit a wider/narrower fov that would void INV-23's framing math
    // (env-fog from EB-07-03 fills the inter-hub gap on the assumption of a
    // consistent fov throughout the rail).
    const fromRail = makeRail(0, 0);
    const toRail = makeRail(0, 800);
    const transit = deriveHubTransitRail(fromRail, toRail);
    expect(transit.start.fov).toBe(fromRail.end.fov);
    expect(transit.end.fov).toBe(toRail.end.fov);
  });

  it('SC-055: identical-hub transit (A → A) collapses to a stationary rail at the anchor — no jitter from re-entry', () => {
    // When activeHubId is set to its current value (e.g. user clicks the
    // same hub button), the transit must be a no-op pose so the camera
    // does not lerp anywhere.
    const rail = makeRail(0, 0);
    const transit = deriveHubTransitRail(rail, rail);
    const at0 = evaluateHubTransit(transit, 0);
    const at1 = evaluateHubTransit(transit, 1);
    expect(at0.position[0]).toBeCloseTo(at1.position[0], 6);
    expect(at0.position[1]).toBeCloseTo(at1.position[1], 6);
    expect(at0.position[2]).toBeCloseTo(at1.position[2], 6);
  });
});
