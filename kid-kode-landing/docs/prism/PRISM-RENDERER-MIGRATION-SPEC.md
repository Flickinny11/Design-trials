# Prism Renderer Migration Specification

**Status:** Canonical source of truth for the PixiJS-to-Three.js renderer migration
**Date:** 2026-05-01
**Codename:** Prism v3 — Cinematic Renderer
**Migration target:** Replace PixiJS 2D rendering with Three.js WebGPU 3D scene composition while preserving all existing graph, runtime, and editor invariants.

> Claude Code MUST read this document in full before writing any implementation code for this migration. This document supersedes the rendering sections of `DIFFUSION-ENGINE-SPEC.md` and `PRISM_ENGINE_BROWSER_BASED_SPEC.md` ONLY where explicitly noted. Every other invariant in those documents remains in force.

---

## 1. Why This Migration Exists

PixiJS is a brilliant 2D compositor but it cannot produce the cinematic, Slider Revolution-class output Prism was built to deliver. The premium-feeling web UIs Prism aspires to — image planes orbiting in 3D space, depth-driven parallax, displacement-map transitions, perspective-correct shadow and bloom — are universally Three.js + GSAP + WebGL/WebGPU territory. Switching renderers is the only path to the visual ceiling Prism needs.

This is **not** a switch from images to code-based UI. It is a switch from a 2D image compositor to a 3D scene compositor that uses images as textures and code as scene composition + behavior.

---

## 2. Updated Architectural Invariants

The following invariants from prior specs are **MODIFIED**:

### Invariant 8 (REPLACED)

**Old:** *"Images are elements; code is behavior. FLUX.2 generates UI images, segmentation decomposes them into element nodes, code is injected per-node for behavior only. Code does NOT create UI elements."*

**New:** *"Images are textures; code is scene composition AND behavior. FLUX.2 generates UI images, segmentation decomposes them into element nodes, code composes those images into a Three.js scene as planes, parallax-planes, or full meshes, and attaches GSAP timelines for animation and event handlers for interaction. The image remains the source of visual identity; code positions, composes, and animates it in 3D space."*

### Invariant — NEW

**Invariant 11 (NEW): Renderer is Three.js WebGPU with WebGL2 fallback.** All node code targets the Three.js scene graph. The runtime imports from `three/webgpu` for zero-config WebGPU initialization with automatic WebGL2 fallback on unsupported browsers. PixiJS is removed from runtime bundles. All TSL shaders work in both WebGPU and WebGL2 contexts.

### Invariant — NEW

**Invariant 12 (NEW): Cinematic primitives are a curated, fixed library.** Per-node animation and transition code is composed from a vetted library of primitives (orbit, depth-rotate, dissolve-morph, displacement-transition, parallax-scroll, magnetic-cursor, particle-emerge, fly-through, kinetic-text). The codegen model SELECTS from primitives by name in captions; it does NOT author scene-level animation from scratch. This is what makes generated output look intentional rather than randomly assembled.

### Invariant — NEW

**Invariant 13 (NEW): Text is rendered via MSDF in code, on top of image textures.** Text is never rendered into FLUX.2 images for production output (negative prompt: "no text, no letters, no labels"). Text content is captured in the node's `textContent[]` spec and rendered at runtime via `three-msdf-text-webgpu` with TSL-compatible MSDFTextNodeMaterial. This guarantees crispness at any zoom, perfect i18n support, and full control over typography animation.

### Invariants 1-7, 9, 10 — UNCHANGED

The graph is the app. Nodes are self-contained. Contamination-aware repair. Contract-first parallel generation. Builds must never fail. Bipartite DAG. Wavefront execution. Provider-agnostic inference. **All of these survive the migration unchanged.**

---

## 3. Tech Stack — Verified May 2026

### Runtime Generated Apps

