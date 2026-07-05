# PROTOTYPE V2 RESEARCH BRIEF — ORRERY No.7

**A luxury watchmaker app + custom 3D watch configurator, built inside Prism's three/webgpu runtime.**
Mission: ship a real, beautiful, shippable 3D app that SMOKES SliderRevolution's best 3D/scroll-morph templates and sits beside Awwwards-level 3D sites — while proving the Prism editor builds production apps.

Date compiled: 2026-06-20 · Synthesis of 6 parallel research findings · Web claims cited inline.
Repo: `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing`

---

## EXECUTIVE SUMMARY (12 lines — relay this)

1. **Stack is sound — do NOT chase alphas.** Stay on three r184 / R3F v9 / drei v10 / postprocessing v6. Refresh `^`-floated deps with `npm update`; the only hard fix is gsap pinned `3.13.0 → 3.15.0`.
2. **Reject the v10/v7/v11 alphas** (R3F v10, postprocessing v7, drei v11) for a flagship — API churn, no stability guarantee.
3. **WebGPU + TSL is our "1 year ahead" lever** — TSL materials, GPU-compute particles (millions vs CPU's ~50K), progressive WebGPU→WebGL2→static-poster fallback (~95% coverage).
4. **The 410-primitive catalog IS the animation vocabulary** — every feature maps to existing primitives via `listByCategory()`; the "no bespoke" rule is rescinded but reach for the catalog first.
5. **Liquid Glass = lensing, not blur.** Use it as a hero accent on ≤2–3 surfaces (sapphire crystal, configurator chrome, single nav layer), never the global skin; always tint glass-over-text.
6. **The bar to beat is NOT SliderRevolution** (2.5D layer compositing) — it's Cartier W&W, Lando Norris, Apple product pages. Beating SR is table stakes.
7. **Our unbeatable differentiator: ONE continuous path-traced 3D cosmos** you fly through on scroll, where components detach into your hands to build the watch live, then your creation becomes the closing hero.
8. **Narrative → configurator → narrative, one world** — nobody (Cartier, Nike, Scout) fuses cinematic scroll AND a real drag-drop photoreal configurator in continuous 3D space.
9. **Configurator = ordered assembly stack** (movement-out, 11 layers), constraint-as-feature (illegal combos disabled with reasons), curated-palette + full-picker + sample-from-image dual track.
10. **Two input modes**: tap-to-apply (primary, all devices) + drag-drop magnetic snap (desktop showpiece, Rapier physics). Responsive: drag→tap collapse on touch, bottom-sheet catalog on mobile.
11. **Photoreal parts via fal.ai** image pipeline → Blender/GLB → Draco + KTX2; optional Gaussian Splatting for env. Budget gated by `provision-assets` script + dependency-allowlist hook.
12. **Open risks**: WebGPU GPU-memory contention (transformers.js + path tracing share device), transmission re-render budget (≤2 live), theatre.js adoption risk (prefer GSAP), mobile path-tracing fallback fidelity.

---

## 1. VERSIONS — PIN / UPGRADE

All "current stable" figures pulled live from the npm registry. Versions marked **(not in repo)** are prospective additions, not yet installed.

### 1.1 Version table

| Package | Repo (package.json) | Current stable (npm) | Status | Action |
|---|---|---|---|---|
| `three` | `^0.184.0` (r184) | **0.184.0** | ✅ Current | None — at head. |
| `@react-three/fiber` | `^9.1.0` | **9.6.1** | ⚠️ floats, lockfile stale | `npm update`. **Stay v9.** |
| `@react-three/drei` | `^10.0.0` | **10.7.7** | ⚠️ floats | `npm update`. **Stay v10.** |
| `@react-three/postprocessing` | `^3.0.4` | **3.0.4** | ✅ Current | None. |
| `postprocessing` (pmndrs) | `^6.37.0` | **6.39.1** | ⚠️ floats | `npm update`. **Stay v6.** |
| `three-msdf-text-webgpu` | `^2.1.0` | **2.1.0** | ✅ Current | None. |
| `zundo` | `^2.3.0` | **2.3.0** | ✅ Current | None. |
| `immer` | `^11.1.8` | **11.1.8** | ✅ Current | None (ignore mis-tagged v4 `next`). |
| `gsap` | `3.13.0` **(PINNED)** | **3.15.0** | ⚠️ Behind + pinned | **Bump to `^3.15.0`.** Fully free incl. SplitText/MorphSVG/ScrollSmoother since 3.13 (Webflow relicense). |
| `camera-controls` | `^3.1.0` | **3.1.2** | ✅ floats | `npm update`. |
| `lenis` | `^1.3.0` | **1.3.23** | ✅ floats | `npm update`. |
| `zustand` | `^5.0.2` | **5.0.14** | ✅ floats | `npm update`. |
| `@fal-ai/client` | `^1.4.0` | **1.10.1** | ⚠️ floats | `npm update`. Server-side only, off client critical path. |
| `@dimforge/rapier3d` | **(not in repo)** | **0.19.3** | New dep | Use `rapier3d-compat@0.19.3` (inlined base64 WASM, no bundler config). |
| `@huggingface/transformers` | **(not in repo)** | **4.2.0** | New dep | v4 stable, C++ WebGPU runtime. `device:'webgpu'`. |
| `@theatre/core` / `@theatre/studio` | **(not in repo)** | **0.7.2** | ⚠️ Stalled | **Optional/frozen — prefer GSAP.** Public releases frozen; v1.0 dev moved private. |

### 1.2 Upgrade risks & migration notes

- **three r184 — STAY, do not jump architecture.** r183 renamed `PostProcessing` → `RenderPipeline` (node-based post); r184 added FSR1 port for WebGPURenderer. Repo is already TSL-only on `three/webgpu` — correct posture. ⚠️ Watch the r181→r182 regression where `MeshStandardMaterial.transparent` handling changed (some materials stopped rendering) — **verify watch materials after any patch bump**. `stats-gl` no longer WebGPU-compatible as of r181. Sources: [r184](https://github.com/mrdoob/three.js/releases/tag/r184), [r182 transparent thread](https://discourse.threejs.org/t/upgrading-from-r181-to-r182-meshstandardmaterial-transparent/91286), [WebGPU migration 2026](https://www.utsubo.com/blog/webgpu-threejs-migration-guide).
- **R3F 9.6.1 / drei 10.7.7 — minor bump, low risk.** Pairs with React 19 (repo on 19.0.0) + three r184. ⚠️ **R3F v10 is alpha-only** (10.0.0-alpha.2) — major rewrite (dual WebGL/WebGPU renderer, new `useFrame` scheduler, WebGPU hooks). "Consider all features experimental" per pmndrs. **Not for a shippable flagship.** TransformControls + configurator gizmos are stable in drei 10.7.7. Sources: [R3F releases](https://github.com/pmndrs/react-three-fiber/releases), [drei npm](https://www.npmjs.com/package/@react-three/drei).
- **postprocessing 6.39.1 — floats fine.** ⚠️ **v7 is alpha/beta only** (WebGPU/TSL rewrite). On `three/webgpu`, prefer three's native `RenderPipeline` nodes (r183+) for the WebGPU path; keep pmndrs v6 for WebGL2 fallback. Source: [Three.js post-processing 2026](https://threejsroadmap.com/blog/the-complete-guide-to-threejs-post-processing-in-2026).
- **theatre.js — ADOPTION RISK.** Latest public stable 0.7.2; repo publicly stalled, v1.0 dev moved private, no public ETA. For a flagship, depending on a pre-1.0 publicly-stalled runtime is real risk (no bug-fix cadence, possible three r184/React 19 incompatibility). **Recommendation: GSAP timelines (free, maintained, 3.15.0) for choreography; add theatre.js only if you specifically need its visual sequence editor — pin and treat as frozen.** Sources: [@theatre/core npm](https://www.npmjs.com/package/@theatre/core), [releases](https://www.theatrejs.com/docs/latest/releases).
- **rapier3d 0.19.3 (new).** Use `@dimforge/rapier3d-compat@0.19.3`. ⚠️ 0.18→0.19 breaking: `Toi`/`ToiDetails` → `ShapeCastHit`/`ShapeCastHitDetails`; `castShape`/`castCollider` need a required `targetDistance`; default builds no longer ship enhanced-determinism (use `@dimforge/rapier3d-deterministic` if needed). Starting fresh on 0.19 avoids migration. Sources: [CHANGELOG](https://github.com/dimforge/rapier.js/blob/master/CHANGELOG.md), [npm](https://www.npmjs.com/package/@dimforge/rapier3d).
- **transformers.js 4.2.0 (new).** v4 stable (4.0 preview Feb 2026). New C++ WebGPU runtime via ONNX Runtime Web, ~200 architectures, up to 4× faster embeddings. Package is `@huggingface/transformers` (NOT the dead `@xenova/transformers`). ⚠️ Large WASM/model download footprint; WebGPU buffer-size limits on some GPUs; **shares the page's WebGPU device with three/webgpu — watch GPU-memory contention.** Sources: [v4 release](https://howaiworks.ai/blog/transformers-js-v4-release), [WebGPU guide](https://huggingface.co/docs/transformers.js/guides/webgpu).

### 1.3 Recommended action (low-risk, ship-safe)

1. `npm update` to refresh the lockfile for all `^`-floated deps (R3F→9.6.1, drei→10.7.7, postprocessing→6.39.1, lenis, zustand, camera-controls, fal). Non-breaking.
2. Bump pinned **gsap `3.13.0` → `^3.15.0`**.
3. Stay on **three r184 / R3F v9 / drei v10 / postprocessing v6** — no alphas.
4. New deps: pin **rapier3d-compat 0.19.3** + **@huggingface/transformers 4.2.0**; treat **theatre.js 0.7.2** as optional/frozen.
5. **Update `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/.claude/hooks/dependency-allowlist-check.sh` additively BEFORE any new import** (rapier/transformers/theatre) — the build hook blocks un-allowlisted imports.

Key files: `package.json` (deps), `.claude/hooks/dependency-allowlist-check.sh` (allowlist guard).

---

## 2. DESIGN-REFERENCES LEVERAGE MAP

The toolkit (use it HEAVILY — every interaction reaches into `listByCategory()` rather than authoring bespoke shaders).

**Source files (all absolute):**
- `docs/prism/DESIGN-REFERENCES.md` (1066 lines, 16 sections + recipe stacks)
- `docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md` (330 lines, 9 seed primitives + 6 TSL shaders)
- `src/lib/prism/animatable/primitives/` (410 `.ts` files — 407 registered primitives + 3 helpers)

**Builder API** (`src/lib/prism/animatable/registry.ts`): `getPrimitive(name)`, `listByCategory(cat)`, `listPrimitives()`, `primitiveCount()`. Each primitive is a `PrimitiveDefinition` with a declarative `ControlSchema` (knob/fader/dropdown/curve/toggle/color) — every parameter is canvas-editable. Drivers: `time | scroll | pointer | state | event`. Subjects: `card | text | plane | sphere | empty`. 14 primitives are `mountable:true` (ambient FX on built artifacts).

**Architectural note:** the "no bespoke animation" framing in CINEMATIC-PRIMITIVES-LIBRARY.md is **RESCINDED** (line 6). The 410-catalog is the real vocabulary; the 9 seeds are a subset. Bespoke authoring IS allowed — but reach for the catalog first.

### 2.1 The 410-primitive catalog (categories, counts, sample names)

| Category | Count | Sample primitives |
|---|---|---|
| **particles** | 89 | `galaxy-particles`, `fireworks`, `confetti`, `image-to-particles`, `particle-assemble`, `murmuration`, `flocking`, `fluid-sph`, `n-body-orbit`, `constellation-net`, `meteor-shower`, `explode-reassemble-sim`, `cosmic-dust` |
| **transform** | 58 | `cube-rotate`, `flip-3d`, `card-fold`, `unfold`, `spring-arrive`, `weightless-drift`, `float`, `tumble-settle`, `door-open`, `swap-flip-morph`, `genie-suck` |
| **text** | 47 | `text-wave-3d`, `text-extrude-rotate`, `glitch-text`, `decode-text`, `typewriter`, `text-magnetic-in`, `text-gradient-sweep`, `liquid-text`, `text-mask-reveal`, `split-3d`, `scramble`, `neon-flicker-text` |
| **scroll** | 38 | `scroll-scene-scrub`, `scroll-depth-dolly`, `scroll-orbit-scrub`, `scroll-rotate-3d`, `scroll-snap-sections`, `scroll-velocity-stretch`, `scroll-flip-book`, `scroll-path-scrub`, `sticky-pin`, `parallax`, `scrub-morph`, `reveal-mask-scroll` |
| **glass** | 24 | `liquid-glass`, `iridescent-glass`, `gemstone-cut`, `crystal-facet`, `frosted-glass`, `fluted-glass`, `glass-refraction`, `dispersion`, `bevel-glass`, `ice-glass`, `soap-bubble` |
| **pointer** | 23 | `magnetic`, `magnet-snap`, `magnetic-stick`, `pointer-tilt-3d`, `pointer-loupe`, `pointer-shine`, `pointer-ripple`, `hover-lift`, `proximity-rim-glow`, `gravity-well`, `cursor-trail`, `spotlight-follow`, `velocity-skew-follow` |
| **displacement** | ~37 | `displacement-transition`, `shatter`, `shatter-assemble`, `crumble-to-particles`, `liquefy-reveal`, `hover-liquid-distort`, `melt`, `origami-fold`, `pixel-sort-sweep`, `datamosh`, `swirl-warp`, `lens-bulge`, `voxelize` |
| **wave** | ~35 | `ocean-fft`, `water-surface`, `ripple-interference`, `cloth-drape-sim`, `flag-wind-sim`, `jelly-surface`, `wave-grid`, `heat-haze-warp`, `curtain-wave` |
| **shimmer** | ~30 | `brushed-metal`, `liquid-metal-flow`, `iridescence`, `pearlescent`, `holographic`, `gold-glint`, `metallic-sheen`, `velvet-sheen`, `satin-band`, `prism-spectrum`, `rainbow-fresnel-edge`, `moonstone-sheen`, `diamond-sparkle`, `light-sweep`, `caustic-shimmer` |
| **volumetric** | ~28 | `nebula`, `aurora`, `godray`, `light-shafts`, `volumetric-cone`, `fire-flame`, `candle-flame`, `plasma`, `magma-cracks`, `clouds`, `fog`, `galaxy-spiral`, `supernova`, `lightning-bolt` |
| **mask** | ~25 | `sdf-shape-morph`, `metaball-merge`, `mask-iris-morph`, `clock-wipe`, `diamond-wipe`, `iris-wipe`, `morph-into-card`, `pill-morph`, `noise-wipe`, `domain-warp-morph`, `skeleton-resolve` |
| **smoke** | ~17 | `smoke-plume-sim`, `smoke-ring`, `ink-bloom`, `ink-swirl`, `genie-column`, `mist-drift`, `dust-poof`, `wispy-smoke`, `steam` |
| **caustics** | ~13 | `caustics`, `underwater-caustics`, `pool-caustics`, `caustic-net`, `gem-caustics`, `lava-caustics`, `dappled-light`, `flowing-caustics`, `edge-caustics` |
| **fade** | ~13 | `cross-dissolve`, `dissolve-noise`, `fade-through-black`, `fade-vignette`, `fade-pulse`, `flash`, `blink`, `fade-flicker-in` |
| **blur** | ~8 | `zoom-blur`, `motion-blur-streak`, `chromatic-blur`, `focus-rack`, `defocus-pulse`, `tilt-shift-pulse`, `blur-in`, `blur-spin` |

### 2.2 Feature → toolkit mapping (so the builder uses these HEAVILY)

**F1 — Cinematic scroll-morph landing (the SR killer).** Primitives: `scroll-scene-scrub` (three-act mini-film), `scroll-depth-dolly`, `scroll-orbit-scrub`, `scroll-rotate-3d`, `scroll-path-scrub`, `scroll-snap-sections`, `scrub-morph`, `sticky-pin`, `reveal-mask-scroll`, `parallax-layers`. Deps: **Lenis** (smooth-scroll foundation) + **GSAP ScrollTrigger** (free) drives scrubbed timelines; `scroll`-category primitives register ScrollTriggers internally. Drive shader/camera uniforms off `scroll.y / limit.y` (0→1). Technique: DESIGN-REFERENCES §11 "Scroll-Driven Vertex Waves."

**F2 — 3D dropdown menus & nav.** Primitives: `text-*` reveals (`text-fade-up-each`, `text-flip-each`, `text-magnetic-in`); `accordion-y`, `card-fold`, `unfold`, `door-open`, `cylinder-unroll` for panel opening; `magnetic`/`magnet-snap`/`hover-lift`/`proximity-rim-glow` on items; `fade-scale`/`scale-pop` stagger. Deps: text MUST render via `ctx.fontAtlas` (MSDF, `three-msdf-text-webgpu`) — **never `THREE.TextGeometry`, never DOM overlays** (INV-R11). Technique: View Transitions API (§14, baseline Oct 2025) for menu→section morphs.

**F3 — Drag-drop part snap (configurator core).** Primitives: `magnet-snap` (pointer — spring pull, tunable reach/stiffness), `magnetic`, `gravity-well` (attract toward slot), `spring-arrive`/`spring-chain-follow` (settle), `drop-bounce`/`squash-stretch-in`/`overshoot` (satisfying landing), `throw-physics`/`drag-elastic-warp` (release). Deps (§10): **Rapier** rigid-body collision + joint snapping; Cannon-es JS fallback. Reuse repo's `hub-geometry.findNearestHub` for slot detection; mirror the Round-2 "Clone + auto-snap" (SC-075..077: drag→nearest-target→tether-line→pointer-up-commit).

**F4 — Real-time material swap (finish picker).** Primitives (glass): `liquid-glass`, `iridescent-glass`, `gemstone-cut`, `crystal-facet`, `frosted-glass`, `glass-refraction`, `dispersion`, `bevel-glass`. Primitives (shimmer/metal): `brushed-metal` (anisotropic turned aluminum), `liquid-metal-flow`, `gold-glint`, `metallic-sheen`, `iridescence`, `pearlescent`, `velvet-sheen`, `moonstone-sheen`, `prism-spectrum`. Deps (§3): **TSL + `MeshPhysicalNodeMaterial`** — swap `colorNode`/`metalnessNode`/`roughnessNode` live; updatable `uniform()` nodes = zero-rebuild finish changes. Finish dropdown maps onto primitive `ControlSchema` params (Save vs Save-and-Rebuild, Round-2 RA-16); preview-state overlay shows change before commit.

**F5 — Marketing sections.** Primitives: `text-*` headline reveals (`text-extrude-rotate`, `text-wave-3d`, `text-gradient-sweep`, `text-mask-reveal`); `particle-assemble`/`image-to-particles`/`tiles-assemble` hero builds; `depth-pop`/`perspective-tilt-in`/`scroll-stagger-rise` entrances; ambient `aurora`/`nebula`/`cosmic-dust`/`constellation-net`/`godray` backgrounds; `displacement-transition`/`cross-morph` between panels. Deps: §4 **postprocessing** for bloom/vignette mood; §5 **Barba.js** OR native View Transitions; §12 **Rive** for micro-animation state machines (10× smaller than Lottie).

**F6 — Photoreal materials (luxury surfaces).** Primitives: glass + shimmer sets, plus `caustics`/`gem-caustics`/`edge-caustics` for dial light-play, `holographic`/`rainbow-fresnel-edge` for guilloché/MOP, `fresnel-glow` for sapphire crystal rim. Deps (§3, §13): TSL `MeshPhysicalNodeMaterial` (transmission, clearcoat, anisotropy, iridescence). Asset pipeline: Blender → `.glb` with **Draco** (`gltf-pipeline -d`) + **KTX2** (`@gltf-transform/cli ... --texture-compress ktx2`), loaded via `GLTFLoader`+`DRACOLoader`+`KTX2Loader`. Optional **Gaussian Splatting** (`@mkkellogg/gaussian-splats-3d`) for env captures.

**F7 — Magnetic cursor / interaction.** Primitives (pointer): `magnetic`, `magnet-snap`, `hover-lift`, `pointer-tilt-3d`, `pointer-shine`, `pointer-ripple`, `pointer-loupe` (magnifier over watch detail), `cursor-trail`, `spotlight-follow`, `velocity-skew-follow`, `proximity-rim-glow`. Deps (§7): **mouse-follower** (Cuberto, needs GSAP) for skew + cursor states; **Cursify** (`MagneticCursor`) for DOM magnetism. Pointer primitives raycast against an invisible plane at target depth (`needsTick:true` + lerped `onTick`). Quality bar: "subtle, not gimmicky; multiple magnetic objects don't fight."

**F8 — Fluid / SDF morphs (transitions, liquid logo).** Primitives (mask/displacement): `sdf-shape-morph`, `metaball-merge` (mercury coalescing), `sdf-metablob`, `domain-warp-morph`, `liquid-stretch-morph`, `liquefy-reveal`, `morph-into-card`, `liquid-metal-flow`, `liquid-text`. Deps (§8, §9, §11): SDF math from **Inigo Quilez** (`opSmoothUnion(d1,d2,k)` is the named "magic sauce"); domain-warping (`fbm` into `fbm`) for organic fields; §11 "Liquid/Metaball" cookbook is the direct recipe.

**F9 — Postprocessing (cinematic grade).** Shipped TSL shaders: `radial-blur.tsl.js`, `rgb-shift.tsl.js`, `dissolve.tsl.js`, `displacement.tsl.js`, `voronoi-particle.tsl.js`, `twisted-wave.tsl.js`; plus `zoom-blur`, `motion-blur-streak`, `chromatic-aberration`, `focus-rack`, `fade-vignette`, `godray`. Deps (§4): **postprocessing (pmndrs)** — merge effects into ONE `EffectPass` (2–5× faster). ORRERY stack: `BloomEffect` (dial glow) + `DepthOfFieldEffect` (product bokeh) + `SSAOEffect` (contact shadows) + `VignetteEffect` + `ChromaticAberrationEffect` + `ToneMappingEffect`/`LUT3DEffect` (film grade) + `GodRaysEffect`. On WebGPU prefer native `RenderPipeline` nodes; keep pmndrs v6 for WebGL2 fallback.

### 2.3 §16 performance non-negotiables (60fps luxury vs stutter)

- **GPU/render:** `transform` over `top/left`; `will-change:transform` sparingly; `requestAnimationFrame` only; **`InstancedMesh`** for repeated geometry (orrery satellites, particles) = 1 draw call; `OffscreenCanvas`→Worker for heavy render; debounce scroll/resize.
- **Three.js:** dispose `geometry/material/texture` on cleanup (repo's `userData.cleanup()` contract enforces); **KTX2** + **DRACO** compression; **`THREE.LOD`** by distance; frustum culling on; monitor with stats-gl (WebGL only) + Spector.js.
- **Shader:** minimize `texture2D()` lookups; **avoid branching** (use `smoothstep` over `if`); `mediump` on mobile; **cap ray-march 64–100 steps**.
- **WebGPU (the runtime):** batch frequently-updated uniforms (time, camera) in ONE bind group, static data in another; **storage textures** for read/write compute (fluid, image-to-particles); `await renderer.renderAsync()` for compute sync; **always feature-detect** `navigator.gpu?.requestAdapter()` (auto WebGL2 fallback, ~95% coverage Feb 2026).
- **GPU compute > CPU particles:** CPU caps ~50K; TSL `instancedArray` + `computeAsync` does MILLIONS — use for `galaxy-particles`, `cosmic-dust`, `murmuration`, `image-to-particles`.
- **Lazy:** IntersectionObserver → dynamic `import()` of heavy scenes on scroll-into-view (matches per-hub mount model).

---

## 3. LIQUID GLASS — THE REAL TECHNIQUE + SELECTIVE USE

### 3.1 What it means now (the definition shifted)

**Apple's design language** (WWDC 2025, shipped iOS/macOS 26; WWDC 2026 added a user transparency slider after readability backlash). It is a *material system* defined by **lensing** — dynamically bending/concentrating light in real time to refract content behind it — plus **specular highlights that track device motion** and **adaptive shadows**. Floats UI on a layer *above* content for hierarchy. ([TechCrunch](https://techcrunch.com/2025/06/09/apple-redesigns-its-operating-systems-with-liquid-glass/), [Apple HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [PCQuest iOS 27 slider](https://www.pcquest.com/software/ios-27-liquid-glass-slider-wwdc-2026-12020131))

**The web trend**: a wave of JS/WebGL libs reproducing the look, with a stated migration **away from CSS `backdrop-filter` toward native WebGL/WebGPU refraction**. ([Lucky Graphics](https://lucky.graphics/learn/liquid-glass-css-glassmorphism-tutorial/))

### 3.2 The discriminator: frosted = blur (scatter); liquid glass = lensing (refract + disperse + specular)

| Cheap glassmorphism (`backdrop-filter: blur()`) | Real Liquid Glass |
|---|---|
| Scatters light → uniform blur, loses detail | Lenses light → bends/concentrates; bg legible but warped |
| Static, content-blind | Refraction reacts to actual content behind (incl. motion) |
| No edge optics | Bevel/rim refraction simulates glass thickness |
| No color physics | Chromatic dispersion (RGB bend at different angles) |
| No light response | Specular highlights track tilt; adaptive shadows |
| CSS-capped (~3 panels before GPU stall) | Shader-precision, physics-based |

### 3.3 Three implementation paths (pick by surface)

- **Path B (RECOMMENDED — native to our stack): three.js WebGPU + TSL `MeshPhysicalNodeMaterial` / `MeshTransmissionNodeMaterial`.** Supports `transmissionNode`, per-channel IOR `dispersion` (default 0.4), `thicknessNode`, `iridescence`, custom node inputs. Works on WebGPU + WebGL fallback. ⚠️ Verify the installed three exposes `dispersion` + transmission node (stabilized r168–r170+; we're on r184 so fine). ([MeshPhysicalNodeMaterial](https://threejs.org/docs/pages/MeshPhysicalNodeMaterial.html), [MeshTransmissionNodeMaterial](https://www.threejs-blocks.com/docs/MeshTransmissionNodeMaterial), [TSL](https://threejs.org/docs/pages/TSL.html))
- **Path A (R3F, fastest, best for 3D objects like the sapphire crystal): Drei `MeshTransmissionMaterial`.** Renders scene to FBO and refracts. Key params: `transmission:1`, `ior:1.5` (glass) → **`1.76` sapphire** / `2.42` diamond, `thickness:0.2–1.0`, `roughness:0.0–0.05` (low — `1.0` = frosted, the thing to avoid), `chromaticAberration:0.03–0.2` (THE dispersion knob), `anisotropy`/`anisotropicBlur`, `distortion`/`temporalDistortion` (animates without `useFrame`), `samples:6–16`, `resolution:256–1024`. ([Codrops glass torus](https://tympanus.net/codrops/2025/03/13/warping-3d-text-inside-a-glass-torus/), [Drei docs](https://drei.docs.pmnd.rs/shaders/mesh-transmission-material))
- **Path C (for flat 2D UI chrome — nav/dropdowns/panel): screen-space UV-displacement shader.** Sample back-buffer, displace UVs by a noise map, split RGB samples for dispersion, add an edge/bevel band (stronger displacement near borders) + animated specular sweep. Avoids a full transmission re-render per panel. Reference math: [Lucky Graphics](https://lucky.graphics/learn/liquid-glass-css-glassmorphism-tutorial/).
- **Reference libs (don't roll your own bevel/specular math):** [`naughtyduk/liquidGL`](https://github.com/naughtyduk/liquidGL) (shared canvas, bevel + specular + frost + `tiltFactor`, ~30 panels, Safari unstable >50% viewport), [`dashersw/liquid-glass-js`](https://github.com/dashersw/liquid-glass-js) (pixel-perfect iOS refraction + chromatic aberration).

### 3.4 Performance cost (why to use it selectively)

- **Each transmission object = a full extra scene re-render to an FBO.** Multiple panels = multiplied draw calls — the documented bottleneck. `samples`/`resolution` are linear multipliers; chromatic aberration adds 3× texture taps. CSS `backdrop-filter` caps ~3 panels; shared-canvas WebGL ~30. Rotation/scale on glass is "expensive." Apple's own readability backlash (≈50% found it hard to read) → transparency slider. **Never put liquid glass over dense text without a fallback tint.**

### 3.5 Guidance — USED, but NOT the basis of the design

Treat liquid glass as a **hero accent on 1–3 surfaces max**, not the global skin:

1. **Sapphire-crystal overlay on the watch (signature moment)** — Path B, `ior:1.76`, low `chromaticAberration` (~0.04), thin `thickness`, subtle specular sweep tracking the orbit camera. Physically *correct* for a luxury watch — sells "Prism builds real photoreal apps" better than any SR template.
2. **Configurator panel chrome** — one floating glass control surface lensing the watch behind it. Use **Path C** (no second transmission re-render); solid tint behind labels for readability.
3. **Nav / dropdown** — a *single* shared glass layer (one render target, reused), bevel + specular, never per-item glass.
4. **Everywhere else: opaque.** Marketing sections, footer, body text on solid/matte. Reserve dispersion + specular for moments you want the eye to go.
5. **Budget rule: ≤2 live transmission re-renders on screen at once.** Everything else = cheaper screen-space displacement or static glass tint. Always pair glass-over-text with adaptive tint.

---

## 4. THE BAR + HOW WE BEAT IT

### 4.1 SliderRevolution's most advanced 3D/scroll (the named competitor — and its ceiling)

SR is a WordPress/jQuery plugin; its "3D" is **layer-based pseudo-3D + WebGL post-effects, NOT a real scene graph.** Flagship offerings: [Glossy WebGL Slider](https://www.sliderrevolution.com/templates/glossy-creative-webgl-slider-template/) (a *carousel of rendered sculptures*, not a navigable scene); [Advanced Transitions add-on](https://www.sliderrevolution.com/addons/advanced-transitions/) (WebGL scene-change transitions); [WebGL addons](https://www.sliderrevolution.com/expand-possibilities-with-website-addons/) (particle clusters, ink-in-water fluid, bubble-morph); [Scroll-Driven Hero](https://www.sliderrevolution.com/templates/scroll-driven-hero-template-layered-parallax/) ("morph through pages" = layer parallax + scroll-triggered reveals). **The honest read: 2.5D compositing — no shared 3D world, no real camera, no PBR materials, no depth-correct occlusion. "Morph through pages in 3D" = scroll-triggered shape morphs + parallax, not a camera flying through continuous 3D space.**

### 4.2 The REAL bar — Awwwards/FWA-level 3D sites (2025–2026)

| Site | Studio | Why it's the bar | Source |
|---|---|---|---|
| **Lando Norris** | OFF+BRAND | Awwwards Site of the Year 2025 (8.18). Scroll-driven cinematic sequences, 3D helmet tracked to scroll, Rive motion graphics. WebGL + GSAP, in Webflow. | [Awwwards](https://www.awwwards.com/sites/lando-norris), [OFF+BRAND](https://www.itsoffbrand.com/our-work/lando-norris) |
| **Cartier W&W 2025** | Immersive Garden | **Direct competitor.** Six self-contained 3D "alcoves" scrolled like museum rooms; scenes dispose/load on nav; Web Audio score; hidden gesture Easter eggs. Three.js + Blender GLB + GSAP + Lenis + Web Audio. | [Awwwards](https://www.awwwards.com/sites/cartier-watches-wonders-2025), [webgpu.com](https://www.webgpu.com/showcase/cartier-watches-and-wonders-immersive-garden/), [Immersive Garden](https://immersive-g.com/projects/cartier-watches-and-wonders-24/) |
| **Bruno Simon** | self | Site of the Month Jan 2026. Fully playable physics world — you *drive* a car through sections (Three.js + Cannon). Nav IS the interaction. | [Metabole](https://metabole.studio/en/blog/immersive-website-examples) |
| **Scout Motors** | — | 3D product exploration baked into a scroll-driven **configurator path**. | [Metabole](https://metabole.studio/en/blog/immersive-website-examples) |
| **Apple product pages** | Apple | Scroll-driven PBR + dynamic lighting — device catches light as you scroll. Gold standard: *material authenticity sells the product.* | [MDX](https://mdx.so/blog/best-3d-websites-2026-examples) |
| **Lusion / Basement / Resend** | various | Basement: scroll-driven 3D planes w/ Rapier physics (R3F). Resend: "one excellent iridescent shader on simple geometry beats a complex scene with generic materials." | [MDX](https://mdx.so/blog/best-3d-websites-2026-examples) |

**Dominant 2025–2026 stack** (every winner): Three.js/custom WebGL/**WebGPU** + **GSAP ScrollTrigger** + **Lenis** + Next/Nuxt/Astro. ([Futurists](https://futurists.in/10-best-award-winning-websites-of-2026/))

### 4.3 Named techniques to match then exceed (the checklist)

From [Codrops cinematic GSAP scroll (Nov 2025)](https://tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap/) + breakdowns:
1. **Scroll-driven camera flythroughs** — GSAP timeline drives `cameraAnim` position + separate `targetAnim` look-at; `scrub:1` binds to velocity.
2. **Page-morph / scene transitions** — (a) dispose/load per section (Cartier), or (b) **screen-space shader transitions** (a transition mesh samples scene texture at fragment screen position → any shape reveals the underlying scene). ([Codrops gallery Feb 2026](https://tympanus.net/codrops/2026/02/02/building-a-scroll-revealed-webgl-gallery-with-gsap-three-js-astro-and-barba-js/), [Codrops WebGPU pipeline May 2026](https://tympanus.net/codrops/2026/05/19/80s-business-tech-seamless-scene-transitions-inside-shader-ses-scroll-driven-webgpu-pipeline/))
3. **Pinned-scroll choreography** — pin section; scrubbed sub-timelines fire char-by-char text (SplitText) + material morphs + particle reactions.
4. **Depth parallax** — fixed 3D canvas behind smooth-scrolled DOM; real Z-separation, not faked offsets.
5. **WebGL/WebGPU page transitions** — Barba.js/curtains.js: HTML → WebGL textured planes, shader reveal.
6. **Material realism on scroll** — PBR re-lit as camera moves; cinematic easings for luxury feel.
7. **Reactive shader detail** — particle opacity/velocity driven by scene motion (`uOpacity += (target-uOpacity)*0.15` lerp).

**Where they ALL fall short (our opening, cited [MDX](https://mdx.so/blog/best-3d-websites-2026-examples)):** they are **showcases, not tools** — you *watch* the 3D, rarely *build* in it. Configurators (Scout/Nike) are bolt-on, separate from the narrative scroll. Plus: mobile perf drain, LCP-blocking init, no fallback (blank page on WebGL fail), 8s+ loads, unskippable intros.

### 4.4 How ORRERY No.7 EXCEEDS the bar (concrete plan)

**Thesis: every site above is a film you scroll. Ours is a film you scroll that hands you the controls and lets you build the watch inside the same 3D world — then keeps filming.** That fusion is the unbeatable differentiator and is exactly what a Prism-built shippable 3D app can do that an SR template categorically cannot.

- **Beat on DIMENSIONALITY:** ONE continuous orrery (nested orbital rings of watch components as planets), not six disposed alcoves. Scroll camera flies a **continuous spline path** through orbital shells; sections are *regions of one world*, no load seams. True Z-depth nav + 6-DOF micro-parallax on pointer (gyro on mobile). **Scroll = orbital mechanics** — scroll advances orbital time; rings rotate, components precess into alignment. The narrative metaphor IS the geometry.
- **Beat on MATERIAL-REAL:** **WebGPU + TSL, not WebGL** (~95% capable, our "year ahead" lever). Real-time GPU path tracing / SSGI + TRAA for hero moments — physically-correct caustics through sapphire, metal anisotropy on brushed cases, true dial reflections. ([Three.js GPU PathTracer](https://threejsresources.com/tool/three-js-gpu-pathtracer)) Material morphs on scroll AND on config — Apple's "device catches light" but the user is *also* swapping rose gold → titanium live with path-traced lighting updating in real time.
- **Beat on INTERACTIVITY (configurator IS the scroll climax):** the cinematic flythrough decelerates, orbital components **detach into drag-droppable photoreal parts** in the same lit volume — no mode switch, no separate page. Drag-drop with physics + magnetic snapping (Rapier). Pinned-scroll "assembly reveal": scrub exploded → assembled, SplitText spec callouts per component. **Then it keeps filming** — built watch becomes the hero of the marketing close, orbiting in the final frame.
- **Beat on CRAFT (table-stakes polish, done right):** cinematic easings (`cinematicSilk` Bézier), GSAP + Lenis; Web Audio narrative score (orrery hum per shell, mechanical ticks during assembly); hidden gesture Easter eggs; **progressive WebGPU→WebGL→static-poster fallback** (no blank page), skippable intro, sub-3s LCP via Draco/KTX2 + atlasing + deferred 3D init after LCP. Being fast + accessible while this heavy is itself a flex.

**One-line pitch:** *SliderRevolution composites 2.5D layers; Cartier lets you tour six rooms; Apple lets you watch a product catch light. ORRERY No.7 is a single continuous, path-traced 3D cosmos you fly through on scroll — and at the heart of it, the components detach into your hands so you build the watch live, then watch your creation become the hero of the closing film.*

---

## 5. 3D WATCH-CONFIGURATOR — INTERACTION MODEL + RESPONSIVE + FEELS-FAST

### 5.1 Benchmark landscape (who to beat, June 2026)

Real-time, photoreal, cloud/edge-rendered luxury configurators — not static layer-swap WooCommerce:
- **Porsche Design Timepieces** — Unreal real-time, pixel-streamed via AWS. The "indistinguishable-from-render" visual bar. ([press.porsche-design.com](https://press.porsche-design.com/en/optimized-timepieces-configurator-sets-new-standards-in-the-customization-of-luxury-watches))
- **Piaget (Hapticmedia)** — 30+ materials real-time, **animated movement/complication simulation** (mechanism in motion), live guilloché/solarization/côte-de-Genève, **"pick a color from an image."** The craftsmanship-detail bar — the differentiator for a watchmaker. ([hapticmedia.com](https://hapticmedia.com/3d-configurator-watch/))
- **Baume (Hapticmedia)** — 2,000+ options. The breadth bar. ([hapticmedia.com](https://hapticmedia.com/3d-configurator-watch-baume/))
- **Czapek (Threedium)** — real-time materials/dials/straps. ([threedium.io](https://threedium.io/en-us/3d-configurator/czapek-watch-configurator))
- **Nike By You (relaunch)** — the interaction-model bar: fully manipulable 3D, zoom to inspect, **instant shareable snapshot render**, social sharing baked in. ([wwd.com](https://wwd.com/footwear-news/shoe-industry-news/nike-by-you-customization-relaunch-1238733104/))
- **Apviz / Smartpixels / Threekit / Zakeke** — CPQ/price-rules, AR try-on, tablet sales mode. ([apviz.io](https://apviz.io/solutions/3d-watch-configurator/))

**Market callout for copy:** McKinsey — online timepiece sales projected to ~$6B / 15–20% by 2025, up from 5% in 2019. ([apviz.io](https://apviz.io/blog/custom-watches/)) **Win condition to smoke SR:** a genuinely interactive, manipulable, buyable artifact with real material physics + a live mechanism — Prism shipping a real app, not a timeline.

### 5.2 Parts catalog — ordered assembly stack (build-from-the-movement-out, teaches horology)

Each layer = one catalog group; groups gate in build order so the preview is always coherent.

| # | Layer | Sub-options | Variant axis | Notes |
|---|---|---|---|---|
| 1 | **Movement/Caliber** | Automatic, manual, tourbillon, skeleton | — | Drives price floor + legal complications. Show it **running** (Piaget-style live mechanism). |
| 2 | **Case** | Shape (round/cushion/tonneau), size (38/40/42mm), profile | Material (steel/gold/platinum/titanium/ceramic) + finish (polished/brushed/sandblasted) | Cascades to crown + buckle defaults. |
| 3 | **Bezel** | Smooth, fluted, gem-set, tachymeter, dive | Material + gems | Snaps to case top ring. |
| 4 | **Dial** | Plain, guilloché, solarized, skeletonized, enamel, meteorite, aventurine | Color (full picker + curated palette), finish, texture | The hero customization. Live guilloché/solarization render. |
| 5 | **Hands** | Dauphine, baton, sword, breguet, syringe | Metal tone, lume on/off | Constrained to dial-legible contrast. |
| 6 | **Indices/Markers** | Applied, printed, roman, arabic, diamond | Metal/color | Couples to hands set. |
| 7 | **Crown** | Onion, flat, screw-down, gem-set | Material (defaults from case) | — |
| 8 | **Complications** | Date, GMT, moonphase, chrono, power-reserve, small-seconds | Sub-dial placement | **Gated by movement (step 1).** Conflicts disabled, not hidden — show *why*. |
| 9 | **Lume** | None, blue, green, ice | Intensity | Triggers **night/UV preview mode**. |
| 10 | **Strap/Bracelet** | Leather, alligator, rubber, NATO, integrated bracelet, Milanese | Color, stitching, buckle type | Buckle material defaults from case. |
| 11 | **Engraving** | Caseback/clasp text | Font, script | Real-time engraved-surface render. |

**Two organizing principles (both proven):**
- **Constraint-as-feature (CPQ):** illegal combos disabled with inline reason ("Moonphase requires the Automatic or Tourbillon caliber") — never a dead-end. ([threekit.com](https://www.threekit.com/3d-product-library/sneaker))
- **Curated + custom dual track per axis:** tight curated palette (fast, on-brand) PLUS full HSV picker + **"sample a color from an image"** (Piaget's signature). ([hapticmedia.com](https://hapticmedia.com/3d-configurator-watch/))

### 5.3 Interaction model — ship BOTH modes, default by device

- **A. Tap-to-apply (primary, all devices — what Nike/Piaget ship).** Select layer → relevant part isolates/highlights (camera eases to frame it, others dim) → tap variant card → material mutates **in place, instantly** (no reload). Fastest, least error-prone on touch.
- **B. Drag-drop with magnetic snap (signature desktop showpiece — the Prism flex).** Drag a part chip from the side-rail onto the watch. Define an **anchor socket per layer** (case-top ring for bezel, dial-well for dial, crown-stem for crown, lug-bars for strap). On drag-near: snap zones glow at valid socket → part eases into socket with magnetic settle (spring easing) + subtle haptic/audio click. Reuse repo's `findNearestHub` + Round-2 "Clone + auto-snap" (SC-075..077). Rapier for collision/joints.

### 5.4 Responsive (desktop / tablet / mobile)

- **Desktop:** full drag-drop + tap; side-rail catalog; orbit/zoom on the model; hover-loupe for detail inspection; keyboard a11y on variant cards.
- **Tablet (sales/showroom mode):** tap-to-apply primary; larger touch targets; AR try-on entry; orbit via one-finger drag, pinch-zoom.
- **Mobile:** **drag→tap collapse** (no drag-drop on touch — error-prone); **bottom-sheet catalog** (swipe up over the model); one layer visible at a time; pinch-zoom + one-finger orbit; reduced postprocessing budget; static-poster fallback if WebGPU/WebGL both fail.

### 5.5 Feels-fast patterns

- **Optimistic in-place mutation** — material swaps via TSL `uniform()` node updates (zero rebuild, no FBO reload). Preview-state overlay shows the change before commit.
- **Camera eases to frame the active layer** so the user always sees what they're editing; others dim, not hide.
- **Progressive model load** — low-poly proxy first (Draco), swap to full LOD when settled.
- **Instant shareable snapshot render** on completion (Nike pattern) — render the configured watch to a high-quality still + share.
- **Live mechanism running** (Piaget) — the movement ticks while you configure, reinforcing "real product."
- **Constraint feedback is immediate** — disabling reasons render inline the instant a conflicting option is hovered/selected.

---

## 6. fal PHOTOREAL PARTS PIPELINE + ASSET LIST + BUDGET

### 6.1 Pipeline

`@fal-ai/client` (server-side, current 1.10.1) provisions photoreal source images via the repo's `npm run provision-assets` script (`provision-assets`). Flow:

1. **fal.ai image gen** → photoreal reference images / material captures per watch part (case finishes, dial textures, strap materials, guilloché patterns).
2. **Blender** → model parts → export `.glb` with **Draco** geometry compression (`gltf-pipeline -d`) + **KTX2** textures (`@gltf-transform/cli ... --texture-compress ktx2`).
3. **Load** via `GLTFLoader` + `DRACOLoader` + `KTX2Loader`.
4. **TSL `MeshPhysicalNodeMaterial`** for live finishes (transmission/clearcoat/anisotropy/iridescence) — swap `colorNode`/`metalnessNode`/`roughnessNode` at runtime.
5. **Optional Gaussian Splatting** (`@mkkellogg/gaussian-splats-3d`) for ultra-photoreal environment/backdrop captures.

### 6.2 Watch-parts asset list (maps to the 11-layer stack)

- **Movement:** 1 skeleton/automatic GLB with animatable mechanism (balance wheel, gears) — the running mechanism is the hero.
- **Case:** 3 shapes (round/cushion/tonneau) × material-as-TSL-finish (no separate GLB per material — finishes are node swaps).
- **Bezel:** 4 types (smooth/fluted/gem-set/dive) GLBs snapping to case ring.
- **Dial:** base GLB + texture set (guilloché, solarized, skeleton, enamel, meteorite, aventurine) — fal-generated dial textures, KTX2.
- **Hands:** 5 sets (dauphine/baton/sword/breguet/syringe) GLBs, metal tone via node.
- **Indices:** 5 marker styles as GLB/decal.
- **Crown:** 4 types GLBs.
- **Complications:** date/GMT/moonphase/chrono/power-reserve sub-dial GLBs, placed by movement gate.
- **Strap/Bracelet:** 6 types (leather/alligator/rubber/NATO/integrated/Milanese) GLBs + fal-generated material textures (KTX2).
- **Environment:** 1–2 Gaussian-splat or HDRI luxury-boutique backdrops for the hero/close.

### 6.3 Budget plan

- **fal.ai cost gate:** image provisioning runs server-side via `provision-assets` — batch generate once, cache to disk/CDN; do NOT regen per build. (Standing autonomy authorizes installs/scripts; nontrivial ongoing-cost provisioning >$10/mo would need a confirm — batch-once stays well under.)
- **Bundle/load budget:** Draco + KTX2 mandatory; target sub-3s LCP, defer 3D init after LCP; texture atlas where possible; LOD proxies.
- **Allowlist gate:** any new import (`rapier3d-compat`, `@huggingface/transformers`, `@mkkellogg/gaussian-splats-3d`, `theatre.js`) must be added to `.claude/hooks/dependency-allowlist-check.sh` **before** the build hook permits it.

---

## 7. OPEN RISKS / UNKNOWNS TO RESOLVE IN THE SPEC

1. **WebGPU GPU-memory contention.** transformers.js (if used for the "sample color from image" / any ML) shares the page's WebGPU device with three/webgpu + path tracing. Resolve: do we need transformers.js at all? "Sample-from-image" can be pure-canvas pixel-pick (no ML). If ML is used, define a GPU-memory budget + when to release the device.
2. **Transmission re-render budget.** ≤2 live transmission objects on screen — needs an explicit runtime guard/counter so the configurator panel + sapphire crystal + any nav glass don't exceed it simultaneously. Where does Path C (screen-space) take over from Path B?
3. **Real-time path tracing on mobile.** GPU path tracing is desktop-class. Define the mobile fallback fidelity tier (baked lighting? reduced sample count? static hero poster?) and the WebGPU→WebGL2→poster decision tree.
4. **theatre.js vs GSAP for cinematic sequencing.** Default to GSAP (recommended). Resolve whether the visual sequence editor is worth the frozen-0.7.2 risk for the scroll choreography, or whether GSAP timelines fully cover it.
5. **r181→r182 transparent-material regression** — verify all watch/glass materials render correctly after the `npm update` patch bumps before locking the spec.
6. **Material-as-node-swap vs separate GLB** — confirm the case/strap finish strategy (node swaps, no per-material GLB) holds for all 30+ Piaget-class finishes, including guilloché/solarization which may need texture not just node params.
7. **Continuous-spline orrery vs scene disposal** — our differentiator is one persistent world (no Cartier-style disposal). Confirm the GPU/memory budget supports keeping all orbital shells resident, or define a culling/LOD strategy that preserves the "no load seams" feel.
8. **Snapshot/share + buyable artifact** — Nike's instant snapshot render and a buyable config imply a serialization format for the watch build (the `ControlSchema` param set per layer). Define the save/share/restore contract.
9. **fal.ai asset cost ceiling** — confirm the one-time batch provisioning total and caching strategy stays under the autonomy cost threshold; document the cache invalidation rule.

---

*End of brief. Source files: `package.json`, `.claude/hooks/dependency-allowlist-check.sh`, `docs/prism/DESIGN-REFERENCES.md`, `docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md`, `src/lib/prism/animatable/primitives/`, `src/lib/prism/animatable/registry.ts`, `src/lib/prism/animatable/contract.ts`.*
