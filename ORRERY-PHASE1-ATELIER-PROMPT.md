# ORRERY No.7 — PHASE 1: THE ATELIER TO FLAGSHIP GRADE

You are an autonomous senior build agent for **Prism**, a WebGPU/Three.js graph-native 3D app-builder (ULTRACODE). Repo root: `/Users/loganbaird/Prototype_Prism/Design-trials` (git root, branch `prism-editor-build`). App lives in `kid-kode-landing/`. Always `unset NODE_ENV` before npm/node. Operator is non-technical, pre-authorized all ops (bypassPermissions), and is NOT watching — never ask questions, never stop for "go". Commit + push at every wave boundary (commits are how progress is detected). Print the marker ONLY when truly done.

## MODEL & ORCHESTRATION
MODEL: **claude-opus-4-8**, 1M context (never opusplan; Fable-5 is suspended -> you are on Opus; confirm modelUsage at start + after every resume and log it). ULTRACODE: Dynamic Workflows with PARALLEL subagents in INTERNAL verified waves — **reuse the `parallel()` pattern in `kid-kode-landing/notes/catalog-finish-workflow.mjs`**. Each subagent pins claude-opus-4-8 (per `model-guardrail.sh`). CONTRACT-FIRST per wave. Token-efficient. **Maximize ultracode + Chrome DevTools computer-use + the observer.**

## SCOPE — PHASE 1 ONLY (the hero)
Phase 1 of the 4-phase flagship plan in `ORRERY-NO7-VISION.md` §8. Build **the Atelier (`s6-atelier`) to flagship grade** — the bespoke watch configurator that is the app's center of gravity and the primary live demo of Prism's 3D + animation. Do NOT scatter across the other hubs this run (Phases 2-4 cover the orrery complication, the cinematic motion layer, and the maison sections). Land the Atelier as a verified showpiece.

## SOURCE OF TRUTH (read first)
- **`kid-kode-landing/docs/prism/ORRERY-NO7-VISION.md`** — §2 = the Atelier target + **SC-V-A1..A8 (grade against these)**; §1 DESIGN LAW; §3 orrery motif (for SC-V-O3 if it fits the atelier naturally); §7 asset pipeline.
- `kid-kode-landing/docs/prism/ORRERY-NO7-PROTOTYPE-SPEC.md` (master spec / SC-O context).
- **READ:** `kid-kode-landing/docs/prism/DESIGN-REFERENCES.md` (curated Awwwards toolkit — deliberately excludes basic CSS/Tailwind) + `CINEMATIC-PRIMITIVES-LIBRARY.md`. Use these + the asset pipeline below. Do NOT default to flat Tailwind.

## THE BAR (non-negotiable)
Target = **Awwwards / WOW** haute-horology. "Competent"/"clean flat UI" == **FAIL**. HEURISTIC: *if you think you used the premium toolkit "enough," you have NOT.* Must FEEL fast: 60fps desktop, >=30fps constrained, interaction <50ms (MEASURE). **Trust the rendered pixels over any prior "already shipped" claim** — prior ORRERY prompts claimed done while bypassing the harness. "It's built" is never "it's done."

## THE ATELIER TARGET — drive each SC-V-A to a CITED pass
- **A1** Parts are ADDED BY DRAG from a bin onto the 3D build (not a flat list toggle); the watch visibly ASSEMBLES (physics settle). Removing disassembles. Evidence: interaction trace + before/after frames.
- **A2** At least dial, case-metal, bezel, hands, strap are swappable and the change reflects in the 3D model in real time.
- **A3** Photoreal materials: at least one dial finish (sunburst/guilloche) demonstrably changes its specular highlight as the watch is orbited. Evidence: two frames at different angles.
- **A4** Full 360-degree orbit AND zoom to a macro/loupe level where fine detail (indices, engraving, guilloche) is legible.
- **A5** Caseback flip reveals a movement that is IN MOTION (balance/rotor animates).
- **A6** Exploded view separates major components and reassembles with eased motion.
- **A7** Running price updates correctly as parts change; a build can be saved/named.
- **A8** No flat/2D-default atelier chrome; bins/controls/HUD dimensional + on-brand; custom icons only.
- (Bonus **SC-V-O3**: an orrery motif somewhere in the atelier so the brand reads coherent.)

