# PRISM EDITOR INTEGRATION — I-4 REPORT: PERSIST + PREVIEW + HEADER/FOOTER + END-TO-END

**Status:** RUN COMPLETE · **Branch:** `prism-editor-build` · **Route:** `/editor`
**Spec:** `docs/prism/PRISM-EDITOR-INTEGRATION-SPEC.md` §3 (I-4) + §1 + §0
**Verification standard:** `docs/prism/VERIFICATION-STANDARD.md` (HEADLESS, behavioral, 3 fresh-context judges)
**Date:** 2026-06-27 · Built additively on committed I-1 + I-2 + I-3. **This phase completes the editor.**

---

## What shipped

The `/editor` now **persists** the live app graph (save / autosave / reload restores
the exact editor state), **previews** the running app (the graph AS the running
application, with header/footer global slots), all in-engine (zero DOM) on the LIVE
graph, matching the approved `/toolbar-chassis` + `/keyframe-editor` glass by
construction. The lab routes are untouched. **The entire §1 completeness checklist is
now satisfied.**

### w-persist — visible SAVE control + verified round-trip
- The graph already self-persists (`useGraphSourceStore.saveToServer` → `/api/prism/regen`
  → `public/prism-mock/home/live-graph.json` + debounced autosave + eager boot reload).
  I-4 surfaces it as a real affordance: `EditorSaveControl.tsx` — a worn-alloy **SAVE**
  button (founder chassis vocabulary) + a **status pip** that reads the live dirty/saved
  state (amber `UNSAVED` → green `SAVED`). Clicking flushes immediately.
- **Root-cause fix (persistence was silently failing every save):** two legitimate
  `codeRef`-backed mesh nodes (`orr-atelier-watch`, `orr-celestia-orrery`) tripped the
  `MESH_REQUIRES_MESH_URL` verifier rule because `validatePlanRendererFields` did not
  recognize a `codeRef` as a mesh source. A non-empty `codeRef` builds the node's
  `THREE.Object3D` via the codeRef factory — a first-class mesh artifact like `meshUrl` /
  `meshPrimitive` — so it is now exempted (`plan-output-hook.ts`). This unblocks **every**
  persist. Existing tests are unaffected (their mesh test-nodes carry no `codeRef`).

### w-preview — the running app + header/footer global slots
- `PreviewComposition.tsx`: the PREVIEW tri-state renders the BUILT app — the graph AS
  the running application. It reuses the EXACT canvas realization (`ArtifactNode` →
  codeRef/default factory, **content-hash cached**), so canvas ⇄ preview is a cache
  **hit**, not a rebuild and not a second renderer (RT INV-R4 / FP-R4/R5: preview-app is
  the same built scene in place). Only the LAYOUT changes: an in-engine glass **app frame**
  (smoke screen + worn-metal **header/footer rails** + engraved `PREVIEW · RUNNING APP`)
  with **HEADER** global-slot nodes pinned to the top band, **FOOTER** nodes to the bottom
  band (global → on every page), and the active hub's remaining nodes composed as page
  **CONTENT** (MeasureFit auto-fit) between them. Interactive: hovering a node lifts it; a
  click routes to the node's own runtime handler when present.
- **HEADER / FOOTER global slots:** additive schema field `PrismNode.globalSlot?:
  'header' | 'footer'` (INV-18). The Inspector gains a **SLOT** selector (HEADER / FOOTER /
  CONTENT chips) writing it via `updateNode`; it round-trips through save/reload and is
  realized in PREVIEW. Each realized preview node is tagged `prismEditorNode` + registered,
  so Law 0 holds in preview too.

---

## Evidence — HEADLESS behavioral (offscreen Playwright; WebGL2 fallback — real app is WebGPU)

