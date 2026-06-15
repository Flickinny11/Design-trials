# THREE-D-BACKGROUNDS — 3D hub background library
(status: in progress)

## P0 — contract + re-verify current tooling — DONE
- **Model:** claude-opus-4-8 (env-confirmed; Fable-5 down → opus is the target).
- **Tooling (npm registry, 2026-06-15):** three 0.184.0 (=latest, webgpu+tsl builds present); @fal-ai/client installed ^1.4.0 / latest 1.10.1 (bump P2); @sparkjsdev/spark latest 2.1.0 (install P3); fal depth = `image-preprocessors/depth-anything/v2`.
- **Schema (additive, INV-2/18):** `PrismHubBackgroundLayer` grew `kind` (`image|volumetric-nebula|particle-field|parallax-plane|splat`), `depthMapUrl`, `renderMode`, `presetId`, `params` (`BackgroundLayerParams`: palette/density/drift/depthSpread/intensity), `minTier`. Legacy layers (no `kind`) render unchanged as a flat image plate.
- **Library (`src/lib/editor/backgrounds/`):** `palettes.ts` (4 Observatory-Brass palettes, no purple), `tier.ts` (`TIER_BUDGET` + `resolveBackgroundTier`), `types.ts` (`BackgroundPreset`/`BackgroundParamControl`), `presets.ts` (3 presets: Brass Nebula, Ice Field, Observatory Deep + `applyBackgroundPreset`).
- **Integration target:** R3F `GraphScene.tsx` `SceneBackdrop` (live path); imperative `mount-graph.ts` compositor is dormant reference. Round-trip confirmed by code read (loader passes hubs verbatim; `updateHub` spreads patch).
- **tsc:** 9 errors = pre-existing baseline, 0 new.
## P1 — procedural core (volumetric nebula + depth-scattered particles, tiered) — DONE
Live R3F components in `src/components/editor/graph/backgrounds/`, mounted by `GraphScene` `AssembledSceneContent` (canvas + preview-app), dispatched from `hub.background` by `HubBackgroundStack` per `kind`. One renderer (three/webgpu, TSL).

- **Volumetric nebula** (`VolumetricNebulaLayer.tsx`): camera-centred inverted sphere; fragment RAYMARCHES a world-anchored 3D `mx_fractal_noise` density field from the camera outward → genuine parallax (not a flat skybox). Beer-Lambert absorption (`exp(-density·σ·ds)`) + Henyey-Greenstein phase (forward in-scatter) + a JS-unrolled self-shadow light-march (cheap 2-octave density). Tier-gated step count.
- **Particle field** (`ParticleFieldLayer.tsx`): instanced billboarded sprites (`SpriteNodeMaterial` + `THREE.InstancedMesh`) — WebGPU renders `THREE.Points` at 1px, so sized particles MUST be instanced quads. Per-instance position/seed/size derived on the GPU from `instanceIndex`+`hash` (deterministic); GPU vertex-stage drift; round soft glows via quad uv; additive. Real-Z scatter → camera flies through (parallax + near/far size spread). Variants: embers/crystals/starfield/motes.
- **Tiering** (`tier.ts` + `useBackgroundTier`): WebGL2⇒T0; WebGPU⇒device-mode/width/cores ⇒ T1/T2. `TIER_BUDGET` gates raymarch steps (28/18/8), light-march (3/2/0), particle count (16k/8k/2.8k).

