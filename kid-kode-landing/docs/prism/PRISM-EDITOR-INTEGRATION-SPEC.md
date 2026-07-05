# PRISM — EDITOR INTEGRATION — CANONICAL SPEC (v1)
Status: ACTIVE. Owner: Logan. Drives the editor-integration ultracode chain (I-1..I-4).
One line: **Compose the proven lab pieces (toolbar, library, inspector, keyframe, primitives, P-5 composition) into ONE premium 3D canvas editor that edits the LIVE APP GRAPH — additively (do NOT regress the labs).** The complete builder surface a person uses to assemble, customize, wire, animate, persist, and preview an app.

## 0. INVARIANTS
- ADDITIVE: build a NEW `/editor` route that COMPOSES existing components; do NOT modify/break the lab routes (`/toolbar-chassis`, `/library`, `/primitive-lab`, `/material-lab`, `/fluid-lab`, `/composite-lab`, `/keyframe-editor`) — they remain working references. Reuse, don't rewrite.
- NODE LAW (INV-0): everything the editor adds is a NODE in the live app graph; galaxy=unbuilt, canvas=built, preview=running. `scripts/node-authorship-gate.mjs` enforces.
- STACK LAW: WebGL only; NO DOM/CSS/Tailwind/drei `<Html>`; `scripts/no-dom-ui-gate.mjs` enforces.
- AESTHETIC: matches the approved `/toolbar-chassis` + `/keyframe-editor` glass look (the ground truth).

## 1. COMPLETENESS CHECKLIST — nothing missing for a fully-functional premium editor
- [ ] ONE canvas rendering the live APP GRAPH (load the existing live-graph; editable — this is the user's app, not a demo).
- [ ] Editor LAYOUT: a viewport + docked toolbar + library panel + inspector panel + keyframe panel, ALL in-engine glass.
- [ ] GALAXY <-> CANVAS <-> PREVIEW tri-state (unbuilt-graph view / 3D edit / running-app preview), switchable.
- [ ] TOOLBAR wired: its functions OPERATE on the graph (add node by type, transform, scene/lighting/background, logic, output/build).
- [ ] LIBRARY docked: browse/search + DRAG-to-instantiate nodes into the app graph (P-1/P-6 pipeline into the REAL editor graph).
- [ ] INSPECTOR: select a node -> edit its FULL schema (geometry / material / fluid / composite params), per node type.
- [ ] MANIPULATION: select, transform gizmos (move/rotate/scale), stack (parent-child), connect (edges), snap/align, group, save-as-template (P-5).
- [ ] KEYFRAME panel: animate the SELECTED node's properties.
- [ ] CAMERA: orbit / pan / zoom.
- [ ] PERSIST: save / load the app graph.
- [ ] PREVIEW: render the built/realized app (the graph as the running app).
- [ ] HEADER / FOOTER global node slots.
- [ ] In-engine (no DOM), matching the approved glass aesthetic, handles 100s of nodes.

## 2. VERIFICATION — apply docs/prism/VERIFICATION-STANDARD.md (HEADLESS Playwright, behavioral, aesthetic-match)
End-to-end behavioral proof per phase, culminating in: BUILD A SMALL APP in the editor (add nodes via toolbar + drag from library + edit in inspector + stack/connect + keyframe + switch to preview + save), all HEADLESS, matching the approved glass look, + 3 fresh-context judges (advocate / aesthetic / spec-conformance). The aesthetic axis passes iff it matches the approved `/toolbar-chassis` + `/keyframe-editor`.

## 3. PHASING — chain I-1 -> I-4, each reviewable, ADDITIVE
- I-1 SHELL: `/editor` route — the live app graph in the canvas + editor layout (docked panel zones) + camera + galaxy/canvas/preview tri-state. In-engine glass.
- I-2 TOOLBAR+LIBRARY: dock the real toolbar (functions OPERATE on the graph) + the library palette (drag-to-instantiate nodes into the app graph).
- I-3 INSPECTOR+MANIPULATION+KEYFRAME: select -> edit full schema; transform/stack/connect/snap/group/save-as-template; keyframe panel animates the selection.
- I-4 PERSIST+PREVIEW+VERIFY: save/load the app graph; preview the running app; full end-to-end behavioral verification + advocate + aesthetic + gates + header/footer slots.

## 4. WHAT THIS IS NOT (the rest of the product, AFTER integration)
The GENERATION ENGINE (prompt->graph: intent-to-plan -> graph -> node-blast), GUIDED INTAKE, DEPLOY/PUBLISH, INTEGRATIONS (Nango), AUTH/BACKEND (Better Auth, tRPC), and the surrounding SHELL surfaces (dashboard/settings/collaboration/landing) are SEPARATE subsequent arcs. This spec is the EDITOR only. The generation engine is the next major arc and carries open design decisions — checkpoint with Logan before building it.

## 5. DONE = EVIDENCE
Per phase: rendered frames + gate outputs (no-dom-ui PASS, node-authorship PASS, tsc 0-new, 0 console errors) + HEADLESS behavioral proof + 3 fresh-context judges PASS + the §1 checklist items for that phase satisfied. The agent never self-grades aesthetics.