| Component | Package | Version | Notes |
|-----------|---------|---------|-------|
| 3D Renderer | `three` | r184+ | Import from `three/webgpu` for WebGPU + WebGL2 fallback |
| Shader Language | TSL via `three/tsl` | bundled with three | Compiles to both WGSL and GLSL — no parallel shader maintenance |
| Animation Engine | `gsap` | 3.13+ | 100% free including SplitText, MorphSVG, ScrollTrigger, MotionPath since May 2025 |
| MSDF Text | `three-msdf-text-webgpu` | latest | WebGPU + TSL compatible. NOT troika-three-text — that does not yet work on WebGPU |
| MSDF Font Tool | `msdf-bmfont-xml` | latest | Build-time tool to convert .ttf → MSDF .png + .json atlas |
| Bundler | `esbuild-wasm` | latest | Browser-side assembly per existing browser-spec, unchanged |

### Editor (Builder.tsx — React)

| Component | Package | Version | Notes |
|-----------|---------|---------|-------|
| 3D Renderer wrapper | `@react-three/fiber` | v9 | Use async `gl` prop factory for WebGPU init |
| Drei helpers | `@react-three/drei` | v9-compatible | OrbitControls, Stats, Environment, Float, Center, Bounds — production stable |
| Vanilla Three | `three` | r184+ | Same version as runtime |
| GSAP | `gsap` | 3.13+ | Same version as runtime |
| MSDF Text | `three-msdf-text-webgpu` | latest | Same library as runtime for parity |
| State (existing) | `zustand` | unchanged | `usePrismStore` and `useGraphEditorStore` survive |
| Code Editor (existing) | `@monaco-editor/react` | unchanged | Code tab still uses Monaco |

> R3F v10 alpha + Drei v11 alpha exist but are not stable enough for this migration. Stay on v9 with manual WebGPU integration via the async `gl` factory.

### Pipeline (Modal-side)

| Stage | Service / Endpoint | Notes |
|-------|-------------------|-------|
| Image generation | FLUX.2 [klein] / [pro] | unchanged from existing spec |
| Segmentation | SAM 3 / SAM 3.1 | unchanged |
| Depth estimation (NEW) | `fal-ai/image-preprocessors/depth-anything/v2` | Per-node optional — applied to hero/featured nodes |
| 3D mesh generation (NEW, optional) | `fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d` ($0.05/gen, 2-3 min) | For nodes flagged `renderMode: 'mesh'` only |
| 3D mesh fast alternative | `fal-ai/trellis-2` ($0.02/gen, 20s-4min) | Fallback when speed > quality |
| Code generation | unchanged multi-provider cascade | Prompts updated per Section 9 |

### Removed

- `pixi.js` (and all `@pixi/*` add-ons) — entirely removed from runtime bundles. Editor may keep PixiJS imports temporarily during migration but they MUST be gone by end of Phase 5.

---

## 4. GraphNode Schema Changes

Backward-compatible additions to the existing `GraphNode` interface in `packages/shared-interfaces/src/prism-graph.ts`:

```typescript
export interface GraphNode {
  // ... ALL existing fields unchanged ...

  // NEW: Render mode discriminator
  renderMode: 'sprite' | 'plane' | 'parallax-plane' | 'mesh';

  // NEW: Optional depth map URL (R2-stored) — required only when renderMode === 'parallax-plane'
  depthMapUrl: string | null;

  // NEW: Optional 3D mesh GLB URL (R2-stored) — required only when renderMode === 'mesh'
  meshUrl: string | null;

  // NEW: Cinematic primitive references — primitives applied to this node
  cinematicPrimitives: CinematicPrimitiveRef[];

  // NEW: 3D scene placement (separate from 2D `position`)
  scenePosition: {
    x: number; y: number; z: number;        // world space
    rotationX: number; rotationY: number; rotationZ: number;  // radians
    scaleX: number; scaleY: number; scaleZ: number;
  };
}

export interface CinematicPrimitiveRef {
  name: 'orbit' | 'depth-rotate' | 'dissolve-morph' | 'displacement-transition'
       | 'parallax-scroll' | 'magnetic-cursor' | 'particle-emerge'
       | 'fly-through' | 'kinetic-text';
  params: Record<string, number | string | boolean>;
  trigger: 'load' | 'hover' | 'click' | 'scroll' | 'inview' | 'time';
}
```

**Default values for legacy graphs without these fields:**
- `renderMode = 'sprite'` (most conservative — flat textured plane facing camera)
- `depthMapUrl = null`
- `meshUrl = null`
- `cinematicPrimitives = []`
- `scenePosition = { x: 0, y: 0, z: 0, rot[XYZ]: 0, scale[XYZ]: 1 }`

