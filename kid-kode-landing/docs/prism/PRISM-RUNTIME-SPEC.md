# PRISM RUNTIME — SPECIFICATION

**Status:** Canonical source of truth for the Prism **runtime**: the one unified 3D scene, the three view-mode states, the build action, and the built-state cache.
**Date:** 2026-06-05
**Codename:** Prism Runtime v1
**Applies to:** Prism engine only. Cortex is out of scope.
**Ruler:** `Design-trials/PRISM-INTENT-ANCHOR.md` (v2). Where this spec conflicts with the anchor, the anchor wins.

> A build agent MUST read this document in full before writing any runtime/renderer code (the scene, the mode state machine, the build action, the cache, the `<app>_world`). This spec governs the **runtime substrate** that the Node Editor (`PRISM-NODE-EDITOR-SPEC.md`) and the Canvas Editor (`PRISM-CANVAS-EDITOR-SPEC.md`) both project onto. It **supersedes** `PRISM-RENDERER-MIGRATION-SPEC.md` (the migration is done) and the *preview-as-compile* model of `PRISM-EDITOR-BUILD-SPEC.md` (see §14 for the line-by-line supersession table). Renderer foundations (three/webgpu, TSL, MSDF, the synchronous `createNode` contract) are **carried forward unchanged** from the migration spec.

---

## 0. How to read this spec

- §1–§3 define scope, locked decisions, and invariants. Read first.
- §4–§10 define behavior: the unified scene, the two-state model + build action, the mode state machine, the cache, the `<app>_world`, the renderer foundation, and capability tiers.
- §11 is the numbered atomic success-criteria checklist a build loop verifies against. Each is independently testable with evidence (command output, screenshot, or runtime assertion).
- §12 is the forbidden-patterns list (drift triggers).
- §13 lists items to re-verify against the live web at build time (versions move; training data is stale). **No dependency version is hard-coded as a requirement in this spec — see §13.**
- §14 is the supersession table (what this spec replaces, with line cites into the archived specs).

---

## 1. Scope & the unified-scene premise

### 1.1 What the runtime is

The runtime is the **preview pane of the eventual Prism AI app builder** (anchor §0). In the future builder a streaming chat sits left and this pane sits right. Today this pane is the whole prototype: a single, continuous 3D scene that renders the knowledge graph and lets the user navigate, edit, build, and run their app inside it.

The runtime is **not** a media player mounted next to an editor, and **not** a compiler that emits a separate "preview screen." It is one scene whose *state* and *tooling* change as the user toggles modes.

### 1.2 The two-state model (INVARIANT — anchor §2)

A node is in exactly **one** state at any instant:

1. **Node-state** — a dormant **sphere** (galaxy). It *is* the element in container form; it is not a picture of the element.
2. **Built-state** — the element's **artifact** rendered at its coded 3D position, running its code (canvas, preview-app).

**Never both at once.** Any view that shows the same node simultaneously built *and* as a sphere is invalid by definition (INV-R2). The three modes are different *states* of one continuous scene — not adjacent panes or frames.

### 1.3 The three modes are states of one scene

`galaxy | canvas | preview-app`. These names are final (anchor §3, canvas-spec §1.1). One continuous scene; the toggle changes node state + tooling + camera constraints. (The Canvas spec calls `preview-app` "Preview"; they are the same mode — see `PRISM-CANVAS-EDITOR-SPEC.md` Reconciliation note and §6.3 here.)

| Mode | Node state | Spec that owns its surface |
|---|---|---|
| **galaxy** | node-state (dormant spheres) | `PRISM-NODE-EDITOR-SPEC.md` |
| **canvas** | built-state (from cache), editable in 3D | `PRISM-CANVAS-EDITOR-SPEC.md` |
| **preview-app** | built-state (from cache), live + handles hidden | this spec §6.3 + `PRISM-CANVAS-EDITOR-SPEC.md` §16 |

This spec owns the **substrate** all three share: the scene, the mode state machine, the build action, and the cache. The per-mode editing/navigation surfaces are owned by the node-editor and canvas specs.

