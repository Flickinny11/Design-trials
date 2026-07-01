# PRISM WORKSPACE COMPLETION — PHASE W-5: VERIFY + PARITY + RETIRE — the whole-workspace behavioral pass + drop-in-a-second-graph genericity; parity-port the remaining supporting surfaces to in-engine glass; wire (gated) the live config; retire the legacy DOM `/` editor. IN-ENGINE GLASS. ADDITIVE. Verified HEADLESS + near-human.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions, founder NOT watching. Commit+push every wave. MAXIMIZE ULTRACODE: parallel subagents per wave (reuse kid-kode-landing/notes/catalog-finish-workflow.mjs `parallel()`).

## NOTIFY OFTEN — founder's ONLY window
`osascript -e 'display notification "<msg>" with title "Prism · WS-W5" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md §4(F1-F3) + §7 + §10
Finish + verify the whole workspace. ADDITIVE: do NOT break W-1..W-4 or the labs.
- F2 PARITY-PORT the remaining supporting surfaces to IN-ENGINE GLASS in /editor: change-artifact · element browser · search palette · history/undo · the guided-tips lightbulb. (Reference the legacy `/` editor for WHAT they do; render in-engine, matching the approved look.)
- F3 CONFIG FLIP: wire the LIVE model/aggregator/media config (OpenRouter router + Nango aggregator + fal/replicate media, §10) behind config flags; DOCUMENT in the report the exact keys/env the founder must supply to go live (this is a FOUNDER step — do NOT block; the build + verification run against the offline/reference + mock paths).
- F3 RETIRE the legacy DOM `/` editor: once /editor is at full parity, REMOVE the legacy `/` route so /editor is the sole workspace (additive-safe — the legacy code stays in git history). Keep the lab routes intact.
- F1/§7 WHOLE-WORKSPACE behavioral pass + DROP-IN-A-SECOND-GRAPH genericity (below).

## AESTHETIC GROUND TRUTH
`/toolbar-chassis` + `/keyframe-editor` + the W-1..W-4 surfaces — real transmission glass, worn metal, engraved labels, IBL + AgX. Ported surfaces match. NO flat, NO purple, NO stock icons.

## STACK — WebGL ONLY for Prism chrome. LAW.
R3F/Three (+ drei). NO DOM/CSS/Tailwind/`<Html>` for Prism chrome. no-dom-ui-gate PASS, node-authorship-gate PASS.

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN computer-use. THE FINAL GATE.
NEVER headed. HEADLESS (`chromium.launch({headless:true})`). Run the FULL §7 WHOLE-WORKSPACE pass end-to-end in /editor: GALAXY-navigate (planets + glyphs) -> CANVAS-build a 3D element -> NODE-EDITOR wire a function + an integration + a data model -> PROMPT-EDIT it by chat with a chosen model (it asks a question, generates media, applies via validated plan, vision-self-verifies) -> PREVIEW the running app -> CLICK an element in preview to jump back to its node -> SAVE -> reload (round-trip). THEN DROP IN A SECOND Prism graph (a different live-graph.json) and confirm galaxy + canvas + node editor understand and edit it (INV-W4 genericity). Confirm the ported supporting surfaces work. Confirm the legacy `/` route is retired (/editor is sole workspace). Secret-leak grep across the run. STYLE matches the approved look throughout. THREE FRESH-CONTEXT JUDGES (advocate / aesthetic / spec), ZERO must-fix. FAIL BLOCKS. Frames -> notes/verification/ws-w5/. Resize before reading (sips -Z 1300 q72).

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents. Read FIRST: PRISM-WORKSPACE-COMPLETION-SPEC.md (§4 F, §7, §8, §10), VERIFICATION-STANDARD.md, the legacy `/` editor supporting surfaces (src/components/editor/: change-artifact, element browser, search, history, guided-tips), the /editor shell (editor-shell) + W-1..W-4 surfaces, the graph-source loader (to drop in a second graph), the shared graph store.

## WAVES (commit+push+NOTIFY each)
1. w-port: parity-port change-artifact + element browser + search + history/undo + guided-tips lightbulb to in-engine glass in /editor. `AUTO-CKPT: WS-W5 w-port`.
2. w-config: wire the live model/aggregator/media config (gated) + document the founder key step in the report. `AUTO-CKPT: WS-W5 w-config`.
3. w-retire: remove the legacy `/` route (labs intact); /editor is the sole workspace. `AUTO-CKPT: WS-W5 w-retire`.
4. w-verify: the FINAL HEADLESS near-human WHOLE-WORKSPACE pass + DROP-IN-A-SECOND-GRAPH + ported surfaces + secret grep + 3 fresh-context judges + frames + a full completion report (every §0 map item -> [DONE]). `AUTO-CKPT: WS-W5 w-verify`.

## ANTI-STUCK
NEVER break W-1..W-4 or the labs. NEVER block on live keys — verify against offline/reference + mock; document the founder key step. Removing the legacy `/` route is additive-safe (git history retains it) — do it only after confirming /editor parity. If blocked after real effort, land what works, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: the supporting surfaces are ported to in-engine glass; the live config is wired (gated) + the founder key step documented; the legacy `/` route is retired (/editor sole workspace, labs intact); the FULL whole-workspace §7 pass + the drop-in-a-second-graph genericity pass are clean; no secret leak; matches the approved look; HEADLESS near-human verification + 3 fresh-context judges (0 must-fix); gates PASS, tsc 0-new, 0 console errors; frames captured; the completion report flips every §0 map item to [DONE]. Write notes/WS-W5-REPORT.md. Print LAST:
PRISM-WS-W5: RUN COMPLETE
If blocked:
PRISM-WS-W5: BLOCKED-NEEDS-FOUNDER