| Wave | Script | Result |
|---|---|---|
| w-persist | `scripts/verify-edit-i4-persist.mjs` | **5/5 PASS** — add+move+restyle a node → SAVE flushes dirty→saved (save.ok, savedAt set) → **reload restores the EXACT graph** (count 328→328, the added node present + byte-identical line, every node line + edges identical across the round-trip); 0 console errors. |
| w-preview | `scripts/verify-edit-i4-preview.mjs` | **8/8 PASS** — assign header+footer → switch to preview → running app composes (header=1 footer=1 content=36) → **header band ABOVE footer** (Y 3.25 > −2.85) → content centroid between bands + inFrame → **interactive hover lifts** a node (z 0→0.14) → click routing exists → preview authorship 0-orphans/38 → 0 console errors. |
| **e2e** | `scripts/verify-edit-i4-e2e.mjs` | **12/12 PASS** — ONE session: BUILD A SMALL APP (toolbar add 327→328 → **library drag** +1 → inspector edit width 0.60→4.00 live → **stack** B.parent=true + **connect** connectors 1→2 → **keyframe** kfs=2 groupYΔ=2.20) → assign **header+footer** → **PREVIEW runs the app** (header=1 footer=1 content=38, headerY 3.25 > footerY −2.85) → **SAVE → reload → persists EXACTLY** (save.ok, nodes+edges identical, all 4 built nodes present) → **slots survive reload** → preview after reload (orphans 0) → authorship canvas 0/40 + galaxy 0/331 → 0 console errors. Metrics: `notes/verification/edit-i4/behavioral-metrics-i4.json`. |

**Frames:** `notes/verification/edit-i4/{e2e-01..09, preview-01..02, persist-01..03}.png`.

### Hard gates
| Gate | Result |
|---|---|
| `no-dom-ui-gate.mjs` (editor-shell + app/editor) | ✅ PASS (35 files; pure in-engine) |
| `node-authorship-gate.mjs --editor` | ✅ **7/7, 0 hard-fail** (canvas 0-orphans/36 realized; galaxy 327 seeded; preview 0-orphans) |
| `tsc --noEmit` | ✅ **0 new** (9 total = baseline) |
| console / page errors | ✅ **0 / 0** across every run |

---

## Three fresh-context judges (VERIFICATION-STANDARD §4)

_(Workflow `edit-i4-judges` — advocate / aesthetic / spec-conformance, in parallel over the captured evidence — **ALL PASS, 0 MUST-FIX**.)_

| Judge | Verdict | Gate | Summary |
|---|---|---|---|
| **Advocate** (`user-advocate`) | **PLEASED** | ✅ PASS | "Every step of the build-a-tiny-app journey visibly worked with a frame to back it: add via toolbar + drag from library populate the docks, customizing stretches the cube (width 0.60→4.00) with the full Inspector schema, stack+connect composes the two (connectors 1→2), keyframing shows playhead + diamond markers (kfs=2). PREVIEW renders a genuine running app — pinned header nav at top, footer band at bottom, watch hero + user content between (headerY 3.25 > footerY −2.85, centroid in-band, orphans 0). Save→reload is a true round-trip (added node byte-identical, nodes+edges equal) and the post-reload preview re-bands correctly. Premium and on the approved worn-metal + transmission-glass + engraved-MSDF look; 0 console errors; 12/12 + 8/8 + 5/5 green. Non-blocking only: faint WebGL2 connector tube, raw cube has no runtime handler, evidence under WebGL2 fallback." |
| **Aesthetic** | **CONFORMS** | ✅ PASS | "The EDIT-I4 chrome fully matches the founder-approved /toolbar-chassis + /keyframe-editor aesthetic. The SAVE control is a genuine worn-metal cube (beveled highlight, brushed-bronze shading, engraved 'SAVE') with a luminous green status pip + engraved 'SAVED' beside the tri-state switch. The PREVIEW running-app frame is a glass screen in a worn-metal frame with a milled-cutout header rail and crisp engraved 'PREVIEW · RUNNING APP'. The Inspector SLOT chips (HEADER/FOOTER/CONTENT) are worn-metal cubes with engraved labels + cyan/bronze active accent, coherent across galaxy/canvas/preview and the save→reload round-trip. Empty-state glass reads as real refractive transmission — never flat/plastic/DOM (F-4 absent). The flatter realized app content is the expected headless WebGL2 fallback, excluded per the brief. No chrome style regression — 0 MUST-FIX." |
| **Spec-conformance** (`prism-criteria-reviewer`) | **CONFORMS** | ✅ PASS | "EDIT-I4 conforms to §3 (I-4) and completes the §1 checklist. PERSIST is real (SAVE chip + dirty/saved pip; 5/5 proves edit→save→reload restores the exact graph). PREVIEW renders the running app via the SAME ArtifactNode realization keyed by the identical contentSig content-hash — no second renderer, no rebuild-on-toggle, no copied/stand-in artifact, so FP-R3/R4/R5 hold (8/8, header-above-footer, 0 orphans). HEADER/FOOTER are the new additive `globalSlot` field (purely additive — no removed lines) + an Inspector SLOT row, round-tripping through save/reload. §0 invariants hold: ADDITIVE (diff touches only editor-shell/* + one additive field + a relax-only validator exemption that still fires MESH_REQUIRES_MESH_URL otherwise; no lab routes touched), NODE LAW (authorship 7/7, 0 orphans across canvas/galaxy/preview), STACK LAW (no-dom-ui PASS; `document.body.style.cursor` is the established gate-allowed cursor idiom), AESTHETIC. Non-blocking: preview click-routing returns hadHandler=false on raw cubes — the mechanism is wired but unexercised by a live handler here, which the spec permits ('interactive where applicable')." |

