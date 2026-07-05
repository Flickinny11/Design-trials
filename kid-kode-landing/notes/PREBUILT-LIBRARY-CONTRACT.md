# PREBUILT ELEMENT LIBRARY — FROZEN CONTRACT (Phase 0)

> §13 of `docs/prism/PRISM-CANVAS-EDITOR-SPEC.md`. Criterion 21 (drag-to-place)
> + criterion 23 (builtSnapshot). This document is FROZEN at the Phase-0
> checkpoint. Phase 1 (UI) and Phase 2 (element definitions) build against the
> **typed** surface below; do not change the interfaces without re-freezing.

## 1. What a library entry is

A library entry = a **parameterized element-cluster**: a named, captioned set of
member nodes (positions / materials / lighting / default animationBindings) +
a hover-preview hint + a builtSnapshot poster. Drag-to-place instantiates the
cluster as a `groupId` subtree in the live graph, every member tethered to the
current hub (criterion 21, INV-7). Clusters are editable like any node group.

**No new graph field is introduced.** A cluster member is a *template* that
produces a valid `useGraphSourceStore.addNode` input — the exact shape
`src/components/editor/add-tools/create-element-node.ts` already returns. This
keeps the library additive-only (INV-8/INV-18) and topology-frozen (INV-1):
`groupId` is a contains-subtree marker, never an edge.

## 2. Typed surface (the frozen files)

| File | Exports | Role |
|---|---|---|
| `src/lib/editor/elements/contract.ts` | `ElementClusterDefinition`, `ClusterMemberTemplate`, `ClusterPreviewSpec`, `ElementCategory`, `ELEMENT_CATEGORIES`, `ELEMENT_CATEGORY_LABEL`, `CLUSTER_PREVIEW_DEFAULT` | The frozen cluster types. Every element definition is an `ElementClusterDefinition`. |
| `src/lib/editor/elements/registry.ts` | `registerElement`, `getElement`, `listElements`, `listElementsByCategory`, `listPopulatedCategories`, `elementCount`, `__clearElementRegistry` | The registry the browser + AI authoring draw from (mirrors `animatable/registry.ts`). |
| `src/lib/editor/elements/instantiate.ts` | `buildClusterNodeInputs(def, hubId, anchor, opts?)`, `clusterGroupId(def, genId?)`, `PlaceAnchor`, `ClusterNodeInput` | PURE drag-to-place: produces the `addNode` inputs (criterion 21). |
| `src/lib/editor/elements/catalog/index.ts` | (Phase 2) imports every definition + `registerElement`s it | The catalog barrel — one `import` registers the whole library, like `animatable/primitives/index.ts`. |

**Home is `src/lib/editor/**`** (editor scope) — NOT `src/lib/prism/**` (runtime
scope, where the dep-guard forbids `@/` alias imports). Element definitions may
`import type` from `@/lib/prism-graph/types` freely.

## 3. Member template → graph node (the build path)

A placed member flows through the **existing** path with no special handling:

1. `addNodesBatch(inputs)` (new, additive) creates one `PrismNode` per member in
   ONE commit (`applyPlanRendererDefaults` per input, single dirty-cycle + single
   autosave + single re-render). Returns minted ids in order.
2. The node renders via the same `createNode` / `runtime/factories/default-factory.ts`
   path Canvas uses (mesh / plane / parallax-plane / text / sprite by `renderMode`).
3. `src/lib/editor/node-content-hash.ts::computeNodeContentHash` keys its
   builtSnapshot; editing one member rebuilds only that member (**criterion 23**).
4. The integrated animation = `animationBindings` (catalog primitives by registry
   name) applied via `src/lib/prism/animatable/bindings.ts`. Stays fully swappable
   via the Animation Picker (§8.3). Binding ids are re-minted per placed node.

**Member field carry-through** (all real, editable `PrismNode` fields): `subtype`,
`serviceTag`, `renderMode`, `scenePosition` (= local `pose` + drop `anchor`),
`visual.transform` (from `footprint`), `intent.caption` (from `caption`),
`meshPrimitive`, `materialSpec`, `lightingSpec`, `receivesLighting`, `textSpec`,
`imageSpec`, `visual.sourceAsset` (from `sourceAsset`), `meshUrl`, `depthMapUrl`,
`animationBindings`, `scrollBinding`, `cinematicPrimitives`, `depthLayer`,
`groupId` (shared, when ≥2 members).