### 1.4 Frozen / out of scope

- **Graph topology** (bipartite DAG, hubs, reparent-on-navigate, the node system and its deps) is FROZEN (INV-R10, mirrors canvas INV-1). Schema growth is additive only.
- **Galaxy navigation, node/hub presentation, the node editor, captions, the edit→build→verify→preview path** are defined in `PRISM-NODE-EDITOR-SPEC.md`. This spec only states the substrate they bind to.
- **Canvas internals** (transform editing, keyframe editor, primitive catalog, text system, lighting, materials, Rive) are defined in `PRISM-CANVAS-EDITOR-SPEC.md`.
- **Future-source (anchor §0):** the AI app-builder pipeline, coding-model routing, parallel code generation, self-healing/node-repair, image/3D/diffusion asset generation, the backend template engine, the harness, and the formal caption format are **not** built here. Structural seams may be added only if real, typed, used, and necessary — never as placeholders.

---

## 2. Locked decisions (DECISIONS block)

1. **One unified scene, one renderer, ONE `three` instance.** The runtime renders a single `THREE.Scene` via `WebGPURenderer` (`three/webgpu`), with automatic WebGL2 fallback. There is exactly **one** `three` module instance for the whole app. The current split — editor bundles `three` from `node_modules` while the player loads `three`/`three/webgpu`/`three/tsl` from a CDN import-map — is a **defect to remove**, not a sanctioned deviation (supersedes migration-spec §11 import-map, archived `:429`–`:444`; see §14 and §13).
2. **The three modes are states of one continuous view, not panes or separate mounts.** There is no split-screen and no second canvas. Switching to `preview-app` does **not** unmount an editor and mount a player; it changes the state + tooling of the same scene (supersedes the editor-build `page.tsx` two-mount architecture and editor-build §3 "Preview is compile, not render-of-source," archived `:82`–`:84`).
3. **`preview-app` is the same scene as `canvas` with editing handles hidden and live drivers running.** Not a compiled `CompiledAppView` mounted into a separate `PrismHost`. The built artifacts the user edited in canvas ARE the artifacts that run in preview-app (anchor §3, canvas-spec §16).
4. **Build is explicit and plays the pop-transition.** Built-state is produced only by an explicit **Build** action (**Build All Nodes**, **Build Selected Nodes**, **Build Node**), never by entering a mode. A node's build is the anchor §2 transition: the sphere leaves node-state, animates to its coded 3D position, the sphere "pops," and the artifact is revealed and starts running its code (anchor §4). The result is cached (§7).
5. **`builtSnapshot` cache; toggling never rebuilds.** Every node and hub stores a content-hash-keyed `builtSnapshot`. Switching to canvas or preview-app serves the cache instantly and does **not** rebuild. A node rebuilds only when its content hash changes (i.e. after an edit + explicit rebuild) (anchor §4, canvas-spec §11 decision 11).
6. **Galaxy resting representation = dormant spheres.** In galaxy mode every node renders as a dormant sphere (node-state). Built artifacts appear only in canvas/preview-app. (Resolves the reconciliation-report tension where the editor default showed assembled artifacts; see residuals doc.)
7. **Capability-tiered.** The scene runs on mobile and desktop. Heavy effects are gated behind capability detection with graceful degradation (mirrors canvas INV-9 / §17). See §10.
8. **`<app>_world` is the per-app root store** (anchor §1). It holds app-level data in the shape the future AI builders need, plus **capability references** (vault refs) — never raw secret values. See §8.
9. **Renderer foundation carried forward unchanged from the migration spec:** `three/webgpu` + WebGL2 fallback, **TSL only** (no raw GLSL), **MSDF** runtime text (`three-msdf-text-webgpu`), and the **synchronous `createNode(config, ctx): THREE.Object3D`** contract with `userData.cleanup()`. These survive the migration's archival (§9, §14).

---

## 3. Architectural invariants

