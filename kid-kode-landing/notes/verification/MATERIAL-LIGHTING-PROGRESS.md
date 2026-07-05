# Material + Lighting subsystem — build progress (resumable)

**Branch:** `prism-editor-build` · **Model:** claude-opus-4-8 · **No commit (stage for Logan).**
Build of PRISM-CANVAS-EDITOR-SPEC §10 (Lighting & shadow) + §11 (Material), via ultracode.

If interrupted, read this file and continue from the last unchecked wave. Never restart from zero.

---

## §20 re-verify at build time — DONE (2026-06-08)

Confirmed against the **installed** `three@0.184.0` (ground truth, not training data). **Holding r184**
— it is the pinned, working version the entire 312-primitive catalog + renderer run on; upgrading is
out-of-spirit risk (would be a "downgrade" of stability) and r184 already has every API the tiers need.

| Need | Confirmed in r184 |
|---|---|
| WebGPU renderer + WebGL2 fallback | `WebGPURenderer` from `three/webgpu` (auto fallback) |
| PBR node material | `MeshPhysicalNodeMaterial`, `MeshStandardNodeMaterial` from `three/webgpu` |
| IBL / PMREM | `PMREMGenerator` (three/webgpu) + `RoomEnvironment` (examples/jsm/environments) |
| Soft shadows | `PCFSoftShadowMap` (=2), `VSMShadowMap` (=3) constants from three core / three/webgpu |
| T2 post pipeline | `PostProcessing`, `QuadMesh` from `three/webgpu` |
| T2 GI / AO / SSR / TAA | `ao` (GTAONode), `ssgi` (SSGINode), `ssr` (SSRNode), `traa` (TRAANode), `godrays` (GodraysNode) — all `three/examples/jsm/tsl/display/*` |
| MRT for AO/GI inputs | `pass`, `mrt`, `transformedNormalView`, `output`, `blendColor` from `three/tsl`; `scenePass.getTextureNode('normal'|'depth'|'output')` |

T2 wiring (from GTAONode JSDoc, verified): `const sp = pass(scene,camera); sp.setMRT(mrt({output, normal: transformedNormalView}));
const aoPass = ao(sp.getTextureNode('depth'), sp.getTextureNode('normal'), camera);
post.outputNode = aoPass.getTextureNode().mul(sp.getTextureNode('output'))`.

**No upgrade, no TSL rewrite, no dependency change required.** New deps: none.

## Existing code to BUILD ON (inventory done)

- **Runtime scene** `src/lib/prism/runtime/shared/scene-root.ts` — 3 hard-coded lights, NO env/IBL/shadows. ← extend.
- **Catalog rig (HAS IBL)** `src/components/editor/animation-catalog/shared-tile-renderer.ts` `buildEnv()`/`makeScene()`
  PMREM RoomEnvironment + procedural fallback. ← the reference IBL impl; factor into a shared module.
- **Glass primitives** `src/lib/prism/animatable/primitives/*` — 21 `MeshPhysicalNodeMaterial` tiles; clear-glass
  (crystal-ball, liquid-glass, liquid-fill-glass, refraction-warp, water-droplet) need a LIT BACKDROP behind subject.
- **Schema** `src/lib/prism-graph/types.ts` — additive-field pattern proven (scenePosition/canvasTransform/+`_DEFAULT`).
  No Zod; validators spread `...input` so unknown fields round-trip. No separate packages/shared-interfaces.
- **Persistence** `useGraphSourceStore.updateNode` → 1s debounce → POST /api/prism/regen → live-graph.json → reload.
  `applyPlanRendererDefaults` (plan-output-hook.ts) is where to add `_DEFAULT` merges.
- **Toolbar** `src/components/editor/overlays/CanvasToolbar.tsx` — `lighting` group already in GROUPS (wired:false),
  placeholder flyout at :573-586. `object3d` group names a "Material Editor" tile.
- **Schema-driven controls (INV-5)** `ControlSchema` in `src/lib/prism/animatable/contract.ts`; renderer
  `ControlPanel.tsx`. Reuse for Lighting group + material editor.
- **Live update path** `usePreviewStateStore.set(nodeId, patch)` → GraphScene `AssembledSceneNode` reads
  `composeNodeWithPreview`. FP-15: Inspector*/`*Tab.tsx` MUST route through `usePreviewStateStore` /
  `commitPreviewToSource`, never `updateNode` direct. Toolbar may write source direct (like Transform).

---

## WAVES

