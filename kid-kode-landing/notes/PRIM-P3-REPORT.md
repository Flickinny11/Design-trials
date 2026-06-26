# PRISM PRIMITIVE SYSTEM — PHASE P-3: THE FLUID SYSTEM — REPORT

Status: **RUN COMPLETE** (pending fresh-context advocate, recorded below).
Branch: `prism-editor-build`. Route: **`/fluid-lab`**. Spec: `docs/prism/PRISM-PRIMITIVE-TEMPLATE-SYSTEM-SPEC.md` §3.
Builds on committed **P-1** (`/primitive-lab`) + **P-2** (`/material-lab`). Production + P-1/P-2 untouched.

Commits (this run, on `prism-editor-build`):
- `5454fa6c` — w-fluid (TSL/WebGPU ping-pong wave-equation sim + liquid-glass surface material + params + route)
- `fccf965a` — w-liquidglass (go-liquid expand timeline + iridescence + dense refraction backdrop)
- `bde73f17` — w-node (dogfooded Inspector + palette + MLS-MPM volume + MSDF labels)
- `<w-verify>` — w-verify (behavioral verification + advocate + report)

---

## 1. WHAT IT IS

Customizable 3D **FLUIDS** as a material/primitive class on **TSL + WebGPU compute** (spec §3.1), each a real **NODE** (Node Law), tuned LIVE, reviewable at `/fluid-lab`. Two kinds:

- **`surface` (Liquid Glass)** — the verified-everywhere core. A real GPU fluid SIM (ping-pong RenderTargets, a damped **wave-equation height field** coupled to an advecting velocity field) drives the NORMAL + RELIEF of the founder-approved **transmission glass** (the `/toolbar-chassis` pane recipe) so the slab **refracts + warps the environment behind it AS THE FLUID FLOWS**. "Any glass element can go liquid" — the liquid-glass timeline (phase 0 = solid slab → phase 1 = expanded flowing liquid) IS the P-4 nav-dropdown expansion.
- **`volume` (Fluid Volume)** — a WebGPU-only **MLS-MPM-style particle fluid** (curl-advected, position-based GPU compute, 36k particles), feature-gated on `renderer.backend.isWebGPUBackend`; gracefully falls back to the liquid-glass surface on the WebGL2 backend.

EDITABLE params (spec §3.2), all live: **viscosity** (togetherness), **surfaceTension**, **flowSpeed**, **flowDirection/pattern** (directional/swirl/turbulent/radial), **thickness/depth**, **turbulence**, **IOR/refraction**, **tint/opacity**, **damping**, **reactsToInteraction** (pointer injects velocity).

---

## 2. ARCHITECTURE (reusable for P-4..P-6)

