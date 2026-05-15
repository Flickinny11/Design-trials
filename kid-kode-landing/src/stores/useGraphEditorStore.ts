'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type ZoomLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type InspectorTab = 'visual' | 'behavior' | 'code' | 'animation' | 'connections' | 'backend' | 'history' | 'world';
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

  // EB-03-06 / SC-017 — galaxy-mode multi-selection via shift-click. These
  // sets live alongside the singular fields above so the existing
  // single-select Inspector path keeps working unchanged. Both empty until
  // a shift-click promotes a single selection into a group.
  selectedNodeIds: Set<string>;
  selectedHubIds: Set<string>;

  // Inspector
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;

  // Search
  searchOpen: boolean;
  searchQuery: string;

  // Galaxy-mode global filter (EB-03-05 / SC-016). Independent of `search*`:
  // search is for fly-to navigation, filter dims non-matching hubs+nodes.
  filterOpen: boolean;
  filterQuery: string;

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

  // EB-04-01 / SC-019 — drill-in reveal animation timing. `hubRevealAt` is the
  // wall-clock timestamp (Date.now()) of the last galaxy→hub-world drill-in;
  // null when no reveal has been requested. Renderers compute fade-in progress
  // as clamp((Date.now() - hubRevealAt) / hubRevealDurationMs, 0, 1) and apply
  // that to the active hub's nodes / background sphere / intra-hub tethers.
  // The duration is held in `hubRevealDurationMs` and is constrained to ≤ 800.
  hubRevealAt: number | null;
  hubRevealDurationMs: number;

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
  toggleNodeSelection: (id: string) => void;
  toggleHubSelection: (id: string) => void;
  clearMultiSelection: () => void;
  openInspector: (tab?: InspectorTab) => void;
  closeInspector: () => void;
  setInspectorTab: (t: InspectorTab) => void;
  toggleSearch: () => void;
  setSearchQuery: (q: string) => void;
  toggleFilter: () => void;
  setFilterQuery: (q: string) => void;
  clearFilter: () => void;
  openAddNodeDialog: () => void;
  closeAddNodeDialog: () => void;
  toggleFreeze: (id: string) => void;
  setLivePreviewHover: (id: string | null) => void;
  flyToNode: (id: string) => void;
  flyToHub: (hubId: string) => void;
  clearFlyTarget: () => void;
  /**
   * EB-04-01 / SC-018 + SC-019 — galaxy→hub-world drill-in. Atomically:
   *   - viewMode      := 'hub-world'
   *   - selectedHubId := hubId   (INV-20: selection on the clicked hub
   *                               preserved across the transition)
   *   - activeHubId   := hubId
   *   - flyToHubId    := hubId   (reuses existing flyToHub camera signal)
   *   - hubRevealAt   := Date.now()
   *   - multi-selection sets cleared (drill-in collapses to single hub)
   */
  drillIntoHub: (hubId: string) => void;
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
    selectedNodeIds: new Set<string>(),
    selectedHubIds: new Set<string>(),
    inspectorOpen: false,
    inspectorTab: 'visual',
    searchOpen: false,
    searchQuery: '',
    filterOpen: false,
    filterQuery: '',
    addNodeDialogOpen: false,
    frozenNodeIds: new Set<string>(),
    livePreviewHoverId: null,
    flyToNodeId: null,
    flyToHubId: null,
    resetCameraSignal: 0,
    hubRevealAt: null,
    hubRevealDurationMs: 800,
    pinnedPositions: new Map(),
    qualityMode: 'auto',

    setZoomLevel: (l) => set({ zoomLevel: l }),
    setViewMode: (m) =>
      // EB-04-01 / SC-019 — clear the drill-in reveal stamp on any non-drill
      // mode change so a stale hubRevealAt from a prior galaxy→hub-world
      // can't re-trigger the fade-in when the user returns to hub-world via
      // a different path (toolbar toggle, preview→hub-world, etc.).
      // drillIntoHub re-stamps hubRevealAt itself, so it stays authoritative.
      set({ viewMode: m, hubRevealAt: null }),
    setEditorRenderMode: (m) => set({ editorRenderMode: m }),
    setCameraDistance: (d) => {
      const level: ZoomLevel =
        d > 260 ? 'L0' : d > 140 ? 'L1' : d > 60 ? 'L2' : d > 22 ? 'L3' : 'L4';
      set({ cameraDistance: d, zoomLevel: level });
    },
    selectNode: (id) =>
      set({
        selectedNodeId: id,
        selectedHubId: null,
        selectedNodeIds: new Set<string>(),
        selectedHubIds: new Set<string>(),
      }),
    selectHub: (id) =>
      set({
        selectedHubId: id,
        selectedNodeId: null,
        inspectorOpen: true,
        selectedNodeIds: new Set<string>(),
        selectedHubIds: new Set<string>(),
      }),
    hoverNode: (id) => set({ hoveredNodeId: id }),
    // EB-03-06 / SC-017 — shift-click pathway. The first toggle seeds the
    // multi-set with the prior singular `selectedNodeId` so the resulting
    // group has [prev, id]; subsequent toggles add or remove. The singular
    // `selectedNodeId` is kept in sync with the multi-set's "anchor" so a
    // 0-or-1-member set still renders the single-node Inspector: size==0 →
    // clear the singular; size==1 → singular reflects the lone member;
    // size>=2 → leave the singular alone and let the group view supersede.
    toggleNodeSelection: (id) =>
      set((s) => {
        const next = new Set<string>(s.selectedNodeIds);
        if (next.size === 0 && s.selectedNodeId) {
          next.add(s.selectedNodeId);
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        if (next.size === 0) {
          return { selectedNodeIds: next, selectedNodeId: null };
        }
        if (next.size === 1) {
          const only = next.values().next().value as string;
          return { selectedNodeIds: next, selectedNodeId: only };
        }
        // Mirror toggleHubSelection: when the multi-set crosses to >=2, open
        // the inspector so the group view becomes visible without requiring
        // the user to open the panel separately.
        return { selectedNodeIds: next, inspectorOpen: true };
      }),
    toggleHubSelection: (id) =>
      set((s) => {
        const next = new Set<string>(s.selectedHubIds);
        if (next.size === 0 && s.selectedHubId) {
          next.add(s.selectedHubId);
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        // Mirror selectHub's inspector-open side-effect so shift-clicking a
        // hub for the first time still surfaces the panel.
        if (next.size === 0) {
          return { selectedHubIds: next, selectedHubId: null };
        }
        if (next.size === 1) {
          const only = next.values().next().value as string;
          return { selectedHubIds: next, selectedHubId: only, inspectorOpen: true };
        }
        return { selectedHubIds: next, inspectorOpen: true };
      }),
    clearMultiSelection: () =>
      set({
        selectedNodeIds: new Set<string>(),
        selectedHubIds: new Set<string>(),
      }),
    openInspector: (tab) =>
      set((s) => ({ inspectorOpen: true, inspectorTab: tab ?? s.inspectorTab })),
    closeInspector: () => set({ inspectorOpen: false }),
    setInspectorTab: (t) => set({ inspectorTab: t }),
    toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen, searchQuery: '' })),
    setSearchQuery: (q) => set({ searchQuery: q }),
    toggleFilter: () => set((s) => ({ filterOpen: !s.filterOpen })),
    setFilterQuery: (q) => set({ filterQuery: q }),
    clearFilter: () => set({ filterQuery: '' }),
    openAddNodeDialog: () => set({ addNodeDialogOpen: true }),
    closeAddNodeDialog: () => set({ addNodeDialogOpen: false }),
    toggleFreeze: (id) =>
      set((s) => {
        const next = new Set(s.frozenNodeIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        return { frozenNodeIds: next };
      }),
    setLivePreviewHover: (id) => set({ livePreviewHoverId: id }),
    flyToNode: (id) =>
      set({
        flyToNodeId: id,
        selectedNodeId: id,
        selectedHubId: null,
        selectedNodeIds: new Set<string>(),
        selectedHubIds: new Set<string>(),
      }),
    flyToHub: (hubId) => set({ flyToHubId: hubId, activeHubId: hubId }),
    clearFlyTarget: () => set({ flyToNodeId: null, flyToHubId: null }),
    drillIntoHub: (hubId) =>
      set({
        viewMode: 'hub-world',
        selectedHubId: hubId,
        selectedNodeId: null,
        selectedNodeIds: new Set<string>(),
        selectedHubIds: new Set<string>(),
        activeHubId: hubId,
        flyToHubId: hubId,
        hubRevealAt: Date.now(),
        inspectorOpen: true,
      }),
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
