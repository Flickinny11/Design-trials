# Prism Editor Build — Round 2 Gap Analysis

**Branch:** `prism-editor-build`  **Audit date:** 2026-05-18  **Author:** Round-2 arming session (Opus 4.7)

Input to Round 2's spec amendment (STEP 2), drift extensions (STEP 3), and Ralph task list (STEP 4). Findings are from three read-only Explore agents that walked the preview-app render path, the canvas transform-handle pipeline, and the inspector/save/clone surface — plus the user's brainstorm clarifying the intended UX.

## 1. User brainstorm (verbatim intent)

- **Preview App is the "real app" view.** Clicking it must assemble every node tethered to the active hub into its designated 3D position. Most artifacts are 3D objects — they must be visible. Currently the user sees only the hub background (incorrectly sized) and nothing else.
- **This prototype IS only the preview window** of a future AI app builder. The real product has streaming chat on the left and this pane on the right. There are no files/directories — only the canvas authoring surface and the runtime preview.
- **Canvas mode supports actual editing.** Select a node → click **Edit** → drag handles to translate / rotate / resize the node's actual position in 3D space, bounded by heavy guardrails so the user can't drift away from the active hub.
- **Galaxy mode is the only unbounded mode.** Full open-world camera; users navigate the universe of hubs there.
- **Inspector edits are real-time-preview-only until Save.** Faders/knobs visibly change the node, but persistence requires explicit **Save** (state only) or **Save and Rebuild** (state + re-render just that node).
- **Clone is galaxy-mode-only drag.** Click Clone in Inspector → view auto-switches to galaxy → clone follows the cursor → tether snaps to the nearest hub (ACAD-style). On drop, the clone parents to that hub and auto-updates its caption/schema.
- **`preview-hub` and `hub-world` are redundant.** They overlap with `preview-app` and `galaxy`. Remove them. Canonical view modes become exactly `galaxy | canvas | preview-app`.
- **Verification:** local Playwright snapshots are not enough. After each push, the Vercel preview deploy must be visually analyzed via KripVerify (kv_* MCP tools) to confirm the live preview renders correctly with no console errors / no failing network requests.

## 2. Decisions confirmed by user (this session)

- **Default view mode on app boot = `preview-app`.** This is the entire reason the prototype exists. When integrated into an AI app builder later, users will see this preview pane first; they only enter `galaxy` / `canvas` when they want to edit.
- **Save-and-Rebuild = single-node visual artifact re-render.** Save persists. Save-and-Rebuild persists + disposes (`userData.cleanup`) + re-invokes `createNode` for that one node, re-mounting at the same scene position. The single-node-only constraint is deliberate: one of the runtime's core advantages is fast iteration on one node without touching the rest of the app. Full `.prism` rebuild remains a build-time operation, **not** an in-app action.

## 3. Findings — preview-app rendering gap

### Pipeline summary

```
useGraphSourceStore  ─→ compileAppToPreview(world, hubs, nodes, edges)
        │                       │
        │                       ├─→ CompiledAppView.world (RA-17 surface)
        │                       ├─→ CompiledAppView.crossHubTethers
        │                       └─→ CompiledAppView.hubs[].CompiledHubView
        │                                                   ├─→ cameraRail   ─→ PrismHost ✓
        │                                                   ├─→ background   ─→ PrismHost ✓
        │                                                   └─→ nodes[]       (anchor positions)
        │                                                                       │
        │                                                                       ✗ NEVER APPLIED
        │
        └─→ mountFromGraphSource()  ─→  liveResult.updateNodeTransform(nodeId, pos)
                                              ↑
                                              available, called only with scenePosition (raw store)
```

### Evidence (file:line)

- Compile called in [page.tsx:210-231](src/app/page.tsx) — runs `compileAppToPreview()` and exposes routing surface via `__PRISM_EDITOR_PREVIEW_APP_NAV__`.
- Compiled view fields at [compiled-view.ts:302-323](src/lib/prism-graph/compiled-view.ts) — `CompiledHubView.nodes[]` includes anchor + visible flag per node.
- `PrismHost` consumes the compile at [PrismHost.tsx:215-301](src/components/prism-player/PrismHost.tsx) for `deriveCompiledCameraRail()` and `setBackgroundLayers()` — **but no parallel node-layout effect exists.**
- Mount path at [mount-graph.ts:63-90,451](src/lib/prism/runtime/mount-graph.ts) reads `node.scenePosition` only. `MountGraphOpts` has no field for compiled anchors. `liveResult.updateNodeTransform(nodeId, position)` exists and works — just isn't being driven from the compile output.

