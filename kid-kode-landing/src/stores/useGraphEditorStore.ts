'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type ZoomLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type InspectorTab = 'visual' | 'behavior' | 'code' | 'animation' | 'connections' | 'backend' | 'history';

interface GraphEditorState {
  // View
  zoomLevel: ZoomLevel;
  cameraDistance: number;
  activeHubId: string | null;

  // Selection — node and hub selection are mutually exclusive
  selectedNodeId: string | null;
  selectedHubId: string | null;
  hoveredNodeId: string | null;

  // Inspector
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;

  // Search
  searchOpen: boolean;
  searchQuery: string;

  // Freeze
  frozenNodeIds: Set<string>;

  // Bidirectional hover from preview pane
  livePreviewHoverId: string | null;

  // Camera commands (signal-based so GraphScene picks them up via useEffect)
  flyToNodeId: string | null;
  flyToHubId: string | null;
  resetCameraSignal: number;

  // Drag-pinned node positions
  pinnedPositions: Map<string, { x: number; y: number; z: number }>;

  // Performance
  qualityMode: 'auto' | 'high' | 'medium' | 'low';

  // Actions
  setZoomLevel: (l: ZoomLevel) => void;
  setCameraDistance: (d: number) => void;
  selectNode: (id: string | null) => void;
  selectHub: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  openInspector: (tab?: InspectorTab) => void;
  closeInspector: () => void;
  setInspectorTab: (t: InspectorTab) => void;
  toggleSearch: () => void;
  setSearchQuery: (q: string) => void;
  toggleFreeze: (id: string) => void;
  setLivePreviewHover: (id: string | null) => void;
  flyToNode: (id: string) => void;
  flyToHub: (hubId: string) => void;
  clearFlyTarget: () => void;
  resetCamera: () => void;
  pinNode: (id: string, pos: { x: number; y: number; z: number }) => void;
  clearPinnedPositions: () => void;
  setQualityMode: (m: 'auto' | 'high' | 'medium' | 'low') => void;
}

export const useGraphEditorStore = create<GraphEditorState>()(
  subscribeWithSelector((set) => ({
    zoomLevel: 'L0',
    cameraDistance: 320,
    activeHubId: null,
    selectedNodeId: null,
    selectedHubId: null,
    hoveredNodeId: null,
    inspectorOpen: false,
    inspectorTab: 'visual',
    searchOpen: false,
    searchQuery: '',
    frozenNodeIds: new Set<string>(),
    livePreviewHoverId: null,
    flyToNodeId: null,
    flyToHubId: null,
    resetCameraSignal: 0,
    pinnedPositions: new Map(),
    qualityMode: 'auto',

    setZoomLevel: (l) => set({ zoomLevel: l }),
    setCameraDistance: (d) => {
      const level: ZoomLevel =
        d > 260 ? 'L0' : d > 140 ? 'L1' : d > 60 ? 'L2' : d > 22 ? 'L3' : 'L4';
      set({ cameraDistance: d, zoomLevel: level });
    },
    selectNode: (id) => set({ selectedNodeId: id, selectedHubId: null }),
    selectHub: (id) => set({ selectedHubId: id, selectedNodeId: null, inspectorOpen: true }),
    hoverNode: (id) => set({ hoveredNodeId: id }),
    openInspector: (tab) =>
      set((s) => ({ inspectorOpen: true, inspectorTab: tab ?? s.inspectorTab })),
    closeInspector: () => set({ inspectorOpen: false }),
    setInspectorTab: (t) => set({ inspectorTab: t }),
    toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen, searchQuery: '' })),
    setSearchQuery: (q) => set({ searchQuery: q }),
    toggleFreeze: (id) =>
      set((s) => {
        const next = new Set(s.frozenNodeIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        return { frozenNodeIds: next };
      }),
    setLivePreviewHover: (id) => set({ livePreviewHoverId: id }),
    flyToNode: (id) => set({ flyToNodeId: id, selectedNodeId: id, selectedHubId: null }),
    flyToHub: (hubId) => set({ flyToHubId: hubId, activeHubId: hubId }),
    clearFlyTarget: () => set({ flyToNodeId: null, flyToHubId: null }),
    resetCamera: () =>
      set((s) => ({ resetCameraSignal: s.resetCameraSignal + 1, activeHubId: null })),
    pinNode: (id, pos) =>
      set((s) => {
        const next = new Map(s.pinnedPositions);
        next.set(id, pos);
        return { pinnedPositions: next };
      }),
    clearPinnedPositions: () => set({ pinnedPositions: new Map() }),
    setQualityMode: (m) => set({ qualityMode: m }),
  }))
);
