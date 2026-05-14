'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type ZoomLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type InspectorTab = 'visual' | 'behavior' | 'code' | 'animation' | 'connections' | 'backend' | 'history';
export type ViewMode = 'galaxy' | 'hub-world' | 'canvas' | 'preview-hub' | 'preview-app';
/**
 * Legacy mapping kept ONLY for `normalizeViewMode`, which exists so persisted
 * graphs that still carry pre-EB-01 toggle strings can be coerced on load. No
 * runtime code path may assign these literals via `setViewMode` (FP-12 blocks
 * value-site uses, and `setViewMode` is typed `ViewMode` to enforce at the
 * type layer).
 */
export type LegacyViewMode = 'preview' | 'editor' | 'split';
export type AnyViewMode = ViewMode | LegacyViewMode;
export type EditorRenderMode = 'scene' | 'topology';

const LEGACY_VIEW_MODE_TO_CANONICAL: Readonly<Record<LegacyViewMode, ViewMode>> = {
  editor: 'hub-world',
  split: 'canvas',
  preview: 'preview-hub',
};

const CANONICAL_VIEW_MODES: ReadonlySet<ViewMode> = new Set([
  'galaxy',
  'hub-world',
  'canvas',
  'preview-hub',
  'preview-app',
]);

export function normalizeViewMode(m: AnyViewMode): ViewMode {
  return CANONICAL_VIEW_MODES.has(m as ViewMode)
    ? (m as ViewMode)
    : LEGACY_VIEW_MODE_TO_CANONICAL[m as LegacyViewMode];
}

interface GraphEditorState {
  // View
  zoomLevel: ZoomLevel;
  cameraDistance: number;
  activeHubId: string | null;
  /**
   * Canonical 5-mode set only (RA-06). Off-canon literals are blocked at the
   * type layer (this field) and at the source layer (FP-12 in the anti-drift
   * hook). Persisted graphs that still carry pre-EB-01 toggle strings must
   * pass through `normalizeViewMode` at load time.
   */
  viewMode: ViewMode;
  editorRenderMode: EditorRenderMode;

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

  // Add-node dialog (HL13 / Plan §P13)
  addNodeDialogOpen: boolean;

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
  setViewMode: (m: ViewMode) => void;
  setEditorRenderMode: (m: EditorRenderMode) => void;
  selectNode: (id: string | null) => void;
  selectHub: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  openInspector: (tab?: InspectorTab) => void;
  closeInspector: () => void;
  setInspectorTab: (t: InspectorTab) => void;
  toggleSearch: () => void;
  setSearchQuery: (q: string) => void;
  openAddNodeDialog: () => void;
  closeAddNodeDialog: () => void;
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
    // RA-06: legacy 'split' maps to canonical 'canvas'. EB-01-03 narrows the
    // `viewMode` field's type back to `ViewMode` and arms FP-12 against any
    // future legacy literal.
    viewMode: 'canvas',
    editorRenderMode: 'scene',
    selectedNodeId: null,
    selectedHubId: null,
    hoveredNodeId: null,
    inspectorOpen: false,
    inspectorTab: 'visual',
    searchOpen: false,
    searchQuery: '',
    addNodeDialogOpen: false,
    frozenNodeIds: new Set<string>(),
    livePreviewHoverId: null,
    flyToNodeId: null,
    flyToHubId: null,
    resetCameraSignal: 0,
    pinnedPositions: new Map(),
    qualityMode: 'auto',

    setZoomLevel: (l) => set({ zoomLevel: l }),
    setViewMode: (m) => set({ viewMode: m }),
    setEditorRenderMode: (m) => set({ editorRenderMode: m }),
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
    openAddNodeDialog: () => set({ addNodeDialogOpen: true }),
    closeAddNodeDialog: () => set({ addNodeDialogOpen: false }),
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