The schema migration is purely additive. Existing graphs continue to work — they render as `sprite` mode, which produces a flat textured plane equivalent to a sprite in the previous PixiJS pipeline (visually similar to current output but rendered in Three.js).

---

## 5. Render Mode Definitions

### `sprite`
Flat textured plane that always faces the camera (billboard). Cheapest. Default for non-hero nodes. Used for: icons, badges, small static elements, hub backgrounds.

### `plane`
Flat textured plane with explicit 3D position and rotation. Stationary in scene space. Used for: cards, panels, content blocks, anything that should sit "on a wall" in the scene.

### `parallax-plane`
Plane with depth-map displacement. Foreground details push toward camera, background recedes. Creates 2.5D parallax effect when camera or scene moves. Requires `depthMapUrl` from Depth Anything v2. Used for: hero images, featured product shots, anything where depth perception matters.

### `mesh`
Full 3D GLB mesh from Hunyuan3D or Trellis-2. Has volume — can rotate to show all sides. Most expensive. Used for: focal hero objects, product showcases, navigation anchor objects. Reserved for plan-flagged "hero-eligible" nodes only — typically 1-3 per hub.

**Cost model per build:** Most nodes are `sprite` or `plane` (no extra cost). ~5-10% are `parallax-plane` (+$0.01 per node for depth). 1-3 per hub are `mesh` (+$0.05 per node for Hunyuan3D Rapid). Total per-build cost increment over current pipeline: ~$0.10-0.30 depending on hero density.

---

## 6. Pipeline Modifications

The 20-stage pipeline order is preserved exactly. Stages 6, 9, and 10 gain optional sub-steps; stages 14 and 18 are renamed/replaced.

```
1.  Intent parsing                        UNCHANGED
2.  Competitive analysis                  UNCHANGED
3.  Inferred needs mapping                UNCHANGED
4.  Plan generation                       UNCHANGED + assigns renderMode per node
5.  Plan presentation → user approval     UNCHANGED
6.  FLUX.2 image generation               UNCHANGED + negative prompt now includes "no text, no letters"
7.  SAM 3 segmentation                    UNCHANGED
8.  Post-segmentation verification        UNCHANGED
9.  Knowledge graph construction          UNCHANGED + populates renderMode/cinematicPrimitives from plan

    9.5 NEW: Depth map generation         For nodes with renderMode='parallax-plane'
                                          Calls fal-ai/image-preprocessors/depth-anything/v2 in parallel
                                          Stores depthMapUrl

    9.6 NEW: 3D mesh generation           For nodes with renderMode='mesh'
                                          Calls fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d in parallel
                                          Stores meshUrl
                                          Has hard timeout — falls back to renderMode='parallax-plane' on failure

10. Texture atlas packing                 UNCHANGED — atlasing still helps texture upload performance
11. Parallel code generation              UNCHANGED multi-provider cascade — PROMPTS UPDATED (Section 9)
12. Verification                          UNCHANGED contamination-aware repair — RULES UPDATED (Section 10)
13. Contamination-aware repair            UNCHANGED
14. Three.js scene assembly               REPLACES "PixiJS assembly"
15. Backend contract generation           UNCHANGED
16. Parallel backend code generation      UNCHANGED
17. Convergence gate                      UNCHANGED
18. Bundle upload to R2                   UNCHANGED — bundle now contains three/webgpu, GSAP, MSDF fonts, primitive lib
19. Preview server                        UNCHANGED — blob URL iframe per existing spec
20. Overnight optimization (optional)     UNCHANGED — GEPA loop still applies per node
```

---

## 7. The Cinematic Primitives Library

See companion document: `CINEMATIC-PRIMITIVES-LIBRARY.md` for the full specification.

Briefly: the library is a fixed set of vetted scene-level animation patterns (orbit-around-point, depth-rotate-with-falloff, dissolve-morph-between-states, displacement-transition-on-event, parallax-scroll, magnetic-cursor-attraction, particle-emerge-on-load, fly-through-portal, kinetic-text-reveal). Each primitive is a function that takes `(targetObject, params)` and returns a configured GSAP timeline plus any required shader setup. The codegen model references primitives by name; it does NOT author bespoke scene animation from prompt context.

