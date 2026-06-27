# PRISM EDITOR INTEGRATION — PHASE I-1: the editor SHELL — /editor on the live app graph, docked layout, camera, galaxy/canvas/preview tri-state. IN-ENGINE. ZERO DOM/CSS. ADDITIVE. Verified HEADLESS, matching the approved glass look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions, founder NOT watching. Commit+push every wave.

## NOTIFY OFTEN — the founder's ONLY window is notifications
`osascript -e 'display notification "<msg>" with title "Prism · EDIT-I1" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-EDITOR-INTEGRATION-SPEC.md §3 (I-1) + §1
- A NEW `/editor` route that renders the LIVE APP GRAPH in one canvas (load the existing live-graph — public/prism-mock/home/live-graph.json or the runtime graph; this is the user's app, NOT a demo). Realize its nodes via the existing node-realization path.
- Editor LAYOUT in-engine: a 3D viewport with DOCKED PANEL ZONES (toolbar dock, library dock, inspector dock, keyframe dock) — glass frames matching the approved look, ready to receive the real panels in I-2/I-3. Zones are placeholders this phase (labeled glass docks).
- CAMERA: orbit / pan / zoom.
- GALAXY <-> CANVAS <-> PREVIEW tri-state: a switch that moves between the unbuilt-graph (galaxy/dormant spheres) view, the 3D editing canvas (realized nodes), and a preview placeholder. Switchable in-engine.
- ADDITIVE: do NOT modify/break the lab routes; COMPOSE existing components. Reuse the glass Pane primitive for docks.

## AESTHETIC GROUND TRUTH
The approved `/toolbar-chassis` + `/keyframe-editor` glass look is the bar — real transmission glass, worn metal, engraved labels, studio IBL + AgX. The editor shell + docks must MATCH. NO DOM, NO flat.

## STACK — WebGL ONLY. LAW.
R3F/Three (+ drei). NO DOM/CSS/Tailwind/`<Html>`. no-dom-ui-gate PASS, node-authorship-gate PASS (the app graph nodes are real nodes).

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN.
NEVER a headed browser. HEADLESS Playwright (`chromium.launch({headless:true})`). Behavioral (interact -> screenshot -> console -> vision-judge): load `/editor` -> the app graph renders in the canvas; the docked panel zones are present as glass; camera orbit/pan/zoom works; switch GALAXY/CANVAS/PREVIEW -> the view changes correctly. STYLE: matches approved glass. FRESH-CONTEXT ADVOCATE (task: "open the editor, look around the canvas, switch between galaxy/canvas/preview; report whether it reads as a premium editor matching the approved glass look"). FAIL BLOCKS. Frames -> notes/verification/edit-i1/. Resize before reading.

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents (reuse kid-kode-landing/notes/catalog-finish-workflow.mjs `parallel()`). Read first: PRISM-EDITOR-INTEGRATION-SPEC.md, VERIFICATION-STANDARD.md, PRISM-CANVAS-EDITOR-SPEC.md, PRISM-RUNTIME-SPEC.md, the live-graph + node-realization, the committed toolbar/library/primitive components.

## WAVES (commit+push+NOTIFY each)
1. w-canvas: `/editor` route renders the live app graph in one canvas + camera. `AUTO-CKPT: EDIT-I1 w-canvas`.
2. w-layout: docked panel zones (glass docks) around the viewport. `AUTO-CKPT: EDIT-I1 w-layout`.
3. w-tristate: galaxy/canvas/preview switch. `AUTO-CKPT: EDIT-I1 w-tristate`.
4. w-verify: HEADLESS behavioral verification + advocate + aesthetic match + frames + report. `AUTO-CKPT: EDIT-I1 w-verify`.

## ANTI-STUCK
NEVER DOM/flat. NEVER break the labs. If blocked after real effort, land what works, note it, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: `/editor` renders the live app graph with docked glass zones + working camera + galaxy/canvas/preview switch, matching the approved look, labs intact, HEADLESS verification + advocate clean, gates PASS, tsc 0-new, 0 console errors, frames captured. Write notes/EDIT-I1-REPORT.md. Print LAST:
PRISM-EDIT-I1: RUN COMPLETE
If blocked:
PRISM-EDIT-I1: BLOCKED-NEEDS-FOUNDER
