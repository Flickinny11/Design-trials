// EB-08-05 — stub (failing red phase). Real impl follows in Step 7.
import type {
  PrismKeyframe,
  PrismKeyframeCoordinateSpace,
  PrismKeyframeTrigger,
} from './types';
import type { CanvasTransform } from '@/lib/editor/canvas-transform-gizmo';

export interface CaptureKeyframeOptions {
  coordinateSpace?: PrismKeyframeCoordinateSpace;
  trigger?: PrismKeyframeTrigger;
  t?: number;
  ease?: string;
}

export function captureCanvasTransformAsKeyframe(
  _transform: CanvasTransform,
  _opts: CaptureKeyframeOptions = {},
): PrismKeyframe {
  // Intentionally trivial stub — fails the unit tests below until Step 7.
  return { coordinateSpace: 'universe' };
}
