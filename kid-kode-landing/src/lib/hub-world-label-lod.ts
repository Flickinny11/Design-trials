// Hub-world (intra-hub) zoom-based label LOD — STUB (EB-04-03 in-progress).
//
// SC-021 (Phase 4) will fill this in. Stub returns all-on so tests fail on
// behavior, not at import time.

import type { ViewMode, ZoomLevel } from '@/stores/useGraphEditorStore';

export interface HubWorldLabelVisibility {
  showHubLabel: boolean;
  showNodeLabels: boolean;
  showSubNodeDetail: boolean;
  hubLabelOpacity: number;
  nodeLabelOpacity: number;
  subNodeDetailOpacity: number;
}

export function computeHubWorldLabelVisibility(
  _viewMode: ViewMode,
  _zoomLevel: ZoomLevel,
  _cameraDistance: number,
): HubWorldLabelVisibility {
  return {
    showHubLabel: true,
    showNodeLabels: true,
    showSubNodeDetail: true,
    hubLabelOpacity: 1,
    nodeLabelOpacity: 1,
    subNodeDetailOpacity: 1,
  };
}
