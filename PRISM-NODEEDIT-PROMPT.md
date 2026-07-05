# PRISM NODE EDITOR CHROME — generated liquid-glass base + generated 3D tabs/sections + premium icons (spec §3)

Autonomous senior build agent for **Prism** (ULTRACODE). Repo root `/Users/loganbaird/Prototype_Prism/Design-trials` (branch `prism-editor-build`). App `kid-kode-landing/`. `unset NODE_ENV` always. Pre-authorized, not watching. Commit+push every wave. macOS notification each wave + completion (`osascript ... title "PRISM NODEEDIT" ...`).

## SCOPE — the NODE EDITOR UI only (binding spec `kid-kode-landing/docs/prism/PRISM-EDITOR-CHROME-SPEC.md` §3, plus directives §0 + icon rules §2 + generation protocol §6 + verification §7). Read the spec IN FULL. The toolbar (just finished) and keyframe editor are OUT of scope — do not regress the toolbar; do not touch keyframe. Match the toolbar's now-established premium liquid-glass language for consistency.

## CRITERIA (each a checklist row → must PASS)
- **NE-1** Node-editor BASE = a GENERATED photoreal liquid-glass 3D object (GLB on disk under `public/prism-mock/editor/meshes/`), same liquid-glass treatment as the toolbar (volumetric, refractive — not flat, not glassmorphism).
- **NE-2** The TABS and SECTIONS inside the node editor are OTHER GENERATED photoreal 3D objects (GLBs on disk) — not flat CSS panels.
- **NE-3** Node-editor ICONS are premium, 3D-with-depth, custom, COLORED, ANIMATED, with hover tooltips (per §2; zero emoji/Lucide/lightning/boxes/line-drawings; coherent with the toolbar icon language).
- **NE-4** TABS have HOVER ANIMATIONS using the 3D liquid + design_references.
- **NE-5** Volumetric DEPTH, SHADOWS, AMBIENT LIGHT throughout.
- **D1-D7** generation mandatory; nothing flat; no cheap icons; no grotesque fonts; preserve every node-editor FUNCTION (every tab/control still does what it did — Inspector tabs, fields, save/rebuild, etc.).

## MODEL / ORCH
MODEL **claude-opus-4-8**. ULTRACODE parallel subagents (reuse `notes/catalog-finish-workflow.mjs` `parallel()`). Read first: spec §3, the node-editor / Inspector component + every control it wires, the toolbar's TOOLBAR-V2 implementation (match its material/behavior layer), DESIGN-REFERENCES.md, `.assetgen/optimize-glb.mjs`. Generate base + each tab/section + each icon as GLBs (Tripo v3.1 / Replicate; FLUX.2 tex), optimize each via `.assetgen/optimize-glb.mjs`. Keys in `.assetgen/`.

## WAVES (commit+push+notify each)
1. Inventory the node editor's real structure (every tab, section, icon, control) + generate the base + tab/section + icon GLBs; QA on /glb-lab. Commit `AUTO-CKPT: NODEEDIT w1 (generated GLB forms)`.
2. Mount generated forms as the node-editor chrome; liquid-glass base + generated 3D tabs/sections; wire every existing control to its real handler; colored animated icons. Commit `AUTO-CKPT: NODEEDIT w2 (mounted forms + wiring)`.
3. Tab hover animations + tooltips + volumetric depth/shadows/ambient light; legibility pass (icons readable). Commit `AUTO-CKPT: NODEEDIT w3 (hover anim + depth + tooltips)`.
4. Verify (below).

## VERIFICATION — per-row checklist gate
`unset NODE_ENV`; fresh dev; COLD-LOAD GATE (chrome-devtools MCP; fail on `_next` 404 / pageerror / no canvas / stuck loader). Open the node editor and exercise it. Append a NODE-EDITOR section to `notes/EDITOR-CHROME-CHECKLIST.md`: NE-1..5 + D1-D7 rows, each PASS/FAIL with evidence — generation rows: GLB on disk + scene-graph assertion mounted (0 procedural form stand-ins for base/tabs/sections); NE-4 hover: multi-frame; tooltips: hover frame; function: every node-editor control fires (matrix). Reviewers per-row: art-fidelity, `prism-criteria-reviewer`, **user-advocate** non-technical first-timer: *"Does the node editor read as a premium generated 3D liquid-glass panel with real 3D tabs and readable premium icons, or is anything flat / cheap / broken?"* cited frames + MUST-FIX. Frames → `notes/verification/nodeedit/` (resize before reading).

## ANTI-STUCK
NEVER procedural fallback. If a specific form genuinely can't reach quality after real effort, land what works, mark that row FAIL w/ evidence, write the report, emit the BLOCKED marker (below) — do not thrash.

## DONE / MARKERS
DONE only when 100% of NE rows PASS, toolbar NOT regressed, clean cold load, tsc 0-new, 0 console errors, art-fidelity clean, criteria-reviewer pass, advocate PLEASED. Write `notes/NODEEDIT-REPORT.md` (generated assets w/ paths, mounting/wiring, the filled checklist w/ per-row evidence, gate verdicts, honest flags). Print LAST:
PRISM-NODEEDIT: RUN COMPLETE
If genuinely blocked, write the report w/ the blocker and print LAST:
PRISM-NODEEDIT: BLOCKED-NEEDS-FOUNDER
