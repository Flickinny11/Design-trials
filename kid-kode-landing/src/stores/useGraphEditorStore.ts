'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { GizmoMode } from '@/lib/editor/canvas-transform-gizmo';

export type ZoomLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type InspectorTab = 'visual' | 'material' | 'behavior' | 'code' | 'animation' | 'connections' | 'backend' | 'history' | 'world';
/**
 * EBR2-A-02 / §R2-A SC-065 / INV-24 / RA-06b — canonical 3-mode set.
 * Round-1's `hub-world` folds into `canvas`; `preview-hub` folds into
 * `preview-app`. No off-canon literal is permitted at the type layer
 * (this field), the value layer (FP-12 v1.1), or the literal layer
 * anywhere under `src/` (FP-14).
 */
export type ViewMode = 'galaxy' | 'canvas' | 'preview-app';
export type EditorRenderMode = 'scene' | 'topology';
/**
 * EBR2-C-01 / §R2-C SC-068 — two-step authoring contract for canvas mode.
 * Selecting a node alone does not surface transform handles; the Inspector
 * Edit button must explicitly flip `editorMode` to `'edit'` first. Any
 * selection change (selectNode, selectHub, flyToNode, drillIntoHub) resets
 * to `'idle'` so the gizmo never lingers on a stale selection.
 */
export type EditorMode = 'idle' | 'edit';

// CANVAS-FINAL — Change Artifact wizard (canvas-spec §12) sub-flow. 'launch' is
// the Upload-or-Prompt chooser; 'upload' is §12.1; 'prompt' is §12.2.
export type ChangeArtifactFlow = 'launch' | 'upload' | 'prompt';

// EB-04-04 / §1 INV-20 / §5 SC-022, SC-027 — per-mode camera pose checkpoint.
// Selection survives every mode transition (already invariant), but camera
// pose is mode-specific: each mode keeps its own pose so that re-entering a
// previously-visited mode restores the camera exactly as the user left it.
export type CameraPose = {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
};

// APP-REALITY P1 — live canvas-mode camera read-out (azimuth/polar/distance),
// pushed each frame by SceneControlsBridge and rendered by the CanvasCameraHud
// angle readout. `azimuthDeg`/`polarDeg` are degrees; "straight-on / zero" is
// azimuth 0°, polar 90° (tilt = polarDeg - 90). Null whenever the camera is not
// the free canvas-edit camera (galaxy / preview-app). Throttled to real motion.
export type CanvasView = {
  azimuthDeg: number;
  polarDeg: number;
  distance: number;
};

interface GraphEditorState {
  // View
  zoomLevel: ZoomLevel;
  cameraDistance: number;
  activeHubId: string | null;
  /**
   * Canonical 3-mode set only (RA-06b). Off-canon literals are blocked at
   * the type layer (this field), at the source layer (FP-12 v1.1 in the
   * anti-drift hook), and at the literal layer (FP-14).
   */
  viewMode: ViewMode;
  editorRenderMode: EditorRenderMode;
  /**
   * EBR2-C-01 / §R2-C SC-068 — gates the CanvasTransformGizmo. `'idle'` is
   * the default; the Inspector Edit button flips it to `'edit'`. Any
   * selection-change action resets it back to `'idle'` so the gizmo never
   * persists across a fresh selection.
   */
  editorMode: EditorMode;
  /**
   * STEP8 canvas-toolbar Transform group (canvas-spec §5) — the active gizmo
   * axis-set the CanvasTransformGizmo renders while in edit mode. Lifted to the
   * store so the toolbar's Move / Rotate / Scale buttons and the Blender-style
   * g/r/s keyboard shortcuts drive the same value. Defaults to 'translate'.
   */
  canvasGizmoMode: GizmoMode;

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

  // CANVAS-FINAL — Change Artifact wizard (canvas-spec §12). Targets a node
  // (normally the selected one) and opens the Upload (§12.1) / Prompt (§12.2)
  // flows. `changeArtifactNodeId` is the node whose artifact is being
  // regenerated/replaced; null is only transient before a target resolves.
  changeArtifactOpen: boolean;
  changeArtifactNodeId: string | null;
  changeArtifactFlow: ChangeArtifactFlow;

  // Freeze
  frozenNodeIds: Set<string>;

  // Bidirectional hover from preview pane
  livePreviewHoverId: string | null;

