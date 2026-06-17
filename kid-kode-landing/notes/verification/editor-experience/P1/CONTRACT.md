# P1 — Persistence & Build Integrity — CONTRACT (contract-first)

Derived from `../P0/ARCHITECTURE-MAP.md`. Closes C1–C8 + folds in NE-SC-13, NE-SC-14,
RT-SC-06. Model: claude-opus-4-8. The bar: the **C5 advocate proof** must pass in the
running app — *edit a node's position → it does NOT move in preview-app → Save → still
doesn't → Build that node → NOW it moves.*

## THE ONE ARCHITECTURE DECISION — "BUILT-freeze in preview-app"

The mental model: **the graph/schema IS the runtime; preview-app shows BUILT state only**
(INV-R6, canvas-spec §6). Today the renderer reads source⊕overlay (and applies in-place
`setSpec`) in **all** modes, so staged/committed-but-unbuilt edits leak into preview-app.

**Decision:** the renderer uses a per-node *effective* state selected by view mode:

| Mode | Position source | Spec source (text/image/material/mesh) |
|---|---|---|
| `canvas` (authoring) | `source.scenePosition ⊕ overlay` (live ghost, D-DRAG/C22) | `composeNodeWithPreview` + in-place `setSpec` (live) |
| `preview-app` | **`built[nodeId].position`** (frozen) | **`built[nodeId].spec`** via the cached artifact + `setSpec(builtSpec)` (frozen) |
| `galaxy` | sphere placement (unchanged) | n/a (spheres) |

- `built[nodeId]` = the position+spec the node was **last realized with**. Initialized at
  first mount (from `live-graph.json`), refreshed **only** by `rebuildNode` (explicit Build).
  Stored in a small store (extend `useBuiltSnapshotStore` or a sibling `useBuiltStateStore`).
- This makes **Save ≠ visible-in-preview**: Save commits overlay→`source` and marks the node
  dirty, but `built[nodeId]` is untouched, so preview-app stays frozen. **Build** copies
  committed source → `built[nodeId]` (via re-realization) → preview-app updates. ✅ C5 proof.
- Canvas keeps direct-manipulation feel (gizmo ghost moves live), satisfying SC-9 *and* C22.

**Why not just gate `composeNodeWithPreview` to canvas?** Because (a) `setSpec` has already
mutated the shared Object3D, and (b) position is read live from `source.scenePosition` which
Save mutates — both would still leak at Save. The `built[nodeId]` layer is the minimal
correct addition. (`built` is in-memory editor state, not persisted — INV-R10 additive-safe.)

## WAVES (each: implement → tsc 0-new → KripVerify evidence → checkpoint)

### Wave 1 — orphan-store reroute + Discard (LOW RISK, additive; does not touch render hot path)
- **C1/C8 (fix A):** route VisualTab color pickers (`Inspector.tsx:713,722`) and AnimationTab
  frame faders (`Inspector.tsx:988`, sliders 1148-1161) through `usePreviewStateStore.set`
  instead of `useAnimationEditsStore`. Map color → the node's `materialSpec`/`visual` schema
  field that `node-content-hash.ts` already projects; map frame faders → a staged
  `canvasTransform`/`keyframes` patch. Retire `useAnimationEditsStore` as an edit sink (keep it
  only if still needed as a transient log until P7 replaces it).
- **C6:** wire a **Discard** affordance in the Inspector (and per-edit) → `usePreviewStateStore.discard(nodeId)`; restores last-built/committed state. Add it next to Save.
- **C2:** dirty badge already exists (`Inspector.tsx:414`); add (a) a pending-edit **count/diff**
  on the badge and (b) a dirty marker on the **minimap** node.
- **Evidence:** open Inspector, change a color → `__PRISM_DEBUG_STORES__.previewState` shows a
  patch + node dirty; Discard clears it. Screenshot the dirty badge + minimap marker.

### Wave 2 — preview-app BUILT-freeze (KEYSTONE; touches GraphScene render path — careful)
- Add `built[nodeId] = {position, textSpec?, imageSpec?, materialSpec?, meshPrimitive?}`
  captured in the artifact factory (`ArtifactNode.resolveArtifactObject`) at realize time and
  refreshed by `rebuildNode`.
- `AssembledSceneNode` (GraphScene.tsx:2617-3022): select effective position+spec by viewMode
  per the table above. The in-place `setSpec` effects (2773-2895) apply **composed** spec in
  canvas, **built** spec in preview-app (so toggling to preview-app reverts an un-built setSpec).
  The group position (2642-2667) reads composed in canvas, `built.position` in preview-app.
- **C5/C8/NE-SC-13:** preview-app composes ONLY built state. **RT-SC-06:** ensure the Build
  re-realization still shows the pop-transition (sphere→position→artifact) — don't regress it.
- **Evidence (the C5 proof, KripVerify):** in canvas, drag/nudge a node → screenshot (moved in
  canvas). Toggle preview-app → screenshot (NOT moved). Save → preview-app screenshot (NOT
  moved). Build → preview-app screenshot (moved). Plus `__prismBuiltSnapshots()` assertions.

### Wave 3 — single edit/save/build path + inspector timing (NE-SC-14, C7)
- **NE-SC-14/FP-NE-5:** retire the legacy `VisualPreview` "Save & Verify" regen-api second path
  (`panels/visual-preview/regen-api.ts`); unify on overlay→Save→Build. (Coordinate with P2 C9,
  which relocates VisualPreview out of the Inspector — may fold together.)
- **C7/D-INSPECT-TIMING:** auto-inspector validates STAGED edits (non-blocking "will-build /
  won't-crash"), never commits/re-realizes itself. Repair tier = D-INSPECTOR-MODEL swappable
  contract (stub/Opus now). Surface a non-blocking validity hint on the staged edit.

## INVARIANTS / FORBIDDEN (P1)
- No auto-apply to preview-app or a built element's canonical position without explicit per-node
  Build. No writing `node.schema`/persisted graph on edit (edits stage in the overlay).
- `built[nodeId]` is in-memory only (not persisted); additive (INV-R10). No second renderer.
- Build re-realizes via the REAL `createNode` path (`rebuildNode`), never a live-object shortcut.
- Verification = real frames + interaction (KripVerify), never assertion-only.

## DONE = all 8 criteria evidenced + advocate C5 proof PASS + tsc 0-new + suite green + no-regression
(canvas/preview/galaxy intact; primitive-catalog + element-library counts unchanged).
