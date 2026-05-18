# Prism Editor Build Specification v1.1

**Status:** Authoritative for the Prism editor build. Round 1 (53 tasks, 10 phases) shipped; Round 2 (~24 tasks, 7 task groups A–G) is armed against this v1.1 amendment.
**Activation marker:** `.prism-editor-build-active` at repo root.
**Supersedes:** Nothing. **Extends:** the four canonical specs below (every invariant of which remains binding).

**v1.1 amendment (Round 2):** Reduces canonical view modes from 5 → **3** (`galaxy | canvas | preview-app`); makes `preview-app` the default mode on app boot; specifies real transform editing in canvas mode (Edit toggle + visible drag); specifies Save / Save-and-Rebuild semantics (single-node visual artifact re-render); specifies Clone-with-auto-snap-to-nearest-hub; extends verification with a per-task KripVerify pass against the live Vercel preview URL. All v1.0 invariants preserved; superseded items marked in place.

---

## 1. Status & cross-references

This spec is the source of truth for the editor build. It does **not** delete or override any
canonical invariant. Where this spec adds a constraint, the constraint is *additive*. Where this
spec appears to conflict with a canonical invariant, the canonical invariant wins (per
DECISIONS D5) and the conflict is recorded in §9 Resolved Assumptions.

| Spec | File | This spec extends |
|---|---|---|
| Prism Engine v3 | `kid-kode-landing/docs/prism/PRISM-ENGINE-SPEC-V3.md` | §1.3 core invariants (carried into INV-01..INV-10); §1.9 bipartite topology |
| Renderer Migration | `kid-kode-landing/docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md` | §2 updated invariants 11-13 (carried into INV-11..INV-13); §4 schema (additive growth); §8 createNode contract (INV-14) |
| Mock App Build | `kid-kode-landing/docs/prism/PRISM-MOCK-APP-BUILD-SPEC.md` | §1.2.3 three animation methodologies; §10 success criteria reinterpreted against Three.js runtime |
| Cinematic Primitives | `kid-kode-landing/docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md` | All 9 primitives consumed by editor-build phases |
| Deviations log | `kid-kode-landing/docs/spec-deviations-prism.md` | Continues to record divergences from the canonical specs introduced by this build |

The activation marker `.prism-editor-build-active` is committed at repo root. The drift-prevention
hooks in `.claude/hooks/anti-drift-check.sh` and `kid-kode-landing/.claude/hooks/anti-drift-check.sh`
activate the editor-build forbidden-pattern checks (FP-NN) when this marker is present, in
addition to the renderer-migration checks already active under `.ralph-migration-active`.

---

## 2. Two-runtime model

The repo hosts two runtimes simultaneously. Every Ralph task must verify both.

**Outer runtime — Next.js editor host.**
The Next.js app at `kid-kode-landing/src/app/` hosts the editor UI (canvas, inspector, overlays,
mode toggles). This is the only surface a user interacts with directly. Verified via Playwright
in `verify-prism.mjs` / `browser-smoke.mjs` against the dev server.

**Inner runtime — Prism player.**
A media-player + knowledge-graph runtime that renders the `.prism` artifact. Lives at
`kid-kode-landing/src/lib/prism/runtime/`, `kid-kode-landing/src/lib/prism/player/`, and the
`PrismHost` mount in `kid-kode-landing/src/components/prism-player/`. Three.js with `three/webgpu`
(automatic WebGL2 fallback). PixiJS is forbidden in runtime bundles (INV-11). The inner runtime
is exercised in the `preview-hub` and `preview-app` view modes against a fixed mock `.prism`
artifact.

**Verification surface per task** — see §11.

---

## 3. Core model

**The graph IS the app.** All app state, structure, behaviour, secrets-as-references, design
intent, and memory live as real node data in a single knowledge graph (INV-01, per D1).

**Node taxonomy:**

- **`App_Name_World`** — the root world / spec / memory / control node ("center sun"). Modeled
  as a `PrismRootNode` (RA-07). Holds, as real graph node data per D1:
  - `spec`, `designSpec`, `buildPlan`, `memoryLog`, `hubRegistry`, `nodeRegistry`,
    `globalDependencies`, `validationRules`, `aiRoutingRules`, `capabilityRefs` (vault refs).
- **Hubs** — app views/pages/sections. Orbit `App_Name_World` in galaxy mode. Each hub holds a
  layered background stack and a content scene.
- **Nodes** — UI/runtime elements inside each hub. Also backend capabilities, integrations,
  functions, data bindings, animation links. Edges between nodes carry typed reasons.

**View modes (single canvas, deterministic pivot — v1.1 reduced):**

`galaxy | canvas | preview-app`. **Default on app boot: `preview-app`** (RA-17). The two
former modes `hub-world` and `preview-hub` are superseded by `canvas` and `preview-app`
respectively (RA-06b supersedes RA-06). Do NOT introduce any of those legacy strings. The
canvas is single; the modes change what is rendered and how the camera is constrained.

**Why preview-app is the default:** this prototype IS the preview window of a future AI app
builder. When integrated, a streaming chat panel sits to the left and this exact pane sits
to the right. The first thing a user cares about is *what their app looks like / whether it
works*. Editing (galaxy / canvas) is the secondary surface, reached by toggle.

**Preview is compile, not render-of-source.** Preview Hub and Preview App are *non-destructive
compiles* (INV-17). They emit `CompiledHubView` and `CompiledAppView` data objects without ever
writing back to the source graph's `scenePosition` / `editorTransform` / `canvasTransform`.

---

## 4. Coordinate systems

Five spaces. **Never collapsed into a single matrix** (INV-22). Every keyframe declares which
space its parameters are in (INV-21, per D3).

