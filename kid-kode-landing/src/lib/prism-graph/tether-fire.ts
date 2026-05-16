// EB-09-03 — Tether-driven interaction on `'triggers'` edges.
//
// Spec refs:
//   §9 SC-049 (verbatim): "Tether-driven interaction: when an edge of type
//     `'triggers'` fires from source node, the target node's bound animations
//     run."
//
// Stub committed alongside the failing test. Real implementation lands in the
// EB-09-03 implementation commit. Throwing here causes the EB-09-03 test
// suite to FAIL at runtime even though tsc compiles, preserving the
// failing-test-first contract.

import type { PrismEdge, PrismKeyframe, PrismNode } from './types';
import type { CinematicPrimitiveRef } from './cinematic-primitives';

export interface TetherFireEvent {
  sourceNodeId: string;
  event?: string;
  firedAt: number;
}

export interface TetherFireResolvedTarget {
  targetNodeId: string;
  edge: PrismEdge;
  boundKeyframes: PrismKeyframe[];
  boundPrimitives: CinematicPrimitiveRef[];
}

export interface TetherFireState {
  readonly fires: ReadonlyArray<{
    edge: PrismEdge;
    startedAt: number;
    durationMs: number;
  }>;
}

export interface ActiveTetherFire {
  edge: PrismEdge;
  startedAt: number;
  durationMs: number;
  progress: number;
}

const NOT_IMPLEMENTED = 'tether-fire: EB-09-03 implementation pending';

export function resolveTetherFireTargets(
  _nodes: ReadonlyArray<PrismNode>,
  _edges: ReadonlyArray<PrismEdge>,
  _fire: TetherFireEvent,
): TetherFireResolvedTarget[] {
  throw new Error(NOT_IMPLEMENTED);
}

export function createTetherFireState(): TetherFireState {
  throw new Error(NOT_IMPLEMENTED);
}

export function fireTether(
  _state: TetherFireState,
  _edge: PrismEdge,
  _now: number,
  _durationMs: number,
): TetherFireState {
  throw new Error(NOT_IMPLEMENTED);
}

export function getActiveTetherFires(
  _state: TetherFireState,
  _now: number,
): ActiveTetherFire[] {
  throw new Error(NOT_IMPLEMENTED);
}