---

## §1 COMPLETENESS CHECKLIST — now COMPLETE (the editor is fully functional)
- [x] ONE canvas rendering the live APP GRAPH (editable). _(I-1)_
- [x] Editor LAYOUT: viewport + docked toolbar + library + inspector + keyframe, all in-engine glass. _(I-1..I-3)_
- [x] GALAXY ↔ CANVAS ↔ PREVIEW tri-state. _(I-1; PREVIEW wired this phase)_
- [x] TOOLBAR wired: functions OPERATE on the graph. _(I-2)_
- [x] LIBRARY docked: browse/search + DRAG-to-instantiate into the app graph. _(I-2)_
- [x] INSPECTOR: select → edit FULL schema per node type. _(I-3; + SLOT selector this phase)_
- [x] MANIPULATION: gizmos (move/rotate/scale), stack, connect, snap/align, group, save-as-template. _(I-3)_
- [x] KEYFRAME panel: animate the selected node. _(I-3)_
- [x] CAMERA: orbit / pan / zoom. _(I-1)_
- [x] **PERSIST: save / load the app graph.** _(I-4 — verified round-trip 5/5 + e2e)_
- [x] **PREVIEW: render the built/realized app (the graph as the running app).** _(I-4 — 8/8 + e2e)_
- [x] **HEADER / FOOTER global node slots.** _(I-4 — additive globalSlot, realized in preview, round-trips)_
- [x] In-engine (no DOM), matching the approved glass aesthetic, handles 100s of nodes. _(no-dom-ui PASS; 331 nodes)_

## Schema (additive — INV-18)
One new optional field: `PrismNode.globalSlot?: 'header' | 'footer'` (the global app slot;
realized in PREVIEW). No existing field deleted or renamed. Plus a permissive validator
fix (`validatePlanRendererFields` recognizes `codeRef` as a mesh source) — no schema change,
unblocks persistence.

## Notes / non-blocking
- **WebGL2-fallback opaque realized nodes.** In the offscreen frames, REALIZED app nodes
  read flatter than the real WebGPU `/editor`; the docked CHROME glass still reads luminous.
  Excluded from the chrome-style judgment (the real `/editor` runs WebGPU).
- **Headless rAF throttling.** The preview hover-lift lerp crawls offscreen — the positive
  lift response is proven; full-rate on a real screen.
- The `/api/prism/regen` validator fix is the load-bearing discovery: autosave/save had been
  failing on the live graph since the FIX2/FIX3 codeRef nodes landed; I-4 is the first phase
  to truly exercise the on-disk round-trip and so surfaced + fixed it.

## What this is NOT (next arcs, per spec §4)
The GENERATION ENGINE (prompt→graph), guided intake, deploy/publish, integrations, auth/
backend, and the surrounding shell surfaces are SEPARATE subsequent arcs. **This spec — the
EDITOR — is complete.** The generation engine carries open design decisions; checkpoint with
Logan before building it.

PRISM-EDIT-I4: RUN COMPLETE
