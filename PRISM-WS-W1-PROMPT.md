# PRISM WORKSPACE COMPLETION — PHASE W-1: the NODE EDITOR in-engine — the per-node PURPOSE surface (schema / behavior / caption) as DOCKED GLASS in /editor, SYNCED to the shared graph store. IN-ENGINE. ZERO DOM/CSS. ADDITIVE. Verified HEADLESS, matching the approved glass look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions, founder NOT watching. Commit+push every wave.

## NOTIFY OFTEN — the founder's ONLY window is notifications
`osascript -e 'display notification "<msg>" with title "Prism · WS-W1" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md W-1 + §4(C) + §2 + §3
- Select a node in `/editor` -> an IN-ENGINE GLASS node-editor panel (docked) shows that node's PURPOSE surface: SCHEMA, BEHAVIOR, CAPTION. (Functions/Integrations are W-2; prompt-edit is W-3 — NOT this phase.) Each field editable, LIVE, and SYNCED to the shared graph store (INV-W8) — edit in the node editor, see it reflected in canvas, and vice-versa.
- NO visual-editor mode in the node editor (C2 / anchor F7): visual editing stays in canvas; the node editor shows the node in its IN-BUILT state (its data/meaning, not its 3D handles).
- ROUND-TRIPS (C4): every node-editor change saves -> reloads EXACTLY (additive schema only; topology frozen).
- REUSE: the SHARED graph store + the existing node schema + the LEGACY node-editor logic (src/components/editor/panels/Inspector.tsx + the purpose surface) for WHAT the surface edits — but render it as IN-ENGINE GLASS docked in /editor, NOT as DOM. ADDITIVE: do NOT modify/break the legacy `/` editor or the lab routes.

## AESTHETIC GROUND TRUTH
The approved `/toolbar-chassis` + `/keyframe-editor` glass look — real transmission glass, worn metal, engraved labels, studio IBL + AgX. The node-editor panel matches the docked inspector/keyframe panels already in /editor. NO DOM, NO flat, NO purple, NO stock icons.

## STACK — WebGL ONLY. LAW.
R3F/Three (+ drei). NO DOM/CSS/Tailwind/`<Html>`. no-dom-ui-gate PASS, node-authorship-gate PASS.

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN.
NEVER a headed browser. HEADLESS (`chromium.launch({headless:true})`). Behavioral (interact -> screenshot -> console -> vision-judge): SELECT a node in /editor -> the glass node-editor panel appears docked showing schema/behavior/caption; EDIT a field -> the change persists on the node AND is reflected (sync) — confirm by reading the graph + a canvas frame; SAVE -> reload -> the edit survives (round-trip). STYLE: matches approved glass. FRESH-CONTEXT ADVOCATE (task: "select an element, open its node editor, change its schema/caption, confirm it sticks and shows in canvas; report whether it works and matches the approved glass look"). FAIL BLOCKS. Frames -> notes/verification/ws-w1/. Resize before reading.

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents (reuse kid-kode-landing/notes/catalog-finish-workflow.mjs `parallel()`). Read first: PRISM-WORKSPACE-COMPLETION-SPEC.md, VERIFICATION-STANDARD.md, PRISM-NODE-EDITOR-SPEC.md §5, the committed /editor (editor-shell) + its inspector dock, the shared graph store, the legacy Inspector purpose surface.

## WAVES (commit+push+NOTIFY each)
1. w-panel: an in-engine glass node-editor panel that opens on node-select in /editor (docked, matching the approved look). `AUTO-CKPT: WS-W1 w-panel`.
2. w-purpose: schema + behavior + caption editing in that panel, LIVE + SYNCED to the shared store (round-trips). `AUTO-CKPT: WS-W1 w-purpose`.
3. w-verify: HEADLESS behavioral verification (select -> edit -> sync -> save/reload) + advocate + aesthetic match + frames + report. `AUTO-CKPT: WS-W1 w-verify`.

## ANTI-STUCK
NEVER DOM/flat. NEVER break the legacy editor or labs. NEVER a visual-editor mode in the node editor. If blocked after real effort, land what works, note it, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: selecting a node in /editor opens an in-engine glass node-editor panel that edits schema/behavior/caption live + synced + round-tripping, matching the approved look, legacy+labs intact, HEADLESS verification + advocate clean, gates PASS, tsc 0-new, 0 console errors, frames captured. Write notes/WS-W1-REPORT.md. Print LAST:
PRISM-WS-W1: RUN COMPLETE
If blocked:
PRISM-WS-W1: BLOCKED-NEEDS-FOUNDER