  // Camera commands (signal-based so GraphScene picks them up via useEffect)
  flyToNodeId: string | null;
  flyToHubId: string | null;
  resetCameraSignal: number;
  // APP-REALITY P1 — canvas "reset view to zero" (straight-on). Distinct from
  // resetCamera (which clears activeHubId, a galaxy gesture): this re-centers
  // the free canvas-edit camera to the deterministic straight-on pose on the
  // ACTIVE hub without dropping the hub. SceneControlsBridge + CanvasCameraHud
  // both watch the signal (bridge re-poses; HUD pulses + haptic).
  resetViewSignal: number;
  // APP-REALITY P1 — live canvas camera read-out (null off the canvas camera).
  canvasView: CanvasView | null;

  // EB-04-01 / SC-019 — drill-in reveal animation timing. `hubRevealAt` is the
  // wall-clock timestamp (Date.now()) of the last galaxy→canvas drill-in;
  // null when no reveal has been requested. Renderers compute fade-in progress
  // as clamp((Date.now() - hubRevealAt) / hubRevealDurationMs, 0, 1) and apply
  // that to the active hub's nodes / background sphere / intra-hub tethers.
  // The duration is held in `hubRevealDurationMs` and is constrained to ≤ 800.
  hubRevealAt: number | null;
  hubRevealDurationMs: number;

  // Drag-pinned node positions
  pinnedPositions: Map<string, { x: number; y: number; z: number }>;

  // EB-04-04 / §1 INV-20 — per-mode camera-pose checkpoints. Empty until a
  // mode's controls write its current pose via `checkpointCameraPose`.
  cameraPoseByMode: Partial<Record<ViewMode, CameraPose>>;

  // EBR2-E-04 / §R2-E SC-074 + INV-26 + RA-16 — per-node rebuild-version
  // counter. Incremented by `bumpNodeRebuildVersion(nodeId)` from the
  // Save-and-Rebuild orchestrator (`src/lib/editor/rebuild-node.ts`). The
  // `AssembledSceneNode` parent keys its child by `nodeId + ':' + version`,
  // so a bump remounts *exactly one* wrapper group — the THREE.Object3D
  // identity for the rebuilt node changes; siblings' identities stay stable.
  nodeRebuildVersion: Record<string, number>;

  // EBR2-F-03 / §R2-F SC-075 — the id of the node currently attached to the
  // cursor for the Clone-drag flow. Set by the Inspector "Clone" button to
  // the freshly-cloned node id; cleared on pointer-up by EBR2-F-05 once the
  // clone commits to its nearest hub. Selection state is independent: per
  // INV-20, `selectedNodeId` survives the auto-switch into galaxy.
  draggingNodeId: string | null;

  // EBR2-F-04 / §R2-F SC-077 — Clone-drag listener output. While
  // `draggingNodeId != null` in galaxy mode, the pointermove handler
  // unprojects the cursor to a world point and resolves the nearest hub via
  // `hub-geometry.findNearestHub`. Both slots are independent of
  // `draggingNodeId`; EBR2-F-05's pointer-up commit is responsible for
  // clearing all three together.
  draggingPointerWorld: { x: number; y: number; z: number } | null;
  draggingNearestHubId: string | null;

  // Performance
  qualityMode: 'auto' | 'high' | 'medium' | 'low';