This is the lever that protects against the "Three.js looks like a school project at the median" problem identified in the architectural review. **No node ships without at least one cinematic primitive applied unless explicitly flagged as `cinematicPrimitives: []` in the plan.**

---

## 8. Node Code Contract — `createNode`

Every node module exports a single function:

```typescript
import * as THREE from 'three/webgpu';
import gsap from 'gsap';

export interface NodeContext {
  textureLoader: THREE.TextureLoader;
  glbLoader: GLTFLoader;
  fontAtlas: MSDFFontAtlas;
  primitives: CinematicPrimitivesAPI;
  emit: (event: string, payload: unknown) => void;  // navigation, state, etc.
}

export interface NodeConfig {
  imageUrl: string;
  depthMapUrl?: string;
  meshUrl?: string;
  scenePosition: SceneTransform;
  visualSpec: NodeVisualSpec;
  behaviorSpec: NodeBehaviorSpec;
  cinematicPrimitives: CinematicPrimitiveRef[];
  textContent: TextContentSpec[];
}

// THE CONTRACT
export default function createNode(config: NodeConfig, ctx: NodeContext): THREE.Object3D;
```

The function returns a `THREE.Object3D` (typically `THREE.Group` wrapping the visual mesh + text + interaction zone). The hub manager mounts the returned object to the active hub's `THREE.Group`. Event handlers attach via Three.js raycasting (`object.userData.onPointerOver`, etc.) which the manager wires up at mount time.

**Critical contract rules:**
1. `createNode` MUST be synchronous. All async loading happens inside primitives via cached loaders.
2. The returned object MUST have a `userData.cleanup()` method that disposes geometries, materials, textures, and kills GSAP timelines. Called on hub deactivation.
3. The function MUST NOT directly add to the scene. It RETURNS an object; the manager mounts.
4. Event handlers go in `userData.handlers`, not added directly to the renderer DOM.

---

## 9. Updated Code Generation Prompts

### Shared System Prompt (cached via RadixAttention)

```
You are a code generator for Kriptik Prism. Generate a self-contained Three.js v184+
node module for a UI element that will be mounted into a 3D scene.

CONSTRAINTS:
- Import only from: 'three/webgpu', 'three/tsl', 'gsap', '@/primitives' (alias for the
  cinematic primitives library), '@/text' (alias for MSDF text utilities).
- Export default a single function: createNode(config: NodeConfig, ctx: NodeContext): THREE.Object3D
- The function MUST be synchronous. All async loading uses ctx.textureLoader / ctx.glbLoader
  which return cached resources.
- Apply EVERY primitive listed in config.cinematicPrimitives by calling
  ctx.primitives[primitive.name](targetObject, primitive.params). DO NOT inline primitive logic.
- Render text content from config.textContent via ctx.fontAtlas — never render text into
  Three.js TextGeometry or HTML overlays.
- Attach event handlers to returned object's userData.handlers.* — never call
  renderer.domElement.addEventListener.
- The returned object MUST have userData.cleanup() that disposes resources and kills
  GSAP timelines.
- DO NOT use HTML, CSS, the DOM, document.*, or window.* — except window.devicePixelRatio.
- DO NOT author bespoke shader code — use TSL through ctx.primitives or three/tsl built-ins.

OUTPUT: Only the JavaScript code. No explanation. No markdown fences.
```

This prompt is **identical across all containers** → RadixAttention prefix cache hit → throughput preserved.

### Per-Node User Prompt (not cached)

Updated structure to expose the new fields:

```
ELEMENT SPECIFICATION:
{node.caption}

RENDER MODE: {node.renderMode}
ASSETS:
- imageUrl: {node.imageUrl}
- depthMapUrl: {node.depthMapUrl ?? "(none)"}
- meshUrl: {node.meshUrl ?? "(none)"}

VISUAL:
- Colors: {node.visualSpec.colors}
- Typography: {node.visualSpec.typography}
- Effects: {node.visualSpec.effects}

TEXT CONTENT:
{node.textContent.map(t => `- "${t.text}" (${t.role}, ${t.typography.fontSize}px ${t.typography.fontWeight})`).join('\n')}

BEHAVIOR:
- Interactions: {JSON.stringify(node.behaviorSpec.interactions)}
- Data bindings: {JSON.stringify(node.behaviorSpec.dataBindings)}

SCENE PLACEMENT:
- Position: ({sp.x}, {sp.y}, {sp.z})
- Rotation: ({sp.rotationX}, {sp.rotationY}, {sp.rotationZ})
- Scale: ({sp.scaleX}, {sp.scaleY}, {sp.scaleZ})

CINEMATIC PRIMITIVES TO APPLY:
{node.cinematicPrimitives.map(p =>
  `- ${p.name} (trigger: ${p.trigger}, params: ${JSON.stringify(p.params)})`
).join('\n')}

NEIGHBORS:
- Parent: {parentNode.id} ({parentNode.type})
- Siblings: {siblingNodes.map(n => `${n.id} (${n.type})`).join(', ')}
- Children: {childNodes.map(n => `${n.id} (${n.type})`).join(', ')}

ATLAS REGION:
- Atlas: {node.atlasRegion.atlasIndex}
- Source rect: {node.atlasRegion.x}, {node.atlasRegion.y}, {node.atlasRegion.width}, {node.atlasRegion.height}
```

### Render-Mode-Specific Sub-Prompts

Append based on `renderMode`:

**`sprite`:**
```
Create a textured plane that billboards toward the camera. Use THREE.PlaneGeometry sized
to the atlas region's aspect ratio. Apply texture with proper UV offsets for atlas region.
Use MeshBasicNodeMaterial with .map node.
```

**`plane`:**
```
Create a textured plane with explicit position/rotation from scenePosition. Use
MeshBasicNodeMaterial unless behaviorSpec.effects requests lighting (then MeshStandardNodeMaterial).
```

**`parallax-plane`:**
```
Create a textured plane with displacement-mapped vertices using depthMapUrl as displacement source.
Use a tessellated PlaneGeometry (64x64 segments) and TSL displacement node. Subtle parallax effect
on cursor or camera movement is REQUIRED — apply via cinematicPrimitives if not already present.
```

**`mesh`:**
```
Load the GLB from meshUrl via ctx.glbLoader. Apply scenePosition transform. Texture and PBR
materials come from the GLB itself. If imageUrl is also present, that's the reference image —
do NOT apply it as a texture override; the mesh has correct textures from generation.
```

---

## 10. Verification Rule Updates

Replace the PixiJS API check in the deterministic verifier with Three.js equivalents. Add render-mode-aware structural checks.

```typescript
const ALLOWED_THREE_IMPORTS = [
  'Object3D', 'Group', 'Mesh', 'PlaneGeometry', 'BoxGeometry', 'SphereGeometry',
  'TextureLoader', 'GLTFLoader', 'Vector2', 'Vector3', 'Quaternion', 'Euler',
  'MeshBasicNodeMaterial', 'MeshStandardNodeMaterial', 'AmbientLight', 'DirectionalLight',
  'Color', 'Raycaster', 'Box3', 'Sphere',
];

const DISALLOWED_PATTERNS = [
  /import.*['"]pixi\.js['"]/,                 // PixiJS gone
  /document\.(?!getElementById|createElement)/, // No general DOM access
  /window\.(?!devicePixelRatio)/,              // No window.* except DPR
  /innerHTML/,                                 // No HTML injection
  /TextGeometry/,                              // Use MSDF
  /\.addEventListener\(/,                      // Event handlers via userData
  /async\s+function\s+createNode/,             // createNode must be sync
];
```

Render-mode structural rules:
- `renderMode === 'parallax-plane'` → code MUST reference `displacementMap` or TSL displacement node
- `renderMode === 'mesh'` → code MUST call `ctx.glbLoader.load(config.meshUrl, ...)`
- All modes → code MUST iterate `config.cinematicPrimitives` and call `ctx.primitives[name]`
- All modes → code MUST iterate `config.textContent` and produce MSDF text via `ctx.fontAtlas` for non-empty entries
- Returned object MUST have `userData.cleanup` defined

---

## 11. Bundle Assembly Changes

The browser-side `assembleBundle` function in the existing browser-spec gains new files:

