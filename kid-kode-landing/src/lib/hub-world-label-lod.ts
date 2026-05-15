// Hub-world (intra-hub) zoom-based label LOD (SC-021).
//
// SC-021: "Intra-hub zoom-based label LOD: at L1 hub label only; at L3+ node
//          labels appear; at L4 sub-node detail visible."
//
// The spec only constrains L1, L3, and L4 in hub-world. L0 and L2 are
// spec-silent:
//   - L0 (very far) is treated as a continuation of L1 — only the hub label
//     is visible. (Per useGraphEditorStore, L0 cameraDistance > 260 is far
//     enough that the user is almost certainly in galaxy mode anyway; if a
//     stale hub-world camera lands at L0 we still hold the L1 invariant.)
//   - L2 is the transition band between L1 and L3. `showNodeLabels` stays
//     false (so the L1-only invariant holds across the entire pre-L3 half
//     of the ladder), but `nodeLabelOpacity` ramps from 0 → 1 across the L2
//     cameraDistance band so a renderer that lifts the gate can cross-fade.
//   - L3 → L4 is the sub-node-detail transition band. `showSubNodeDetail`
//     stays false at L3 (so the SC-021 endpoint "L4 reveals sub-node detail"
//     is exact) but `subNodeDetailOpacity` ramps from 0 → 1 across the L3
//     cameraDistance band for the same cross-fade reason.
//
// Zoom-level boundaries are owned by `useGraphEditorStore.setCameraDistance`
// (d > 260 → L0, d > 140 → L1, d > 60 → L2, d > 22 → L3, else L4). The L2 +
// L3 bands in this file are hard-coded against those bounds; if the store
// boundaries change, the band constants below must change with them.

import type { ViewMode, ZoomLevel } from '@/stores/useGraphEditorStore';

export interface HubWorldLabelVisibility {
  showHubLabel: boolean;
  showNodeLabels: boolean;
  showSubNodeDetail: boolean;
  hubLabelOpacity: number;
  nodeLabelOpacity: number;
  subNodeDetailOpacity: number;
}

// L2 cameraDistance band from useGraphEditorStore.setCameraDistance.
// (d > 60 && d <= 140) → L2.
const L2_FAR = 140;
const L2_NEAR = 60;

// L3 cameraDistance band.
// (d > 22 && d <= 60) → L3.
// Sub-node detail stays at 0 opacity across most of L3 and only ramps in
// across the near edge of the band (d ≤ L3_RAMP_START), so SC-021's "at L4
// sub-node detail visible" reveal does not bleed visibly into mid-L3.
const L3_RAMP_START = 30;
const L3_NEAR = 22;

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

const ALL_ON: HubWorldLabelVisibility = {
  showHubLabel: true,
  showNodeLabels: true,
  showSubNodeDetail: true,
  hubLabelOpacity: 1,
  nodeLabelOpacity: 1,
  subNodeDetailOpacity: 1,
};

export function computeHubWorldLabelVisibility(
  viewMode: ViewMode,
  zoomLevel: ZoomLevel,
  cameraDistance: number,
): HubWorldLabelVisibility {
  // Non-hub-world modes: leave intra-hub LOD inactive. Galaxy mode has its
  // own LOD predicate (`computeGalaxyLabelVisibility`, SC-014); the other
  // three modes (canvas, preview-hub, preview-app) do not gate node labels
  // on zoom in this spec.
  if (viewMode !== 'hub-world') {
    return { ...ALL_ON };
  }

  // L0, L1 → hub label only.
  if (zoomLevel === 'L0' || zoomLevel === 'L1') {
    return {
      showHubLabel: true,
      showNodeLabels: false,
      showSubNodeDetail: false,
      hubLabelOpacity: 1,
      nodeLabelOpacity: 0,
      subNodeDetailOpacity: 0,
    };
  }

  // L2 → transition band: still hidden by predicate, but compute the ramp
  // so the renderer can prefetch / cross-fade. Closer cameras → higher
  // forward-compat opacity.
  if (zoomLevel === 'L2') {
    const t = clamp01((L2_FAR - cameraDistance) / (L2_FAR - L2_NEAR));
    return {
      showHubLabel: true,
      showNodeLabels: false,
      showSubNodeDetail: false,
      hubLabelOpacity: 1,
      nodeLabelOpacity: t,
      subNodeDetailOpacity: 0,
    };
  }

  // L3 → node labels visible; sub-node detail still hidden but ramping in
  // across the near edge of the band (see L3_RAMP_START above).
  if (zoomLevel === 'L3') {
    const t =
      cameraDistance > L3_RAMP_START
        ? 0
        : clamp01((L3_RAMP_START - cameraDistance) / (L3_RAMP_START - L3_NEAR));
    return {
      showHubLabel: true,
      showNodeLabels: true,
      showSubNodeDetail: false,
      hubLabelOpacity: 1,
      nodeLabelOpacity: 1,
      subNodeDetailOpacity: t,
    };
  }

  // L4 → everything visible.
  return {
    showHubLabel: true,
    showNodeLabels: true,
    showSubNodeDetail: true,
    hubLabelOpacity: 1,
    nodeLabelOpacity: 1,
    subNodeDetailOpacity: 1,
  };
}
