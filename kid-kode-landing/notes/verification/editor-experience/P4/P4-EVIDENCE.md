# P4 Evidence — Intelligent 3D drag-to-position (2026-06-18)

Background agent (opus) + orchestrator live verification (Chrome DevTools MCP, canvas mode). tsc 0-new (baseline 9),
2846 editor-build tests pass, anti-drift clean. drei v10.7.7 API per RE-VERIFY-DECISIONS.md.

- **C17 arm-on-select:** `selectNode`/`flyToNode` set `editorMode:'edit'` when a node id is selected (deselect/hub/drill
  stay idle). Live proof: `selectNode('orr-arrival-watch')` → `editorMode` became **'edit'** with no Edit-Handles click;
  gizmo handles (red X / green Y arrows + center) render on the watch immediately. Frame: `gizmo-arm-on-select.png`.
- **C18 modes + space:** g/r/s mode keys; new store `gizmoSpace:'world'|'local'` (live: present, default 'world') +
  `setGizmoSpace`/`toggleGizmoSpace`, 'x' key toggle, toolbar World/Local control, forwarded to `<TransformControls space>`.
- **C19 snapping:** dead toolbar local-state lifted to store `snapEnabled` (live: present, default true) +
  `setSnapEnabled`/`toggleSnap`; gizmo passes `translationSnap=0.125u / rotationSnap=15° / scaleSnap=0.1` when on (null off)
  + a faint brass gridHelper anchor hint. Toolbar Snap On/Off now actually drives it.
- **C21 camera/touch:** `makeDefault` on the canvas `SceneControlsBridge` CameraControls → drei TransformControls
  auto-suspends orbit during a gizmo drag (built-in dragging-changed). `size={1.35}` enlarges handles for touch. Galaxy
  `ControlsBridge` left non-default + distance limits byte-unchanged → NE-SC-01/03 not regressed (mutually-exclusive mounts).
- **C22 ghost/pending (D-DRAG):** gizmo onObjectChange + Escape + toolbar nudge/scale/rotate/align/reset now STAGE
  `scenePosition` through `usePreviewStateStore.set(nodeId,{scenePosition})` (source⊕overlay ghost) instead of direct
  `updateNode`/`setScenePosition` source writes — no autosave on drag. Live proof: staged scenePosition.y → overlay held
  it, **source unchanged** (y stayed -2.4) → preview-app stays frozen until Save (commitPreviewToSource). Test EBR2-C-04
  asserts the gizmo stages (not updateNode); EBR2-C-01 asserts arm-on-select.
- Files: GraphScene.tsx, CanvasToolbar.tsx (P2a dock code byte-identical), useGraphEditorStore.ts.
