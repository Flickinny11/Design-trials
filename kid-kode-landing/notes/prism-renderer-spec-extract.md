# Prism Renderer Migration — condensed extract

Quick reference for Ralph tasks. Authoritative source:
`kid-kode-landing/docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md` (554 lines) and
`kid-kode-landing/docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md` (328 lines).
Quote line ranges from those files when reviewing — this extract is index, not source.

## §1–2 Why + Architectural Invariants
Switch from PixiJS 2D compositor to Three.js WebGPU 3D scene compositor. Images become textures, code composes them in 3D space (Invariant 8 replaced). New invariants 11, 12, 13: renderer is `three/webgpu` with WebGL2 fallback; per-node animation comes from a fixed cinematic-primitives library; text is MSDF rendered at runtime via `three-msdf-text-webgpu`. Invariants 1-7, 9, 10 unchanged.

## §3 Tech stack
Runtime: `three@r184+` (import `three/webgpu`), TSL via `three/tsl`, `gsap@3.13+`, `three-msdf-text-webgpu`, `msdf-bmfont-xml`, `esbuild-wasm`. Editor: same Three.js + `@react-three/fiber@v9` + `@react-three/drei@v9` (async `gl` factory for WebGPU). Pipeline gains Depth Anything v2 + Hunyuan3D Rapid + Trellis-2. Removed: `pixi.js` and `@pixi/*` (gone by end of Phase 5).

## §4 GraphNode schema
Additive 5 fields on the existing interface (in this repo: `PrismNode` at `src/lib/prism-graph/types.ts`, NOT `GraphNode`): `renderMode: 'sprite'|'plane'|'parallax-plane'|'mesh'`, `depthMapUrl: string|null`, `meshUrl: string|null`, `cinematicPrimitives: CinematicPrimitiveRef[]`, `scenePosition: { x,y,z, rotationXYZ, scaleXYZ }`. Defaults make legacy graphs render as `sprite`.

## §5 Render modes
- `sprite` — billboard plane, default cheapest
- `plane` — flat plane with explicit pose
- `parallax-plane` — plane with depth-map displacement (requires `depthMapUrl` from Depth Anything v2)
- `mesh` — full GLB from Hunyuan3D / Trellis-2 (requires `meshUrl`); 1-3 per hub max. Cost increment: ~$0.10-0.30/build.

## §6 Pipeline
20 stages preserved. New 9.5 (depth-map gen for parallax-plane) and 9.6 (mesh gen for mesh) parallelize after graph construction. Stage 14 renamed "Three.js scene assembly" replaces "PixiJS assembly". Stage 18 bundle now ships three/webgpu + GSAP + MSDF + primitive lib.

## §7 Cinematic primitives library
9 primitives: `orbit`, `depth-rotate`, `dissolve-morph`, `displacement-transition`, `parallax-scroll`, `magnetic-cursor`, `particle-emerge`, `fly-through`, `kinetic-text`. Each is `(targetObject, params) → { timeline, cleanup, needsTick, onTick }`. Codegen SELECTS by name in `cinematicPrimitives[]`; never authors scene animation from scratch. **No node ships without ≥1 primitive applied** (unless explicitly empty in plan).

## §8 createNode contract
Every node module: `export default function createNode(config: NodeConfig, ctx: NodeContext): THREE.Object3D`. **MUST be synchronous.** Returned object MUST have `userData.cleanup()` (dispose geos/mats/textures, kill timelines), `userData.handlers.*` for events. Never call `renderer.domElement.addEventListener`. Never add directly to scene — return only.

## §9 Codegen prompts
Shared system prompt (RadixAttention-cached) constrains imports to `three/webgpu`, `three/tsl`, `gsap`, `@/primitives`, `@/text`. Per-node user prompt exposes `renderMode`, asset URLs, scenePos, primitives list, atlas region, neighbors. Render-mode sub-prompts append rules per mode.

