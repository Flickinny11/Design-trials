# PREBUILT ELEMENT LIBRARY — PROGRESS (resumable)

Run: §13 prebuilt element library (criterion 21 + 23). Branch `prism-editor-build`.
Model: claude-opus-4-8 (confirmed at start; Fable-5 down → pinned Opus). ULTRACODE.

## fal spend ledger
- Account budget: $50. Prior cumulative (canvas-final): ~$0.263.
- This run: $0.00 so far. (warn $25/$40, STOP $48.)

## tsc baseline
- 9 pre-existing errors (GraphScene GLProps + test NodeContext.THREE). Gate: ≤9 (0 new).

## Phase status

### Phase 0 — Contract — ✅ COMPLETE
- Froze the typed cluster contract: `src/lib/editor/elements/{contract,registry,instantiate}.ts`.
- Additive store seams: `useGraphSourceStore.addNodesBatch`; `useGraphEditorStore`
  library/placement state (`libraryOpen`/`openLibrary`/`closeLibrary`,
  `placingClusterId`/`setPlacingCluster`/`clearPlacement`).
- Doc: `notes/PREBUILT-LIBRARY-CONTRACT.md` (frozen).
- Proof: `tests/editor-build/PBLIB-instantiate.test.ts` 7/7 green; tsc 9 (0 new).
- Home is `src/lib/editor/**` (editor scope; dep-guard allows `@/` alias there).
- AUTO-CKPT: <pending commit>

### Phase 1 — Library UI — ✅ COMPLETE (real-GPU verified)
Commit 5650e06. Toolbar 'Elements' group (icon 'layers') + LibraryFlyout +
root-mounted ElementLibraryBrowser (search/category, z-stack so the cluster rig
shows through transparent tile windows) + cluster-tile-renderer (dedicated
shared-rig; members built via defaultRenderModeFactory = preview==placed;
integrated animationBindings play) + ClusterCanvas/ClusterTile +
ElementPlacementLayer (galaxy drag/click-to-place). Rig auto-frames cluster
bounds + re-frames for async members.
EVIDENCE (scripts/prebuilt-library-capture.mjs, channel:chrome DPR-2):
backend webgpu, rig ready/tileCount2/deviceLost0, consoleErrors 0; tiles render
real 3D (frames 03/04b); criterion 21 PROVEN. tsc 9 (0 new); suite 2826 pass.
Backlog: hero seed sparse/dark (Phase 2/4 quality), placement lands in nearest
hub (driver now flies to it).

### Phase 2 — Element catalog — ⏳ RUNNING (workflow wf_fb6b489e-306)
34 NEW elements across all 16 categories (one subagent each), self-registering
catalog files. Plan: notes/PREBUILT-LIBRARY-CATALOG-PLAN.md. After: regenerate
barrel + tsc + catalog-render check.

### Phase 3 — Hybrid customization + integration — ⬜ NOT STARTED
Prove placed element: integrated anim editable + swappable (Animation Picker),
keyframe editor, material/light/geometry/text/per-face customizable, "take just
the object", composes live with other features. Driver-verified.

### Phase 4 — Interaction verification + sign-off — ⬜ DRIVER READY
scripts/prebuilt-library-advocate-capture.mjs (real-GPU DPR-2 + mobile DPR3:
per-element frozen+playing crops w/ sharp frameDelta motion proof + nonEmptyFrac,
gallery overview, place→fly-to-hub→canvas+preview-app). Then user-advocate agent
judges the bundle. Criterion 21/23 + no-regression + perf + SR side-by-side.

## Key reuse map (audited Phase 0)
- Schema: `src/lib/prism-graph/types.ts` (PrismNode fields; `ArtifactSource` already has `'prebuilt'`).
- Graph store: `src/stores/useGraphSourceStore.ts` (`addNode`/`addNodesBatch`/`groupNodes`; 1s autosave → `/api/prism/regen` → `public/prism-mock/home/live-graph.json`).
- Editor store: `src/stores/useGraphEditorStore.ts` (viewMode galaxy|canvas|preview-app; editorMode idle|edit; openChangeArtifact pattern; clone-drag slots).
- Toolbar: `src/components/editor/overlays/CanvasToolbar.tsx` (GROUPS array + ToolGroupId union + flyout switch ~L781-901; `changeArtifact` is the precedent group).
- Flyout precedent: `src/components/editor/change-artifact/ChangeArtifactFlyout.tsx`; wizard root-mounted in `src/app/page.tsx`.
- Hover tiles: `src/components/editor/animation-catalog/{PrimitiveTile,SharedCanvas,SharedViewport,CatalogGallery}.tsx` + `shared-tile-renderer.ts` (shared-rig).
- Node build: `src/lib/prism/runtime/factories/default-factory.ts` (createNode); bindings `src/lib/prism/animatable/bindings.ts`.
- Animatable contract/registry: `src/lib/prism/animatable/{contract,registry}.ts` (406 primitives; `animationBindings.primitive` keys by name).
- Design system: `src/components/editor/design-system` + `src/app/globals.css` (Observatory-Brass `ds-*` tokens; shared UI primitives `animation-tools/ui.tsx`).
- node via nvm: `export PATH="/Users/loganbaird/.nvm/versions/node/v22.22.1/bin:$PATH"`.
