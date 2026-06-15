'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import {
  toEditorView,
  type EditorGraph,
  type EditorHubView,
  type EditorNode,
} from '@/lib/prism-graph/view-model';
import { useGraphEditorStore, type InspectorTab } from '@/stores/useGraphEditorStore';
import { useElementImageStore } from '@/stores/useElementImageStore';
import { useAnimationEditsStore, defaultFrame, type FrameProps } from '@/stores/useAnimationEditsStore';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, dsAlpha } from '@/components/editor/design-system';
import { useChromeSlab } from '@/components/editor/chrome-layer';
import { useEditorDensity } from '@/stores/useEditorLayoutStore';
import { BottomSheet } from '@/components/editor/layout/BottomSheet';
import { ColorPicker } from './ColorPicker';
import MaterialTab from './MaterialTab';
import VisualPreview from './visual-preview/VisualPreview';
import type {
  CapabilityRef,
  PrismKeyframe,
  PrismNode,
  PrismRootNode,
} from '@/lib/prism-graph/types';
import {
  KEYFRAME_COORDINATE_SPACES,
  KEYFRAME_TRIGGERS,
} from '@/lib/prism-graph/types';
import { captureCanvasTransformAsKeyframe } from '@/lib/prism-graph/keyframe-capture';
import { readCanvasTransform } from '@/lib/editor/canvas-transform-gizmo';
import { usePreviewStateStore } from '@/stores/usePreviewStateStore';
import { commitPreviewToSource } from '@/lib/editor/preview-commit';
import { rebuildNode } from '@/lib/editor/rebuild-node';
import { useBuiltSnapshotStore } from '@/stores/useBuiltSnapshotStore';
import {
  ANIMATION_METHODOLOGIES,
  getLibraryByMethodology,
  type AnimationMethodology,
} from '@/lib/prism-graph/animation-library';
import NodeEditorPromptEdit from '@/components/editor/prompt-edit/NodeEditorPromptEdit';
import FunctionsTab from '@/components/editor/functions/FunctionsTab';
import type { PromptEditScope } from '@/lib/prompt-edit/contract';

// NODE-EDITOR-V2 (A5) — map the active purpose tab to a prompt-edit scope.
// Only PURPOSE tabs get the node editor's own prompt-edit; visual/canvas tabs
// (visual/material/animation/code) are served by the canvas Prompt Edit action.
const TAB_PROMPT_SCOPE: Partial<Record<InspectorTab, PromptEditScope>> = {
  behavior: 'node-behavior',
  backend: 'node-backend',
  connections: 'node-schema',
  functions: 'node-function',
  integrations: 'node-integration',
};

// SC-020: the canonical 7-tab set for a node selection. The 'history' tab
// surfaces the per-node edit/regeneration log; SC-020 explicitly names it as
// part of the preserved set, so it must remain reachable in every view mode.
const TABS: { id: InspectorTab; label: string; icon: string }[] = [
  { id: 'visual', label: 'Visual', icon: 'eye' },
  { id: 'material', label: 'Material', icon: 'sparkle' },
  { id: 'behavior', label: 'Behavior', icon: 'flow' },
  { id: 'functions', label: 'Functions', icon: 'sliders' },
  { id: 'code', label: 'Code', icon: 'code' },
  { id: 'animation', label: 'Animation', icon: 'play' },
  { id: 'connections', label: 'Links', icon: 'link' },
  { id: 'backend', label: 'Backend', icon: 'server' },
  { id: 'history', label: 'History', icon: 'refresh' },
];

// SC-007: when App_Name_World (a PrismRootNode) is the selection, the tab
// bar prepends a dedicated 'World' entry that surfaces the D1 fields. The
// existing 6 tabs remain after it so SC-020 ("existing tabs preserved")
// holds for the App_Name_World selection too.
const WORLD_TABS: { id: InspectorTab; label: string; icon: string }[] = [
  { id: 'world', label: 'World', icon: 'sparkle' },
  ...TABS,
];