### Verdict — preview-app gap

The data is right. The plumbing is right at both ends (`CompiledHubView.nodes[]` on the input side, `updateNodeTransform()` on the output side). The connector is missing: a single PrismHost effect that walks compiled nodes, converts each anchor to a 3D position, and calls `updateNodeTransform`. Plus an anchor-to-3D resolver utility (currently no such function exists).

Background sizing is secondary; if there's still a sizing issue once nodes are visible, it's likely an aspect/FOV mismatch in [mount-graph.ts:214-239](src/lib/prism/runtime/mount-graph.ts) `setBackgroundLayers()`. Phase B-04's snapshot will surface it if so.

## 4. Findings — canvas-mode transform editing gap

Four gaps. **All implementation gaps; the schema and store actions are correct.**

| Gap | File:line | Symptom | Fix surface |
|---|---|---|---|
| **A. Read path** | [GraphScene.tsx:1660-1695](src/components/editor/graph/GraphScene.tsx) `AssembledSceneNode` | Renders `<ArtifactNode>` + selection ring using `node.scenePosition` only. `canvasTransform` never applied to the rendered group. | Compose `scenePosition + canvasTransform` into the artifact wrapper group's transform. |
| **B. Gizmo anchor** | [GraphScene.tsx:1628](src/components/editor/graph/GraphScene.tsx) `CanvasTransformGizmo` | Outer `<group>` positions at `scenePosition` even when `canvasTransform` is non-identity. Gizmo and node visually diverge once any canvas-mode edit lands. | Anchor at `scenePosition + canvasTransform`. |
| **C. No Edit toggle** | [Inspector.tsx](src/components/editor/panels/Inspector.tsx) (zero matches for `editMode\|isEditing\|onEdit`) | Gizmo renders on selection alone. UX is one-step (select = edit), not two-step (select → click Edit). | Add `editorMode: 'idle' \| 'edit'` to `useGraphEditorStore`; add Inspector button; gate gizmo mount. |
| **D. Loose camera bounds** | [GraphScene.tsx:1272-1285](src/components/editor/graph/GraphScene.tsx) `SceneControlsBridge` (canvas branch) | Only `minDistance=3`, `maxDistance=80`. No polar/azimuth/pan limits. Camera can rotate below ground plane and pan arbitrarily. | Compute heavy guardrails from the active hub's content envelope + viewport-frame; apply `min/maxPolarAngle`, `min/maxAzimuthAngle`, pan-target limits. |

### Bonus discovery (already wired)

[canvas-transform-gizmo.ts:18](src/lib/editor/canvas-transform-gizmo.ts) — `ALLOWED_MODES = ['translate', 'rotate', 'scale']`. Drei's `TransformControls` handles all three; keyboard `g/r/s` switches modes; scale-mode drags **write to `canvasTransform.scaleX/Y/Z`** correctly. So **resize is already implemented at the store layer** — it's just invisible due to Gap A. Closing Gap A also closes the resize feature.

## 5. Findings — Inspector / Save / Clone / Tether gap

### A. Inspector real-time-preview vs Save / Save-and-Rebuild — NOT IMPLEMENTED

- [useGraphSourceStore.ts:66-103,258-305](src/stores/useGraphSourceStore.ts) — 1s debounced autosave persists every `updateNode` immediately. No preview/committed separation.
- [Inspector.tsx](src/components/editor/panels/Inspector.tsx) — VisualTab uses ephemeral `useAnimationEditsStore` for color sliders but still triggers autosave. AnimationTab has a "Save & Verify" UI button (no server sync).
- **No "Save" button** that's user-facing-explicit. **No "Save and Rebuild" path** anywhere in the runtime.
- **Fix surface:** Create `usePreviewStateStore` (new file). Route Inspector tab writes through it. Renderer reads layered state (source + preview overlay). Save button: copy preview → source via existing `updateNode` (debounced autosave then flushes normally). Save-and-Rebuild button: Save + locate mounted `THREE.Object3D` → `userData.cleanup()` → re-invoke `createNode(config, ctx)` → re-mount at same `scenePosition`.

### B. Clone + auto-snap-to-nearest-hub — NOT IMPLEMENTED

