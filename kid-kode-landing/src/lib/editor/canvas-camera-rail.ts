// EBR2-D-01 / §R2-D SC-071 — Canvas-mode OrbitControls guardrails.
//
// STUB: This is the failing-test-first placeholder. The real implementation
// lands in Step 7. Throwing here ensures every test in
// EBR2-D-01.canvas-camera-rail.test.ts fails as required by the TDD contract.

import type { CanvasViewportFrame } from './canvas-viewport-frame';
import type { PrismHub, PrismHubResponsiveBreakpoint } from '../prism-graph/types';

export interface CanvasCameraRail {
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly minPolarAngle: number;
  readonly maxPolarAngle: number;
  readonly minAzimuthAngle: number;
  readonly maxAzimuthAngle: number;
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
  readonly panLimits: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
  };
}

export function computeCanvasCameraRail(
  _hub: PrismHub,
  _breakpoint: PrismHubResponsiveBreakpoint | null | undefined,
  _viewportFrame: CanvasViewportFrame,
): CanvasCameraRail {
  throw new Error('computeCanvasCameraRail: not implemented (TDD stub)');
}
