// hub-transit.ts — EB-10-03 stub. Pure-data surface for SC-055 hub
// transitions. Implementation lands in the same iteration's Step 7; this
// file exists at the failing-test commit so the test compiles against the
// declared types and fails on behavior (red TDD).

import type {
  CompiledCameraPose,
  CompiledCameraRail,
} from './compiled-view.ts';

export function getHubRailAnchor(_rail: CompiledCameraRail): CompiledCameraPose {
  throw new Error('hub-transit: not implemented (EB-10-03 stub)');
}

export function deriveHubTransitRail(
  _fromRail: CompiledCameraRail,
  _toRail: CompiledCameraRail,
): CompiledCameraRail {
  throw new Error('hub-transit: not implemented (EB-10-03 stub)');
}

export function evaluateHubTransit(
  _transitRail: CompiledCameraRail,
  _t: number,
): CompiledCameraPose {
  throw new Error('hub-transit: not implemented (EB-10-03 stub)');
}
