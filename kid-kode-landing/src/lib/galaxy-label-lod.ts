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