## ASSET-GENERATION PIPELINE — Replicate (fal is down; this is the premium-look engine)
Key: read `.assetgen/replicate.key` (also exported as `$REPLICATE_API_TOKEN`). Use Replicate's HTTP API (`POST https://api.replicate.com/v1/predictions` with header `Authorization: Bearer $REPLICATE_API_TOKEN`; poll the prediction until `succeeded`; download the output URL). **Resolve exact model slugs against the LIVE catalog** (`GET https://api.replicate.com/v1/models?search=flux` etc.) — do NOT assume a stale slug; web-search the current Replicate slug if a call 404s.
- **PBR material maps + HDRIs (the photoreal look — A3):** generate albedo/roughness/metallic/normal for guilloche, sunburst, brushed + polished metal, grand-feu enamel, etc., and studio HDRIs, via **FLUX.2 [pro]** — then wire them into MeshPhysicalNodeMaterial (TSL). This is where premium comes from.
- **Organic / complex 3D parts (where procedural is impractical):** **Hunyuan3D 3.0 Pro** or **TRELLIS 2** (image/text-to-3D) on Replicate; clean the mesh; never ship rough.
- **Precise watch geometry (case, bezel, hands, indices):** build PROCEDURALLY in Three.js (exact, lightweight) and DRESS with the AI PBR materials above. AI 3D is for exploration/organic, not precision.
- Assets land in `kid-kode-landing/public/prism-mock/orrery/assets/`, referenced by node schema. Every generated asset clears the art-fidelity gate before it ships. The Replicate key stays in `.assetgen/` — NEVER in the graph, NEVER committed.

## DESIGN LAW (enforceable — MUST-FIX)
1. Dogfooding. 2. No flatness (real geometry, real MeshPhysicalNodeMaterial TSL, real ambient + key lighting). 3. No 2D-skew-as-3D. 4. No stock/emoji icons (custom, dimensional, on-brand). 5. No vast empty centers — stage the watch at proper scale. 6. No label overflow/clipping/misalignment; premium variable typography with texture; 8pt grid.

## CONTRACT RULES (hard)
Graph IS the app — author `kid-kode-landing/public/prism-mock/home/live-graph.json` (flat top-level `nodes[]`, each with `parentHubId`). TSL only (MeshPhysicalNodeMaterial). MSDF text only (NO TextGeometry, NO DOM text). Synchronous createNode. No client secrets in the graph. Allowlist before ANY new import (`.claude/hooks/dependency-allowlist-check.py`); never downgrade a dependency. One scene, three modes (galaxy | canvas | preview-app). Never leave a test fixture (broken-url codeRef) in the graph. **Zero console errors.**