```typescript
const files: Record<string, string> = {
  'app.js': generateAppJs(graph),
  'graph.json': JSON.stringify(graph),

  // Shared (existing, ported to Three.js)
  'shared/manager.js': HUB_MANAGER_TEMPLATE,         // Now a THREE.Group manager
  'shared/adapter.js': GRAPH_TO_TREE_ADAPTER,        // Now adapts to THREE scene tree
  'shared/state.js': STATE_MANAGER,                  // Unchanged

  // NEW shared files
  'shared/scene-root.js': SCENE_ROOT_TEMPLATE,       // Camera, lights, render loop, post-FX
  'shared/loaders.js': LOADER_CACHE_TEMPLATE,        // TextureLoader, GLTFLoader cache
  'shared/text.js': MSDF_TEXT_TEMPLATE,              // MSDF font atlas + render helpers
  'shared/primitives/index.js': PRIMITIVES_INDEX,    // Cinematic primitives library entry
  'shared/primitives/orbit.js': PRIMITIVE_ORBIT,
  'shared/primitives/depth-rotate.js': PRIMITIVE_DEPTH_ROTATE,
  'shared/primitives/dissolve-morph.js': PRIMITIVE_DISSOLVE_MORPH,
  'shared/primitives/displacement-transition.js': PRIMITIVE_DISPLACEMENT,
  'shared/primitives/parallax-scroll.js': PRIMITIVE_PARALLAX,
  'shared/primitives/magnetic-cursor.js': PRIMITIVE_MAGNETIC,
  'shared/primitives/particle-emerge.js': PRIMITIVE_PARTICLE,
  'shared/primitives/fly-through.js': PRIMITIVE_FLYTHROUGH,
  'shared/primitives/kinetic-text.js': PRIMITIVE_KINETIC_TEXT,
  'shared/shaders/displacement.tsl.js': SHADER_DISPLACEMENT,
  'shared/shaders/dissolve.tsl.js': SHADER_DISSOLVE,
  'shared/shaders/voronoi-particle.tsl.js': SHADER_VORONOI,
  'shared/shaders/twisted-wave.tsl.js': SHADER_WAVE,
  'shared/shaders/radial-blur.tsl.js': SHADER_RADIAL_BLUR,
  'shared/shaders/rgb-shift.tsl.js': SHADER_RGB_SHIFT,

  // Per-node code unchanged (just targets Three.js now)
  // ... files[`nodes/${nodeId}.js`] = code for each node
};
```

External imports (NOT bundled — provided via importmap):
```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js",
    "three/webgpu": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.webgpu.js",
    "three/tsl": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.tsl.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/",
    "gsap": "https://cdn.jsdelivr.net/npm/gsap@3.13.0/index.js"
  }
}
</script>
```

Three-msdf-text-webgpu is bundled because it's small and not yet on a stable CDN.

---

## 12. Hub Manager Changes

The existing hub manager (statechart + ECS-tag-query hybrid) preserves its logic. The only change is what gets mounted/unmounted:

```typescript
// BEFORE (PixiJS)
activate(hubId: string) {
  const hubContainer = this.hubs.get(hubId);  // PIXI.Container
  this.app.stage.addChild(hubContainer);
}

// AFTER (Three.js)
activate(hubId: string) {
  const hubGroup = this.hubs.get(hubId);  // THREE.Group
  this.sceneRoot.add(hubGroup);
  this.activatePrimitivesForHub(hubGroup);  // fires 'inview' triggers, etc.
}
```

Reparent-on-navigate pattern for shared nodes is identical — Three.js's `Object3D.add()` also auto-removes from previous parent.

---

## 13. Editor Updates

The Prism Graph Editor (file-system replacement) gains updates in three tabs and one new feature. See companion document: `NODE-EDITOR-CHANGES.md` (Phase 7-8 of the migration prompt) for the detailed spec.

Summary of changes:

**Visual tab** — replaces static image preview with a live R3F sub-canvas that mounts the actual node code with sliders bound to `visualSpec` fields. Real-time slider feedback driven by `createNode` re-execution on debounced slider input.

**Animation tab** — gains hybrid mode toggle: i2v frame-scrub (existing) OR timeline-keyframe (new). Timeline mode shows a GSAP-style track with keyframes. Drag-corners-to-resize and drag-to-position update parameters; "save as keyframe" snapshots current parameter state. PowerPoint-style entrance/emphasis/exit/motion-path presets pull from the cinematic primitives library.

