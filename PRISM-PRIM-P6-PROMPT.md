# PRISM PRIMITIVE SYSTEM — PHASE P-6: the in-canvas LIBRARY/PALETTE + dogfood chrome. IN-ENGINE. ZERO DOM/CSS. Verified HEADLESS, matching the approved glass look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions. Commit+push every wave. BUILD ON committed P-1..P-5.

## NOTIFY OFTEN
`osascript -e 'display notification "<msg>" with title "Prism · PRIM-P6" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-PRIMITIVE-TEMPLATE-SYSTEM-SPEC.md §7
- A 3D-native LIBRARY/PALETTE in the canvas (ZERO DOM), browsable + searchable, each entry a LIVE spinning 3D preview (the cube-button mechanic). Sections: Primitives (P-1) · Composites (P-4) · Materials incl. fluids + prompt-to-texture (P-2/P-3) · Saved (P-5).
- DRAG-to-canvas instantiates (-> node, P-1 pipeline). Select an instance -> Inspector exposes the full schema.
- DOGFOOD: rebuild at least one real chrome panel (e.g. a node-editor panel surface) FROM these primitives — the glass pane in the chrome IS the P-1 Pane primitive. ("Enough = not enough" made structural.)
- Reviewable route `/library` (or in the canvas editor).

## AESTHETIC GROUND TRUTH
The approved `/toolbar-chassis` + `/keyframe-editor` glass look is the bar; the palette itself must be that same premium glass instrument. NO DOM, NO flat list.

## STACK — WebGL ONLY. LAW.
R3F/Three (+ drei). NO DOM/CSS/Tailwind/`<Html>`. no-dom-ui-gate PASS, node-authorship-gate PASS.

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN.
Behavioral (interact -> screenshot -> console -> vision-judge): open the palette -> confirm live 3D previews across sections; SEARCH -> confirm filtering; DRAG a primitive to canvas -> confirm instantiation + a node is created; select it -> Inspector exposes schema; confirm the dogfooded chrome panel is built from the Pane primitive. STYLE: the palette matches the approved glass. FRESH-CONTEXT ADVOCATE (task: "browse the library, find and place a glass pane and a material, then tweak it; report friction + whether the whole thing matches the approved glass look"). FAIL BLOCKS. Frames -> notes/verification/prim-p6/.

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents. Read first: SPEC §7, VERIFICATION-STANDARD.md, committed P-1..P-5.

## WAVES (commit+push+NOTIFY each)
1. w-palette: in-canvas 3D library/palette (sections + live previews + search), no DOM. `AUTO-CKPT: PRIM-P6 w-palette`.
2. w-drag: drag-to-canvas instantiation (-> node) + Inspector on selection. `AUTO-CKPT: PRIM-P6 w-drag`.
3. w-dogfood: rebuild a chrome panel FROM the primitives (Pane primitive = the panel). `AUTO-CKPT: PRIM-P6 w-dogfood`.
4. w-verify: HEADLESS behavioral verification (browse/search/drag/instantiate/dogfood) + advocate + aesthetic match + frames + report. `AUTO-CKPT: PRIM-P6 w-verify`.

## ANTI-STUCK
NEVER a DOM palette/list. If blocked, land what works, note it, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: the in-canvas palette browses/searches with live previews, drag-to-canvas instantiates nodes, a chrome panel is dogfooded from the Pane primitive, all matching the approved glass look, HEADLESS verification + advocate clean, gates PASS, tsc 0-new, 0 console errors, frames captured. Write notes/PRIM-P6-REPORT.md. Print LAST:
PRISM-PRIM-P6: RUN COMPLETE
If blocked:
PRISM-PRIM-P6: BLOCKED-NEEDS-FOUNDER
