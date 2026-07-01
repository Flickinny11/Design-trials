# PRISM WORKSPACE COMPLETION — PHASE W-4: GALAXY AS THE FULL DIRECTORY + PREVIEW->NODE — photoreal planets sized-by-artifact + an <app>_world center + per-node CAPABILITY GLYPHS; and click a running element in PREVIEW to jump to its node. IN-ENGINE GLASS. ADDITIVE. Verified HEADLESS + near-human, matching the approved look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions, founder NOT watching. Commit+push every wave. MAXIMIZE ULTRACODE: parallel subagents per wave (reuse kid-kode-landing/notes/catalog-finish-workflow.mjs `parallel()`).

## NOTIFY OFTEN — founder's ONLY window
`osascript -e 'display notification "<msg>" with title "Prism · WS-W4" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md §4(A1-A4) + E1 (preview-entry)
Make the GALAXY mode of /editor the FULL directory, and close the preview->node loop. ADDITIVE: do NOT break W-1/W-2/W-3, the legacy `/` editor, or the labs. IN-ENGINE GLASS, matching the approved look.
- A1/A2 GALAXY = a usable DIRECTORY: hubs render as PHOTOREAL PLANETS (brass/bone/ice, lit, glow) orbiting an <app>_world center; each node = a dormant artifact sphere; each hub sized by total artifact size; orbit / zoom / filter / search read as a directory. REUSE the legacy photoreal HubPlanet (src/components/editor/graph/HubPlanet.tsx) for the planet look, rendered in /editor's galaxy.
- A3 per-node CAPABILITY GLYPHS at a glance: built-vs-unbuilt · has-visual · has-function · has-integration · has-animation · has-data (read from the node schema + the W-1 schema + W-2 capability attachments). The directory communicates state.
- A4 Select a node in galaxy -> opens it (canvas focus + the node editor). Galaxy IS the entry to editing any artifact.
- E1 PREVIEW->NODE: click a running element in PREVIEW mode -> jump to its node (canvas focus + node editor; open prompt-edit). Closes the see-it -> edit-it loop.
- INV-W4 RUNTIME-GENERIC: galaxy reads the live graph; nothing app-specific hardcoded.

## AESTHETIC GROUND TRUTH
`/toolbar-chassis` + `/keyframe-editor` + the legacy photoreal galaxy look — real materials, IBL + AgX, transmission glass for chrome. Planets photoreal; glyphs are custom 3D/engraved, NOT stock icons/emoji. NO flat, NO purple.

## STACK — WebGL ONLY. LAW.
R3F/Three (+ drei). NO DOM/CSS/Tailwind/`<Html>`. no-dom-ui-gate PASS, node-authorship-gate PASS.

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN.
NEVER headed. HEADLESS (`chromium.launch({headless:true})`). Behavioral: open /editor in GALAXY -> photoreal planets render sized-by-artifact around the world center; nodes show CAPABILITY GLYPHS (confirm a node with a function/integration/animation/data shows the right glyphs); CLICK a node -> it opens (canvas + node editor). Switch to PREVIEW -> CLICK a running element -> jumps to its node. STYLE matches the approved photoreal/glass look. FRESH-CONTEXT ADVOCATE (task: "browse the galaxy as a directory, tell me what each node contains from its glyphs, open one; then in preview click an element and confirm it takes you to that element's editor; report whether it works and looks premium"). FAIL BLOCKS. Frames -> notes/verification/ws-w4/. Resize before reading (sips -Z 1300 q72).

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents. Read FIRST: PRISM-WORKSPACE-COMPLETION-SPEC.md (§4 A, E1), VERIFICATION-STANDARD.md, the legacy HubPlanet + galaxy (src/components/editor/graph/), the /editor galaxy (editor-shell), the W-1/W-2 node schema + capability attachments, the preview surface, the shared graph store.

## WAVES (commit+push+NOTIFY each)
1. w-planets: photoreal planets sized-by-artifact + <app>_world center in /editor's galaxy (reusing the HubPlanet look). `AUTO-CKPT: WS-W4 w-planets`.
2. w-glyphs: per-node CAPABILITY GLYPHS (built/visual/function/integration/animation/data) read from the schema. `AUTO-CKPT: WS-W4 w-glyphs`.
3. w-preview-link: click a running element in PREVIEW -> jump to its node (+ open prompt-edit). `AUTO-CKPT: WS-W4 w-preview-link`.
4. w-verify: HEADLESS near-human behavioral verification (galaxy directory + glyphs + open-node + preview->node) + 3 fresh-context judges + frames + report. `AUTO-CKPT: WS-W4 w-verify`.

## ANTI-STUCK
NEVER DOM. NEVER stock icons for glyphs. NEVER break W-1/W-2/W-3/legacy/labs. If blocked after real effort, land what works, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: galaxy renders photoreal planets sized-by-artifact around a world center as a usable directory; nodes show capability glyphs; clicking a node opens it; clicking a running element in preview jumps to its node; matches the approved look; prior phases + legacy + labs intact; HEADLESS near-human verification + advocate clean; gates PASS, tsc 0-new, 0 console errors; frames captured. Write notes/WS-W4-REPORT.md. Print LAST:
PRISM-WS-W4: RUN COMPLETE
If blocked:
PRISM-WS-W4: BLOCKED-NEEDS-FOUNDER
