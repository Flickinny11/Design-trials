# PRISM TOOLBAR — finish the founder-approved glass chassis: worn metal/stone, grouped labeled sections, engraved glass labels. IN-ENGINE (R3F/Three). ZERO CSS / Tailwind / DOM UI.

Autonomous senior build agent for **Prism** (ULTRACODE). Repo root `/Users/loganbaird/Prototype_Prism/Design-trials` (branch `prism-editor-build`). App `kid-kode-landing/`. `unset NODE_ENV` always. Pre-authorized (bypassPermissions), founder NOT watching. Commit+push every wave. macOS notification each wave + completion (`osascript ... title "PRISM TOOLBAR" sound name "Glass"`).

## STATE — BUILD ON THE COMMITTED FOUNDATION
The founder **approved the chassis direction**. A prior run committed `AUTO-CKPT: CHASSIS w1 (glass pane + cutouts + cubes in engine)` — the reviewable R3F scene/route with the glass pane, milled cutouts, and rounded-cube buttons already exists. `git log`, find that route + components, and BUILD ON THEM. Do not start over; do not regress the locked chassis. This run applies the founder's refinements on top.

## LOCKED CHASSIS (unchanged — keep exactly)
Thick glass pane (real thickness, extruded rounded-rect Shape) · a milled rounded-rect CUTOUT per button · ROUNDED-CORNERED CUBE buttons seated in the cutouts (sized to never clip the glass during spin) · on HOVER each button spins end-over-end on its horizontal axis (~3.5 turns, accelerate then smoothly decelerate, easeInOutCubic) revealing SEE-THROUGH the cutout · real `MeshPhysicalMaterial` transmission glass + real environment map (refraction/reflection) · AgX tone mapping, sRGB, soft shadows · editorial dark backdrop. Reviewable route; do NOT touch the production toolbar.

## THE FOUNDER'S REFINEMENTS — build all of these
1. **MATERIAL — worn, not glossy.** The cubes must read as **real metal and stone with photoreal texture, lit so the texture shows** — think **Iron Man's suit of armor**: refined alloy, polished BUT worn, micro-scratches, brushed/satin finish, subtle patina/edge-wear. NOT a glossy plastic shader, NOT mirror-clean. GENERATE real PBR maps (albedo + roughness + normal + metalness/ao) via **Replicate or Tripo 3** texture generation (`.assetgen/` keys; FLUX.2 ok for tex; optimize maps sensibly). Apply them to the cubes. The worn material is the single biggest upgrade — get it right.
2. **A FEW rich colors, GROUPED BY FUNCTION.** Buttons do NOT all need different materials. **Enumerate the real toolbar's functions** (~20 total) from the app, **group them into logical categories** (e.g. Create / Edit-Transform / Scene / Logic / Output — use the actual functions), and give **each category ONE rich color** — a curated, fashionable, jewel-tone-metallic palette (e.g. **deep maroon/oxblood**, deep emerald, deep sapphire, aged bronze/amber, gunmetal). ~3–5 colors total, one per section. The color tints the worn metal (e.g. deep-maroon worn alloy).
3. **GRID LAYOUT in labeled SECTIONS.** Lay the pane out as multiple **labeled sections**, each section a **grid of buttons** (rows × columns — e.g. a 6-button section as 2 rows × 3 columns). Multiple sections across the pane, grouped by category, ~20 buttons total. Order/size the pane to fit them cleanly and read as a real professional toolbar.
4. **SECTION LABELS ENGRAVED INTO THE GLASS.** Each section gets a text label **engraved into the glass panel itself** — recessed/embossed in-glass text, photorealistic engraving that catches light (geometry boolean-subtract, or a normal/displacement approach on the glass). NEVER floating DOM text, NEVER an overlay. In-engine only.

## THE STACK — WebGL ONLY. LAW.
R3F / Three (Theatre.js / Babylon.js / drei in-bounds). **EVERYTHING in the canvas.** Labels, engraved section text, tooltips = in-engine (engraving on the glass; Troika / drei `<Text>` / SDF for any floating text/tooltips) — NEVER DOM, NEVER drei `<Html>`, NEVER overlay. **ZERO Tailwind, ZERO CSS, ZERO styled DOM UI** in the editor chrome.

## THE GATE — enforce the law
Ensure `scripts/no-dom-ui-gate.mjs` exists and FAILS (non-zero) on any Tailwind class / styling className / inline style / CSS-module import / drei `<Html>` in the editor-chrome source (scope to the chrome; landing/marketing pages excluded — state coverage). Wire into verification; run is NOT done if it fails. Print its output.

## MODEL / ORCH
MODEL **claude-opus-4-8** (confirm; never opusplan). ULTRACODE parallel subagents (reuse `kid-kode-landing/notes/catalog-finish-workflow.mjs` `parallel()`) — parallelize PBR-map generation per material. Read first: the committed chassis route/components, `PRISM-EDITOR-CHROME-SPEC.md`, `DESIGN-REFERENCES.md`, the real toolbar's function list. Keys in `.assetgen/`.

## WAVES (commit+push+notify each)
1. **Worn PBR materials.** Generate real worn metal/stone PBR map sets (Iron-Man-armor finish) via Replicate/Tripo for each section color; apply to the cube material; light so texture/wear reads. Commit `AUTO-CKPT: TOOLBAR w-mat (worn PBR materials)`.
2. **Sections + grid + color grouping.** Enumerate functions → categories → colors; lay the pane out as labeled grid-sections (~20 buttons); resize pane. Commit `AUTO-CKPT: TOOLBAR w-layout (grouped grid sections)`.
3. **Engraved glass section labels + spin/see-through + tooltips.** Engrave each section label into the glass; keep hover-spin + see-through working across all buttons; in-canvas hover tooltips. Commit `AUTO-CKPT: TOOLBAR w-engrave (engraved labels + mechanic)`.
4. Verify (below).

## VERIFICATION — for FOUNDER REVIEW (he is the judge)
`unset NODE_ENV`; fresh dev (`lsof -ti tcp:3000|xargs kill -9; rm -rf .next; npm run dev`), wait 200, COLD-LOAD GATE via chrome-devtools MCP at the toolbar route (fail on `_next` 404 / pageerror / no `<canvas>` / stuck loader). Run **no-dom-ui-gate** → must PASS (paste output). Capture frames to `notes/verification/toolbar-final/`: the full toolbar (showing sections, grids, engraved labels, worn material, glass), a worn-material close-up, a spin sequence showing see-through, and the engraved labels catching light. Resize before reading (`sips -s format jpeg -s formatOptions 72 -Z 1300 <png> --out /tmp/x.jpg`). tsc 0-new, 0 console errors. Do NOT self-grade aesthetics — the FOUNDER reviews the frames.

## ANTI-STUCK
NEVER fall back to CSS/DOM/Tailwind/glossy-plastic stand-ins. If a material genuinely can't reach the worn-photoreal bar after real effort (real PBR maps, alt generator), land what works, note it, write the report, emit the BLOCKED marker — do not thrash.

## DONE / MARKERS
DONE when: toolbar renders cleanly at its route with worn materials + grouped grid sections + engraved glass labels + working spin/see-through, no-dom-ui-gate PASSES, tsc 0-new, 0 console errors, frames captured. Write `notes/CHASSIS-REPORT.md` (sections/colors/function-grouping, worn-PBR maps generated w/ paths, engraving technique, gate output, frame paths, honest flags). Print LAST:
PRISM-CHASSIS: RUN COMPLETE
If genuinely blocked: write the report w/ the blocker and print LAST:
PRISM-CHASSIS: BLOCKED-NEEDS-FOUNDER
