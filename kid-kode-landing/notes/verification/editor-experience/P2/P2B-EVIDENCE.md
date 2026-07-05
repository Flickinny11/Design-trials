# P2b Evidence — C9 Inspector↔Canvas decouple (+ C8-A reroute + NE-SC-14) (2026-06-18)

Background agent (opus) + orchestrator verification. tsc=9 (0 new), full editor-build+unit suite **3054 pass / 0 fail**,
new 12-test C9 structural guard passes.

## C9 — decouple (shared editors used by BOTH canvas + node-editor)
- `panels/MaterialTab.tsx` and `panels/ColorPicker.tsx` are now thin **re-exports** of
  `shared-editors/MaterialEditor.tsx` (new) and `shared-editors/ColorPicker.tsx`. The shared MaterialEditor is
  slab-hosted (ceramic, `useChromeSlab`) per the design law with ds-ceramic fallback.
- `object-tools/ObjectFlyout.tsx` mounts `<MaterialEditor node frozen compact />` INLINE (line ~447) and the
  `openInspector('material')` delegation seam is CUT. Inspector mounts the same MaterialTab(→MaterialEditor).
- Live proof: selected `orr-arrival-watch`, opened the canvas "3D Object" flyout → Material/Lighting/Receives controls
  render inline with **`inspectorOpen:false`** (no node-editor Inspector pop). Frame: `p2b-c9-material-inline.png`.
  → canvas color/material editing survives without the Inspector (the C9 acceptance).

## C8-A — orphan-store reroute (deferred from P1)
- Inspector Visual-tab color pickers `setPrimary`/`setSecondary` now write
  `usePreviewStateStore.getState().set(nodeId, { materialSpec })` (staging overlay, FP-15-legal) instead of the orphan
  `useAnimationEditsStore`. Anim-tab frame faders stage to `node.keyframes` via the same overlay.
- `lib/editor/node-content-hash.ts` now projects `materialSpec` + `receivesLighting` — so a committed material/lighting
  edit invalidates the snapshot and Save-and-Rebuild re-realizes it (previously slipped past the hash-gate as a no-op).
- Live store proof: staged `materialSpec.baseColor=#19d3ff` via the rerouted path → preview overlay holds it; **source
  node materialSpec UNCHANGED** → preview-app renders built state only (won't show the staged color until Save+Build).

## NE-SC-14 — second edit/save/build path retired (canonical criterion, FP-NE-5)
- `VisualPreview` is display-only; its "Save & Verify" button + `regen-api` import removed. `regen-api.saveAndVerify`
  is a hard-disabled stub (returns `{ok:false, error:"…RETIRED…"}`, never fetches). **No live importer**
  (`grep import.*saveAndVerify` → none; remaining matches are comments + the legit server `api/prism/regen/route.ts`).
- All editing unifies on the single `overlay → Save(commitPreviewToSource) → Build(rebuildNode)` path.
- Closed in `unmet-criteria.json` (now 5 remaining: RT-SC-02, RT-SC-06, NE-SC-01, NE-SC-03, NE-SC-13 — separate
  STEP-4/later-phase work).

## P2 COMPLETE
C9 ✓ + C10 ✓ + C11/glass ✓ + C12 hero ✓ (prior). C13 perf held (slab cap 64/family, ~38 in use). Forbidden-aesthetic
sweep clean (no backdrop-filter panel surfaces, no flat fills, no purple).
