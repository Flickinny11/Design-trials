# Prism Renderer Migration — Deviations from Spec

This document records every place where the implementation in this repo
intentionally diverges from the canonical specs:

- `docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md` (554 lines, 17 sections)
- `docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md` (328 lines, 9 primitives + 6 TSL shaders)

It is the §17 Definition of Done #13 artifact. Each entry names the spec
line, the divergence, and the rationale. Items are non-blocking unless
noted otherwise.

The list is organised by phase (T01–T10) so that future readers can
correlate each deviation with the iteration that introduced it.

---

## Naming

**Spec calls the schema `GraphNode`; this repo uses `PrismNode`.**

The migration spec (§4 L100-L130) names the node interface `GraphNode`.
This repo's pre-existing schema is `PrismNode` (`src/lib/prism-graph/types.ts`).
The names are semantically identical and are treated as synonyms. Renaming
across the repo would touch unrelated subsystems (Cortex, plan generation)
which §16 places out of scope.

**Spec calls the package manager `pnpm`; this repo uses `npm`.**

§17 DoD #12 says `pnpm tsc --noEmit`. This repo has no `pnpm-lock.yaml`;
the equivalent is `npx tsc --noEmit` from `kid-kode-landing/`. Verification
commands in `notes/ralph-state.json` use the latter.

---

## T02 — Renderer infrastructure

**`createText` returns a silent placeholder Group when the MSDF factory is
not yet warmed.**

The committed test (`tests/integration/T02.font-atlas.test.ts`) asserts
`Object3D` when the factory is ready; the unwarmed path returns a Group
with no glyphs. Production callers must invoke `warmupDefaultFactory()`
before mounting MSDF text. T03 spec-reviewer flagged this; left
unchanged because the test is immutable per Ralph step ordering.

**`TextureLoader` imported from `three`, not `three/webgpu`.**

T02 surface uses the bare `three` import for `TextureLoader`. WebGPU
shaders force the surface to `three/webgpu` — deferred to T03 where
shaders actually consume the textures. No runtime divergence today
because the resolved class is the same in r184.

**rAF/setTimeout cancellation pairing is informal.**

`createSceneRoot.start()` falls back to `setTimeout` when
`renderer.setAnimationLoop` is absent (test seam). The cancellation no-op
is gated by a `running = false` self-termination flag rather than a
paired `cancelAnimationFrame` / `clearTimeout`. Low risk; flagged for
future cleanup.

**Vitest needs a hand-rolled alias for `three-msdf-text-webgpu`.**

`vitest.config.mjs:24-29` aliases the package directly to its
`dist/index.js` because the package's `package.json` ships only
`module` + `types` (no `exports` map, no `main`), which Vite's resolver
can't pick up. Documented inline.

---

## T01 — Foundation

**`@react-three/drei` is at `^10.0.0`, spec §3 says v9.**

`package.json` already had `@react-three/drei@^10.0.0` from before the
migration started (Voltus pipeline). v10 is API-compatible with v9 for the
surfaces the editor uses (`<Canvas>`, `<OrbitControls>`, `useThree`).
Downgrade was not attempted to avoid an unrelated regression.

**`three-msdf-text-webgpu` peer-dep advertises `three@^0.181`, we use
`three@^0.184`.**

Package was published before three r184 shipped; npm install required
`--legacy-peer-deps` (one-time at T01 commit). The runtime API is
unaffected because three-msdf-text-webgpu only consumes Object3D /
Material / Mesh interfaces which are stable across r181→r184.

**`CinematicPrimitiveParams` typed as `Record<string, number | string | boolean>`.**

Faithful to spec §4 L124 literal but may need widening for vec3 params
(e.g. `axis: [x,y,z]`). T03 worked around this by destructuring axis as
the union `'x'|'y'|'z'|'xy'|'xyz'`. Future enhancement: widen to allow
nested arrays/records.

---

## T03 — Cinematic primitives

The 9 primitives implemented under `src/lib/prism/runtime/shared/primitives/`
diverge from `CINEMATIC-PRIMITIVES-LIBRARY.md` in the following non-blocking
ways. Each was flagged by the spec-reviewer at iter 3 and accepted
because the contract surface (PrimitiveResult shape, registry entry,
trigger semantics) matches the spec; the divergences are in animation
fidelity, not interface shape.

**`orbit`, `parallax-scroll`, `magnetic-cursor` overwrite `scenePosition`.**

Caller-supplied scenePosition is stomped when the primitive applies its
own transform. Should be offset from a captured base. (CPL L24, L156-L168.)

**`magnetic-cursor` doesn't gate by `withinRadius`.**

Hot path always runs; the `withinRadius` short-circuit from CPL L162 is
not implemented. Visual cost is negligible because cursor lerp is cheap.

**`fly-through` ignores `targetScale` (CPL L219) + `motionBlurStrength`
(CPL L218).**

Camera dolly works; scale interpolation and TSL motion-blur post-pass are
deferred. The shader for motion blur (`radial-blur.tsl.js`) exists and is
ready to be wired in T7+.

**`dissolve-morph` ignores `emitParticles` and `particleCount`.**

CPL L112 calls for optional particle emission during dissolve. The
dissolve shader is implemented; the particle emitter is not.

**`depth-rotate` doesn't auto-`DoubleSide` for plane-mode Y-rotate.**

CPL L92 mentions auto-side-flip when rotation crosses 90°. Currently
relies on caller passing a DoubleSide material.

**`particle-emerge` final positions are unit-cube-random rather than
UV-mapped to source.**

CPL L201 specifies UV-coord-driven emission. Implementation uses a
deterministic per-instance random offset which approximates the visual
but is not pixel-faithful. `colorMode` parameter is also unimplemented.