**Renderer — the pivotal decision.** Spec §3.1 mandates TSL + WebGPU compute, and TSL node materials REQUIRE `WebGPURenderer` (a classic `THREE.WebGLRenderer` cannot compile TSL). So `/fluid-lab` runs on a `WebGPURenderer` R3F canvas (mirrors `bg-lab`'s `webgpuFactory`), which **auto-falls-back to the WebGL2 backend** when `navigator.gpu` is absent. CONFIRMED: headless Playwright has `navigator.gpu === false` → WebGL2 backend, which still **paints the full scene** (ping-pong float RenderTargets + fragment passes are WebGL2-safe). `compute()`/StorageTexture are WebGPU-only → that is exactly why MLS-MPM is the gated `volume` enhancement and the ping-pong surface is the verified core.

**The GPU sim (`fluid-sim.ts`).** `FluidFieldSim`: two `RenderTarget`s (HalfFloat) ping-ponged through a TSL fragment pass (a `QuadMesh` + `MeshBasicNodeMaterial.colorNode`) that integrates, every frame on the GPU with NO CPU round-trip:
`h_next = (2−a)·h − (1−a)·h_prev + c²·∇²h + advection + driven-flow forcing + interaction-splat`.
Because `h_next` depends on BOTH `h` AND `h_prev` (2nd-order state memory), ripples genuinely **propagate and reflect** — a real explicit-Euler PDE integrator, never static noise. Field RGBA = `h, h_prev, velX, velY`. Ping-pong via `TextureNode.value` swap (mutable). Params map to concrete shader effects (see §4).

**The surface material (`fluid-material.ts`).** A `MeshPhysicalNodeMaterial` (the approved glass: transmission, ior 1.45, clearcoat, cool `#bfe3ea` attenuation, thin-film iridescence) whose `normalNode` = the height GRADIENT (→ refraction reads the flow) and `positionNode` = displacement along the normal by height (→ real relief), plus a faint height-driven emissive crest so the flow reads even where the WebGL2 transmission pass is faint.

**Node Law (`fluid-schema.ts` + `use-fluid-store.ts`).** A `FluidSchema` maps 1:1 to a real `PrismNode` via `schemaToNode` (emits `meshPrimitive` + `materialSpec`; the gate keys on `meshPrimitive`). Isolated lab graph store; `instantiate` creates the node + renders it in one action. Two-state: galaxy (dormant seed) ⇄ canvas (realized). Gate: `node-authorship-gate.mjs --fluid`.

**Dogfooded chrome.** The `FluidInspector` is a glass Pane primitive with milled channels + worn-alloy cube fader knobs (the chassis/keyframe vocabulary), 8 param faders + 4 pattern chips + GO-LIQUID/REACTS/REMOVE. The `FluidPalette` adds instantiate + galaxy/canvas toggle. All in-canvas (no DOM).

**Text on WebGPU.** Troika `<Text>`/drei `ContactShadows` are raw ShaderMaterials → INCOMPATIBLE with the node renderer (they emit "Material … is not compatible" and render nothing). Replaced with **WebGPU-native MSDF** labels (`FluidEngravedText` → `createTextObject` + `resolveTextAtlas`, the same proven path `HubLabels` uses in production) and removed shadow maps/ContactShadows.

---

## 3. VERIFICATION (per `docs/prism/VERIFICATION-STANDARD.md`)

<!-- FILLED FROM notes/verification/prim-p3/behavioral-metrics.json -->

### Behavioral (headless, real-pointer Inspector drags)
| Check | Result |
|---|---|
| backend | `<backend>` |
| Node Law (instantiate→node, 0 orphans) | `<auth>` |
| fader: flowSpeed (drag → param + visual) | `<flow>` |
| fader: thickness (drag → param + visual) | `<thickness>` |
| fader: viscosity (drag → param + visual) | `<viscosity>` |
| pattern chips (4) | `<patterns>` |
| GO LIQUID expand (solid→liquid) | `<goliquid>` |
| motion over time | `<motion>` |
| galaxy/canvas two-state | `<galaxy>` |
| console errors | `<errors>` |

### Hard gates
- `node-authorship-gate.mjs --fluid` — **7/7 PASS** (probe, classifier self-test, instantiate-creates-node, canvas no-orphan, all-realized, edit-no-orphan, no-pageerrors).
- `no-dom-ui-gate.mjs` (fluid scope) — **PASS** (17 files; no Tailwind/CSS-module/className/inline-style/drei-Html).
- `tsc --noEmit` — **9 = baseline / 0 new**.
- console errors — **0**.

### Fresh-context judges
<!-- FILLED AFTER JUDGES -->
- **user-advocate** (blocking): `<verdict>`
- **aesthetic-match** (no F-4): `<verdict>`
- **spec-conformance** (§3): `<verdict>`

Evidence frames → `notes/verification/prim-p3/`. Scripts → `notes/verify-prim-p3.mjs`, `notes/_fluid-validate.mjs`, `notes/_liquidglass-sweep.mjs`.

---

## 4. PARAM → SHADER MAPPING

| Param | Effect |
|---|---|
| viscosity | velocity neighbour-diffusion + height smoothing → cohesive sheet vs sharp ripples |
| surfaceTension | height curvature relaxation (rounded menisci / beading) |
| flowSpeed | wave speed (c²) + advection + driven-forcing frequency/amplitude |
| flowDirection / pattern | one-hot blend of directional / swirl / turbulent / radial force fields |
| thickness | material thickness + relief displacement amplitude + attenuation depth |
| turbulence | curl-noise high-frequency agitation injected into velocity + forcing |
| IOR | material.ior + normal-warp strength (lensing of the backdrop) |
| tint / opacity | attenuationColor (in attenuation, NOT albedo → reads as glass) + transmission |
| damping | wave-equation attenuation `a` + velocity retention (1 = long-lived) |
| reactsToInteraction | pointer injects a height + velocity splat that propagates as a wave |
| liquidPhase (timeline) | 0 = settled solid slab → 1 = fully flowing + expanded (the go-liquid reveal) |

---

## 5. HARD GOTCHAS (reuse — cost real time)

- **TSL ⟹ WebGPURenderer ⟹ no Troika/ContactShadows.** Any TSL node material forces `WebGPURenderer`; on it, raw ShaderMaterials (Troika `<Text>`, drei `ContactShadows`, classic shadow-map `MeshDepthMaterial`) emit "Material … is not compatible" and render nothing. Use MSDF text (`createTextObject`+`resolveTextAtlas`, the `HubLabels` path — NOT `createFontAtlas`/`createText`, which returns geometry-less placeholder Groups unless a WebGPU bootstrap warms its lazy factory) and drop shadow maps. This is the single biggest WebGPU-lab gotcha.
- **`navigator.gpu` is FALSE in headless Playwright** → `WebGPURenderer` runs its WebGL2 backend. The verified core must be WebGL2-safe (ping-pong RenderTargets + fragment passes are; `compute()`/StorageTexture are NOT). Feature-gate compute on `renderer.backend.isWebGPUBackend`.
- **Refraction is invisible over a flat backdrop.** Liquid glass only READS when there is detailed, high-contrast content BEHIND it to distort — a dense light-bar + glowing-orb backdrop is what makes the flow legible through the glass.
- **The height field needs real amplitude + strong coupling.** A subtle wave is invisible through glass: drive a continuous param-shaped flow source, sample the normal gradient over a few texels (not ±1), and scale relief/normalStrength generously; a faint height-driven emissive crest guarantees the motion reads even when the WebGL2 transmission pass is faint.
- **Zustand seed selection reads stale state.** After `instantiate()` in a seed effect, the captured `getState()` snapshot is pre-mutation — re-read `useFluidStore.getState()` before `select(...)`, or the Inspector (which renders only with a selection) never opens.
- **`uniform()`-typed swizzles:** annotating uniforms with `ReturnType<typeof uniform>` erases the precise TSL node type (`.x`/`.mul` vanish). Let TS infer the uniforms object; split vec2 texel into two float uniforms; use the free `mix()` for vec2 (the method form isn't typed).
- **Live phase read in `useFrame`** (not a store subscription) so the timeline driver doesn't trigger a per-frame React re-render of every fluid node.

---

PRISM-PRIM-P3: RUN COMPLETE