- **INV-R1 (Single visible renderer, single `three`):** All visible 3D rendering is the one `three/webgpu` scene. There is one `three` module instance. Permitted composited layers (inherited from canvas INV-2): a Rive screen-space overlay canvas and a hidden parallel-DOM accessibility tree. No second visible 3D renderer; no PixiJS in the visible path; no CDN-vs-bundled `three` split.
- **INV-R2 (Two-state, never dual):** A node is built XOR a sphere at any instant. No view, in any mode, renders the same node simultaneously built and as a sphere. (anchor §2; enforces F5.)
- **INV-R3 (Modes are states, not mounts):** Galaxy, canvas, and preview-app are states of one scene. No code path mounts a second scene/canvas for a mode, and no path renders two modes simultaneously (no split-screen). (anchor §5 F1/F2.)
- **INV-R4 (Preview ≡ same built scene):** preview-app renders the cached built artifacts in place, with handles hidden and live drivers running. It does not compile the graph into a separate data object that a separate player mounts. (anchor §3 F2.)
- **INV-R5 (Literal artifacts only):** Built modes render the literal artifacts contained in the nodes — never copies, thumbnails, pre-rendered images, or empty-`Group` stand-ins. A node with no buildable artifact is not shown as a fake; it stays in node-state until it has a real artifact. (anchor §3 F3.)
- **INV-R6 (Build is explicit; toggling never rebuilds):** Built-state is produced only by an explicit Build action and then cached. Entering canvas or preview-app serves the cache; it never triggers a rebuild. (anchor §4 F6.)
- **INV-R7 (Content-hash cache):** `builtSnapshot` is keyed by a content hash over the node's build-relevant inputs. A rebuild occurs iff the hash changes. Snapshots are append-only (old snapshots persist in the artifact library, mirroring canvas §11).
- **INV-R8 (Surgical rebuild):** Rebuilding one node disposes (`userData.cleanup()`) and re-invokes `createNode` for **exactly that node**, re-mounting at the same coded position. Every other node's mounted `THREE.Object3D` reference stays stable. No full-scene re-mount on a single-node edit. (anchor §8; carried from editor-build RA-16/INV-26.)
- **INV-R9 (`createNode` is synchronous):** `createNode(config, ctx): THREE.Object3D`. Async loading happens inside primitives via cached `ctx` loaders. The returned object exposes `userData.cleanup()` (disposes geometries/materials/textures, kills timelines) and `userData.handlers.*` for events. It never adds itself to the scene; the manager mounts it. (carried from migration §8.)
- **INV-R10 (Frozen graph, additive schema):** The runtime never alters graph topology rules, the node system, or its deps. New persisted fields are additive with safe defaults; no existing field is renamed, removed, or made required. (mirrors canvas INV-1/INV-8.)
- **INV-R11 (Text is code, never diffusion):** Runtime text is real MSDF text. Letterforms always come from a real font via MSDF; no diffusion-rendered or image-baked letterforms in any built UI. (carried from migration INV-13 / canvas INV-11.)
- **INV-R12 (No DOM in node/runtime modules):** `document.*` and `window.*` are forbidden in runtime and node modules; the only exception is `window.devicePixelRatio`. (carried from migration rules.)
- **INV-R13 (Secrets are references only):** Raw secret values never enter the client bundle or the visible graph. The graph/`<app>_world` holds capability references; resolution happens server-side via the vault with scoped, audited access. (carried from editor-build INV-19/RA-02; see §8.)
- **INV-R14 (Capability-tiered):** The scene must run on mobile and desktop. Heavy effects are gated by capability detection with graceful degradation, never the default path. (mirrors canvas INV-9.)

---

## 4. The unified scene model

