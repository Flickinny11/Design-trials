# APP REALITY — resumable progress ledger

**Run:** Make the Prism editor read as a real navigable 3D app (camera model, preview-as-app,
backgrounds, device modes, Function/nav binding). Branch `prism-editor-build`.
**Model:** claude-opus-4-8 (env-confirmed; never trust label — re-confirm on resume).
**Started:** 2026-06-14.
**Bar:** WOW + "behaves like a real app". Interactive + visual verification (real frames), DPR-2,
desktop + mobile + constrained(preview-pane). 0 MUST-FIX per phase before checkpoint.

## Ground truth (recon — do not re-derive)
- View modes: `galaxy | canvas | preview-app` (canonical 3; FP-12/FP-14 block off-canon literals).
  Store: `src/stores/useGraphEditorStore.ts`. Default boot = `preview-app`.
- Camera: ONE place — `SceneControlsBridge` in `src/components/editor/graph/GraphScene.tsx`
  (~L1437–1621) handles canvas + preview-app. Galaxy uses `ControlsBridge` (~L1290). Library:
  drei `CameraControls` (yomotsu/camera-controls). Canvas currently restricted by
  `computeCanvasCameraRail` (`src/lib/editor/canvas-camera-rail.ts`): ±0.35rad polar/azimuth
  windows + pan boundary box + distance window. Preview-app only disables dolly (rotate/truck
  still live). Dev hooks: `__PRISM_EDITOR_GET_CANVAS_CAMERA__`, `__PRISM_EDITOR_GET_CANVAS_RAIL__`.
- Schema: `src/lib/prism-graph/types.ts` — `PrismNode` is the additive contract. Already present:
  `keyframes?: PrismKeyframe[]` with `coordinateSpace: 'camera'` in the canonical 5 (P2 fits this);
  `PrismHub.background?: PrismHubBackgroundLayer[]` + `layout.mockupUrl` (P4); `responsiveBreakpoints`
  + node `responsiveSizing` (P5); `animationBindings` (precedent for additive binding arrays).
  Backdrop renderer: `SceneBackdropLayer` in GraphScene (~L1623).
- Toolbar: `src/components/editor/overlays/CanvasToolbar.tsx` — `ToolGroupId` (~L129), `GROUPS`
  (~L150), flyout branch (~L906). Tool-group ids camelCase for multi-word. Inspector:
  `src/components/editor/.../Inspector.tsx` has Edit + Clone. Library modal pattern:
  `libraryOpen`/`openLibrary` in store + root mount in `src/app/page.tsx` (~L849). Picker grid:
  `ElementLibraryBrowser.tsx`. Wizard window: `change-artifact/WizardWindow.tsx`.
- Stores: `useGraphSourceStore` (source of truth, `updateNode`), `usePreviewStateStore` (overlay,
  FP-15: Inspector tabs route through it, not source). Save/Save-and-Rebuild: `preview-commit.ts`,
  `rebuild-node.ts`, `bumpNodeRebuildVersion`.
- Elements: `src/lib/editor/elements/` (contract.ts, registry.ts, instantiate.ts, catalog/*=37).
- ORRERY showcase graph: `public/prism-mock/home/live-graph.json`. Watch node id ~`orr-arrival-watch`.
- Preview-app renders IN-PLACE via the single `<GraphScene/>` (one `<Canvas>`, keyed by
  content-type not viewMode). PrismHost.tsx is dead (imported nowhere).
- Verify tooling: Playwright 1.60. `scripts/verify-editor-runtimes.mjs` (port 4791, spawns next dev,
  drives modes, captures PNGs). `npm run dev` = `build:prism && next dev`. DOM rule FP-05 scope
  excludes editor overlays → navigator.vibrate OK in `src/components/editor/overlays/*`.

## Deliberate spec overrides this run (Logan-authorized, like the 2026-06-14 AMENDMENT)
- **SC-071 superseded for CANVAS:** canvas camera is now FULLY FREE (orbit/pan/zoom). The
  `computeCanvasCameraRail` angular/pan clamps no longer apply to canvas. (Rail helper retained
  for reference / possible preview-frame use.)
- **Preview-app camera LOCKED:** no user 3D camera movement; full-bleed; never expose scene
  edges or blank bg. Camera is programmatic-only (the configured view / P2 journey).
- **AMENDMENT 2026-06-14 (Function in Canvas):** implemented this run — additive node schema.

## Phase status
| P | Title | Status | Checkpoint |
|---|---|---|---|
| P1 | Camera model (canvas free / preview locked + reset-zero + angle HUD + haptic) | DONE ✅ | 42c270e6 |
| P2 | Camera-in-keyframe (keyframeable camera journey) | DONE ✅ | 34fa3d49 |
| P3 | Edit-in-Preview | TODO | — |
| P4 | Backgrounds full viewport (desktop+mobile) | TODO | — |
| P5 | Device modes (real responsive) | TODO | — |
| P6 | Hub navigation working (reparent-on-navigate + morph) | TODO | — |
| P7 | Function button + binding popup + sample holographic overlay | TODO | — |
| P8 | Nav chrome primitives (nav library category) | TODO | — |
| P9 | Interactive verification + sign-off | TODO | — |

## fal ledger
`notes/verification/app-reality/fal-ledger.json` (continues cumulative ~$0.479; warn $25/$40, STOP $48).

## Resume protocol
1. Re-confirm model == claude-opus-4-8.
2. Read this file + `notes/APP-REALITY-REPORT.md`.
3. Pick the first non-DONE phase; read its contract block below; continue.
4. Kill stray dev servers / browsers at each phase boundary.

---
## P1 CONTRACT
**Goal:** Canvas = fully free 3D edit camera; Preview-app = camera-locked, full-bleed.
Canvas gains: one-click RESET-VIEW-TO-ZERO (straight-on), live ANGLE READOUT, haptic
(navigator.vibrate) + visual pulse when view returns to zero/straight.
**Touches:** `SceneControlsBridge` (GraphScene), `useGraphEditorStore` (new reset-view signal +
live canvas-view angles), new overlay `CanvasCameraHud.tsx` (angle readout + reset button +
pulse), wire HUD into `page.tsx` (canvas mode only).
**Invariants:** one renderer; additive store only; no off-canon viewMode; DOM/navigator only in
overlay (FP-05 safe). Galaxy free-nav unchanged.
**Verify:** frames in `app-reality/p1/`: canvas free-orbit (off-axis pose proves unrestricted),
preview-locked (drag does nothing), reset-zero returns straight-on + pulse, angle HUD legible,
DPR-2 desktop + mobile + constrained.