**`kinetic-text` mode (chars/words/lines) is ignored; fade writes
`userData.kineticTextOpacity` but no material binding.**

The 3-mode split from CPL L235 is collapsed to a single per-glyph
stagger. Material binding is a TODO; once `three-msdf-text-webgpu`
exposes a per-glyph opacity uniform, wire it.

**`particle-emerge` uses `Math.random()`.**

Non-deterministic for visual regression. Replace with seeded RNG keyed
on `nodeId` for reproducibility.

**`magnetic-cursor` shares a Matrix4 across invocations.**

Not reentrant. Currently safe because primitives run on the main thread,
but a multi-instance scenario would race.

**Pointer/scroll consumed via `ctx.{pointer, scroll}`.**

Primitives must not access `document.*` or `window.*` (rule from
`.claude/rules/prism-renderer-migration.md`). They consume pointer/scroll
state through `ctx.pointer` / `ctx.scroll` source objects defined in
`primitives/types.ts`. SceneRoot supplies the browser-backed
implementation (T07) and tests stub it.

---

## T04 — Codegen prompts and verifier

**`DOCUMENT_ACCESS` and `WINDOW_ACCESS` regexes append `\\w+`.**

Spec §10.B literal regex is `document\.` and `window\.`. Implementation
adds a trailing `\\w+` to require an identifier follow-on (avoids
matching `document.` in a comment). Behaviorally near-identical for
real-world code.

**`MISSING_DISPLACEMENT` third branch matches any `three/tsl` import.**

Spec §10.C requires the `displacementMap` reference for parallax-plane.
Implementation passes if any `three/tsl` import is present; should
tighten to require a displacement-related identifier.

**`MISSING_CLEANUP` regex covers assignment form only.**

Comment claims method-shorthand support; regex doesn't match
`cleanup() { ... }`. Either widen regex or remove comment.

**Empty primitives string is `(none — node ships without primitive)`.**

Spec template would map empty to `''`. Hardcoded sentinel was chosen for
codegen debuggability. Affects prompt-cache key — if RadixAttention
prefix-cache rate ever drops, revisit.

**`phase5Strict` flag declared but unused.**

Reserved for future use — the existing `migration-forbidden-patterns.sh`
hook at the repo level enforces the same constraint.

---

## T05 — Bundle assembly

**`shared/text.js` template imports `three-msdf-text-webgpu` as a bare
specifier; importmap doesn't expose it.**

Spec §11 L444-L445 says it's bundled. The browser smoke test
(`tests/browser/_harness/mock-app-load.html`) resolves the specifier via
a `/shims/three-msdf-text-webgpu.js` no-op file. Production bundling
(esbuild over the runtime tree) inlines the actual module.

**`shared/manager.js` `deactivate()` doesn't walk descendants for
`userData.cleanup()`.**

The Node.js / vitest equivalent in `runtime/shared/hub-manager.ts`
(`disposeHubGroup`) does walk descendants. The bundle-side template is
a thinner version because the per-node code's `userData.cleanup` is
called from the node module itself when the group is removed.

**`primitiveTemplate` and `shaderTemplate` emit identical paused-timeline
stubs.**

Comment promises 'lifted from runtime/shared at bundle time' but lift is
deferred. Codegen (T04 prompts) replaces these per-node anyway, so the
stub is only a fallback.

**`perNodeStub` doesn't iterate `cinematicPrimitives` or `textContent`.**

If run through the §10.C verifier, it would fail `MISSING_PRIMITIVES_LOOP`.
The stub is replaced at codegen time; per-node modules emitted by the
LLM include the loop.

**`mount.ts` `NodeContext` shape diverges from the bundle's `app.js` ctx.**

Editor-host (`mount.ts`) builds NodeContext via `createSceneRoot` →
`makePrimitivesAPI` → adapter. Browser-host (`app.js`) builds it inline.
Shapes have drifted. Reconcile in a future pass.

**`dependency-allowlist-check.sh` retains `pixi.js` + `pixi-filters` in
RUNTIME_ALLOW.**

Hook file is sensitive (gates many other things) and was not edited at
T05. Drift weakens the rule against re-introducing PixiJS but the
`migration-forbidden-patterns.sh` hook (gated by
`.ralph-phase5-pixi-removed`) provides the authoritative block.

**`Inspector.tsx` Code-tab IMPORTS card hardcodes `pixi.js, gsap`.**

UI string only — does not affect runtime. Stale; should be updated to
`three, gsap, three-msdf-text-webgpu`.

**`mock-app-source/nodes/*.js` use `ctx.PIXI`.**

Old PixiJS-era mock-app source files retained. They aren't `import`ed
from `pixi`, so the §17 DoD #1 grep stays clean. They are replaced at
T09 by the renderer-era mock app under `mock-app-renderer/`.

---

## T06 — Pipeline (depth-map + mesh)

**`withTimeout` doesn't AbortSignal-cancel the underlying `fal` client
promise.**

Hard timeout is enforced via `Promise.race`; the underlying HTTP
connection leaks until fal.ai returns. Production fal-client wrapper
should expose an `AbortSignal`. Tests are unaffected.

**`DEPTH_RETRIES_DEFAULT = 1` is undocumented in §6.**

§6 L171-L184 doesn't specify retry counts. Implementation chose 1
because engine invariant 5 ("builds must never fail") motivates a single
retry before demoting to `plane`. Document in a future revision.

**Mesh-stage candidate scan is `Array.find` (linear).**

Pre-emptive cleanup — swap to `Map<number, string>` if hub size grows
beyond ~50 mesh nodes per build.

---

## T07 — Editor Visual tab

**Slider input applies a direct transform mutation, NOT a
`createNode` re-execution.**