- Zero occurrences of `clone | duplicate | onClone | cloneNode` in Inspector / stores / lib.
- No nearest-hub helper. [galaxy-tethers.ts](src/lib/galaxy-tethers.ts) `computeGalaxyHubTethers()` renders edges between known hub pairs but doesn't answer "which hub is closest to this point".
- Galaxy mode is view-only — zero drag listeners that write node positions.
- **Fix surface:** Add `cloneNode(sourceId)` action to source store. Add Clone button to Inspector. New `useGraphEditorStore` slot `{ draggingNodeId, dragWorldPos }`. New `kid-kode-landing/src/lib/prism-graph/hub-geometry.ts` with `getHubWorldPositions(hubs)` + `findNearestHub(point, hubs)`. Galaxy-mode `onPointerMove` listener updates `dragWorldPos`, computes nearest, renders transient tether line. `onPointerUp` commits.

### C. Nearest-hub geometry — PARTIAL (tethers render; no distance query)

Helper file doesn't exist. Math is straightforward — orbital positions are computed in [useForceGraph.ts](src/components/editor/graph/useForceGraph.ts) (Phase 3 work, EB-03-01). Hub-geometry will re-derive from the same orbit fn.

## 6. View mode reduction (5 → 3)

| Old mode | Maps to (Round 2) | Notes |
|---|---|---|
| `galaxy` | `galaxy` | Unchanged. No guardrails, full nav. |
| `hub-world` | `canvas` | The intra-hub camera framing folds into canvas. Codex's `editorRenderMode: 'scene' \| 'topology'` sub-toggle (EB-01-04) becomes a canvas sub-toggle. |
| `canvas` | `canvas` | Unchanged conceptually; gains heavy guardrails (Phase D), Edit mode (Phase C), real transform read path (Phase C). |
| `preview-hub` | `preview-app` | Single-hub preview is just preview-app focused on the active hub. The cinematic camera rail + viewport-fixed background work from Round 1 carries forward. |
| `preview-app` | `preview-app` | Becomes default on boot. Gains node assembly (Phase B). |

`previousAuthoringMode` field on `useGraphEditorStore` (used by the Round-1 preview-hub back button) is **deleted** in Phase A-02. Round-2's preview-app stays in preview-app on back-navigation (browser history works; mode toggle works). No back-affordance needed because preview-app IS the default.

## 7. Spec amendment scope (PRISM-EDITOR-BUILD-SPEC.md v1.0 → v1.1)

In-place edits only (additive). Round-1 SCs 001–063 + INVs 01–23 + FPs 01–13 + RAs 01–15 stay; any superseded item is marked `[SUPERSEDED by …]` in place, never deleted.

New numbering:
- SC-064..SC-078 (15 new criteria)
- INV-24, INV-25, INV-26
- FP-14, FP-15 + updated FP-12
- RA-06b, RA-16, RA-17, RA-18

Sections needing in-place text changes: §1 (status), §3 (core model — 3-mode set + default), §5 (camera modes per mode), §6 (new SCs), §7 (new INVs), §8 (FP-12 update + new FPs), §9 (new RAs), §10 (phase map for Round 2 task groups A-G), §11 (verification protocol gains the KripVerify Vercel-preview step), §12 (out of scope unchanged).

## 8. Drift-prevention scope

### Hook changes (both `.claude/hooks/anti-drift-check.sh` and `kid-kode-landing/.claude/hooks/anti-drift-check.sh`)

- **FP-12 update:** the legacy-viewMode regex grows to also reject `'preview-hub'|'hub-world'`. After Round 2, the only legal viewMode strings are the 3 canonical (`galaxy|canvas|preview-app`).
- **FP-14 (new):** `\b(?:'|")(?:hub-world|preview-hub)(?:'|")` under `kid-kode-landing/src/**` — Round-2 enforced.
- **FP-15 (new):** `useGraphSourceStore\.getState\(\)\.updateNode\b` in `**/Inspector*.tsx` or `**/panels/*Tab.tsx` — Inspector tabs must route through `usePreviewStateStore`.

### Rule file

`.claude/rules/prism-editor-build.md` gets a Round-2 section pointing at spec v1.1 + the new RAs + a brief restatement of the Save / Save-and-Rebuild / Clone / 3-mode constraints.

### Marker

`.prism-editor-build-active` stays in place (unchanged from Round 1). Round-2 hooks ride the same activation.

## 9. Verification scope

Local Playwright `verify-editor-runtimes.mjs` continues unchanged — every task still emits `outer.png` + `inner.png` + `state.json` to `kid-kode-landing/notes/ralph-snapshots/<task-id>/`.

