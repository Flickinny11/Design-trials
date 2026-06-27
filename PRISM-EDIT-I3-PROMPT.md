# PRISM EDITOR INTEGRATION — PHASE I-3: INSPECTOR (edit full schema) + MANIPULATION (transform/stack/connect/snap/group/save) + KEYFRAME panel. IN-ENGINE. ZERO DOM/CSS. ADDITIVE. Verified HEADLESS, matching the approved glass look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions. Commit+push every wave. BUILD ON committed I-1 + I-2.

## NOTIFY OFTEN
`osascript -e 'display notification "<msg>" with title "Prism · EDIT-I3" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-EDITOR-INTEGRATION-SPEC.md §3 (I-3) + §1
- INSPECTOR docked (I-1 inspector zone): SELECT a node -> edit its FULL schema (per type — primitive geometry params, material/tint, fluid params, composite params), reusing the P-1/P-3/P-6 inspector controls (worn-cube faders on milled channels, swatch rows). Editing updates the node live.
- MANIPULATION on the canvas (reuse P-5): transform gizmos (move/rotate/scale), STACK (parent-child), CONNECT (graph edges + 3D connectors), SNAP/align, GROUP multi-select, SAVE-AS-TEMPLATE.
- KEYFRAME PANEL docked (I-1 keyframe zone): the committed keyframe editor, animating the SELECTED node's properties (drag faders -> keyframes, scrub -> animate).
- ADDITIVE: reuse committed components; do NOT break the labs.

## AESTHETIC GROUND TRUTH
Approved `/toolbar-chassis` + `/keyframe-editor` glass look. Inspector/gizmos/connectors/keyframe panel must match (they reuse those components). NO DOM.

## STACK — WebGL ONLY. LAW.
R3F/Three (+ drei). NO DOM/CSS/Tailwind/`<Html>`. no-dom-ui-gate PASS, node-authorship-gate PASS.

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN.
Behavioral (interact -> screenshot -> console -> vision-judge): SELECT a node -> Inspector shows its schema -> drag a fader -> the node updates live; MOVE/ROTATE/SCALE via gizmo; STACK two nodes (move together); CONNECT two nodes (edge + connector); GROUP + SAVE-AS-TEMPLATE; in the KEYFRAME panel, set 2 keyframes + scrub -> the selected node animates. STYLE: matches approved glass. FRESH-CONTEXT ADVOCATE (task: "select an element, change it in the inspector, move and stack it, connect two, then keyframe one and scrub; report whether it works and matches the approved glass look"). FAIL BLOCKS. Frames -> notes/verification/edit-i3/.

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents. Read first: SPEC §3(I-3)+§1, VERIFICATION-STANDARD.md, committed I-1/I-2, the P-1/P-3/P-5/P-6 inspector+composition + the keyframe editor components.

## WAVES (commit+push+NOTIFY each)
1. w-inspector: docked Inspector — select -> edit full schema per node type, live. `AUTO-CKPT: EDIT-I3 w-inspector`.
2. w-manip: transform gizmos + stack/connect/snap/group/save-as-template on the canvas. `AUTO-CKPT: EDIT-I3 w-manip`.
3. w-keyframe: docked keyframe panel animating the selected node. `AUTO-CKPT: EDIT-I3 w-keyframe`.
4. w-verify: HEADLESS behavioral verification (inspector edit + manipulation + keyframe) + advocate + aesthetic match + frames + report. `AUTO-CKPT: EDIT-I3 w-verify`.

## ANTI-STUCK
NEVER DOM/HUD. NEVER break the labs. If blocked, land what works, note it, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: select+inspect+edit-schema works, manipulation (transform/stack/connect/snap/group/save) works, the keyframe panel animates the selection, matching the approved look, labs intact, HEADLESS verification + advocate clean, gates PASS, tsc 0-new, 0 console errors, frames captured. Write notes/EDIT-I3-REPORT.md. Print LAST:
PRISM-EDIT-I3: RUN COMPLETE
If blocked:
PRISM-EDIT-I3: BLOCKED-NEEDS-FOUNDER
