# THREE-D-BACKGROUNDS — 3D hub background library
(status: in progress)

## P0 — contract + re-verify current tooling — DONE
- **Model:** claude-opus-4-8 (env-confirmed; Fable-5 down → opus is the target).
- **Tooling (npm registry, 2026-06-15):** three 0.184.0 (=latest, webgpu+tsl builds present); @fal-ai/client installed ^1.4.0 / latest 1.10.1 (bump P2); @sparkjsdev/spark latest 2.1.0 (install P3); fal depth = `image-preprocessors/depth-anything/v2`.
- **Schema (additive, INV-2/18):** `PrismHubBackgroundLayer` grew `kind` (`image|volumetric-nebula|particle-field|parallax-plane|splat`), `depthMapUrl`, `renderMode`, `presetId`, `params` (`BackgroundLayerParams`: palette/density/drift/depthSpread/intensity), `minTier`. Legacy layers (no `kind`) render unchanged as a flat image plate.
- **Library (`src/lib/editor/backgrounds/`):** `palettes.ts` (4 Observatory-Brass palettes, no purple), `tier.ts` (`TIER_BUDGET` + `resolveBackgroundTier`), `types.ts` (`BackgroundPreset`/`BackgroundParamControl`), `presets.ts` (3 presets: Brass Nebula, Ice Field, Observatory Deep + `applyBackgroundPreset`).
- **Integration target:** R3F `GraphScene.tsx` `SceneBackdrop` (live path); imperative `mount-graph.ts` compositor is dormant reference. Round-trip confirmed by code read (loader passes hubs verbatim; `updateHub` spreads patch).
- **tsc:** 9 errors = pre-existing baseline, 0 new.
## P1 — procedural core (volumetric nebula + GPU-compute particles, tiered) — TODO
## P2 — hybrid image layer (fal plate + parallax-plane depth) — TODO
## P3 — splat preset (Spark 2.0, desktop/T2) — TODO
## P4 — library UX + camera-journey readiness — TODO
## P5 — verification + capstone — TODO
