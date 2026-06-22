# ORRERY No.7 — PHASE 2: FULL PHOTOREALISTIC 3D SCENE (Tripo parts + reintegrate the premium primitives)

You are an autonomous senior build agent for **Prism** (WebGPU/Three.js graph-native 3D app-builder, ULTRACODE). Repo root: `/Users/loganbaird/Prototype_Prism/Design-trials` (git root, branch `prism-editor-build`). App in `kid-kode-landing/`. Always `unset NODE_ENV` before npm/node. Operator is non-technical, pre-authorized (bypassPermissions), NOT watching — never ask, never stop for "go". Commit + push at every wave boundary (commits = progress signal). Print the marker ONLY when truly done.

## MODEL & ORCHESTRATION
MODEL **claude-opus-4-8**, 1M ctx (never opusplan; confirm modelUsage at start + after each resume, log it). ULTRACODE: Dynamic Workflows, PARALLEL subagents in INTERNAL verified waves — reuse the `parallel()` pattern in `kid-kode-landing/notes/catalog-finish-workflow.mjs`; each subagent pins claude-opus-4-8. CONTRACT-FIRST per wave. Maximize ultracode + Chrome DevTools computer-use + the observer.

## SCOPE — PHASE 2
Phase 1 landed the Atelier FUNCTIONALLY (8/8 SC-V-A pass). Phase 2 elevates the WHOLE prototype app into a full photorealistic 3D scene that SMOKES Slider Revolution, and closes Phase 1's two gaps:
1. **The watch case + parts are still procedural-PBR — REGENERATE them as real photoreal GLBs** via Tripo (now FUNDED) / Replicate Hunyuan3D, best-per-object, using Tripo SEGMENTATION for swappable parts.
2. **The premium primitive library this repo ALREADY has is under-used — wire it in HEAVILY** across the scene.
Plus: make the scene's elements (headers/footers/nav/containers/sections) photoreal 3D objects where the style benefits; add the showpiece motion + the orrery complication.

## THE THREE LAWS (the v2 mandate — enforceable, MUST-FIX on violation)
**LAW 1 — the whole scene is photorealistic 3D.** MOST elements (headers, footers, nav, boxes, containers, sections, the watch + parts) are GENERATED photoreal 3D objects, lit by the advanced lighting + animated by the 3D animation deps. Menus/fine text may be premium 3D-styled UI but NEVER flat. One coherent R3F scene; real depth/edges/perspective/shadows; elements interact. Claude-design, built for 3D.
**LAW 2 — generate, don't hand-build.** Spend is NO OBJECT. Do NOT model objects as procedural Three.js geometry. 3D via best-per-object Tripo/Hunyuan (below); textures/HDRIs via Replicate FLUX.2; motion via Replicate video.
**LAW 3 — OVER-use design_references.md + REUSE the repo's primitives + SMOKE the competition.** Read `kid-kode-landing/docs/prism/DESIGN-REFERENCES.md` (1066 lines) + `CINEMATIC-PRIMITIVES-LIBRARY.md` FULLY. **Nothing flat, EVER. Tailwind-style = MUST-FIX.** Photoreal volumetric depth, ambient refraction, photoreal materials, smooth gradients, stylish palette, interacting elements (gravity/liquid/physics/shadows), morphing 3D transitions, a living photoreal 3D background. We must beat the best Slider Revolution templates (morphing through-page 3D transitions, interactive photoreal moving 3D backgrounds, beautiful page transitions).