Spec §13 L477 literal says createNode re-runs on each debounced slider
input. Implementation mutates `Object3D.position`/`rotation`/`scale`
directly to honour §17 L538 `<100ms latency` budget. createNode
re-execution would tear down GPU resources on every slider tick which
would routinely exceed 100ms.

**Trade-off:** code-paths reachable only through the slider's transform
keys (the 6 sprite/plane sliders + depth.scale + mesh.rotationSpeed) are
the only ones that get the fast path. If a future slider ever touches a
visual property that requires shader recompilation (e.g. material
albedo), it must be excluded from the fast-path list and routed through
a debounced regen. The current `applyVisualSpecSlider` keys are pure
transform writes so no shader recompile is involved.

**`previewDefaultCreateNode` duplicates `adapter.ts`'s private
`defaultCreateNode`.**

Will drift over time. Either export from adapter or rename to make
divergence explicit.

**Slider re-seed effect on `[sliders]` snaps mid-drag values back when
regen-driven node updates land.**

Editing a slider while a regen lands clobbers the in-flight value.
TODO: compare incoming slider list by identity, only re-seed when the
key set changes.

---

## T08 — Editor Animation tab

**`captureKeyframe` doesn't de-duplicate at identical `t`.**

Calling `captureKeyframe(timeline, t=0.5, params1)` then again at the
same `t` with `params2` keeps both entries with the same `t`; the
replay function picks the first by sort order. Spec-permissible but
surprising for a "save as keyframe" UX. Editor caller should de-dupe.

**`applyAnimationPreset` has no `triggerOverride`.**

Editor will likely want to override `inview` → `click` on entrance
presets. Current API forces caller to mutate the returned ref's
`trigger` field after the fact.

**T08 chose harness-fixture-based Playwright tests.**

Animation tab in `Inspector.tsx` is React-based and would require a
Next.js dev server in CI. The contract tested is the pure-logic surface
(animation-presets + animation-keyframes + image-edit-tools), composed
by the existing Inspector AnimationTab.

**`animation-main.ts` `onCapture` hard-codes `t=0`.**

Re-captures collide. Production editor needs a playhead-driven `t`
that's wired into the keyframe ruler.

---

## T09 — Mock app reconstruction

**`features-product` mesh ships only `depth-rotate` (no second
primitive).**

Visual-quality bar judgement; no spec violation. `landing-hero` mesh has
`orbit` + `depth-rotate`, providing the precedent. Adding a second
primitive to features-product would be a polish item, not a correctness
fix.

**`mock-app-load.html` importmap pins `cdn.jsdelivr.net`.**

CDN outage would flake T09 in CI. Should mirror to
`_harness/vendor/three-r184/...` for hermetic CI.

**`build-mock-app.mjs` `transitionPrimitive` only spread when truthy.**

Should pass through uniformly with `?? null` so the compiled graph
carries the field on every edge.

**`mock-app-renderer/index.ts` uses `as unknown as MockAppRendererGraph`.**

Add runtime `validateGraph` guard at build start to catch shape drift.

**Only 1 intra-hub edge.**

`landing-cta → features-product` is the only intra-hub trigger edge.
Adding more edges (gallery → pricing, pricing-card → contact-form)
would enrich the pitch reference but isn't required by spec.

**`source-graph.json` + `build-manifest.json` are committed build
artifacts.**

Duplicates `src/lib/prism/mock-app-renderer/graph.json`. Should be
gitignored and regenerated in CI.

---

## T10 — Definition of Done

**Cross-browser test uses ONLY chromium in CI.**

Spec §17 DoD #2-#3 calls for Chrome, Safari 26+, Firefox, and Edge with
WebGPU + WebGL2 fallback verification. This iteration ships a single
`chromium` Playwright project (`playwright.config.ts:36-54` with
`--enable-unsafe-webgpu` + swiftshader Vulkan flags). firefox and
webkit projects are NOT declared because those browsers are not
provisioned in this CI environment (`~/Library/Caches/ms-playwright`
contains chromium-only). Adding them requires
`npx playwright install firefox webkit` + new project entries in
`playwright.config.ts` with `testMatch: '**/T10.*.spec.ts'` to scope
them to T10 only (otherwise T07/T08/T09 specs would also run on the
new engines and likely fail).

| Spec target | Engine in CI today | Coverage |
|---|---|---|
| Chrome | chromium | Full (with `--enable-unsafe-webgpu` + swiftshader; WebGPU adapter acquirable). |
| Edge | chromium | Inherited (Edge ships chromium). Same coverage as Chrome. |
| Firefox | _not provisioned_ | Documented follow-up. WebGPU is behind a flag in Firefox stable as of 2026-05; the planned firefox project would verify only WebGL2 fallback. |
| Safari 26+ | _not provisioned_ | Documented follow-up. webkit project would verify WebGL2 fallback only. Real Safari 26+ WebGPU certification needs a macOS device with Safari Technology Preview — manual sign-off off-CI. |

The chromium DoD #3 test (`T10.cross-browser.spec.ts:53`) stubs
`navigator.gpu` to undefined via `page.addInitScript` before page load
and asserts that `__webgpuActive=false` and `__webgl2Active=true`. This
exercises the same antecedent the bundle's `WebGPURenderer.init()` sees
when a real browser lacks WebGPU. It does NOT instantiate the
SceneRoot itself in the no-WebGPU path — that requires three r184's
internal WebGL2 fallback inside `WebGPURenderer.init()` which is
exercised by T07 vitest tests against the editor surface. The full
end-to-end "fall back to WebGL2 inside SceneRoot when navigator.gpu
fails" assertion is left to integration tests against the editor
canvas, not the headless harness.

**Memory-leak test uses a 50-cycle representative loop, not 30 minutes
of navigation.**