## 4. Store seams (additive — already wired in Phase 0)

- `useGraphSourceStore.addNodesBatch(inputs): string[]` — atomic multi-node create.
- `useGraphEditorStore`:
  - `libraryOpen` / `openLibrary()` / `closeLibrary()` — the root-mounted browser
    modal (mirrors the `changeArtifact*` mounting pattern; mount in `src/app/page.tsx`
    next to `<ChangeArtifactWizard/>`).
  - `placingClusterId` / `setPlacingCluster(id)` / `clearPlacement()` — drag-to-place
    slot. The placement layer keys on `placingClusterId` (analogous to
    `draggingNodeId` for clone-drag); the live tether reuses the generic
    `draggingPointerWorld` + `draggingNearestHubId` slots + `setDraggingPointerWorld` /
    `setDraggingNearestHub` (placement and clone-drag are mutually exclusive).
  - Hub resolution + nearest-hub: `src/lib/prism-graph/hub-geometry.ts::findNearestHub`
    (galaxy/universe space). On commit, call `addNodesBatch(buildClusterNodeInputs(
    def, hubId, anchor))` then `selectNode(ids[0])` (or group-select) + `clearPlacement()`.

## 5. Hover-preview contract (Phase 1 builds the renderer)

The library tile renders the **real cluster** (member nodes assembled via the
same node-build path) with its integrated animation looping — richer than the
single-subject primitive tiles (`PrimitiveTile`/`SharedViewport`/`shared-tile-renderer`).
Reuse the **shared-rig** architecture: ONE fixed full-viewport WebGPU canvas
behind the grid, each tile a transparent scissored window. `ClusterPreviewSpec`
(camera framing, `frozenPhase`, `loopSeconds`, `tier`, optional `posterUrl`) is
the hint the preview renderer consumes. Frozen at `frozenPhase` until hover →
plays the integrated animation on a `loopSeconds` loop. Bar: "EVEN MORE robust /
premium than the animation-primitive tiles."

## 6. Element-author checklist (Phase 2 — one subagent per element)

Each subagent authors ONE `ElementClusterDefinition` in
`src/lib/editor/elements/catalog/<id>.ts` and registers it in the catalog barrel.
Requirements (the BAR — must smash Slider Revolution):

- Photorealistic 3D: real `materialSpec` (metalness/roughness/transmission/
  clearcoat/iridescence) + `lightingSpec` opt-in so it reads photoreal standalone.
- DESIGN-REFERENCES techniques visibly at work (morph-through-3D, scroll
  choreography, distortion, cursor physics, …). List the entries used in `designRefs`.
- A default **integrated animation** (its own `animationBindings`).
- A smooth hover-preview (`ClusterPreviewSpec`).
- A caption + builtSnapshot (poster optional; live render is the fallback).
- Full customizability (every member is a real editable node).
- INV-9 tiering: full fidelity at `tier`, clean fallback to T0 (never broken).
- fal hero imagery (`sourceAsset`) only where photoreal imagery genuinely
  elevates the element — most photorealism is procedural PBR + lighting (free).

## 7. Invariants in force

INV-1 (frozen graph), INV-7 (built/unbuilt parity — placed nodes visible in
Galaxy), INV-8/INV-18 (additive schema), INV-9 (tiering), INV-11 (text is MSDF,
never diffusion), one renderer / no PixiJS, NO PURPLE, design-tokens-only styling,
never surface "fal" in user UI, secrets are capability refs only.

## 8. Proof (Phase 0)

- `tests/editor-build/PBLIB-instantiate.test.ts` — 7 tests green: tether, shared
  group, pose offset, field carry-through + binding re-mint, single-member skip,
  `addNodesBatch` lands grouped+tethered, single dirty-cycle.
- `tsc --noEmit`: 9 errors (baseline, 0 new).
