# Prism Editor Build — Gap Analysis (plan vs spec vs codebase)

**Branch:** `prism-editor-build`  **Audit date:** 2026-05-14  **Author:** Arming session (Opus 4.7)

This file is the STEP 1 deliverable for the Prism Editor Build kickoff. It feeds STEP 2
(spec consolidation) and STEP 4 (Ralph task list).

Inputs consulted:
- THE PLAN + DECISIONS block (from the user's arming prompt, 2026-05-14).
- Canonical specs at `kid-kode-landing/docs/prism/`: `PRISM-ENGINE-SPEC-V3.md` (V3, §1.3 13 invariants, §1.9 bipartite), `PRISM-MOCK-APP-BUILD-SPEC.md` (mock build, §10 25 success criteria), `PRISM-RENDERER-MIGRATION-SPEC.md` (§2 invariants 11-13 NEW, §4 schema, §8 createNode), `CINEMATIC-PRIMITIVES-LIBRARY.md` (9 primitives, fixed library).
- `kid-kode-landing/docs/spec-deviations-prism.md` (578 lines, T01-T10 deviations).
- Recent commits (`git log --oneline -30`) and PRs (`gh pr list --state all`).
- Live codebase on `prism-editor-build`: `kid-kode-landing/src/app/page.tsx`, `kid-kode-landing/src/stores/useGraphEditorStore.ts`, `kid-kode-landing/src/components/editor/graph/GraphScene.tsx`, `kid-kode-landing/src/components/editor/panels/Inspector.tsx`, `kid-kode-landing/src/lib/prism-graph/types.ts`, `kid-kode-landing/src/lib/prism-graph/animation-keyframes.ts`.
- Harness state: `kid-kode-landing/notes/ralph-state.json` (HL01-HL15 harness-lockin chain, status `complete`).

---

## 1. Per-phase delta

Verdict scale: **DONE** / **SUBSTANTIALLY_DONE** (≥80% of atomic surface area) / **PARTIAL** (some scaffolding present) / **NOT_STARTED**.

### Phase 1 — Single canvas + 5 canonical view modes — **PARTIAL**

**Evidence (present):**
- Single 3D canvas + view-mode toggle implemented in `kid-kode-landing/src/app/page.tsx:7-106`.
- View-mode state lives on `useGraphEditorStore` (`kid-kode-landing/src/stores/useGraphEditorStore.ts:8`).
- Mode-switch selection persistence verified by store layout: `selectedNodeId`, `selectedHubId` set independently of `viewMode` (`useGraphEditorStore.ts:20-21, 102, 109-110`).
- Codex's "assembled editor scene mode" (commit `96fce6e`) adds `EditorRenderMode = 'scene' | 'topology'` (`useGraphEditorStore.ts:9`) and an `AssembledSceneContent` renderer (`GraphScene.tsx:1034-1108`).

**Delta against THE PLAN:**
- Current `ViewMode` is `'preview' | 'editor' | 'split'` (3-way toggle for layout), not the canonical 5 from THE PLAN (`galaxy | hub-world | canvas | preview-hub | preview-app`).
- Defaults to `'split'` (`useGraphEditorStore.ts:83`).
- The current `'editor'` viewMode is a *pane visibility* concept (which side renders); the canonical 5 are *scene composition* concepts (where the camera and graph content sit). The two systems don't fully overlap.

**Atomic deltas to close:**
1. Define a single canonical `ViewMode` type matching THE PLAN's five modes.
2. Migrate existing pane-toggle UI into a single canonical mode pivot; preserve existing preview logic behind `preview-hub`/`preview-app` gates without deletion.
3. Map `EditorRenderMode = 'scene' | 'topology'` either into the canonical pivot (`canvas` = scene-mode framing; `hub-world` = topology) or keep as a sub-mode within `hub-world`/`canvas`. Resolved Assumption RA-01 in the spec.
4. Two-runtime snapshot proves selection (selected hub + node + camera pose) survives a complete cycle through all 5 canonical modes.

### Phase 2 — App_Name_World root node + working secrets vault — **NOT_STARTED**

**Evidence (present):** None. No `App_Name_World` type in `types.ts`; no `secretRefs` field; no vault module under `src/lib/`; no server-only secrets store.

**Delta:** Everything. Phase 2 is greenfield.

**Atomic deltas to close:**
1. Add `App_Name_World` subtype to `PrismNode` (or a dedicated `PrismRootNode` discriminated union variant) carrying the D1 fields as real graph data.
2. Add a server-only secrets vault at `kid-kode-landing/src/server/secrets/` (or co-located via Next.js `server-only` imports), capability-reference model. Raw values never reach client bundles.
3. Add `capabilityRef` / `secretRefs` field to relevant `PrismNode` variants (additive optional).
4. Inspector tab to surface App_Name_World contents (reusing existing tab infrastructure, `Inspector.tsx:14`).
5. Integration test proving no raw secret string literal reaches any client bundle (grep + bundle analyzer check).

### Phase 3 — Galaxy mode — **PARTIAL**

**Evidence (present):**
- `HubNav` overlay exists (`kid-kode-landing/src/components/editor/overlays/HubNav.tsx`) and references a "Galaxy" label at L0 zoom per `TopBar`.
- Zoom-level enum exists: `ZoomLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4'` (`useGraphEditorStore.ts:6`).
- `flyToHub` / `flyToNode` queued camera commands implemented (`useGraphEditorStore.ts:127`; `GraphScene.tsx:714-759`).

**Delta:** No actual galaxy-mode rendering. No hub orbit around a root node. No size-by-complexity. No reason-colored animated tether lines. No global filters with greyed non-matches. No multi-select.

**Atomic deltas to close:**
1. Galaxy renderer: hubs orbit App_Name_World, positioned by deterministic layout fn.
2. Size-by-complexity rule: hub diameter = f(node count, depth).
3. Zoom-based label LOD inside galaxy mode.
4. Tether-line rendering with reason-colored, translucent, animated edges (extends existing `EDGE_COLORS` in `GraphScene.tsx`).
5. Global filter UI (overlay) + greyed/dimmed material treatment for non-matches.
6. Multi-select (state + visual treatment + inspector behavior).

### Phase 4 — Hub drill-in + node reveal + inspector — **SUBSTANTIALLY_DONE**

**Evidence (present):**
- `selectHub` / `selectNode` actions exist (`useGraphEditorStore.ts:109-110`).
- `flyToHub` / `flyToNode` queued and executed in `GraphScene` (`GraphScene.tsx:714-809`).
- Inspector opens on hub-select via `inspectorOpen: true` side effect of `selectHub`.
- Inspector tabs (visual/behavior/code/animation/connections/backend/history) present (`Inspector.tsx:14, 207-212`).

**Delta:** Drill-in is mostly wired. Missing:
1. The "drill-in" feel — nodes/background/tethers reveal animation specific to the hub-world transition. Currently fly-to triggers a camera change but doesn't fade in hub-specific layers.
2. Intra-hub zoom-based label LOD.
3. Validate inspector preserves all tabs across the 5 canonical modes (test).

**Atomic deltas to close:** 2-3 tasks — drill-in reveal animation; intra-hub LOD; inspector-mode-stability test.

### Phase 5 — Canvas mode — **PARTIAL**

**Evidence (present):**
- `editorRenderMode: 'scene' | 'topology'` exists and gates a scene renderer (`GraphScene.tsx:1106-1133`).
- `AssembledSceneContent` (`GraphScene.tsx:1034-1081`) renders nodes in a unified scene.
- "Single-hub editor framing" (commit `60c1eee`) centers the camera on the active hub.

**Delta:** Canvas mode (per THE PLAN) is the *normalized editable* 3D composition with viewport frame + safe-area bounds + transform handles. None of those exist yet.

**Atomic deltas to close:**
1. Viewport frame + safe-area bounds rendered as overlay geometry.
2. Center/face camera contract: deterministic camera pose for `canvas` mode.
3. Per-node transform handles (position/rotation/scale).
4. Inspector + keyframe tools reachable from canvas mode without losing scene context.

### Phase 6 — Preview Hub compiler / Viewport Composition Engine v1 — **NOT_STARTED**

**Evidence (present):** `PrismHost.tsx` mounts a hub for runtime playback (preview-style boot), but there is no *non-destructive compile* from hub graph → `CompiledHubView` object. `compiledToGraphSource` exists in `mount.ts` but it's the wrong direction (runtime→source).

**Delta:** The "heart of the prototype" is unbuilt.

**Atomic deltas to close:**
1. `CompiledHubView` TypeScript type (pure data; output of the compiler).
2. Compile function `compileHubToPreview(hub, nodes) → CompiledHubView` — pure, deterministic, no graph mutation.
3. Deterministic anchor rules: per-node type + metadata → viewport anchor selection.
4. Camera constraint engine for preview-hub mode (cinematic rails, damped, bounded).
5. Viewport-relative background sourced from the hub's `mockupUrl` (extends `PrismHubLayout.mockupUrl`).
6. Editor-clutter hide layer (overlays/handles hidden when `viewMode === 'preview-hub'`).
7. Verification: snapshot proves identical source graph positions before and after compile.

### Phase 7 — Background layering + scroll-timeline + no blank edges — **NOT_STARTED**

**Evidence (present):** `PrismHubLayout.mockupUrl` is a single backdrop image, not a stack with attachment modes. No `depthLayer`, no `scrollBinding` fields on PrismNode. No scroll-timeline system.

**Atomic deltas to close:**
1. Extend `PrismHubLayout.background` to a layered stack: `HubBackgroundLayer[]` with `attachment: 'viewport-fixed' | 'camera-locked' | 'parallax' | 'world' | 'infinite-environment'`. Additive — `mockupUrl` retained as legacy.
2. Renderer composes the layer stack per attachment mode.
3. Scale-to-cover + environment/fog fill so the scene never exposes blank edges in any view mode.
4. Scroll-timeline system: `scrollProgress: 0→1`; per-node `scrollBinding?` field; runtime drives bound transforms.

### Phase 8 — Node transform editing + keyframe foundation — **PARTIAL**

**Evidence (present):**
- `Inspector` has an `'animation'` tab (`Inspector.tsx:18`, 210).
- `PrismAnimationKeyframe[]` type exists, used inside `intent.animationSpec` (`types.ts:195-205`).
- `kid-kode-landing/src/lib/prism-graph/animation-keyframes.ts` provides timeline keyframe model with `KeyframeParams { scale, opacity, rotation, x, y }`.

**Delta:**
- No `editorTransform` / `canvasTransform` first-class fields on PrismNode — current scene placement uses `scenePosition` (renderer-migration era).
- Keyframes do not declare a coordinate space (per D3); current `KeyframeParams` is space-agnostic 2D-style values.
- Triggers `load | scroll | hover | click | in-view` not standardized as a typed first-class trigger system (some scattered references in `PrismTriggerSpec`).

**Atomic deltas to close:**
1. Add `editorTransform?` and `canvasTransform?` optional fields to `PrismNode` (additive).
2. Add `keyframes?: PrismKeyframe[]` as a first-class node field with mandatory `coordinateSpace` discriminator.
3. Define the valid coordinate-space set against Phases 5-7 outputs (per D3): `universe | hub-scene | viewport-composition | scroll-timeline | camera`.
4. Trigger system as a typed enum aligned with THE PLAN: `'load' | 'scroll' | 'hover' | 'click' | 'in-view'`.
5. Editable transform handles in canvas mode (cross-references Phase 5).

### Phase 9 — Animation library + node-to-node tether interaction — **PARTIAL**

**Evidence (present):**
- `PrismEdgeType = 'triggers' | 'state-update' | 'data-flow' | 'event-bubble' | string` (`types.ts:262`).
- Cinematic primitives library reference (`cinematic-primitives.ts`); 9 primitives per the canonical spec.
- Animation tab in inspector. `animation-keyframes.ts` provides timeline scaffolding.

**Delta:**
- No catalog UI for the animation library.
- No tether-driven node-to-node interaction (edges exist, but they're visual only — they don't drive one node's animation from another).
- The three distinct animation methodologies (frame-based/i2v, code-based, hybrid overlay — per `PRISM-MOCK-APP-BUILD-SPEC.md` §1.2.3) are present in spec but not curated as a library in the editor.

**Atomic deltas to close:**
1. Animation library catalog UI inside Inspector → Animation tab, organized by methodology.
2. Tether-driven interaction: when edge type is `'triggers'` or `'event-bubble'`, animations on source node propagate to target node per declared spec.
3. Integration with physics (when present) and shaders for photorealistic effect — defer specifics to Phase 9 tasks; spec-consistent baseline is GSAP timeline coupling.

### Phase 10 — Preview App full compile (multi-hub) — **NOT_STARTED**

**Evidence (present):** Single-hub mount via `PrismHost`. No hub-to-hub transition system; no app-wide state simulation; no compiled multi-hub output.

**Atomic deltas to close:**
1. `compileAppToPreview(world, hubs, nodes) → CompiledAppView` aggregating per-hub compiles.
2. Hub transitions (route-like navigation between compiled hub views).
3. Cross-hub tethers rendered through the compiled view.
4. App-wide state simulation surface (reads App_Name_World context).
5. Verification: snapshot proves source graph positions unchanged after a full multi-hub compile.

---

## 2. Conflicts (resolved in favor of canonical invariants per D5)

### C1. View mode taxonomy

**Tension:** THE PLAN canonicalizes `galaxy | hub-world | canvas | preview-hub | preview-app`. Codex shipped `preview | editor | split`. No canonical spec actually names the five-mode set; it is THE PLAN's contribution.

**Resolution:** THE PLAN's five-mode taxonomy is adopted because no canonical spec contradicts it. Codex's pane-toggle layout maps cleanly: `editor` → `hub-world` (default editor stance), `split` → `canvas` (editable composition view), `preview` → `preview-hub` (compiled cinematic view) with `preview-app` and `galaxy` as net-new. Recorded as RA-01 in the spec.

### C2. "Preview" semantics — compile vs render

**Tension:** Mock-build spec §10 frames "preview" as the live PixiJS render of a `.prism` artifact. THE PLAN's Preview Hub / Preview App are non-destructive *compiles* from graph data into an app-like 3D UI.

**Resolution:** The two are not equivalent. The renderer-migration spec already moved the runtime to Three.js/WebGPU; PixiJS is forbidden. `preview-hub` / `preview-app` modes drive the Three.js runtime against a deterministic compiled view of the graph (the `CompiledHubView` / `CompiledAppView` objects), without mutating source positions. The mock-build spec's success criteria §10.5-§10.9 (no `PIXI.Text`, three text methods, three animation methodologies) are preserved as invariants and reinterpreted against the Three.js runtime — see Invariant INV-13 carry-over.

### C3. `GraphNode` vs `PrismNode` naming

**Tension:** Renderer-migration spec uses `GraphNode`; this repo uses `PrismNode`.

**Resolution:** Continue to treat as synonyms (existing convention documented in `kid-kode-landing/docs/spec-deviations-prism.md`). Editor-build spec uses `PrismNode`.

### C4. Schema additivity

**Tension:** Multiple specs declare additive-only growth; THE PLAN proposes 9 new fields plus a hub.background restructure.

**Resolution:** All new fields are optional. `hub.background` becomes a layered stack but `mockupUrl` is retained as legacy. Invariant INV-15 (additive only) enforces this for the duration of the editor build. Existing graphs serialize without these fields and continue rendering via the renderer-migration defaults.

### C5. Camera modes vs renderer-migration "ctx" model

**Tension:** Renderer-migration §8 createNode contract gives each node a `NodeContext` that the hub manager wires up. THE PLAN's camera rig fixes (open-world vs cinematic rails) operate above the node level.

**Resolution:** Camera modes are a per-mode state external to nodes; `createNode` remains synchronous and ctx-driven (INV-06). Camera mode is a state of `useGraphEditorStore` consumed by the canvas root, not threaded through node modules.

### C6. Compile must not mutate source positions

**Tension:** No canonical spec explicitly forbids destructive compilation, but Codex's existing autosave (commit `4e9d7b5`) persists user-driven graph edits. A destructive compile would race with autosave.

**Resolution:** Invariant INV-09 (non-destructive compile) added. All `compile*` / `previewHub*` / `previewApp*` functions operate on cloned data; never write to source graph positions. Enforced as Forbidden Pattern FP-04.

---

## 3. Schema delta (additive only)

Current `PrismNode` (`kid-kode-landing/src/lib/prism-graph/types.ts:244-260`):

```ts
export interface PrismNode {
  nodeId: string;
  subtype: string;
  parentHubId: string;
  serviceTag: string;
  visual: PrismVisual;
  intent: PrismIntent;
  codeRef: string;
  backendRef: string | null;
  // renderer-migration additions (already present):
  renderMode?: RenderMode;
  depthMapUrl?: string | null;
  meshUrl?: string | null;
  cinematicPrimitives?: CinematicPrimitiveRef[];
  scenePosition?: ScenePosition;
}
```

**Editor-build additions (all optional, additive):**

| Field | Type | Notes |
|---|---|---|
| `editorTransform` | `EditorTransform?` | position+scale in hub-world mode |
| `canvasTransform` | `CanvasTransform?` | intermediate transform when in canvas mode |
| `compiledTransform` | `CompiledTransform?` | resolved final pose post-compile (cached; non-canonical) |
| `uiAnchor` | `UiAnchor?` | `'world' \| 'viewport' \| 'scroll' \| 'hybrid' \| 'sticky' \| 'parallax' \| 'camera-locked'` |
| `scrollBinding` | `ScrollBinding?` | drives transform from scrollProgress 0→1 |
| `depthLayer` | `'environment' \| 'background' \| 'midground' \| 'content' \| 'foreground-FX' \| 'overlay'?` | layered scene graph layer assignment |
| `keyframes` | `PrismKeyframe[]?` | first-class keyframes with mandatory `coordinateSpace` discriminator |
| `capabilityRefs` | `CapabilityRef[]?` | capability references to vault-managed secrets/services |

**Current `PrismHub`** (`types.ts:72-78`):

```ts
export interface PrismHub {
  hubId: string;
  title: string;
  caption?: string;
  layout: PrismHubLayout;
  responsiveBreakpoints?: PrismHubResponsiveBreakpoints;
}
```

**Editor-build addition:**

| Field | Type | Notes |
|---|---|---|
| `background` | `HubBackgroundLayer[]?` | layered stack; each entry has `attachment` mode; `layout.mockupUrl` retained for legacy single-layer reads |

**App_Name_World** is a *new* root-node concept. Two implementation options surfaced:
- **A:** Discriminated union variant of `PrismNode` (e.g. `subtype: 'app-name-world'`) carrying all D1 fields as `intent`/typed extension.
- **B:** Dedicated `PrismRootNode` interface that co-exists with `PrismNode` in `GraphSource`.

Resolved Assumption RA-02 in the spec selects **option B** (cleaner type discrimination; doesn't bloat `PrismNode`).

Fields on `PrismRootNode` (per D1, all real graph data):
- `appNameWorldId: string`
- `spec: AppSpec`
- `designSpec: DesignSpec`
- `buildPlan: BuildPlan`
- `memoryLog: MemoryLogEntry[]`
- `hubRegistry: HubRegistryEntry[]`
- `nodeRegistry: NodeRegistryEntry[]`
- `globalDependencies: GlobalDependency[]`
- `validationRules: ValidationRule[]`
- `aiRoutingRules: AiRoutingRule[]`
- `capabilityRefs: CapabilityRef[]` (vault references)

---

## 4. Codex progress credit (input to the loop, not to be re-implemented)

Concrete editor-side work shipped by Codex on `prism-editor-build` that the loop must **preserve**:

| Feature | Source | Status |
|---|---|---|
| Single 3D canvas + pane toggle | `kid-kode-landing/src/app/page.tsx:7-106` | Working — refactor into canonical 5 modes (don't delete) |
| `useGraphEditorStore` with `viewMode`/selection state + `flyToNode`/`flyToHub` | `kid-kode-landing/src/stores/useGraphEditorStore.ts:78-141` | Working — extend, don't replace |
| Selection persistence across mode switches | `useGraphEditorStore.ts:109-110` (selectHub/selectNode preserve each other only when explicit) | Working — preserved guarantee |
| Camera fly-to (queued command pattern) | `GraphScene.tsx:714-809` | Working — reuse in Phase 4 + Phase 3 |
| Inspector tabs (visual/behavior/code/animation/connections/backend/history) | `Inspector.tsx:14-18, 207-212` | Working — extend with App_Name_World tab in Phase 2 |
| Animation keyframe editor scaffolding (timeline + i2v frame scrub modes) | `Inspector.tsx:210`, `animation-keyframes.ts:1-119` | Working — extend with coordinate-space declaration in Phase 8 |
| Edge typing (`triggers`/`state-update`/`data-flow`/`event-bubble`) | `types.ts:262` | Working — used in Phase 9 tether interaction |
| Assembled editor scene mode (`editorRenderMode: 'scene' \| 'topology'`) | `GraphScene.tsx:1034-1133`, commit `96fce6e` | Working — maps into canonical modes per RA-01 |
| Debounced graph autosave | `useGraphSourceStore.ts` (commit `4e9d7b5`) | Working — must not be broken by compile pipeline (INV-09) |
| Single-hub editor framing | Commit `60c1eee` | Working — input to Phase 5 canvas-mode camera contract |
| Flagship runtime smoke stabilization | Commit `ce84202` | Working — input to two-runtime verification |
| Renderer audit guardrails | Commit `c141915`, `999f87d` | Working — extend in STEP 3 with editor-build FPs |
| WebGPU text factory explicit / WebGL-safe materials / live artifact build deterministic | Commits `cbf28ff`, `9ce0a33`, `0e47c6e` | Working — inputs to inner-runtime verification |
| `AddNodeDialog` UI | `kid-kode-landing/src/components/editor/overlays/AddNodeDialog.tsx` (HL13) | Working — extend for App_Name_World node creation in Phase 2 |

**Harness-lockin chain (HL01-HL15) completed.** Schema v1.1 in `ralph-state.json`. The harness infrastructure is the platform we build on, not work to redo.

---

## 5. Acceptance criteria for STEP 1

This audit closes when:
- ✅ Per-phase delta written above (10 rows, every phase has at least one atomic delta).
- ✅ Conflicts enumerated with resolutions referencing canonical invariants.
- ✅ Schema delta enumerated as additive-only with field-by-field shape.
- ✅ Codex progress credit listed by file path + commit sha so the loop knows what not to touch.
- ⬜ Drift-prevention proof appended in §6 below after STEP 3 (forbidden-pattern hook block captured).

---

## 6. Drift-prevention proof

The editor-build forbidden patterns (FP-01..FP-13 in PRISM-EDITOR-BUILD-SPEC.md §8) are enforced
by additions to `.claude/hooks/anti-drift-check.sh` and `kid-kode-landing/.claude/hooks/anti-drift-check.sh`.
Both hooks gate the editor-build checks on the `.prism-editor-build-active` marker at repo root
(present as of this session; tracked).

Enforcement was proven by feeding synthetic Write payloads to each hook and observing exit 2
with the FP-NN-named stderr message. **No scratch file was actually written to disk** — the hook
runs PreToolUse on the synthesized JSON; the same path it would take from a real Claude
Write/Edit. No revert required.

### Root hook (`.claude/hooks/anti-drift-check.sh`) — FP-01 (PixiJS import)

Input file: `kid-kode-landing/src/components/editor/__scratch_forbidden__.tsx`
Content: `import * as PIXI from 'pixi.js';`

```
anti-drift-check BLOCKED write to /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/src/components/editor/__scratch_forbidden__.tsx:
  - FP-01: PixiJS import forbidden (INV-11) — runtime is Three.js WebGPU. See PRISM-EDITOR-BUILD-SPEC.md §8.

References: mock spec §1.4; PRISM-EDITOR-BUILD-SPEC.md §8 (FP-NN); .claude/rules/prism-editor-build.md.
For legitimate mask/hit-area Graphics, add an 'ALLOWED-GRAPHICS:' comment within 3 lines of the call.
EXIT=2
```

### Root hook — FP-06 (raw secret string literal)

Input file: `kid-kode-landing/src/lib/__scratch_forbidden__.ts`
Content: `const apiKey = 'sk-abcdef1234567890ABCDEFGHIJK';`

```
anti-drift-check BLOCKED write to /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/src/lib/__scratch_forbidden__.ts:
  - FP-06: raw secret string literal forbidden (INV-19) — use capability references; resolve via server-only vault.

References: mock spec §1.4; PRISM-EDITOR-BUILD-SPEC.md §8 (FP-NN); .claude/rules/prism-editor-build.md.
For legitimate mask/hit-area Graphics, add an 'ALLOWED-GRAPHICS:' comment within 3 lines of the call.
EXIT=2
```

### Mirror hook (`kid-kode-landing/.claude/hooks/anti-drift-check.sh`) — FP-01

```
=== ANTI-DRIFT BLOCK ===
File: /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/src/components/editor/__scratch_forbidden__.tsx
  - FP-01: PixiJS import forbidden (INV-11) — runtime is Three.js WebGPU. See PRISM-EDITOR-BUILD-SPEC.md §8.

References: mock spec §1.4; PRISM-EDITOR-BUILD-SPEC.md §8 (FP-NN); .claude/rules/prism-editor-build.md.
If this is a false positive, fix the hook at .claude/hooks/anti-drift-check.sh.
EXIT=2
```

### Negative controls (must NOT block)

- **Clean Write** to `kid-kode-landing/src/components/editor/__scratch_clean__.tsx` with body
  `export function Foo() { return null; }` → `EXIT=0` ✓
- **Out-of-scope Write** to `notes/some-note.md` containing the literal text `PIXI.Text reference
  is fine here.` → `EXIT=0` ✓

The hook narrowly blocks Write/Edit into scoped paths and lets everything else through. No
real files were created in proving this.

