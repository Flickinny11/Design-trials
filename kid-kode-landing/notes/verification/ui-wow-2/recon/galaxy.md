# Galaxy view — recon (UI-WOW-2)

Surface: **galaxy** view mode of the unified WebGPU graph scene. This is the
"zoomed-all-the-way-out" state: a central App-World sun, hub volumes scattered
on tilted rings, and every node rendered as a dormant glass sphere (NEVER its
built artifact — that's the two-state invariant, INV-R2 / RT-SC-04).

All anchors are `file:line` against the files as read 2026-06-14.

---

## 1. Entry / mount topology

- `GraphScene` (default export) `GraphScene.tsx:3118` chooses one of two
  content keys by `showsAssembledFor(viewMode, editorRenderMode)`
  (`GraphScene.tsx:3134`). Galaxy is **always** `contentKey === 'topology'` and
  mounts the **far camera** `{ position: [0,0,320], fov: 50, far: 2000 }`
  (`GraphScene.tsx:3138`).
- Galaxy renders through `SceneContent` → `TopologySceneContent`
  (`GraphScene.tsx:2474`). `AssembledSceneContent` (`:2868`) is canvas/preview-app
  only; galaxy never touches it.
- The `<Canvas>` is keyed by `contentKey` (`GraphScene.tsx:3164`) so
  galaxy↔canvas-topology share a mount; switching to canvas/preview-app remounts.
- Renderer: `createUnifiedRenderer` → `three/webgpu` `WebGPURenderer` with
  WebGL2 auto-fallback (`GraphScene.tsx:25, :3166`). `PCFSoftShadowMap`
  (`:3092`). Backend is published to `window.__PRISM_RENDERER_BACKEND__`
  (`:3099`). **WebGPU is the default path in real Chrome 144+.**

## 2. The planets/spheres — `GlassNode` (`GraphScene.tsx:511-776`)

NOT "flat simple spheres." Each node is a **dual-mesh photoreal glass sphere**,
`radius = 4.5` (`:626`):

- **Inner sphere** `sphereGeometry(radius, 72, 72)` (`:664`) with
  `meshPhysicalMaterial` — `map`+`emissiveMap` = a per-node CanvasTexture from
  `generateNodeTexture(node, capturedImage)` (`:573`); metalness 0.35,
  roughness 0.28, clearcoat 0.65, hub-color emissive at low intensity (`:665-676`).
- **Outer glass shell** `scale 1.08`, `sphereGeometry(radius, 48, 48)` (`:704`):
  - **Heroes on WebGL2** → drei `MeshTransmissionMaterial` (samples 4, ior 1.33,
    chromaticAberration 0.08, transmission 0.95) (`:684-702`).
  - **Everything under WebGPU** (and non-heroes) → `meshPhysicalMaterial`
    transmission 0.95, `dispersion 1.8`, ior 1.35, clearcoat 1, opacity 0.52
    (`:704-723`). `MeshTransmissionMaterial` is a raw-GLSL ShaderMaterial that
    WebGPU's NodeBuilder rejects — gated by `useIsWebGPU()` (`:553, :683`).
    **So in the live (WebGPU) build, NO node ever uses true transmission glass —
    every sphere is the physical-material approximation.**
- **Selection/hover ring** `ringGeometry(radius*1.3, radius*1.38, 80)`, opacity
  lerps 0→1 on hover/select, spins on Z (`:727, :611-616`).
- **Status point light** per node (`:739`), **backend/animation badge spheres**
  (`:747-758`), **frozen icosahedron wireframe overlay** (`:761-772`).
- Per-frame: position from sim, slow inner Y-spin, failed nodes pulse red
  emissive (`:599-624`).
- Materials sourced from DS tokens (`DS.brass400` hub fallback `:591`, ice/brass
  status colors `:593-597`).

**Verdict:** the per-node sphere is already high-effort. The "flat simple
spheres" the monitor saw is most likely **the WebGPU transmission-downgrade**
(no real refraction/dispersion shimmer) **plus dead postprocessing** (no bloom —
see §6) flattening every glossy highlight.

## 3. The sun — `WorldSun` (`GraphScene.tsx:921-988`)

Mounts only in galaxy (`GraphScene.tsx:2563`). Single emissive core
`sphereGeometry(14, 96, 96)`, `meshStandardMaterial` brass emissive
(`emissiveIntensity 1.6` pulsing ±0.4, `toneMapped:false`) (`:964-974`); a flat
`ringGeometry` halo on the XZ plane spinning slowly (`:975-984`); one big
`pointLight` (intensity 3.2, distance 260) (`:985`). Click → select the
`PrismRootNode.appNameWorldId` + open inspector (`:958-962`).

**This is the single brightest object and the natural bloom anchor — but bloom
is off under WebGPU.** It's a plain emissive ball: no corona, no animated
surface noise, no light rays.

## 4. Hub volumes — `HubHull` (`:781-912`) + `HubHulls` (`:990-1086`)

- Galaxy hub **centers** come from `computeGalaxyHubCenters`
  (`useForceGraph.ts:62-80`): hubs are hash-distributed onto **3 tilted
  concentric rings** `GALAXY_RING_RADII = [90,150,210]`,
  `GALAXY_RING_TILT = [0.04,-0.18,0.22]` (`useForceGraph.ts:59-60`) around the
  origin sun, with per-hub angle + Y jitter. **Deterministic orrery-style
  placement** — but the rings themselves are **invisible** (no orbit-line
  geometry is drawn for them).
- Galaxy hub **size** from `computeGalaxyHubDiameters(nodeCount, depth)`
  (`:1034`, SC-013); radius = diameter/2.
- Each hull = **BackSide translucent sphere** (ice500, opacity 0.035–0.085)
  `:871-880` + **wireframe sphere** (ice400, opacity ~0.022–0.05) `:881-890`
  + **equator glow ring** (ice300) `:892-901` + a soft `pointLight` (ice200)
  `:904-909`. Optional inner mockup-textured `meshPhysicalMaterial` sphere when
  `hub.mockupUrl` is set (`:846-865`).
- Color is forced to the **ice family** (NOT `hub.color`) — Wave-3 retint
  decided raw hub.color reads as forbidden dashboard blue (`:866-870`).
- Nodes inside a hull are positioned by **d3-force-3d** relaxation seeded around
  the hub center (`useForceGraph.ts:241-326`), ±40 jitter; the sim runs a
  forceCenter+link+charge graph (`:282-297`).

## 5. Orbit lines / edges (the monitor's "thin grey orbit lines")

There are **no actual orbit rings**. What's drawn:
- **Intra-hub edges** — `Edge` meshes (tube/line) per `simLink`
  (`GraphScene.tsx:2585-2599`); plus 20 animated `EdgeParticle` dots travelling
  along edges (`:2600-2602, :255-282`).
- **Inter-hub tethers** — `GalaxyHubTethers` (`:290-349`): plain
  `<line>`/`lineBasicMaterial`, EDGE_COLORS-keyed, opacity pulsing ~0.45±0.15
  (`:307-315`). These are 1px GPU lines — thin, low-contrast, no glow. **This is
  almost certainly the "thin grey orbit lines."**
- EDGE_COLORS palette (`:165-172`): brass / ice / ok-green / neutral — **no
  purple, compliant.** But mostly low-alpha (0.45), hence "grey."

## 6. Lighting + atmosphere + postprocessing (the "empty black")

- **Scene lights** (`TopologySceneContent`, `:2553-2557`): `ambientLight 0.06`,
  two directionals (ice key 0.5, brass fill 0.25), `<Environment preset="night"
  environmentIntensity=0.55>`. The night IBL is dim and cool.
- **Fog** `<fog args={[DS.void, 300, 900]}>` (`:3170`) — fades distant hubs into
  the void; this is the only depth cue under WebGPU.
- **Starfield** — drei `<Stars radius={800} count={5000}>` (`:2550`) but it's a
  **raw GLSL ShaderMaterial → WebGL2-only**, gated `!isWebGPU` (`:2549`). **Under
  WebGPU (default) there are NO stars.** That is the "empty black."
- **"Nebula"** is NOT 3D — it's a CSS `radial-gradient` `<div>` behind the canvas
  (`:3155-3162`): two faint brass/ice ellipses over `DS.void`. Very subtle; under
  the WebGPU canvas it barely reads.
- **Postprocessing** `EffectComposer` (Bloom 0.85 / ChromaticAberration /
  Vignette / Noise / SMAA) `:2636-2649` — gated `usePost = qualityMode!=='low'
  && !isWebGPU` (`:2540`). **Under WebGPU, the entire composer is skipped: no
  bloom, no vignette, no grain.** The emissive sun + glass highlights never
  bloom; the frame has no vignette to pull the eye in. This is the single
  biggest "why does it look flat/empty" lever.

## 7. Camera — `ControlsBridge` (`:1249-1394`)

drei `CameraControls` (yomotsu **camera-controls 3.1**, installed):
minDistance 8, maxDistance 600, smoothTime 0.28, dollyToCursor, infinityDolly
off (`:1380-1392`). Reset = `setLookAt(0,0,320 → 0,0,0)` (`:1278`). Galaxy nav is
**unconstrained** (free orbit/dolly) per RA-06b. flyToHub/flyToNode use damped
`setLookAt` promises (`:1283-1314`). Distance is published to the store each
frame to drive label LOD (`:1373-1377`).

## 8. Overlays (galaxy chrome)

- `GalaxyFilterOverlay` (`overlays/GalaxyFilterOverlay.tsx`) — top-right pill +
  filter input, only in galaxy; writes `filterQuery`; GraphScene dims
  non-matching hubs/nodes via `computeGalaxyFilterMatches`
  (`GraphScene.tsx:2522-2528`, dim factor `GALAXY_FILTER_DIM_OPACITY`). Chrome =
  ceramic/glass `useChromeSlab` (Observatory Brass).
- `Minimap` (`overlays/Minimap.tsx`) — bottom-right canvas-2D radar; hubs on an
  ellipse, nodes jittered around them, status-colored dots, brass selection
  reticle. **2D, ignores the real 3D ring layout** (its own ellipse layout,
  `:52-64`).
- `HubNav` (`overlays/HubNav.tsx`) — bottom-center brushed-metal rail of hub
  pills + a "Galaxy" reset pill (`:98-102`).
- `HubLabels` (`graph/HubLabels.tsx`) — **real MSDF** hub titles
  (`createTextObject`, Inter atlas), billboarded, `lit:false`, depthTest off,
  lifted +60 above each hub center (`:35, :97-105`). DS bone fill + hub-color
  glow 0.25 (`:46-61`).
- `NodeLabels` (`GraphScene.tsx:1093+`) — projected `<Html>` labels, zoom-LOD
  gated (`computeGalaxyLabelVisibility`, `:1110`) — hidden at L0/L1, appear L2+.

## 9. Dependencies — what's wired vs dormant in galaxy

- **WIRED:** `three/webgpu` + TSL path, `camera-controls` (via drei),
  `d3-force-3d` (hub-node relaxation), `gsap` (used at `:2189` for a scale tween;
  imported `:26`).
- **DORMANT/DEAD in galaxy:** `postprocessing` + `@react-three/postprocessing`
  (skipped under WebGPU — bloom/CA/vignette all off), drei `<Stars>` (WebGL2
  only). `lenis` (`design-system/use-lenis.ts`) is library-grid scroll, not in
  the 3D galaxy. `simplex-noise` is **installed but NOT used here** — no nebula
  noise, no surface displacement. `MagneticCursor` is DOM-overlay, not in-scene.

---

## WOW levers (specific, actionable)

1. **Resurrect post FX under WebGPU via TSL `PostProcessing`** (three/webgpu's
   `THREE.PostProcessing` + TSL `bloom`/`smaa` nodes, the canvas-spec Step-5
   follow-up the code already flags at `:2537`). Bloom on the brass sun + glass
   highlights is THE single biggest flat→cinematic win. Pair with a TSL vignette
   to kill the "empty black" corners. This is the headline.
2. **TSL node-material starfield** to replace the dead WebGL `<Stars>` (the code
   explicitly calls this "a later polish item" `:2548`). Use `simplex-noise`
   (installed, unused) to drive twinkle + a multi-layer parallax star depth so
   the black is never empty. Optionally a TSL volumetric **nebula** sphere shell
   (BackSide, simplex fbm, brass↔ice ramp — NO purple) replacing the flat CSS
   gradient div, so depth is real 3D not a backdrop.
3. **Make the orbit rings VISIBLE and glowing.** Hubs already sit on 3 tilted
   rings (`GALAXY_RING_RADII [90,150,210]`, tilts in `useForceGraph.ts:59-60`) —
   draw faint additive ring/torus geometry per ring (ice/brass low-alpha,
   bloom-fed) so the orrery structure reads. Upgrade `GalaxyHubTethers` from 1px
   `lineBasicMaterial` to a glowing tube/`Line2` with a flowing dash or a
   gsap-driven energy pulse travelling hub→hub.
4. **Sun corona / star surface.** Give `WorldSun` a TSL fresnel-rim + animated
   simplex surface (granulation) + a soft additive corona sprite/shell so it
   reads as a star, not a ball. It's the composition's focal point and currently
   the weakest hero.
5. **Glass that actually refracts under WebGPU.** The transmission downgrade
   (`:683`) means live spheres never shimmer. Re-express hero glass as a TSL
   node material (fresnel + IBL reflection + subtle chromatic edge) so at least
   the hero nodes catch light — the alpha-physical fallback reads as plastic.
6. **Camera-controls cinematics:** a slow auto-orbit idle drift + gsap-eased
   `setLookAt` "establishing" sweep on galaxy entry (camera-controls is already
   wired; add a damped truck/dolly choreography) for an immediate WOW on load.
7. **Depth/atmosphere grade:** tune the night IBL + fog so hubs glow out of a
   graded haze rather than hard-cutting to black; bloom (#1) will amplify this.

## Risks / invariants constraining edits

- **One renderer only** — `three/webgpu` (WebGL2 fallback). No PixiJS, no second
  visible renderer (INV-R1/FP-R1). FX must be the WebGPU-native `THREE.PostProcessing`
  + TSL nodes, NOT the legacy `@react-three/postprocessing` composer (it's
  WebGL-only and already dead under WebGPU).
- **TSL only, no raw GLSL** (INV-R11). The starfield/nebula/sun-surface must be
  TSL node materials — that's exactly why drei `<Stars>` and
  `MeshTransmissionMaterial` are already gated off under WebGPU.
- **Two-state invariant (INV-R2/FP-R2):** galaxy MUST show every node as a
  dormant sphere, NEVER its built artifact (`renderArtifact` is forced false in
  galaxy, `:564-565`). Do not let any WOW path render the artifact in galaxy.
- **No PURPLE** — palette is brass / bone(ice) / void. EDGE_COLORS and all hull
  tints already comply; any new nebula/ring/glow ramp must stay brass↔ice↔void.
- **Design-tokens-only styling** — colors come from `DS.*`
  (`design-system/tokens.ts` + `tokens.css`/`materials.css`); the few hardcoded
  hexes are `#ffffff` for no-tint physical glass and are explicitly sanctioned
  in-comment (`:697, :721`). New code must use DS tokens, not raw hex where a
  token exists.
- **No DOM in runtime/node modules** — but GraphScene is editor-shell, so
  `window.*`/`document.*` are permitted here (`:3094`). Keep that boundary; don't
  push DOM access into `src/lib/prism/runtime/**`.
- **INV-9 / INV-R14 device tiering:** every heavy FX must capability-tier
  (`useIsWebGPU()` `:3110`, `qualityMode`, `AdaptiveDpr` `:2651`,
  `PerformanceMonitor` `:2652`). New bloom/nebula must have a `qualityMode==='low'`
  off-ramp and not tank mobile.
- **Forbidden-pattern hook** `.claude/hooks/anti-drift-check.sh` enforces FP-01
  (no PixiJS), FP-02 (no TextGeometry), FP-12/FP-14 (only `galaxy|canvas|
  preview-app` viewMode literals). No `THREE.TextGeometry`, no
  `hub-world`/`preview-hub` strings.
- **Never surface the word "fal" in UI.** (Asset-provider name; backend only.)
- `hubCenters` is a fresh object each frame — don't add it to effect deps (loop
  risk, noted `:1368`). Galaxy node positions are d3-force-driven and jittered
  per mount; any ring-overlay geometry must read `GALAXY_RING_RADII`/`TILT`, not
  the live sim positions.
- **Editor `graph/` is "frozen by default"** per `kid-kode-landing/CLAUDE.md`;
  a WOW pass is an explicit carve-out — keep changes additive and within the
  galaxy render path.
- Installed & combinable: gsap 3.13, camera-controls 3.1, d3-force-3d,
  simplex-noise (unused — free win), three TSL/webgpu, postprocessing 6.37
  (WebGL only — avoid for the WebGPU path). NOT installed: curtains.js, vfx-js.
