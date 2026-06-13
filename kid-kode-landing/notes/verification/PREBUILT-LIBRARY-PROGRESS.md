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

### Phase 1 — Library UI — ⬜ NOT STARTED
Toolbar "Elements" group + root-mounted premium browser (shared-rig hover tiles,
search/category) + drag-to-place. Mount browser in `src/app/page.tsx`.

### Phase 2 — Element catalog — ⬜ NOT STARTED
Comprehensive catalog, every §13 category + UI-enhancers, multiple variants each.
One subagent per element → `src/lib/editor/elements/catalog/<id>.ts`.

### Phase 3 — Hybrid customization + integration — ⬜ NOT STARTED

### Phase 4 — Interaction verification + sign-off — ⬜ NOT STARTED

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
