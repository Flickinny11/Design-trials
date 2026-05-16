// transforms.ts — EB-09-04 stub. Replaced with real implementation in the
// next commit. This file exists to satisfy the failing-test compile step
// (Ralph TDD discipline: failing test commits first; tests are not edited
// during implementation).
//
// Spec refs:
//   §6 SC-050  Tether-interaction respects coordinate space; one node
//              animating in `hub-scene` can trigger a `viewport-composition`
//              animation on a tethered node via the documented transform
//              pipeline.
//   §7 INV-22  Coordinate systems are never collapsed into one matrix
//              without passing through this pipeline (or equivalent).
//   §4         The fixed 5-space set (RA-03). Pipeline phase splits as
//              compile-time for preview-hub/preview-app and runtime for
//              galaxy ↔ hub-world.
//
// The stub keeps the same public surface as the eventual implementation so
// the test compiles. Every function throws so the test still FAILS at runtime
// (this is what TDD step 6 needs).

import type { PrismKeyframeCoordinateSpace } from './types.ts';

export type CoordinateSpace = PrismKeyframeCoordinateSpace;

export type TransformPhase = 'runtime' | 'compile-time';

export type TransformKind =
  | 'identity'
  | 'projection'
  | 'unprojection'
  | 'runtime-bridge'
  | 'composition'
  | 'scroll-bind'
  | 'camera-lock';

export interface TransformBridge {
  readonly from: CoordinateSpace;
  readonly to: CoordinateSpace;
  readonly phase: TransformPhase;
  readonly kind: TransformKind;
}

export interface TransformContext {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly cameraFov?: number;
  readonly cameraDistance?: number;
  readonly scrollProgress?: number;
  readonly hubWorldPosition?: { x: number; y: number; z: number };
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export const TRANSFORM_REGISTRY: ReadonlyArray<TransformBridge> = [];

// Audit token — the eventual implementation stamps every resolved target
// with this symbol. Callers comparing against it verify INV-22 (the
// documented pipeline was actually invoked).
export const EXERCISED_TRANSFORM_PIPELINE: unique symbol = Symbol(
  'prism.transforms.exercised',
);

export function getTransformBridge(
  _from: CoordinateSpace,
  _to: CoordinateSpace,
): TransformBridge | null {
  throw new Error('EB-09-04 stub: transforms.ts not yet implemented');
}

export function transformVector(
  _v: Vector3,
  _from: CoordinateSpace,
  _to: CoordinateSpace,
  _ctx: TransformContext,
): Vector3 {
  throw new Error('EB-09-04 stub: transforms.ts not yet implemented');
}
