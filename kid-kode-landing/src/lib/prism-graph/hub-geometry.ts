// EBR2-F-01 — hub-geometry stub.
//
// Stub committed alongside the failing test so the TypeScript hook can
// resolve the import. Real implementation lands in the next commit per the
// editor-build TDD discipline (failing test → impl → verify).
//
// Spec ref: §R2-F SC-077.

import { Vector3 } from 'three';
import type { PrismHub } from './types';

export function getHubWorldPositions(
  _hubs: PrismHub[],
): Map<string, Vector3> {
  throw new Error('hub-geometry.getHubWorldPositions: not yet implemented');
}

export function findNearestHub(
  _point: Vector3,
  _hubs: PrismHub[],
): { hubId: string; distance: number } {
  throw new Error('hub-geometry.findNearestHub: not yet implemented');
}