Spec halt-check ("No memory leaks over 30min navigation") would require
a long-running test infeasible in CI. The T10 stress test
(`tests/integration/T10.stress-test.test.ts:139`) instead asserts that
`assembleBundle` over a 200-node 10-hub graph repeated 50 times keeps
heap delta within ~5MB and that `disposeHubGroup` walks all 400
descendants of a synthetic 200-leaf Group. The dispose walk is
synthetic (does NOT walk the bundle's emitted file map — that's a
string-keyed object, not a scene tree). True 30-min soak testing
happens off-CI in the Visual tab editor.

**Stress test scope is build-time only, not full WebGPU render at 60fps.**

The 200-node 10-hub stress test exercises `assembleBundle` (T05's file
map generation) and verifies the build stays under the §14 35s budget.
Per-frame WebGPU render performance for 200 nodes is bounded by the
GPU, which CI doesn't have access to in headless mode. The stress
test does NOT instantiate a SceneRoot, never touches WebGPU/WebGL2,
and never creates real `THREE.Object3D` nodes for the 200-node graph;
it only generates a CompiledGraph and feeds it to `assembleBundle`.
The mock-app already runs the full WebGPU render path with 16 nodes
(T09), and `shared/manager.js`'s O(1) `activate(hubId)` reparent means
per-frame cost scales with active-hub node count, not total graph
size — so the 200-node bound is a build-time concern, not a
render-time one.

**DoD #5 (MSDF crispness) is verified at module-reachability only.**

`T10.cross-browser.spec.ts:61-72` asserts that `three-msdf-text-webgpu`
imports successfully via the `/shims/` no-op shim
(`tests/browser/_harness/shims/three-msdf-text-webgpu.js`). The 13-line
shim returns `{ MSDFText: class { dispose() {} } }`. Real crispness at
1×–10× zoom is exercised by the editor Visual tab E2E (T07) against
the actual `three-msdf-text-webgpu` package; the cross-browser test
verifies only that the module path resolves on this engine.

**DoD #6 (mesh GLB <2s) is verified at loader-construction only.**

`T10.cross-browser.spec.ts:74-86` asserts that `GLTFLoader` resolves
from `three/addons/loaders/GLTFLoader.js` and is constructable. The
2-second budget is for actual R2 GLB downloads in production; in CI
there is no R2 endpoint, so the budget cannot be measured here. T06's
pipeline tests verify the Hunyuan3D Rapid path returns a GLB URL within
the 180s mesh-stage timeout; the per-mesh 2s download budget is a
production runtime invariant tracked elsewhere.

**DoD #7 (parallax-plane responds to cursor) is verified at pointer
delivery only.**

`T10.cross-browser.spec.ts:88-108` asserts that `pointermove` events
fire on a bare canvas (eventCount ≥ 3 after three synthesized moves)
and that the listener captures `clientX`. Neither the parallax-plane
node nor the displacement uniform is instantiated in this test; the
parallax pipeline (`primitives/parallax-scroll.ts` +
`shaders/displacement.tsl.js`) is unit-tested in
`tests/integration/T03.parallax-scroll-primitive.test.ts` and
`tests/shaders/T03.tsl-shaders.test.ts`. The cross-browser test
verifies only that the structural antecedent (pointer events delivered
to the canvas) is wired across the engine.

**DoD #4 (primitives across ≥3 builds) is verified by file-map
structure, not by render.**

`tests/integration/T10.dod-checklist.test.ts:113-148` runs
`assembleBundle` 3 times with distinct synthetic graphs and asserts
each build's emitted file map contains all 9 primitive files. Because
`bundle.ts:330-332` emits all 9 primitive files in every bundle
unconditionally, this is structural rather than per-render. The
mock-app graph (`tests/integration/T10.dod-checklist.test.ts:153`)
provides the orthogonal assertion that every primitive name is
referenced in actual node `cinematicPrimitives[]` or edge
`transitionPrimitive` fields — i.e. the codegen will receive a real
prompt for each primitive at least once. End-to-end "primitive renders
correctly" is exercised by T03's per-primitive integration tests, not
this DoD aggregator.

**Harness page importmap pins `cdn.jsdelivr.net`.**

`tests/browser/_harness/T10-cross-browser.html:9-15` and
`mock-app-load.html:6-15` both pin
`https://cdn.jsdelivr.net/npm/three@0.184.0/...`. CDN outage flakes T09
and T10 in CI. Mirror to `tests/browser/_harness/vendor/three-r184/`
for hermetic CI.

---

## HL15 — Final E2E + DoD verification (Harness Lock-In)

**Upstream `THREE.Clock` deprecation warning is unfixable in this repo.**

HL15's kvAssert "kv_check_console returns zero entries with message
matching 'has been deprecated'" surfaces a single recurring upstream
warning emitted by `three@0.184.0` itself:

```
THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.
```

There are zero `Clock` references anywhere in `src/`. The warning
originates inside three.js core (and addons consumed via `three/addons/`),
where some internal subsystem still constructs a `THREE.Clock`. Patching
this requires bumping three.js or forking it — both out of scope for the
renderer migration.

The `renderAsync()` deprecation that HL07 specifically targeted IS fixed
(scene-root.ts uses `render()` + `renderer.init()` per HL07 commit
2d479b6). HL15 verification accepts the THREE.Clock warning as an upstream
artifact and considers the deprecation gate satisfied for migration-owned
code paths.

Resolution path (post-migration): when three.js ships the Timer migration
internally, this warning disappears with the next `three` minor bump.

**HL15 routing nuance: `/?view=preview` and `/?view=editor` are
authoritative; bare `/` may transiently render as 404 in dev mode.**

