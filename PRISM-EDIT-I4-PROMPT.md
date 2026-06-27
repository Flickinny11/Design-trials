# PRISM EDITOR INTEGRATION — PHASE I-4: PERSIST + PREVIEW + header/footer slots + END-TO-END verification. IN-ENGINE. ZERO DOM/CSS. ADDITIVE. Verified HEADLESS, matching the approved glass look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions. Commit+push every wave. BUILD ON committed I-1 + I-2 + I-3.

## NOTIFY OFTEN
`osascript -e 'display notification "<msg>" with title "Prism · EDIT-I4" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-EDITOR-INTEGRATION-SPEC.md §3 (I-4) + §1
- PERSIST: save / load the app graph (serialize the live graph incl. all node schemas/animations/edges; reload restores the exact editor state). A SAVE control + autosave is fine.
- PREVIEW: the galaxy/canvas/PREVIEW tri-state's PREVIEW mode renders the BUILT/REALIZED app — the graph as the running application (header/footer + page content from the hub nodes), interactive where applicable.
- HEADER / FOOTER global node slots (per the runtime model — global node slots realized in preview + editable).
- ADDITIVE: reuse committed components; do NOT break the labs. This phase completes the editor.

## AESTHETIC GROUND TRUTH
Approved `/toolbar-chassis` + `/keyframe-editor` glass look for the editor chrome. Preview renders the USER's app (its own styling), but the editor frame stays glass. NO DOM in the editor chrome.

## STACK — WebGL ONLY. LAW.
R3F/Three (+ drei). Editor chrome: NO DOM/CSS/Tailwind/`<Html>`. no-dom-ui-gate PASS, node-authorship-gate PASS.

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN. THE BIG END-TO-END PASS.
Behavioral (interact -> screenshot -> console -> vision-judge): BUILD A SMALL APP in `/editor` end-to-end — add nodes via the TOOLBAR, DRAG more from the LIBRARY, EDIT them in the INSPECTOR, STACK + CONNECT them, KEYFRAME one, switch to PREVIEW (the app renders/runs), SAVE -> reload -> confirm the app persists. Confirm header/footer slots. STYLE: editor matches approved glass throughout. THREE FRESH-CONTEXT JUDGES: user-advocate (task: "build a tiny app — add a couple elements, customize one, connect them, preview it, save and reload; report friction + whether it's a premium editor matching the approved look"), aesthetic (matches approved glass, no F-4), spec-conformance (PRISM-EDITOR-INTEGRATION-SPEC §1 checklist complete, §0 invariants held). ALL must PASS, 0 MUST-FIX. Frames -> notes/verification/edit-i4/.

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents. Read first: SPEC §3(I-4)+§1+§0, VERIFICATION-STANDARD.md, committed I-1/I-2/I-3, the runtime/preview path + node serialization.

## WAVES (commit+push+NOTIFY each)
1. w-persist: save/load the app graph (full serialize/restore). `AUTO-CKPT: EDIT-I4 w-persist`.
2. w-preview: PREVIEW mode renders the running app + header/footer global slots. `AUTO-CKPT: EDIT-I4 w-preview`.
3. w-verify: THE END-TO-END HEADLESS behavioral pass (build-a-small-app + persist + preview) + 3 fresh-context judges + §1 checklist + frames + report. `AUTO-CKPT: EDIT-I4 w-verify`.

## ANTI-STUCK
NEVER fake persist/preview. NEVER DOM in chrome. NEVER break the labs. If blocked, land what works, note it, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: the editor SAVES/LOADS the app graph, PREVIEW renders the running app, header/footer slots work, the full build-a-small-app end-to-end pass + 3 fresh-context judges all clean (0 MUST-FIX), §1 checklist complete, matching the approved look, labs intact, gates PASS, tsc 0-new, 0 console errors, frames captured. Write notes/EDIT-I4-REPORT.md. Print LAST:
PRISM-EDIT-I4: RUN COMPLETE
If blocked:
PRISM-EDIT-I4: BLOCKED-NEEDS-FOUNDER
