// hub-transit.ts — EB-10-03 / SC-055. Pure-data surface for hub transitions
// in `preview-app` mode.
//
// Spec refs:
//   §10 SC-055  Hub transitions are deterministic and cinematic (damped
//                camera transit between hub-rail anchors).
//   §5  INV-23  Compiled-preview camera is constrained, damped, and bounded.
//                The scene's edges and any blank background are never visible
//                in `preview-hub` or `preview-app`.
//   §8  INV-17  Non-destructive: this module never mutates the source hubs,
//                nodes, world, or either rail it receives.
//
// Composition with the existing camera-rail surface:
//   - `deriveCompiledCameraRail` (camera-rail.ts) builds the per-hub rest
//     rail used by `preview-hub` and as the per-hub "end" of a transit.
//   - `getHubRailAnchor` extracts the rest pose (rail.end) so callers do not
//     reach into the rail shape directly — the anchor is the single point
//     of contact between two rails for transit composition.
//   - `deriveHubTransitRail(from, to)` returns a brand-new
//     `CompiledCameraRail` whose start is the from-hub anchor and whose end
//     is the to-hub anchor. The runtime camera-rail driver applies its
//     existing damped step to this rail; the resulting per-frame pose is the
//     cinematic transit.
//   - `evaluateHubTransit(rail, t)` is the pure evaluator the tests + the
//     verify-editor-runtimes snapshot use to assert a specific mid-transit
//     pose without running the renderer.
//
// INV-23 during the transit: the per-hub rails already frame their hub with
// the wide-enough distance to keep scene edges off-screen. Between two hubs,
// scene.fog (installed via deriveCompiledEnvironmentFog in EB-07-03) fills
// any inter-hub gap so the transit never reveals a blank background. The
// transit must therefore preserve fov along the rail — a narrower fov mid-
// transit would punch a hole through the env-fog band. Hence the assertion
// in the test suite that start.fov === fromAnchor.fov and end.fov ===
// toAnchor.fov.

import type {
  CompiledCameraPose,
  CompiledCameraRail,
} from './compiled-view.ts';

/** Return the rest pose ("rail anchor") of a per-hub damped-cinematic rail.
 *  Pure: never reads fields outside `rail.end`. The anchor is the pose the
 *  camera converges to once damping settles (`getProgress() === 1` in the
 *  runtime driver), and is the canonical endpoint a transit composes with. */
export function getHubRailAnchor(rail: CompiledCameraRail): CompiledCameraPose {
  return rail.end;
}

/** Damping selection: pick the gentler (smaller) of the two hubs' damping
 *  coefficients so the slowest cinematic feel wins. The result is symmetric
 *  in argument order — A→B and B→A use the same damping — which keeps the
 *  transit pose deterministic regardless of navigation direction. */
function selectTransitDamping(
  fromRail: CompiledCameraRail,
  toRail: CompiledCameraRail,
): number {
  return Math.min(fromRail.damping, toRail.damping);
}

/** Build a damped-cinematic transit rail between two per-hub rails.
 *
 *  start = `getHubRailAnchor(fromRail)` (the previous hub's rest pose).
 *  end   = `getHubRailAnchor(toRail)`   (the destination hub's rest pose).
 *  damping = min(fromRail.damping, toRail.damping).
 *
 *  Pure + deterministic — identical inputs produce a deeply equal result,
 *  and neither input rail is mutated. The result and every nested array are
 *  frozen so downstream consumers (PrismHost, camera-rail driver, snapshot
 *  capture) cannot silently mutate the rail. */
export function deriveHubTransitRail(
  fromRail: CompiledCameraRail,
  toRail: CompiledCameraRail,
): CompiledCameraRail {
  const fromAnchor = getHubRailAnchor(fromRail);
  const toAnchor = getHubRailAnchor(toRail);

  // Defensive deep-freeze: callers may pass freshly-constructed poses that
  // are not themselves frozen; freezing the transit's references guarantees
  // the cross-module contract regardless of input rail provenance.
  const start: CompiledCameraPose = Object.freeze({
    position: Object.freeze([
      fromAnchor.position[0],
      fromAnchor.position[1],
      fromAnchor.position[2],
    ] as const) as readonly [number, number, number],
    target: Object.freeze([
      fromAnchor.target[0],
      fromAnchor.target[1],
      fromAnchor.target[2],
    ] as const) as readonly [number, number, number],
    fov: fromAnchor.fov,
  });
  const end: CompiledCameraPose = Object.freeze({
    position: Object.freeze([
      toAnchor.position[0],
      toAnchor.position[1],
      toAnchor.position[2],
    ] as const) as readonly [number, number, number],
    target: Object.freeze([
      toAnchor.target[0],
      toAnchor.target[1],
      toAnchor.target[2],
    ] as const) as readonly [number, number, number],
    fov: toAnchor.fov,
  });

  return Object.freeze({
    mode: 'damped-cinematic' as const,
    start,
    end,
    damping: selectTransitDamping(fromRail, toRail),
  });
}

function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): readonly [number, number, number] {
  return Object.freeze([
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ] as const);
}

/** Evaluate the transit pose at parameter `t ∈ [0, 1]`. Out-of-range `t` is
 *  clamped — never extrapolates past either anchor (the camera must stay
 *  between the two rest poses to keep INV-23 framing intact).
 *
 *  Identical-rail transit (A → A) collapses to a stationary pose at the
 *  anchor — the deep-frozen position/target/fov on `transitRail.start` and
 *  `.end` are numerically equal, so the lerp is a no-op at every `t`.
 *
 *  Pure: never mutates `transitRail`. Returns a fresh frozen pose. */
export function evaluateHubTransit(
  transitRail: CompiledCameraRail,
  t: number,
): CompiledCameraPose {
  const u = clamp01(t);
  return Object.freeze({
    position: lerp3(transitRail.start.position, transitRail.end.position, u),
    target: lerp3(transitRail.start.target, transitRail.end.target, u),
    fov: lerp(transitRail.start.fov, transitRail.end.fov, u),
  });
}