**Code tab** — Monaco editor's allowed import set updates to Three.js / TSL / GSAP / `@/primitives` / `@/text`. PixiJS imports flagged as warnings then errors after Phase 5 is complete.

**Image-edit mode** — masking and crop tools become essential. The user-flagged "swap code for image" → "swap mesh for image" preserves all behavior code; the renderer just falls back to a flat texture from the FLUX.2 image.

---

## 14. Mock App Reconstruction

The current mock app must be rebuilt under the new pipeline as the canonical reference implementation. Requirements:

1. Five hubs: Landing, Features, Gallery, Pricing, Contact
2. At least three `mesh` nodes (hero objects on Landing, featured product on Features, contact-callout on Contact)
3. At least one `parallax-plane` per hub for the primary hero element
4. All other nodes as `plane` or `sprite`
5. At least one example of each cinematic primitive across the app
6. All text rendered via MSDF
7. Inter-hub navigation uses fly-through primitive at least once
8. Build time ≤ 35 seconds for the full mock app (depth + mesh stages add ~7-10s over current)

The mock app validates the entire pipeline end-to-end. It's also the canonical example referenced in pitches.

---

## 15. Removed / Deprecated

- All PixiJS imports anywhere in `packages/prism-engine/` or `modal/prism*`
- `texture-atlas` PixiJS-specific bin packing utilities (atlasing logic stays, but it now produces Three.js-compatible `THREE.DataTexture` regions)
- `NineSliceSprite` references — Three.js uses scaled UV mapping or PlaneGeometry with proper aspect

---

## 16. Out of Scope for This Migration

These remain unchanged and MUST NOT be modified during the migration:

- Cortex engine (entirely separate code path)
- Plan generation logic (Sections 1-5 of pipeline)
- FLUX.2 / SAM 3 integration (already abstracted)
- Backend pipeline (unchanged contract-first generation)
- Database schema (no DB changes)
- SSE event channel
- Self-healing tier ladder (lives outside the renderer; will be a follow-up project)
- Any non-renderer aspects of the editor (chat panel, plan view, deployment, etc.)

---

## 17. Definition of Done

The migration is complete when:

1. ✅ A fresh Prism build with `engineType: 'prism'` produces a Three.js bundle (zero PixiJS imports verified by `grep -r 'pixi' bundle/`)
2. ✅ The bundle loads cleanly in Chrome, Safari (26+), Firefox, Edge with WebGPU active
3. ✅ The bundle loads with WebGL2 fallback on older browsers (verify via DevTools "Disable WebGPU")
4. ✅ All cinematic primitives render correctly across at least 3 mock-app builds
5. ✅ MSDF text renders crisply at zoom levels 1×–10×
6. ✅ Mesh nodes load GLBs from R2 within 2 seconds and animate smoothly
7. ✅ Parallax-plane nodes show visible depth response to cursor movement
8. ✅ The Prism Graph Editor's Visual tab live preview updates in <100ms on slider input
9. ✅ The Animation tab keyframe timeline successfully captures and replays parameter snapshots
10. ✅ The mock app builds in ≤ 35 seconds
11. ✅ All existing tests still pass
12. ✅ `pnpm tsc --noEmit` is clean across all packages
13. ✅ `docs/spec-deviations-prism.md` is updated with any deviations from this spec

---

## 18. Reference Documents

- `CINEMATIC-PRIMITIVES-LIBRARY.md` — Detailed spec for each cinematic primitive
- `CLAUDE-CODE-MIGRATION-PROMPT.md` — Phased RALPH loop prompts (this is what Claude Code consumes per iteration)
- `DRIFT-PREVENTION-RENDERER-MIGRATION.md` — Migration-specific drift prevention rules (extends existing playbook)
- `DIFFUSION-ENGINE-SPEC.md` — Original spec, still authoritative for non-renderer concerns
- `PRISM_ENGINE_BROWSER_BASED_SPEC.md` — Browser-side architecture, still authoritative for non-renderer concerns
- `Editor_UI_Rough_Spec` — Original editor spec, still authoritative for non-renderer concerns
