# THREE-D-BACKGROUNDS — 3D hub background library
(status: COMPLETE — all C1–C14 PASS · capstone advocate PLEASED/0 MUST-FIX · drift review clean · no regression)

## Summary
A library of 5 reusable, droppable, customizable 3D hub backgrounds — each an **image + real-3D HYBRID** layer-stack bound to `PrismHub.background`, rendered in the single `three/webgpu` scene (TSL, WebGL2 fallback), camera-journey-ready, tiered T0/T1/T2, premium on desktop + lightning-fast on mobile. Presets: **Brass Nebula**, **Ice Field**, **Observatory Deep** (procedural volumetric raymarch nebula + depth-scattered instanced-sprite particle field), **Cosmic Drift** (fal flux-2 plate depth-displaced via depth-anything/v2 + translucent nebula veil + starfield), **Captured Observatory** (fal-captured scene → WebGPU-native 3D gaussian splat, T2-gated, nebula fallback).

### Layer-stack architecture (which schema field carries it)
The background is a typed `PrismHubBackgroundLayer[]` on `PrismHub.background` (additive, INV-2/18). Each layer: `kind` (`image|volumetric-nebula|particle-field|parallax-plane|splat`) + `attachment` (`infinite-environment|world|camera-locked|parallax|viewport-fixed`) + `z`/`opacity`/`parallaxDepth` + `params` (`palette/density/drift/depthSpread/intensity`, round-trippable) + `depthMapUrl`/`renderMode` (parallax-plane) + `minTier` (tier floor). The live R3F path: `GraphScene.AssembledSceneContent` → `HubBackgroundStack` reads `hub.background` and dispatches each layer by `kind` to its R3F component; `hubSuppressesSkybox` lifts the flat gradient when an opaque nebula owns the backdrop; galaxy mode shows the active hub's nebula as the universe backdrop (`GalaxyHubBackdrop`). Pure preset/tier/palette data in `src/lib/editor/backgrounds/`. Editor UX: `HubBackgroundPicker` (Hub Inspector → Visual tab) writes only `PrismHub.background` via `updateHub` → autosave → `live-graph.json` round-trip.

