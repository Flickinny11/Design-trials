# PRISM PRIMITIVE SYSTEM — PHASE P-1: parametric primitives as NODES + Inspector reshaping + auto-node instantiation. IN-ENGINE. ZERO DOM/CSS. Verified HEADLESS + behaviorally, matching the approved glass look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions, founder NOT watching. Commit+push every wave.

## NOTIFY OFTEN — the founder's ONLY window is notifications
`osascript -e 'display notification "<msg>" with title "Prism · PRIM-P1" sound name "Glass"'` at each wave START, COMMIT, verification START, EACH behavioral check result, advocate result, and any blocker. Short + specific.

## GOAL — build per docs/prism/PRISM-PRIMITIVE-TEMPLATE-SYSTEM-SPEC.md §1 + §5
- PARAMETRIC schema-driven primitives: Pane (extruded rounded-rect; params w/h/thickness/cornerRadius/cutouts[]), Cube/Button (RoundedBox params), Sphere (params). Geometry GENERATED FROM SCHEMA NUMBERS and rebuilt LIVE on edit — NOT baked GLB. REUSE the committed toolbar Pane + Cube components as seeds.
- Each primitive IS a NODE (§0 Node Law): instantiating AUTO-CREATES a node in live-graph (galaxy=unbuilt, canvas=realized) in the SAME action — automatic, one can't exist without the other. `scripts/node-authorship-gate.mjs` must cover it (a primitive rendered without a backing node = FAIL).
- Inspector exposes the schema for LIVE edit: dimensions, thickness, cornerRadius, cutouts, material/tint, contrast, transform. Editing rebuilds geometry instantly.
- Reviewable route `/primitive-lab` (in-engine R3F). Do NOT touch production.

## AESTHETIC GROUND TRUTH — how the STYLE axis is judged
The APPROVED, committed toolbar (`/toolbar-chassis`) and keyframe editor (`/keyframe-editor`) define the look: real transmission glass with thickness, worn brushed-metal "Iron-Man-armor" cubes, engraved-in-glass labels, studio IBL + AgX. A primitive PASSES style IFF it MATCHES that quality + language. NO glossy plastic, NO flat, NO DOM.

## STACK — WebGL ONLY. LAW.
R3F/Three (+ drei). EVERYTHING in-canvas; NO DOM/CSS/Tailwind/inline-style/drei `<Html>`. `scripts/no-dom-ui-gate.mjs` PASS + `scripts/node-authorship-gate.mjs` PASS (paste outputs).

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS. NEAR-HUMAN.
NEVER a headed browser (never paint a window on the founder's screen). HEADLESS Playwright (`chromium.launch({headless:true})`; `npx playwright install chromium` if needed). Behavioral checks (interact -> screenshot -> console -> vision-judge), near-human computer use:
- Instantiate each primitive (Pane/Cube/Sphere) -> confirm a NODE is created in live-graph (read the graph) AND it realizes in canvas.
- Reshape via Inspector (thickness, cornerRadius, size, add a cutout) -> geometry REBUILDS live (before/after frames).
- Change material/tint -> applies + matches the glass/worn aesthetic.
- STYLE: compare against `/toolbar-chassis` + `/keyframe-editor` — must MATCH.
Then a FRESH-CONTEXT USER-ADVOCATE (no build context; given spec §1 + the approved-look description + the live URL; task: "instantiate a glass pane and a cube, reshape them, change their material; report friction/breakage/ugliness AND whether they match the approved glass look"). FAIL BLOCKS. Frames -> notes/verification/prim-p1/. Resize before reading (`sips -s format jpeg -s formatOptions 72 -Z 1300 <png> --out /tmp/x.jpg`).

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents (reuse kid-kode-landing/notes/catalog-finish-workflow.mjs `parallel()`). Read first: PRISM-PRIMITIVE-TEMPLATE-SYSTEM-SPEC.md, VERIFICATION-STANDARD.md, the committed toolbar/keyframe components, live-graph + node-authorship-gate.

## WAVES (commit+push+NOTIFY each)
1. w-geo: parametric Pane/Cube/Sphere from schema (reuse toolbar seeds), live rebuild on param change. `AUTO-CKPT: PRIM-P1 w-geo`.
2. w-node: instantiation pipeline — instantiating auto-creates a node (galaxy/canvas), node-authorship-gate coverage. `AUTO-CKPT: PRIM-P1 w-node`.
3. w-inspector: Inspector exposes + live-edits the schema (reshape/resize/thickness/cutouts/material). `AUTO-CKPT: PRIM-P1 w-inspector`.
4. w-verify: HEADLESS behavioral verification + advocate + aesthetic match + frames + report. `AUTO-CKPT: PRIM-P1 w-verify`.

## ANTI-STUCK
NEVER fall back to DOM/CSS/plastic/baked-GLB-for-clean-forms. If blocked after real effort, land what works, note it, write report, emit BLOCKED — don't thrash.

## DONE / MARKERS
DONE when: Pane/Cube/Sphere instantiate as parametric NODES (auto-created, gate PASS), Inspector reshapes them live, they MATCH the approved glass look, HEADLESS behavioral verification + advocate clean, no-dom-ui + node-authorship PASS, tsc 0-new, 0 console errors, frames captured. Write notes/PRIM-P1-REPORT.md. Print LAST:
PRISM-PRIM-P1: RUN COMPLETE
If blocked, write report w/ blocker and print LAST:
PRISM-PRIM-P1: BLOCKED-NEEDS-FOUNDER
