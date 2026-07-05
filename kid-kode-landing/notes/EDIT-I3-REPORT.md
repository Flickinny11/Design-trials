# PRISM EDITOR INTEGRATION — I-3 REPORT: INSPECTOR + MANIPULATION + KEYFRAME

**Status:** RUN COMPLETE · **Branch:** `prism-editor-build` · **Route:** `/editor`
**Spec:** `docs/prism/PRISM-EDITOR-INTEGRATION-SPEC.md` §3 (I-3) + §0 + §1
**Verification standard:** `docs/prism/VERIFICATION-STANDARD.md` (HEADLESS, behavioral, 3 fresh-context judges)
**Date:** 2026-06-27 · Built additively on committed I-1 + I-2.

---

## What shipped

The selected node can now be **inspected + edited (full schema, live), manipulated
(transform / stack / connect / snap / group / save-as-template), and animated
(keyframe panel)** — all in-engine, zero DOM, on the LIVE app graph, matching the
approved `/toolbar-chassis` + `/keyframe-editor` glass look by construction. The lab
routes are untouched.

### w-inspector — the docked INSPECTOR (edit full schema, live)
- `editor-inspector.tsx` + `EditorInspectorDock.tsx` dock the real in-canvas Inspector
  into the right zone. Selecting a node populates it with the node's FULL editable
  schema PER TYPE, using the founder vocabulary (worn-cube fader on a milled rail +
  tint swatch row), built in `editor-shell-controls.tsx` (`FaderRow` / `ColorSwatch`):
  - **geometry** faders (width/height/depth/radius/segments per mesh kind, seeded from
    `MESH_PRIMITIVE_DEFAULTS`),
  - **material** faders (roughness/metalness/transmission) + a base-color swatch row,
  - **universal** scale (live via `setScenePosition`) + opacity, plus DELETE/DESELECT.
- Editing writes to `useGraphSourceStore`; the node updates **live**: transform edits
  move/scale the realized wrapper with no rebuild; geometry/material edits `updateNode`
  and `EditorGraphViewport` keys each realized node on a **content signature** so just
  that node reconstructs (save-and-rebuild made automatic).
- Canvas **click-to-select** + a world-space glowing **selection ring** (decoupled from
  the FitGroup scale).

### w-manip — canvas MANIPULATION
- `EditorGizmo.tsx` — a worn-alloy **transform gizmo** that floats on the selection:
  MOVE (drag the center handle in the node X/Y plane, world→scenePosition via the
  FitGroup parent, snaps to a 0.5 grid / neighbour centers with an alignment guide),
  ROTATE (ring → rotationZ), SCALE (corner → uniform scale). A mode selector + a
  STACK/CONNECT/GROUP/SAVE/SNAP action row float above. A **deselect-guard** keeps the
  selection when a drag releases over open canvas.
- `editor-manipulation.ts` — the pure helpers: **STACK** (additive `PrismNode.parentNodeId`,
  the P-5 `effectiveRoot` computed-world-root idiom — child follows parent, never a THREE
  re-parent); **CONNECT** (a real `PrismEdge`); **SAVE-AS-TEMPLATE** (clone + re-id +
  relink stack + re-map edges → `addNodesBatch` a fresh registered subgraph, INV-0.4);
  **SNAP** (grid + alignment, grid-snap emits no guide).
- `EditorConnectors.tsx` — every canvas edge drawn as a premium **glass tube** routed
  between the two nodes' live world positions (re-routing as they move; an edge-render,
  NOT a node).
- Shift-click multi-selects; GROUP stamps a shared `groupId`.

### w-keyframe — the docked KEYFRAME panel (animate the selection)
- `EditorKeyframeDock.tsx` + `use-editor-keyframe-store.ts` dock the keyframe timeline
  into the bottom zone, reusing the committed `/keyframe-editor` **pure engine**
  (`keyframe-engine` `evalAll`/`setKeyframe` + `keyframe-config` TRACKS/mappings). A TIME
  ruler with a worn-cube playhead scrubber + sweeping bar, and one milled track per
  property (RISE/SCALE/SPIN/FADE). Dragging a track knob writes a keyframe at the
  playhead onto `node.keyframes` (NODE LAW); scrubbing interpolates and a **per-frame
  driver** applies the eased value to the selected node's realized group so it **animates
  live**. PLAY/PAUSE (native seconds clock) + CLEAR.

---

## Evidence — HEADLESS behavioral (offscreen Playwright; WebGL2 fallback — real app is WebGPU)

| Wave | Script | Result |
|---|---|---|
| w-inspector | `scripts/verify-edit-i3-inspector.mjs` | **11/11 PASS** — created cube auto-selected + Inspector shows its schema; 8 faders; TRUSTED canvas click selects; TRUSTED fader drags edit width 0.6→4.0 (live rebuild), scale 1→3 (live), roughness 0→1; TRUSTED swatch recolor; 0-orphans/37; deselect clears; 0 console errors. |
| w-manip | `scripts/verify-edit-i3-manip.mjs` | **12/12 PASS** — TRUSTED gizmo move 0.9→3.07 / rotate 0→1.20 / scale 1→2.2; deterministic grid snap (13.37,−11.13)→(13.5,−11); STACK move-together (child Δ=1.44 with parent); CONNECT edge → connector tubes 1→2; GROUP shared groupId; SAVE-AS-TEMPLATE 329→331 (+2 fresh, fresh group); gizmo persists after drag-release; 0-orphans/41; 0 console errors. |
| w-keyframe | `scripts/verify-edit-i3-keyframe.mjs` | **8/8 PASS** — panel binds the selection; TRUSTED RISE-fader drags write keyframe 1 (posY=1.10 @t0) + keyframe 2 (posY=−1.10 @t2.5); scrubbing INTERPOLATES (posY @0=1.10, @1.25=0.00, @2.5=−1.10) and the realized node MOVES (group y @0=0.90, @2.5=−1.30, Δ=2.20); PLAY advances the playhead; 0-orphans/37; 0 console errors. |
| **e2e** | `scripts/verify-edit-i3-e2e.mjs` | **8/8 PASS** — one continuous session: select+inspect+edit-width-live → gizmo move/rotate/scale (Δx=2.17, Δrz=1.10, scale 1→2.12) → stack → connect (tubes 1→2) → group + save-template (+2) → keyframe + scrub (kfs=2, groupY Δ=2.20) → authorship canvas 0-orphans/40 + galaxy 0-orphans/331; 0 console errors. Metrics: `notes/verification/edit-i3/behavioral-metrics-i3.json`. |

