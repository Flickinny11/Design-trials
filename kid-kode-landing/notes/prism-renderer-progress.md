# Prism Renderer Migration — progress log

This file is the running log of the PixiJS → Three.js WebGPU renderer
migration. Each Ralph iteration appends one line under "Ralph iterations".
Setup and decision events go under their own dated sections.

## Phase audit (2026-05-04)

**Decision: RECOVER (no precursors required).**

Counts (per audit `notes/audit-renderer-20260504-2149.md`):
- `C_FAILS` (drift symptoms in app code): 0
- `C_CONFLICTS` (governance items requiring resolution): 4
  - `anti-drift-check.sh`: keep, no wrapper (PixiJS rules become moot once
    PixiJS files are deleted; DOM/CSS rules remain valid)
  - `spec-infrastructure-check.sh`: wrap with `.ralph-migration-active` marker
  - `verify-on-stop.sh`: wrap with `.ralph-migration-active` marker
  - `dependency-allowlist-check.sh`: extend allowlist additively for
    `three-msdf-text-webgpu`
- `C_PARTIAL` (migration phases partially attempted): 0

**Rule applied:** `C_FAILS == 0 AND C_CONFLICTS ≤ 5 AND C_PARTIAL ≤ 2` →
**RECOVER**. Keep all existing code. Resolve hook conflicts via additive
overrides + marker-gated wrappers. No precursor tasks needed.

**Existing PixiJS-era artifacts replaced (per user direction "we wouldnt
want to use the words 'pixi'" — clean break, originals preserved in git
history at commit 8db73fa and earlier):**
- `kid-kode-landing/notes/ralph-state.json`: replaced (was status=complete,
  21 PixiJS-mock-app tasks done)
- `Design-trials/.claude/commands/ralph-step.md`: replaced
- `Design-trials/.claude/agents/spec-reviewer.md`: replaced
- `Design-trials/.claude/agents/spec-researcher.md`: replaced

**Existing PixiJS-era artifacts kept (read-only carry-forward):**
- `kid-kode-landing/notes/prism-spec-extract.md` (1349-line mock-app spec
  extract; remains relevant because §14 of the migration spec uses the
  current mock-app as the reconstruction target)
- All `src/lib/prism/player/` PixiJS runtime code (deleted in Phase 5)
- `kid-kode-landing/scripts/ralph.sh` (project-agnostic outer loop)

**Branching:** Off `prism-main` at `8db73fa`. Carry-forward commit `7a91c29`
captures uncommitted Voltus-mockup-pipeline state so migration commits start
from a clean tree.

**Migration spec:** `kid-kode-landing/docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md`
(554 lines, 17 sections), `kid-kode-landing/docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md`
(328 lines, 9 primitives + 6 TSL shaders). Both moved to canonical path in
Phase 2.0.

## Ralph iterations

(populated by /ralph-step on each iteration)

