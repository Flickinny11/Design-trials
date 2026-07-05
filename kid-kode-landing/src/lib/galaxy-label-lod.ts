// Galaxy-mode zoom-based label LOD (SC-014).
//
// SC-014: "At zoomLevel L0 only App_Name_World + hub names visible; at L2+
// node-cluster labels become visible."
//
// The spec is silent on L1 in galaxy mode. We treat L1 as the transition
// band: `showNodeLabels` is `false` (so the L0 invariant holds across the
// whole zoomed-out half of the ladder) but `nodeLabelOpacity` ramps from
// 0 → 1 across the L1 cameraDistance band. Callers that lift the early-
// return can drive a true cross-fade off the ramp; today the renderer uses
// `showNodeLabels` as the gate and the ramp value is forwarded to `<Html>`
// for forward-compat, not yet observed visually.
//
// Zoom-level boundaries are owned by `useGraphEditorStore.setCameraDistance`
// (d > 260 → L0, d > 140 → L1, d > 60 → L2, d > 22 → L3, else L4). The L1
// band in this file is hard-coded against those bounds; if the store
// boundaries change, the band constants below must change with them.

import type { ViewMode, ZoomLevel } from '@/stores/useGraphEditorStore';

export interface GalaxyLabelVisibility {
  showHubLabels: boolean;
  showNodeLabels: boolean;
  hubLabelOpacity: number;
  nodeLabelOpacity: number;
}

// L1 cameraDistance band from useGraphEditorStore.setCameraDistance.
// (d > 60 && d <= 140) → L1.
const L1_FAR = 140; // upper bound of L1 (just inside L0 → ramp starts here)
const L1_NEAR = 60; // L1→L2 boundary (ramp ends here, labels become fully visible)

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function computeGalaxyLabelVisibility(
  viewMode: ViewMode,
  zoomLevel: ZoomLevel,
  cameraDistance: number,
): GalaxyLabelVisibility {
  // Non-galaxy modes: leave label visibility unchanged. SC-021 (Phase 4)
  // will add hub-world-specific intra-hub LOD; until that task lands,
  // this predicate is a no-op outside galaxy.
  if (viewMode !== 'galaxy') {
    return {
      showHubLabels: true,
      showNodeLabels: true,
      hubLabelOpacity: 1,
      nodeLabelOpacity: 1,
    };
  }

  // Galaxy mode. Hub labels (App_Name_World's orbiting hub names) are
  // always visible per SC-014.
  if (zoomLevel === 'L0') {
    return {
      showHubLabels: true,
      showNodeLabels: false,
      hubLabelOpacity: 1,
      nodeLabelOpacity: 0,
    };
  }

  if (zoomLevel === 'L1') {
    // Transition band: hidden by predicate, but compute the ramp so the
    // renderer can prefetch / cross-fade. Closer cameras → higher opacity.
    // Linear interpolate cameraDistance from [L1_FAR, L1_NEAR] to [0, 1].
    const t = clamp01((L1_FAR - cameraDistance) / (L1_FAR - L1_NEAR));
    return {
      showHubLabels: true,
      showNodeLabels: false,
      hubLabelOpacity: 1,
      nodeLabelOpacity: t,
    };
  }

  // L2, L3, L4 → node-cluster labels fully visible per SC-014.
  return {
    showHubLabels: true,
    showNodeLabels: true,
    hubLabelOpacity: 1,
    nodeLabelOpacity: 1,
  };
}

// Per-label LOD at element-detail zoom (L2+).
//
// SC-014 turns *all* node-cluster labels on at once at L2+. With a dense
// graph that paints every name at full opacity, so labels collide into an
// unreadable mass. This helper computes a per-label opacity/scale multiplier
// the NodeLabels renderer applies on top of the mode-wide `nodeLabelOpacity`
// above, so distant / low-priority labels recede while the few that matter
// stay crisp.
//
// Two independent fades multiply together:
//   1. Distance fade — a non-focused label dims smoothly as its world-space
//      distance approaches `maxDistance` (the cull horizon). At distance 0 the
//      distance factor is 1; at `maxDistance` it hits the floor.
//   2. Density fade — when the on-screen count is high, only the nearest
//      `KEEP_OPAQUE` labels (by `densityRank`, 0 = nearest) stay full; the rest
//      ramp down to the floor across the remaining ranks. Below the crowd
//      threshold density never bites, so sparse scenes read fully.
//
// The floor (`OPACITY_FLOOR`) keeps faded labels barely present rather than
// vanishing — they stop overlapping into a mass but still hint at structure.
// Focused labels (hovered / selected / nearest) always render at full
// opacity and scale, bypassing both fades. Pure and deterministic; opacity is
// clamped to [0, 1].

export interface PerLabelLod {
  opacity: number;
  scale: number;
}

// Density fade only engages once the visible label count crosses this many;
// below it the scene isn't crowded enough to need thinning.
const CROWD_THRESHOLD = 8;
// Number of nearest non-focused labels held fully opaque under crowding.
const KEEP_OPAQUE = 6;
// Lower bound for faded labels — never fully invisible, just receded.
const OPACITY_FLOOR = 0.12;
// Smallest scale a distant non-focused label shrinks to.
const MIN_SCALE = 0.8;

export function computePerLabelLod(input: {
  distance: number;
  maxDistance: number;
  isFocused: boolean;
  densityRank: number;
  visibleCount: number;
}): PerLabelLod {
  const { distance, maxDistance, isFocused, densityRank, visibleCount } = input;

  // Focused labels are exempt from every fade.
  if (isFocused) {
    return { opacity: 1, scale: 1 };
  }

  // Distance fade: 1 at the camera, → 0 at the cull horizon. Guard against a
  // zero/negative horizon so we never divide by zero.
  const span = maxDistance > 0 ? maxDistance : 1;
  const distanceFactor = clamp01(1 - distance / span);

  // Density fade: full until the crowd threshold; past it, the nearest
  // KEEP_OPAQUE ranks stay full and the remainder ramp toward the floor. The
  // ramp width is the number of crowded-out labels beyond KEEP_OPAQUE.
  let densityFactor = 1;
  if (visibleCount > CROWD_THRESHOLD && densityRank >= KEEP_OPAQUE) {
    const rampWidth = Math.max(1, visibleCount - KEEP_OPAQUE);
    densityFactor = clamp01(1 - (densityRank - KEEP_OPAQUE) / rampWidth);
  }

  // Combine fades and lift to the floor so labels recede but never vanish.
  const combined = distanceFactor * densityFactor;
  const opacity = OPACITY_FLOOR + (1 - OPACITY_FLOOR) * combined;

  // Scale gently shrinks with distance only (1 → MIN_SCALE), independent of
  // the density thinning so crowded-but-near labels keep their size.
  const scale = MIN_SCALE + (1 - MIN_SCALE) * distanceFactor;

  return { opacity: clamp01(opacity), scale };
}