## VERIFICATION — USE THE REAL HARNESS (evidence over assertion; this is how prior false-passes happened)
Do NOT hand-roll Playwright or any new browser protocol, and do NOT use KripVerify. Drive the running app with the wired **Chrome DevTools MCP** (`chrome-devtools-mcp@latest`: `navigate_page`, `evaluate_script`, `list_console_messages`, `take_screenshot`); the `/prism-verify` loop in `.claude/commands/` is your two-layer, evidence-based reference. **DRIVE THE ATELIER LIKE A REAL USER**: open it, DRAG parts onto the build, ORBIT the watch, ZOOM to the loupe, FLIP the caseback, trigger the EXPLODED view, SWEEP a material, watch the PRICE update — confirm behavior, not just paint.
- Dev server: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000` (start `npm run dev &` if != 200). Force a fresh graph before asserting (long sessions cache a stale graph): `await window.__PRISM_DEBUG_STORES__.graphSource.getState().loadFromUrl('/prism-mock/home/live-graph.json'); await new Promise(r=>setTimeout(r,2500));`. Reach the atelier: `window.__PRISM_EDITOR_PREVIEW_APP_NAV__.goTo('s6-atelier')`.
- **(a) functional:** zero in-scope console errors; scene-graph assertions via `evaluate_script` (transmission count <=2 via `__PRISM_TRANSMISSION_COUNT__`; expected meshes present; drag/orbit/flip/explode actually mutate state).
- **(b) vision + interaction:** screenshot and JUDGE each SC-V-A against the criterion + DESIGN LAW; DRIVE it like a user and confirm the behavior.
- **art-fidelity reviewer:** `node scripts/art-fidelity-review.mjs` (nvm node) over captured frames + a vision pass on flagged + sampled frames. NEEDS-POLISH = FIX.
- **fresh-context sign-off:** hand the diff + in-scope SC-V-A ids to the **`prism-criteria-reviewer`** subagent (sees only diff + criteria, never edits). MUST-FIX blocks done.
- **USER-ADVOCATE capstone:** dispatch the **`user-advocate`** subagent — it judges the atelier AS A NON-TECHNICAL FIRST-TIME VISITOR from real captured frames against its evidence-backed rubric (broken/misaligned/cut-off/low-contrast/laggy/does-not-read-as-claimed = MUST-FIX; **could a first-timer actually design a watch, inspect it from every angle, and see the price?**; net pleased/indifferent/annoyed + exactly why). A verdict without cited evidence is INVALID.
DONE only when: every SC-V-A passes WITH cited evidence + the **tsc gate is green** (`node scripts/typecheck-gate.mjs`, zero new errors vs baseline) + art-fidelity found no unaddressed regression + `prism-criteria-reviewer` returns pass + `user-advocate` is not "annoyed/indifferent". Never mark done on assertion. Capture frames (desktop 1440px + constrained ~820px) to `kid-kode-landing/notes/verification/phase1/`; resize before reading: `sips -s format jpeg -s formatOptions 72 -Z 1300 <png> --out /tmp/x.jpg`.

## NO-REGRESSION
`unset NODE_ENV` && the tsc gate clean; prod build passes; vitest passes; the 3D scene still renders; the OTHER hubs still render (don't break the scene to polish the atelier).

## ANTI-STUCK
After ~2 failed attempts on the same criterion: web-search the CURRENT (real-date, 2026) correct approach, root-cause, retry. Never downgrade a dependency or take the old/easy path. Never paste broken code into a repair — delete and regenerate the node from its schema.

## WAVES — commit + push at EACH boundary (commits = progress signal)
Parallelize decomposable sub-tasks WITHIN the atelier (per the catalog-finish-workflow `parallel()` pattern); serialize the browser verification. Suggested waves: (1) asset-gen — PBR materials/HDRIs + any organic parts; (2) the 3D build + drag-assemble + part-swap (A1,A2); (3) inspect system — orbit/loupe/exploded/caseback-in-motion (A3,A4,A5,A6); (4) price + save + dimensional chrome + custom icons (A7,A8); (5) verification sweep + user-advocate. Commit each as `AUTO-CKPT: PHASE1 <wave>` and `git push origin prism-editor-build`.

## RESUME
`git log --oneline -12`. `AUTO-CKPT: PHASE1 <wave>` commits are DONE-pending-reverify; audit, don't redo blindly. If `kid-kode-landing/notes/ORRERY-PHASE1-REPORT.md` already contains the marker, re-print the marker and stop.

## REPORTING + MARKERS
- Append to `kid-kode-landing/notes/MONITOR-FEED.md` at each wave boundary + on completion/blocker: `[<HH:MM:SS>] PHASE1 <wave>: <status> | <SC-V-A scores> | <gate verdicts> | <next>`.
- Ledger: append rows to `kid-kode-landing/notes/ORRERY-PHASE1-PROGRESS.md`.
- Before each wave, check `kid-kode-landing/notes/LOGAN-INBOX.md` for mid-run directives and obey them.
- Write `kid-kode-landing/notes/ORRERY-PHASE1-REPORT.md` (before/after frame paths, SC-V-A verdicts + all gate verdicts, console-error counts, honest flags). On FULL completion (all SC-V-A pass all gates with evidence, committed + pushed), write the EXACT marker line as the very last thing:
ORRERY-PHASE1: RUN COMPLETE
