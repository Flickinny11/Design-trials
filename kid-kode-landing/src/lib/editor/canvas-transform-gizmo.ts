// EB-05-03 / §6 Phase 5 SC-025 + Phase 8 SC-042 — Canvas-mode per-node
// transform handles. Pure helper consumed by GraphScene's
// <CanvasTransformGizmo /> wiring. The gizmo cycle is:
//
//   1. Selection in canvas mode  → capture priorCanvasTransform snapshot.
//   2. User drags the gizmo      → buildCanvasTransformFromPose(threeObject)
//                                  writes through updateNode({canvasTransform})
//                                  (NEVER scenePosition — SC-042 / FP-04).
//   3. User releases             → snapshot stays; commit is the current state.
//   4. User presses Escape       → restorePriorCanvasTransform(snapshot)
//                                  rewinds the store to the captured state.
//
// Keyboard mode-switching: 'g' translate, 'r' rotate, 's' scale (Blender-style).

import type { CanvasTransform } from '@/lib/prism-graph/types';

export type { CanvasTransform };
export type GizmoMode = 'translate' | 'rotate' | 'scale';

// Frozen so callers cannot accidentally mutate the shared identity.
export const CANVAS_TRANSFORM_IDENTITY: Readonly<CanvasTransform> = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
});

function cloneCanvasTransform(t: CanvasTransform): CanvasTransform {
  return {
    x: t.x,
    y: t.y,
    z: t.z,
    rotationX: t.rotationX,
    rotationY: t.rotationY,
    rotationZ: t.rotationZ,
    scaleX: t.scaleX,
    scaleY: t.scaleY,
    scaleZ: t.scaleZ,
  };
}

export function readCanvasTransform(
  node: { canvasTransform?: CanvasTransform },
): CanvasTransform {
  if (!node.canvasTransform) return cloneCanvasTransform(CANVAS_TRANSFORM_IDENTITY);
  return cloneCanvasTransform(node.canvasTransform);
}

// STEP8 canvas-spec SC-9 — read a node's authored `scenePosition` as a full
// transform (legacy graphs carry only x/y/z or nothing). Returns a fresh
// CanvasTransform-shaped record (structurally identical to ScenePosition) so
// the gizmo's add/multiply math is shared with the canvasTransform path.
export function readSceneTransform(
  node: { scenePosition?: Partial<CanvasTransform> },
): CanvasTransform {
  const s = node.scenePosition;
  if (!s) return cloneCanvasTransform(CANVAS_TRANSFORM_IDENTITY);
  return {
    x: s.x ?? 0,
    y: s.y ?? 0,
    z: s.z ?? 0,
    rotationX: s.rotationX ?? 0,
    rotationY: s.rotationY ?? 0,
    rotationZ: s.rotationZ ?? 0,
    scaleX: s.scaleX ?? 1,
    scaleY: s.scaleY ?? 1,
    scaleZ: s.scaleZ ?? 1,
  };
}

export function buildCanvasTransformFromPose(pose: {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}): CanvasTransform {
  return {
    x: pose.position.x,
    y: pose.position.y,
    z: pose.position.z,
    rotationX: pose.rotation.x,
    rotationY: pose.rotation.y,
    rotationZ: pose.rotation.z,
    scaleX: pose.scale.x,
    scaleY: pose.scale.y,
    scaleZ: pose.scale.z,
  };
}

export function restorePriorCanvasTransform(prior: CanvasTransform): CanvasTransform {
  return cloneCanvasTransform(prior);
}

export function gizmoModeForKey(key: string): GizmoMode | null {
  if (key === 'g') return 'translate';
  if (key === 'r') return 'rotate';
  if (key === 's') return 'scale';
  return null;
}