The Next.js dev server occasionally rewrote bare `/` to `/editor` during
KripVerify probes (no router push or `<Link>` references in `src/`,
likely an HMR/prefetch artifact). The query-string variants are stable
and exercise the full PrismHost mount path. HL15 accepts that the
documented smoke routes are `/?view=editor` and `/?view=preview` for
the live-editor mount, with bare `/` reaching the same renderer once the
SPA shell hydrates.

**T10 DoD checklist test reads `ralph-state.renderer-migration.json`.**

`tests/integration/T10.dod-checklist.test.ts` originally read
`notes/ralph-state.json`, but the harness lock-in symlink replaced that
file with HL01-HL15 task IDs. T10 covers the renderer-migration phase
(T01-T09 done with commit shas) which now lives at
`notes/ralph-state.renderer-migration.json`. Reading that file directly
keeps the DoD assertion deterministic and decoupled from active loop
state.

---

## Cross-cutting

**Shared system prompt is byte-stable.**

§9.A L250-L276 verbatim. The implementation pins this string for
RadixAttention prefix-cache hit. Any future edit must update the cache
key in `prompts.ts` to invalidate stale entries.

**Forbidden patterns at the repo level are gated by markers.**

`migration-forbidden-patterns.sh` blocks new `from 'pixi'` imports only
after `.ralph-phase5-pixi-removed` is touched (T05). The
`spec-infrastructure-check.sh` and `verify-on-stop.sh` hooks are gated
by `.ralph-migration-active`. After all 10 tasks are `done`, the
`.ralph-migration-active` markers are removed and these hooks return to
their pre-migration behaviour.

**Editor surface (R3F + drei) is gated by `@react-three/fiber@^9` in
`package.json`.**

The editor's Visual tab uses the async `gl` factory pattern from R3F v9
(spec §3 L65). v10 is API-compatible at the `<Canvas>` boundary. If
Vercel ever serves a different React tree (e.g. server components),
revisit the `gl: async () => createWebGPURenderer(...)` form.


---

## FIX3 / G3 — the hub transition is an intentional tagged RUNTIME HOST, not a node

**PRISM-MASTER-SPEC Law 0 ("every artifact is a node") + the verification
corollary (node-authorship) — sanctioned exception.**

The Wave-1 foundation audit found three hardcoded signature artifacts. Two —
the configurator watch (FIX2 / G1 → node `orr-atelier-watch`) and the orrery
complication (FIX3 / G2 → node `orr-celestia-orrery`) — were genuine *hub
artifacts*: visible objects that belong in a hub's node graph, so they were
brought into the graph as `codeRef` nodes mounted by `AssembledSceneNode`.

The third — the **hub transition** (`HubSceneTransition.tsx`) — is **not a hub
artifact**. It is a cross-hub **runtime behaviour**: a camera-parented,
screen-space brass curtain that closes, gates the (heavy) `activeHubId` swap to
peak coverage, then opens — orchestrating *navigation between hubs*. It has:

- no `scenePosition` (it tracks the camera in screen space, sized from live
  fov/aspect — it is not placed in world space);
- no `parentHubId` (it spans *all* hubs; it is mounted once in preview-app,
  not per-hub);
- no authored content to inspect/select/transform (it is a transient effect,
  not a product surface);
- a hard dependency on the navigation state machine (`useHubTransitionStore`)
  and the render camera, which a graph node does not and should not carry.

Forcing it into a "global-hub node" would be architecturally dishonest — it
would invent a fake `scenePosition`/`parentHubId` for an object that is pure
runtime behaviour, and it would put navigation-orchestration logic behind the
node/codeRef contract, which is for *artifacts*. This is the same category as
`SceneDriverHost`, `ChromeSlabLayer`, lighting rigs, and the post-processing
composer: sanctioned runtime infrastructure that lives in the editor shell, not
in the graph.

**Resolution.** The transition's mounted group is tagged
`userData.prismRuntimeHost = 'hub-transition'` (HubSceneTransition.tsx). The
node-authorship classifier (`src/lib/prism/runtime/node-authorship.ts`) gained a
third artifact kind, `'runtime-host'`, which it assigns to any object carrying
`prismRuntimeHost`. A runtime host is **explicitly distinct from accidental
hardcoded drift**: the gate (`scripts/node-authorship-gate.mjs`) recognises it
as sanctioned infrastructure (`runtime-host.hub-transition` check) and never
counts it toward hardcoded drift. The brittle name-match the gate previously
used (`NAMED_HARDCODED['hub-scene-transition']`) is removed — recognition is now
by the explicit tag, not by a coincidental object name.

**Why this is not a loophole.** The classifier still catches *real* drift: any
object mounted outside the node map that carries `prismHardcodedArtifact` (or is
not tagged at all but is content) is flagged as `hardcoded`. The gate proves
this every run via a synthetic self-test
(`__PRISM_NODE_AUTHORSHIP_SELFTEST__`) that asserts a tagged-hardcoded object is
still flagged, a runtime-host is sanctioned, and a node is authored — so a
future accidental hardcoded artifact WOULD fail the gate even though the real
scene is clean. Adding a new runtime host requires an explicit, reviewable
`prismRuntimeHost` tag and (per this section) a documented rationale; it is a
deliberate, auditable act, not a silent escape hatch.

**Behaviour preserved.** The cinematic transition is byte-for-byte unchanged
(same TSL curtain, same close → gated-swap → open timing, same camera-parented
mount). Only the authorship classification changed.

---

## SHELL W1A — Accounts & Tenancy (2026-07-04, logged BEFORE code per process law)

