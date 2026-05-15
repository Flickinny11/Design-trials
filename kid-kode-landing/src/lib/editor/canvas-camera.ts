// EB-05-01 / §5 SC-022, SC-024 — Canvas mode deterministic camera pose.
//
// Pure helper consumed by GraphScene's canvas-mode controls bridge.
//
// Contract:
//   - target == hubCenter (camera FACES the active hub at its exact center).
//   - position.x == hubCenter.x and position.y == hubCenter.y (CENTERED).
//   - position.z == hubCenter.z + standoff.z, with standoff.z > 0
//     (3D depth preserved per SC-024 — camera is offset along +Z, never a
//     flat top-down 2D projection; nodes keep their `scenePosition.z`).
//   - Same hubCenter → identical pose every call (deterministic; SC-027
//     canvas → hub-world → canvas round-trip depends on this).

import type { CameraPose } from '@/stores/useGraphEditorStore';

export type HubCenter = { x: number; y: number; z: number };

// Fixed offset from hub center to camera position. Frozen so the controls
// bridge cannot accidentally mutate it.
export const CANVAS_CAMERA_STANDOFF: Readonly<{ x: number; y: number; z: number }> =
  Object.freeze({ x: 0, y: 0, z: 18 });

export function computeCanvasCameraPose(hubCenter: HubCenter): CameraPose {
  return {
    position: {
      x: hubCenter.x + CANVAS_CAMERA_STANDOFF.x,
      y: hubCenter.y + CANVAS_CAMERA_STANDOFF.y,
      z: hubCenter.z + CANVAS_CAMERA_STANDOFF.z,
    },
    target: {
      x: hubCenter.x,
      y: hubCenter.y,
      z: hubCenter.z,
    },
  };
}

// EB-05-05 / §5 SC-027 — canvas ↔ hub-world round-trip pose restoration.
// When a checkpointed pose exists for `canvas`, return a structural copy of
// it (exact restoration; INV-20). When no checkpoint exists yet, fall back
// to the deterministic SC-022 pose so first-time entry still centers on the
// active hub. The copy is defensive — callers (the controls bridge) feed
// the result to camera-controls without owning the store object.
export function resolveCanvasCameraPose(
  stored: CameraPose | undefined,
  hubCenter: HubCenter,
): CameraPose {
  if (stored) {
    return {
      position: { x: stored.position.x, y: stored.position.y, z: stored.position.z },
      target: { x: stored.target.x, y: stored.target.y, z: stored.target.z },
    };
  }
  return computeCanvasCameraPose(hubCenter);
}
