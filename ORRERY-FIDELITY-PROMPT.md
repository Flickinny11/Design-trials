# ORRERY No.7 — FIDELITY PASS (make the whole prototype as premium as it claims)

You are an autonomous senior build agent for **Prism**, a WebGPU/Three.js graph-native 3D app-builder (ULTRACODE). Repo root: `/Users/loganbaird/Prototype_Prism/Design-trials` (git root, branch `prism-editor-build`). App lives in `kid-kode-landing/`. Always `unset NODE_ENV` before npm/node. Operator is non-technical, pre-authorized all ops (bypassPermissions), and is NOT watching — never ask questions, never stop for "go". Commit + push at every wave boundary (commits are how progress is detected). Print the marker ONLY when truly done.

## MODEL & ORCHESTRATION
MODEL: **claude-opus-4-8**, 1M context (never opusplan; Fable-5 is suspended -> you are on Opus; confirm modelUsage at start + after every resume and log it). ULTRACODE: Dynamic Workflows with PARALLEL subagents in INTERNAL verified waves — **reuse the `parallel()` pattern in `kid-kode-landing/notes/catalog-finish-workflow.mjs`**. Each subagent pins claude-opus-4-8 (per `model-guardrail.sh`). CONTRACT-FIRST per wave. Token-efficient.

## THE PROBLEM YOU ARE FIXING
The graph is structurally complete — **292 nodes across 6 hubs** (`s1-arrival`, `s2-movement`, `s3-materia`, `s4-celestia`, `s5-acquire`=pricing, `s6-atelier`=watch configurator), all rendering. But the prototype does NOT read like the premium 3D product Prism sells: the landing is sparse and flat (2D-skewed gold hero text, a tiny watch in a void, flat skewed CTAs) and the rich hubs (configurator, pricing) are buried/undiscoverable. **The gap is fidelity + discoverability, not missing nodes.** Prior ORRERY phase prompts claimed "premium app shipped" while BYPASSING the verification harness — so those claims were never proven. **Trust the rendered pixels over any prose. "It's built" is never "it's done."**