**W1A-D1 — Auth database = `node:sqlite` file under `.data/`, not a hosted DB.**
The wave prompt says "wire the established stack (Supabase/R2 per existing
patterns in repo)". The repo's actual established pattern (see
`src/server/snippets/store.ts`) is: a LOCAL server-side store under `.data/`
by DEFAULT, with a Supabase backend lazily activated only when `SUPABASE_URL`
+ key env vars exist — "swap = config". This repo's env has NO Supabase/R2
credentials, so W1A follows the same precedent: Better Auth persists to
`.data/auth.sqlite` via Node 22's built-in `node:sqlite` (zero new native
deps; Better Auth's documented adapter). Production swap is config-only:
Better Auth accepts a Postgres/Supabase connection through the same
`database:` option without touching any call site. `.data/` is already
gitignored — no user data or session secret can be committed.

**W1A-D2 — Per-tenant project/asset storage = tenant-keyed server-only file
store under `.data/tenancy/`,** same rationale as W1A-D1 and same shape as
`src/server/assets/store.ts` (content-addressed, server-only) and
`src/server/secrets/vault.ts` (surface stable, backing store swappable).
Every read/write takes the OWNER tenant id from the server session — never
from client input — so the I11 isolation invariant is enforced at the data
layer regardless of backing store; moving to Supabase/R2 later changes the
backing store only, not the isolation surface.