**C1 depth/parallax — PASS.** Near world point (z=−15) shifts **241.4px** vs far point (z=−260) **24px** under a matched camera pan → parallaxRatio **10.07** (near ≫ far = true depth). Both layers' rendered frames change between waypoints (nebula meanAbsDiff ~24, particles ~3) → neither is a flat static skybox. Evidence: `p1/*-par-camx{0,3}.png`, `p1/metrics-c1-c4.json`.
**C2 volumetric — PASS.** Nebula frame luma std **39–62** (rich texture, a flat plane ≈ 0); banding **0–1** (smooth feather, no contrast cliff). Evidence: `p1/*-neb-camx0.png` + metrics.
**C3 depth-scattered particles — PASS.** Live counts **4,749 / 8,714 / 13,792** (brass/ice/observatory) measured off `__PRISM_BG_PARTICLE_COUNTS__`; real-Z parallax confirmed via C1. Evidence: lab particle frames + metrics.
**C4 tiering — PASS.** Same preset renders on T2 AND T0 (both non-black); T0 drops particle counts ~5× (e.g. embers 3584→627) and raymarch steps; frame-time T2 **~23ms** (optimized from 90ms via octave/step/light-march cuts), all tiers ≥40fps headless (≥60 expected interactive). Evidence: `p1/*-tierT{0,2}.png` + metrics.

3 presets verified on the REAL preview-app with content reading cleanly on top: `p1-presets/desktop-preview-app-{brass-nebula,ice-field,observatory-deep}.png`. Isolation lab at `/bg-lab` (verification route). tsc 9 (baseline, 0-new).
## P2 — hybrid image layer (fal plate + parallax-plane depth) — DONE
The image+real-3D hybrid: a photoreal deep-space PLATE (fal flux-2) depth-displaced (fal depth-anything/v2) so it parallaxes, with a thin translucent procedural nebula veil + starfield in front. Generated once, server-side, reusable (D8).

- **fal generation** (`scripts/three-d-backgrounds/gen-hybrid-plate.mjs`, run with `node --env-file=.env.local`): `fal-ai/flux-2` base plate (deep cosmic, negative prompt "no text, no letters, no labels" per INV-6) → `public/three-d-bg/cosmic-plate.png` (966 KB); `fal-ai/image-preprocessors/depth-anything/v2` → `cosmic-plate-depth.png` (122 KB). FAL_KEY read from server env only; the graph holds ONLY the public asset URLs (INV-7). Ledger: `fal-ledger.json` (2 calls, ~$0.05).
- **Parallax plate** (`ParallaxPlaneLayer.tsx`): a 160×96-subdivided plane, image as `map`, DISPLACED in Z by the depth texture in `positionNode` (`(depth−0.5)·amp`), world-anchored so the camera flies past it → real depth parallax. Radial edge feather → no hard seam / pasted-card edge; corners fade to atmosphere (C5).
- **Translucent veil** (`VolumetricNebulaLayer` `overBackdrop` mode): when a plate is present the nebula renders as a translucent veil (alpha = gas coverage × veil strength) so the photoreal plate shows through the dust voids; skybox suppression is lifted so feathered plate corners blend (`hubSuppressesSkybox`).
- **Cosmic Drift** preset (4th launch preset): plate (parallax-plane) + thin brass veil (opacity 0.4) + starfield.

**C5 hybrid composite — PASS.** Frame luma std **36.9** (rich photoreal detail composited in, not flat); corner luma **[39.7,3.9,20.8,30]**, maxCorner **39.7 < 70** → corners feathered to DARK atmosphere, no bright pasted-oval halo. (cornerSpread/ovalEdge are high but REPORTED-only — they reflect the plate's legitimate nebula-band structure, not a seam.) Evidence: `p2/cosmic-drift-hybrid-full.png`, real-app `p2/desktop-preview-app-cosmic-drift.png`.
**C6 parallax-plane depth — PASS.** Depth map deforms the plate vs a flat control by warp **33.2** (real 3D geometry, not flat); under a matched camera pan the displaced plate's image-shift (**15.1**) differs from the flat control's (**25.2**) by **40%** (`panShiftDiffFrac 0.40`) — a flat plane and a depth-displaced surface can only move differently under the same translation if the surface has real depth → that difference IS parallax. Evidence: `p2/*-plate-{disp,flat}-camx{0,5}.png`, `p2/metrics-c5-c6.json`. tsc 9 (baseline, 0-new).
## P3 — splat preset (Spark 2.0, desktop/T2) — TODO
## P4 — library UX + camera-journey readiness — TODO
## P5 — verification + capstone — TODO
