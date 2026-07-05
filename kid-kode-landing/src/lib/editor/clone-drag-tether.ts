// EBR2-F-04 — Clone-drag transient tether geometry.
//
// Spec ref: §R2-F SC-077 — During Clone-drag, a transient tether line
// renders from the cursor's world position to the nearest hub center
// (Euclidean distance via `hub-geometry.findNearestHub`). The tether snaps
// as the cursor crosses hub-bisecting planes.
//
// Contract:
//   - Pure function. No RNG, no clock, no DOM.
//   - Input:  `cursorWorld` (Vector3) — the unprojected cursor position;
//             `hubs` — the current `PrismHub[]` (from the source store).
//   - Output: `{ nearestHubId, tetherStart, tetherEnd }` — plain `{x,y,z}`
//             vectors so the result is serialisable and React-state-safe.
//
// The snap behaviour falls out automatically from `findNearestHub`'s
// Euclidean-distance scan: as `cursorWorld` crosses the bisecting plane
// between two hubs, the nearest-hub answer (and thus `tetherEnd`) flips.

import { Vector3 } from 'three';
import type { PrismHub } from '../prism-graph/types';
import {
  findNearestHub,
  getHubWorldPositions,
} from '../prism-graph/hub-geometry';

export interface CloneDragTether {
  nearestHubId: string;
  tetherStart: { x: number; y: number; z: number };
  tetherEnd: { x: number; y: number; z: number };
}

export function computeCloneDragTether(
  cursorWorld: Vector3,
  hubs: PrismHub[],
): CloneDragTether {
  const { hubId } = findNearestHub(cursorWorld, hubs);
  const positions = getHubWorldPositions(hubs);
  const end = positions.get(hubId)!;
  return {
    nearestHubId: hubId,
    tetherStart: { x: cursorWorld.x, y: cursorWorld.y, z: cursorWorld.z },
    tetherEnd: { x: end.x, y: end.y, z: end.z },
  };
}
