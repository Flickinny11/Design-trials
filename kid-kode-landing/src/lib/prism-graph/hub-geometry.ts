// EBR2-F-01 — hub-geometry: pure layout + nearest-hub math for galaxy mode.
//
// Spec ref: §R2-F SC-077.
//
// `getHubWorldPositions` reuses the Phase 3 orbital math
// (`computeGalaxyHubCenters` in `src/lib/useForceGraph.ts`): a deterministic
// FNV-1a 32-bit hash of `hubId` selects a ring + angle, the position lives in
// universe space (INV-22), and no RNG or clock is involved. We re-derive the
// math here rather than re-export so this module stays free of
// `'use client'`/React imports and can be consumed by the editor store, the
// drag listener, and the renderer without pulling in `d3-force-3d`.
//
// `findNearestHub` is a linear Euclidean scan. The drag listener (EBR2-F-04)
// runs this at pointer-move rate; expected hub counts are O(10) so the linear
// scan is the right scaling. Tie-breaking is stable: first hub in input order
// wins, so callers can pre-sort if they want a different policy.

import { Vector3 } from 'three';
import type { PrismHub } from './types';

// Mirror of useForceGraph.ts:59-60. Keep these two arrays exactly aligned
// with the source-of-truth there — diverging would break SC-077 visually.
const GALAXY_RING_RADII = [90, 150, 210] as const;
const GALAXY_RING_TILT = [0.04, -0.18, 0.22] as const;

function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function hubWorldPosition(hubId: string): Vector3 {
  const hash = fnv1a32(hubId);
  const ringIdx = (hash >>> 24) % GALAXY_RING_RADII.length;
  const angle = ((hash & 0x00ffffff) / 0x01000000) * Math.PI * 2;
  const radius = GALAXY_RING_RADII[ringIdx];
  const tilt = GALAXY_RING_TILT[ringIdx];
  const yJitter = (((hash >>> 16) & 0xff) / 0xff - 0.5) * radius * 0.18;
  return new Vector3(
    Math.cos(angle) * radius,
    Math.sin(tilt) * radius + yJitter,
    Math.sin(angle) * radius * Math.cos(tilt),
  );
}

export function getHubWorldPositions(
  hubs: PrismHub[],
): Map<string, Vector3> {
  const out = new Map<string, Vector3>();
  for (const h of hubs) {
    out.set(h.hubId, hubWorldPosition(h.hubId));
  }
  return out;
}

export function findNearestHub(
  point: Vector3,
  hubs: PrismHub[],
): { hubId: string; distance: number } {
  if (hubs.length === 0) {
    throw new Error('findNearestHub: hubs array is empty');
  }
  let bestId = hubs[0].hubId;
  let bestDist = point.distanceTo(hubWorldPosition(bestId));
  for (let i = 1; i < hubs.length; i++) {
    const id = hubs[i].hubId;
    const d = point.distanceTo(hubWorldPosition(id));
    if (d < bestDist) {
      bestDist = d;
      bestId = id;
    }
  }
  return { hubId: bestId, distance: bestDist };
}
