# PRISM CANVAS EDITOR — SPECIFICATION

**Status:** Canonical source of truth for the Canvas (visual/spatial) editor mode.
**Date:** 2026-06-02
**Codename:** Prism Canvas v1
**Applies to:** Prism engine only. Cortex is out of scope.

> A build agent MUST read this document in full before writing any implementation code for the Canvas editor. This spec governs **Canvas mode** and its relationship to **Preview mode**. It does NOT govern the node editor / Galaxy view (see §1.3). Where this spec conflicts with pre-migration documents that still describe a PixiJS runtime, **this spec and the renderer migration win**.

---

## Reconciliation note (added 2026-06-05, Phase 3B hardening)

This spec is one of the **canonical-3** alongside `PRISM-RUNTIME-SPEC.md` and `PRISM-NODE-EDITOR-SPEC.md` (precedence in `SPEC-INDEX.md`; ruler is `PRISM-INTENT-ANCHOR.md`). It is **adopted as-is**; this note only states three cross-references — no behavior in this spec changes:

1. **"Preview" ≡ `preview-app`.** This spec's **Preview** mode (§1.1, §16) is the same mode the anchor and runtime spec call **`preview-app`**. The toggle id is `preview-app`. Both names mean: the same built scene as Canvas, editing handles hidden, live drivers running — one unified `three/webgpu` scene, not a separate compiled mount (runtime INV-R4).
2. **Build pop-transition.** This spec's `builtSnapshot` cache (§2 decision 11, §11) is the runtime spec's cache (runtime §7); the act of producing built-state is the runtime's explicit **Build** action and **pop-transition** (runtime §5). Toggling Galaxy↔Canvas↔Preview serves the cache and **never rebuilds** (runtime INV-R6).
3. **Node-editor / canvas boundary.** This spec's §1.3 boundary — **function/behavior wiring is the node editor; visual + spatial + animation authoring is Canvas; trigger buttons assign animation *drivers* only** — matches `PRISM-NODE-EDITOR-SPEC.md` §1.2/§5.3. The two specs are mutually consistent on this boundary.

---

## 0. How to read this spec

- §1–§3 define scope, locked decisions, and invariants. Read first.
- §4–§17 define behavior, surface by surface.
- §18 is the numbered atomic success-criteria checklist a build loop verifies against. Each is independently testable with evidence (command output / screenshot / runtime assertion).
- §19 is the forbidden-patterns list (drift triggers).
- §20 lists items to re-verify against the live web at build time (versions move; training data is stale).

---

## 1. Scope & mode system

### 1.1 The three modes

Prism's builder has three view modes over the **same knowledge graph**:

| Mode | What it shows | This spec |
|---|---|---|
| **Galaxy** | The 3D knowledge graph of nodes — the *unbuilt* state, elements represented as nodes instead of files. Where **function/behavior** is wired. | OUT OF SCOPE (frozen) |
| **Canvas** | The *built* state, editable. Every node's built artifact placed at its location in 3D space, drag/resize/rotate, full editing toolbar + keyframe editor. Where **visual + spatial + animation** authoring happens. | IN SCOPE |
| **Preview** | The *built* state, played back. Same scene as Canvas, no editing handles, live interactive drivers, camera navigation of the current hub. | IN SCOPE |

### 1.2 Core relationship (the premise — do not violate)

A node has two representations of the **same element**:

- **Unbuilt** = a node in the knowledge graph (Galaxy view). Holds the spec/caption + source artifact info.
- **Built** = the node's artifact assembled into a live element (image-plane, parallax-plane, mesh, splat, text, code artifact, or `.riv`) placed at its position in 3D space (Canvas + Preview).

Canvas and Preview are projections of the built state. Galaxy is the projection of the unbuilt/graph state. **Editing in Canvas mutates the same graph the node editor represents.** A node added in Canvas MUST create a corresponding node in the graph, tethered to its hub.

### 1.3 Frozen, out of scope

- The knowledge-graph topology (bipartite DAG, hubs, reparent-on-navigate), the node system, and their dependencies are the **premise of the Prism runtime** and are FROZEN. This spec does not add, remove, or alter them.
- The Galaxy / node-editor view is a separate surface and is not modified here.
- **Function / behavior wiring** (making an element or text actually do something — navigate, submit, call an API, toggle state, bind data) happens in the **node editor**, NOT in Canvas. Canvas only assigns *animation* triggers (see §8.2). This boundary is load-bearing.
- `packages/shared-interfaces` graph types: **additive only**, never breaking.

---

## 2. Locked decisions (DECISIONS block)

