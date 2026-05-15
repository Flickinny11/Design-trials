// EB-05-01 stub — kept type-correct so the failing TDD test compiles.
// Real implementation lands in Step 7 of the iteration.

import type { CameraPose } from '@/stores/useGraphEditorStore';

export type HubCenter = { x: number; y: number; z: number };

export const CANVAS_CAMERA_STANDOFF: Readonly<{ x: number; y: number; z: number }> = {
  x: 0,
  y: 0,
  z: 0,
};

export function computeCanvasCameraPose(_hubCenter: HubCenter): CameraPose {
  return {
    position: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
  };
}
