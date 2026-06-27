# PRISM EDITOR INTEGRATION — PHASE I-2: dock the real TOOLBAR (operating on the graph) + the LIBRARY (drag-to-instantiate nodes). IN-ENGINE. ZERO DOM/CSS. ADDITIVE. Verified HEADLESS, matching the approved glass look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions. Commit+push every wave. BUILD ON committed I-1.

## NOTIFY OFTEN
`osascript -e 'display notification "<msg>" with title "Prism · EDIT-I2" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-EDITOR-INTEGRATION-SPEC.md §3 (I-2) + §1
- Dock the REAL toolbar (the committed `/toolbar-chassis` glass toolbar) into the I-1 toolbar zone. Its functions OPERATE on the app graph: add a node by type (CREATE), transform the selection (TRANSFORM), scene/lighting/background (SCENE), logic (LOGIC), output/build (OUTPUT). A toolbar action MUST produce a real effect on the live graph (e.g. CREATE -> a new node appears in galaxy+canvas, INV-0.3).
- Dock the LIBRARY palette (the committed `/library`) into the I-1 library zone: browse/search + DRAG-to-instantiate -> the dragged primitive/composite/material becomes a NODE in the app graph (the P-1/P-6 instantiation pipeline, now into the REAL editor graph).
- ADDITIVE: reuse the committed components; do NOT break the labs.

## AESTHETIC GROUND TRUTH
Approved `/toolbar-chassis` + `/keyframe-editor` glass look. The docked toolbar + library are LITERALLY those components — they already match; keep them matching in the editor. NO DOM.

## STACK — WebGL ONLY. LAW.
R3F/Three (+ drei). NO DOM/CSS/Tailwind/`<Html>`. no-dom-ui-gate PASS, node-authorship-gate PASS (every added element is a node).

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN.
Behavioral (interact -> screenshot -> console -> vision-judge): CLICK a toolbar CREATE button -> confirm a NODE is added to the live graph (read the graph) AND realizes in canvas; HOVER toolbar cubes -> spin fires; DRAG a primitive from the library onto the canvas -> confirm it instantiates as a NODE in the app graph; SEARCH the library -> filters. STYLE: matches approved glass. FRESH-CONTEXT ADVOCATE (task: "use the toolbar to add an element and drag one in from the library; report whether it works and matches the approved glass look"). FAIL BLOCKS. Frames -> notes/verification/edit-i2/.

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents. Read first: SPEC §3(I-2)+§1, VERIFICATION-STANDARD.md, committed I-1, the toolbar + library + P-1/P-6 instantiation components.

## WAVES (commit+push+NOTIFY each)
1. w-toolbar: dock the real toolbar; wire its functions to operate on the app graph (CREATE/TRANSFORM/SCENE/LOGIC/OUTPUT). `AUTO-CKPT: EDIT-I2 w-toolbar`.
2. w-library: dock the library palette; drag-to-instantiate into the app graph + search. `AUTO-CKPT: EDIT-I2 w-library`.
3. w-verify: HEADLESS behavioral verification (toolbar acts on graph + library drag instantiates) + advocate + aesthetic match + frames + report. `AUTO-CKPT: EDIT-I2 w-verify`.

## ANTI-STUCK
NEVER fake the toolbar wiring; actions MUST change the real graph. NEVER DOM. If blocked, land what works, note it, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: the docked toolbar's functions operate on the app graph, the docked library drag-instantiates nodes, matching the approved look, labs intact, HEADLESS verification + advocate clean, gates PASS, tsc 0-new, 0 console errors, frames captured. Write notes/EDIT-I2-REPORT.md. Print LAST:
PRISM-EDIT-I2: RUN COMPLETE
If blocked:
PRISM-EDIT-I2: BLOCKED-NEEDS-FOUNDER