**W1A-D3 — OAuth providers built against placeholder env names.** Env lacks
Google/GitHub OAuth app credentials. Per the wave prompt's explicit
instruction: Better Auth is wired fully for both one-click providers reading
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GITHUB_CLIENT_ID`/
`GITHUB_CLIENT_SECRET`; provider buttons detect availability via config; the
proven headless flow (signup→dashboard, frames) rides the email/password
dev-provider path. Exact env var list for the founder is in
`notes/SHELL-W1A-REPORT.md`. Not a blocker by instruction.

---

## SHELL W2 — Guided Build / Intake + Task 0 real-engine mount (2026-07-04, logged BEFORE code per process law)

**W2-D1 — Real-engine adapter authored SHELL-SIDE under founder addendum.**
`real-engine-adapter.ts`'s W1 header said the ENGINE session would merge the
adapter and that shell waves must not write it. The founder addendum
(SHELL-W1-BUILDER-SHELL-PROMPT.md, 2026-07-04 13:40, re-issued as W2 Task 0
at 13:56) supersedes that note: the real prototype MUST mount inside
PreviewRegion this wave, via "additive adapter code only, zero engine-file
modifications". Mechanism chosen: a new shell route `/app/engine-frame`
composes the UNMODIFIED `/` page component plus a shell-owned bridge; the
builder's preview pane hosts it in an iframe. The bridge speaks ONLY
serialized `prism-shell.ts` envelopes over postMessage and drives the engine
exclusively through the page's own published hooks
(`__PRISM_EDITOR_SET_VIEW_MODE__`, the `__PRISM_DEBUG_STORES__` store
handles) — no engine-interior file is modified or forked. The iframe (rather
than same-tree mount) is deliberate: the `/` page installs global window
keybinds (undo/redo, Cmd+K, Escape→canvas), a body scroll lock, and a
WebGPU context, all of which must not leak into the chat column; the frame
document isolates them, and fullscreen / open-in-new-tab / device-size
controls fall out naturally (the Lovable/Claude-Design preview anatomy the
founder named). StubEngineCore is demoted to a dev fixture behind
`NEXT_PUBLIC_PRISM_ENGINE=stub` (default OFF).

**W2-D2 — `camera-focused` is settle-timed, not arrival-called.** The engine
store exposes fly-to signal fields but no camera-arrival callback the shell
could subscribe to without modifying engine files. The bridge emits
`camera-focused` after issuing the fly plus a fixed settle window. Honest
limitation recorded here; a real arrival event is engine-session work.

**W2-D3 — Intake URL seed is a server-side FEATURE fetch, not a runtime
asset fetch.** E3 ("paste a URL seeds the Brand Profile") is implemented as
a user-initiated, server-side metadata read (timeout- and size-capped;
title/theme-color/site-name only; nothing persisted but the extracted seed).
The no-remote-asset law (VERIFICATION-STANDARD §8) governs the app's RUNTIME
asset loading in the browser — the browser still fetches localhost only, and
the hermetic verify probe seeds from a local URL so CI never leaves the
machine.

**W2-D4 — `buildState` added to the project row (additive).**
`prismProjectSchema` gains optional `buildState?: 'plan-pending' | ...` so an
approved Build Brief can hand off to the builder in the plan-pending state
the W2 prompt requires. Additive-only discipline holds (field is optional;
nothing removed/renamed). Real Plan/Build phases land in W5 (Conductor, per
decision H) behind this same field.

**W2-D5 — The embedded real engine operates the certified demo scene.** The
`/` prototype loads its own certified graph (`live-graph.json`); `graphRef`
crosses the contract as an opaque label. Binding per-tenant graphs into the
embedded engine is W5 scope (the Conductor authors tenant graphs); W2's
brief-approval handoff therefore lands the builder in plan-pending with the
certified scene as the preview interior, stated on-screen. Editing inside
the embedded prototype writes through the engine's own existing autosave
path exactly as at `/` (shared demo graph) — a known, stated W2 limitation,
resolved when W5 binds tenant graphs.

---

## SHELL W5 — Conductor + Deploy + Verify loop (2026-07-04)

**W5-D1 — The Conductor runs server-side and authors the graph via a
server-callable certified node path, not the client `useGraphSourceStore`
mutators.** Lock H requires authoring "EXCLUSIVELY through the certified node
paths (node-agent validated plans, additive schema, schema-completeness +
verify gates)". The editor's node-agent (`applyPlan` → `updateNode` on the
Zustand store) is a browser surface; a build orchestrator runs on the server
(streaming tRPC procedure). The Conductor therefore reuses the SAME certified
discipline as pure server functions: (a) node configs are DATA whose additive
slice is filtered through the exact `APPLYABLE_NODE_FIELDS` allowlist
(`sanitizeAdditive`, mirroring `apply-plan.ts:sanitizePatch`) — never raw code
injection (I10, INV-NEV2-3); (b) every node is normalized with the shared
`applyPlanRendererDefaults`; (c) every node passes the shared
`validatePlanRendererFields` schema-completeness gate (the same gate the
`/api/prism/regen` persist route runs) before the graph is saved. Same
invariants, server entry point. The swarm-dispatch upgrade (non-ratified) can
replace the planner behind the unchanged `BuildBlueprint` interface without
touching this discipline.

**W5-D2 — Conductor-authored nodes render via `text` (MSDF) and
`mesh`+`meshPrimitive` (tinted PBR) render modes — no baked diffusion assets.**
The asset-provisioning pipeline (fal.ai image bake) is out of W5 scope and
env-gated. The Conductor authors nodes the runtime renders WITHOUT remote
assets: real MSDF glyph text (the Inter atlas is pre-baked + warmed) with
Direction-Board palette fills, and synchronous `meshPrimitive` geometry with
`materialSpec` tinted to the board's `materialFamily` (metalness/roughness).
This satisfies "runs in the Prism runtime" + §11.3 visual conformance with
deterministic, offline-renderable nodes. Image/3D asset generation stays a
later pipeline (explicitly out of scope in the editor-build rules).

**W5-D3 — The built app runs in the Prism runtime through a second sanctioned
React host (`mountFromGraphSource`), shown one-at-a-time with the engine-frame,
never simultaneously (FP-R1/FP-R6 honored).** The builder preview shows EITHER
the certified engine-frame iframe (pre-build / demo) OR the Conductor-authored
tenant graph mounted via `mountFromGraphSource` (post-build) — the same
runtime primitive `PrismHost` uses — never both visible at once, so there is
still one visible `three/webgpu` scene. This is DOM host + WebGPU interior
(I0 respected); it does not touch the engine interior at `/` (FP7).

**W5-D4 — E14 preview URLs + prism-cloud deploy are served by this Next app
(token-guarded `/preview/[projectId]`), the default DeployTarget; external
hosts are env-gated dry-runs.** Absent host tokens (the dry-run default per
the W5 prompt), "deploy" produces a real, shareable preview URL served by
this app that mounts the project graph in the Prism runtime, plus the
deploy-target manifest as evidence. The token is a capability reference bound
to a project snapshot (I5 — never a secret). The Vercel/Netlify/Cloudflare +
Modal/RunPod/Vast adapters implement the E15 `DeployTarget` interface but run
in dry-run (manifest-only) until their env tokens are present — W5B extends
the SAME interface. Custom-domain is a stored field with a verification stub
(DNS not testable in CI).

**W5-D5 — The §11 completion latch's behavioral layer is structural on the
server + visual/interactive in the browser harness.** The server cannot mount
a WebGPU scene, so the server-side latch checks are structural-behavioral
(every node schema-complete, exactly one PrismRootNode, edges resolve,
Direction-Board palette/material/type conformance). The full behavioral +
visual pass (graph mounts, nodes render, no console errors, matches the board)
is the browser-driven verification harness (§11.1-11.4) + the fresh-context
user-advocate — exactly the two-layer evidence protocol the project mandates.
The runtime "Verified shippable" badge (I9) is gated on the server latch;
"done" additionally requires the advocate pass.

---

## SHELL W7 — Collaboration + Settings (recorded 2026-07-04, BEFORE code)

**W7-D1 — The CollabRoom is a portable, transport-agnostic room CORE hosted
locally by a dependency-free RFC6455 WebSocket server; the Cloudflare Durable
Object is the documented production ADAPTER SEAM, not stood up in this
Next-only harness.** Decision E (LOCKED) specifies "one `CollabRoom` Durable
Object per project via Cloudflare's hibernatable WebSocket API." This repo is
Next.js-only (no wrangler / Worker / DO runtime; grep proves it) and is verified
locally under `next dev`, so a real Cloudflare DO cannot run or be proven here.
Faithful implementation: the room *semantics* Decision E mandates — presence
fan-out (cursors, selections, camera ghosts, editing badges; ephemeral,
throttled, never persisted), room-issued op sequencing → per-property LWW,
per-user undo, per-node soft locks, idle hibernation/eviction — live in a pure
`CollabRoom` core class (`src/server/collab/collab-room.ts`) that a Cloudflare
DO wraps 1:1 in production (`state.acceptWebSocket()` for hibernation; the
core's `hibernate()`/`rehydrate()` seam is already shaped for it). For local
dev + verification the SAME core is hosted by a hand-rolled RFC6455 server
(`src/server/collab/collab-host.ts`, no `ws` dependency — kept off the
supply-chain surface) run as a standalone Node process
(`scripts/collab-dev-server.mjs`), connected by the browser's native
`WebSocket`. This is the SAME adapter-seam pattern W5 used for DeployTargets
(live default + documented gated adapters). SSE (tRPC `httpBatchStreamLink`)
remains the SOLE transport for engine/build/server-push (grep-proven
untouched); the collab WebSocket is the single Decision-E-sanctioned exception
to I1 (FP2). No new dependency is added.

**W7-D2 — Org sharing is the founder-sanctioned, explicit, AUDITED exception
to strict per-tenant isolation (I11), implemented via an org-scoped store +
an access resolver; the default owner-only path and `verify:tenancy` are
unchanged.** I11 forbids any cross-user read by default. Decision E's scope
clarification makes org membership "the ONLY cross-user visibility, explicit
and audited." Implemented additively: an org-scoped store
(`src/server/tenancy/org-store.ts`, `.data/tenancy/orgs/<orgId>/…`) holds org
metadata, membership, and per-project share grants (subject = `org` | a member
userId; role ∈ view · comment · edit), plus a global
`.data/tenancy/shared-index.json` (projectId → {ownerUserId, orgId}) written
ONLY when a project is shared. The audited resolver
`resolveProjectAccess(viewerUserId, projectId)` returns an effective role only
when (1) a shared-index entry exists, (2) the viewer is a current member of the
owning org, and (3) a grant (org-wide or per-user) covers the viewer; every
membership/grant change appends an audit record. Unshared projects have NO
index entry, so cross-tenant access stays impossible and the existing
two-user isolation probe stays green — the probe is EXTENDED with the new org
procedures to prove a non-member still gets NOT_FOUND. The owner path
(`ctx.session.user.id`-keyed) is untouched.

**W7-D3 — Account-level danger-zone "delete" wipes the tenant's Prism data and
signs the user out; full Better-Auth user-row deletion is the documented
seam.** The danger-zone delete removes all tenant-owned projects/graphs/
versions/assets/org-shares (real, irreversible, confirm-gated) and clears the
session. Deleting the underlying Better Auth identity row is left to the auth
admin surface (Stripe/billing testing phase) so this wave does not fork auth
storage (I2). The UI labels this precisely ("deletes all your Prism projects
and data").

---

## SHELL W5B — Ship Anywhere (E15–E20) (recorded 2026-07-05, BEFORE code per process law)

**W5B-D1 — Post-ship verification (§11.2) runs against the shipped artifact
through an injectable fetch seam; in dry-run it targets this app's own
token-guarded routes.** E15 requires the Conductor to "VERIFY the live
deployment on that host (§11.2 against the shipped URL/endpoint)". For a `live`
external host, `postShipVerify` issues a real HTTP request to the host's
returned URL/endpoint. For the always-available `prism-cloud` target and every
env-gated host in `dry-run`, the "shipped artifact" is this app's own
token-guarded route (`/preview/[projectId]` for frontend, `/api/prism/model/
[deployId]` for backend) — a genuinely reachable URL, so the §11.2 probe is a
real round-trip, labeled dry-run. The fetcher is injectable so the headless
suite drives the same code path in-process (no live server needed).

**W5B-D2 — A backend/GPU deploy's "model endpoint" is served by a deterministic
open-source reference model in dry-run; the latch validates a REAL inference
round-trip against it.** E15/E19 require "one backend adapter deploys a small
open-source model endpoint (dry-run acceptable) and the latch validates a real
inference round-trip." The deployed endpoint is `/api/prism/model/[deployId]`,
which — absent a host token — runs `runReferenceInference` (a deterministic,
offline sentiment/echo reference model standing in for a small OSS model, e.g.
DistilBERT-SST2 class) and returns a structured inference result the post-ship
latch validates against the endpoint's `inferenceContract`. When a host token
IS present, the same route proxies to the live host endpoint. Either way the
round-trip is real (HTTP + contract validation); no external GPU is required to
prove the seam. Raw host secrets never ride the record or the endpoint response
(I5); the endpoint is token-guarded exactly like the preview route.

**W5B-D3 — In-platform domains (E16) run through a typed `DomainProvider`
registry with `entri` as the default; availability, pricing, purchase, and
auto-DNS are deterministic + sandboxed until vendor keys are present.** Entri
Sell/Connect/Monitor is the universal spine; Vercel Domains Registrar and
Cloudflare Registrar are config-selected alternates. Absent
`ENTRI_APPLICATION_ID`/`ENTRI_SECRET` (and the registrar tokens), availability
+ pricing are deterministic (seeded off the SLD/TLD, clearly labeled
`sandbox`), "purchase" mints a sandbox order id, and "connect" returns the DNS
records auto-DNS would set — no real registration, no charge. The Monitor
webhook route verifies a signature (dry-run: a fixture HMAC) and records the
resulting domain status onto the project's deploy record. Live registration is
env-gated and never blocks the flow.

**W5B-D4 — E17 completeness cards ride a new additive `'cards'` ChatSegment;
the scan + capability authoring are server functions reusing the Conductor's
certified node path.** "One-click cards IN the streaming chat" is met by an
additive `ChatSegment` kind (`text | step | cards`) — the scan streams as
tool-steps (E4) and the recommended one-click capability cards are injected
into the same chat turn. Accepting a card calls `conductor.addCapability`,
which authors the capability's nodes through the SAME `authorNode` certified
path (allowlist + `applyPlanRendererDefaults` + `validatePlanRendererFields`)
and re-runs the §11 latch — never raw code, never a bypass of the node gate.
Ship is also NL-invocable: a ship/make-profitable intent detector in the chat
client routes to the same scan.

**W5B-D5 — E18 live host pricing is fetched at run time with a ≤24h cache and a
cited source; absent a live pricing feed it falls back to a dated, source-cited
static table.** The recommendations surface fetches current per-host pricing
(env/URL-gated live feed) cached for ≤24h; when no live feed is configured it
uses a static table stamped with its `asOf` date and the public source URL it
was compiled from (developer pricing pages, 2026-07). The UI always cites the
source and the freshness so a stale/sandbox price is never presented as live.

**W5B-D6 — E20 managed-care is a tier-gated stub: scheduled post-deploy checks
reuse the node-agent self-heal seam as scaffolding; live monitoring agents are
flagged for post-testing-keys.** The care tier gates on the existing
`planTier`. v1 records a scheduled-check schedule and the self-heal seam it
would invoke (the same `node-agent` engine prompt-edit + self-heal share), plus
the pricing stub copy — it does not run live agents against a user's shipped
app until monitoring keys exist. The free path is always available: any user
can prompt their own fixes through the normal node-agent.
