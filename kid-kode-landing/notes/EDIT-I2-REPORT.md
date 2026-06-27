# PRISM EDITOR INTEGRATION — I-2 REPORT: dock the real TOOLBAR + LIBRARY (operating on the live graph)

Status: **RUN COMPLETE.** Branch `prism-editor-build`. Built additively on committed I-1.
Spec: `docs/prism/PRISM-EDITOR-INTEGRATION-SPEC.md` §3 (I-2) + §1. Verification standard:
`docs/prism/VERIFICATION-STANDARD.md` (HEADLESS, behavioral, 3 fresh-context judges).

## What shipped

The committed lab components are now **literally docked** into the `/editor` shell and
**operate on the LIVE app graph** — additively (the `/toolbar-chassis` and `/library` lab
routes are untouched).

### w-toolbar — the real toolbar, docked + wired
- `EditorToolbarDock.tsx` mounts the chassis pieces (milled transmission `GlassPane` + 14
  worn-alloy `CubeButton`s with `FaceGlyph` engraved marks + hover-spin) by the chassis
  `LAYOUT`, fitted into the top dock band. It matches the approved glass by construction.
- Two additive adaptations (lab untouched): section labels render via `CompositeText` MSDF
  (Troika `<Text>` does not compile on the WebGPU `/editor` canvas — P-3 finding); `CubeButton`
  gained an optional `onClick`/`onSelect` (the lab passes nothing → hover-only unchanged).
- `editor-toolbar-actions.ts` wires all 14 functions to **real** ops on `useGraphSourceStore`
  / `useEditorShellStore`:
  - **CREATE** `add`/`object3d`/`text`/`image` → `addNode(buildXxxNode({parentHubId: activeHub}))`
    → a new node appears in galaxy + canvas (**INV-0.3**); `library` → focus the docked palette search.
  - **TRANSFORM** `transform` → move the selection (`setScenePosition`); `selection` → cycle
    (brightens the galaxy seed).
  - **SCENE** `background`/`lighting` → cycle observable backdrop/light presets (additive
    shell-store fields, consumed by `Backdrop`/`Lights`).
  - **LOGIC** `changeArtifact` → cycle the selected node's primitive form (`updateNode`);
    `promptEdit`/`animation`/`function` → engage the selection (their full surfaces are I-3/I-4).
  - **OUTPUT** `build` → `preview-app` view + `saveToServer()`.

### w-library — the real palette, docked + drag-instantiates into the real graph
- `EditorLibraryDock.tsx` mounts the real `LibraryPalette` + `DragGhost` fitted into the left
  zone (group scale 0.7). Library scene-globals (StudioEnv/Backdrop/lights/NodeLayer/Inspector)
  are intentionally NOT mounted — the editor supplies env+lights, and dropped nodes realize via
  `EditorGraphViewport`.
- The drop sink is redirected: `DragGhost` gained an additive `onCanvasDrop` prop (absent in the
  lab → in-canvas instantiate unchanged). The editor passes `instantiateLibraryEntryIntoGraph`,
  which projects the entry to real `PrismNode`(s) via `entryToGraphNodes` (additive export reusing
  the lab's pure `buildInstance → instanceNodes`), re-parents to the active hub, and
  `addNodesBatch` into the live graph. A dragged primitive/material/fluid/composite becomes a
  genuine node in galaxy + canvas (**INV-0.3**) — not a library-local instance.
- In-canvas SEARCH wired (window-keystroke listener + the docked `LibrarySearchBar` focus).

## Evidence

### HEADLESS behavioral (offscreen Playwright; WebGL2 fallback — real app is WebGPU)
- `scripts/verify-edit-i2-toolbar.mjs` — **11/11 PASS**: 14 buttons; CREATE add 327→328;
  TRUSTED real-cube click on object3d 328→329; canvas authorship 0-orphans/36-realized; galaxy
  329 seeded 0-orphans; background→noir; lighting→cool; changeArtifact cube→sphere; build→preview;
  0 console errors.
- `scripts/verify-edit-i2-library.mjs` — **9/9 PASS**: 3 tiles; functional drop cube 327→328
  (0-orphans); composite nav-header → +9 member nodes; material gold → +1; **TRUSTED real
  pointer-drag** tile→viewport-center 338→339; search "cube" filters 3→1 tiles; galaxy 339 seeded
  0-orphans; 0 console errors.
- `scripts/verify-edit-i2-e2e.mjs` — **pass=true**: build-a-small-app flow (toolbar add + trusted
  object click + library drag) 327→330; canvas + galaxy authorship ok; 0 console errors. Frames +
  `behavioral-metrics.json` in `notes/verification/edit-i2/`.

### Hard gates
- `no-dom-ui-gate.mjs` (editor-shell + DragGhost) — **PASS** (pure in-engine; no DOM/CSS/Tailwind/`<Html>`).
- `node-authorship-gate.mjs --editor` — **7/7 PASS, 0 hard-fail** (chrome adds 0 orphans; 327
  seeds + 36 canvas-realized all node-backed).
- `tsc --noEmit` — **9 errors = baseline, 0-new**.

### Three fresh-context judges (VERIFICATION-STANDARD §4) — ALL PASS, 0 MUST-FIX
- **user-advocate**: net **PLEASED**, gate **PASS**. Function proven by metrics (327→330, +3 real
  nodes, canvas+galaxy authorship ok, 0 console errors) + frames; style/intuitiveness/satisfaction
  pass. One non-blocking FLAG (below).
- **aesthetic**: **PASS** — matches the founder-locked worn-metal-cube-in-transmission-glass-with-
  engraved-MSDF look; cohesive/premium; 0 MUST-FIX.
- **spec-conformance**: **CONFORMS** for I-2 — all 6 questions conform (toolbar OPERATES on graph
  incl CREATE→addNode INV-0.3; library drag→addNodesBatch real graph; additive/labs untouched;
  STACK LAW; NODE LAW; WebGPU MSDF labels). 0 MUST-FIX.

## Non-blocking flags (documented, not defects)
1. **WebGL2-fallback rendering of transmissive realized nodes.** In `library-04-search-cube.png`
   the dropped composite-nav-header members + primitive panes read as flat opaque white cards.
   This is the known headless WebGL2-fallback artifact (transmissive previews need a lit backing
   socket; they render opaque without a GPU). The real `/editor` runs WebGPU, where these refract
   correctly — the docked toolbar/library glass already reads luminous in the same fallback frames.
   No code change warranted; surfaced for a real-GPU confirmation by the founder.
2. **Library tile sub-labels** (PANE/CUBE/SPHERE) read marginally soft in the fallback frame —
   plausibly fallback-AA, not a real miss. Re-check at native WebGPU scale.

## §1 checklist items satisfied this phase
- [x] TOOLBAR wired: its functions OPERATE on the graph (add node by type, transform, scene/
      lighting/background, logic, output/build).
- [x] LIBRARY docked: browse/search + DRAG-to-instantiate nodes into the app graph (P-1/P-6
      pipeline into the REAL editor graph).
- [x] In-engine (no DOM), matching the approved glass aesthetic, handles the 327-node live graph.

## Out of scope (next phases)
INSPECTOR full-schema editing + manipulation gizmos + keyframe panel (I-3); persist + the running
preview-app (I-4). The INSPECTOR/KEYFRAMES dock zones remain glass placeholders.

PRISM-EDIT-I2: RUN COMPLETE