- [x] **A — Frozen contract** (orchestrator, inline): DONE. Schema fields added to `types.ts`
      (`MaterialSpec`/`LightingSpec`/`PrismLight`/`LightingTier` + `_DEFAULT`s + `receivesLightingDefault()`;
      fields on PrismNode/PrismHub/PrismLayer). 4 lib modules written under `src/lib/prism/runtime/shared/`:
      `environment-ibl.ts` (PMREM IBL, shared), `capability-tier.ts` (T0/T1/T2 detect + watchdog),
      `material-system.ts` (PBR factory + MATERIAL_CONTROL_SCHEMA + receivesLighting lanes),
      `lighting-rig.ts` (env+3-point+point/spot+soft shadows+capability-gated T2 GTAO/SSGI post, clean T1 fallback).
      Allowlist extended (first-party three addons: RoomEnvironment + tsl/display GTAO/SSGI/SSR/TRAA/Godrays) +
      rationale in mockup-pipeline.md §10. **tsc: 10 pre-existing baseline errors, 0 in new files (baseline held).**
- [x] **B — Wire + tests** DONE (workflow wv9kvjckr, 6 parallel agents). Files: scene-root.ts (rig wired, tick T2-aware,
      dispose), default-factory.ts (receivesLighting unlit/lit lanes + materialSpec on meshes + cast/receiveShadow),
      shared-tile-renderer.ts (glass lit-backdrop behind transmissive subjects, glass-only; volumetric depth deferred to
      art-polish — `buildSubject` can't distinguish volumetric planes without a contract change), CanvasToolbar.tsx (Lighting
      group wired:true, schema-driven flyout, hub.lightingSpec + per-node receivesLighting writes), Inspector.tsx +
      MaterialTab.tsx + useGraphEditorStore.ts ('material' tab, FP-15 via usePreviewStateStore), plan-output-hook.ts (defaults),
      tests/material-lighting/* (5 files, 32 tests), src/app/material-lighting-probe + ProbeScene.tsx (verification surface),
      vitest.config.mjs (added material-lighting to include glob). **GATE: tsc 10 baseline held (0 new), vitest 32/32, 0 new regressions.**
- [x] **C — Verify** DONE: tsc 10 baseline held (0 new) · vitest 32/32 + no regressions · fresh-context prism-criteria-reviewer
      found 3 MUST-FIX. RESOLVED: (#2) toolbar/material controls didn't drive the VISIBLE editor scene → added
      `HubLighting.tsx` wiring `hub.lightingSpec` into GraphScene AssembledSceneContent (toolbar now visibly changes the canvas);
      (#3) image-plane receivesLighting opt-in dead on editor path → default-factory legacy sprite/plane branch now picks
      MeshStandard when receivesLighting=true (default false → MeshBasic, byte-identical); (#1) criterion-17 measurement was a
      sharp `.extract().stats()` gotcha → fixed (materialize crop), drive at T1, exact screen projection. Also corrected the
      environment-ibl "canonical" comment (catalog rig keeps its working inline copy).
- [x] **D — Visual pass** PASS (scripts/verify-material-lighting.mjs, real Metal GPU webgpu + SwiftShader webgl2):
      **C17 PASS** litDrop 3.72 / unlitDelta **0.00** at T1 (lit sphere + soft ground shadow responds; unlit orange plane
      byte-identical; key-off removes the shadow). **C18 PASS** desktop→T2, mobile→T1, webgl2→T1, deviceLost 0.
      **Glass lift** 5/5 clear-glass tiles carry the lit backdrop (backend=webgpu). Frames → notes/verification/material-lighting/.

### Tier ladder (locked)
- **T0** (all incl. mobile): PMREM IBL + ambient. No dynamic shadows. Holds mobile framerate.
- **T1** (workhorse): key/fill/rim directional + point/spot, color/intensity, soft shadows (PCFSoft default, VSM opt).
- **T2** (WebGPU desktop only, gated): T1 + PostProcessing GTAO + SSGI (+ optional SSR + TRAA). Falls back to T1.

## FINAL SIGN-OFF (2026-06-09) — DONE, staged for Logan (no commit)
- **Criteria 17 & 18: PASS** (real Metal GPU). C17 litDrop 3.72 / unlitDelta 0.00 + soft shadow at T1; C18 T2/T1/T1, deviceLost 0.
- **Glass lift:** 5/5 clear-glass tiles carry the lit backdrop (contrast ~54 vs prior near-black).
- **tsc 10 baseline held (0 new) · vitest 32/32 · 0 regressions.**
- **Fresh-context reviews:** criteria-reviewer (3 MUST-FIX → all resolved: HubLighting wires lightingSpec→GraphScene; default-factory
  legacy plane honors receivesLighting opt-in; criterion-17 measurement fixed) + art-fidelity reviewer (**0 MUST-FIX**; glass-center
  sparkle + flat volumetrics → art-polish backlog).
- Report: `notes/MATERIAL-LIGHTING-REPORT.md`. Harness: `scripts/verify-material-lighting.mjs`. Probe: `/material-lighting-probe`.

### receivesLighting default rule (INV-8 safe default)
image/plane/parallax-plane/sprite → **false** (preserve diffusion-baked look pixel-identical); mesh/splat → **true**;
text → opt-in **false**. Round-trips through save/reload.