- The scene root is a single `THREE.Scene` rendered by `WebGPURenderer` (init awaited; automatic WebGL2 fallback). One renderer, one canvas, one `three` instance (INV-R1).
- Each node maps to **one** scene object whose representation depends on the current mode + the node's state:
  - **Node-state (galaxy):** a dormant **sphere** (presentation in `PRISM-NODE-EDITOR-SPEC.md` §3).
  - **Built-state (canvas/preview-app):** the artifact's scene object with a `renderMode` (`plane`, `parallax-plane`, `mesh`, `splat`, `text`, `rive`, or `code` — render-mode catalogue owned by the canvas spec §4, extended from migration §5).
- Built node position/scale/rotation is composed from `scenePosition` (the runtime placement field) ⊕ `canvasTransform` (canvas-mode edits), per canvas INV-25. The runtime is the sole consumer of these for visible placement.
- Hub activation uses the existing graph-to-tree adapter (reparent-on-navigate) over `Object3D` containers — inherited from the frozen graph layer, not redefined here.
- The same scene objects are reused across mode toggles. Mode change re-poses the camera and toggles tooling/handle visibility; it does **not** dispose and rebuild the scene (INV-R3, INV-R6).

---

## 5. The two-state model & the build action (the core mechanic)

This is the mechanic the anchor (§2–§4) makes central and that no prior on-disk spec defined (it is the "MISSING-FOR-INTENT" item D1/D2 from the reconciliation report). It is specified here as **to-be-built** — the current code performs a mode/mount swap instead (reconciliation Q1).

### 5.1 Node-state → built-state (the pop-transition)

On an explicit **Build** of a node:

1. The node leaves node-state (its dormant sphere).
2. It **animates from its current (sphere) position to its coded 3D position** (`scenePosition` ⊕ `canvasTransform`).
3. The sphere **"pops"** to reveal the node's artifact (its real `createNode` output).
4. The artifact **starts running its code** (primitives play per their drivers; event handlers live).
5. The built result is written to the node's `builtSnapshot` (§7).

When **every node tethered to a hub** has built, the assembled result **is** the running UI of that page (anchor §3). There is no separate "compile to a page" step.

### 5.2 Build controls