| Space | Used by | Notes |
|---|---|---|
| `universe` | galaxy mode | hubs orbit App_Name_World here; scale-free, zoom-driven LOD |
| `hub-scene` | hub-world, canvas | the active hub's local 3D scene; layered background stack lives here |
| `viewport-composition` | preview-hub, preview-app | 2D-feeling app UI compiled from the hub-scene; viewport-relative anchors |
| `scroll-timeline` | preview-hub, preview-app | `scrollProgress: 0→1`; bound transforms drive per-element scroll response |
| `camera` | all modes | the active camera's local space; used for camera-locked anchors |

Transforms between spaces go through a documented pipeline (compile-time for preview-hub /
preview-app, runtime for galaxy ↔ hub-world). Per D3, the valid keyframe space set is exactly
the above five and is fixed by this build's camera + composition systems.

---

## 5. Camera modes (v1.1)

**Galaxy** — **full open-world navigation, no guardrails.** Orbit / drag / zoom / fly-to.
The `flyToNode` / `flyToHub` queue (`useGraphEditorStore.ts`, `GraphScene.tsx`) drives
deterministic navigation. The user can take the camera anywhere in galaxy space.

**Canvas** — **heavy guardrails.** Bounded around the active hub: minimum / maximum distance,
polar/azimuth limits, pan-target clamped to the viewport-frame envelope. The user cannot
drift away from the hub they are editing. Constraints are computed deterministically from
the active hub's content envelope + viewport-frame dimensions (Round-2 Phase D produces
`canvas-camera-rail.ts`).

**Preview-app** — constrained cinematic rail. Damped. Bounded. Never exposes scene edges;
never shows a blank background (INV-23). Builds on Round-1 Phase 6/EB-06-05's
`CompiledHubView.cameraRail`, but now drives the *default* boot view (RA-17).

Camera state is a property of `useGraphEditorStore` consumed by the canvas root; it is not
threaded through node modules (INV-14 — `createNode` stays synchronous and ctx-only).

**Carry-forward note:** The Round-1 line "editor/universe camera (galaxy, hub-world, canvas):
open-world navigation" is **superseded by RA-06b**. Only galaxy is now unconstrained; canvas
gained heavy guardrails. `hub-world` is gone (folded into canvas).

---

## 6. Success Criteria

Each SC is independently verifiable via the verification protocol in §11. Phase tags map to §10.

### Phase 1 — single canvas + 5 canonical view modes

- **SC-001** [Phase 1] `useGraphEditorStore.ViewMode` type is exactly `'galaxy' | 'hub-world' | 'canvas' | 'preview-hub' | 'preview-app'`. **Verify:** typecheck + grep.
- **SC-002** [Phase 1] Toggling through all 5 modes does not change `selectedNodeId`, `selectedHubId`, or camera-pose continuity (camera pose is mode-specific but selection survives). **Verify:** two-runtime snapshot at every transition.
- **SC-003** [Phase 1] Codex's preview logic (`PrismHost` runtime mount, flagship runtime smoke) renders behind `preview-hub` and `preview-app` modes; not deleted. **Verify:** `npm run verify:prism` continues passing with `preview-hub` snapshot showing the same `.prism` artifact as the prior baseline.
- **SC-004** [Phase 1] `editorRenderMode = 'scene' | 'topology'` from `useGraphEditorStore` is preserved as a sub-toggle within `hub-world` (per RA-01); not deleted.

### Phase 2 — App_Name_World root node + working secrets vault

- **SC-005** [Phase 2] `PrismRootNode` type exists in `kid-kode-landing/src/lib/prism-graph/types.ts` with the D1 fields as typed graph data. **Verify:** typecheck + grep.
- **SC-006** [Phase 2] Exactly one `PrismRootNode` instance exists in any valid `GraphSource`; runtime assertion enforces uniqueness.
- **SC-007** [Phase 2] Clicking `App_Name_World` in any mode opens a dedicated inspector tab surfacing the D1 fields; existing tabs preserved.
- **SC-008** [Phase 2] Server-only secrets vault exists at `kid-kode-landing/src/server/secrets/` (or via `server-only` import gate), with: `vault.store(scope, ref, value)`, `vault.resolve(scope, ref)`, audit-log table, scoped access.
- **SC-009** [Phase 2] `capabilityRefs` field on `PrismRootNode` (and optionally on `PrismNode`) holds capability-reference objects pointing at vault entries; raw secret values never appear in graph data.
- **SC-010** [Phase 2] Production client bundle contains zero raw secret strings. **Verify:** grep regex FP-06/FP-07 against `kid-kode-landing/.next/static/**/*.js` after `next build`.
- **SC-011** [Phase 2] Vault `resolve` calls are audited: every call writes to the audit log with `{ at, scope, ref, callerNodeId }`. Smoke test asserts an entry per call.

### Phase 3 — Galaxy mode

- **SC-012** [Phase 3] In `viewMode === 'galaxy'`, hubs render in orbit around the `App_Name_World` node at deterministic positions (fn of hubId hash + ring index).
- **SC-013** [Phase 3] Hub diameter scales with content complexity (`f(node count, depth)`); deterministic.
- **SC-014** [Phase 3] Zoom-based label LOD: at zoom L0 only App_Name_World + hub names visible; at L2+ node-cluster labels become visible.
- **SC-015** [Phase 3] Tether lines render between hubs with reason-colored edges (colors per `EDGE_COLORS`). Translucent. Animated.
- **SC-016** [Phase 3] Global filter overlay greys/dims non-matching hubs and nodes; selection still allowed on matching items.
- **SC-017** [Phase 3] Multi-select supported via shift-click; multi-selected items show in inspector as a group.

### Phase 4 — Hub drill-in + node reveal + inspector

- **SC-018** [Phase 4] Clicking a hub from `galaxy` flies the camera to that hub and switches to `hub-world` mode with that hub active; reuse `flyToHub`.
- **SC-019** [Phase 4] On entering `hub-world`, that hub's nodes + background + intra-hub tethers fade in via deterministic reveal animation (≤800ms).
- **SC-020** [Phase 4] Clicking a node opens the inspector with the existing tab set preserved (visual / behavior / code / animation / connections / backend / history).
- **SC-021** [Phase 4] Intra-hub zoom-based label LOD: at L1 hub label only; at L3+ node labels appear; at L4 sub-node detail visible.