- iter 1 - T01 phase 1 - foundation deps (three@^0.184, three-msdf-text-webgpu@^2.1, PrismNode 5 fields, runtime/shared/* stubs) - 2fdb4b4
- iter 2 - T02 phase 2 - SceneRoot + LoaderCache + FontAtlas + HubManager + Adapter (25 vitest integration tests, vitest@^2.1 + msdf alias) - d43fb95
- iter 3 - T03 phase 3 - 9 cinematic primitives + 6 TSL shaders (PrimitiveContext/Result/Fn types, makePrimitivesAPI curry, NodeContext.primitives → CinematicPrimitivesAPI, 11 new test files / 69 vitest tests) - e703ce5
- iter 4 - T04 phase 4 - codegen prompts (§9.A SHARED_SYSTEM_PROMPT byte-stable, §9.B per-node template, §9.C 4 sub-prompts) + verifier (§10.A 19 ALLOWED_THREE_IMPORTS / §9.A 5 ALLOWED_IMPORT_SOURCES / §10.B 7 disallowed regexes / §10.C 5 structural checks) + plan-output hook (defaults + validation) + 5 sample fixtures, 4 test files / 66 vitest tests pass - e6a8cc8
- iter 5 - T05 phase 5 - bundle assembly (§11 file map: app.js+graph.json+6 shared+9 primitives+6 TSL shaders+per-node stubs) + Three.js mount.ts replaces PixiJS boot.ts + PixiJS removal (5 player files deleted, pixi.js+pixi-filters dropped from package.json, .ralph-phase5-pixi-removed marker, shr installBrokenShim now Object3D-based) - 1365ef9
- iter 6 - T06 phase 6 - depth-map (§6 stage 9.5, fal-ai/image-preprocessors/depth-anything/v2) + mesh (§6 stage 9.6, fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d primary, fal-ai/trellis-2 fallback, demote-to-parallax-plane on dual failure, demote-to-plane on depth-map failure) + parallel orchestrator (Promise.all both stages, +7-10s budget §14 L498) - 19 vitest integration tests (7 depth + 9 mesh + 3 orchestrator), full suite 195/195 - 2666073
- iter 7 - T07 phase 7 - editor Visual tab live R3F sub-canvas (§13 L477) + Save & Verify regen API integration (visual-spec-sliders.ts buildVisualSpecSliders + applyVisualSpecSlider symmetric, regen-api.ts saveAndVerify, VisualPreview.tsx async WebGPU gl factory + WebGL2 fallback per §3 L65, RendererProbe via useThree+useEffect, slider→transform direct mutation honours §17 L538 <100ms budget, Inspector VisualTab wired with memoized sourceNode lookup) + Playwright config + harness server (8 Playwright tests + 15 vitest unit tests pass, full suite 210/210, npx tsc --noEmit clean) - 1199efc
- iter 8 - T08 phase 8 - editor Animation tab hybrid mode (§13 L479: i2v-frame-scrub | timeline-keyframe via ANIMATION_TAB_MODES) + PowerPoint preset library (4 categories × 12 presets all mapping to canonical 9-primitive library per CINEMATIC-PRIMITIVES-LIBRARY.md) + keyframe capture/replay (DoD §17 L539 round-trip via createKeyframeTimeline + captureKeyframe + replayKeyframeTimeline with linear interp + clamp01) + image-edit tools (§13 L483 swapMeshForImage preserves all behavior code/cinematicPrimitives/codeRef/backendRef + applyCrop writes visual.transform + applyMaskRefinement writes layer.mask) + 3 vitest files (48 tests) + 2 Playwright specs (12 tests) + harness extensions (animation-main.ts/image-edit-main.ts + bundles, build.mjs multi-entrypoint), full vitest 258/258 + Playwright 12/12 pass, npx tsc --noEmit clean - f0af766
- iter 9 - T09 phase 9 - mock app reconstruction (§14 L487-L500: 5 hubs Landing/Features/Gallery/Pricing/Contact, 16 nodes, 5 edges; 3 mesh nodes per §14.2 spec L492; 5 parallax-plane one per hub per §14.3; all 9 cinematic primitives represented across the app — 8 in node cinematicPrimitives + fly-through on 4 inter-hub edges via transitionPrimitive per §14.7; all text renderMethod='msdf' per §14.6; pre-baked depthMapUrl/meshUrl values so build is deterministic without fal.ai network) + scripts/build-mock-app.mjs (esbuild-bundles runtime/bundle.ts on-the-fly to call assembleBundle, projects PrismGraph→CompiledGraph preserving all renderer-era additive fields + edge transitionPrimitive, writes 40-file bundle + manifest to public/prism-mock-app-renderer/, builds in 12-15ms well under spec §14 L498 35s budget) + tests/browser/T09.mock-app-quality.spec.ts (11 Playwright tests for §14.1-§14.8 + halt-check + §17 DoD#1 zero pixi imports + browser smoke loads bundle without errors) + harness extensions (/shims/* and /mock-app/* routes; mock-app-load.html + three-msdf-text-webgpu shim resolves the bare specifier per T05 review note that §11 L444-L445 says it's bundled in production), full vitest 258/258 + Playwright 31/31 pass, npx tsc --noEmit clean - 976c19e
- iter 10 - T10 phase 10 - integration test, polish, Definition of Done (§17 L527-L543 13-item DoD aggregator: stress test 200 nodes / 10 hubs assembleBundle <35s + 50× heap-delta <5MB + disposeHubGroup walks 400 descendants; cross-browser 6 chromium tests covering DoD #2 mock-app boot / #3 WebGL2 fallback via page.addInitScript-stomp navigator.gpu / #5 MSDF module reachable / #6 GLTFLoader constructable / #7 pointermove path / #11 no console errors; docs/spec-deviations-prism.md as DoD #13 artifact covers T01-T10 deviations + cross-browser/memory-leak/stress-scope honest boundaries; cycle-1 spec-reviewer MUST FIX both addressed: misleading 'four playwright projects' comment rewritten + DoD #3 strengthened from getContext-non-null to navigator.gpu-undefined antecedent assertion); full vitest 272/277 (5 skipped = deferred-to-browser items), Playwright 6/6 chromium pass, npx tsc --noEmit clean — Prism Renderer Migration COMPLETE - 2d13bb8
