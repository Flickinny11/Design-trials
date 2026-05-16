// EB-08-05 / §6 SC-042 + SC-045 — Transform-edit ↔ keyframe-capture bridge.
//
// Pure helper that snapshots a canvas-mode CanvasTransform into a
// PrismKeyframe. The canvas-mode default coordinate space is 'hub-scene' —
// each node lives in its hub's local 3D scene while the gizmo is editing it,
// and the canvas mode is the in-editor compose surface for that scene.
// Callers (the Inspector Animation tab) may override coordinateSpace /
// trigger / t / ease via opts so the user-selected pickers (SC-045) flow
// through into the captured keyframe.
//
// Invariants honored here:
//   - INV-21 / FP-08: every keyframe declares its coordinateSpace from the
//     canonical 5 (the discriminator is REQUIRED on PrismKeyframe and we
//     never omit it, even on the trivial path).
//   - INV-17 / FP-04: this module is named `keyframe-capture`, NOT
//     `compile*|organize*|previewHub*|previewApp*` — it is intentionally
//     allowed to read transform fields. It does NOT mutate scenePosition or
//     any canvasTransform on the source graph (the caller persists the
//     returned keyframe through useGraphSourceStore.updateNode).
//   - INV-18 (additive): no rename / removal of any existing field anywhere
//     in this module's API surface.

import type { CanvasTransform } from '@/lib/editor/canvas-transform-gizmo';
import type {
  PrismKeyframe,
  PrismKeyframeCoordinateSpace,
  PrismKeyframeTrigger,
} from './types';

export interface CaptureKeyframeOptions {
  coordinateSpace?: PrismKeyframeCoordinateSpace;
  trigger?: PrismKeyframeTrigger;
  t?: number;
  ease?: string;
}

// Canvas-mode default per haltCheck: a captured pose lives in the active
// hub's local 3D scene. The picker in the Inspector Animation tab can
// override this for non-canvas authoring (timeline / scroll / viewport).
const DEFAULT_CANVAS_COORDINATE_SPACE: PrismKeyframeCoordinateSpace = 'hub-scene';

export function captureCanvasTransformAsKeyframe(
  transform: CanvasTransform,
  opts: CaptureKeyframeOptions = {},
): PrismKeyframe {
  const params: Record<string, number> = {
    translateX: transform.x,
    translateY: transform.y,
    translateZ: transform.z,
    rotateX: transform.rotationX,
    rotateY: transform.rotationY,
    rotateZ: transform.rotationZ,
    scale: (transform.scaleX + transform.scaleY + transform.scaleZ) / 3,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    scaleZ: transform.scaleZ,
  };
  const kf: PrismKeyframe = {
    coordinateSpace: opts.coordinateSpace ?? DEFAULT_CANVAS_COORDINATE_SPACE,
    params,
  };
  if (typeof opts.t === 'number') kf.t = opts.t;
  if (opts.trigger !== undefined) kf.trigger = opts.trigger;
  if (opts.ease !== undefined) kf.ease = opts.ease;
  return kf;
}