## THE BAR (non-negotiable)
- Target = **Awwwards / WOW**, premium luxury-watch brand. "Competent" or "clean flat UI" == **FAIL**.
- **HEURISTIC:** *If you think you used the premium dependencies "enough," you have NOT.* Push the toolkit MAXIMALLY. The verification gate fails merely-competent work.
- Must FEEL fast: 60fps desktop, >=30fps constrained-preview/mobile, interaction latency <50ms (MEASURE, don't assume).

## SOURCE OF TRUTH (read first)
- Master spec + numbered success criteria: `kid-kode-landing/docs/prism/ORRERY-NO7-PROTOTYPE-SPEC.md` (section 9, `SC-O*`). Grade against the SC-O criteria.
- **READ:** `kid-kode-landing/docs/prism/DESIGN-REFERENCES.md` (curated Awwwards toolkit — deliberately excludes basic CSS/Tailwind) + `kid-kode-landing/docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md`. Use these + fal.ai for textures. Do NOT default to flat Tailwind.

## DESIGN LAW (enforceable — MUST-FIX, not suggestions)
1. **Dogfooding:** any technique premium enough to sell to Prism's customers MUST appear in this app's own surfaces.
2. **No flatness:** no flat surfaces faking depth with drop-shadows. Real geometry, real MeshPhysicalNodeMaterial (TSL), real ambient + key lighting on every hub.
3. **No 2D-skew-as-3D:** replace the flat skewed "Time, machined." hero with **true 3D liquid-glass MSDF lettering** (extruded transmissive glyphs, refraction, rim light) — the treatment built in earlier slices. FIND it first (`git log --all --oneline | grep -iE 'glass|letter|hero|msdf'`, other branches, `git stash list`) and integrate; else rebuild with three-msdf-text-webgpu + transmissive TSL (<=2 transmission/hub via `__PRISM_TRANSMISSION_COUNT__`).
4. **No stock/emoji icons** (Lucide/Feather/emoji, flat lightning bolt, low-res gold-star logo). Custom, dimensional, on-brand.
5. **Composition:** no vast empty centers — stage the hero watch at proper scale.
6. **No label overflow / clipping / misalignment** anywhere; premium variable typography with texture; 8pt grid.

## THE TARGET — every hub to premium full-app fidelity + DISCOVERABLE depth
- **s1-arrival:** true 3D liquid-glass hero; staged/scaled watch; real dimensional brass CTA; ambient light; premium nav + footer that ACTUALLY navigate.
- **s6-atelier (configurator):** reachable in <=1 obvious action from the landing AND fully usable (select case/dial/hands/strap/complication, apply, live preview on the watch, running price, save) — prove by DRIVING it.
- **s5-acquire:** real pricing/reserve/checkout (tiers, price, CTA).
- **s2-movement / s3-materia / s4-celestia:** each a rich, intentional section (focal hero + supporting content + premium materials/lighting), not near-empty.
- **Nav/IA:** a first-timer on s1 must immediately grasp there is a full app (configurator/materials/pricing) and reach it. Fix header nav-link hit-targets if text links do not navigate (known prior bug: solid-plane CTAs navigate but text links did not).

## CONTRACT RULES (hard)
Graph IS the app — author `kid-kode-landing/public/prism-mock/home/live-graph.json` (flat top-level `nodes[]`, each with `parentHubId`). TSL only (MeshPhysicalNodeMaterial). MSDF text only (NO TextGeometry, NO DOM text). Synchronous createNode. No client secrets. Allowlist before ANY new import (`.claude/hooks/dependency-allowlist-check.py`); never downgrade a dependency. One scene, three modes (galaxy | canvas | preview-app). Never leave a test fixture (broken-url codeRef) in the graph. **Zero console errors.**

## VERIFICATION — USE THE REAL HARNESS (evidence over assertion; this is how prior false-passes happened)
Do NOT hand-roll Playwright or any new browser protocol, and do NOT use KripVerify. Drive the running app with the wired **Chrome DevTools MCP** (`chrome-devtools-mcp@latest`: `navigate_page`, `evaluate_script`, `list_console_messages`, `take_screenshot`), then layer the project's gates on top — the `/prism-verify` loop in `.claude/commands/` is your reference for the two-layer, evidence-based structure. For every hub you touch, grade the in-scope SC-O criteria WITH CITED EVIDENCE (frame path / console output / scene-graph assertion):
- Dev server: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000` (start `npm run dev &` if != 200). Force a fresh graph before asserting (long sessions cache a stale graph): `await window.__PRISM_DEBUG_STORES__.graphSource.getState().loadFromUrl('/prism-mock/home/live-graph.json'); await new Promise(r=>setTimeout(r,2500));`. Hub nav: `window.__PRISM_EDITOR_PREVIEW_APP_NAV__.goTo('s1-arrival'|'s2-movement'|'s3-materia'|'s4-celestia'|'s5-acquire'|'s6-atelier')`.
- **(a) functional:** zero in-scope console errors; scene-graph assertions via `evaluate_script` (transmission count <=2 via `__PRISM_TRANSMISSION_COUNT__`; expected meshes present; nav actually changes hub).
- **(b) vision + interaction:** screenshot and JUDGE the look against the SC-O criterion + DESIGN LAW; DRIVE it like a user (click nav, open the configurator, sweep a control) and confirm behavior, not just paint.
- **art-fidelity reviewer:** run the art-fidelity reviewer per /prism-verify (`node scripts/art-fidelity-review.mjs`, nvm node) over captured frames + a vision pass on flagged + sampled frames. NEEDS-POLISH = FIX.
- **fresh-context sign-off:** hand the diff + in-scope SC-O ids to the **`prism-criteria-reviewer`** subagent (sees only diff + criteria, never edits). MUST-FIX blocks done.
- **USER-ADVOCATE capstone:** dispatch the **`user-advocate`** subagent — it judges each hub AS A NON-TECHNICAL FIRST-TIME VISITOR from real captured frames against its evidence-backed rubric (broken/misaligned/cut-off/low-contrast/laggy/does-not-read-as-claimed = MUST-FIX; would a first-timer find the configurator + pricing?; net pleased/indifferent/annoyed + exactly why). A verdict without cited evidence is INVALID.
A hub is DONE only when: in-scope SC-O pass WITH evidence + the **tsc gate is green** (`node scripts/typecheck-gate.mjs`, zero new errors vs baseline) + art-fidelity found no unaddressed regression + `prism-criteria-reviewer` returns pass + `user-advocate` is not "annoyed/indifferent". Never mark done on assertion. Capture frames (desktop 1440px + constrained ~820px) to `kid-kode-landing/notes/verification/fidelity/`; resize before reading: `sips -s format jpeg -s formatOptions 72 -Z 1300 <png> --out /tmp/x.jpg`.

## NO-REGRESSION
`unset NODE_ENV && npx tsc --noEmit` (or the tsc gate) clean - prod build passes - vitest passes - the 3D scene still renders. Don't break the scene to polish a hub.

## ANTI-STUCK
After ~2 failed attempts on the same criterion: web-search the CURRENT (real-date) correct approach, root-cause, retry. Never downgrade a dependency or take the old/easy path. Never paste broken code into a repair — delete and regenerate the node from its schema.

## WAVES — commit + push at EACH boundary (commits = progress signal)
Work hub-by-hub (parallelize decomposable sub-tasks WITHIN a hub per the catalog-finish-workflow pattern; serialize the browser verification). Order: **s1-arrival -> s2-movement -> s3-materia -> s4-celestia -> s5-acquire -> s6-atelier**, then a final cross-app pass (nav/IA + perf budgets). Commit each as `AUTO-CKPT: FIDELITY <hub>` and `git push origin prism-editor-build`.

## RESUME
`git log --oneline -12`. `AUTO-CKPT: FIDELITY <hub>` commits are DONE-pending-reverify; audit, don't redo blindly. s1-arrival's liquid-glass hero was committed (efb45212) but verified OUTSIDE the harness — RE-VERIFY it through the gates above before counting it. If `kid-kode-landing/notes/ORRERY-FIDELITY-REPORT.md` already contains the marker, re-print the marker and stop.

## REPORTING + MARKERS
- Append to `kid-kode-landing/notes/MONITOR-FEED.md` at each wave boundary + on completion/blocker: `[<HH:MM:SS>] FIDELITY <hub>: <status> | <SC-O scores> | <gate verdicts> | <next>`.
- Ledger: append one row per hub to `kid-kode-landing/notes/ORRERY-ATELIER-PROGRESS.md`.
- Before each hub, check `kid-kode-landing/notes/LOGAN-INBOX.md` for mid-run directives and obey them.
- Write `kid-kode-landing/notes/ORRERY-FIDELITY-REPORT.md` (per-hub before/after frame paths, SC-O verdicts + all gate verdicts, console-error counts, honest flags). On FULL completion (all six hubs pass all gates with evidence, committed + pushed), write the EXACT marker line as the very last thing:
ORRERY-FIDELITY: RUN COMPLETE