1. **Renderer:** one unified **Three.js r184+ WebGPU** scene via `three/webgpu`, WebGL2 fallback. No second visible renderer. (Re-verify current `three` version at build time.)
2. **Images are textures; code is scene composition + behavior.** Elements are textured planes, parallax-planes, meshes, splats, or text positioned/composed/animated in 3D space. (Migration Invariant 8, in force.)
3. **Timeline is continuous seconds (float). There is no global fps.** Snap grid is cosmetic (default 1/60s, switchable to 1/100, 1/120). i2v / baked frame sequences map `frameIndex = floor(t × sourceFps)`.
4. **Driver model** is the single animation-playback abstraction: `TimeDriver`, `ScrollDriver`, `PointerDriver`, `StateDriver`, `EventDriver`. Toolbar trigger buttons (click/hover/scroll/load/drag) assign a driver to a selected animation. Drivers play *animation* only — not app behavior (§1.3).
5. **Theatre.js core (Apache-licensed)** is the keyframe **sequence engine**; the studio UI is custom-built (Theatre's studio is AGPL/dev-only and is NOT shipped).
6. **Animation = a 300+ primitive catalog AND from-scratch authoring.** Primitives are tweakable, mixable, and stackable. AI (via prompt) and users (manually) may BOTH author bespoke animations from scratch. The catalog is an accelerant, not a cage. **This rescinds the migration-era drift trigger that forbade scene-level animation outside the primitives library.**
7. **Lighting** is scene-wide (IBL/env + key/fill/rim + soft shadows), tiered by device capability, with a **per-node `receivesLighting` toggle**. Image-planes default unlit (preserve diffusion appearance); meshes/splats and opted-in planes are lit.
8. **Text is real, code-driven MSDF text** (`three-msdf-text-webgpu`) — never rendered by a diffusion model and never baked into a generated image as pixels (FLUX prompts exclude text: "no text, no letters"). Text objects are separable, individually selectable, movable, restylable, and animatable. A full Text System (§7) provides a large font library, full manual style controls, an AI **texture-fill** generator (natural language → texture applied to the real letterforms, never drawing the letters), a preset library, and text-animation primitives. Making text *functional* is a node-editor concern (§1.3).
9. **Rive is a first-class supported layer — kept, not relegated, and NOT mutually exclusive with the native system.** Rive (`@rive-app/canvas`, WASM + state machines) is the designer-authored **2D vector + state-machine** lane; the native scene is the **3D / generative / procedural / dimensional** lane. Rive integrates in one of two modes per element role: **(a) in-scene as a `CanvasTexture`** when the Rive content belongs to an element that lives/transforms in 3D space (default for element-bound motion such as animated icons), and **(b) screen-space transparent overlay** when the content is genuinely flat and screen-locked (HUD, nav, cursor, loading overlay). Rive state-machine inputs map to `StateDriver`. `.riv` files (authored or from Rive's marketplace) are a supported artifact type. Data-binding/function wiring is done in the node editor (§1.3).
10. **Local re-captioning** uses an in-browser VLM (FastVLM-0.5B-ONNX or SmolVLM) via Transformers.js + WebGPU — zero API cost — for liveness. Authoritative cloud VLM caption-verify runs only at build-finalize. (Text nodes self-caption from their properties — see §7.6 — and do not require a VLM.)
11. **Caching:** every node and hub stores a content-hash-keyed `builtSnapshot`. Canvas/Preview load snapshots instantly; a node rebuilds only when its hash changes. Append-only; old snapshots persist in the artifact library.

---

## 3. Architectural invariants

- **INV-1 (Frozen graph):** Canvas never alters graph topology rules, node-system deps, or the bipartite DAG. It mutates node *content/position/animation*, which the graph already models.
- **INV-2 (Single visible renderer):** All visible 3D rendering is the one Three.js WebGPU scene. Permitted composited layers: a Rive screen-space overlay canvas (§8.5b) and a hidden parallel-DOM accessibility tree (§15.4). No second *visible 3D* renderer, no PixiJS in the visible path.
- **INV-3 (Images are textures):** Visible UI identity comes from generated images used as textures, generated meshes/splats, or code-driven text. Code positions, composes, animates — it does not hand-draw visible UI primitives.
- **INV-4 (Time, not frames):** Every animation is sampled against the master clock in seconds. No data structure stores a global fps.
- **INV-5 (One animation interface):** Every primitive — catalog or bespoke — implements the `Animatable` contract (§8.3) and declares a `ControlSchema`. The control UI and the timeline bind to that contract, never to a per-library bespoke panel.
- **INV-6 (Driver-decoupled playback):** An animation's keyframes/states are independent of what plays them back. Changing a driver never edits the keyframes. Drivers play animation, not app behavior.
- **INV-7 (Built/unbuilt parity):** Any structural change in Canvas (add/delete/group/move a node) is reflected in the graph and is visible in Galaxy; any node built in Canvas is (re-)captioned before "add to system."
- **INV-8 (Additive schema):** New graph fields the Canvas needs (`scenePosition`, `renderMode`, `animationBindings`, `materialSpec`, `lightingSpec`, `textSpec`, `riveSpec`, `groupId`, `builtSnapshotHash`, etc.) are additive with safe defaults. Never remove or repurpose existing fields.
- **INV-9 (Capability-tiered):** The scene must run on mobile and desktop. Heavy effects (GI, path tracing, dense fluid/particles) are gated behind capability detection with graceful degradation, never the default path.
- **INV-10 (Contamination-aware repair):** Broken code is deleted and regenerated from spec; never shown to a repair model.
- **INV-11 (Text is code, never diffusion):** Letterforms always come from a real font via MSDF. AI may generate only the *texture/material fill* poured into those letterforms, never the letter shapes themselves. No diffusion-rendered or image-baked text in any built UI.

---

## 4. The unified scene model (built state)

- The scene root is a single `THREE.Scene` rendered by `WebGPURenderer` (init awaited; WebGL2 fallback automatic).
- Each built node is one **scene object** with a `renderMode`:
  - `plane` — image texture on a quad (default for most image UI elements).
  - `parallax-plane` — image + depth map (FAL `depth-anything/v2`), depth-displaced for parallax.
  - `mesh` — generated/imported GLB (FAL Hunyuan3D / TRELLIS-2, or user upload).
  - `splat` — Gaussian splat (Spark) for photoreal captured visuals.
  - `text` — code-driven MSDF text object (§7).
  - `rive` — a `.riv` rendered in-scene as a `CanvasTexture` (§8.5a).
  - `code` — a code-driven artifact that may produce any of the above plus behavior.
- An additional non-`renderMode` compositing layer exists for `rive-overlay` (§8.5b): screen-space, not part of the 3D scene graph.
- Node position/scale/rotation are stored in `scenePosition` (additive graph field) and applied as the object's transform.
- Hub activation uses the existing graph-to-tree adapter (reparent-on-navigate), now over `Object3D` containers. (Adapter behavior is inherited, not redefined here.)
- Assembly is browser-side (esbuild-wasm); live preview via Blob URL iframe. (Inherited.)

---

## 5. Canvas toolbar (the editing suite)

The toolbar is a comprehensive suite, grouped. It must include BOTH the standard go-to tools AND the advanced set (§9).

- **Transform:** select, move, resize (corner handles), rotate, scale, align/distribute, snap, z-order/depth.
- **Selection:** single, multi-select (marquee + shift-click), **Group**, **Ungroup**, lock/unlock, freeze (AI-off-limits).
- **Add:** **Add Element** (creates a blank "bubble" node — §6), **Add Text** (§7), **Add from Library** (§13), **Change Artifact** (§12).
- **Image tools:** crop, reposition-in-face, opacity, borders/radius, color adjust, blend modes, filters (glow, drop-shadow, outline, blur, displacement).
- **3D object tools:** transform gizmos, shape/dimension editing, per-face image mapping (§12.2), material editor (§11).
- **Text tools:** font picker, size/weight/spacing, fills/shadows/outlines/strokes/glow, AI texture-fill generator, presets, text-animation (§7).
- **Animation:** **Animation Picker** (catalog, §8.3), **Edit Animation** (control panel), **Keyframe Editor** toggle (§8.4), trigger buttons (**Load / Click / Hover / Scroll / Drag** → assign Driver, animation-only), **Create From Scratch** (bespoke authoring).
- **Lighting:** add/select lights, type, color, intensity, shadow softness, env/IBL, per-node `receivesLighting` (§10).
- **Build:** **Build Node** (appears once an artifact exists), **Add to System** (appears once built — runs (re-)caption, §15), **Rebuild**, version/history.

Toolbar options are greyed out contextually (e.g., a blank bubble node exposes only **Add Object**).

---

## 6. Node lifecycle in Canvas

States (a node moves through these; edits send it back):

1. **Bubble** — a translucent liquid sphere (3D, `MeshPhysicalMaterial` transmission). Draggable. Only **Add Object** enabled. Not yet rendered as a UI element in Canvas/Preview.
2. **Populated** — has an artifact (image / mesh / video / splat / text / `.riv` / code). **Build Node** appears. Still not rendered in Canvas/Preview until built.
3. **Built** — artifact assembled into its scene object + a `builtSnapshot` cached. Rendered in Canvas/Preview. **Add to System** appears.
4. **In System** — caption written into the graph; builder-visible. Element is fully live.
5. **Dirty** — any manual edit sets `dirty = true`, returns the node to Populated/Built pending rebuild + re-caption. Re-adding to system is required after edits.

Rules:

- Adding a node in Canvas MUST create a graph node tethered to the current hub (INV-7).
- A node is NOT rendered in Canvas/Preview until **Built**.
- `builtSnapshot` is keyed by content hash; rebuild only on hash change (§11 cache).

---

## 7. Text System

> Text is essential, not decorative. A design tool without real text is useless. Text is reliable BECAUSE the letterforms are real font geometry, not diffusion output (INV-11).

### 7.1 Substrate
- Text is rendered as **MSDF text objects** via `three-msdf-text-webgpu` (WebGPU/TSL-compatible; Troika is not WebGPU-ready). Fonts converted to MSDF atlases via `msdf-bmfont`.
- A text element is its own node (`renderMode: text`) with a `textSpec`. It is **separable** from any artifact, **individually selectable**, and **movable** in 3D space like any other node.

### 7.2 Font library
- Large selectable font library via dropdown (target: Google Fonts ~1,800+ families + variable fonts).
- Core library ships with **pre-baked MSDF atlases**; additional fonts generate atlases **on demand** (cache the atlas after first use).
- Variable-font axes (weight, width, slant, optical size) exposed where the font supports them.

### 7.3 Manual style controls
- Fills: solid, gradient, texture, or AI-generated texture (§7.4).
- Shadows, outlines/borders, strokes, glow, blend modes, opacity, letter/line spacing, alignment, curve/path layout.
- All controls render from the text node's `ControlSchema` (same engine as §8.3).

### 7.4 AI texture-fill generator (the "describe the look" feature)
- User types the text, picks a font, then describes the desired look in natural language ("chunky neon building blocks," "molten gold," "hairy moss").
- The generator produces ~5 **texture fills** and applies them to the real letterforms; user can **generate more**, change font, or keep editing.
- **Critical:** the generator produces a *texture/material masked to the glyph shapes* — it NEVER draws the letters. Letterforms always come from the font (INV-11). This is what keeps it reliable and fully editable. Best for short/emphasis text; long body copy uses standard fills.
- Implementation: a prompt→texture generation call (e.g., FLUX or a dedicated text-effect endpoint) masked by the MSDF glyph coverage. Re-verify the best current endpoint at build time (§20).

### 7.5 Presets & animation
- A massive **preset library** of pre-styled + pre-animated text (hover-play tiles, same picker UX as §8.3).
- Text animations are first-class **primitives**: per-glyph / per-word / per-line decomposition (SplitText-style), stagger, scramble, wave, kinetic typography, and MSDF dissolve-to-dust/petals (Codrops "Gommage" technique). They run on the same timeline + Driver model as all other animation.

### 7.6 Captioning & function
- Text nodes **self-caption** from their properties (the actual string + font + style description) — no VLM needed (§10 decision).
- Making text **clickable / functional** (link, submit, scroll-to, data-bind) is done in the **node editor**, not Canvas (§1.3). Canvas styles and animates text; the node editor makes it act.

---

## 8. Animation system

### 8.1 Timeline model
- Single source of truth: a **master clock in seconds** (float). No global fps (INV-4).
- `TimeDriver` exposes a scrubbable playhead with play / pause / loop. Snap grid is cosmetic.
- Time-based libraries (GSAP timelines, Three `AnimationMixer` clips, TSL uniform sweeps, i2v sequences) are all queried by time and coexist on one timeline.
- i2v / baked frame clips: `frameIndex = clamp(floor(t × sourceFps), 0, n-1)`.

### 8.2 Driver model
Every animation = `(keyframes or states) + a driver`. Drivers:
- `TimeDriver` — master clock (the keyframe editor).
- `ScrollDriver` — scroll progress 0→1 (GSAP ScrollTrigger / native scroll-timeline / Lenis).
- `PointerDriver` — hover bool / pointer xy.
- `StateDriver` — named state inputs (idle/hover/pressed/loading/success/error…). Rive state-machine inputs are a `StateDriver` source.
- `EventDriver` — click/submit/custom triggers.

Toolbar trigger buttons assign the driver. Changing a driver never edits keyframes (INV-6). Drivers play **animation**, not app behavior (§1.3). In Preview, `TimeDriver` plays deterministically (like a video); the other drivers respond to the user's real input (live).

### 8.3 The Primitive Catalog (300+ to start) + bespoke authoring
A **primitive** = one finished, parameterized, reusable animation/effect building block. Categories span: transform tweens, fades, scroll parallax, displacement transitions, glass/dispersion refraction, caustics, volumetric light/godrays, smoke/ink, 3D smoke volumes, fluid (2D/3D), water/ocean (FFT, foam, caustics), fire/flame, dust/petal dissolve, GPGPU particles, wind/cloth/hair sway, gravity/physics drops & collisions, ambient light-refraction shimmer, splat reveals, kinetic typography, and more.

Every primitive — catalog or bespoke — implements:

```ts
interface Animatable {
  duration(): number;            // seconds; Infinity for purely stateful
  seek(t: number): void;         // master clock / driver calls this
  controls(): ControlSchema;     // declares this primitive's own knobs/faders/dropdowns/curves
  serialize(): PrimitiveState;   // for save + node caption + AI round-trip
}
```

Catalog requirements:
- **≥300 primitives at launch**, each: a preview tile that **plays on hover**, a name, a category, and a `ControlSchema`.
- **Tweakable:** every primitive exposes its params via the control panel rendered from its `ControlSchema` (build the renderer ONCE — INV-5).
- **Mixable / stackable:** multiple primitives can be applied to one element and composed; stacking order is editable. Composition is a first-class feature, not a violation.
- **From scratch:** users (manually) and AI (via prompt) can author a new primitive/bespoke animation. A bespoke animation is just an `Animatable` with a custom `ControlSchema`. Authored primitives can be saved to the catalog → **"Share your design"** community surface (schema must allow it now).
- **Picker ↔ AI parity:** anything a user can pick/author, the AI can pick/author, and vice versa. Both draw from the same `Animatable` registry.

### 8.4 Keyframe editor UI
- Slides up/out from the toolbar. Controls: scrubber/fader, play, pause, loop.
- Multi-track: one track per animated property/primitive on the selected element(s). Keyframes with editable easing curves (Theatre.js core model).
- `TimeDriver` animations: edit keyframes on the playhead.
- Scroll/Pointer/State/Event animations: the editor edits the keyframes *within each state/segment*; the driver determines playback.
- i2v frame clips: filmstrip + onion-skinning + per-frame image-to-image edit.

### 8.5 Rive integration (two modes)
Rive is the designer-authored 2D vector + state-machine lane (§2 decision 9). It does NOT replace the native system; it covers a different lane and pairs with it. A `.riv` is a supported artifact type; its state machine is introspected at runtime (artboard / state-machine / input names).

- **(a) In-scene texture mode (default for element-bound motion):** Rive renders to an offscreen canvas; the result is a `CanvasTexture` on the node's plane/mesh (`renderMode: rive`). It tracks the element's 3D transform, lighting opt-in, and parallax exactly because it IS the element's texture. Cost: a per-frame texture upload — acceptable for icon/widget-sized content. Use for: animated icons, reactive buttons, badges, small interactive widgets that live in 3D space.
- **(b) Screen-space overlay mode:** Rive runs on a transparent canvas composited over the WebGPU canvas (permitted layer, INV-2), driven by data binding. Use for: flat, screen-locked HUD / nav / cursor followers / loading overlays that are NOT part of the 3D scene.

Rive state-machine inputs bind to `StateDriver`. Native `StateDriver` primitive-param changes remain the default for 3D/generative/procedural interactive motion (things Rive cannot do). They only overlap on small 2D micro-interactions, where either is acceptable. Data-binding/function wiring is done in the node editor (§1.3).

---

## 9. Advanced dependency suite (current, June 2026)

> Foundation/source material for the catalog's primitives. Users/AI consume finished primitives; bespoke authoring may reach into these. **Re-verify every version/endpoint at build time (§20).**

**Render / shader core**
- `three@^0.184` via `three/webgpu`; **TSL** (compiles to WGSL + GLSL).
- `@react-three/fiber`, `drei`, `@react-three/postprocessing` (wraps pmndrs/postprocessing; some effects need TSL/WebGPU variants), `leva` (param GUI reference).

**Animation / motion / sequencing**
- `gsap@^3.13` (free; ScrollTrigger, ScrollSmoother, SplitText), `@theatre/core` (Apache; sequence engine), `motion` (formerly Framer Motion), `lenis` (smooth scroll), `lottie`/`dotLottie` (passive), `@rive-app/canvas` (interactive vector state machines — §8.5), Spline (embeddable 3D).

**Text**
- `three-msdf-text-webgpu` (Léo Mouraire; WebGPU/TSL MSDF), `msdf-bmfont` (atlas generation), variable-font support, SplitText-style decomposition for per-glyph animation.

**Fluid / smoke / volumetrics**
- `@three-blocks/core` (TSL smoke + 3D smoke volume, fluid blocks), `threejs-fluid-simulation` (bandinopla; WebGL + WebGPU/TSL), WebGPU compute fluid (kishimisu pattern), native `webgpu_volume_caustics`, volumetric lighting (atmospheric-scattering LUT), volumetric clouds/sky systems, FFT ocean/water (caustics, foam), TSL volumetric fire/flame.

**Particles / dust / GPGPU**
- GPGPU particle systems via TSL/compute shaders, dust+petal dissolve (Codrops "Gommage" pattern), MRT selective bloom.

**Physics / gravity / wind / cloth**
- **Phy** (lo-th) — one bridge over **Rapier / Jolt / Havok / PhysX / Ammo / Oimo**, WebGPU + worker. `react-three-rapier` for R3F-native rigid bodies. Jolt (AAA-grade, MIT) for complex sims. Cloth/wind/hair via compute or constraint sims.

**Photoreal / capture**
- **Spark** (`@sparkjsdev/spark`) — 3D Gaussian Splatting fused with meshes; broad device support; .PLY/.SPZ/.SPLAT/.SOG.
- `three-gpu-pathtracer` — offline-quality GI, caustics, refraction, volumetric dust/fog (Tier-3 preview only).
- TSL glass/dispersion/transmission materials (`MeshPhysicalNodeMaterial`).

**3D / image / depth generation (FAL, current pins)**
- `fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d` (~$0.05, 2–3 min, hero meshes).
- `fal-ai/trellis-2` (~$0.02, 20s–4 min, fast).
- `fal-ai/image-preprocessors/depth-anything/v2` (depth maps). **Check if Depth Anything 3 is on FAL now** (§20).
- Quality tiers to A/B: Rodin (Hyper3D), Meshy 6 (AI Texturing for material-on-blank-mesh), TRELLIS 2, SF3D (sub-second previews).

**In-browser VLM (local re-caption)**
- `@huggingface/transformers` (Transformers.js) + WebGPU; `onnx-community/FastVLM-0.5B-ONNX` (~300MB q4) or SmolVLM (250M/500M/2B).

---

## 10. Lighting & shadow system

- Scene-wide lighting controls: ambient, key/fill/rim directional, point/spot, color, intensity, IBL/env map, soft shadows (PCFSoft/VSM).
- **Per-node `receivesLighting` toggle.** Image-planes default **unlit** so the diffusion-baked look is preserved exactly. Meshes, splats, and opted-in planes are lit. Text fills can opt in (e.g., metallic text catching scene light).
- Tiers (capability-gated, INV-9):
  - **T0:** IBL + baked lightmaps (all devices).
  - **T1:** dynamic lights + soft shadows (the workhorse).
  - **T2:** SSAO/GTAO, SSR, optional SDF/surfel GI (WebGPU desktops / high-end mobile).
  - **T3:** path-traced "render this beautifully" non-realtime preview (desktop only).
- Lighting is per-hub and per-element configurable. Output must look high-quality and appropriate for any app type.

---

## 11. Material system

- Native Three.js PBR (`MeshPhysicalNodeMaterial`): base color, metalness, roughness, transmission/IOR/dispersion, clearcoat, emissive, normal/displacement.
- Material library: photorealistic / high-res / megascan-style sets loaded as glTF + KTX2 (compressed). Baked at build, not streamed live.
- Per-face image mapping integrates with the material (§12.2).
- Mesh color/material editable in-canvas.
- **Caching:** each node/hub `builtSnapshot` = rendered output + material/animation/lighting/text spec + caption + version hash. Load instantly; rebuild only on hash change. Append-only.

---

## 12. Change Artifact wizard

User picks **Upload** or **Prompt**.

### 12.1 Upload
- Accepts image, 3D object (GLB/USDZ/etc.), video, `.riv`, and accompanying maps.
- Optional **Add image/video to shape**: shape preview UI (cube, sphere, cone, cylinder, custom). Image slots adapt to geometry:
  - Cube → 6 numbered slots + 3D cube with numbered faces.
  - Cone → 2 slots (curved face = 1, base = 1).
  - Sphere → 1 slot (one curved face).
- Drag to assign which image goes on which face. **Modify Shape:** click/drag height/width/length.
- Post-map tools: crop/reposition/scale within a face (click-drag), opacity, borders, color, plus per-image style/animation via the same picker (§8.3).

### 12.2 Prompt
- Options: **Image / 3D object / Video / Code**.
- Prompt box + up to **4 image slots** (front/back/left/right; not all required) → multi-view input for image-to-3D (Hunyuan3D / TRELLIS).
- Viewport displays the result; if 3D, the viewport is interactive; if code, the artifact is built and displayed.
- Result actions: **Use This** (replaces the node's current artifact; outgoing artifact retained in the artifact library) or **Change This** → **Modify This** (editing model by type) or **From Scratch** (back to type selection).

---

## 13. Prebuilt element library

- A catalog of parameterized element-clusters: carousels, wheels, sliders, heroes, banners, and many more UI enhancers.
- Each entry: a hover-playable preview tile + its own caption + a `builtSnapshot`.
- Drag-to-place instantiates the cluster, tethered to the current hub, with all member nodes created in the graph (INV-7).
- Clusters carry their own animations (primitives) and are editable like any node group.

---

## 14. Selection, grouping, multi-edit

- Multi-select via marquee and shift-click.
- **Group** = a parent transform node holding child node IDs (`groupId` additive field); transforms cascade. Modeled as a `contains`-edge subtree with a shared transform — fits the existing DAG (INV-1).
- **Ungroup** dissolves the parent, preserving children + world transforms.
- Batch move/scale/rotate/animate across a selection.

---

## 15. AI control, manual modification, captioning

### 15.1 Dual control
- **AI (via prompt):** full authority to design, stylize, animate, and compose complete 3D scenes that are also functioning apps — selecting/authoring primitives, materials, lighting, text, and layout. Enabled by continuously updated node captions.
- **Users (manually):** every AI action is manually modifiable through the toolbar, picker, keyframe editor, text tools, and wizards.

### 15.2 Captions as the bridge
- Every node carries a self-contained caption (living spec). It must stay current for AI control to work.
- On **Build Node**: render artifact → in-browser VLM re-captions (FastVLM/SmolVLM) → update caption + clear `dirty`. Text nodes self-caption from properties (§7.6), no VLM.
- On **Add to System**: caption written into the graph (builder-visible).
- Any manual edit sets `dirty`; re-add to system after edits (INV-7).

### 15.3 Cost discipline
- Local in-browser VLM handles liveness re-captioning (free).
- Authoritative cloud VLM caption-verify (Claude vision) runs only at build-finalize, not per keystroke.

### 15.4 Accessibility
- A hidden parallel-DOM tree mirrors the scene (semantic `button`/`nav`/`input`/headings/ARIA) for screen readers and keyboard nav; the WebGL canvas is `aria-hidden`. (Permitted layer, INV-2.)

---

## 16. Preview mode

- Same scene as Canvas, editing handles hidden.
- `TimeDriver` plays deterministically (load/auto animations on the playhead).
- Scroll/Pointer/State/Event drivers respond to the user's real input (live).
- Rive overlays (§8.5b) and in-scene Rive (§8.5a) run live.
- User has camera controls to navigate the current hub; no graph-editing affordances.

---

## 17. Performance & capability tiers

- Target: smooth on mobile and desktop (INV-9).
- Capability detection selects lighting tier (§10), particle/fluid density, Rive texture update cadence, and whether GI/path-tracing previews are offered.
- Use instancing, LOD, KTX2 textures, atlas/snapshot caching, compute shaders where WebGPU is present, WebGL2 fallback otherwise.
- Snapshot cache prevents per-frame rebuilds; only changed nodes rebuild.

---

## 18. Numbered atomic success criteria (verifiable)

> Each must be demonstrated with evidence (command output, screenshot, or runtime assertion). No assertion-only "done."

1. Canvas renders the built state of the active hub as one Three.js WebGPU scene; WebGL2 fallback verified on a non-WebGPU context.
2. Switching Galaxy ↔ Canvas ↔ Preview shows the same nodes in unbuilt/built/played states with no graph mutation across the switch.
3. Adding a node in Canvas creates a graph node tethered to the current hub, visible in Galaxy.
4. A new node renders as a translucent liquid "bubble" with only **Add Object** enabled.
5. Adding an artifact transitions Bubble → Populated and reveals **Build Node**.
6. **Build Node** assembles the artifact into its scene object, caches a `builtSnapshot`, and renders it; **Add to System** appears.
7. **Add to System** writes a fresh caption to the graph and clears `dirty` (VLM for visual nodes; self-caption for text nodes).
8. A manual edit sets `dirty` and requires re-add-to-system before the caption is considered current.
9. Drag/resize-corner/rotate mutate the node's `scenePosition`; values persist and round-trip through save/reload.
10. The keyframe editor opens with scrubber/play/pause/loop; the timeline is in seconds with a switchable cosmetic snap grid and no stored global fps.
11. A GSAP tween, an `AnimationMixer` clip, a TSL-uniform sweep, and an i2v frame clip all play correctly on the same timeline, sampled by time.
12. The animation picker lists ≥300 primitives, each with a hover-playing preview tile and a control panel rendered from its `ControlSchema`.
13. Two or more primitives can be stacked on one element, composed, and reordered.
14. A bespoke animation authored manually AND one authored via AI prompt each register as an `Animatable` with a working `ControlSchema` and play — proving the rescinded drift trigger.
15. Trigger buttons assign `Time/Scroll/Pointer/State/Event` drivers; changing a driver does not alter keyframes; drivers affect animation only, not app behavior.
16. In Preview, a `TimeDriver` animation plays deterministically while a hover/scroll animation responds to real input.
17. Lighting controls affect the scene; an image-plane with `receivesLighting=false` is unaffected while a mesh with it on is lit; soft shadows render.
18. Capability detection degrades gracefully: GI/path-tracing offered only where supported; mobile runs at target framerate.
19. The Change Artifact **Upload** path maps uploaded images to the correct number of faces per shape (cube=6, cone=2, sphere=1) with drag-to-assign and editable dimensions.
20. The Change Artifact **Prompt** path generates image / 3D / video / code; 3D results are interactive in the viewport; **Use This** swaps the artifact and retains the prior in the artifact library.
21. Prebuilt-library drag-to-place instantiates a cluster with all member nodes created in the graph and tethered to the hub.
22. Multi-select + Group creates a cascading transform parent; Ungroup preserves children + world transforms.
23. `builtSnapshot` cache loads Canvas/Preview without rebuilding; editing one node rebuilds only that node (hash-keyed).
24. A hidden parallel-DOM accessibility tree exists and exposes semantic roles for the built elements.
25. No graph-topology / node-system dependency was added, removed, or altered (diff proves INV-1).
26. A text node renders as real MSDF text, is individually selectable and movable, and can be re-fonted/resized instantly with no re-render of any image artifact.
27. The font picker lists the full library; selecting a non-core font generates and caches its MSDF atlas on demand.
28. The AI texture-fill generator returns ~5 fills applied to the real letterforms (glyphs unchanged), supports "generate more," and the result remains editable text — proving INV-11 (no diffusion-drawn letters anywhere).
29. A text-animation primitive animates per-glyph/word/line on the shared timeline and Driver model.
30. A `.riv` renders **in-scene as a CanvasTexture** on a node and tracks that node's 3D transform/parallax; its state-machine inputs drive via `StateDriver`.
31. A `.riv` runs as a **screen-space overlay** layer (HUD) composited over the WebGPU canvas without entering the 3D scene graph — proving both Rive modes coexist with the native system (no forced choice).

---

## 19. Forbidden patterns (drift triggers — halt)

- Introducing a second visible 3D renderer or PixiJS into the visible path.
- Hand-drawing visible UI primitives in code instead of using image textures / generated meshes / MSDF text (violates INV-3).
- **Rendering text via a diffusion model, or baking letterforms into a generated image** (violates INV-11). AI may generate only the texture fill, never the letters.
- Storing or relying on a global fps anywhere in the timeline data model.
- Building a per-library bespoke control panel instead of rendering from `ControlSchema` (violates INV-5).
- Coupling an animation's keyframes to its driver, or using a driver to wire app behavior instead of animation (violates INV-6, §1.3).
- Wiring element/text **function/behavior** in Canvas instead of the node editor (violates §1.3).
- Altering the knowledge-graph topology, node system, or their dependencies (violates INV-1).
- Removing or repurposing existing `shared-interfaces` fields (violates INV-8).
- Rendering a node in Canvas/Preview before it is Built.
- Skipping re-caption after a manual edit, or calling a cloud VLM on every keystroke.
- Making GI / path tracing / dense fluid the default (non-tiered) path (violates INV-9).
- Showing broken code to a repair model (violates INV-10).
- Re-introducing the rescinded rule that the AI may not author animation from scratch.
- Forcing a mutually-exclusive choice between Rive and the native animation system (they are different lanes; both are kept — §2 decision 9).

---

## 20. Re-verify at build time (training data is stale)

- Current `three` version and `three/webgpu` API surface (spec assumes r184+; confirm latest).
- Whether **Depth Anything 3** is available on FAL (would upgrade depth maps over v2).
- Current FAL endpoint names/prices for Hunyuan3D, TRELLIS-2, SF3D; evaluate Rodin / Meshy 6 as quality tiers.
- Theatre.js core current version + license status (Apache core vs AGPL studio) before shipping.
- `three-msdf-text-webgpu` + `msdf-bmfont` current versions + WebGPU compatibility.
- Best current **prompt→texture** endpoint for the AI text-fill generator (glyph-masked); confirm FLUX vs a dedicated text-effect model.
- `@rive-app/canvas` current version + WebGPU/CanvasTexture interop notes; confirm offscreen-canvas texture path performance.
- FastVLM / SmolVLM current best in-browser checkpoint + size on Transformers.js + WebGPU.
- `@three-blocks/core`, `threejs-fluid-simulation`, Spark, Phy, Jolt/Rapier current versions and WebGPU status.
- pmndrs/postprocessing WebGPU/TSL effect coverage (which effects need TSL rewrites).

---

*End of PRISM-CANVAS-EDITOR-SPEC.md*
