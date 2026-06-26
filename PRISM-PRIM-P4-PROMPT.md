# PRISM PRIMITIVE SYSTEM — PHASE P-4: COMPOSITES + the BOUND nav header (auto-populates from the app's hubs). IN-ENGINE. ZERO DOM/CSS. Verified HEADLESS, matching the approved glass look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions. Commit+push every wave. BUILD ON committed P-1 + P-2 + P-3.

## NOTIFY OFTEN
`osascript -e 'display notification "<msg>" with title "Prism · PRIM-P4" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-PRIMITIVE-TEMPLATE-SYSTEM-SPEC.md §4
- COMPOSITE templates = pre-assembled SUBGRAPHS (primitive nodes + spatial parent-child + edges), instantiated as a unit (composites = subgraphs).
- Canonical: NAV HEADER = base pane node + title pane node (stacked) + N tab pane nodes (one per page) + dropdown node (liquid-glass from P-3). Every piece a real node, stacked in 3D, registered as a subgraph.
- BOUND / REACTIVE (the menu answer): tabs + dropdown items are a DATA BINDING to the app's HUB nodes — a VIEW over the hub set. (a) AUTO-POPULATE: on instantiate, read current hubs -> one tab + one menu item per hub, zero wiring. (b) EDITABLE: add/remove/reorder/rename, pin manual items, hide hubs. (c) AUTO-ADD TOGGLE: ON -> new hubs appear automatically; OFF -> frozen.
- Dropdown EXPANDS as 3D LIQUID GLASS (P-3). Also seed a few more composites (footer, card) as subgraph templates. Reviewable: a route showing the nav composite over a small multi-hub sample graph.

## AESTHETIC GROUND TRUTH
The approved `/toolbar-chassis` + `/keyframe-editor` glass look is the bar. Composites PASS style IFF panes/tabs/dropdown match that real-glass/worn-metal/engraved quality.

## STACK — WebGL ONLY. LAW.
R3F/Three (+ drei). NO DOM/CSS/Tailwind/`<Html>`. no-dom-ui-gate PASS, node-authorship-gate PASS (every composite member is a node).

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN.
Behavioral (interact -> screenshot -> console -> vision-judge): instantiate the nav composite -> confirm a SUBGRAPH is created (read the graph) AND tabs AUTO-POPULATE one-per-hub; ADD a hub to the sample graph -> confirm AUTO-ADD adds a tab; toggle auto-add OFF + add a hub -> confirm NOT added; edit a tab (rename/reorder) -> confirm; EXPAND the dropdown -> confirm 3D liquid-glass animation. STYLE: matches approved glass. FRESH-CONTEXT ADVOCATE (task: "drop in a nav header, confirm it shows my pages, add a page and watch it appear, open the menu; report friction + whether it matches the approved glass look"). FAIL BLOCKS. Frames -> notes/verification/prim-p4/.

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents. Read first: SPEC §4, VERIFICATION-STANDARD.md, committed P-1/P-2/P-3, the live-graph hub structure (hubs = pages), node-authorship-gate.

## WAVES (commit+push+NOTIFY each)
1. w-composite: composite = subgraph instantiation (member nodes + edges + stacking); nav header assembled from P-1 panes. `AUTO-CKPT: PRIM-P4 w-composite`.
2. w-bind: nav tabs/dropdown BOUND to hub nodes — auto-populate + editable + auto-add toggle. `AUTO-CKPT: PRIM-P4 w-bind`.
3. w-dropdown: dropdown expands as 3D liquid glass (P-3); seed footer/card composites. `AUTO-CKPT: PRIM-P4 w-dropdown`.
4. w-verify: HEADLESS behavioral verification (auto-populate, auto-add on/off, expand) + advocate + aesthetic match + frames + report. `AUTO-CKPT: PRIM-P4 w-verify`.

## ANTI-STUCK
NEVER hardcode tabs or fake the binding; tabs MUST derive from hub nodes. NEVER DOM. If blocked, land what works, note it, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: the nav composite instantiates as a subgraph, auto-populates tabs from hubs, auto-add works both ways, the dropdown expands as liquid glass, all matching the approved glass look, HEADLESS verification + advocate clean, gates PASS, tsc 0-new, 0 console errors, frames captured. Write notes/PRIM-P4-REPORT.md. Print LAST:
PRISM-PRIM-P4: RUN COMPLETE
If blocked:
PRISM-PRIM-P4: BLOCKED-NEEDS-FOUNDER