Available only in built-state-capable contexts (canvas / preview-app and the node editor's build affordance):

- **Build Node** — builds one node (appears once the node has a buildable artifact).
- **Build Selected Nodes** — builds the current selection.
- **Build All Nodes** — builds every node in scope (active hub, or app-wide).

Build is the **only** producer of built-state. Entering a mode is **not** a build (INV-R6).

### 5.3 Surgical rebuild after an edit

After an edit + explicit rebuild, the runtime disposes and re-invokes `createNode` for **exactly the edited node**, re-mounting at the same coded position; all other nodes' object references stay stable (INV-R8). The node's `builtSnapshot` and content hash update (§7). This is the only rebuild kind invoked from inside the app; full `.prism` artifact rebuilds remain a build-time/offline operation.

### 5.4 No copies, no stand-ins

Built modes render the literal artifact (INV-R5). The legacy `previewDefaultCreateNode` empty-`Group` stand-in (reconciliation Q2 caveat) is a forbidden pattern here (FP-R3); a node lacking a real factory stays in node-state rather than rendering a fake.

---

## 6. Mode state machine

One scene; mode is a property of the editor store consumed by the scene root. Camera state is per-mode but selection survives every transition (carried from editor-build INV-20). Camera is never threaded through node modules (INV-R9).

### 6.1 galaxy

- All nodes in node-state (dormant spheres). The structural/navigational map: hubs (pages) with their tethered nodes in orbit.
- Camera: **fully free** 3D navigation; click-to-zoom-and-lock; deep zoom must reach any node. (Camera rig + presentation owned by `PRISM-NODE-EDITOR-SPEC.md` §2–§3.)
- This is the only mode where the camera is truly unconstrained.

### 6.2 canvas

- All nodes in built-state, served from cache (§7). A 3D drag/resize/rotate visual editor with the keyframe editor and the full canvas toolbar.
- Camera: heavily guarded — bounded distance/polar/azimuth/pan around the active hub; cannot drift past the viewport-frame envelope. (Constraints + all editing owned by `PRISM-CANVAS-EDITOR-SPEC.md`.)

### 6.3 preview-app

- All nodes in built-state, served from cache — the **same scene objects as canvas**, with editing handles/gizmos/clutter hidden and live drivers running (INV-R4). The literal running app.
- `TimeDriver` animations play deterministically; `Scroll`/`Pointer`/`State`/`Event` drivers respond to real input (canvas-spec §16).
- Camera: constrained cinematic navigation of the active hub; never exposes scene edges or a blank background.
- **Default mode on app boot** is `preview-app` (the prototype IS the preview pane; a user cares first about what the app looks like) — carried from editor-build RA-17/SC-064. Editing modes (galaxy/canvas) are reached by toggle.

### 6.4 Transitions

- Toggling between modes re-poses the camera and toggles tooling; it **serves the cache** and never rebuilds (INV-R6) and never mounts a second scene (INV-R3).
- `selectedNodeId` / `selectedHubId` survive every transition. Camera pose is checkpointed per mode and restorable.
- There is no `hub-world` and no `preview-hub` state. Those Round-1 strings are retired (see §12 FP-R8).

---

## 7. builtSnapshot caching

- Every **node** and every **hub** stores a `builtSnapshot` keyed by a **content hash** over its build-relevant inputs (artifact source + visual/material/animation/lighting/text spec + composed transform + caption/version). (mirrors canvas §11.)
- Canvas and preview-app **load snapshots instantly**. A snapshot is rebuilt **iff** its content hash changes (INV-R7).
- Snapshots are **append-only**: superseded snapshots persist in the artifact library so prior built states remain recoverable.
- A single-node edit + rebuild evicts and recomputes only that node's snapshot (INV-R8); sibling snapshots are untouched.
- Toggling modes must be O(1) in rebuild cost (zero rebuilds) — measurable: a mode toggle issues no `createNode` calls for already-cached nodes.

---

## 8. `<app>_world` (root store) & capability references

- The **`<app>_world`** is the per-app root node/store (anchor §1). It holds app-level information in the shape the future AI builders consume: the app spec/design intent, the page (hub) registry, the node registry, global dependencies, validation rules, and AI-routing rules — as **real graph data**, not external references. (carries editor-build RA-01/RA-07; the implementation type is the existing `PrismRootNode`.)
  > **Naming:** the anchor calls this `<app>_world`; the code/editor-build spec calls the implementing node `App_Name_World` / `PrismRootNode`. They denote the same thing. Naming alignment is a residual for Logan (see residuals doc).
- Exactly **one** root exists per `GraphSource`; a runtime assertion enforces uniqueness.
- **Capability references (INV-R13):** the `<app>_world` (and optionally a node) holds `capabilityRefs` — reference objects pointing at vault entries. **Raw secret values never appear** in graph data, in the client bundle, or in any `src/lib`/`src/components` file. Resolution happens server-side (`src/server/secrets/**` or a `server-only` gate) with scoped, audited access: every `resolve` writes an audit-log entry `{ at, scope, ref, callerNodeId }`. (carries editor-build §Phase-2 / RA-02.)

---

## 9. Renderer foundation (carried forward from the migration, now archived)

The renderer migration (PixiJS → three/webgpu) is **done**. Its renderer rules survive as runtime invariants:

- **Renderer:** `three/webgpu` with automatic WebGL2 fallback; one `three` instance (INV-R1). Editor uses `@react-three/fiber` + `drei` with the async `gl` factory for WebGPU init.
- **Shaders:** **TSL only** (compiles to WGSL + GLSL); no raw GLSL maintained in parallel.
- **Text:** real MSDF via `three-msdf-text-webgpu` (INV-R11); `THREE.TextGeometry` forbidden; FLUX/diffusion prompts exclude text ("no text, no letters, no labels").
- **`createNode` contract (INV-R9):** synchronous; returns `THREE.Object3D`; `userData.cleanup()` disposes resources and kills timelines; `userData.handlers.*` for events; never adds to the scene directly.
- **Render modes:** the catalogue (`plane`, `parallax-plane`, `mesh`, `splat`, `text`, `rive`, `code`) is owned by the canvas spec §4 (extends migration §5). The runtime mounts whatever the artifact's factory returns.
- **Animation execution:** the runtime **executes** whatever animations a node declares, regardless of origin (catalog primitive or bespoke). It does **not** restrict animation authorship — the authorship policy is the canvas spec's (300+ catalog **AND** from-scratch authoring; canvas-spec §2 decision 6, §8). The migration-era "no scene-level animation outside the primitives library" rule is **rescinded** (see §12 FP note and the SPEC-INDEX supersession table). The 9 cinematic primitives in `CINEMATIC-PRIMITIVES-LIBRARY.md` are the shipped **seed set**, not a cage.

---

## 10. Capability tiers

- Capability detection selects: lighting tier (canvas §10 T0–T3), particle/fluid density, Rive texture update cadence, and whether GI/path-tracing previews are offered. (INV-R14.)
- Defaults degrade gracefully: heavy effects (GI, path tracing, dense fluid/particles) are never the default path; they are offered only where supported.
- Use instancing, LOD, KTX2 textures, and the §7 snapshot cache to keep mobile and desktop at target framerate. WebGL2 fallback where WebGPU is absent.

---

## 11. Numbered atomic success criteria (verifiable)

> Each must be demonstrated with evidence (command output, screenshot, or runtime assertion). No assertion-only "done."

1. **RT-SC-01** The runtime renders one `THREE.Scene` via `WebGPURenderer`; WebGL2 fallback verified on a non-WebGPU context (e.g. `navigator.gpu` stubbed undefined → `__webgl2Active === true`).
2. **RT-SC-02** Exactly one `three` module instance is loaded for the whole app — editor and runtime share it; no CDN import-map for `three`/`three/webgpu`/`three/tsl`. **Verify:** served HTML has no `three` import-map entry; a single resolved `three` module identity across editor + player (assert module identity or bundle-graph proof).
3. **RT-SC-03** Toggling `galaxy ↔ canvas ↔ preview-app` mounts no second scene/canvas and renders no two modes at once. **Verify:** DOM shows exactly one rendering canvas; no split-pane; `selectedNodeId`/`selectedHubId` survive every transition.
4. **RT-SC-04** In `galaxy`, every node renders in node-state (a dormant sphere); no built artifact is shown. **Verify:** screenshot + scene-graph assertion (no artifact meshes mounted in galaxy).
5. **RT-SC-05** No view, in any mode, shows the same node simultaneously as a sphere and as a built artifact (INV-R2). **Verify:** scene-graph assertion across all three modes.
6. **RT-SC-06** Build Node performs the pop-transition: the node animates from its sphere position to its coded position, the sphere pops, the artifact is revealed and runs its code. **Verify:** screenshot sequence / animation timeline assertion (start pose ≠ coded pose; artifact mounted at coded pose at end).
7. **RT-SC-07** Built modes never render a copy/stand-in: a node lacking a real factory stays in node-state; no empty-`Group` placeholder is mounted as a built artifact (INV-R5). **Verify:** assert no node renderer returns an empty `Group` in built-state.
8. **RT-SC-08** Entering `canvas` or `preview-app` issues **zero** `createNode` calls for already-cached nodes (toggling never rebuilds, INV-R6). **Verify:** instrument `createNode`; count == 0 on a pure mode toggle.
9. **RT-SC-09** A node's `builtSnapshot` is content-hash keyed; an edit that changes the hash triggers exactly one rebuild for that node and none for siblings (INV-R7/R8). **Verify:** edit one node; assert one `createNode` call (that node) + stable `THREE.Object3D` refs for all others.
10. **RT-SC-10** `preview-app` renders the same built scene objects as `canvas` with handles hidden and live drivers running (INV-R4). **Verify:** object-identity assertion that preview-app reuses canvas's mounted objects (no separate `PrismHost` compiled mount); `TimeDriver` plays deterministically while a hover/scroll driver responds to input.
11. **RT-SC-11** Default `viewMode` on app boot is `preview-app`. **Verify:** grep + Playwright snapshot.
12. **RT-SC-12** `createNode` is synchronous, returns `THREE.Object3D`, and the returned object exposes a working `userData.cleanup()` (INV-R9). **Verify:** typecheck + unit assertion that cleanup disposes resources and kills timelines.
13. **RT-SC-13** Runtime text renders via MSDF; `THREE.TextGeometry` appears nowhere in runtime/node modules (INV-R11). **Verify:** grep + render assertion.
14. **RT-SC-14** No `document.*`/`window.*` (except `window.devicePixelRatio`) in runtime/node modules (INV-R12). **Verify:** grep.
15. **RT-SC-15** Exactly one `<app>_world` root exists per `GraphSource`; a runtime assertion enforces uniqueness (§8). **Verify:** unit assertion on a multi-root graph (throws/rejects).
16. **RT-SC-16** Zero raw secret strings in the client bundle; only capability references appear in graph data; every vault `resolve` writes an audit entry (INV-R13). **Verify:** grep regex over `.next/static/**`; audit-log assertion per resolve call.
17. **RT-SC-17** No graph-topology / node-system dependency is added, removed, or altered by runtime changes (INV-R10). **Verify:** diff proves additive-only schema growth.
18. **RT-SC-18** Capability detection degrades gracefully: GI/path-tracing offered only where supported; the app reaches target framerate on a mobile profile (INV-R14). **Verify:** capability-gated path + framerate sample.

---

## 12. Forbidden patterns (drift triggers — halt)

- **FP-R1** — A second visible 3D renderer, PixiJS in the visible path, or a CDN-vs-bundled `three` split (two `three` instances). (INV-R1)
- **FP-R2** — Any view, in any mode, rendering the same node simultaneously built and as a sphere (persistent/dual state). (INV-R2)
- **FP-R3** — Rendering a built node as a copy, thumbnail, pre-rendered image, or empty-`Group` stand-in. (INV-R5)
- **FP-R4** — Treating a mode toggle as a build: rebuilding nodes (any `createNode` call for already-cached nodes) on entering canvas/preview-app. (INV-R6)
- **FP-R5** — Preview-app as a separate compiled screen: compiling the graph into a `CompiledAppView`/`CompiledHubView` data object that a *separate* mount renders, instead of running the same built scene in place. (INV-R3/R4 — this is the central reconciliation violation; supersedes editor-build `:82`–`:84`.)
- **FP-R6** — Split-screen dual-state: preview on one side and the node editor on the other, simultaneously. (INV-R3; anchor F1.)
- **FP-R7** — A full-scene re-mount on a single-node edit, or a single-node rebuild that perturbs sibling `THREE.Object3D` references. (INV-R8)
- **FP-R8** — Introducing a fourth view-mode state, or the retired strings `'hub-world'` / `'preview-hub'`, or any non-canonical mode literal. Canonical set is exactly `galaxy | canvas | preview-app`. (INV-R3)
- **FP-R9** — `async createNode`, or a `createNode` whose returned object lacks `userData.cleanup()`. (INV-R9)
- **FP-R10** — `THREE.TextGeometry`, diffusion-rendered/image-baked letterforms, or DOM text overlays in runtime UI. (INV-R11)
- **FP-R11** — `document.*` / `window.*` (except `window.devicePixelRatio`) in runtime/node modules. (INV-R12)
- **FP-R12** — Raw secret values in graph data, the client bundle, or any `src/lib`/`src/components` file; resolving secrets outside the server-only vault. (INV-R13)
- **FP-R13** — Altering graph topology / the node system / their deps, or a non-additive schema change. (INV-R10)
- **FP-R14** — Making GI / path tracing / dense fluid the default (non-tiered) path. (INV-R14)

> **Rescinded trigger (do NOT re-encode):** the migration-era rule "the codegen model SELECTS primitives by name … no scene-level animation authored from scratch" (archived migration-spec `:36`, `:201`; archived editor-build INV-12 `:272`; `CINEMATIC-PRIMITIVES-LIBRARY.md:6,293`) is **rescinded** by canvas-spec §2 decision 6. Animation may be authored from scratch (by users and AI). This spec must not re-introduce any "no bespoke animation" rule. The runtime simply executes whatever animations exist. *(Note for STEP-3: the rescinded rule is still enforced in code — `src/lib/prism/codegen/verifier.ts` `MISSING_PRIMITIVES_LOOP` and `src/lib/prism/codegen/prompts.ts` — and is recorded in the SPEC-INDEX as a pending code change. No code is edited by this hardening pass.)*

---

## 13. Re-verify at build time (training data is stale)

**No dependency version above is a hard requirement.** The build step researches current versions/endpoints and pins them. Confirm at build time:

- Current `three` version and `three/webgpu` API surface (this spec assumes the migration's r184+ baseline; confirm latest stable and the single-instance bundling story for Next.js).
- The correct way to load **one** `three` instance across the Next.js editor bundle and the runtime player (the path that removes the CDN import-map split — INV-R1 / RT-SC-02).
- `three-msdf-text-webgpu` + `msdf-bmfont` current versions + WebGPU compatibility.
- `@react-three/fiber` / `drei` versions compatible with the async WebGPU `gl` factory.
- WebGL2-fallback behavior of the current `WebGPURenderer.init()` (verify the fallback actually instantiates a scene, not just a flag).
- Current capability-detection best practice for WebGPU vs WebGL2 and the mobile framerate profile.
- Whether any `builtSnapshot` hashing approach needs a current content-hash library or a built-in (`crypto.subtle`) is sufficient.

---

## 14. Supersession table (what this spec replaces)

| Superseded text | Location (archived) | Replaced by |
|---|---|---|
| "Preview is compile, not render-of-source. Preview Hub and Preview App are non-destructive compiles … emit `CompiledHubView` and `CompiledAppView`." | `archive/PRISM-EDITOR-BUILD-SPEC.md:82`–`84` | §2 decision 2/3, §5, §6.3, INV-R3/R4, FP-R5 (preview-app is the same built scene in place, not a compile) |
| `compileAppToPreview` / route-like separate player mount as the preview model | `archive/PRISM-EDITOR-BUILD-SPEC.md:217`–`218` (SC-053/054) | §6.3 (preview-app is a state of one scene); compile-to-data is not the preview mechanism |
| CDN import-map for `three`/`three/webgpu`/`three/tsl`/`gsap` | `archive/PRISM-RENDERER-MIGRATION-SPEC.md:429`–`444` | §2 decision 1, INV-R1, RT-SC-02 (single bundled `three` instance) |
| "Invariant 12 … no scene-level animation authored from scratch" | `archive/PRISM-RENDERER-MIGRATION-SPEC.md:36`, `:201`; `archive/PRISM-EDITOR-BUILD-SPEC.md:272` | Rescinded — §9 + canvas-spec §2 decision 6 |
| Renderer foundation (three/webgpu, TSL, MSDF, sync `createNode`) | `archive/PRISM-RENDERER-MIGRATION-SPEC.md` §2/§8/§3 | **Carried forward unchanged** into §9 + INV-R9/R11 (not contradicted — re-homed) |
| `<app>_world` / `App_Name_World` / `PrismRootNode`, secrets vault, capability refs | `archive/PRISM-EDITOR-BUILD-SPEC.md` §3/Phase-2/RA-01/RA-02/RA-07 | **Carried forward** into §8 + INV-R13 |
| 5-mode and `hub-world`/`preview-hub` taxonomy | `archive/PRISM-EDITOR-BUILD-SPEC.md` (mixed 5/3, e.g. `:138`,`:283`,`:284`,`:327`) | §1.3, §6, FP-R8 (canonical 3 only) |

---

*End of PRISM-RUNTIME-SPEC.md*