export default function Inspector() {
  // UI-FIDELITY-2 — hero glass: the inspector plate refracts the live scene.
  // UI-WOW P2 — heavier frost so the full-height inspector reads as a clean
  // frosted instrument panel, not a muddy window onto the live scene behind it
  // (the monitor's "semi-transparent overlap" flag). Content stays crisp; the
  // scene behind softens to bokeh.
  const inspectorSlab = useChromeSlab({ material: 'glass', radius: 18, accent: 1, frost: 0.84 });
  // UI-FIDELITY-2 — machined header plate as real brushed metal. order: 0
  // pins the plate under its own action-rail keys: React attaches child refs
  // before the parent's, so without the bias the plate would register later —
  // and draw over — the ceramic keys cut into it (same opaque GPU family).
  const headerSlab = useChromeSlab({ material: 'metal', radius: 13, brushAxis: 'x', order: 0 });
  // UI-FIDELITY-2 — action-rail keys as fired ceramic; brass accent tracks
  // the armed/primary state via the update effects below the state reads.
  const editKeySlab = useChromeSlab({ material: 'ceramic', radius: 9 });
  const saveKeySlab = useChromeSlab({ material: 'ceramic', radius: 9 });
  const rebuildKeySlab = useChromeSlab({ material: 'ceramic', radius: 9 });
  const cloneKeySlab = useChromeSlab({ material: 'ceramic', radius: 9 });
  const open = useGraphEditorStore((s) => s.inspectorOpen);
  const close = useGraphEditorStore((s) => s.closeInspector);
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const selectedNodeIds = useGraphEditorStore((s) => s.selectedNodeIds);
  const selectedHubIds = useGraphEditorStore((s) => s.selectedHubIds);
  const clearMultiSelection = useGraphEditorStore((s) => s.clearMultiSelection);
  const tab = useGraphEditorStore((s) => s.inspectorTab);
  const setTab = useGraphEditorStore((s) => s.setInspectorTab);
  const frozen = useGraphEditorStore((s) => (selectedId ? s.frozenNodeIds.has(selectedId) : false));
  const flyToNode = useGraphEditorStore((s) => s.flyToNode);
  const flyToHub = useGraphEditorStore((s) => s.flyToHub);
  const setViewMode = useGraphEditorStore((s) => s.setViewMode);
  // EBR2-C-01 / §R2-C SC-068 — two-step authoring: select → click Edit →
  // CanvasTransformGizmo mounts (EBR2-C-02). Selection-reset happens at the
  // store layer so we only need the slice + setter here.
  const editorMode = useGraphEditorStore((s) => s.editorMode);
  const setEditorMode = useGraphEditorStore((s) => s.setEditorMode);
  // EBR2-F-03 / §R2-F SC-075 — Clone-drag handoff: the Inspector "Clone"
  // button parks the freshly-cloned node id on `draggingNodeId` and auto-
  // switches the view to galaxy so the user can drop the clone onto its
  // nearest hub. EBR2-F-04 will attach the cursor→nearest-hub listener;
  // EBR2-F-05 will commit on pointer-up.
  const setDraggingNode = useGraphEditorStore((s) => s.setDraggingNode);
  const selectNode = useGraphEditorStore((s) => s.selectNode);
  // CANVAS-FINAL — Change Artifact wizard entry (canvas-spec §12) from the
  // selected element's Inspector.
  const openChangeArtifact = useGraphEditorStore((s) => s.openChangeArtifact);

  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  const rootNodes = useGraphSourceStore((s) => s.rootNodes);
  const updateRootNode = useGraphSourceStore((s) => s.updateRootNode);
  const sourceDirty = useGraphSourceStore((s) => s.isDirty);
  const savedAt = useGraphSourceStore((s) => s.savedAt);
  const saveToServer = useGraphSourceStore((s) => s.saveToServer);
  // EBR2-E-03 / §R2-E SC-072 — Save lights up when the preview-state buffer
  // for the selected node is dirty too, not just when the source store is
  // dirty. Track the bag identity so React re-evaluates when any node's
  // buffer toggles between empty/non-empty.
  const previewPatches = usePreviewStateStore((s) => s.patches);
  const previewDirtyForSelected = selectedId
    ? previewPatches[selectedId] !== undefined && Object.keys(previewPatches[selectedId]).length > 0
    : false;
  const isDirty = sourceDirty || previewDirtyForSelected;

  // UI-FIDELITY-2 — GPU-side brass accent follows each rail key's armed/
  // primary state (the ds-btn--ghost/--primary classes stay as the t0/t1
  // fallback look).
  useEffect(() => {
    editKeySlab.update({ accent: editorMode === 'edit' ? 1 : 0 });
  }, [editKeySlab, editorMode]);
  useEffect(() => {
    saveKeySlab.update({ accent: isDirty ? 1 : 0 });
  }, [saveKeySlab, isDirty]);

  // EB-02-04: detect App_Name_World selection. The PrismRootNode lives in
  // useGraphSourceStore.rootNodes (RA-07, option B), not in `nodes`, so the
  // editor view-model never carries it. WorldSun's click handler in
  // GraphScene already binds selectedNodeId to root.appNameWorldId.
  const selectedRoot = useMemo<PrismRootNode | null>(
    () => rootNodes.find((r) => r.appNameWorldId === selectedId) ?? null,
    [rootNodes, selectedId],
  );
  const isWorldSelected = selectedRoot !== null;

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    // EBR2-E-03 / §R2-E SC-073 — flush any per-node preview-state buffer
    // for the current selection through the legal helper indirection
    // before persisting. The helper calls useGraphSourceStore.updateNode
    // (FP-15 forbids Inspector*.tsx from doing so directly); updateNode
    // schedules the existing 1s debounced autosave, and the immediate
    // saveToServer() below preserves the prior UX (explicit "Save" flushes
    // right away rather than waiting on the debounce).
    if (selectedId) commitPreviewToSource(selectedId);
    const r = await saveToServer();
    setSaving(false);
    if (!r.ok) setSaveError(r.error ?? 'save failed');
  };

  // EBR2-E-04 / §R2-E SC-074 + INV-26 + RA-16 — Save and Rebuild = Save +
  // single-node visual artifact re-render. The helper (`rebuild-node.ts`)
  // owns the orchestration: it routes through `commitPreviewToSource` to
  // honor FP-15, evicts the cached artifact Object3D (running
  // `userData.cleanup()` per INV-14), then bumps the per-node
  // rebuild-version counter in useGraphEditorStore so the keyed
  // AssembledSceneNode wrapper remounts *exactly one* node. The factory
  // re-invokes `createNode` synchronously; the new Object3D lands at the
  // same `scenePosition`; sibling Object3D references stay stable.
  const handleSaveAndRebuild = async () => {
    if (saving) return;
    if (!selectedId) return;
    setSaving(true);
    setSaveError(null);
    // SC-074 ordering: "Save + locates the mounted THREE.Object3D … re-invokes
    // createNode … re-mounts at same scenePosition." Flush the preview buffer
    // and await the server round-trip *first*, then trigger the single-node
    // rebuild. Reversing the order would race the autosave dirty-flag flip
    // and the explicit saveToServer call (review MUST-FIX #2).
    if (selectedId) commitPreviewToSource(selectedId);
    const r = await saveToServer();
    if (r.ok) rebuildNode(selectedId);
    setSaving(false);
    if (!r.ok) setSaveError(r.error ?? 'save failed');
  };

  // EBR2-F-03 / §R2-F SC-075 — Clone button handler. Sequence:
  //   1. Invoke source-store cloneNode(sourceId) → deep clone + new id.
  //   2. Exit edit mode (canvas-mode gizmo never persists into galaxy).
  //   3. Auto-switch viewMode → 'galaxy' so the user can re-parent.
  //   4. Park the new id on `draggingNodeId` for the EBR2-F-04 listener.
  //   5. Move selection to the clone so the Inspector follows.
  //
  // FP-11 — all editor-store mutations route through actions; no direct
  // `getState().X = …` writes. Source-store mutation uses the dedicated
  // cloneNode action (FP-15 does not apply: cloneNode is the legal entry
  // point for clone, not an updateNode bypass).
  const handleClone = () => {
    if (!selectedId) return;
    const newId = useGraphSourceStore.getState().cloneNode(selectedId);
    if (!newId) return;
    setEditorMode('idle');
    setViewMode('galaxy');
    setDraggingNode(newId);
    selectNode(newId);
  };

  const handlePreviewInAppUi = () => {
    // RA-06b — preview-hub folded into preview-app. The Inspector's
    // "Preview in App UI" button still flies the camera to the selected
    // node's hub so the preview opens focused on what the user was editing.
    setViewMode('preview-app');
    if (!selectedId) return;
    const node = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === selectedId);
    if (node?.parentHubId) flyToHub(node.parentHubId);
  };
  const editorGraph = useMemo<EditorGraph>(
    () => toEditorView({ hubs: sourceHubs, nodes: sourceNodes, edges: sourceEdges }),
    [sourceHubs, sourceNodes, sourceEdges]
  );

  // T-EDIT-05 — bidirectional editor↔preview live binding (plan §Phase 5).
  // Editor → preview: when the editor's selection changes, push a visual
  // highlight ring onto the matching preview node. The PixiJS-era
  // `window.__prism` debug surface was retired in Phase 5 (spec §15);
  // T07 will re-implement highlight + selection on the Three.js mount.
  // Until then, the editor still drives `selectedId` locally — only the
  // cross-pane visual ring is dormant.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = (window as { __prism?: { highlightNode?: (id: string | null) => void } }).__prism;
    handle?.highlightNode?.(selectedId ?? null);
  }, [selectedId]);

  // Preview → editor: subscribe to user-driven node clicks in the preview
  // pane. Same Phase 5 caveat — `__prism.onNodeSelected` is not on the
  // Three.js debug handle yet; the polling guard now no-ops cleanly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let off: (() => void) | undefined;
    let cancelled = false;
    const tryAttach = () => {
      const handle = (window as { __prism?: { onNodeSelected?: (cb: (nodeId: string) => void) => () => void } }).__prism;
      if (!handle?.onNodeSelected) return false;
      off = handle.onNodeSelected((nodeId) => {
        const store = useGraphEditorStore.getState();
        store.selectNode(nodeId);
        store.openInspector();
      });
      return true;
    };
    if (!tryAttach()) {
      const timer = setInterval(() => {
        if (cancelled) return;
        if (tryAttach()) clearInterval(timer);
      }, 200);
      return () => { cancelled = true; clearInterval(timer); off?.(); };
    }
    return () => { off?.(); };
  }, []);

  // Memoize the source-node lookup; consumed by the Visual tab's live R3F
  // sub-canvas (T07).
  const sourceNodeById = useMemo<PrismNode | null>(
    () => sourceNodes.find((s) => s.nodeId === selectedId) ?? null,
    [sourceNodes, selectedId],
  );

  // STEP5 edit-path — build-state badge inputs. `nodeDirty` is the node's
  // Built→Dirty flag (set on Save, cleared on Save-and-Rebuild); `builtSnap` is
  // this node's content-hash builtSnapshot (status: built | repaired | failed),
  // recorded by the artifact factory's verify-in-path. Together they surface the
  // dirty / built / repaired / failed lifecycle (NE-SC-11, NE-SC-13, canvas §6).
  const nodeDirty = sourceNodeById?.dirty === true;
  const builtSnap = useBuiltSnapshotStore((s) => (selectedId ? s.snapshots[selectedId] : undefined));

  // SC-007: opening the Inspector with App_Name_World as the selection
  // should default to the dedicated 'World' tab. Runs whenever the
  // selection flips onto/off App_Name_World — the user can still switch to
  // any other tab afterwards.
  useEffect(() => {
    if (isWorldSelected && tab !== 'world') {
      setTab('world');
    }
  }, [isWorldSelected, selectedId, setTab, tab]);

  // EBR2-C-01 / §R2-C SC-068 — Escape exits edit mode. Mount only while
  // editorMode === 'edit' so the listener doesn't compete with other
  // escape-bound surfaces (search, filter, group inspector) when idle.
  useEffect(() => {
    if (editorMode !== 'edit') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditorMode('idle');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorMode, setEditorMode]);

  // UI-WOW-2 P0 — container density. On a COMPACT pane (phone / narrow embedded
  // preview-pane, <820px) the right-rail inspector is a full-bleed takeover that
  // occludes the whole 3D scene; re-house it as a draggable BottomSheet there.
  // Regular/wide (≥820px) is byte-identical to the shipped desktop floating panel.
  // Called unconditionally, before any early return (hook-order invariant), so it
  // is in scope for every Inspector variant (node / world / group).
  const density = useEditorDensity();
  const compact = density === 'compact';

  // EB-03-06 / SC-017 — when the user shift-clicks across multiple items in
  // galaxy mode, render the group view in place of the single-node tabs. The
  // group view is gated on (nodes + hubs > 1) so a 1-member multi-set falls
  // through to the existing single-select Inspector (parity with no-shift).
  const groupSize = selectedNodeIds.size + selectedHubIds.size;
  const isGroup = groupSize > 1;
  if (open && isGroup) {
    return (
      <GroupInspector
        selectedNodeIds={selectedNodeIds}
        selectedHubIds={selectedHubIds}
        editorNodes={editorGraph.nodes}
        editorHubs={editorGraph.hubs}
        close={close}
        clearMultiSelection={clearMultiSelection}
      />
    );
  }

  if (!open || !selectedId) return null;
  const node = editorGraph.nodes.find((n) => n.id === selectedId);
  // EB-02-04 — App_Name_World branch. The root node has no EditorNode
  // view-model entry (it lives in rootNodes, not nodes), so we render a
  // dedicated panel that surfaces the D1 fields via WorldTab while keeping
  // the existing tabs in the tab bar per SC-020.
  if (isWorldSelected && selectedRoot) {
    return (
      <WorldInspectorPanel
        root={selectedRoot}
        tab={tab}
        setTab={setTab}
        close={close}
        updateRootNode={updateRootNode}
      />
    );
  }
  if (!node) return null;

  // UI-WOW-2 P0 — the header plate, save-status strip, tab rail, frozen banner,
  // and tab body. Density-agnostic; the WRAPPER below decides whether they live
  // in the desktop floating glass housing (regular/wide, unchanged) or a
  // draggable BottomSheet (compact). The header's own slab ref stays attached.
  const inner = (
    <>
      {/* Machined header plate — brushed metal fitting riveted into the glass. */}
      <div ref={headerSlab.ref} className="px-4 py-3 m-3 mb-0 ds-metal ds-grain ds-edge rounded-ds-md">
        {/* Row 1 — identity (truncating title) + status chip + close. Actions
            live on their own rail below so the title never collides with the
            button cluster (Wave-3 advocate MUST-FIX). */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="ds-kicker flex items-center gap-1.5">
              <span>INSPECTOR</span>
              <Icon name="chevron" size={9} color={DS.textLow} />
              <span className="text-ds-text-mid">{node.elementType}</span>
            </div>
            <div className="font-display font-bold text-ds-text-hi text-lg leading-tight flex items-center gap-2 min-w-0">
              <span className="truncate">{node.name}</span>
              {frozen && <Icon name="snow" size={13} color={DS.ice300} glow />}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
          {/* STEP5 edit-path — build-state badge (NE-SC-11 dirty, NE-SC-13
              verify/repair). Observable surface for the Built→Dirty→Built
              lifecycle and the verify-in-path outcome. */}
          {(() => {
            const status: 'failed' | 'repaired' | 'dirty' | 'built' | null = builtSnap?.status === 'failed'
              ? 'failed'
              : nodeDirty
                ? 'dirty'
                : builtSnap?.status === 'repaired'
                  ? 'repaired'
                  : builtSnap?.status === 'built'
                    ? 'built'
                    : null;
            if (!status) return null;
            // Engraved status tags — semantic ok/warn/danger only (DS rule 4).
            const cfg = {
              failed: { label: 'Build failed', cls: 'text-ds-danger', title: builtSnap?.reason ? `Build failed: ${builtSnap.reason}` : 'Artifact failed to build' },
              dirty: { label: 'Dirty — rebuild', cls: 'text-ds-warn', title: 'Edited since last build — Save & Rebuild to refresh the artifact' },
              repaired: { label: 'Repaired', cls: 'ds-chip--brass', title: builtSnap?.repairStrategy ? `Caption-driven repair: ${builtSnap.repairStrategy}` : 'Recovered by caption-driven repair' },
              built: { label: 'Built', cls: 'ds-chip--ok', title: builtSnap?.hash ? `Built · snapshot ${builtSnap.hash}` : 'Artifact built and verified' },
            }[status];
            return (
              <span
                data-role="build-state"
                data-build-status={status}
                data-build-hash={builtSnap?.hash ?? ''}
                title={cfg.title}
                className={`ds-chip h-7 px-2 whitespace-nowrap ${cfg.cls}`}
              >
                {cfg.label}
              </span>
            );
          })()}
          <button
            onClick={close}
            className="ds-btn ds-btn--quiet !px-0 w-8 h-8 !rounded-full shrink-0"
            title="Close inspector"
          >
            <Icon name="close" size={12} color={DS.text} />
          </button>
        </div>
        </div>
        {/* Row 2 — machined action rail (wraps rather than crushing row 1). */}
        <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
          {/* EBR2-C-01 / §R2-C SC-068 — Edit/Done toggle. Selecting a node
              alone never reveals the CanvasTransformGizmo; the user must
              click Edit first. EBR2-C-02 will gate the gizmo on
              editorMode === 'edit' AND viewMode === 'canvas'. */}
          <button
            ref={editKeySlab.ref}
            type="button"
            data-role="edit-toggle"
            aria-pressed={editorMode === 'edit'}
            onClick={() => setEditorMode(editorMode === 'edit' ? 'idle' : 'edit')}
            title={editorMode === 'edit' ? 'Exit edit mode (Esc)' : 'Edit transform handles'}
            className={`ds-btn !px-2.5 h-7 text-[10px] ${
              editorMode === 'edit' ? 'ds-btn--ghost' : ''
            }`}
          >
            {editorMode === 'edit' ? 'Done' : 'Edit'}
          </button>
          <button
            ref={saveKeySlab.ref}
            type="button"
            data-role="save"
            data-testid="inspector-save"
            disabled={saving}
            onClick={handleSave}
            title={isDirty ? 'Save graph to server' : 'No unsaved changes'}
            className={`ds-btn !px-2.5 h-7 text-[10px] ${
              isDirty ? 'ds-btn--primary' : ''
            }`}
          >
            {saving ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
          </button>
          {/* EBR2-E-04 / §R2-E SC-074 + INV-26 + RA-16 — Save and Rebuild:
              persists the preview overlay then re-invokes createNode for
              this one node (userData.cleanup + cache evict + per-node
              rebuild-version bump). Other nodes are untouched. */}
          <button
            ref={rebuildKeySlab.ref}
            type="button"
            data-role="save-and-rebuild"
            data-testid="inspector-save-and-rebuild"
            disabled={saving || !selectedId}
            onClick={handleSaveAndRebuild}
            title="Save and re-render this node's artifact"
            className="ds-btn ds-btn--ghost !px-2.5 h-7 text-[10px]"
          >
            {saving ? 'Saving…' : 'Save & Rebuild'}
          </button>
          {/* EBR2-F-03 / §R2-F SC-075 — Clone: deep-clones the selected node
              via useGraphSourceStore.cloneNode, switches viewMode to galaxy,
              and parks the new id on draggingNodeId for the nearest-hub
              drag-snap flow (EBR2-F-04..F-05). Disabled until a node is
              selected. */}
          <button
            ref={cloneKeySlab.ref}
            type="button"
            data-role="clone"
            data-testid="inspector-clone"
            disabled={!selectedId}
            onClick={handleClone}
            title="Clone node and drop into galaxy"
            className="ds-btn !px-2.5 h-7 text-[10px]"
          >
            Clone
          </button>
          {/* CANVAS-FINAL (canvas-spec §12) — regenerate/replace the selected
              element's artifact (Upload §12.1 / Generate §12.2), keeping its
              position, animation, and lighting. Disabled until a node is
              selected. */}
          <button
            type="button"
            data-role="change-artifact"
            data-testid="inspector-change-artifact"
            disabled={!selectedId}
            onClick={() => selectedId && openChangeArtifact(selectedId, 'launch')}
            title="Change this element's artifact"
            className="ds-btn !px-2.5 h-7 text-[10px] whitespace-nowrap"
          >
            Change Artifact
          </button>
          <button
            type="button"
            data-role="preview-in-app-ui"
            onClick={handlePreviewInAppUi}
            title="Preview in App UI"
            className="ds-btn ds-btn--quiet !px-2.5 h-7 text-[10px] whitespace-nowrap"
          >
            Preview in App UI
          </button>
        </div>
      </div>
      {(saveError || (savedAt && !isDirty)) && (
        <div
          data-role="save-status"
          className={`mx-3 mt-2 px-2.5 py-1.5 ds-well rounded-ds-sm text-[10px] font-mono ${
            saveError ? 'text-ds-danger' : 'text-ds-ok'
          }`}
        >
          {saveError ? `save failed: ${saveError}` : `saved · ${new Date(savedAt!).toLocaleTimeString()}`}
        </div>
      )}

      {/* Tab rail — engraved chips, brass-lit when active. */}
      <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`ds-chip ds-press cursor-pointer whitespace-nowrap min-h-[40px] px-3 gap-1.5 ${
                active ? 'ds-chip--brass' : 'hover:text-ds-text'
              }`}
            >
              <Icon name={t.icon} size={11} color={active ? DS.brass400 : DS.textMid} glow={active} />
              {t.label}
            </button>
          );
        })}
      </div>

      {frozen && (
        <div className="mx-3 mt-1 px-3 py-2 ds-well ds-edge rounded-ds-md flex items-center gap-2">
          <Icon name="snow" size={12} color={DS.ice300} glow />
          <div className="ds-body text-[12px] text-ds-ice-300">Node frozen — AI cannot edit</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {!frozen && TAB_PROMPT_SCOPE[tab] && (
          <NodeEditorPromptEdit scope={TAB_PROMPT_SCOPE[tab]!} />
        )}
        {tab === 'visual' && <VisualTab node={node} frozen={frozen} sourceNode={sourceNodeById} />}
        {tab === 'material' && <MaterialTab node={sourceNodeById} frozen={frozen} />}
        {tab === 'behavior' && <BehaviorTab node={node} />}
        {tab === 'functions' && sourceNodeById && <FunctionsTab node={sourceNodeById} />}
        {tab === 'code' && <CodeTab node={node} frozen={frozen} />}
        {tab === 'animation' && <AnimationTab node={node} frozen={frozen} />}
        {tab === 'connections' && <ConnectionsTab node={node} graph={editorGraph} flyToNode={flyToNode} />}
        {tab === 'backend' && <BackendTab node={node} />}
        {tab === 'history' && <HistoryTab node={node} />}
      </div>
    </>
  );

  // Compact pane → draggable bottom sheet (no full-bleed scene takeover); the
  // sheet supplies its own glass surface, so the absolute housing + slab ref
  // are dropped here. Regular/wide → the shipped floating glass housing,
  // byte-identical to before.
  if (compact) {
    return (
      <BottomSheet id="inspector" open onClose={close} initialSnap="half">
        {inner}
      </BottomSheet>
    );
  }

  return (
    // Hero surface — frosted observatory glass with brass-fitted edge.
    // RefractionDefs is already mounted once in src/app/page.tsx, so the
    // t2-only ds-glass--refract displacement is legal here. RightPane mounts
    // exactly one inspector panel at a time, so the refract budget stays at 1.
    <div
      ref={inspectorSlab.ref}
      // Mobile MUST-FIX (advocate 2026-06-11): w-full sat UNDER the left tool
      // rail, hiding the first word of every body line — inset left-16 clears
      // the rail on phones; desktop geometry unchanged.
      // UI-WOW P3 fix (advocate MUST-FIX) — the panel started at md:top-3 (12px)
      // and slid UNDER the 56px top bar, so its header collided with the bar's
      // Add Node / Search cluster. Drop it to clear the bar (top-[64px]) with a
      // touch more width so the header tabs breathe (cramped flag).
      className="absolute z-40 right-0 top-14 bottom-0 left-16 md:left-auto md:w-[484px] md:right-3 md:top-[64px] md:bottom-3 flex flex-col overflow-hidden ds-glass ds-edge--brass ds-elev-4 rounded-none md:rounded-ds-lg ds-reveal-r"
    >
      {inner}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VISUAL TAB — live R3F sub-canvas (T07) + editable color pickers
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L477.
// ═══════════════════════════════════════════════════════════════════
function VisualTab({ node, frozen, sourceNode }: { node: any; frozen: boolean; sourceNode: PrismNode | null }) {
  const [frame, setFrame] = useState(0);
  const total = node.animationFrames || 1;
  const capturedImage = useElementImageStore((s) => s.images[node.id]);

  const edits = useAnimationEditsStore((s) => s.edits[node.id]);
  const setPrimary = useAnimationEditsStore((s) => s.setPrimary);
  const setSecondary = useAnimationEditsStore((s) => s.setSecondary);

  const primaryColor = edits?.primaryColor || node.visualSpec.primaryColor;
  const secondaryColor = edits?.secondaryColor || node.visualSpec.secondaryColor;

  return (
    <div className="p-5 space-y-4">
      <div className="ds-kicker">LIVE PREVIEW</div>

      {sourceNode ? (
        <VisualPreview node={sourceNode} frozen={frozen} />
      ) : (
        <div className="ds-ceramic ds-edge rounded-ds-lg p-4 text-[11px] text-ds-text-mid">
          No source node available for this selection.
        </div>
      )}

      <div className="ds-kicker pt-2">ELEMENT IMAGE</div>

      {/* Preview frame carved into the housing (ds-well recipe). The node's
          own primary/secondary colors are functional content data, not chrome. */}
      <div
        className="relative aspect-[16/10] ds-well ds-edge rounded-ds-lg overflow-hidden"
        style={{
          // FIDELITY-2: the old primary/secondary linear-gradient fallback read
          // as a saturated placeholder slab ("AI-built"); uncaptured nodes get
          // a neutral recessed well with a quiet caption instead. The node's
          // colors remain visible as a thin accent rail only.
          background: capturedImage
            ? 'var(--ds-ink)'
            : `radial-gradient(ellipse at center, ${dsAlpha(DS.charcoal ?? '#191d2a', 0.9)} 0%, var(--ds-void) 100%)`,
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.55)',
        }}
      >
        {capturedImage ? (
          <img src={capturedImage} alt={node.name} className="w-full h-full object-contain" />
        ) : (
          <>
            {node.hasAnimation && (
              <>
                <div className="absolute inset-0 translate-x-2 translate-y-2 bg-white/10 rounded-xl border border-white/5" />
                <div className="absolute inset-0 translate-x-1 translate-y-1 bg-white/5 rounded-xl border border-white/5" />
              </>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              <div className="text-ds-text-mid font-display text-lg font-medium">{node.name}</div>
              <div className="ds-kicker">NO CAPTURED IMAGE</div>
              <div
                aria-hidden
                className="absolute bottom-0 inset-x-0 h-[3px]"
                style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor || primaryColor})`, opacity: 0.55 }}
              />
            </div>
          </>
        )}
        {node.hasAnimation && (
          <div className="absolute bottom-2 right-2 ds-chip">
            <Icon name="play" size={8} color={DS.text} />
            Frame {frame + 1}/{total}
          </div>
        )}
      </div>

      {node.hasAnimation && (
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={total - 1}
            value={frame}
            onChange={(e) => setFrame(+e.target.value)}
            className="ds-slider w-full"
          />
          <div className="ds-body text-[12px] text-ds-text-low">Drag to preview frames. Open the Animation tab to edit them.</div>
        </div>
      )}

      <div className="ds-kicker pt-2">STYLE — CLICK TO EDIT</div>
      <div className="grid grid-cols-1 gap-2">
        <SpecRow icon="sparkle" label="Primary color">
          <ColorPicker
            value={primaryColor}
            onChange={(c) => setPrimary(node.id, c)}
            label="Primary color"
            disabled={frozen}
          />
        </SpecRow>
        {secondaryColor && (
          <SpecRow icon="sparkle" label="Accent color">
            <ColorPicker
              value={secondaryColor}
              onChange={(c) => setSecondary(node.id, c)}
              label="Accent color"
              disabled={frozen}
            />
          </SpecRow>
        )}
        <SpecRow icon="edit" label="Font">
          <span className="text-[11px] text-ds-text font-mono">{node.visualSpec.font}</span>
        </SpecRow>
        <SpecRow icon="grid" label="Radius">
          <span className="text-[11px] text-ds-text font-mono">{node.visualSpec.radius}px</span>
        </SpecRow>
      </div>

      <div className="ds-kicker pt-2">TEXT CONTENT</div>
      <div className="space-y-1.5">
        {node.textContent.map((t: any, i: number) => (
          <div key={i} className="px-3 py-2 ds-well rounded-ds-md flex items-center justify-between">
            <span className="text-[12px] text-ds-text truncate max-w-[60%]">"{t.text}"</span>
            <div className="flex gap-1.5 text-[9px] font-mono">
              <span className="text-ds-text-low">{t.role}</span>
              <span className="text-ds-brass-300">{t.renderMethod}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpecRow({ icon, label, children }: any) {
  return (
    <div className="px-3 py-2 ds-well rounded-ds-md flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon name={icon} size={11} color={DS.textLow} />
        <span className="ds-label">{label}</span>
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BEHAVIOR TAB
// ═══════════════════════════════════════════════════════════════════
function BehaviorTab({ node }: { node: any }) {
  return (
    <div className="p-5 space-y-4">
      <div className="ds-kicker">INTERACTIONS</div>
      <div className="space-y-2">
        {node.interactions.length === 0 ? (
          <div className="ds-body text-[12px] text-ds-text-low italic">No interactions defined</div>
        ) : (
          node.interactions.map((i: any, idx: number) => (
            <div key={idx} className="px-3 py-2.5 ds-well rounded-ds-md">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="ds-chip ds-chip--brass">{i.event}</span>
                <Icon name="chevron" size={9} color={DS.textLow} />
                <span className="text-ds-text-mid font-mono text-[11px]">{i.action}</span>
                <Icon name="chevron" size={9} color={DS.textLow} />
                <span className="text-ds-text-mid font-mono text-[11px] truncate">{i.target}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="ds-kicker pt-3">STATE MANAGEMENT</div>
      <div className="px-3 py-2.5 ds-well rounded-ds-md">
        <div className="text-[11px] text-ds-text-mid">
          Store: <span className="font-mono text-ds-brass-300">{node.id.replace(/-/g, '')}Store</span>
        </div>
        <div className="text-[10px] text-ds-text-low mt-1">{node.stateCount} state key{node.stateCount !== 1 ? 's' : ''} tracked</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CODE TAB — now shows live-generated code from the animation edits
// ═══════════════════════════════════════════════════════════════════
function CodeTab({ node, frozen }: { node: any; frozen: boolean }) {
  const edits = useAnimationEditsStore((s) => s.edits[node.id]);
  const markSaved = useAnimationEditsStore((s) => s.markSaved);
  const [saved, setSaved] = useState(false);

  // If there are keyframe edits, show the generated GSAP code. Otherwise show static code.
  const code = edits && edits.frames.length > 0 ? generateAnimationCode(node, edits.frames) : node.code;

  const handleSave = () => {
    markSaved(node.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="ds-kicker">ASSOCIATED CONTEXT</div>
        <div className="text-[10px] font-mono" style={{ color: node.verificationScore >= 0.6 ? DS.ok : DS.danger }}>
          SWE-RM: {node.verificationScore.toFixed(2)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
        <div className="px-2.5 py-2 ds-well rounded-ds-md">
          <div className="text-ds-text-low text-[9px] tracking-widest">IMPORTS</div>
          <div className="text-ds-text-mid mt-0.5">three/webgpu, gsap</div>
        </div>
        <div className="px-2.5 py-2 ds-well rounded-ds-md">
          <div className="text-ds-text-low text-[9px] tracking-widest">EXPORTS</div>
          <div className="text-ds-text-mid mt-0.5">createNode</div>
        </div>
      </div>

      {/* Code trough — carved well; frozen state reads in ice telemetry. */}
      <div className="ds-well ds-edge rounded-ds-md overflow-hidden">
        <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between text-[10px] font-mono text-ds-text-low">
          <span>{edits?.dirty ? 'animation.generated.ts (edited)' : 'createNode.ts'}</span>
          {frozen && <span className="text-ds-ice-300 flex items-center gap-1"><Icon name="snow" size={9} color={DS.ice300} /> read-only</span>}
          {edits?.dirty && !frozen && <span className="text-ds-warn">● modified</span>}
        </div>
        <pre className={`p-3 text-[10.5px] font-mono leading-relaxed overflow-x-auto ${frozen ? 'text-ds-ice-400' : 'text-ds-text'}`}>
          <code>{code}</code>
        </pre>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          disabled={frozen}
          onClick={handleSave}
          className="ds-btn ds-btn--primary flex-1 h-9 text-[11px]"
        >
          {saved ? (
            <>
              <Icon name="check" size={11} color={DS.ink} />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Icon name="save" size={11} color={DS.ink} />
              Save &amp; Verify
            </>
          )}
        </button>
        <button
          disabled={frozen}
          className="ds-btn flex-1 h-9 text-[11px]"
        >
          <Icon name="refresh" size={11} color={DS.text} />
          Revert
        </button>
      </div>
    </div>
  );
}

function generateAnimationCode(node: any, frames: FrameProps[]): string {
  const duration = 0.3;
  const step = duration / Math.max(frames.length - 1, 1);
  const lines = [
    `import gsap from 'gsap';`,
    ``,
    `// Auto-generated from keyframe editor`,
    `export function animate${node.name.replace(/-/g, '_')}(node) {`,
    `  const tl = gsap.timeline();`,
  ];
  frames.forEach((f, i) => {
    lines.push(
      `  tl.to(node, {`,
      `    scale: ${f.scale.toFixed(3)},`,
      `    opacity: ${f.opacity.toFixed(2)},`,
      `    rotation: ${f.rotation.toFixed(1)},`,
      `    x: ${f.x.toFixed(1)}, y: ${f.y.toFixed(1)},`,
      `    duration: ${step.toFixed(3)},`,
      `    ease: 'power2.out',`,
      `  }${i === 0 ? ', 0' : ''});`
    );
  });
  lines.push(`  return tl;`, `}`);
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// ANIMATION TAB — fully interactive keyframe editor
// ═══════════════════════════════════════════════════════════════════
function AnimationTab({ node, frozen }: { node: any; frozen: boolean }) {
  const total = node.animationFrames || 0;
  const capturedImage = useElementImageStore((s) => s.images[node.id]);

  const ensureNode = useAnimationEditsStore((s) => s.ensureNode);
  const setFrame = useAnimationEditsStore((s) => s.setFrame);
  const reset = useAnimationEditsStore((s) => s.reset);
  const markSaved = useAnimationEditsStore((s) => s.markSaved);
  const setCoordinateSpace = useAnimationEditsStore((s) => s.setCoordinateSpace);
  const setTrigger = useAnimationEditsStore((s) => s.setTrigger);
  const edits = useAnimationEditsStore((s) => s.edits[node.id]);

  // EB-08-05 / §6 SC-042 + SC-045 — Transform-edit ↔ keyframe-capture.
  // The graph-source store carries the canonical PrismNode (incl. the new
  // optional `canvasTransform` + `keyframes` fields). EBR2-E-02 / §R2-E
  // SC-072 + FP-15 routes Inspector tab writes through usePreviewStateStore
  // (the ephemeral per-node edit buffer) — Save (EBR2-E-03) is what later
  // commits the buffer → useGraphSourceStore.updateNode.
  const sourceNode = useGraphSourceStore((s) =>
    s.nodes.find((n) => n.nodeId === node.id),
  );
  const previewPatch = usePreviewStateStore((s) => s.patches[node.id] ?? null);
  // The persisted keyframe list the user sees is source ⊕ preview-overlay so
  // the just-captured keyframe shows up immediately, before Save flushes.
  const persistedKeyframes: PrismKeyframe[] =
    (previewPatch?.keyframes as PrismKeyframe[] | undefined) ??
    sourceNode?.keyframes ??
    [];

  useEffect(() => {
    if (total > 0) ensureNode(node.id, total);
  }, [node.id, total, ensureNode]);

  const [activeFrame, setActiveFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playT, setPlayT] = useState(0);
  const [saved, setSaved] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Playback loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    let startTime: number | null = null;
    const DURATION_MS = 1500;
    const loop = (now: number) => {
      if (startTime == null) startTime = now;
      const elapsed = (now - startTime) % DURATION_MS;
      setPlayT(elapsed / DURATION_MS);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  if (!node.hasAnimation) {
    return (
      <div className="p-5 space-y-4">
        <div className="ds-body text-center text-ds-text-low text-[12px] italic">
          This node has no animations. Pick a primitive from the library to add one.
        </div>
        <AnimationLibrarySection />
      </div>
    );
  }

  if (!edits) return <div className="p-5 text-ds-text-low text-[12px]">Loading…</div>;

  const frames = edits.frames;
  const currentFrame = frames[activeFrame] || defaultFrame(activeFrame, frames.length);

  // Interpolate for live preview during playback
  const previewProps = playing ? interpolateFrames(frames, playT) : currentFrame;

  const handleFrameEdit = (patch: Partial<FrameProps>) => {
    if (frozen) return;
    setFrame(node.id, activeFrame, patch);
  };

  const handleSave = () => {
    markSaved(node.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  // EB-08-05 / §6 SC-042 + SC-045 + INV-21 — "Save as keyframe" snapshots
  // the active PrismNode's canvasTransform (or identity, on a fresh node)
  // into a PrismKeyframe. EBR2-E-02 / §R2-E SC-072 + FP-15: the write goes
  // to usePreviewStateStore (not useGraphSourceStore.updateNode); the
  // EBR2-E-03 Save button is what later commits the buffer through
  // useGraphSourceStore.updateNode and lets the existing 1s debounced
  // autosave flush. The coordinate-space + trigger pickers already drive
  // `edits.coordinateSpace` / `edits.trigger`; both flow into the captured
  // keyframe so SC-045's picker state is durable. The default coordinate
  // space is 'hub-scene' (canvas-mode default per haltCheck); any of the
  // canonical 5 (INV-21) can be picked.
  const handleSaveAsKeyframe = () => {
    if (frozen || !sourceNode) return;
    const transform = readCanvasTransform(sourceNode);
    const captured = captureCanvasTransformAsKeyframe(transform, {
      coordinateSpace: edits.coordinateSpace ?? 'hub-scene',
      trigger: edits.trigger,
    });
    const existing = persistedKeyframes;
    usePreviewStateStore.getState().set(sourceNode.nodeId, {
      keyframes: [...existing, captured],
    });
  };

  const primary = edits.primaryColor || node.visualSpec.primaryColor;
  const secondary = edits.secondaryColor || node.visualSpec.secondaryColor || primary;

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="ds-kicker">ANIMATION</div>
          <div className="text-[13px] font-semibold text-ds-text-hi mt-0.5">
            hover → keyframes · {(frames.length * 50)}ms · ease-out
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setPlaying(false); setPlayT(0); }}
            disabled={!playing}
            className="ds-btn !px-0 w-8 h-8 !rounded-full"
            title="Stop"
          >
            <div className="w-2.5 h-2.5 bg-ds-text-mid" />
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            className="ds-btn ds-btn--ghost !px-0 w-9 h-9 !rounded-full"
            title={playing ? 'Pause' : 'Play animation'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={14} color={DS.brass300} glow />
          </button>
        </div>
      </div>

      {/* Live preview surface */}
      {/* Animation stage — recessed viewing chamber with a graphite vignette. */}
      <div
        className="relative ds-well ds-edge rounded-ds-lg h-40 overflow-hidden flex items-center justify-center"
        style={{
          background: `radial-gradient(ellipse at center, ${DS.charcoal}, ${DS.void})`,
        }}
      >
        <div
          className="relative max-w-[70%] max-h-[80%]"
          style={{
            transform: `translate(${previewProps.x}px, ${previewProps.y}px) rotate(${previewProps.rotation}deg) scale(${previewProps.scale})`,
            opacity: previewProps.opacity,
            transition: playing ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms linear',
            boxShadow: `0 0 30px ${previewProps.color}55`,
            filter: `drop-shadow(0 0 14px ${previewProps.color}88)`,
          }}
        >
          {capturedImage ? (
            <img src={capturedImage} alt="" className="max-h-32 rounded-lg border border-white/10" />
          ) : (
            <div
              className="px-6 py-3 rounded-lg font-semibold text-ds-text-hi"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              {node.name}
            </div>
          )}
        </div>
        <div className="absolute top-2 left-2 ds-chip">
          <Icon name="eye" size={9} color={DS.text} />
          LIVE PREVIEW
        </div>
        {playing && (
          <div className="absolute top-2 right-2 ds-chip ds-chip--ok">
            <div className="w-1.5 h-1.5 rounded-full bg-ds-ok animate-pulse" />
            <span>PLAYING</span>
          </div>
        )}
      </div>

      {/* Timeline playhead */}
      <div className="space-y-1">
        <div className="flex justify-between ds-kicker">
          <span>TIMELINE</span>
          <span>{Math.round(((activeFrame / Math.max(total - 1, 1)) * frames.length * 50))}ms</span>
        </div>
        <div className="relative h-2 rounded-full ds-well overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
            style={{
              width: `${((activeFrame + 1) / frames.length) * 100}%`,
              background: `linear-gradient(90deg, ${primary}, ${secondary})`,
              boxShadow: `0 0 10px ${primary}`,
            }}
          />
        </div>
      </div>

      {/* Frame strip */}
      <div>
        <div className="ds-kicker mb-1.5">KEYFRAMES</div>
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
          {frames.map((f, i) => (
            <button
              key={i}
              onClick={() => setActiveFrame(i)}
              className={`flex-shrink-0 w-12 h-12 rounded-ds-sm border-2 transition-all flex items-center justify-center text-[10px] font-mono ${
                i === activeFrame
                  ? 'border-ds-brass-400 shadow-[var(--ds-glow-brass-strong)]'
                  : 'border-white/10 hover:border-white/30'
              }`}
              style={{
                background: `linear-gradient(135deg, ${f.color}, ${primary})`,
                opacity: 0.4 + 0.6 * f.opacity,
                transform: `scale(${0.7 + 0.3 * Math.min(f.scale, 1.2) / 1.2})`,
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Keyframe property editors */}
      <div className="p-4 ds-ceramic ds-edge rounded-ds-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold text-ds-text">
            Keyframe {activeFrame + 1} <span className="text-ds-text-low font-normal">/ {frames.length}</span>
          </div>
          <div className="text-[10px] font-mono text-ds-text-low">
            t = {(activeFrame / Math.max(frames.length - 1, 1)).toFixed(2)}
          </div>
        </div>

        <PropSlider label="Scale"     value={currentFrame.scale}    min={0.1} max={2}   step={0.01} disabled={frozen} onChange={(v) => handleFrameEdit({ scale: v })} fmt={(v) => v.toFixed(2) + '×'} />
        <PropSlider label="Opacity"   value={currentFrame.opacity}  min={0}   max={1}   step={0.01} disabled={frozen} onChange={(v) => handleFrameEdit({ opacity: v })} fmt={(v) => Math.round(v * 100) + '%'} />
        <PropSlider label="Rotation"  value={currentFrame.rotation} min={-180} max={180} step={1}  disabled={frozen} onChange={(v) => handleFrameEdit({ rotation: v })} fmt={(v) => v + '°'} />
        <PropSlider label="Translate X" value={currentFrame.x}      min={-50} max={50}  step={1}   disabled={frozen} onChange={(v) => handleFrameEdit({ x: v })} fmt={(v) => v + 'px'} />
        <PropSlider label="Translate Y" value={currentFrame.y}      min={-50} max={50}  step={1}   disabled={frozen} onChange={(v) => handleFrameEdit({ y: v })} fmt={(v) => v + 'px'} />

        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="ds-label">GLOW COLOR</span>
          <ColorPicker
            value={currentFrame.color}
            onChange={(c) => handleFrameEdit({ color: c })}
            label="Keyframe glow"
            disabled={frozen}
          />
        </div>
      </div>

      {/* EB-08-03 — Coordinate-space + trigger pickers (SC-045). The picker
          options are sourced from the canonical exported constants so RA-03
          invariance is enforced at the type level — adding a space/trigger
          in types.ts automatically surfaces it here. */}
      <div className="p-4 ds-ceramic ds-edge rounded-ds-lg space-y-3">
        <div>
          <div className="ds-kicker mb-1.5">COORDINATE SPACE</div>
          <div
            data-testid="kf-coordinate-space-picker"
            role="radiogroup"
            aria-label="Keyframe coordinate space"
            className="flex flex-wrap gap-1.5"
          >
            {KEYFRAME_COORDINATE_SPACES.map((space) => {
              const active = (edits.coordinateSpace ?? 'hub-scene') === space;
              return (
                <button
                  key={space}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={frozen}
                  onClick={() => setCoordinateSpace(node.id, space)}
                  className={`ds-chip ds-press cursor-pointer min-h-[40px] px-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    active ? 'ds-chip--brass' : 'hover:text-ds-text'
                  }`}
                >
                  {space}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="ds-kicker mb-1.5">TRIGGER</div>
          <div
            data-testid="kf-trigger-picker"
            role="radiogroup"
            aria-label="Keyframe trigger"
            className="flex flex-wrap gap-1.5"
          >
            {KEYFRAME_TRIGGERS.map((trigger) => {
              const active = edits.trigger === trigger;
              return (
                <button
                  key={trigger}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={frozen}
                  onClick={() => setTrigger(node.id, trigger)}
                  className={`ds-chip ds-press cursor-pointer min-h-[40px] px-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    active ? 'ds-chip--brass' : 'hover:text-ds-text'
                  }`}
                >
                  {trigger}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* EB-08-05 — Captured PrismKeyframe timeline. Each click of "save as
          keyframe" below appends a PrismKeyframe to node.keyframes; the
          chips here are how it "appears in animation timeline" per the
          EB-08-05 haltCheck. Empty state nudges the user toward the CTA. */}
      <div
        data-testid="kf-captured-timeline"
        className="p-3 ds-ceramic ds-edge rounded-ds-lg space-y-2"
      >
        <div className="flex items-center justify-between ds-kicker">
          <span>CAPTURED KEYFRAMES</span>
          <span>{persistedKeyframes.length}</span>
        </div>
        {persistedKeyframes.length === 0 ? (
          <div className="ds-body text-[12px] italic text-ds-text-low">
            No keyframes captured yet. Drag the canvas-mode gizmo, then click
            “save as keyframe”.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {persistedKeyframes.map((kf, i) => (
              <div
                key={i}
                className="ds-chip ds-chip--brass gap-1.5"
                title={`coordinateSpace=${kf.coordinateSpace}${kf.trigger ? `, trigger=${kf.trigger}` : ''}`}
              >
                <span className="text-ds-brass-200">#{i + 1}</span>
                <span>{kf.coordinateSpace}</span>
                {kf.trigger && (
                  <span className="text-ds-ice-300">· {kf.trigger}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setPlaying(true)}
          disabled={playing}
          className="ds-btn flex-1 h-9 text-[11px]"
        >
          <Icon name="play" size={11} color={DS.text} />
          Preview
        </button>
        {/* EB-08-05 + EBR2-E-02 — "Save as keyframe": snapshots the active
            node's canvasTransform into a PrismKeyframe with
            coordinateSpace='hub-scene' (or picker override) and routes the
            write through usePreviewStateStore (§R2-E SC-072 + FP-15). Save
            (EBR2-E-03) is what later commits the buffer → useGraphSourceStore
            and lets the debounced autosave flush. The CTA literal is
            greppable for the EB-08-05 source-shape test. */}
        <button
          data-testid="kf-save-as-keyframe"
          onClick={handleSaveAsKeyframe}
          disabled={frozen || !sourceNode}
          className="ds-btn ds-btn--ghost flex-1 h-9 text-[11px] whitespace-nowrap"
        >
          <Icon name="save" size={11} color={DS.brass300} />
          Save as keyframe
        </button>
        <button
          onClick={handleSave}
          disabled={frozen || !edits.dirty}
          className="ds-btn ds-btn--primary flex-1 h-9 text-[11px]"
        >
          {saved ? (
            <><Icon name="check" size={11} color={DS.ink} /> Saved</>
          ) : (
            <><Icon name="save" size={11} color={DS.ink} /> Save</>
          )}
        </button>
        <button
          onClick={() => reset(node.id)}
          disabled={frozen || !edits.dirty}
          className="ds-btn h-9 !px-3"
          title="Reset to default"
        >
          <Icon name="refresh" size={12} color={DS.text} />
        </button>
      </div>

      <div className="ds-body text-[12px] text-ds-text-low italic pt-1">
        Drag any slider to modify that keyframe. Tap Preview to play the full animation. The Code tab shows the generated GSAP code updating in real time.
      </div>

      {/* EB-09-01 — Animation library catalog. The three category tabs are
          driven from the canonical ANIMATION_METHODOLOGIES tuple (SC-047) and
          each entry references one of the 9 cinematic primitives (SC-048 +
          INV-12). Methodologies are surfaced as distinct categories — never
          collapsed into a single list. */}
      <AnimationLibrarySection />
    </div>
  );
}

// EB-09-01 — Animation library catalog UI (SC-047). Three category tabs in
// the canonical methodology order; entries reference the 9 cinematic
// primitives (SC-048 + INV-12) via the shared animation-library module.
function AnimationLibrarySection() {
  const [methodology, setMethodology] = useState<AnimationMethodology>(
    ANIMATION_METHODOLOGIES[0],
  );
  const entries = getLibraryByMethodology(methodology);
  return (
    <div
      data-testid="animation-library"
      className="p-4 ds-ceramic ds-edge rounded-ds-lg space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="ds-kicker">
          ANIMATION LIBRARY
        </div>
        <div className="text-[9px] font-mono text-ds-text-low">
          {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
        </div>
      </div>
      <div
        data-testid="animation-library-tabs"
        role="tablist"
        aria-label="Animation methodology"
        className="flex gap-1.5"
      >
        {ANIMATION_METHODOLOGIES.map((m) => {
          const active = m === methodology;
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={active}
              data-methodology={m}
              onClick={() => setMethodology(m)}
              className={`ds-chip ds-press cursor-pointer flex-1 justify-center min-h-[40px] transition-colors ${
                active ? 'ds-chip--brass' : 'hover:text-ds-text'
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>
      <ul
        data-testid="animation-library-entries"
        role="list"
        aria-label={`${methodology} entries`}
        className="space-y-1.5"
      >
        {entries.map((e) => (
          <li
            key={e.id}
            data-entry-id={e.id}
            data-primitive={e.primitive}
            className="px-3 py-2 ds-well rounded-ds-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-ds-text">
                {e.label}
              </span>
              <span className="text-[9px] font-mono text-ds-ice-300">
                {e.primitive}
              </span>
            </div>
            {e.description && (
              <div className="text-[10px] text-ds-text-low mt-1 leading-snug">
                {e.description}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PropSlider({
  label, value, min, max, step, onChange, disabled, fmt,
}: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean; fmt?: (v: number) => string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="ds-label">{label}</span>
        <span className="text-[10px] font-mono tabular-nums text-ds-brass-300">{fmt ? fmt(value) : value}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(+e.target.value)}
        className="ds-slider w-full disabled:opacity-40"
      />
    </div>
  );
}

function interpolateFrames(frames: FrameProps[], t: number): FrameProps {
  if (frames.length === 0) return defaultFrame(0, 1);
  if (frames.length === 1) return frames[0];
  const idxF = t * (frames.length - 1);
  const i0 = Math.floor(idxF);
  const i1 = Math.min(frames.length - 1, i0 + 1);
  const k = idxF - i0;
  const a = frames[i0], b = frames[i1];
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    scale: lerp(a.scale, b.scale),
    opacity: lerp(a.opacity, b.opacity),
    rotation: lerp(a.rotation, b.rotation),
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y),
    color: a.color, // keep snappy color transition
  };
}

// ═══════════════════════════════════════════════════════════════════
// CONNECTIONS TAB
// ═══════════════════════════════════════════════════════════════════
function ConnectionsTab({ node, graph, flyToNode }: { node: any; graph: EditorGraph; flyToNode: (id: string) => void }) {
  const incoming = graph.edges.filter((e) => e.target === node.id);
  const outgoing = graph.edges.filter((e) => e.source === node.id);
  const other = (id: string): EditorNode | undefined => graph.nodes.find((n) => n.id === id);
  // Edge-type tints from the DS palette — brass family + ice/status only,
  // mirroring DS_CATEGORY_TINTS. Retired hues are gone.
  const edgeColor = (t: string) =>
    ({ contains: DS.textMid, 'navigates-to': DS.ice300, triggers: DS.warn, 'data-flow': DS.ok, 'shares-state': DS.brass300, 'depends-on': DS.textLow }[t] || DS.textMid);

  return (
    <div className="p-5 space-y-4">
      <div>
        <div className="ds-kicker mb-2">INCOMING ({incoming.length})</div>
        <div className="space-y-1.5">
          {incoming.length === 0 && <div className="text-[11px] text-ds-text-low italic">None</div>}
          {incoming.map((e) => {
            const src = other(e.source);
            if (!src) return null;
            return (
              <button
                key={e.id}
                onClick={() => flyToNode(src.id)}
                className="w-full px-3 py-2 ds-well ds-edge rounded-ds-md ds-lift text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] tracking-wider" style={{ color: edgeColor(e.type) }}>← {e.type}</span>
                </div>
                <div className="text-[12px] text-ds-text font-semibold mt-0.5 flex items-center justify-between">
                  <span className="truncate">{src.name}</span>
                  <Icon name="chevron" size={11} color={DS.textLow} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="ds-kicker mb-2">OUTGOING ({outgoing.length})</div>
        <div className="space-y-1.5">
          {outgoing.length === 0 && <div className="text-[11px] text-ds-text-low italic">None</div>}
          {outgoing.map((e) => {
            const tgt = other(e.target);
            if (!tgt) return null;
            return (
              <button
                key={e.id}
                onClick={() => flyToNode(tgt.id)}
                className="w-full px-3 py-2 ds-well ds-edge rounded-ds-md ds-lift text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] tracking-wider" style={{ color: edgeColor(e.type) }}>→ {e.type}</span>
                </div>
                <div className="text-[12px] text-ds-text font-semibold mt-0.5 flex items-center justify-between">
                  <span className="truncate">{tgt.name}</span>
                  <Icon name="chevron" size={11} color={DS.textLow} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-3 border-t border-white/5">
        <div className="ds-kicker mb-2 flex items-center gap-1">
          <Icon name="flow" size={10} color={DS.brass400} />
          FLOW NAVIGATOR
        </div>
        <div className="ds-body text-[12px] text-ds-text-mid italic">
          {outgoing.length > 0
            ? `Step through this node's interaction chain: ${node.name} → ${other(outgoing[0].target)?.name}`
            : 'This node is a terminal — no outgoing flows.'}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BACKEND TAB
// ═══════════════════════════════════════════════════════════════════
function BackendTab({ node }: { node: any }) {
  if (!node.backendContract) {
    return <div className="ds-body p-5 text-center text-ds-text-low text-[12px] italic">No backend contract. This is a client-only node.</div>;
  }
  const bc = node.backendContract;
  return (
    <div className="p-5 space-y-3">
      <div className="ds-kicker">ASSOCIATED BACKEND</div>
      {/* Backend contract plate — ceramic card with a brass-fitted edge. */}
      <div className="p-3 ds-ceramic ds-edge--brass rounded-ds-lg">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="server" size={13} color={DS.brass400} glow />
          <div className="text-[12px] font-semibold text-ds-text-hi">{bc.service}</div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold"
              style={{
                // HTTP method = status semantics: ok / info(ice) / warn / danger.
                background:
                  bc.method === 'GET' ? dsAlpha(DS.ok, 0.2) :
                  bc.method === 'POST' ? dsAlpha(DS.ice400, 0.2) :
                  bc.method === 'PUT' ? dsAlpha(DS.warn, 0.2) : dsAlpha(DS.danger, 0.2),
                color:
                  bc.method === 'GET' ? DS.ok :
                  bc.method === 'POST' ? DS.ice300 :
                  bc.method === 'PUT' ? DS.warn : DS.danger,
              }}
            >
              {bc.method}
            </span>
            <span className="text-ds-text-mid">{bc.route}</span>
          </div>
          <div className="text-[10px] font-mono text-ds-text-mid ds-well rounded-ds-sm p-2 overflow-x-auto">{bc.schema}</div>
        </div>
      </div>

      <div className="ds-kicker pt-2">DEPLOYMENT</div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="px-2.5 py-2 ds-well rounded-ds-md">
          <div className="ds-kicker">PLATFORM</div>
          <div className="text-ds-text-mid font-mono mt-0.5">cloudflare-workers</div>
        </div>
        <div className="px-2.5 py-2 ds-well rounded-ds-md">
          <div className="ds-kicker">STATUS</div>
          <div className="text-ds-ok font-mono mt-0.5 flex items-center gap-1">
            <Icon name="check" size={11} color={DS.ok} /> Deployed
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WORLD INSPECTOR PANEL (EB-02-04 / SC-007)
//
// Rendered when the App_Name_World PrismRootNode is the selection. The tab
// bar carries WORLD_TABS (the dedicated 'World' tab prepended to the
// existing 6 — SC-020 "existing tabs preserved"). Only the World tab body
// has D1 content; the other tabs render a brief redirect note because
// component-level concerns (visual/behavior/code/etc.) don't apply to the
// root-node itself.
//
// Read/write: the World tab presents each D1 field as a JSON textarea that
// writes back through useGraphSourceStore.updateRootNode on blur (Save).
// Granular per-field UIs are scoped to later tasks (EB-02-05 vault;
// EB-02-06 capabilityRefs picker; design/build-plan tabs land in §7/§10).
// capabilityRefs is intentionally NOT surfaced here — that field is the
// vault-binding seam and EB-02-06 owns its dedicated picker per INV-19.
// ═══════════════════════════════════════════════════════════════════
function WorldInspectorPanel({
  root,
  tab,
  setTab,
  close,
  updateRootNode,
}: {
  root: PrismRootNode;
  tab: InspectorTab;
  setTab: (t: InspectorTab) => void;
  close: () => void;
  updateRootNode: (appNameWorldId: string, patch: Partial<PrismRootNode>) => void;
}) {
  // UI-FIDELITY-2 — hero glass: same slab recipe as the node Inspector
  // housing (one inspector panel mounts at a time, so the budget holds).
  const worldSlab = useChromeSlab({ material: 'glass', radius: 18, accent: 1, frost: 0.6 });
  // UI-WOW-2 P0 — compact pane re-houses this panel as a draggable BottomSheet
  // (hook called unconditionally, before any branch).
  const density = useEditorDensity();
  const compact = density === 'compact';
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2 px-4 py-3 m-3 mb-0 ds-metal ds-grain ds-edge rounded-ds-md">
        <div className="min-w-0 flex-1">
          <div className="ds-kicker flex items-center gap-1.5">
            <span>INSPECTOR</span>
            <Icon name="chevron" size={9} color={DS.textLow} />
            <span className="text-ds-brass-300">App_Name_World</span>
          </div>
          <div className="font-display font-bold text-ds-text-hi text-lg leading-tight flex items-center gap-2">
            {(root.spec?.name as string) || root.appNameWorldId}
          </div>
        </div>
        <button
          onClick={close}
          className="ds-btn ds-btn--quiet !px-0 w-8 h-8 !rounded-full shrink-0"
          title="Close inspector"
        >
          <Icon name="close" size={12} color={DS.text} />
        </button>
      </div>

      <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-hide">
        {WORLD_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`ds-chip ds-press cursor-pointer whitespace-nowrap min-h-[40px] px-3 gap-1.5 ${
                active ? 'ds-chip--brass' : 'hover:text-ds-text'
              }`}
            >
              <Icon name={t.icon} size={11} color={active ? DS.brass400 : DS.textMid} glow={active} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {tab === 'world' ? (
          <WorldTab root={root} updateRootNode={updateRootNode} />
        ) : (
          <div className="ds-body p-5 text-center text-ds-text-low text-[12px] italic">
            The <span className="text-ds-text-mid font-mono">{tab}</span> tab surfaces component-node data. App_Name_World holds app-level state — switch to <span className="text-ds-brass-300 font-mono">World</span> for the D1 fields.
          </div>
        )}
      </div>
    </>
  );

  if (compact) {
    return (
      <BottomSheet id="inspector" open onClose={close} initialSnap="half">
        {inner}
      </BottomSheet>
    );
  }

  return (
    // Same glass-housing geometry as the node Inspector (one inspector panel
    // mounts at a time, so the refract/backdrop budget is unchanged).
    <div
      ref={worldSlab.ref}
      className="absolute z-40 right-0 top-0 bottom-0 w-full md:w-[460px] md:right-3 md:top-3 md:bottom-3 flex flex-col overflow-hidden ds-glass ds-edge--brass ds-elev-4 rounded-none md:rounded-ds-lg ds-reveal-r"
      data-role="world-inspector"
    >
      {inner}
    </div>
  );
}

// World tab body — each D1 field is presented as a labelled JSON textarea.
// Edits are local until the user clicks Save, which round-trips through
// JSON.parse → updateRootNode. Invalid JSON keeps the local state dirty
// and surfaces the parse error inline; no silent loss.
//
// The fields are enumerated inline (not abstracted into a helper) so the
// source-shape EB-02-04 test can pin the textarea + updateRootNode call
// inside this function body — the dedicated tab IS its read/write surface.

function WorldTab({
  root,
  updateRootNode,
}: {
  root: PrismRootNode;
  updateRootNode: (appNameWorldId: string, patch: Partial<PrismRootNode>) => void;
}) {
  // D1 field set per RA-01/D1, declared inside the component so the
  // source-shape test sees each field name in the WorldTab body.
  // capabilityRefs is intentionally omitted — EB-02-06 owns the vault
  // picker for that field (INV-19, FP-06).
  const D1_FIELD_KEYS: readonly (keyof Pick<PrismRootNode,
    'spec' | 'designSpec' | 'buildPlan' | 'memoryLog' | 'hubRegistry' |
    'nodeRegistry' | 'globalDependencies' | 'validationRules' | 'aiRoutingRules'
  >)[] = [
    'spec', 'designSpec', 'buildPlan', 'memoryLog', 'hubRegistry',
    'nodeRegistry', 'globalDependencies', 'validationRules', 'aiRoutingRules',
  ];

  // Local edit state per field. Persisted shape mirrors the D1 keys so we
  // don't blow away unrelated drafts when one field is saved.
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(D1_FIELD_KEYS.map((k) => [k, JSON.stringify(root[k], null, 2)])),
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Re-sync draft when the underlying root field changes externally (e.g.
  // another tab wrote back). Keeps the textarea in step with store state.
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const k of D1_FIELD_KEYS) {
        next[k] = JSON.stringify(root[k], null, 2);
      }
      return next;
    });
    setErrors({});
  }, [root]);

  const setDraft = (field: string, value: string) =>
    setDrafts((p) => ({ ...p, [field]: value }));

  const handleSave = (field: keyof PrismRootNode) => {
    const raw = drafts[field as string];
    try {
      const parsed = JSON.parse(raw) as PrismRootNode[typeof field];
      setErrors((e) => ({ ...e, [field as string]: null }));
      updateRootNode(root.appNameWorldId, { [field]: parsed } as Partial<PrismRootNode>);
    } catch (e) {
      setErrors((er) => ({ ...er, [field as string]: (e as Error).message }));
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div className="ds-kicker">APP_NAME_WORLD · D1</div>
      <div className="ds-body text-[12px] text-ds-text-mid">
        The root-node fields below are real graph data per RA-01/D1. Edits write back through <span className="font-mono text-ds-brass-300">useGraphSourceStore.updateRootNode</span>.
      </div>

      {D1_FIELD_KEYS.map((field) => {
        const initial = JSON.stringify(root[field], null, 2);
        const draft = drafts[field] ?? initial;
        const err = errors[field];
        const dirty = draft !== initial;
        return (
          <div key={field} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="ds-label">{field}</span>
              <div className="flex items-center gap-1.5">
                {dirty && <span className="text-[9px] font-mono text-ds-warn">● modified</span>}
                <button
                  type="button"
                  data-role={`world-field-save-${field}`}
                  onClick={() => handleSave(field)}
                  disabled={!dirty}
                  className="ds-btn ds-btn--ghost !px-2 h-6 text-[10px]"
                >
                  Save
                </button>
              </div>
            </div>
            <textarea
              data-role={`world-field-${field}`}
              value={draft}
              onChange={(e) => setDraft(field, e.target.value)}
              spellCheck={false}
              className="w-full min-h-[88px] max-h-64 text-[10.5px] font-mono leading-relaxed text-ds-text ds-well rounded-ds-md p-2.5 resize-y focus:outline-none focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.55),var(--ds-focus-ring)]"
            />
            {err && <div className="text-[10px] font-mono text-ds-danger">parse error: {err}</div>}
          </div>
        );
      })}

      <CapabilitiesPanel
        refs={root.capabilityRefs}
        scopeHint={root.appNameWorldId}
        callerNodeId={root.appNameWorldId}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CAPABILITIES PANEL (EB-02-06 / SC-009)
//
// Lists capabilityRefs by display label (ref.label || ref.refId) and
// renders a 'Resolve' affordance that POSTs to /api/prism/vault/resolve.
// The server returns REDACTED metadata only — { ok, scope, ref, at, status }
// — never the raw secret value (INV-19).
//
// The picker reuses ref.scope as the resolution scope; the inspector
// passes the App_Name_World id as callerNodeId so SC-011's audit entry
// carries the originator. The redacted response is rendered verbatim — the
// raw secret payload is never read from the response in this component.
// ═══════════════════════════════════════════════════════════════════
interface ResolutionMeta {
  ok: boolean;
  scope: string;
  ref: string;
  at: string;
  status: 'resolved' | 'not-found' | 'scope-mismatch';
}

function CapabilitiesPanel({
  refs,
  scopeHint,
  callerNodeId,
}: {
  refs?: CapabilityRef[];
  scopeHint?: string;
  callerNodeId: string;
}) {
  const [results, setResults] = useState<Record<string, ResolutionMeta | { error: string }>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const handleResolve = async (ref: CapabilityRef) => {
    if (pending[ref.refId]) return;
    setPending((p) => ({ ...p, [ref.refId]: true }));
    try {
      const res = await fetch('/api/prism/vault/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: ref.scope || scopeHint,
          ref: ref.refId,
          callerNodeId,
        }),
      });
      const body = (await res.json()) as ResolutionMeta | { ok: false; error: string };
      if ('error' in body) {
        setResults((r) => ({ ...r, [ref.refId]: { error: body.error } }));
      } else {
        setResults((r) => ({ ...r, [ref.refId]: body }));
      }
    } catch (e) {
      setResults((r) => ({ ...r, [ref.refId]: { error: (e as Error).message } }));
    } finally {
      setPending((p) => ({ ...p, [ref.refId]: false }));
    }
  };

  const list = refs ?? [];

  return (
    <div data-role="capabilities-panel" className="space-y-2 pt-3 border-t border-white/5">
      <div className="ds-kicker">CAPABILITIES</div>
      <div className="ds-body text-[12px] text-ds-text-low italic">
        Capability refs bind to vault entries. Resolve is server-only; the response is redacted (INV-19).
      </div>
      {list.length === 0 ? (
        <div className="ds-body text-[12px] text-ds-text-low italic">No capabilityRefs configured.</div>
      ) : (
        <div className="space-y-1.5">
          {list.map((ref) => {
            const label = ref.label || ref.refId;
            const result = results[ref.refId];
            const isPending = pending[ref.refId] === true;
            return (
              <div
                key={ref.refId}
                data-role="capability-ref"
                className="px-3 py-2 ds-well rounded-ds-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-ds-text truncate">{label}</div>
                    <div className="text-[9px] font-mono text-ds-text-low truncate">
                      scope: {ref.scope || scopeHint || '(none)'}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-role="capability-resolve"
                    onClick={() => handleResolve(ref)}
                    disabled={isPending}
                    className="ds-btn ds-btn--ghost !px-2 h-6 text-[10px]"
                  >
                    {isPending ? 'Resolving…' : 'Resolve'}
                  </button>
                </div>
                {result && 'error' in result && (
                  <div className="mt-1.5 text-[10px] font-mono text-ds-danger">
                    error: {result.error}
                  </div>
                )}
                {result && !('error' in result) && (
                  <div
                    data-role="capability-resolution"
                    className={`mt-1.5 text-[10px] font-mono ${
                      result.ok ? 'text-ds-ok' : 'text-ds-danger'
                    }`}
                  >
                    <span className="opacity-70">status:</span> {result.status}{' '}
                    <span className="opacity-70">at</span> {result.at}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HISTORY TAB — SC-020 7th tab. Surfaces the per-node edit log so users
// can review color edits, animation-frame changes, and (later) AI
// regeneration events. Reads from the existing useAnimationEditsStore;
// when nothing has been edited yet, renders an empty-state placeholder
// so the tab is still reachable from every view mode (haltCheck).
// ═══════════════════════════════════════════════════════════════════
function HistoryTab({ node }: { node: EditorNode }) {
  const edits = useAnimationEditsStore((s) => s.edits[node.id]);
  const events: { kind: string; detail: string }[] = [];
  if (edits?.primaryColor) events.push({ kind: 'color', detail: `primary → ${edits.primaryColor}` });
  if (edits?.secondaryColor) events.push({ kind: 'color', detail: `accent → ${edits.secondaryColor}` });
  if (edits?.frames?.length) {
    events.push({ kind: 'animation', detail: `${edits.frames.length} keyframe edit${edits.frames.length === 1 ? '' : 's'}` });
  }

  return (
    <div className="p-5 space-y-4">
      <div className="ds-kicker">EDIT HISTORY</div>
      {events.length === 0 ? (
        <div className="ds-body px-3 py-2.5 ds-well rounded-ds-md text-[12px] text-ds-text-mid italic">
          No edits recorded for this node yet.
        </div>
      ) : (
        <ul data-role="history-events" className="space-y-1.5">
          {events.map((e, i) => (
            <li
              key={i}
              className="px-3 py-2 ds-well rounded-ds-md flex items-center gap-2 text-[11px]"
            >
              <span className="ds-chip ds-chip--brass">{e.kind}</span>
              <span className="text-ds-text font-mono truncate">{e.detail}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="ds-body text-[12px] text-ds-text-low pt-1">
        AI regeneration events will appear here once the codegen pipeline lands.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EB-03-06 / SC-017 — Group inspector
// Rendered in place of the single-node tabs whenever shift-click has
// promoted the selection into a multi-set (selectedNodeIds + selectedHubIds
// > 1). Surfaces a count, the type breakdown, and the list of selected
// names so the user can confirm which items are in the group. Clearing the
// group falls back to the single-select Inspector (or to nothing if the
// underlying singular selection was already nulled).
// ═══════════════════════════════════════════════════════════════════
function GroupInspector({
  selectedNodeIds,
  selectedHubIds,
  editorNodes,
  editorHubs,
  close,
  clearMultiSelection,
}: {
  selectedNodeIds: ReadonlySet<string>;
  selectedHubIds: ReadonlySet<string>;
  editorNodes: EditorNode[];
  editorHubs: EditorHubView[];
  close: () => void;
  clearMultiSelection: () => void;
}) {
  // UI-FIDELITY-2 — hero glass: same slab recipe as the node Inspector
  // housing (mutually exclusive mount, so the budget holds).
  const groupSlab = useChromeSlab({ material: 'glass', radius: 18, accent: 1, frost: 0.6 });
  // UI-WOW-2 P0 — compact pane re-houses this panel as a draggable BottomSheet
  // (hook called unconditionally, before any branch).
  const density = useEditorDensity();
  const compact = density === 'compact';
  const groupNodes = editorNodes.filter((n) => selectedNodeIds.has(n.id));
  const groupHubs = editorHubs.filter((h) => selectedHubIds.has(h.id));
  const total = groupNodes.length + groupHubs.length;
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2 px-4 py-3 m-3 mb-0 ds-metal ds-grain ds-edge rounded-ds-md">
        <div className="min-w-0 flex-1">
          <div className="ds-kicker">INSPECTOR · GROUP</div>
          <div className="font-display font-bold text-ds-text-hi text-lg leading-tight">
            {total} items selected
          </div>
          <div className="text-[10px] font-mono text-ds-text-mid mt-0.5">
            {groupNodes.length} nodes · {groupHubs.length} hubs
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <button
            type="button"
            data-role="group-clear"
            onClick={() => clearMultiSelection()}
            title="Clear multi-selection"
            className="ds-btn !px-2.5 h-7 text-[10px]"
          >
            Clear
          </button>
          <button
            onClick={close}
            className="ds-btn ds-btn--quiet !px-0 w-8 h-8 !rounded-full shrink-0"
            title="Close inspector"
          >
            <Icon name="close" size={12} color={DS.text} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
        {groupHubs.length > 0 && (
          <div>
            <div className="ds-kicker mb-2">HUBS</div>
            <ul data-role="group-hub-list" className="space-y-1">
              {groupHubs.map((h) => (
                <li
                  key={h.id}
                  className="px-3 py-2 ds-well rounded-ds-md text-[12px] text-ds-text font-ui font-medium"
                >
                  {h.name}
                  <span className="text-ds-text-low font-mono"> · {h.route}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {groupNodes.length > 0 && (
          <div>
            <div className="ds-kicker mb-2">NODES</div>
            <ul data-role="group-node-list" className="space-y-1">
              {groupNodes.map((n) => (
                <li
                  key={n.id}
                  className="px-3 py-2 ds-well rounded-ds-md text-[12px] text-ds-text font-ui font-medium"
                >
                  {n.name}
                  <span className="text-ds-text-low font-mono"> · {n.elementType}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );

  if (compact) {
    return (
      <BottomSheet id="inspector" open onClose={close} initialSnap="half">
        {inner}
      </BottomSheet>
    );
  }

  return (
    // Same glass-housing geometry as the node Inspector (mutually exclusive
    // mount — the backdrop-filter budget stays at one inspector surface).
    <div
      ref={groupSlab.ref}
      data-role="group-inspector"
      className="absolute z-40 right-0 top-0 bottom-0 w-full md:w-[460px] md:right-3 md:top-3 md:bottom-3 flex flex-col overflow-hidden ds-glass ds-edge--brass ds-elev-4 rounded-none md:rounded-ds-lg ds-reveal-r"
    >
      {inner}
    </div>
  );
}