### Phase 5 — Canvas mode

- **SC-022** [Phase 5] In `canvas` mode, the camera centers and faces the active hub at a deterministic pose; pose is checkpointed in `useGraphEditorStore`.
- **SC-023** [Phase 5] A viewport frame overlay renders with safe-area bounds (default desktop 1440×900 with 24px safe-area inset).
- **SC-024** [Phase 5] 3D depth is preserved (nodes retain their `scenePosition.z`); canvas is not a flat 2D projection.
- **SC-025** [Phase 5] Per-node transform handles render on selection: translate, rotate, scale. Edits write to `editorTransform` (Phase 8 field).
- **SC-026** [Phase 5] Inspector remains reachable from `canvas`; keyframe tools accessible from the animation tab.
- **SC-027** [Phase 5] Switching canvas → hub-world → canvas restores selection + camera pose exactly (INV-20).

### Phase 6 — Preview Hub compiler / Viewport Composition Engine v1

- **SC-028** [Phase 6] `CompiledHubView` interface exists in `kid-kode-landing/src/lib/prism-graph/compiled-view.ts` (or equivalent): pure data, deeply readonly, references no React/Three.js types.
- **SC-029** [Phase 6] `compileHubToPreview(hub, nodes, world) → CompiledHubView` is pure and deterministic — identical input produces identical output (hash-comparable).
- **SC-030** [Phase 6] `compileHubToPreview` never writes to `hub.layout`, `node.scenePosition`, `node.editorTransform`, or `node.canvasTransform`. **Verify:** snapshot of source graph before/after compile is byte-identical.
- **SC-031** [Phase 6] Per-node anchor rules: a deterministic rule table maps `(node.subtype, node.intent, node.serviceTag) → uiAnchor`. Rules live in `kid-kode-landing/src/lib/prism-graph/compile-anchors.ts`.
- **SC-032** [Phase 6] In `preview-hub` mode, the camera is constrained to a damped cinematic rail (no manual orbit/drag). Camera state is computed from `CompiledHubView.cameraRail`.
- **SC-033** [Phase 6] Viewport-relative background renders from the hub's compiled background layer stack; the first layer with `attachment: 'viewport-fixed'` is fixed to the viewport during scroll.
- **SC-034** [Phase 6] Editor clutter (handles, gizmos, mode bar except a minimal "back" affordance) is hidden in `preview-hub`.
- **SC-035** [Phase 6] Two-runtime snapshot at the end of every Phase 6 task shows: outer runtime route in `preview-hub` mode with valid CompiledHubView output, and inner runtime booted at the same fixture.

### Phase 7 — Background layering + scroll-timeline + no blank edges

- **SC-036** [Phase 7] `PrismHubBackgroundLayer` type exists with attachment mode: `'viewport-fixed' | 'camera-locked' | 'parallax' | 'world' | 'infinite-environment'`.
- **SC-037** [Phase 7] `PrismHub.background?: PrismHubBackgroundLayer[]` field added; `layout.mockupUrl` retained as legacy single-layer reader.
- **SC-038** [Phase 7] In `preview-hub` mode, scene edges are never visible regardless of camera position; scale-to-cover and environment/fog fill the gap.
- **SC-039** [Phase 7] Scroll-timeline system: `useScrollTimeline()` returns a deterministic `scrollProgress: 0→1` over the hub's scroll length; nodes with `scrollBinding?` consume it.
- **SC-040** [Phase 7] Scrolling in `preview-hub` mode reads as app UI (per-element response), not whole-scene movement.

### Phase 8 — Node transform editing + keyframe foundation

- **SC-041** [Phase 8] `editorTransform?` and `canvasTransform?` optional fields exist on `PrismNode` (additive, INV-18).
- **SC-042** [Phase 8] Transform editing in `canvas` mode writes only to `canvasTransform` (or `editorTransform`); never to `scenePosition` (which is the renderer-migration runtime field).
- **SC-043** [Phase 8] `PrismKeyframe` type has a required `coordinateSpace: 'universe' | 'hub-scene' | 'viewport-composition' | 'scroll-timeline' | 'camera'` discriminator (INV-21).
- **SC-044** [Phase 8] Keyframe trigger enum: `'load' | 'scroll' | 'hover' | 'click' | 'in-view'`.
- **SC-045** [Phase 8] Animation tab in Inspector exposes coordinate-space picker and trigger picker.
- **SC-046** [Phase 8] At minimum 3 keyframe primitives ship with this phase: a `load` fade-in, an `in-view` slide, a `hover` lift.

### Phase 9 — Animation library + node-to-node tether interaction

- **SC-047** [Phase 9] Animation library catalog UI in Inspector → Animation tab; preserves all three methodologies (frame-based/i2v, code-based, hybrid overlay) as distinct categories.
- **SC-048** [Phase 9] Library entries reference the 9 cinematic primitives from `CINEMATIC-PRIMITIVES-LIBRARY.md` (no new primitives invented — INV-12).
- **SC-049** [Phase 9] Tether-driven interaction: when an edge of type `'triggers'` fires from source node, the target node's bound animations run.
- **SC-050** [Phase 9] Tether-interaction respects coordinate space; one node animating in `hub-scene` can trigger a `viewport-composition` animation on a tethered node via the documented transform pipeline.
- **SC-051** [Phase 9] Physics/shader integration available for tether interactions where target node's `cinematicPrimitives` declares it (e.g., `displacement-transition` shader applied on tether fire).
- **SC-052** [Phase 9] Two-runtime snapshot proves tether-fire propagation across at least one tethered-node pair in the inner runtime.

### Phase 10 — Preview App (full multi-hub compile)

