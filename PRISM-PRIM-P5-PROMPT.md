# PRISM PRIMITIVE SYSTEM — PHASE P-5: 3D COMPOSITION — stack / connect / snap / group / save-as-template. IN-ENGINE. ZERO DOM/CSS. Verified HEADLESS, matching the approved glass look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions. Commit+push every wave. BUILD ON committed P-1..P-4.

## NOTIFY OFTEN
`osascript -e 'display notification "<msg>" with title "Prism · PRIM-P5" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-PRIMITIVE-TEMPLATE-SYSTEM-SPEC.md §6
- STACK: z-layering + parent-child (title pane parented to header pane).
- CONNECT: graph edges (data/logic) with visible 3D connectors.
- SNAP/ALIGN: 3D snapping + alignment guides; grid + face/edge snap.
- GROUP & SAVE-AS-TEMPLATE: multi-select a stacked assembly -> save as a NEW composite template (users grow the library). Saved templates re-instantiate as subgraphs (P-4).
- Built on the existing transform/Inspector machinery (extend it). Reviewable on the lab/canvas route.

## AESTHETIC GROUND TRUTH
The approved `/toolbar-chassis` + `/keyframe-editor` glass look is the bar; connectors/guides/gizmos must read as premium in-engine elements, not flat HUD. NO DOM.

## STACK — WebGL ONLY. LAW.
R3F/Three (+ drei). NO DOM/CSS/Tailwind/`<Html>`. no-dom-ui-gate PASS, node-authorship-gate PASS (every element + saved template is nodes).

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN.
Behavioral (interact -> screenshot -> console -> vision-judge): STACK two panes (parent-child) -> confirm they move together; CONNECT two nodes -> confirm an edge + visible connector; drag near another element -> confirm SNAP/alignment; multi-select + GROUP + SAVE-AS-TEMPLATE -> then INSTANTIATE the saved template -> confirm it recreates the assembly as a subgraph. STYLE: matches approved glass. FRESH-CONTEXT ADVOCATE (task: "stack two panes, connect them, snap a third, then group + save them and drop the saved template back in; report friction + whether it looks premium/matches the glass look"). FAIL BLOCKS. Frames -> notes/verification/prim-p5/.

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents. Read first: SPEC §6, VERIFICATION-STANDARD.md, committed P-1..P-4, the existing transform/Inspector + composite (subgraph) instantiation.

## WAVES (commit+push+NOTIFY each)
1. w-stack: stacking (z + parent-child) + 3D snapping/alignment guides. `AUTO-CKPT: PRIM-P5 w-stack`.
2. w-connect: graph-edge connect + visible 3D connectors. `AUTO-CKPT: PRIM-P5 w-connect`.
3. w-save: group multi-select -> save-as-template -> re-instantiate as subgraph. `AUTO-CKPT: PRIM-P5 w-save`.
4. w-verify: HEADLESS behavioral verification (stack/connect/snap/group/save/re-instantiate) + advocate + aesthetic match + frames + report. `AUTO-CKPT: PRIM-P5 w-verify`.

## ANTI-STUCK
NEVER DOM/HUD-overlay for connectors/guides. If blocked, land what works, note it, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: stack/connect/snap work, group+save-as-template produces a re-instantiable composite, all matching the approved glass look, HEADLESS verification + advocate clean, gates PASS, tsc 0-new, 0 console errors, frames captured. Write notes/PRIM-P5-REPORT.md. Print LAST:
PRISM-PRIM-P5: RUN COMPLETE
If blocked:
PRISM-PRIM-P5: BLOCKED-NEEDS-FOUNDER
