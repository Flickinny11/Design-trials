# THREE-D-BACKGROUNDS — progress ledger

Run start: 2026-06-15. Branch: prism-editor-build. Model: claude-opus-4-8 (env-confirmed; Fable-5 down → opus is target).

## Phase table
| Phase | Status | Notes |
|---|---|---|
| P0 — contract + re-verify tooling | DONE | schema extended (BackgroundLayerKind/Params + 6 layer fields); presets/tier/palettes lib; 3 presets as DATA; tsc 9 (baseline, 0-new) |
| P1 — procedural core (volumetric nebula + GPU-compute particles, tiered) | DONE | C1–C4 ALL PASS on real WebGPU; 3 presets distinct+content-legible; raymarch optimized 90→23ms |
| P2 — hybrid image layer (fal plate + parallax-plane depth) | DONE | C5–C6 PASS; fal flux-2 plate + depth-anything/v2; Cosmic Drift hybrid preset; translucent nebula veil over plate |
| P3 — splat preset (captured-env gaussian splat, desktop/T2) | DONE | C7 PASS; WebGPU-native RGBD gaussian splat (58k splats T2), nebula fallback T0, 0 errs; Spark WebGL2-only → INV-1 swap seam documented |
| P4 — library UX + camera-journey readiness | DONE | C8–C11 PASS; HubBackgroundPicker in Hub Inspector (5 preset cards + live param sliders); galaxy backdrop = active hub nebula; save→reload round-trip; journey parallax + no blank corner |
| P5 — verification + capstone | DONE | C12 20/20 frames premium 0-err; C13 tsc 9/0-new, vitest 3349/0, prims 408, prod build ✓; C14 advocate PLEASED/PASS/0 MUST-FIX |

## Tooling re-verify (P0) — 2026-06-15, npm registry
- **three**: installed 0.184.0 == registry latest 0.184.0. `three/webgpu` + `three/tsl` builds present. ✓ r184+. No downgrade.
- **@fal-ai/client**: installed ^1.4.0; registry latest 1.10.1 → BUMP to ^1.10.1 at P2 (fal path) per "use newest reachable, never downgrade".
- **@sparkjsdev/spark**: not installed (P3 dep). Registry latest 2.1.0 (Spark 2.x: LoD streaming + .SOG/.SPZ/.SPZ per research). Install at P3.
- **depth-anything**: fal model id `image-preprocessors/depth-anything/v2` (proven default per harness map); v3 optional if reachable at P2.

## P0 architecture decisions (locked)
- Live render path is **R3F `GraphScene.tsx`** (`AssembledSceneContent` → `<HubSceneBackground>` skybox + `<SceneBackdrop hub>` reads `hub.background`). The imperative `mount-graph.ts setBackgroundLayers` (5 attachment modes, texture-only) is DORMANT — kept as contract reference. Build the 3D background library in the R3F path.
- Schema grows in `src/lib/prism-graph/types.ts` (NOT dep-guarded). Pure preset/tier/palette lib in `src/lib/editor/backgrounds/` (NOT dep-guarded; matches §13 elements lib). R3F layer components → `src/components/editor/graph/backgrounds/` (P1).
- Layer dispatch by new `kind` field: image|volumetric-nebula|particle-field|parallax-plane|splat. `params` (palette/density/drift/depthSpread/intensity) round-trip via `updateHub(hubId,{background})` → loader passes hubs verbatim (no allowlist) → C9/C10 round-trip confirmed by code read.
- Tier: WebGL2 backend ⇒ T0; WebGPU backend ⇒ device-mode/width/cores resolve T1/T2. `TIER_BUDGET` gates raymarch steps, particle count, compute, splat. `minTier` on a layer drops it below floor (splat→T2).
- Composable templates: `_volume-fbm.ts` (fbmRot/fbmWarped quintic domain-warp), `sdf-metablob.ts` (only TSL raymarch Loop precedent), `galaxy-particles.ts` (CPU Points starfield), `_sim-core.ts` (resolveSimTier/tierPick), `defineAnimatable` contract. NO WebGPU-compute precedent exists (new in P1). DS palette from design-system/tokens (no purple).

## fal ledger
notes/verification/three-d-backgrounds/fal-ledger.json

## AUTO-CKPT hashes
(filled per phase)