- **SC-053** [Phase 10] `compileAppToPreview(world, hubs, nodes) → CompiledAppView` aggregates per-hub compiles via Phase 6's `compileHubToPreview`.
- **SC-054** [Phase 10] `preview-app` mode renders all hubs in order with route-like navigation (URL or hash route maps to active hub).
- **SC-055** [Phase 10] Hub transitions are deterministic and cinematic (damped camera transit between hub-rail anchors).
- **SC-056** [Phase 10] Cross-hub tethers render in `preview-app`: edges that cross hub boundaries are visible during transition and resolved on arrival.
- **SC-057** [Phase 10] `App_Name_World` context is exposed at the `CompiledAppView` top level for app-wide state simulation.
- **SC-058** [Phase 10] Full `preview-app` compile does not mutate any hub or node source data (INV-17). **Verify:** byte-identical graph snapshot before/after compile.

### Round 2 — preview-app assembly + canvas editing + clone (v1.1)

These criteria are atomic for the EBR2 task list (groups A–G).

- **SC-064** [Phase R2-A] Default `viewMode` on app boot is `'preview-app'`. **Verify:** grep + Playwright snapshot.
- **SC-065** [Phase R2-A] `useGraphEditorStore.ViewMode` type contains exactly `'galaxy' | 'canvas' | 'preview-app'`. No other strings appear in the type or in setter call sites.
- **SC-066** [Phase R2-B] In `preview-app`, every node in the active hub renders at its compiled-anchor position via `CompiledHubView.nodes[]` → `liveResult.updateNodeTransform()`. The `visible` flag is respected (hidden nodes do not mount).
- **SC-067** [Phase R2-B] Preview-app background mounts at the correct size for the active responsive breakpoint and viewport-fixed attachment. No blank scene edges.
- **SC-068** [Phase R2-C] Inspector exposes an "Edit" button. Transform handles (`CanvasTransformGizmo`) render only when `editorMode === 'edit'` AND `viewMode === 'canvas'` AND a node is selected.
- **SC-069** [Phase R2-C] Dragging a transform handle in canvas mode visibly moves the node's rendered artifact in real-time (`AssembledSceneNode` composes `scenePosition + canvasTransform` for the rendered group, selection ring, and gizmo anchor).
- **SC-070** [Phase R2-C] Drei `TransformControls` scale mode (keyboard `s`) visibly resizes the node's rendered artifact via `canvasTransform.scaleX/Y/Z`.
- **SC-071** [Phase R2-D] In canvas mode, OrbitControls is constrained: `minPolarAngle`/`maxPolarAngle`/`minAzimuthAngle`/`maxAzimuthAngle`/`minDistance`/`maxDistance` are set from the active hub's content envelope + viewport-frame, and pan-target clamps prevent drift past the frame.
- **SC-072** [Phase R2-E] Inspector exposes "Save" and "Save and Rebuild" buttons. Inspector tab fader/knob writes route through `usePreviewStateStore` (not the source store directly); the renderer reads source ⊕ preview overlay so changes appear real-time.
- **SC-073** [Phase R2-E] "Save" copies preview-state → source store via `updateNode`, clears the preview-state buffer for that node, and lets the existing 1s debounced autosave flush to server.
- **SC-074** [Phase R2-E] "Save and Rebuild" performs Save + locates the mounted `THREE.Object3D` for the node, calls `object.userData.cleanup()`, re-invokes `createNode(config, ctx)`, and re-mounts at the same `scenePosition`. **Other nodes' `THREE.Object3D` references are stable** (verified by reference identity).
- **SC-075** [Phase R2-F] Inspector exposes a "Clone" button. Click: source-store gains a deep-cloned node (new id, suffixed caption); view auto-switches to `galaxy`; the clone is attached to a `draggingNodeId` slot on `useGraphEditorStore`.
- **SC-076** [Phase R2-F] On pointer-up after Clone-drag, the clone is committed: `parentHubId` updates to the nearest hub; caption/subtype reflect the new parent context; `draggingNodeId` clears.
- **SC-077** [Phase R2-F] During Clone-drag, a transient tether line renders from the cursor's world position to the nearest hub center (Euclidean distance via `hub-geometry.findNearestHub`). The tether snaps as the cursor crosses hub-bisecting planes.
- **SC-078** [Phase R2-G] Every Ralph task's verification includes a KripVerify pass against the live Vercel preview URL for the pushed commit. The pass: HTTP 200, no console errors, no failing network requests (4xx/5xx), captured `kv_screenshot` at `notes/ralph-snapshots/<task-id>/vercel-preview.png`.

### Universal SCs (every Ralph task)

- **SC-059** [All] Every task's commit passes `npm run typecheck` from `kid-kode-landing/` (zero errors).
- **SC-060** [All] Every task's commit passes `npm run build` from `kid-kode-landing/` (zero errors).
- **SC-061** [All] Every task's commit passes `npm run verify:prism` (the migration-aware verifier; gated by `.prism-editor-build-active` marker to run editor-build checks).
- **SC-062** [All] Every task produces a two-runtime snapshot at `kid-kode-landing/notes/ralph-snapshots/<task-id>/` containing `outer.png`, `inner.png`, `state.json`, `verify.log`.
- **SC-063** [All] Every task's `spec-reviewer` subagent run on HEAD returns no MUST-FIX items.

**Total: 63 success criteria.**

---

## 7. Invariants

### Carried forward from canonical specs (immutable through this build)

