// Galaxy-mode zoom-based label LOD (SC-014).
//
// Stub for TDD: signature matches the test contract; the body is
// deliberately wrong so the EB-03-03 tests fail before implementation.

import type { ViewMode, ZoomLevel } from '@/stores/useGraphEditorStore';

export interface GalaxyLabelVisibility {
  showHubLabels: boolean;
  showNodeLabels: boolean;
  hubLabelOpacity: number;
  nodeLabelOpacity: number;
}

export function computeGalaxyLabelVisibility(
  _viewMode: ViewMode,
  _zoomLevel: ZoomLevel,
  _cameraDistance: number,
): GalaxyLabelVisibility {
  return {
    showHubLabels: true,
    showNodeLabels: true,
    hubLabelOpacity: 1,
    nodeLabelOpacity: 1,
  };
}
