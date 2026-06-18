# P7 Evidence — Edit History (undo/redo + timeline) (2026-06-18)

Background agent (opus) + orchestrator live verification (Chrome DevTools MCP). tsc 0-new (baseline 9), 3062/3062 tests
pass (incl. new 8-test P7 suite), anti-drift clean. zundo 2.3 + immer 11.1.8 (installed + allowlisted).

- **C32 undo/redo ≥100:** `useGraphSourceStore` wrapped in zundo `temporal` (limit 100, partialize to durable schema,
  400ms burst-coalesce that latches the pre-burst state). Cmd+Z / Cmd+Shift+Z via `history/HistoryKeybinds.tsx` mounted in
  page.tsx (guards against typing in inputs). Live proof: `useGraphSourceStore.temporal` exists with
  pastStates/futureStates/undo/redo; made a source edit (scaleX 1.45→1.75) → pastStates=1; `temporal.undo()` → scaleX
  reverted to **1.45**, futureStates=1 (redo available). Undo/redo re-bump `nodeRebuildVersion` (via the existing
  `bumpNodeRebuildVersion`, never editing useGraphEditorStore) + evict artifacts so BUILT state re-realizes, and re-fire
  autosave via `markDirty(true)`. (Pose-only edits like scaleX render live without a rebuild — bump fires for
  material/codeRef changes.)
- **C33 timeline panel:** slab-hosted glass `EditHistoryPanel.tsx` mounted in the Inspector History tab — ordered
  past/future states with human-readable descriptions + timestamps, click-to-jump (indexes into pastStates/futureStates).
  Live: Inspector History tab renders the panel. Frame: `history-panel.png`.
- **C34 staging coherence:** jumps/undos call `usePreviewStateStore.discardAll()` (via `lib/editor/history-coherence.ts`)
  so no pending ghost overlay contradicts the restored schema.
- Files: useGraphSourceStore.ts, Inspector.tsx (History tab), page.tsx (keybind mount), new
  history/HistoryKeybinds.tsx + panels/EditHistoryPanel.tsx + lib/editor/history-coherence.ts; deps + allowlist.