- **INV-01** — The graph IS the app. (V3 §1.3 #1)
- **INV-02** — Nodes are self-contained AND bipartite. (V3 §1.3 #2)
- **INV-03** — Contamination-aware repair. (V3 §1.3 #3)
- **INV-04** — Contract-first parallel generation. (V3 §1.3 #4)
- **INV-05** — Builds must never fail. (V3 §1.3 #5)
- **INV-06** — Bipartite DAG, not hub-and-spoke. (V3 §1.3 #7)
- **INV-07** — Images are textures; code is scene composition AND behavior. (Renderer-migration §2 inv 8 replaced; supersedes V3 §1.3 #8)
- **INV-08** — Wavefront execution. (V3 §1.3 #9)
- **INV-09** — Provider-agnostic inference. (V3 §1.3 #10)
- **INV-10** — Intent is first-class and persistent. (V3 §1.3 #11)
- **INV-11** — Renderer is Three.js `three/webgpu` with WebGL2 fallback; PixiJS forbidden in runtime bundles; TSL only, no raw GLSL. (Renderer-migration §2 INV 11)
- **INV-12** — Cinematic primitives are a curated fixed library of exactly 9 primitives (orbit, depth-rotate, dissolve-morph, displacement-transition, parallax-scroll, magnetic-cursor, particle-emerge, fly-through, kinetic-text). The codegen model selects by name; no scene-level animation authored from scratch. (Renderer-migration §2 INV 12)
- **INV-13** — Text uses the tiered approach: `sharp-svg` composited build-time for functional text; MSDF via `three-msdf-text-webgpu` for runtime dynamic text; FLUX prompts include "no text, no letters, no labels" in the negative prompt. `THREE.TextGeometry` is forbidden. (Renderer-migration §2 INV 13 + V3 §1.3 #6 carried forward)
- **INV-14** — `createNode` is synchronous, returns `THREE.Object3D`, and the returned object has `userData.cleanup()` that disposes geometries/materials/textures and kills GSAP timelines. (Renderer-migration §8)
- **INV-15** — No DOM access in runtime/node modules. `document.*` and `window.*` are forbidden except `window.devicePixelRatio`. (Renderer-migration rules + .claude/rules/prism-renderer-migration.md)

### Editor-build invariants (NEW)

- **INV-16** — Two runtimes verified per task. Every Ralph task must produce passing screenshots of the outer Next.js runtime AND the inner Prism runtime.
- **INV-17** — Non-destructive compile. `compileHubToPreview`, `compileAppToPreview`, "organize", and any function whose name matches `compile*|organize*|previewHub*|previewApp*` MUST NOT write to `node.scenePosition`, `node.editorTransform`, `node.canvasTransform`, or any `hub.layout` field.
- **INV-18** — Additive schema growth. No field rename, no field deletion, no required-field addition to `PrismNode`, `PrismHub`, `PrismRootNode`, `GraphSource`, or any persisted graph type.
- **INV-19** — Raw secret values never enter the client bundle or the visible graph. Only capability references appear in graph data. Resolution happens server-side via the vault.
- **INV-20** — Selection state (selectedNodeId, selectedHubId) survives every transition through any subset of the five canonical view modes. Camera pose may change per mode but is checkpointed and restorable.
- **INV-21** — Every keyframe declares its `coordinateSpace` from the canonical 5. No keyframe is space-agnostic.
- **INV-22** — Coordinate systems are never collapsed into one matrix without passing through the documented transform pipeline in `kid-kode-landing/src/lib/prism-graph/transforms.ts` (or equivalent).
- **INV-23** — Compiled-preview camera is constrained, damped, and bounded. The scene's edges and any blank background are never visible in `preview-hub` or `preview-app`.

---

### Round-2 invariants (v1.1)

- **INV-24** — Exactly 3 canonical view modes exist: `galaxy | canvas | preview-app`. New code referencing `'hub-world'` or `'preview-hub'` is rejected (FP-14).
- **INV-25** — The renderer is the **only** consumer of `canvasTransform` / `editorTransform` / `scenePosition` for visible node placement. Gizmo writes feed the source/preview stores; store reads drive the visual; no other coupling. Concretely: `AssembledSceneNode` (and any node renderer) MUST compose `scenePosition + canvasTransform` for its rendered group, ring, and gizmo anchor. Round-1 SC-042 (edits write only to `canvasTransform`, never `scenePosition`) remains; this invariant adds the read-path obligation.
- **INV-26** — Single-node rebuild is the only rebuild kind supported in-app. "Save and Rebuild" disposes (`userData.cleanup`) and re-invokes `createNode` for **exactly one** node, re-mounting at the same `scenePosition`. Full `.prism` artifact rebuilds remain a build-time operation (`npm run build:prism`) and are not invoked from inside the app.

## 8. Forbidden Patterns

Each is grep-testable. The patterns are enforced by `.claude/hooks/anti-drift-check.sh` (and its
mirror in `kid-kode-landing/.claude/hooks/`) when `.prism-editor-build-active` is present.

- **FP-01** — `\bfrom\s+['"]pixi|\bimport\s+\*\s+as\s+PIXI\b` — PixiJS imports forbidden in any file under `kid-kode-landing/src/**`. (INV-11)
- **FP-02** — `\bnew\s+THREE\.TextGeometry\s*\(` — TextGeometry forbidden. (INV-13)
- **FP-03** — `(?:inner|outer)HTML\s*=` — HTML chrome writes forbidden. (Existing renderer-era; preserved.)
- **FP-04** — Destructive position writes inside compile/organize/preview functions. Regex: a function whose name matches `compile\w*|organize\w*|previewHub\w*|previewApp\w*` containing on a subsequent line `\.(scenePosition|editorTransform|canvasTransform|compiledTransform)(\.[xyz])?\s*=`. (INV-17)
- **FP-05** — `\bdocument\.[a-zA-Z]|\bwindow\.(?!devicePixelRatio\b)[a-zA-Z]` in files matching `kid-kode-landing/src/lib/prism/runtime/**` or `**/nodes/**`. (INV-15)
- **FP-06** — Raw secret string literals: `(?i)(api[_-]?key|secret|token|password|client[_-]?secret)\s*[:=]\s*['"][A-Za-z0-9_\-./+]{16,}['"]` anywhere under `kid-kode-landing/src/**`. (INV-19)
- **FP-07** — `process\.env\.[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD)` accessed outside `kid-kode-landing/src/server/**` or a file whose first non-comment line is `import 'server-only'`. (INV-19)
- **FP-08** — Keyframe object literal without `coordinateSpace`. Regex: a multi-line block where `\bt:\s*[0-9.]+\b` and `\b(params|values)\s*:` appear within 8 lines AND `coordinateSpace\s*:` does not. (INV-21)
- **FP-09** — `\basync\s+(?:function\s+)?createNode\b|\bcreateNode\s*=\s*async\b` — `createNode` must be synchronous. (INV-14)
- **FP-10** — `\.style\.(background|border|boxShadow|backgroundImage)\s*=` — inline chrome writes forbidden. (Existing renderer-era; preserved.)
- **FP-11** — `useGraphEditorStore\.getState\(\)\.(selectedNodeId|selectedHubId|viewMode)\s*=` — selection state must mutate through actions. (INV-20)
- **FP-12** (v1.1 update — supersedes Round-1 form) — ViewMode literal strings outside the canonical **3**: `viewMode\s*[:=]\s*['"](?!galaxy['"]|canvas['"]|preview-app['"])[a-zA-Z\-]+['"]` in `kid-kode-landing/src/**`. (RA-06b) Legacy `'preview'|'editor'|'split'` AND `'hub-world'|'preview-hub'` are all rejected. The pre-v1.1 form is preserved as a historical note; the active hook regex is v1.1.
- **FP-14** (new in v1.1) — `\b(?:'|")(?:hub-world|preview-hub)(?:'|")` under `kid-kode-landing/src/**`. (INV-24) Direct literal mentions of the superseded modes are blocked at write time.
- **FP-15** (new in v1.1) — `useGraphSourceStore\.getState\(\)\.updateNode\b` in any file path matching `**/Inspector*.tsx` or `**/panels/*Tab.tsx`. (Phase R2-E) Inspector tab edits MUST route through `usePreviewStateStore` first.
- **FP-13** — FLUX/diffusion prompt without negative-text discipline. In any file matching `**/asset-pipeline/**` or `**/provision-*.mjs` or `**/generate-*.mjs`, calls to fal.ai / FLUX must include `"no text"` or `"no letters"` in the negative prompt within 20 lines. (INV-13)

---

## 9. Resolved Assumptions

Each assumption is settled. Loop tasks must not re-derive these.

- **RA-01 (D1, verbatim).** `App_Name_World` stores its spec, designSpec, buildPlan, memoryLog, hub registry, node registry, globalDependencies, validationRules, and aiRoutingRules as **real node data** inside the graph. Part of the actual graph/node, not a reference to external storage.
- **RA-02 (D2, verbatim).** The secrets vault is built for real in this loop — a real, working implementation, not a schema slot or placeholder. Capability-reference model holds: raw secret values never enter the client or the visible graph; the graph/nodes hold capability references; the vault stores and resolves the real secrets server-side with scoped, audited access. Placed at Phase 2.
- **RA-03 (D3, verbatim).** Keyframes declare their coordinate space. The valid set is determined by the camera + composition systems this loop builds. The set is fixed at §4 above (`universe | hub-scene | viewport-composition | scroll-timeline | camera`).
- **RA-04 (D4, verbatim).** ONE continuous Ralph loop covering all 10 phases. On kickoff it autonomously spawns a fresh session per task and does not stop until the entire plan is complete and verified. The session the user pastes `/kickoff-prism-editor` into is the MONITOR.
- **RA-05 (D5, verbatim).** The current `kid-kode-landing/docs/prism/` specs are the source of truth. THE PLAN applies only light modifications. Where conflict arises, the canonical invariant wins.
- **RA-06.** **View mode mapping.** Pre-existing `useGraphEditorStore.ViewMode = 'preview' | 'editor' | 'split'` maps to canonical 5 as: `editor → hub-world` (default), `split → canvas` (superseded), `preview → preview-hub`. `galaxy` and `preview-app` are net-new. `editorRenderMode = 'scene' | 'topology'` is preserved as a sub-toggle within `hub-world` mode. Codex's selection-preservation Codex shipped is retained.
- **RA-07.** **App_Name_World implementation.** A dedicated `PrismRootNode` interface co-exists with `PrismNode` in `GraphSource` (option B from gap analysis §3). Cleaner type discrimination than a `PrismNode` variant.
- **RA-08.** **Loop driver.** `kid-kode-landing/scripts/ralph.sh` is modified in place to invoke `/ralph-step-editor`. The renderer-migration chain is complete; `ralph-state.json` is backed up before replacement.
- **RA-09.** **Snapshot location.** `kid-kode-landing/notes/ralph-snapshots/<task-id>/` is the primary; `.kripverify/findings/screenshots/<task-id>/` is the KripVerify mirror.
- **RA-10.** **Activation marker.** `.prism-editor-build-active` at repo root is committed so a fresh clone activates the editor-build hooks correctly.
- **RA-11.** **Model contract file.** `.claude/.ralph-model` is reused (not a new `.editor-build-model`). The kickoff command writes the captured Opus model ID here.
- **RA-12.** **Skill loading.** The `prism-pixijs`, `prism-atlas`, and `prism-fal` skills are not used by this loop — they pre-date the renderer migration. `prism-architecture` is not loaded because the canonical specs at `kid-kode-landing/docs/prism/` are the authoritative source.
- **RA-13.** **Verification stack.** Playwright via `browser-smoke.mjs` patterns. No new browser stack introduced. `verify-prism.mjs` is extended with a sibling `verify-editor-runtimes.mjs` for the two-runtime snapshot.
- **RA-14.** **Migration marker coexistence.** `kid-kode-landing/.ralph-migration-active` remains in place; the renderer-migration hooks continue to enforce their invariants. The editor-build marker is additive — both can be active simultaneously and both sets of hooks fire.
- **RA-15.** **Edge type colors.** The existing `EDGE_COLORS` table in `GraphScene.tsx` is the deterministic source of tether colors. Phase 3 extends it only by adding category-specific entries for galaxy-mode hub-to-hub reasons; existing entries are not changed.

---

### Round-2 Resolved Assumptions (v1.1)

- **RA-06b (supersedes RA-06).** Canonical view modes reduced to `galaxy | canvas | preview-app`. Pre-existing `hub-world` callers fold into `canvas`; `preview-hub` callers fold into `preview-app`. `editorRenderMode = 'scene' | 'topology'` (Codex's Round-1 sub-toggle, EB-01-04) becomes a sub-toggle within canvas. `previousAuthoringMode` field on `useGraphEditorStore` is deleted — Round-2's preview-app default makes its sole consumer (preview-hub back button) obsolete.
- **RA-16.** "Save and Rebuild" = single-node visual artifact re-render only. Save persists; Save-and-Rebuild persists + `userData.cleanup()` + re-invoke `createNode(config, ctx)` for *exactly one* node, re-mounting at the same `scenePosition`. **Other nodes are not touched.** Full `.prism` artifact rebuilds remain a build-time operation (`npm run build:prism`) and are NOT invoked from inside the app.
- **RA-17.** Default `viewMode` on app boot is `'preview-app'`. The prototype IS the preview window of a future AI app builder; users care first about what the app looks like, then optionally toggle to `galaxy` or `canvas` to edit. When integrated into the AI builder, a streaming chat panel sits to the left of this pane.
- **RA-18.** Per-task verification gains a KripVerify pass against the live Vercel preview deployment URL for the pushed commit. The pass invokes `kv_navigate` → `kv_wait_for(canvas)` → `kv_screenshot(full_page=true)` → `kv_check_console(level='error')` → `kv_check_network(status_min=400)`. Artifacts persist to `kid-kode-landing/notes/ralph-snapshots/<task-id>/vercel-preview.{png,json}`. Failing KripVerify = task failure (worker stays `in-progress`; outer loop retries up to `maxAttemptsPerTask`).

## 10. Phased implementation plan

Each phase is a contiguous span of tasks in the Ralph loop. SC numbers indicate satisfaction
targets per phase. Atomic task ids use the form `EB-<phase>-<n>`.

**Phase 1 — single canvas + 5 canonical view modes** (SC-001..SC-004)
- Refactor `ViewMode` to canonical 5; map old labels per RA-06.
- Selection-preservation regression test across all 5 modes.
- Two-runtime baseline snapshot proving Codex's preview logic still mounts at `preview-hub`.

**Phase 2 — App_Name_World root + working secrets vault** (SC-005..SC-011)
- `PrismRootNode` typedef + serializer + validator.
- App_Name_World instance creation + inspector tab.
- Server-only secrets vault module (store + resolve + audit log) at `src/server/secrets/`.
- `capabilityRefs` field on `PrismRootNode` + optional on `PrismNode`.
- Client-bundle secret-leak integration test (grep + bundle analyzer).

**Phase 3 — Galaxy mode** (SC-012..SC-017)
- Orbit layout + size-by-complexity rule.
- LOD label tier + tether rendering.
- Filter overlay + multi-select.

**Phase 4 — Hub drill-in + node reveal + inspector** (SC-018..SC-021)
- Drill-in animation on `flyToHub`.
- Intra-hub LOD.
- Inspector tab preservation test across modes.

**Phase 5 — Canvas mode** (SC-022..SC-027)
- Camera pose contract; viewport frame + safe-area.
- 3D-depth preservation.
- Transform handles wired to `editorTransform` / `canvasTransform`.
- Round-trip selection/camera-pose test.

**Phase 6 — Preview Hub compiler / Viewport Composition Engine v1** (SC-028..SC-035)
- `CompiledHubView` type + `compileHubToPreview` pure fn.
- Anchor rule table.
- Cinematic camera rail.
- Viewport-relative background.
- Editor-clutter hide layer.
- Source-graph immutability proof (snapshot before/after).

**Phase 7 — Background layering + scroll-timeline + no blank edges** (SC-036..SC-040)
- `PrismHubBackgroundLayer` + attachment modes.
- Scale-to-cover / env-fog edge fill.
- `useScrollTimeline` hook + `scrollBinding` consumer.

**Phase 8 — Node transform editing + keyframe foundation** (SC-041..SC-046)
- Additive `editorTransform`/`canvasTransform` fields.
- `PrismKeyframe` with `coordinateSpace` discriminator.
- Trigger enum.
- Three baseline primitives (`load` fade-in, `in-view` slide, `hover` lift).

**Phase 9 — Animation library + node-to-node tether interaction** (SC-047..SC-052)
- Library catalog UI (three methodologies preserved).
- Tether-driven interaction over `triggers` edges.
- Cross-space tether resolution via documented pipeline.
- Physics/shader integration where declared.

**Phase 10 — Preview App (full multi-hub compile)** (SC-053..SC-058)
- `compileAppToPreview` aggregator.
- Route-like navigation across hubs.
- Cross-hub tether rendering.
- App-wide state surface via `App_Name_World` context.
- Multi-hub immutability proof.

---

### Round 2 — task groups A through G (v1.1, ~24 tasks on `prism-editor-build`)

EBR2-* ids; same branch, same `/ralph-step-editor` worker (Phase R2-G adds the KripVerify sub-step to the command itself).

- **Phase R2-A — view-mode reduction + default-mode flip (3 tasks; SC-064, SC-065)**
  - EBR2-A-01 Spec → v1.1 (this file).
  - EBR2-A-02 Reduce `ViewMode` type to 3; migrate callers; delete 5-button toggle; update FP-12 + add FP-14.
  - EBR2-A-03 Default `viewMode = 'preview-app'`; 3-mode round-trip selection/state preservation snapshot.

- **Phase R2-B — preview-app node assembly (4 tasks; SC-066, SC-067)**
  - EBR2-B-01 `resolveAnchorToScenePosition(anchor, hub, breakpoint)` in `compile-anchors.ts`.
  - EBR2-B-02 Plumb `CompiledHubView` (active hub) into `PrismHost` props.
  - EBR2-B-03 Node-layout effect in `PrismHost` mirroring camera-rail effect; calls `liveResult.updateNodeTransform`.
  - EBR2-B-04 Two-runtime snapshot proves full home-hub assembly (≥10 visible nodes) at preview-app boot.

- **Phase R2-C — canvas edit mode + transform-read fix (4 tasks; SC-068, SC-069, SC-070)**
  - EBR2-C-01 `editorMode: 'idle' | 'edit'` on store; "Edit" button in Inspector.
  - EBR2-C-02 Gate `CanvasTransformGizmo` on `editorMode === 'edit'`.
  - EBR2-C-03 `AssembledSceneNode` composes `scenePosition + canvasTransform` for rendered group + ring; scale/rotation applied.
  - EBR2-C-04 Re-anchor gizmo wrapper at composed position; snapshot proves node visibly moves on drag.

- **Phase R2-D — canvas camera guardrails (2 tasks; SC-071)**
  - EBR2-D-01 `canvas-camera-rail.ts` pure fn computing bounds from hub envelope + viewport-frame.
  - EBR2-D-02 Apply bounds to `SceneControlsBridge` for canvas mode; snapshot proves camera clamps.

- **Phase R2-E — Save / Save-and-Rebuild (4 tasks; SC-072, SC-073, SC-074)**
  - EBR2-E-01 `usePreviewStateStore` (new file).
  - EBR2-E-02 Inspector tabs write via preview store (FP-15 enforced); renderer reads source ⊕ preview overlay.
  - EBR2-E-03 "Save" button: preview → source via `updateNode`; debounced autosave flushes.
  - EBR2-E-04 "Save and Rebuild": Save + `userData.cleanup` + `createNode` re-invoke + re-mount at same `scenePosition`. Other nodes' `THREE.Object3D` refs stable.

- **Phase R2-F — Clone + nearest-hub snap (5 tasks; SC-075, SC-076, SC-077)**
  - EBR2-F-01 `hub-geometry.ts`: `getHubWorldPositions()` + `findNearestHub()`.
  - EBR2-F-02 `cloneNode(sourceId): newNodeId` action on `useGraphSourceStore`.
  - EBR2-F-03 "Clone" button in Inspector; auto-switch to galaxy; attach to `draggingNodeId` slot.
  - EBR2-F-04 Galaxy-mode drag listener: cursor → world position → nearest-hub computation; transient drag-tether render.
  - EBR2-F-05 Pointer-up: commit `parentHubId` + caption/subtype auto-update; clear `draggingNodeId`.

- **Phase R2-G — Vercel preview + KripVerify visual analysis (3 tasks; SC-078)**
  - EBR2-G-01 `kid-kode-landing/scripts/wait-for-vercel-preview.mjs` (poll Vercel API for deploy state).
  - EBR2-G-02 Extend `/ralph-step-editor` Step 8: invoke `kv_navigate` + `kv_wait_for` + `kv_screenshot` + `kv_check_console` + `kv_check_network`.
  - EBR2-G-03 Failing KripVerify = task failure; persist findings to `notes/ralph-snapshots/<task-id>/vercel-preview.{png,json}`.

## 11. Verification protocol

Every Ralph task must produce, in order:

1. `npm run typecheck` — zero TypeScript errors (run from `kid-kode-landing/`).
2. `npm run build` — Next.js production build succeeds.
3. `npm run verify:prism` — the migration-aware verifier (15 static + artifact checks; editor-build path added).
4. **Two-runtime snapshot** — Playwright drives the dev server through:
   - Outer route(s) named in `task.kvVerify.routes`. Capture `outer.png`.
   - Inner runtime in `preview-app` mode (v1.1; was `preview-hub` pre-v1.1) against the mock `.prism` artifact. Capture `inner.png`.
   - Write `state.json` recording `viewMode`, `selectedHubId`, `selectedNodeId`, camera pose.
   - Write `verify.log` recording per-step outcomes.
   - Artifact path: `kid-kode-landing/notes/ralph-snapshots/<task-id>/`.
   - Mirror: `.kripverify/findings/screenshots/<task-id>/`.
5. **Vercel preview KripVerify pass** (new in v1.1, RA-18). After Step 13 push, worker runs:
   - `node scripts/wait-for-vercel-preview.mjs --commit=<sha>` to resolve the live preview URL.
   - `kv_navigate({url})` → `kv_wait_for({selector: 'canvas', timeout_ms: 30000})` → `kv_screenshot({full_page: true})` → `kv_check_console({level: 'error'})` (must be empty) → `kv_check_network({status_min: 400})` (must be empty).
   - Persist `vercel-preview.png` + findings JSON to `notes/ralph-snapshots/<task-id>/`.
   - Failing KripVerify = task failure (worker stays `in-progress`; outer loop retries up to `maxAttemptsPerTask`).
6. **spec-reviewer subagent** invoked on HEAD; MUST-FIX items block the commit.

A failing screenshot is a task failure, never a warning. The snapshot's `state.json` is
compared against `task.kvVerify.compareTo` (a prior task-id) when set; otherwise the snapshot is
canonicalized as the new baseline.

The wired stack is **Playwright via `kid-kode-landing/scripts/browser-smoke.mjs` patterns**
(no new browser stack). The sibling `kid-kode-landing/scripts/verify-editor-runtimes.mjs`
implements the two-runtime capture; `verify-prism.mjs` invokes it when
`.prism-editor-build-active` is present at repo root.

---

## 12. Out of scope

Per THE PLAN, the following are **out of scope** for the editor-build loop:

- The AI app-builder pipeline / coding-model routing / parallel code generation.
- The self-healing / node-repair system.
- Image / 3D asset generation pipelines (FLUX, SAM, etc.).
- The backend template engine.

The secrets vault **is** in scope per RA-02. Structural seams for out-of-scope systems may be
added **only if** they are real, typed, used, and necessary — never as fake placeholders.
