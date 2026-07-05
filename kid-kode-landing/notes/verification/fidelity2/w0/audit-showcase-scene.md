All findings are from read-only inspection; no files were modified.

# Mock-App / Showcase Pipeline Audit — kid-kode-landing

## 1. Graph Source

**Directory** `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/src/lib/prism/mock-app-source/` contains `assets/`, `backends/`, `hubs/`, `nodes/` (29 legacy PixiJS-era node JS files), `schemas/shared-types.js`, `build-prism.mjs`.

**Hubs today: exactly 1 — and the file the live app reads is NOT in hubs/.**
- `hubs/home-hub.legacy.json` — legacy graph, **33 nodes** (root CLAUDE.md's "40-node home-hub.json" is stale: the file is `.legacy.json` and has 33 nodes), hubId `home-hub`. Consumed only by the legacy asset pipeline.
- The live canonical seed is `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/public/prism-mock/home/live-graph.json` — `schemaVersion 0.1.0`, **single `hub` key (singular)**, hubId `home`, 1280×720, `mockupUrl /prism-mock/home/mockup.png`, **6 nodes, 2 edges, 1 rootNode**.

**Schema** — `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/src/lib/prism-graph/types.ts`:
- `RenderMode` :28 — `'sprite' | 'plane' | 'parallax-plane' | 'mesh' | 'text'`; `ScenePosition` :30; `PrismNode` :609 with `renderMode` :620, `depthMapUrl`/`meshUrl` :621-622, `cinematicPrimitives` :623, `scenePosition` :624.
- `AnimationBinding` :805 (`id`, `primitive` = Animatable-registry name, `driver`, `params`, `order`), `AnimationDriverKind` :803 = `time | scroll | pointer | state | event`, stored on `node.animationBindings` :717.
- `PrismHubBackgroundLayer` :414; attachment vocab :404 = `viewport-fixed | camera-locked | parallax | world | infinite-environment`; `PrismHub.background?` :433, `PrismHub.lightingSpec?` :438.
- `LightingSpec` :198, `MaterialSpec` :226, `receivesLightingDefault` :369 (only `mesh` lit by default), `TextSpec` :327 with `TextFill` :289 — `solid | gradient | texture | ai-texture` (the "poured-texture" fill; no field is literally named `textFillSpec`), `meshPrimitive` :733/:746 (7 kinds), `imageSpec` :725, `scrollBinding` :659, `keyframes` :665 (`coordinateSpace` required, INV-21). `GraphSource.hubs[]` (plural, multi-hub-ready) :913; wire shape `HomeHubJson` :923 carries **`hub` singular**.

**Asset referencing:** live nodes use absolute public URLs — `visual.sourceAsset: /prism-mock/home/nodes/feature-card.png`, `depthMapUrl: .../parallax-stack.depth.png`, `meshUrl: .../cta-hero.glb`. The legacy atlas path keys regions by assetKey instead.

## 2. Asset Pipeline

`src/lib/prism/mock-app-source/assets/provision-assets.mjs`
- Models :31-36: `fal-ai/flux-2` (style-lock + base images), `fal-ai/ideogram/v3` (diffusion-baked text), `fal-ai/wan/v2.7/image-to-video` (i2v ~5 s; frames extracted via ffmpeg-static :120-132).
- Resolution: per-node `image_size: { width, height }` from `node.visual.transform` (:258, :369); **style reference hardcoded 1024×1024 at :428** (the 1024² ceiling); overlays 256×256 :304. Reads `home-hub.legacy.json` (:27). Idempotent via `.provisioning-manifest.json` intent hashes (:82-88).

`build-atlas.mjs` — `ATLAS_SIZE = 4096` :31, AVIF q75 :32, **`MAX_REGION_LONG_SIDE = 512` :39 (hard downscale cap; "player only reads bin 0" :34-38)**, reads legacy graph :24, Sharp+SVG text compositing :50-61.

`build-stubs.mjs` — dev-only stub PNGs (style stub 1024² :68); not in the build chain.

`scripts/build-live-prism.mjs` — assembles `public/prism-assets/mock-app.prism` from **live-graph.json** (:13). Bundles atlas/MSDF as loader-compat fallback (:79-83); embeds every public asset referenced by `mockupUrl`/`sourceAsset`/`depthMapUrl`/`meshUrl`/`codeRef` (:85-96). Content addressing: per-entry sha256, sorted, → `artifactHash` (:98-99); deterministic timestamps (:22-23). **Single-hub assumptions: `toCompiledGraph` reads `source.hub` singular (:51-58); manifest `entryHub: source.hub.hubId`, `hubs: [source.hub.hubId]` (:109-110).**

`scripts/generate-prism-mock-assets.mjs` — generator for the current 6-node assets: `fal-ai/flux-pro/v1.1` (:48), `image_size: 'landscape_16_9'` "~1280x720 native; we'll upscale during use" (:52), `square_hd` (:93).

**2-4K verdict:** the live runtime path has **no resolution cap** — textures load straight from URL via `TextureLoader` (GPU max-texture-size is the only ceiling). The 1024/512 ceilings exist only in generation requests (provision :428, generate :52) and the legacy atlas (`MAX_REGION_LONG_SIDE` 512, 4096 bin). 4K assets must bypass the atlas, as the live 6-node path already does. No KTX2/Basis loader exists — plan for uncompressed GPU upload cost at 4K.

## 3. Runtime Capability

**Video textures: NOT SUPPORTED — blocker.** Zero hits for `VideoTexture`/`video` in `src/lib/prism`, `src/lib/prism-graph`, `src/components/prism-player`. `LoaderCache` wraps only `TextureLoader` + `GLTFLoader` (`runtime/shared/loaders.ts:13`, :73-160). `visual.frameCount` / i2v frames have **no consumer** in the three.js runtime (only a dead type field at `player/prism-loader.ts:56`). Needs an additive node field (e.g. `videoUrl`) + a `loadVideo` lane + dispose handling.

**GLB / mesh:** `runtime/factories/default-factory.ts` (602 lines) routes `renderMode`: sprite/plane :157-237 (with `imageSpec` shader mask :195-218), parallax-plane :238-341 (base+depth textures, TSL displacement, excluded from T2 SSGI :260), mesh :342-413 (`meshPrimitive` lane :345-377, else `ctx.glbLoader.loadGLB(node.meshUrl)` :377-388), text :414-456 (MSDF, `TEXT_SPEC_DEFAULT` merge :445, `resolveFillTexture` wired to loader cache :456 — `texture`/`ai-texture` poured fills work: `text/text-object.ts:97,145-147`, `text/msdf-material.ts:116`).

**Hub navigation:** `runtime/shared/hub-manager.ts` — register/activate/deactivate; one active hub Group parented under the scene, reparent-on-navigate (:103-117). `prism-graph/hub-transit.ts` — `deriveHubTransitRail(fromRail, toRail)` anchor→anchor damped cinematic transit (SC-055), fov preserved so env-fog hides inter-hub gaps. `prism-graph/preview-app-routing.ts` — `#hub=<id>` hash router (SC-054). `runtime/camera-rail-driver.ts` — damped pose integration, `setRail()` hot-swap (:87). **Wiring in `PrismHost.tsx:228-327`: on `activeHubId` change in preview-app it installs a transit rail (`deriveHubTransitRail` :283, `previousHubRailRef` :101) — but PrismHost NEVER calls `hubManager.activate(activeHubId)`; `mount-graph.ts:397-399` activates only the entry hub.** That effect (+ a `hubManager.activate` call, + optionally a displacement/dissolve primitive fired during transit) is the attach point for "morph-through" hub navigation. `compile-app.ts` already aggregates per-hub compiles (SC-053); `cross-hub-tethers.ts` exists.

**Five animation drivers:** `runtime/shared/drivers.ts:4-10` — Time, Scroll, Pointer, State, Event (`DriverHub`, host-pushed inputs, DOM-free). Trigger→playback mapping in `runtime/shared/driver-dispatch.ts:17-31` (`load/inview/scroll/hover/click/time`). Per STEP7, `animationBindings` attach via `animatable/bindings.ts` `attachAnimationBindings` (:226+): sorts by `order`, `registerAllPrimitives()`, wires each binding's primitive to its driver. Verified by `scripts/verify-step7-drivers.mjs`.

**Lighting/material:** `runtime/shared/lighting-rig.ts` — T0 (IBL PMREM via `environment-ibl.ts`) / T1 (3-point rig + PCFSoft/VSM shadows) / T2 (TSL GTAO+SSGI, capability-gated, never default). `runtime/shared/material-system.ts` — three lanes: lit mesh `MeshPhysicalNodeMaterial`, unlit plane `MeshBasicNodeMaterial` (criterion 17: diffusion look untouched), opt-in lit plane `MeshStandardNodeMaterial`. Per-hub + per-node + per-layer `lightingSpec` all in schema.

## 4. Boot Path

- Default boot mode is **`preview-app`** — `useGraphEditorStore.ts:249-252` (RA-06b/RA-17); `ViewMode` :16. (Note: RT-SC-11 — boot mode confirmed in code but still listed as unverified in the running app; RT-SC-10 flags that page.tsx mounts PrismHost XOR GraphScene, which the showcase work will sit on top of.)
- The live app reads **`/prism-mock/home/live-graph.json`**, eager-fetched on module load — `useGraphSourceStore.ts:458-469`. `PrismHost.tsx:142-189` waits for store-ready, warms the Inter MSDF atlas (:160), mounts via `mountFromGraphSource`, then subscribes with a surgical diff (upsert/remove/transform/mockup — never remount). `public/prism-assets/mock-app.prism` is only the bundle-fallback path.
- Persistence: `/api/prism/regen` `'persist'` atomic-writes live-graph.json (`route.ts:30`, :188) and **rejects payloads without `graph.hub` singular (:71-73)**; `useGraphSourceStore.saveToServer` persists **only `hubs[0]`** — "live-graph.json contract is single-hub today" (:392-419).
- **Current demo content (what the showcase replaces):** 6 nodes over `mockup.png`, bg `#04050a` — MSDF headline "Build worlds in seconds." (kinetic-text + parallax-scroll), glass feature card (magnetic-cursor), parallax panel stack (depth map + displacement-transition), orbiting energy orb (orbit + particle-emerge), crystalline accent (particle-emerge), smartwatch GLB CTA hero (mesh). Assets in `public/prism-mock/home/nodes/` (5 PNGs incl. one depth map, 1 GLB, 1 code module). No canonical-3 spec has a "§13 demo content" section (their §13s are re-verify/supersession tables); the demo content is this hand-authored canonical seed.

## 5. Hub Geometry / Galaxy

`src/lib/prism-graph/hub-geometry.ts` — hub world position is a **deterministic FNV-1a hash of hubId** → ring (radii 90/150/210 + tilts) + angle + y-jitter (:23-47); `findNearestHub` linear scan (:59-77, fine for 5 hubs). **Constraint: must stay aligned with the duplicate math in `useForceGraph.ts:59-60`.** Adding 4 hubs needs no code change, but placement is uncontrollable (hash-derived); an additive `hub.galaxyPosition` override would need mirrored support in both files. Galaxy→canvas drill-in: `useGraphEditorStore.ts:194-228`; clone-drag tether snaps via `findNearestHub` (`clone-drag-tether.ts:36`).

---

## What Must Change for the 5-Hub Showcase (all schema-additive, INV-18)

1. **Multi-hub wire format (the #1 structural blocker for >1 hub).** `HomeHubJson.hub` singular (`types.ts:923`); `loadFromHomeHub` wraps into `hubs:[hub]` (`loader.ts:29-47`); regen route validates `graph.hub` (`route.ts:71`); `saveToServer` drops all but `hubs[0]` (`useGraphSourceStore.ts:397-419`); `build-live-prism.mjs` reads `source.hub` (:53, :109). Additive fix: accept optional `hubs?: PrismHub[]` alongside `hub` in all four places — `GraphSource` and the runtime adapter already handle `hubs[]` (`adapter.ts:123-145` builds one Group per hub).
2. **Hub activation on navigation.** PrismHost swaps camera rails on `activeHubId` change (`PrismHost.tsx:228-327`) but never calls `liveResult.hubManager.activate(activeHubId)`; only the entry hub's group is ever in the scene (`mount-graph.ts:397-399`). Wire activation (and any morph-through transition primitive) into that effect.
3. **Video textures — BLOCKED today.** No `VideoTexture`, no video lane in `LoaderCache` (`loaders.ts`), `frameCount` unconsumed. Add additive `videoUrl` (or `imageSpec.mediaUrl`) + `loadVideo` lane + cleanup; or revive i2v output as a flipbook/texture-array TSL primitive.
4. **2-4K assets.** Runtime: no cap (direct `TextureLoader`) — keep flagship assets on the live direct-URL path, NOT the atlas (atlas hard-caps regions at 512px, `build-atlas.mjs:39`; bin 4096 :31). Generation: raise `image_size` requests (`provision-assets.mjs:258`/`:428`; `generate-prism-mock-assets.mjs:52`). Watch GPU memory: no KTX2/Basis compression path.
5. **Repoint/replace provisioning** — `provision-assets.mjs:27` and `build-atlas.mjs:24` read `hubs/home-hub.legacy.json`; a new 5-hub provision script should read the new hub sources and write to `public/prism-mock/<hub>/nodes/` like the live path.
6. **Per-hub MSDF fonts** — only Inter is baked (`font-inter.msdf.*`, `build-msdf.mjs`); new display fonts need additional MSDF atlases (font-registry + google-fonts manifest already exist in `src/lib/prism/text/`).
7. **Ready as-is (no changes needed):** hub `background[]` layer stack (`types.ts:404-433` → `compiled-view.ts:206-240` → `mount-graph.ts` `setBackgroundLayers`), per-hub/per-node `lightingSpec` + `materialSpec`, `textSpec` ai-texture fills, `meshPrimitive`, GLB `meshUrl`, parallax `depthMapUrl`, the 5 drivers + `animationBindings`, hub-transit rails, `#hub=` routing, `compile-app` aggregation, hub-geometry (supports N hubs; placement hash-determined).

Related open spec criteria that intersect this work (from `notes/verification/unmet-criteria.json`): RT-SC-10 (preview-app must reuse canvas's mounted objects in place — affects where the showcase mounts), RT-SC-11 (boot-mode verification), RT-SC-02 (CDN-vs-bundled `three` split still present in the runtime player — touches any new loader lane added for video/KTX2), NE-SC-01/03 (galaxy nav depth — relevant once 5 hubs exist).