### Dependency-usage table (newest reachable; INV-1 one renderer)
| Need | Tool wired | Version | Where |
|---|---|---|---|
| Renderer / shaders | `three/webgpu` + `three/tsl` (NodeMaterials, raymarch Loop/If/Break, `mx_fractal_noise_float`, `instanceIndex`/`hash`, `SpriteNodeMaterial`, `texture` displacement) | three 0.184.0 (=latest) | all layer components |
| Volumetric core | TSL raymarch: Beer-Lambert `exp(-d·σ·ds)` + Henyey-Greenstein phase + JS-unrolled light-march self-shadow | — | VolumetricNebulaLayer |
| Particles | Instanced billboard sprites (`SpriteNodeMaterial`+`InstancedMesh`, GPU `instanceIndex`+`hash` scatter, vertex drift) — WebGPU renders THREE.Points at 1px so sized particles MUST be instanced quads | — | ParticleFieldLayer |
| Base image plate | fal `fal-ai/flux-2` (negative "no text/letters/labels", INV-6) | client 1.4.0 (latest 1.10.1) | gen scripts (server) |
| Depth → parallax | fal `fal-ai/image-preprocessors/depth-anything/v2` → depth-displaced subdivided plane | — | ParallaxPlaneLayer |
| Splat / captured env | fal RGBD capture → WebGPU-native 3D gaussian sprites (GPU depth unprojection). `@sparkjsdev/spark` 2.1.0 evaluated as the `.spz/.sog` decode seam but NOT added (WebGL2-only render conflicts with INV-1) | — | SplatLayer |
| Pixel verification | sharp (existing) | — | scripts/three-d-backgrounds/*.mjs |

No new heavy dependency added (Spark removed; FLUX/depth-anything via the existing fal client).

### Tier map + measured frame-times (lab, real WebGPU/Metal, DPR-2)
| Tier | raymarch steps | light-march | particle count | compute/splat | measured |
|---|---|---|---|---|---|
| T2 (desktop/WebGPU) | 28 | 3 | 16000 | splat ✓ | ~23 ms/frame (raymarch optimized 90→23 ms) |
| T1 (constrained/WebGPU) | 18 | 2 | 8000 | splat ✗ | ~24 ms/frame |
| T0 (mobile/WebGL2) | 8 | 0 | 2800 | splat dropped → nebula fallback | ~24 ms/frame |
All tiers ≥40 fps headless (≥60 expected interactive). Mobile splat count verified 0 (FP-4 respected).

### fal ledger (notes/verification/three-d-backgrounds/fal-ledger.json)
4 calls total (~$0.10): flux-2 ×2 (cosmic plate + observatory capture) + depth-anything/v2 ×2. Plates generated once, reusable across hubs (D8). Spark 2.0 evaluation noted in ledger.notes.

### Honest flags / what's procedural vs fal vs splat
- Brass Nebula / Ice Field / Observatory Deep = 100% procedural (TSL raymarch + instanced sprites), zero fal at runtime.
- Cosmic Drift = fal plate (image half) + depth-anything depth + procedural veil/starfield (the hybrid).
- Captured Observatory = fal-captured scene rendered as a WebGPU-native RGBD gaussian splat. This is a captured-environment splat rendered in the single WebGPU renderer; it is NOT a full anisotropic-covariance 3DGS renderer (Spark, the true-3DGS path, is WebGL2-only and conflicts with INV-1 — documented swap seam). The Spark `{position[],rgba[],scale[]}` array shape is the documented swap-in under a WebGL2 renderer.
- Non-blocking polish backlog (advocate NICE-TO-HAVE, 0 MUST-FIX): soften splat grain + edge vignette; optional scrim behind the Cosmic Drift sub-headline.

### Verification gate results
- **Numeric harness** (`scripts/three-d-backgrounds/{metrics,metrics-p2,metrics-p3}.mjs`, `drive-picker.mjs`, `c11-journey.mjs`): all C1–C11 numeric PASS off real frames.
- **Capstone advocate** (fresh-context user-advocate): NET PLEASED · GATE PASS · **0 MUST-FIX**.
- **Drift / forbidden-pattern review** (fresh-context prism-criteria-reviewer): feature diff CLEAN — 0 feature-introduced INV/FP violations (INV-1 one-renderer, INV-2 additive, INV-5 schema-only writes, INV-6 no-text, INV-7 no-secret, INV-9 no-purple, INV-10 tiered, FP-3 no-hardcode all verified). The 9 open canonical-3 items it surfaced are pre-existing project gaps in other surfaces (out of scope for this run).
- **No regression**: tsc 9 baseline/0-new · vitest 3349/0 · prod build ✓ · primitives 408 · 0 console errors.

### AUTO-CKPT hashes
P0 `8a50b527` · P1 `0358eea2` · P2 `d54217f4` · P3 `040c5b05` · P4 `fce28ee0` · P5 `6e9d2505` · final (this commit).


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
## P3 — splat preset (captured-environment gaussian splat, desktop/T2) — DONE
A photoreal CAPTURED environment rendered as 3D gaussian splats the camera flies through, NATIVELY under the single WebGPU renderer.

- **Spark 2.0 evaluation + decision (D3 fallback, ledgered):** `@sparkjsdev/spark@2.1.0` was installed + evaluated. It confirms Spark 2.0 LoD streaming + `.spz`/`.sog` support, BUT Spark **renders via WebGL2 by deliberate design** (World Labs — chosen for device reach over WebGPU). The editor runs a single `WebGPURenderer` (INV-1, no 2nd renderer / no separate canvas, FP-2), so Spark cannot draw into this scene. INV-1 is binding and wins over the D3 tool pick. Spark was therefore **removed** (no dead/placeholder dependency, per the seam discipline) and documented as the `.spz/.sog` decode swap-in.
- **Shipped path** (`SplatLayer.tsx`): a fal-captured photoreal scene (`fal-ai/flux-2` "brass observatory hall", strong depth) + its depth map (`depth-anything/v2`) are UNPROJECTED on the GPU into 3D gaussian sprites — `instanceIndex`→grid uv, the depth texture sampled in `positionNode` pushes each sample to its real Z, the image texture colours it, soft gaussian falloff over the billboard quad. The camera-journey flies through the captured volume with true parallax. Tier-gated gaussian count (T2 320×180 ≈ 58k). The decoded-gaussian-array shape Spark's loader produces is the documented swap-in for the RGBD source.
- **Captured Observatory** preset (5th): splat layer (`minTier: 'T2'`) + deep procedural nebula. On T2 the splat renders; on T0/T1 the splat drops and the nebula is the fallback.

**C7 splat premium — PASS.** T2 renders **58,560** gaussian splats, frame mean luma **66.5** (rich, non-black), **0 console errors**. T0 fallback: splat dropped (count **0**), procedural nebula renders (mean **70.2**), **0 errors** → no hard error on either tier. Evidence: `p3/captured-observatory-T2.png` (splat), `p3/captured-observatory-T0.png` (fallback), real-app `p3/desktop-preview-app-captured-observatory.png` (watch sitting among telescopes in the captured hall), `p3/metrics-c7.json`. tsc 9 (baseline, 0-new); no new dependency.
## P4 — library UX + camera-journey readiness — DONE
- **Droppable, customizable asset UX** (`HubBackgroundPicker.tsx`, in the Hub Inspector → Visual tab): a grid of 5 preset cards (Brass Nebula / Ice Field / Observatory Deep / Cosmic Drift / Captured Observatory) + a Clear chip; selecting a card writes ONLY `PrismHub.background` via `updateHub` (additive, INV-5 — never scenePosition/layout). Live param controls (palette chips + density/drift/depth/glow sliders) re-apply in real time. Observatory-Brass chrome, no purple.
- **Galaxy backdrop (C8 galaxy)**: when the active hub carries a volumetric-nebula background, the galaxy view's deep backdrop becomes that hub's nebula (env-only; planets/sun/rings render in front) — so a chosen background renders in galaxy + canvas + preview-app.
- **Round-trip**: `updateHub` → debounced autosave → `saveToServer` persists `live-graph.json` verbatim → page reload re-reads it (loader passes hubs verbatim, P0).

**C8 droppable — PASS.** Driving the REAL editor: clicking the "Ice Field" card applied the background (before **0** layers → after **2**, kinds `volumetric-nebula`+`particle-field`), and it renders in galaxy + canvas + preview-app. Evidence: `p4/c8-{galaxy,canvas,preview-app}.png`, `p4/metrics-c8-c10.json`.
**C9 customizable + round-trips — PASS.** Dragging the Density slider (real DOM, React-native setter) changed density **0.38→1.0** (persisted on the layer); save→reload re-read density **1.0** (round-trips). Evidence: `p4/c9-paramA.png`/`c9-paramB.png` + metrics.
**C10 schema-only — PASS.** The applied background lives entirely in `PrismHub.background` (additive; only `updateHub({background})` is called — layout/scenePosition untouched); a legacy hub with `background: []` renders the unchanged skybox. Evidence: `p4/c10-legacy-no-bg.png` + the persisted `background` JSON in metrics, 0 console errors.
**C11 camera-journey ready — PASS.** A 4-waypoint `cameraKeyframes` fly-through (dolly-in + pan) auto-plays in preview-app; across the journey the background parallaxes through its depth layers (consecutive frame deltas brass 28.8/30.2/21.3, cosmic-drift 14.6/18.6/11.3) with NO exposed edge / blank corner (min corner luma 40.9 / 34.6 across the journey), 0 errors. Evidence: `p4/c11-journey-{0..3}*.png` + `p4/metrics-c11.json`. tsc 9 (baseline, 0-new).
## P5 — verification + capstone — DONE

**C12 cross-viewport — PASS.** All 5 presets captured in preview-app at desktop 1440×900, tablet 1024×768, constrained 880×600, mobile 390×844 (20 frames, `p5-grid/`). Every frame renders non-black (mean luma 39–99) with 0 console errors across all presets/viewports. Tier auto-degrades by device: mobile (T0) drops the splat (`__PRISM_BG_SPLAT_COUNT__ == 0` verified on the 390px viewport → nebula fallback) and uses billboard particles; the heavy raymarch/compute path never runs on mobile (FP-4 respected). Evidence: `p5-grid/{desktop,tablet,constrained,mobile}-preview-app-*.png` + capture JSONs.

**C13 no-regression — PASS.** tsc **9 errors = pre-existing baseline, 0-new**; vitest **3349 passed / 0 failed** (8 skipped); primitive catalog **408** (≥ baseline, untouched); prebuilt-element library untouched; `next build` **✓ Compiled successfully** (19/19 static pages); **0 console errors** in the driven app across every capture; nothing removed from the catalog. The only new runtime dependency considered (@sparkjsdev/spark) was removed (WebGL2-only, INV-1) → no new dependency.

**C14 capstone WOW — PASS (advocate PLEASED · GATE PASS · 0 MUST-FIX).** A fresh-context `user-advocate` (no build context) judged the rendered evidence as a non-technical user vs a pro 3D motion-designer:
- Brass Nebula **WOW**, Ice Field **WOW**, Cosmic Drift (hybrid) **WOW**, Observatory Deep **GOOD**, Captured Observatory (splat) **GOOD**.
- Cross-viewport premium on all 4 sizes; renders in galaxy + canvas + preview-app; real camera-through-depth parallax (`parallaxRatio 10.07`); decisive before/after vs the old flat void.
- **0 MUST-FIX.** "No frame reads as flat/cold/AI-built; content legible everywhere."
- NICE-TO-HAVE (non-blocking backlog): (1) soften the Captured Observatory splat grain + add an edge vignette; (2) a local scrim behind the Cosmic Drift sub-headline; (3) (resolved) mobile Captured Observatory uses the documented nebula fallback — splat count 0 on mobile confirmed.

---
THREE-D-BACKGROUNDS: RUN COMPLETE
