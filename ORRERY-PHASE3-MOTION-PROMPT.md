# ORRERY No.7 — PHASE 3: THE CINEMATIC MOTION LAYER (true in-scene transitions + showpiece moments)

You are an autonomous senior build agent for **Prism** (WebGPU/Three.js graph-native 3D app-builder, ULTRACODE). Repo root: `/Users/loganbaird/Prototype_Prism/Design-trials` (git root, branch `prism-editor-build`). App in `kid-kode-landing/`. Always `unset NODE_ENV` before npm/node. Operator non-technical, pre-authorized (bypassPermissions), NOT watching — never ask, never stop for "go". Commit + push at every wave boundary. Print the marker ONLY when truly done.

## MODEL & ORCHESTRATION
MODEL **claude-opus-4-8**, 1M ctx (never opusplan; confirm modelUsage at start + after each resume, log it). ULTRACODE: Dynamic Workflows, PARALLEL subagents in INTERNAL verified waves — reuse `kid-kode-landing/notes/catalog-finish-workflow.mjs` `parallel()`; each subagent pins claude-opus-4-8. CONTRACT-FIRST. Maximize ultracode + Chrome DevTools computer-use + the observer.

## SCOPE — PHASE 3
Phases 1+2 are complete: the Atelier works (8/8 SC-V-A), the watch parts are real generated Tripo GLBs, the scene has a living volumetric nebula + godray + Rapier physics + magnetic cursor + the interactive 3D orrery complication. Phase 3 adds **the cinematic motion layer** that makes this beat the best Slider Revolution templates, and closes Phase 2's two honest flags. Keep ALL Phase 1+2 functionality + criteria intact (no regression).

## THE THREE LAWS (v2 mandate — enforceable, MUST-FIX)
**LAW 1** the whole scene is photorealistic 3D (generated objects, lit + animated; menus/text premium-3D-styled but NEVER flat; one coherent R3F scene with real depth). **LAW 2** generate, don't hand-build (best-per-object Tripo v3.1/P1 + Replicate Hunyuan3D/TRELLIS, latest versions; FLUX.2 textures; Replicate video). **LAW 3** OVER-use `kid-kode-landing/docs/prism/DESIGN-REFERENCES.md` (read fully) + `CINEMATIC-PRIMITIVES-LIBRARY.md` + REUSE the repo's primitives; SMOKE Slider Revolution. **Nothing flat, EVER. Tailwind-style = MUST-FIX.**

## PHASE 3 TARGETS — drive each to a CITED pass (capture MULTIPLE frames across each motion's timeline t=0/0.3/0.6/1.0, since transients are missed by single screenshots)
- **P3-1 Cinematic hub transitions (SC-V-FX1) + FIX Phase-2 flag #4.** The hub-to-hub transition must be a TRUE IN-3D-SCENE cinematic move — the camera flies/dollies THROUGH 3D space and/or the scene morphs IN WebGPU (e.g. `curtain-wave` plane in world space, a TSL screen-space dissolve, depth-of-field rack) — NOT a cut and NOT the DOM-overlay curtain that shipped in Phase 2. Root-cause why the Phase-2 in-canvas camera-followed plane didn't composite in the preview pipeline and FIX it (or use a working in-scene alternative). Evidence: frames across the transition showing real 3D camera/scene motion, AND proof it is in-canvas (not a DOM overlay over the canvas).
- **P3-2 Dramatic exploded view — FIX Phase-2 flag #3.** The exploded view must read UNMISTAKABLY as exploded: parts fly apart with clear separation + eased choreography (stagger), hold, and reassemble. Optionally thin leader lines/labels. Evidence: a frame at full explosion that obviously reads as exploded.
- **P3-3 Day/night + lume reveal (SC-V-FX4).** A control/transition dims the environment (HDRI intensity down, lights down) and the watch's lume (hands/indices) glows emissive — a genuine reveal. Evidence: day frame vs night frame showing the lume glow.
- **P3-4 Premium micro-response everywhere (SC-V-FX3).** Cursor-tracked specular highlight + magnetic pull + physics/press response across the interactive controls and the watch (extend what exists). Evidence: hover/press frames showing the response.
- **P3-5 Cinematic camera language.** Entrances/idles use eased cinematic camera moves (parallax, slow dolly, orbit drift) — the scene always feels alive and directed, never static. Evidence: idle motion + entrance frames.
Also keep verifying the carried SC-V-FX2 (living ambient layer — done) and the Phase-1/2 criteria do not regress.

## ASSETS + PRIMITIVES
Tripo is FUNDED (`GET https://api.tripo3d.ai/v2/openapi/user/balance`). Generate any NEW objects best-per-object (Tripo v3.1/P1 segmentation, or Replicate Hunyuan3D/TRELLIS; multi-view input for clean hard-surface). Textures via FLUX.2; any motion-plate via Replicate video. REUSE the repo's primitives for the motion: `src/lib/prism/animatable/primitives/curtain-wave.ts` (in-scene morph), `godray.ts`, `nebula.ts`, `heat-haze-refract.ts`, `volumetric-cone.ts`, Rapier physics, `MagneticCursor.tsx`. Keys stay in `.assetgen/`, never committed.