  // Actions
  setZoomLevel: (l: ZoomLevel) => void;
  setCameraDistance: (d: number) => void;
  setViewMode: (m: ViewMode) => void;
  setEditorRenderMode: (m: EditorRenderMode) => void;
  /**
   * EBR2-C-01 / §R2-C SC-068 — Inspector Edit button flips this. Selection
   * changes call this implicitly via the actions below, never directly from
   * the click handler.
   */
  setEditorMode: (m: EditorMode) => void;
  /**
   * STEP8 — set the active transform-gizmo axis set (translate/rotate/scale).
   * Called by the toolbar Transform buttons and the g/r/s shortcuts.
   */
  setCanvasGizmoMode: (m: GizmoMode) => void;
  selectNode: (id: string | null) => void;
  selectHub: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  toggleNodeSelection: (id: string) => void;
  toggleHubSelection: (id: string) => void;
  /**
   * STEP8 canvas-toolbar Selection group (canvas-spec §14) — set the multi-
   * selection set wholesale (used by the marquee tool and Group operations).
   * Mirrors toggleNodeSelection's anchor semantics: size 0 → clear singular;
   * size 1 → singular reflects the lone member; size ≥2 → group view. Resets
   * editorMode so the gizmo never lingers on a stale selection.
   */
  setMultiSelection: (ids: string[]) => void;
  clearMultiSelection: () => void;
  openInspector: (tab?: InspectorTab) => void;
  closeInspector: () => void;
  setInspectorTab: (t: InspectorTab) => void;
  // EB-04-04 — record the current camera pose for `mode`. Pure store
  // mutation; the GraphScene ControlsBridge becomes the caller in Phase 5.
  checkpointCameraPose: (mode: ViewMode, pose: CameraPose) => void;
  toggleSearch: () => void;
  setSearchQuery: (q: string) => void;
  toggleFilter: () => void;
  setFilterQuery: (q: string) => void;
  clearFilter: () => void;
  openAddNodeDialog: () => void;
  closeAddNodeDialog: () => void;
  // CANVAS-FINAL — Change Artifact wizard controls.
  openChangeArtifact: (nodeId: string | null, flow?: ChangeArtifactFlow) => void;
  closeChangeArtifact: () => void;
  setChangeArtifactFlow: (flow: ChangeArtifactFlow) => void;
  toggleFreeze: (id: string) => void;
  setLivePreviewHover: (id: string | null) => void;
  flyToNode: (id: string) => void;
  flyToHub: (hubId: string) => void;
  clearFlyTarget: () => void;
  // APP-REALITY P1 — bump the reset-view-to-zero signal (canvas straight-on).
  resetViewToZero: () => void;
  // APP-REALITY P1 — SceneControlsBridge pushes the live canvas camera angles.
  setCanvasView: (v: CanvasView | null) => void;
  /**
   * EB-04-01 / SC-018 + SC-019 — galaxy→canvas drill-in (RA-06b: the
   * intra-hub authoring mode is now `canvas`). Atomically:
   *   - viewMode      := 'canvas'
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
  /**
   * EBR2-E-04 / §R2-E SC-074 — increment the per-node rebuild-version
   * counter. Other nodes' versions are untouched (RA-16: "other nodes are
   * not touched"). The keyed `AssembledSceneNode` then remounts only the
   * target node's wrapper group on the next render frame.
   */
  bumpNodeRebuildVersion: (nodeId: string) => void;

  /**
   * EBR2-F-03 / §R2-F SC-075 / FP-11 — action setter for the Clone-drag
   * slot. The Inspector Clone button calls this with the freshly-cloned
   * node id after `cloneNode`; EBR2-F-05 will clear it on pointer-up
   * commit. Direct mutation (`useGraphEditorStore.getState().draggingNodeId
   * = …`) is forbidden by FP-11; consumers must route through this action.
   */
  setDraggingNode: (id: string | null) => void;

  /**
   * EBR2-F-04 / §R2-F SC-077 — pointermove handler routes the unprojected
   * cursor-world position through this setter. The galaxy-drag overlay
   * reads `draggingPointerWorld` for the tether-start endpoint, and the
   * resolved `draggingNearestHubId` for the snap target.
   */
  setDraggingPointerWorld: (p: { x: number; y: number; z: number } | null) => void;
  setDraggingNearestHub: (hubId: string | null) => void;

  /**
   * EBR2-F-05 / §R2-F SC-076 — Pointer-up commit clears all three drag
   * slots in lockstep. Selection (selectedNodeId) is intentionally NOT
   * touched: per INV-20 the clone stays selected at its new parent so the
   * Inspector follows the committed entry.
   */
  clearDraggingClone: () => void;

  // ── §13 prebuilt element library (criterion 21) ───────────────────────────
  /** Whether the premium element-library browser is open (root-mounted modal,
   *  mirroring the changeArtifact* mounting pattern). */
  libraryOpen: boolean;
  openLibrary: () => void;
  closeLibrary: () => void;
  /** The cluster id currently being drag-placed, or null when idle. The
   *  galaxy/canvas placement layer keys on this (analogous to draggingNodeId
   *  for clone-drag, but there is no node yet — the cluster spawns on commit).
   *  The live tether reuses the generic draggingPointerWorld + draggingNearestHubId
   *  slots (placement and clone-drag are mutually exclusive). */
  placingClusterId: string | null;
  setPlacingCluster: (clusterId: string | null) => void;
  /** Clear the placement slot + the shared tether slots in lockstep (pointer-up
   *  commit / cancel). Selection is set by the placement commit, not here. */
  clearPlacement: () => void;
}