**Frames:** `notes/verification/edit-i3/{insp,manip,kf,e2e}-*.png`.

### Hard gates
| Gate | Result |
|---|---|
| `no-dom-ui-gate.mjs` (editor-shell + app/editor) | ✅ PASS (33 files; pure in-engine) |
| `node-authorship-gate.mjs --editor` | ✅ **7/7, 0 hard-fail** (all chrome adds 0 orphans; 331 seeds + canvas-realized all node-backed) |
| `tsc --noEmit` | ✅ **0 new** (9 total = baseline) |
| console / page errors | ✅ **0 / 0** across every run |

---

## Three fresh-context judges (VERIFICATION-STANDARD §4)

_(Workflow `edit-i3-judges` — advocate / aesthetic / spec-conformance, in parallel over the captured evidence — **ALL PASS, 0 MUST-FIX**.)_

| Judge | Verdict | Gate | Summary |
|---|---|---|---|
| **Advocate** (`user-advocate`) | **PLEASED** | ✅ PASS | "All five user-journey steps are proven by cited frames plus 8/8 passing metrics — select (inspector populates), inspector edit (cube visibly widens 0.60→4.00, tints gold), move/rotate/scale + stack + connect (labeled gizmo + glowing connector, dx=2.17/drz=1.10/scale→2.12, stack B.parent=true, template +2), keyframe + scrub (worn-metal timeline, subject displaced, groupY Δ=2.20). The four docked chrome panels read luminous worn-metal + transmission-glass + engraved-MSDF matching the ground truth. 0 console errors, 0 orphans, galaxy intact at 331." Verdict self-validated against the advocate schema. |
| **Aesthetic** | **CONFORMS** | ✅ PASS | "The I-3 docked chrome coheres with the founder-locked /toolbar-chassis + /keyframe-editor aesthetic across all six frames — the INSPECTOR (worn-alloy fader knobs on milled rails + engraved MSDF + tint swatches), the GIZMO (worn handles + cyan selection ring + glass-tube connector + mode/action chips), the KEYFRAMES dock (worn track rails + playhead + transport + amber markers). All panes read edge-lit, luminous, transmissive — nothing flat, plastic, or DOM. The only flat opaque-white element is the realized app node — the documented WebGL2 offscreen fallback, excluded from style judgment. No genuine chrome style regression." |
| **Spec-conformance** (`prism-criteria-reviewer`) | **CONFORMS** | ✅ PASS | "I-3 conforms to §3/§0/§1: (a) Inspector edits FULL schema per type via updateNode/setScenePosition (contentSig live rebuild); (b) gizmo move/rotate/scale + STACK (computed effectiveRoot, no THREE re-parent, cycle-guarded) + CONNECT (real PrismEdge) + SAVE-AS-TEMPLATE (fresh ids via addNodesBatch) + SNAP; connectors are edge-renders not nodes; (c) keyframe panel writes node.keyframes (NODE LAW). Invariants all green: ADDITIVE (no lab/shared files touched), NODE LAW (authorship 7/7, 0 orphans), STACK LAW (no-dom-ui PASS), additive-only schema (+parentNodeId? only), tsc 0-new. No forbidden-pattern drift (no second renderer/pixi/TextGeometry/Troika/html-to-image/split-pane)." |

---

## §1 checklist items satisfied this phase
- [x] INSPECTOR: select a node → edit its FULL schema (geometry / material / transform), per node type.
- [x] MANIPULATION: select, transform gizmos (move/rotate/scale), stack (parent-child), connect (edges + 3D connectors), snap/align, group, save-as-template.
- [x] KEYFRAME panel: animate the SELECTED node's properties.
- [x] In-engine (no DOM), matching the approved glass aesthetic, on the live graph.

## Schema (additive — INV-18)
One new optional field: `PrismNode.parentNodeId?: string` (stack parent; computed-root,
never a THREE re-parent). No existing field deleted or renamed.

## Notes / non-blocking
- **WebGL2-fallback opaque realized nodes.** In the offscreen frames, REALIZED app nodes
  (e.g. dropped cubes) read as flat opaque white — the known headless fallback artifact;
  the docked CHROME glass still reads luminous. The real `/editor` runs WebGPU.
- **Headless rAF throttling.** PLAY advances the playhead slowly offscreen (the clock caps
  dt at 0.05 s/frame and few frames fire) — forward motion is proven; full-rate on a real
  screen.

## Out of scope (next phase)
I-4: PERSIST (save/load the app graph) + the running-app PREVIEW + header/footer global
node slots + the full end-to-end "build a small app + preview + save".

PRISM-EDIT-I3: RUN COMPLETE