## TRIPO IS FUNDED — generate the parts (best model PER object, latest versions)
Keys in `.assetgen/` (`$TRIPO_API_KEY`=.assetgen/tripo.key, `$REPLICATE_API_TOKEN`=.assetgen/replicate.key). For EACH 3D object pick the BEST model; ALWAYS use the most recent version (web-search the current slug/version before generating if unsure):
- **Tripo official API** — `GET https://api.tripo3d.ai/v2/openapi/user/balance` (it is funded ~2500); `POST https://api.tripo3d.ai/v2/openapi/task` (Bearer; `{"type":"text_to_model"|"image_to_model","prompt":...,"model_version":"v3.1"}` — use **v3.1**/**P1**; poll `GET /v2/openapi/task/{id}` until success → GLB). Tripo gives PBR + **auto-rig + animation + part SEGMENTATION** — use segmentation to split a generated watch into swappable case/dial/bezel/hands/crown/movement.
- **Replicate Hunyuan3D 3.0 Pro / TRELLIS 2** — `POST https://api.replicate.com/v1/predictions` (Bearer; resolve live slug).
- **The case earlier bloated** because TRELLIS got a SINGLE image (depth hallucination) → it fell back to procedural-turned geometry. FIX: use **multi-view input (front/side/top)** and/or **Tripo image-to-3D + segmentation** to produce clean photoreal GLB parts. REGENERATE case + bezel + crown + lugs as real GLBs (P2-1).
- Assets → `kid-kode-landing/public/prism-mock/orrery/` (`assets/`+`meshes/`), referenced by node schema. Keys never committed. Every asset clears the art-fidelity gate.

## REINTEGRATE THE PREMIUM PRIMITIVES (they EXIST in src/ — they are under-used; godray/curtain/rapier/caustic/lenis are 0-referenced in the ORRERY graph)
Wire these existing, committed modules into the ORRERY scene HEAVILY:
- `src/components/editor/graph/backgrounds/VolumetricNebulaLayer.tsx` + `src/lib/prism/animatable/primitives/nebula.ts` → the LIVING photoreal moving 3D background behind the whole scene (P2-2).
- `src/lib/prism/animatable/primitives/glass-refraction.ts` + `src/components/editor/design-system/RefractionDefs.tsx` + `runtime/shared/transmission-budget.ts` → refractive crystal + glass containers (push past the current 196 refs — every container reads as real glass).
- `src/lib/prism/animatable/primitives/godray.ts` → volumetric god-rays / light shafts.
- `src/components/editor/overlays/MagneticCursor.tsx` + `animatable/primitives/magnetic*.ts` → magnetic cursor + magnetic pull on chrome.
- `src/lib/prism/animatable/primitives/curtain-wave.ts` → Curtains-style morphing page/hub transitions (P2-4).
- `volumetric-cone.ts`, `heat-haze-refract.ts`, `cta-magnetic-pedestal.ts`, and Rapier physics (gravity/liquid/snap) for the drag-assemble settle + material morph (P2-5).
Reference the verified history implementations if helpful (`git show <hash>:<path>`): volumetric nebula `0358eea2`/`6e9d2505`, transmission glass `8ac4149b`/`f64582e3`/`da1d1366`, Rapier `f320f20c`/`d0dc7ab3`/`981aeaad`, magnetic+GSAP+Lenis `d7b4cdb1`/`54f7a05d`, IBL PBR+Bloom `80f0e708`.


## TARGET CRITERIA — drive each to a CITED pass
New Phase-2 criteria:
- **P2-1** The watch case + >=2 other hard parts (bezel/crown/lugs) are REAL generated GLBs (Tripo/Hunyuan), NOT procedural geometry. Evidence: the GLB files on disk + the in-scene render.
- **P2-2** The scene has a LIVING photoreal 3D background (volumetric nebula) moving behind the content.
- **P2-3** >=3 chrome elements (header/footer/nav/container) read as photoreal 3D objects or richly dimensional lit surfaces (transmission/refraction/godray) — NOT flat panels.
- **P2-4** At least one MORPHING 3D transition between hubs/states (Curtains / through-page), not a cut.
- **P2-5** Rapier physics visible in the drag-assemble settle and/or a material morph.
Plus from `kid-kode-landing/docs/prism/ORRERY-NO7-VISION.md`: showpieces **SC-V-FX1..FX4** (eased hub transitions, living ambient 3D layer, premium micro-response, day/night lume), nav **SC-V-NAV1..NAV3** (on-theme dimensional nav, persistent build HUD, eased transitions), the orrery complication **SC-V-O1..O3** (interactive 3D solar-system dial — spin time → planets orbit). Keep ALL Phase-1 functionality intact (drag-assemble, swap, orbit/loupe, caseback/exploded, price, save — SC-V-A1..A8 must NOT regress).

## VERIFICATION — the real harness + a COLD-LOAD GATE (evidence over assertion)
Do NOT hand-roll Playwright, do NOT use KripVerify. Drive the running app with the wired **Chrome DevTools MCP** (`navigate_page`, `evaluate_script`, `list_console_messages`, `take_screenshot`); `/prism-verify` in `.claude/commands/` is your two-layer reference. DRIVE THE SCENE LIKE A REAL USER.
**NEW — COLD-LOAD GATE (a stale/desynced dev server 404'd every chunk and the force-load masked it; never again):**
1. At run START and as the FINAL gate, restart the dev server fresh: `cd kid-kode-landing && lsof -ti tcp:3000 | xargs kill -9 2>/dev/null; rm -rf .next; (unset NODE_ENV; nohup npm run dev > /tmp/dev.log 2>&1 &)` then wait for `GET / 200`.
2. Do a PURE COLD LOAD (NO force-load eval first): navigate to http://localhost:3000, wait ~10s, and **FAIL if** any `_next` chunk 404s, OR a pageerror fires, OR no `<canvas>` renders, OR it stays on the "INITIALIZING PRISM RUNTIME" loader. Only AFTER a clean cold load, proceed to the force-load + interaction checks.
- (a) functional: zero in-scope console errors; scene-graph assertions via `evaluate_script` (transmission count <=2 via `__PRISM_TRANSMISSION_COUNT__`; expected meshes present; generated GLBs loaded; interactions mutate state). Force-fresh graph for deep checks: `await window.__PRISM_DEBUG_STORES__.graphSource.getState().loadFromUrl('/prism-mock/home/live-graph.json'); await new Promise(r=>setTimeout(r,2500));` then `window.__PRISM_EDITOR_PREVIEW_APP_NAV__.goTo('s6-atelier')`.
- (b) vision + interaction: screenshot + JUDGE each P2/SC-V criterion against the bar + DESIGN LAW; drive it.
- art-fidelity reviewer: `node scripts/art-fidelity-review.mjs` over captured frames + a vision pass. NEEDS-POLISH = FIX.
- fresh-context sign-off: hand diff + in-scope criteria ids to the **`prism-criteria-reviewer`** subagent. MUST-FIX blocks done.
- USER-ADVOCATE capstone: dispatch the **`user-advocate`** subagent — judges AS A NON-TECHNICAL FIRST-TIMER from real frames (broken/misaligned/flat/laggy/does-not-read-as-claimed = MUST-FIX; **does it read as a premium photoreal 3D experience that beats Slider Revolution?**; pleased/indifferent/annoyed + why). Verdict without cited evidence is INVALID.
DONE only when: the P2 criteria + targeted SC-V criteria pass WITH cited evidence + Phase-1 SC-V-A not regressed + tsc gate green (`node scripts/typecheck-gate.mjs`, 0 new) + art-fidelity clean + criteria-reviewer pass + advocate not annoyed + **a CLEAN COLD LOAD verified**. Capture frames (1440px + ~820px) to `kid-kode-landing/notes/verification/phase2/`; resize before reading: `sips -s format jpeg -s formatOptions 72 -Z 1300 <png> --out /tmp/x.jpg`.

## CONTRACT RULES (hard)
Graph IS the app — author `kid-kode-landing/public/prism-mock/home/live-graph.json` (flat `nodes[]`, each `parentHubId`). TSL only (MeshPhysicalNodeMaterial). MSDF text only (NO TextGeometry/DOM text). Synchronous createNode. Allowlist before ANY new import (`.claude/hooks/dependency-allowlist-check.py`); never downgrade. One scene, three modes. No test fixtures in the graph. Zero console errors. Keys stay in `.assetgen/`, never in the graph or commits.

## NO-REGRESSION / ANTI-STUCK
`unset NODE_ENV` && tsc gate clean; prod build passes; vitest passes; the scene + all 6 hubs render; Phase-1 atelier functionality intact. After ~2 failed attempts on a criterion: web-search the CURRENT (2026) approach, root-cause, retry. Never downgrade a dependency; never paste broken code into a repair — delete + regenerate from schema.

## WAVES — commit + push at EACH boundary
Parallelize WITHIN a wave (catalog-finish `parallel()`); serialize browser verification. Suggested: (1) regenerate watch case+parts via Tripo (P2-1); (2) volumetric nebula background + godrays + refraction across the scene (P2-2,P2-3); (3) photoreal-3D chrome elements + magnetic cursor + Rapier physics (P2-3,P2-5); (4) morphing hub transitions (Curtains) + the orrery complication (P2-4, SC-V-FX/O); (5) full verification sweep incl the COLD-LOAD GATE + user-advocate. Commit each `AUTO-CKPT: PHASE2 <wave>` + `git push origin prism-editor-build`.

## RESUME / REPORTING + MARKER
`git log --oneline -12`; `AUTO-CKPT: PHASE2 <wave>` commits are DONE-pending-reverify (audit, don't redo blindly). If `kid-kode-landing/notes/ORRERY-PHASE2-REPORT.md` already has the marker, re-print it + stop. BEFORE each wave check `kid-kode-landing/notes/LOGAN-INBOX.md` and obey it. Append wave status to `kid-kode-landing/notes/MONITOR-FEED.md` + rows to `kid-kode-landing/notes/ORRERY-PHASE2-PROGRESS.md`. Write `kid-kode-landing/notes/ORRERY-PHASE2-REPORT.md` (before/after frames, P2 + SC-V verdicts, all gate verdicts incl COLD-LOAD, console-error counts, honest flags). On FULL completion (all criteria pass all gates incl clean cold load, committed + pushed), write the EXACT marker line LAST:
ORRERY-PHASE2: RUN COMPLETE