**New:** every task ALSO runs the Vercel-preview KripVerify pass:
- After push (Step 13 of `/ralph-step-editor`), worker calls `kid-kode-landing/scripts/wait-for-vercel-preview.mjs --commit=<sha>` and parses the preview URL.
- Worker invokes `kv_navigate(url) → kv_wait_for(canvas) → kv_screenshot(full_page=true) → kv_check_console(level='error') → kv_check_network(status_min=400)`.
- Artifacts persist to `kid-kode-landing/notes/ralph-snapshots/<task-id>/vercel-preview.{png,json}`.
- Any console error or 4xx/5xx response = task failure (worker stays `in-progress`, outer loop retries up to `maxAttemptsPerTask`).

## 10. Task-group preview (full list lands in `ralph-state.json` at STEP 4)

| Group | Phase | Tasks | Net effect |
|---|---|---|---|
| A | view-mode reduction + default-mode flip | 3 | App boots into preview-app; only `galaxy\|canvas\|preview-app` legal |
| B | preview-app node assembly | 4 | Clicking preview-app shows the full home-hub assembled, not just the background |
| C | canvas edit mode + transform-read fix | 4 | Select → Edit → drag visibly moves the node |
| D | canvas camera guardrails | 2 | Camera can't drift away from active hub in canvas mode |
| E | Save / Save-and-Rebuild | 4 | Real-time preview + explicit persistence; single-node rebuild path |
| F | Clone + nearest-hub snap | 5 | Inspector Clone → galaxy → drag-snap-tether → drop commits clone |
| G | Vercel-preview KripVerify wiring | 3 | Per-task `kv_*` analysis of the live preview URL; failures block commit |

**Total: ~24 atomic Ralph tasks.** Identical harness as Round 1: same `prism-editor-build` branch, same `ralph.sh`, same `/ralph-step-editor` (with the Step-8 KripVerify sub-step added by Phase G), same monitor/kickoff flow.

## 11. Out of scope (carried forward + reaffirmed)

- AI app-builder pipeline, coding-model routing, parallel code generation — still out.
- Self-healing / node-repair — still out.
- Image / 3D asset generation pipelines (FLUX, SAM) — still out.
- Backend template engine — still out.
- Full `.prism` artifact rebuild from inside the app — explicitly NOT what Save-and-Rebuild means (RA-16).

## 12. Drift-prevention proof for Round 2

Synthetic Write payloads fed to `.claude/hooks/anti-drift-check.sh` (root); all three new/updated FPs fire with exit 2. Negative control passes. No scratch files written to disk — the hook runs PreToolUse on the synthesized JSON.

### FP-12 update (v1.1) — 5-mode legacy literal `'hub-world'` in viewMode assignment

Input: `kid-kode-landing/src/stores/__scratch_fp12__.ts` with `viewMode: 'hub-world'`.

```
anti-drift-check BLOCKED write to /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/src/stores/__scratch_fp12__.ts:
  - FP-12: legacy viewMode literal — canonical set (v1.1) is 'galaxy'|'canvas'|'preview-app' (RA-06b). 'preview-hub' and 'hub-world' are superseded.
  - FP-14: 'hub-world'/'preview-hub' literal forbidden (INV-24) — Round-2 reduced view modes to 'galaxy'|'canvas'|'preview-app'.
EXIT=2
```
(Both FP-12 and FP-14 fire — defense in depth.)

### FP-14 (new) — `'preview-hub'` literal anywhere under src/

Input: `kid-kode-landing/src/components/__scratch_fp14__.tsx` with `const mode = 'preview-hub'`.

```
anti-drift-check BLOCKED write to /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/src/components/__scratch_fp14__.tsx:
  - FP-14: 'hub-world'/'preview-hub' literal forbidden (INV-24) — Round-2 reduced view modes to 'galaxy'|'canvas'|'preview-app'.
EXIT=2
```

### FP-15 (new) — Inspector calling `useGraphSourceStore.getState().updateNode`

Input: `kid-kode-landing/src/components/editor/panels/Inspector.tsx` with the forbidden call.

```
anti-drift-check BLOCKED write to /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/src/components/editor/panels/Inspector.tsx:
  - FP-15: Inspector tabs must route writes through usePreviewStateStore, not useGraphSourceStore.getState().updateNode directly (Phase R2-E, SC-072).
EXIT=2
```

### Negative control — canonical `'preview-app'` viewMode

Input: `kid-kode-landing/src/stores/__scratch_clean__.ts` with `viewMode: 'preview-app'`. EXIT=0 ✓ (no block, passes through).

All Round-2 hooks armed and proven. Mirror hook in `kid-kode-landing/.claude/hooks/anti-drift-check.sh` carries identical regexes.
