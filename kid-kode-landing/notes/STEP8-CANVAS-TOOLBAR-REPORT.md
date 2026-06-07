# STEP 8 (v2) — Canvas Toolbar — Implementation & Verification Report

**Date:** 2026-06-07 · **Branch:** `prism-editor-build` (HEAD unchanged — NOT committed) · **Model:** claude-opus-4-8
**Mode:** app implementation, evidence-based. Dev server started + shut down. Graph file restored (no mutation left behind).
**Ground truth:** `docs/prism/PRISM-CANVAS-EDITOR-SPEC.md` §5 (toolbar groups), §6 (build lifecycle), §14 (selection/grouping), §8.4 (keyframe editor), §1.3 (boundary); criteria SC-9, SC-22; SPEC-INDEX S6 supersession.

---

## What this is

A premium, on-brand **Canvas Toolbar** — the canvas authoring suite. It renders only in `viewMode === 'canvas'` (hidden in galaxy and preview-app). It is a glassy left **tool rail** of grouped clusters with per-group **flyouts**, a slide-up **keyframe editor** (§8.4), a **marquee-select** overlay, and contextual **"coming with <subsystem>"** states for the groups whose engines are not yet wired.

**Corrected concept honored:** toggling to Canvas shows the app in its *built* state (every node's artifact rendered at its 3D position). The toolbar makes those built elements selectable/editable. When a Transform tool repositions/resizes a built element, the edit writes back into **that node's own schema** — its `scenePosition` (canvas-spec **SC-9** / CORRECTED CONCEPT) — which is the legitimate, user-authored way a node's position/scale is set. (The archived editor-build SC-042 routed transforms to `canvasTransform`; per SPEC-INDEX **S6**, the canonical canvas spec supersedes that — visual editing is canvas-only and mutates `scenePosition`.)

---

## WIRED vs DESIGNED-PLACEHOLDER (the explicit split)

| Group | Status | Powered by / awaits |
|---|---|---|
| **Transform** | **WIRED** | gizmo + toolbar steppers → `setScenePosition` (the node's own schema) |
| **Selection** | **WIRED** | marquee + shift-click + `groupNodes`/`ungroupNodes`/`setNodeLocked` |
| **Build** | **WIRED** | Step-5/6 `rebuildNode` + new `addNodeToSystem` (re-caption + clear dirty) |
| Add (Element/Text/Library/Change Artifact) | DESIGNED-PLACEHOLDER | ← Media & Library pipeline |
| Image tools (crop/opacity/borders/color/blend/filters) | DESIGNED-PLACEHOLDER | ← Media pipeline |
| 3D Object (shape/per-face/material) | DESIGNED-PLACEHOLDER | ← Mesh & Material systems |
| Text tools (font/style/AI texture-fill/presets) | DESIGNED-PLACEHOLDER | ← Text System (MSDF) |
| Animation (Picker, Edit, triggers, From Scratch) | DESIGNED-PLACEHOLDER | ← Primitive Catalog |
| **Keyframe Editor toggle** | **WIRED toggle** (content designed) | slides the §8.4 editor in/out |
| Lighting (lights/type/color/intensity/shadow/IBL/receivesLighting) | DESIGNED-PLACEHOLDER | ← Lighting & Material systems |

Every placeholder tool surfaces a tasteful **"Coming with the <subsystem>"** banner — never a broken no-op, never fabricated output.

---

## Files changed

**New (untracked):**
- `src/components/editor/overlays/CanvasToolbar.tsx` — the toolbar, flyouts, keyframe editor, marquee overlay.
- `src/lib/editor/add-to-system.ts` — Add-to-System self-caption + clear-dirty.
- `scripts/verify-step8-toolbar.mjs` — the verification harness (boots `next dev`, drives real Chromium, restores `live-graph.json`).
- `notes/verification/step8/` — screenshots + `results.json`.

**Edited (tracked, +297/−36):**
- `src/lib/prism-graph/types.ts` — additive `groupId?`, `locked?` on `PrismNode` (INV-8).
- `src/stores/useGraphEditorStore.ts` — additive `canvasGizmoMode` + `setCanvasGizmoMode` + `setMultiSelection`.
- `src/stores/useGraphSourceStore.ts` — additive `groupNodes` / `ungroupNodes` / `setNodeLocked`.
- `src/lib/editor/canvas-transform-gizmo.ts` — new `readSceneTransform` helper.
- `src/components/editor/graph/GraphScene.tsx` — gizmo writes `scenePosition`; wrapper composes scenePosition rotation+scale; lock gate; multi/group selection rings; `MarqueeSelectBridge` hit-test.
- `src/components/editor/icons/Icon.tsx` — premium toolbar glyphs.
- `src/app/page.tsx` — mount `<CanvasToolbar />` in canvas mode.

INV-1 (frozen graph topology) preserved: Group is a shared-`groupId` contains-subtree marker — **no new edge type**, no DAG change. INV-8 (additive schema): every new field is optional; nothing deleted/renamed/repurposed.

---

## Evidence — `node scripts/verify-step8-toolbar.mjs` → **17/17 PASS**

Artifacts: `notes/verification/step8/` (`results.json`, `01`…`07` PNGs). `live-graph.json` backed up + restored.

### Design (screenshots — for Logan to art-direct)
| Criterion | Evidence |
|---|---|
| `screenshot.transform` | `01-toolbar-transform.png` — rail + Transform flyout (Edit Handles, Move/Rotate/Scale, X/Y/Z steppers "writes scenePosition", Scale·Rotate, Align, Snap/Reset). |
| `screenshot.selection` | `02-toolbar-selection.png` — Selected count, Marquee, Group/Ungroup, Lock/Freeze. |
| `screenshot.build` | `03-toolbar-build.png` — "Built · in system" badge, v1, gradient **Save & Rebuild**, **Add to System**, history. |
| `keyframe.slides-out` | `04-keyframe-editor.png` — slide-up editor: scrubber/fader, play/pause/loop, snap grid 1/60·1/100·1/120, multi-track lanes w/ diamond keyframes + playhead. |
| `placeholder.coming-state` | `05-placeholder-coming.png` — Add → "Coming with the Media & Library pipeline" (no fake output). |

### Transform (SC-9) — WIRED
| Criterion | Result |
|---|---|
| `transform.writes-scenePosition.x` | x 0 → **0.18** via toolbar Move stepper. |
| `transform.writes-scenePosition.scale` | scaleX 1 → **1.1664**. |
| `transform.only-target-changed` | only `home-headline` changed; all siblings byte-identical. |
| `transform.persists-reload` | x = **0.18** after full page reload (autosave→`live-graph.json`→reload round-trip). |

### Selection (SC-22) — WIRED
| Criterion | Result |
|---|---|
| `selection.group` | both members share `grp-395e2603-…`. |
| `selection.group-cascade` | nudging the group moved **both** members (B.y 0.2→0.32, C.y −0.5→−0.38). |
| `selection.ungroup-clears` | `groupId` → null after Ungroup. |
| `selection.ungroup-preserves-world` | each member's `scenePosition` unchanged by Ungroup. |

### Build (§6) — WIRED
| Criterion | Result |
|---|---|
| `build.add-to-system.recaption` | caption → "Headline text at [0.18, 1.5, 0.1] scaled …". |
| `build.add-to-system.clears-dirty` | `dirty = false`. |
| `modetoggle.no-rebuild` | builtSnapshot history 6 → 6 across canvas↔preview-app toggle (no rebuild). |

### Health
| Criterion | Result |
|---|---|
| `console.clean` | no new console/page errors. |

### Fresh-context reviewer (`prism-criteria-reviewer`, diff + criteria only)
**VERDICT: PASS — no MUST-FIX.** Confirmed: gizmo+toolbar write `scenePosition` (not canvasTransform) and the wrapper now composes scenePosition rotation+scale; additive schema (INV-8) + no topology change (INV-1); no forbidden drift (no 2nd renderer/PixiJS/TextGeometry/diffusion text, **no global fps** in the keyframe model, canonical-3 viewMode, triggers are animation-driver-only placeholders); placeholders never fake output; §1.3 boundary intact (nothing wires app behavior).
Three NOTES (non-blocking, all intentional for the prototype): self-caption is a deterministic stand-in for the VLM path (§15.2); the Snap toggle is currently cosmetic (not coupled to step granularity); marquee hit-tests by projected node centre (not bbox overlap).

---

## TypeScript

`npx tsc --noEmit`: my files are **type-clean** (CanvasToolbar, add-to-system, the two stores, the gizmo helper, page.tsx). The only errors are **pre-existing** and untouched by this slice (`createUnifiedRenderer` GLProps async-factory typing + several test-fixture `NodeContext.THREE` requirements) — confirmed absent from this diff.

---

## Plain-language summary — design choices to react to

Toggle to **Canvas** and you get a Figma/Blender-grade left **tool rail** floating in Prism's dark cosmic glass, with a chip-marked group for each part of the suite. Click a group and a glass **flyout** slides out beside it. I made three deliberate design calls I'd like your eye on:

1. **Left rail + flyouts (not a bottom bar).** The top-center already holds the Galaxy/Canvas/Preview toggle and the right holds the Inspector, so a vertical left rail keeps the canvas center clear and reads like a pro tool. Each group icon carries a tiny label; deferred groups wear a small violet dot and a "COMING SOON" tag so the wired vs. forthcoming split is honest at a glance.

2. **Transform authors the node itself.** Move/Rotate/Scale (handles *and* steppers) write the element's own `scenePosition` — drag a corner and the value you'd see in the node's schema changes, and it survives a reload. Grouped elements move together; ungrouping leaves everyone exactly where they were. This is the "corrected concept" made real: the toolbar isn't laying things out from outside, it's letting you author each node.

3. **A real, premium keyframe editor that's honestly empty.** The §8.4 editor slides up with a working scrubber, transport, a continuous-seconds timeline (no fps anywhere), a switchable cosmetic snap grid, and multi-track lanes with draggable-looking diamonds — but it's badged "CATALOG FORTHCOMING" because the 300+ primitive catalog isn't wired yet. Same discipline everywhere: Add / Image / 3D / Text / Animation-picker / Lighting all *look* finished, and clicking any tool tells you which subsystem it's waiting on rather than faking a result.

Colour language follows the existing chrome: blue `#5d8bff` for primary/active, violet `#a978ff` for groups + "coming," green `#55e6a5` for confirm/built, amber for lock. Open spots for your direction: rail placement/size, whether the keyframe editor should span full width vs. clear the Inspector (currently clears it), and the icon style for a couple of the deferred tools.

**No commit was made. HEAD remains `prism-editor-build`. The dev server was shut down and `live-graph.json` was restored.**
