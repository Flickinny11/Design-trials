# MATERIAL + LIGHTING SYSTEM — build §10 + §11 of the Canvas spec, via ultracode. (Claude Code)

## MODEL & MODE
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
ORCHESTRATION: ULTRACODE — Dynamic Workflows with PARALLEL subagents in INTERNAL verified waves (reuse the
`parallel()` pattern from notes/catalog-finish-workflow.mjs). Each subagent pins claude-opus-4-8. CONTRACT-FIRST:
write the frozen interface layer (additive shared-interfaces fields + the LightingRig / MaterialSystem APIs) BEFORE
any parallel agent builds against it. Run waves straight through (no human pause between waves).
MODE: APP IMPLEMENTATION, verified. This step DOES edit runtime app source under kid-kode-landing/src/** (it builds a
core subsystem). Stay on branch prism-editor-build. Run from git root. Do NOT commit (leave everything staged for Logan).
Shut down every dev server / browser you start; free the port. Existing Prism design language (no external skill files).
ANTI-STUCK: after ~2 fails on a step, web-search the CURRENT (June 2026) correct approach, root-cause, retry.
NEVER downgrade a dependency or take the old/easy path.

## READ FIRST (do not skip)
- kid-kode-landing/docs/prism/PRISM-CANVAS-EDITOR-SPEC.md — IN FULL, but especially §2 decision 7, §5 (Lighting group +
  material editor), §10 (Lighting & shadow system, tiers T0/T1/T2), §11 (Material system), INV-8, INV-9, §18 criteria
  17-18, §19 forbidden patterns, §20 re-verify list.
- kid-kode-landing/docs/prism/PRISM-RUNTIME-SPEC.md — the scene/runtime lighting touch-points.
- kid-kode-landing/notes/CATALOG-PARALLEL-VERIFY-REPORT.md — the flagged tiles this step should LIFT (clear-glass needs a
  lit backdrop; several volumetric/smoke shaders read flat).
- INVENTORY existing material/lighting code first (the bubble `MeshPhysicalMaterial` transmission, the catalog's TSL
  glass/`MeshPhysicalNodeMaterial`, the shared preview rig, the Animatable contract). BUILD ON it; do not duplicate.

## DECISIONS (locked — do not reopen)
1. One unified Three.js WebGPU scene; lighting/materials authored in TSL (the path the catalog already uses).
   Re-verify the CURRENT `three` version + `three/webgpu` + TSL lighting/PMREM/shadow API at build time (§20).
2. CAPABILITY-TIERED ladder (INV-9 — heavy effects are NEVER the default path; detect + degrade gracefully):
   - T0 (ALL devices, incl. mobile): IBL/environment via PMREM + ambient. Mobile MUST hold target framerate.
   - T1 (workhorse): dynamic key/fill/rim directional + point/spot, color/intensity, SOFT shadows (PCFSoft/VSM).
   - T2 (WebGPU desktop / high-end only, capability-gated): native screen-space GI (SSGI) + GTAO + TRAA, optional SSR.
     Confirm native TSL availability in current three at build; if an effect needs a TSL rewrite, DO it — never skip the
     tier or downgrade; just gate it behind capability detection with a clean fallback to T1.
3. Per-node `receivesLighting` (INV-8 additive field, SAFE DEFAULT): image-planes default UNLIT (preserve the
   diffusion-baked look EXACTLY), meshes/splats lit by default, text fills opt-in. Round-trips through save/reload.
4. `materialSpec` per node (INV-8 additive): `MeshPhysicalNodeMaterial` params — baseColor, metalness, roughness,
   transmission, IOR, dispersion, clearcoat, emissive, normal/displacement. Mesh color/material editable in Canvas.
5. `lightingSpec` per-hub AND per-element configurable (INV-8 additive): light list (type/color/intensity/position),
   env/IBL map, shadow softness, tier. Additive with safe defaults; never break existing shared-interfaces fields.
6. Wire the Canvas toolbar's LIGHTING group (§5: add/select lights, type, color, intensity, shadow softness, env/IBL,
   per-node receivesLighting) AND the 3D material editor panel (§11) to these subsystems. Controls render from the
   subsystem's schema, consistent with the rest of the toolbar.
7. AI / neural relighting (DiffusionRenderer, Neural Gaffer, etc.) is OUT OF SCOPE here — it is a future SERVER-SIDE /
   BUILD-TIME harness item, not runtime. Runtime lighting is analytic + IBL + screen-space ONLY.

## GOAL (what "done" looks like)
A working scene-wide Material + Lighting subsystem on the one WebGPU scene: environment/IBL + key/fill/rim + point/spot +
soft shadows, the T0/T1/T2 tier ladder with real capability detection, per-node `receivesLighting`, a per-node
`materialSpec` (editable for meshes), per-hub/element `lightingSpec`, the Lighting toolbar group + material editor wired
to them — AND the flagged tiles lifted: clear-glass tiles get a lit backdrop and read as real glass; the flat volumetric
shaders gain real depth under lighting. Image-planes with receivesLighting=false look pixel-identical to before.

## VERIFICATION — FULL STRENGTH (reuse the NEW parallel harness)
Use scripts/verify-catalog-parallel.mjs (the parallel browser harness) for the visual pass — it's the fast
ultracode-for-verify path. Gates:
- Criterion 17: changing lighting controls visibly changes the scene; an image-plane with receivesLighting=false is
  UNAFFECTED while a mesh with it ON is lit; soft shadows render.
- Criterion 18: capability detection degrades gracefully — T2 (SSGI/GTAO/TRAA) only where supported; mobile profile
  runs at target framerate on T0/T1; no device-loss.
- The flagged clear-glass tiles now show a lit backdrop (real refraction) on the REAL-GPU path (backend=webgpu); the
  flagged flat volumetrics visibly gain depth.
- `tsc --noEmit` 0 new errors (hold the baseline); vitest green + NEW tests for receivesLighting / materialSpec /
  lightingSpec round-trip and tier-selection.
- Fresh-context art-fidelity reviewer signs off each wave; MUST-FIX blocks done. Fix-don't-skip; contamination-aware
  repair (delete broken code before regenerating).

## GUARDRAILS (forbidden — halt + report if hit)
PreToolUse dependency-allowlist + forbidden patterns ON: making GI/path-tracing/dense effects the DEFAULT (non-tiered)
path (violates INV-9); a 2nd visible renderer / PixiJS; diffusion-drawn text; global-fps; dependency downgrades;
removing/repurposing existing shared-interfaces fields (additive only). New deps must pass the allowlist guard.

## OUT OF SCOPE (do not touch)
The OTHER deferred toolbar groups (Image / 3D-shape / Text / Animation-picker) stay as placeholders. Text-MSDF binding,
the engine/harness, and AI-relighting are separate later steps. Do NOT alter graph topology / node-system / the
bipartite DAG (frozen, INV-1).

## RESUMABILITY
Write notes/verification/MATERIAL-LIGHTING-PROGRESS.md as waves complete (what's built + tier status + tiles lifted +
running tsc/vitest). If interrupted, a relaunch reads it and continues from the last wave — never restart from zero.
Stage files as you go.

## ENV HYGIENE
Launched headless with NODE_ENV unset, model pinned claude-opus-4-8, from git root. Confirm NODE_ENV unset before any
`next dev`. Kill every browser + dev server you start at the end; free the port.

## OUTPUT
Write notes/MATERIAL-LIGHTING-REPORT.md:
- What was built (lighting rig, material system, the additive schema fields, the wired Lighting group + material editor).
- The T0/T1/T2 tier ladder + exactly how each tier is capability-detected and what the mobile fallback is.
- BEFORE/AFTER frames of the lifted flagged tiles (clear-glass backdrop; the flat volumetrics) + real-GPU lit-scene frames.
- Proof of criteria 17 + 18 (the unlit image-plane vs lit mesh comparison; the graceful-degradation evidence).
- Orchestration metrics (waves, peak parallelism, total time, every failure + how the loop fixed it).
- tsc + vitest results; any item that could NOT meet the bar, flagged HONESTLY (never faked) + carried to art-polish.
Save frames under kid-kode-landing/notes/verification/material-lighting/. NO commit — staged for Logan.
End with a PLAIN-LANGUAGE summary for Logan (what lighting/materials now do, what the flagged tiles look like now, what
remains for art-polish). Then STOP. HEAD stays prism-editor-build.