## VERIFICATION — the real harness + COLD-LOAD GATE (evidence over assertion)
Do NOT hand-roll Playwright, do NOT use KripVerify. Drive the running app with the wired **Chrome DevTools MCP** (`navigate_page`, `evaluate_script`, `list_console_messages`, `take_screenshot`); `/prism-verify` is your two-layer reference. DRIVE THE MOTION LIKE A USER: navigate between hubs and capture the transition across its timeline; trigger the exploded view; toggle day/night; hover/press controls.
**COLD-LOAD GATE (mandatory):** At run START and as the FINAL gate, restart the dev server fresh: `cd kid-kode-landing && lsof -ti tcp:3000 | xargs kill -9 2>/dev/null; rm -rf .next; (unset NODE_ENV; nohup npm run dev > /tmp/dev.log 2>&1 &)`, wait for `GET / 200`, then PURE COLD LOAD (no force-load eval first): navigate http://localhost:3000, wait ~10s, FAIL if any `_next` chunk 404s, a pageerror fires, no `<canvas>` renders, or it stays on the "INITIALIZING PRISM RUNTIME" loader. Only AFTER clean cold load, proceed.
**TRANSIENT CAPTURE:** transitions/explosions/lume are time-based — capture a SEQUENCE (t=0/0.3/0.6/1.0 via timed screenshots or driving the control then snapshotting) to prove the motion; a single frame is insufficient evidence for P3-1..3.
- (a) functional: zero in-scope console errors; assertions via `evaluate_script` (transmission <=2 via `__PRISM_TRANSMISSION_COUNT__`; the transition is in-canvas not a DOM overlay; lume emissive toggles; exploded offsets apply). Force-fresh graph for deep checks: `await window.__PRISM_DEBUG_STORES__.graphSource.getState().loadFromUrl('/prism-mock/home/live-graph.json'); await new Promise(r=>setTimeout(r,2500));` then `window.__PRISM_EDITOR_PREVIEW_APP_NAV__.goTo('s6-atelier')`.
- (b) vision + interaction: screenshot sequences + JUDGE each P3 criterion vs the bar + DESIGN LAW.
- art-fidelity reviewer: `node scripts/art-fidelity-review.mjs` over frames + vision pass. NEEDS-POLISH = FIX.
- fresh-context sign-off: hand diff + in-scope criteria ids to **`prism-criteria-reviewer`**. MUST-FIX blocks done.
- USER-ADVOCATE capstone: dispatch **`user-advocate`** — judges AS A NON-TECHNICAL FIRST-TIMER from real frames (**does the motion read as a cinematic premium 3D experience that beats Slider Revolution? do the transitions feel like moving THROUGH 3D space?**; pleased/indifferent/annoyed + why). Verdict without cited evidence is INVALID.
DONE only when: P3-1..5 pass WITH cited multi-frame evidence + Phase 1+2 criteria not regressed + tsc gate green (`node scripts/typecheck-gate.mjs`, 0 new) + art-fidelity clean + criteria-reviewer pass + advocate not annoyed + a CLEAN COLD LOAD verified. Frames → `kid-kode-landing/notes/verification/phase3/`; resize before reading: `sips -s format jpeg -s formatOptions 72 -Z 1300 <png> --out /tmp/x.jpg`.

## CONTRACT RULES (hard)
Graph IS the app — author `kid-kode-landing/public/prism-mock/home/live-graph.json` (flat `nodes[]`, each `parentHubId`). TSL only (MeshPhysicalNodeMaterial). MSDF text only (NO TextGeometry/DOM text). Synchronous createNode. Allowlist before ANY new import (`.claude/hooks/dependency-allowlist-check.py`); never downgrade. One scene, three modes. No test fixtures in graph. Zero console errors. Keys stay in `.assetgen/`.

## NO-REGRESSION / ANTI-STUCK
`unset NODE_ENV` && tsc gate clean; prod build passes; the scene + all 6 hubs render; Phase 1+2 functionality + criteria intact. After ~2 failed attempts on a criterion (esp. the in-scene transition compositing): web-search the CURRENT (2026) approach, root-cause, retry. Never downgrade a dependency; never paste broken code into a repair — delete + regenerate from schema.

## WAVES — commit + push at EACH boundary
Parallelize WITHIN a wave; serialize browser verification. Suggested: (1) true in-3D-scene cinematic hub transition (P3-1, fix flag #4); (2) dramatic exploded view (P3-2) + day/night lume reveal (P3-3); (3) premium micro-response + cinematic camera language (P3-4,P3-5); (4) full verification sweep incl COLD-LOAD GATE + multi-frame capture + user-advocate. Commit each `AUTO-CKPT: PHASE3 <wave>` + `git push origin prism-editor-build`.

## RESUME / REPORTING + MARKER
`git log --oneline -12`; `AUTO-CKPT: PHASE3 <wave>` commits are DONE-pending-reverify (audit, don't redo). If `kid-kode-landing/notes/ORRERY-PHASE3-REPORT.md` already has the marker, re-print + stop. BEFORE each wave check `kid-kode-landing/notes/LOGAN-INBOX.md` and obey it. Append wave status to `kid-kode-landing/notes/MONITOR-FEED.md` + rows to `kid-kode-landing/notes/ORRERY-PHASE3-PROGRESS.md`. Write `kid-kode-landing/notes/ORRERY-PHASE3-REPORT.md` (multi-frame paths, P3 verdicts, all gate verdicts incl COLD-LOAD, console-error counts, honest flags). On FULL completion (all criteria pass all gates incl clean cold load, committed + pushed), write the EXACT marker line LAST:
ORRERY-PHASE3: RUN COMPLETE
