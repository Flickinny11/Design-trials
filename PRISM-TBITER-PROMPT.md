# PRISM TOOLBAR ITERATE — fix the flagged issues on the GENERATED toolbar (do NOT rebuild from scratch)

Autonomous senior build agent for **Prism** (ULTRACODE). Repo root `/Users/loganbaird/Prototype_Prism/Design-trials` (git root, branch `prism-editor-build`). App `kid-kode-landing/`. `unset NODE_ENV` always. Operator non-technical, pre-authorized (bypassPermissions), NOT watching. Commit+push every wave. Fire a macOS notification at each wave + at completion (`osascript -e 'display notification "<status>" with title "PRISM TBITER" sound name "Glass"'`).

## CONTEXT
The toolbar was just rebuilt from 29 GENERATED Tripo GLBs (shell + 14 buttons + 14 icons in `kid-kode-landing/public/prism-mock/editor/meshes/`) — that part is CORRECT and must be PRESERVED. Binding spec: `kid-kode-landing/docs/prism/PRISM-EDITOR-CHROME-SPEC.md` (read in full). This run ITERATES the existing generated toolbar to fix four founder-flagged defects. Do NOT discard the generated GLBs; do NOT go procedural; regenerate ONLY assets that are individually defective.

## THE FOUR FIXES (each is a checklist row that must end PASS)
- **F1 — LEGIBILITY / DE-MURK.** In situ the liquid-glass shell is so dark/oil-slick that it swallows the coins+icons; at toolbar scale the icons are hard to read. Brighten/clarify the glass + lighting (raise transmission clarity, add key/rim light, lift icon emissive/contrast) so EVERY icon reads clearly on the mounted rail — WITHOUT losing the real liquid-glass character (still volumetric, refractive, warping — not flat, not glassmorphism).
- **F2 — UNIFY THE COIN FAMILY.** The 14 button coins skew samey-black and 1–2 read rough/"shattered". Give the coins ONE coherent premium material language (consistent rim/bezel + finish), and regenerate/repair the specific rough coins. The set should look designed-together, not 14 near-identical black domes.
- **F3 — UPGRADE THE GENERIC ICONS.** Most icons are premium+crystalline (icosahedron, glass T, gem-in-brackets) but a few read like a generic 3D-icon-pack (the lightbulb, the dumbbell, the gear). Regenerate those few to match the premium crystalline/material language of the best ones, so all 14 share one bespoke premium aesthetic. Keep them colored + animated.
- **F4 — KEEP EVERYTHING THAT WORKS.** Preserve the generated forms, the warp, the hover-spin (3–4 horiz, accel→decel, reveals depth), engraving subset, tooltips, ADD/BUILD labels, and all 14 firing actions. No regressions.

## MODEL / ORCH
MODEL **claude-opus-4-8** (confirm; never opusplan). ULTRACODE parallel subagents within waves (reuse `kid-kode-landing/notes/catalog-finish-workflow.mjs` `parallel()`). Read first: the spec, `notes/TOOLBAR-V2-REPORT.md`, `notes/EDITOR-CHROME-CHECKLIST.md`, the toolbar component, `notes/verification/toolbar-v2/EV-*.jpg`, DESIGN-REFERENCES.md, `.assetgen/optimize-glb.mjs`. Asset keys in `.assetgen/` (Tripo v3.1 / Replicate; FLUX.2 for tex). Optimize every (re)generated GLB with `.assetgen/optimize-glb.mjs` (plain GLB, no decoder).

## WAVES (commit+push+notify each)
1. Triage current state on the /glb-lab QA route + in-app rail; pin exactly which coins/icons need regen for F2/F3; tune the shell+lighting for F1. Commit `AUTO-CKPT: TBITER w1 (de-murk + triage)`.
2. Regenerate the flagged coins/icons to the unified premium language; re-optimize; remount. Commit `AUTO-CKPT: TBITER w2 (unified coins + upgraded icons)`.
3. Re-tune in-app legibility (glass clarity vs icon contrast) until every icon reads on the rail; preserve spin/warp/engraving/tooltips/actions. Commit `AUTO-CKPT: TBITER w3 (in-app legibility)`.
4. Verify (below).

## VERIFICATION — per-row checklist gate
`unset NODE_ENV`; fresh dev (`lsof -ti tcp:3000|xargs kill -9; rm -rf .next; npm run dev`), wait 200, COLD-LOAD GATE via chrome-devtools MCP (fail on any `_next` 404 / pageerror / no canvas / stuck loader). Update `notes/EDITOR-CHROME-CHECKLIST.md`: F1–F4 rows + the in-scope toolbar rows (D1-D7, TB-1..9, IC-1..5), each PASS/FAIL with evidence — generation rows: GLB on disk + scene-graph assertion the GLB is mounted (0 procedural stand-ins); animation rows: multi-frame; tooltip rows: hover frame; legibility (F1): a mounted-rail frame where every icon is clearly readable. Reviewers check EACH ROW: art-fidelity (`scripts/art-fidelity-review.mjs`), `prism-criteria-reviewer`, **user-advocate** non-technical first-timer asked specifically: *"Can you tell what every icon is on the rail, do the coins look designed-together, and does any icon look like a generic stock 3D icon?"* — cited frames + MUST-FIX power. Frames → `notes/verification/tbiter/` (resize before reading: `sips -s format jpeg -s formatOptions 72 -Z 1300 <png> --out /tmp/x.jpg`).

## ANTI-STUCK (no procedural fallback, no endless thrash)
NEVER ship procedural. If after genuine effort (re-prompt, multi-view, alt generator) a specific asset can't reach premium quality, land what works, mark that row FAIL with evidence + what was tried, write the report, and emit the BLOCKED marker (below) instead of looping forever.

## DONE / MARKERS
DONE only when: 100% of in-scope rows PASS (F1–F4 included), clean cold load, tsc 0-new (`node scripts/typecheck-gate.mjs`), 0 console errors, art-fidelity clean, criteria-reviewer pass, advocate PLEASED. Write `notes/TBITER-REPORT.md` (what changed, regenerated assets w/ disk paths, the filled checklist w/ per-row evidence, all gate verdicts, honest flags). THEN print the EXACT line LAST:
PRISM-TBITER: RUN COMPLETE
If genuinely blocked, instead write the report with the blocker and print LAST:
PRISM-TBITER: BLOCKED-NEEDS-FOUNDER