export const useGraphEditorStore = create<GraphEditorState>()(
  subscribeWithSelector((set) => ({
    zoomLevel: 'L0',
    cameraDistance: 320,
    activeHubId: null,
    // RA-06b / RA-17 — default boot mode is `preview-app` (the prototype is,
    // first and foremost, a runtime preview surface). EBR2-A-03 verifies the
    // boot-state round-trip; this field sets the default value.
    viewMode: 'preview-app',
    editorRenderMode: 'scene',
    // EBR2-C-01 / §R2-C SC-068 — handles never render on selection alone;
    // the Inspector Edit button must flip this to 'edit' first.
    editorMode: 'idle',
    // STEP8 — default transform gizmo axis set.
    canvasGizmoMode: 'translate',
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
    changeArtifactOpen: false,
    changeArtifactNodeId: null,
    changeArtifactFlow: 'launch',
    frozenNodeIds: new Set<string>(),
    livePreviewHoverId: null,
    flyToNodeId: null,
    flyToHubId: null,
    resetCameraSignal: 0,
    resetViewSignal: 0,
    canvasView: null,
    hubRevealAt: null,
    hubRevealDurationMs: 800,
    pinnedPositions: new Map(),
    cameraPoseByMode: {},
    nodeRebuildVersion: {},
    // EBR2-F-03 / §R2-F SC-075 — null until the Inspector Clone button
    // fires; EBR2-F-05's pointer-up commit clears it back to null.
    draggingNodeId: null,
    // EBR2-F-04 / §R2-F SC-077 — null until the galaxy-mode drag listener
    // first fires pointermove with `draggingNodeId` set. EBR2-F-05 clears
    // all three drag slots together on the pointer-up commit.
    draggingPointerWorld: null,
    draggingNearestHubId: null,
    qualityMode: 'auto',

    setZoomLevel: (l) => set({ zoomLevel: l }),
    setViewMode: (m) =>
      // EB-04-01 / SC-019 — clear the drill-in reveal stamp on any non-drill
      // mode change so a stale hubRevealAt from a prior galaxy→canvas
      // can't re-trigger the fade-in when the user returns to canvas via
      // a different path (toolbar toggle, preview→canvas, etc.).
      // drillIntoHub re-stamps hubRevealAt itself, so it stays authoritative.
      set({ viewMode: m, hubRevealAt: null }),
    setEditorRenderMode: (m) => set({ editorRenderMode: m }),
    // EBR2-C-01 / §R2-C SC-068 — Inspector Edit toggle. Selection-reset is
    // handled inside the selection actions (selectNode/selectHub/flyToNode/
    // drillIntoHub), not here.
    setEditorMode: (m) => set({ editorMode: m }),
    // STEP8 — toolbar Transform buttons + g/r/s shortcuts converge here.
    setCanvasGizmoMode: (m) => set({ canvasGizmoMode: m }),
    setCameraDistance: (d) => {
      const level: ZoomLevel =
        d > 260 ? 'L0' : d > 140 ? 'L1' : d > 60 ? 'L2' : d > 22 ? 'L3' : 'L4';
      set({ cameraDistance: d, zoomLevel: level });
    },
    selectNode: (id) =>
      // EBR2-C-01 / §R2-C SC-068 — selection change resets editorMode so the
      // gizmo never persists onto a fresh selection.
      set({
        selectedNodeId: id,
        selectedHubId: null,
        selectedNodeIds: new Set<string>(),
        selectedHubIds: new Set<string>(),
        editorMode: 'idle',
      }),
    selectHub: (id) =>
      // EBR2-C-01 — selection change resets editorMode (see selectNode).
      set({
        selectedHubId: id,
        selectedNodeId: null,
        inspectorOpen: true,
        selectedNodeIds: new Set<string>(),
        selectedHubIds: new Set<string>(),
        editorMode: 'idle',
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
        if (next.size === 0) {
          return { selectedHubIds: next, selectedHubId: null };
        }
        if (next.size === 1) {
          const only = next.values().next().value as string;
          return { selectedHubIds: next, selectedHubId: only, inspectorOpen: true };
        }
        return { selectedHubIds: next, inspectorOpen: true };
      }),
    setMultiSelection: (ids) =>
      set(() => {
        const next = new Set<string>(ids);
        if (next.size === 0) {
          return { selectedNodeIds: next, selectedNodeId: null, editorMode: 'idle' as EditorMode };
        }
        if (next.size === 1) {
          const only = next.values().next().value as string;
          return {
            selectedNodeIds: next,
            selectedNodeId: only,
            selectedHubId: null,
            inspectorOpen: true,
            editorMode: 'idle' as EditorMode,
          };
        }
        return {
          selectedNodeIds: next,
          selectedHubId: null,
          inspectorOpen: true,
          editorMode: 'idle' as EditorMode,
        };
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
    checkpointCameraPose: (mode, pose) =>
      set((s) => ({ cameraPoseByMode: { ...s.cameraPoseByMode, [mode]: pose } })),
    toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen, searchQuery: '' })),
    setSearchQuery: (q) => set({ searchQuery: q }),
    toggleFilter: () => set((s) => ({ filterOpen: !s.filterOpen })),
    setFilterQuery: (q) => set({ filterQuery: q }),
    clearFilter: () => set({ filterQuery: '' }),
    openAddNodeDialog: () => set({ addNodeDialogOpen: true }),
    closeAddNodeDialog: () => set({ addNodeDialogOpen: false }),
    openChangeArtifact: (nodeId, flow = 'launch') =>
      set({ changeArtifactOpen: true, changeArtifactNodeId: nodeId, changeArtifactFlow: flow }),
    closeChangeArtifact: () => set({ changeArtifactOpen: false }),
    setChangeArtifactFlow: (flow) => set({ changeArtifactFlow: flow }),
    toggleFreeze: (id) =>
      set((s) => {
        const next = new Set(s.frozenNodeIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        return { frozenNodeIds: next };
      }),
    setLivePreviewHover: (id) => set({ livePreviewHoverId: id }),
    flyToNode: (id) =>
      // EBR2-C-01 — selection change resets editorMode.
      set({
        flyToNodeId: id,
        selectedNodeId: id,
        selectedHubId: null,
        selectedNodeIds: new Set<string>(),
        selectedHubIds: new Set<string>(),
        editorMode: 'idle',
      }),
    flyToHub: (hubId) => set({ flyToHubId: hubId, activeHubId: hubId }),
    clearFlyTarget: () => set({ flyToNodeId: null, flyToHubId: null }),
    drillIntoHub: (hubId) =>
      // EBR2-C-01 — drill-in is a selection change; reset editorMode.
      set({
        viewMode: 'canvas',
        selectedHubId: hubId,
        selectedNodeId: null,
        selectedNodeIds: new Set<string>(),
        selectedHubIds: new Set<string>(),
        activeHubId: hubId,
        flyToHubId: hubId,
        hubRevealAt: Date.now(),
        inspectorOpen: true,
        editorMode: 'idle',
      }),
    resetCamera: () =>
      set((s) => ({ resetCameraSignal: s.resetCameraSignal + 1, activeHubId: null })),
    // APP-REALITY P1 — straight-on reset of the canvas camera. Keeps activeHubId
    // (the user stays on the same hub) — only the camera pose snaps to zero.
    resetViewToZero: () =>
      set((s) => ({ resetViewSignal: s.resetViewSignal + 1 })),
    setCanvasView: (v) => set({ canvasView: v }),
    pinNode: (id, pos) =>
      set((s) => {
        const next = new Map(s.pinnedPositions);
        next.set(id, pos);
        return { pinnedPositions: next };
      }),
    clearPinnedPositions: () => set({ pinnedPositions: new Map() }),
    setQualityMode: (m) => set({ qualityMode: m }),
    // EBR2-E-04 / §R2-E SC-074 — single-node rebuild trigger. Increments only
    // the target node's version; absent entries default to 0. Other nodes'
    // counters are not touched (RA-16).
    bumpNodeRebuildVersion: (nodeId) =>
      set((s) => ({
        nodeRebuildVersion: {
          ...s.nodeRebuildVersion,
          [nodeId]: (s.nodeRebuildVersion[nodeId] ?? 0) + 1,
        },
      })),
    // EBR2-F-03 / §R2-F SC-075 / FP-11 — only legal mutator for the Clone-
    // drag slot. Does NOT touch selectedNodeId (INV-20: selection survives).
    setDraggingNode: (id) => set({ draggingNodeId: id }),
    // EBR2-F-04 / §R2-F SC-077 — galaxy-drag pointermove writes the
    // unprojected cursor world position and the resolved nearest-hub id
    // through these setters. Both default to null; EBR2-F-05's pointer-up
    // commit clears them in lockstep with `draggingNodeId`.
    setDraggingPointerWorld: (p) => set({ draggingPointerWorld: p }),
    setDraggingNearestHub: (hubId) => set({ draggingNearestHubId: hubId }),
    // EBR2-F-05 / §R2-F SC-076 — Lockstep clear of the three Clone-drag
    // slots on pointer-up. selectedNodeId is preserved (INV-20).
    clearDraggingClone: () =>
      set({
        draggingNodeId: null,
        draggingNearestHubId: null,
        draggingPointerWorld: null,
      }),

    // ── §13 prebuilt element library (criterion 21) ─────────────────────────
    libraryOpen: false,
    placingClusterId: null,
    openLibrary: () => set({ libraryOpen: true }),
    closeLibrary: () => set({ libraryOpen: false }),
    setPlacingCluster: (clusterId) => set({ placingClusterId: clusterId }),
    clearPlacement: () =>
      set({
        placingClusterId: null,
        draggingNearestHubId: null,
        draggingPointerWorld: null,
      }),
  }))
);