## §10 Verifier rules
Allowed Three imports listed (Object3D, Group, Mesh, *Geometry, *NodeMaterial, loaders, math). Disallowed regex: `from 'pixi.js'`, general DOM `document.*`/`window.*` (except `devicePixelRatio`), `innerHTML`, `TextGeometry`, `addEventListener`, `async function createNode`. Render-mode-aware checks (parallax-plane → references `displacementMap`; mesh → calls `glbLoader`; all → iterate `cinematicPrimitives` and `textContent`; `userData.cleanup` defined).

## §11 Bundle assembly
`assembleBundle` adds `shared/scene-root.js`, `shared/loaders.js`, `shared/text.js`, `shared/primitives/index.js` + 9 primitive files, `shared/shaders/*.tsl.js` (6 files). Importmap loads three / three/webgpu / three/tsl / gsap from CDN; `three-msdf-text-webgpu` is bundled.

## §12 Hub manager
`activate(hubId)` becomes `sceneRoot.add(hubGroup)` instead of `stage.addChild(hubContainer)`, then `activatePrimitivesForHub(hubGroup)` fires inview triggers. Reparent-on-navigate identical to PixiJS — `Object3D.add()` auto-removes from prior parent.

## §13 Editor (Visual / Animation / Code / Image-edit)
Visual tab: live R3F sub-canvas mounting actual node code with sliders bound to visualSpec; <100ms feedback. Animation tab: hybrid i2v-frame-scrub OR GSAP timeline-keyframe; PowerPoint preset library maps to primitives. Code tab: Monaco allowed-import set updated; PixiJS warns then errors after Phase 5. Image-edit: masking + crop essential; "swap mesh for image" fallback to flat texture.

## §14 Mock app reconstruction
5 hubs (Landing/Features/Gallery/Pricing/Contact). ≥3 `mesh` nodes, ≥1 `parallax-plane`/hub, all 9 primitives represented across the app, all text via MSDF, fly-through inter-hub nav at least once. Build ≤35s.

## §15-16 Removed / Out of scope
Removed: pixi.js + `@pixi/*`, NineSliceSprite, PixiJS atlas binpack utilities (atlasing logic stays as `THREE.DataTexture`). Out of scope and DO NOT MODIFY: Cortex code paths, plan generation (§1-5 of pipeline), FLUX.2/SAM3 integration, backend pipeline, DB schema, SSE channel, self-healing tier ladder, non-renderer editor surfaces.

## §17 Definition of Done
13 checks: zero PixiJS in bundle, loads in Chrome/Safari26+/Firefox/Edge with WebGPU, WebGL2 fallback verified, all primitives render across ≥3 builds, MSDF crisp 1×-10×, mesh GLB <2s, parallax-plane responds to cursor, editor Visual tab <100ms, Animation timeline captures+replays, mock builds ≤35s, all tests pass, `tsc --noEmit` clean (use `npm run typecheck`/equivalent for this repo), `docs/spec-deviations-prism.md` updated.

## CINEMATIC-PRIMITIVES-LIBRARY.md
9 primitives (each with `(targetObject, params) → PrimitiveResult`): `orbit`, `depth-rotate`, `dissolve-morph`, `displacement-transition`, `parallax-scroll`, `magnetic-cursor`, `particle-emerge`, `fly-through`, `kinetic-text`. 6 TSL shaders: `displacement.tsl.js`, `dissolve.tsl.js`, `voronoi-particle.tsl.js`, `twisted-wave.tsl.js`, `radial-blur.tsl.js`, `rgb-shift.tsl.js`. Each primitive defines params shape, trigger semantics (`load|hover|click|scroll|inview|time`), required shader includes, and demo scene for visual regression.

## Repo notes (not in spec)
- This repo's GraphNode is named `PrismNode` (`src/lib/prism-graph/types.ts`).
- Project uses `npm`, not `pnpm`. Use `npm run typecheck` for the §17 tsc check (or add the script if missing).
- `kid-kode-landing/notes/prism-spec-extract.md` (1349 lines) is the older PixiJS mock-app spec, retained because §14 of this migration uses the current mock app as reconstruction target.
- Migration tasks live in `notes/ralph-state.json` (T01–T10). Per-task entrypoint: `/ralph-step`. Outer loop: `kid-kode-landing/scripts/ralph.sh`.
