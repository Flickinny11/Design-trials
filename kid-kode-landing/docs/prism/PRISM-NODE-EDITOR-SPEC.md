# PRISM NODE EDITOR — SPECIFICATION

**Status:** Canonical source of truth for the **Galaxy** mode and the **Node Editor** / **Hub Editor** surfaces, and for the **edit → save → build → verify → preview** path.
**Date:** 2026-06-05
**Codename:** Prism Node Editor v1
**Applies to:** Prism engine only. Cortex is out of scope.
**Ruler:** `Design-trials/PRISM-INTENT-ANCHOR.md` (v2). Where this spec conflicts with the anchor, the anchor wins.

> A build agent MUST read this document in full before writing code for galaxy navigation, node/hub presentation, the node editor, the hub editor, captions, or the edit→build→verify→preview path. This spec sits on top of the runtime substrate (`PRISM-RUNTIME-SPEC.md`) and is the sibling of the visual/spatial/animation surface (`PRISM-CANVAS-EDITOR-SPEC.md`). The boundary between this spec and the canvas spec is **load-bearing**: **purpose / function / behavior wiring lives HERE; visual, spatial, and animation authoring lives in canvas** (canvas-spec §1.3). This spec **supersedes** the node-editor and galaxy portions of `PRISM-EDITOR-BUILD-SPEC.md` (see §13 for line cites).

---

## 0. How to read this spec

- §1–§3 define scope, locked decisions, and invariants. Read first.
- §2 (galaxy camera rig) through §9 (the edit path) define behavior, surface by surface.
- §10 is the numbered atomic success-criteria checklist a build loop verifies against, each with observable evidence.
- §11 is the forbidden-patterns list (drift triggers).
- §12 lists items to re-verify against the live web at build time.
- §13 is the supersession table (what this spec replaces, with line cites into the archived editor-build spec).

---

## 1. Scope & boundaries

### 1.1 What this spec owns

- **Galaxy mode**: the free-navigation 3D map of the whole app — hubs (pages) with their tethered nodes orbiting — and its camera rig.
- **Node presentation** in galaxy (dormant spheres, labels, content icons, size).
- **Tethers**: the animated, color-coded lines binding node↔hub and node↔node.
- **The Node Editor panel**: a node's **purpose** (backend, functions, integrations, schema, data bindings, behavior, caption) + the **visual-section exception**.
- **The Hub Editor panel**: a page's background, page plan, per-node info, and captions; plus the `global` hub.
- **Caption storage / display / edit** in the prototype.
- **The one edit → save → build → verify → preview path**, including caption-driven cold-context repair.

### 1.2 What this spec does NOT own (the boundary)

- The **runtime substrate** (the unified scene, the three modes as states, the build action + pop-transition, the `builtSnapshot` cache, the `<app>_world` store) is owned by `PRISM-RUNTIME-SPEC.md`. This spec invokes that mechanic; it does not redefine it.
- **Visual / spatial / animation authoring** (transform editing, resize/rotate in 3D, the keyframe editor, the primitive catalog, the text system, lighting, materials, Rive, animation drivers) is owned by `PRISM-CANVAS-EDITOR-SPEC.md`. **There is NO visual-editor mode inside the node editor** (anchor §6, F7).
- **Canvas trigger buttons assign animation drivers only** — they do not wire app function/behavior. Wiring an element to *do* something (navigate, submit, call an API, toggle state, bind data) is a **node-editor** concern (canvas-spec §1.3, §8.2).

### 1.3 Frozen / out of scope

- **Graph topology is FROZEN** (INV-NE-1, mirrors canvas INV-1 / runtime INV-R10): galaxy editing never adds/removes/alters the bipartite-DAG rules, the node system, or its deps. Schema growth is additive only.
- The formal **caption format** is future work (anchor §0/§9, delivered with the unified Engine+Harness+Runtime spec). The prototype builds only caption **storage + display + edit**, not the formal schema.
- The **AI app-builder pipeline, codegen routing, diffusion asset generation, the backend template engine, the harness** are future-source (anchor §0).

---

## 2. Locked decisions (DECISIONS block)

1. **Galaxy is the only free-camera mode.** Mouse-drag + scroll reach any part of the node galaxy; clicking a hub or node flies the camera and **locks** at a set distance to that target. Deep zoom must reach **any** node (the current build's inability to zoom in far enough is a defect to fix — anchor §5).
2. **Node resting representation in galaxy = a dormant sphere** (node-state, runtime INV-R2 / decision 6). The sphere *is* the element in container form; **size ∝ contents**; the exterior label is the **built artifact's name**; small colored icons show what the node holds (integrations/functions) plus **one icon for visual type** (image / 3D / video / code-based). (anchor §1, §3a.)
3. **Clicking a hub** flies to it, reveals its orbiting tethered nodes, and slides the **Hub Editor panel** in from the right. **Clicking a node** opens the **Node Editor**. (anchor §3a, §5, §6.)
4. **The Node Editor edits a node's PURPOSE**, not its visuals: backend, functions, integrations, schema, data bindings, behavior, and caption. **Visual exception:** image / video / 3D artifacts appear in the node editor's read-only **"visual" section**; **code-based** artifacts do not appear there until built. Visual/spatial/animation editing → canvas (anchor §6).
5. **Tethers** are animated, thin, mostly-transparent, **color-coded** lines (reason-colored via the existing `EDGE_COLORS` table). They bind nodes to hubs and nodes to each other (by shared function/backend/relation). (anchor §1.)
6. **The `global` hub** holds elements shared across every page. Any element repeated on all pages is tethered to `global`. (anchor §1.)
7. **One edit path with verification built in** (Decision 3, anchor §8): edit → save → build the affected node(s) → **verify the artifact built, renders, and functions** → only then previewable. On build/verify failure, **fix at the moment of breakage** via caption-driven cold-context repair; never preview a broken state. The legacy `VisualPreview` regen-API path is **superseded → future-source** (engine-tier regeneration).
8. **Captions are stored, displayed, and editable** on every node and hub now; the formal caption format is hardened later (decision 1.3).

---

## 3. Galaxy mode — camera rig & presentation

### 3.1 Camera rig

- **Free navigation:** mouse-drag (orbit/pan) + scroll (dolly) reach any part of the galaxy. This is the unconstrained mode (runtime §6.1).
- **Click-to-zoom-and-lock:** clicking a hub or node flies the camera along a deterministic path and locks at a set distance to that target. Clicking a hub also reveals its orbiting tethered nodes.
- **Deep zoom reaches any node:** the camera can zoom in far enough to inspect any single node. (Fixing the current too-shallow zoom is a success criterion, NE-SC-03.)
- The fly-to queue is deterministic (reuse the existing `flyToNode` / `flyToHub` mechanism). Camera state is a store property consumed by the scene root; it is never threaded through node modules (runtime INV-R9).

### 3.2 Hub layout in galaxy

- Hubs (pages) orbit the `<app>_world` root. Hub positions are deterministic (a function of hub id hash + ring index).
- **Hub diameter scales with content complexity** (`f(node count, depth)`), deterministically.
- Zoom-based **label LOD**: far out, only `<app>_world` + hub names are visible; closer in, node-cluster labels and then node labels appear.

### 3.3 Node presentation (node-state)

A node in galaxy is a **dormant sphere** (runtime INV-R2). It carries:

- **Size ∝ contents** — a node holding more (more artifacts/code/data) is a larger sphere.
- **Exterior label = the built artifact's name** (e.g. "navigation menu").
- **Content icons** beside the label — small, colored, one per thing the node holds (e.g. a payment icon for Stripe functions; icons for other integrations/functions).
- **One visual-type icon** — image / 3D / video / code-based.

The dormant sphere is *not* a thumbnail of the built element; the built artifact appears only after an explicit Build, in canvas/preview-app (runtime §5).

### 3.4 Tethers

- Animated, thin, mostly-transparent, **reason-colored** lines (colors from the existing `EDGE_COLORS` table; additive entries only, never re-coloring existing reasons).
- Two relations: **node↔hub** (membership) and **node↔node** (shared function/backend/relation).
- Tethers are translucent and animated; they read as living connective tissue, not static wireframe edges.

### 3.5 Selection & filtering

- Click selects; shift-click multi-selects (the inspector shows a multi-selection as a group).
- A global filter overlay greys/dims non-matching hubs and nodes; matching items remain selectable.
- `selectedNodeId` / `selectedHubId` survive every mode transition (runtime §6.4).

---

## 4. The Hub Editor panel

Opens when a hub is clicked in galaxy; slides in from the **right** (sibling of the Node Editor). It edits the **page**:

- **Page background visual** — the hub's layered background stack, used when the hub builds. (The background *layer model* — `viewport-fixed | camera-locked | parallax | world | infinite-environment` — and its rendering belong to the canvas/runtime built-state; the Hub Editor is where the page's background is *chosen/assigned*.)
- **Page plan** — the page's intent/plan text for the AI builders.
- **Per-node info** — the list and role of every node tethered to this hub.
- **Captions / critical info** for the AI builders (§7).

The Hub Editor edits **page-level purpose/structure**; it is not a visual canvas. Visual authoring of the page's scene happens in canvas mode.

### 4.1 The `global` hub

- A dedicated hub holding elements shared across every page (global UI). Any element that repeats on all pages is tethered to `global`.
- The `global` hub appears in galaxy like any hub and has a Hub Editor panel; its tethered nodes render on every page's built state.

---

## 5. The Node Editor panel

Opens when a node is clicked in galaxy. Edits the node's **purpose**.

### 5.1 Purpose tabs (what gives a node meaning)

- **Backend** — the node's backend capability.
- **Functions** — what the element does.
- **Integrations** — third-party hookups (each surfaced as a content icon in galaxy, §3.3); secret access is via **capability references** only (runtime INV-R13), never raw values.
- **Schema / data** — the node's data shape and bindings.
- **Behavior** — how the element acts (the function/behavior wiring that canvas explicitly does NOT do — canvas-spec §1.3).
- **Connections** — the node's tethers (node↔hub, node↔node).
- **Caption** — the node's self-contained spec (§7), displayed and editable.

### 5.2 The visual-section exception

- The node editor has a read-only **"visual" section**. **Image / video / 3D** artifacts appear there (so the user can see what the node holds without building).
- **Code-based** artifacts do **not** appear in the visual section until built (there is nothing to show until the code runs in built-state).
- There is **no visual-editor mode** inside the node editor (anchor §6, F7). Moving, resizing, restyling, or animating an element happens in **canvas**.

### 5.3 Boundary with canvas (load-bearing)

- **Here (node editor):** make an element *do* something — navigate, submit, call an API, toggle state, bind data, choose integrations, define schema/backend. Make text *functional* (link, submit, scroll-to, data-bind).
- **In canvas:** make an element *look* and *move* — transform in 3D, resize, restyle, light, material, and **animate** (assign animation primitives + drivers). Canvas trigger buttons assign **animation drivers only** (Time/Scroll/Pointer/State/Event), never app behavior (canvas-spec §8.2, INV-6).

---

## 6. Node lifecycle as seen from the node editor

A node moves through runtime states (runtime §5; canvas §6 names the in-canvas sub-states). From the node editor's vantage:

1. A node has **purpose** (backend/functions/schema/behavior/caption) editable at any time, in any state.
2. The node editor can trigger **Build Node** (the runtime build action, runtime §5.2) once the node has a buildable artifact — invoking the pop-transition and caching.
3. Editing the node's purpose marks it **dirty**; a rebuild is required before its built-state reflects the edit (runtime §5.3, INV-R8 surgical rebuild).
4. Purpose edits never mutate the node's visual transform or graph topology (INV-NE-1).

---

## 7. Captions & `<app>_world` data

- Every **node** and **hub** carries a **caption**: a self-contained spec rich enough that a cold, context-free model can understand the element/page's intent, appearance, and behavior from the caption + the node's stored contents alone (anchor §9).
- The prototype provides caption **storage + display + edit** (in the Node Editor caption tab, §5.1, and the Hub Editor, §4). The **formal caption format** is future work (anchor §0/§9) and is NOT defined here.
- Captions power §9 repair and the future prompt-driven build. The `<app>_world` (runtime §8) stores app-level information in the shape those AI models need; the Hub/Node editors are where the human-editable parts of that world are surfaced.

---

## 8. Tether-driven interaction (node↔node behavior)

- Tethers are not only visual. A node↔node tether of an interaction type (e.g. a `triggers` edge) means: when the source fires, the target's bound behavior/animations run.
- Tether interaction respects the coordinate space of the target (the documented transform pipeline); a node animating in one space can trigger a tethered node's response in another. (Animation execution is the runtime's; the *wiring* of which node triggers which is a node-editor / connections concern.)

---

## 9. The edit → save → build → VERIFY → preview path (Decision 3)

The anchor (§8) states the current path "does nothing in practice" and must be rebuilt **with verification built in**. This is **one unified path**, not two parallel systems. (The legacy `VisualPreview` regen-API path is superseded → future-source.)

### 9.1 The path

1. **Edit** — a purpose edit (node editor) or a visual/animation edit (canvas) changes the node.
2. **Save** — the edit is committed to the source store (debounced autosave flushes to server). (Inspector tab writes route through the preview-state overlay first, then Save copies overlay → source — canvas/runtime store discipline.)
3. **Build the affected node(s)** — the runtime surgical rebuild (runtime §5.3, INV-R8): dispose + re-`createNode` for exactly the edited node, re-mount at the same coded position; update the node's `builtSnapshot` + content hash.
4. **Verify** — confirm the artifact **built, renders, and functions** correctly. A failing verify is a failure, not a warning.
5. **Preview** — only a verified node becomes previewable. A broken build is never previewed.

### 9.2 Caption-driven cold-context repair

- On any build/verify failure, dispatch a small internal model to that node. With **no prior context**, it reads the **node + hub captions** and the node's contents, understands what the node/hub should do/look like/function as, fixes the node, and **re-verifies**.
- This is one of multiple verification methods. It is **distinct** from the build-time drift-prevention that verifies Claude Code's edits to the Prism *codebase* — same philosophy, different layer.
- Contamination-aware (mirrors canvas INV-10): broken code is regenerated from spec/caption, never shown back to the repair model as-is.

### 9.3 One path, surgical

- Per-node / surgical rebuild — do not re-mount everything (runtime INV-R8). Update the cache (runtime §7) for the rebuilt node only.
- The path is unified across the node editor and canvas: a rebuild triggered from either surface uses the same mechanic and becomes visible in **the** scene (there is only one scene — runtime INV-R3/R4). There is no second preview surface to keep in sync.

---

## 10. Numbered atomic success criteria (verifiable)

> Each must be demonstrated with evidence (command output, screenshot, or runtime assertion).

1. **NE-SC-01** In `galaxy`, mouse-drag + scroll navigate freely; clicking a hub or node flies the camera and locks at a set distance to that target. **Verify:** scripted camera assertion (pose converges to target ± tolerance).
2. **NE-SC-02** Clicking a hub reveals its orbiting tethered nodes and slides the Hub Editor panel in from the right; clicking a node opens the Node Editor. **Verify:** screenshot + DOM/panel assertion.
3. **NE-SC-03** Deep zoom reaches any single node (camera can frame the smallest node). **Verify:** fly to the smallest node; assert it fills ≥ a threshold of the viewport.
4. **NE-SC-04** Each node renders as a dormant sphere whose **size scales with contents**, with an exterior label = the built artifact's name, content icons for integrations/functions, and one visual-type icon. **Verify:** screenshot + per-node assertion (radius monotonic in a content metric; label text == artifact name; icon set matches node contents).
5. **NE-SC-05** Tethers render as animated, translucent, reason-colored lines for node↔hub and node↔node relations (colors from `EDGE_COLORS`, additive only). **Verify:** screenshot + color-table assertion (no existing reason re-colored).
6. **NE-SC-06** The `global` hub exists; an element tethered to `global` renders on every page's built state. **Verify:** assertion that a `global`-tethered node appears across hubs.
7. **NE-SC-07** Shift-click multi-select shows the selection as a group in the inspector; a filter overlay dims non-matching items while keeping matches selectable. **Verify:** interaction test.
8. **NE-SC-08** The Node Editor exposes purpose tabs (backend / functions / integrations / schema / behavior / connections / caption); editing them never mutates the node's visual transform or graph topology. **Verify:** edit a purpose field; diff proves no `scenePosition`/`canvasTransform`/topology change.
9. **NE-SC-09** The node editor's visual section shows image/video/3D artifacts but shows nothing for a code-based artifact until it is built; there is no transform/animation control in the node editor. **Verify:** UI assertion per artifact type.
10. **NE-SC-10** Integration/secret access in the node editor uses capability references only — no raw secret value is entered or stored in graph data (runtime INV-R13). **Verify:** grep + schema assertion.
11. **NE-SC-11** A purpose edit marks the node dirty and requires a rebuild before its built-state reflects the change; the rebuild is surgical (one `createNode` call, sibling refs stable). **Verify:** edit → dirty flag → rebuild → one `createNode` call + stable sibling `THREE.Object3D` refs (shared with runtime RT-SC-09).
12. **NE-SC-12** Every node and hub stores an editable caption surfaced in the Node/Hub editor; edits persist and round-trip through save/reload. **Verify:** edit caption → reload → value persists.
13. **NE-SC-13** The edit→save→build→verify→preview path is single and verifying: an edit that fails to build/verify is NOT previewable; the failure dispatches caption-driven repair that reads node+hub captions and re-verifies. **Verify:** inject a failing edit; assert preview is blocked and a repair attempt fires with caption inputs.
14. **NE-SC-14** Only one edit/save/build path exists in the active app (the legacy `VisualPreview` regen-API path is not a second live path). **Verify:** code/route audit shows a single rebuild mechanic feeding the one scene. *(Removing the legacy path is a STEP-3 code action; this SC verifies the spec'd path is the one in use.)*
15. **NE-SC-15** No galaxy/node-editor change alters graph topology / the node system / its deps; schema growth is additive (INV-NE-1). **Verify:** diff.

---

## 11. Forbidden patterns (drift triggers — halt)

- **FP-NE-1** — A visual-editor mode inside the node editor (transform/resize/restyle/animate controls in the node editor). Visual authoring belongs to canvas. (anchor F7.)
- **FP-NE-2** — Wiring **animation drivers** to app **behavior**, or wiring app behavior in canvas instead of the node editor. (boundary §5.3; canvas-spec §1.3.)
- **FP-NE-3** — Rendering a node's built artifact in galaxy (galaxy is node-state / dormant spheres only — runtime INV-R2). (anchor §3a.)
- **FP-NE-4** — A node sphere that is a thumbnail/snapshot of the built element rather than the dormant container form. (anchor §1, F3.)
- **FP-NE-5** — Two parallel edit/save/build paths (e.g. the legacy `VisualPreview` regen-API path running alongside the unified path), or an edit path that doesn't build, doesn't verify, or previews a broken/unverified build. (anchor F4; Decision 3.)
- **FP-NE-6** — Re-coloring an existing tether reason in `EDGE_COLORS` (additive entries only) or making tethers static/opaque. (Decision 5.)
- **FP-NE-7** — Storing a raw secret value in a node's integration/schema fields instead of a capability reference. (runtime INV-R13.)
- **FP-NE-8** — Altering graph topology / node-system deps from a galaxy or node-editor action, or a non-additive schema change. (INV-NE-1.)
- **FP-NE-9** — Defining the formal caption *format* in the prototype (only storage/display/edit are in scope; the format is the future unified spec's). (anchor §0/§9.)

---

## 12. Re-verify at build time (training data is stale)

**No dependency version is hard-coded in this spec.** Confirm at build time:

- Current `@react-three/drei` controls API for the galaxy free-camera rig + deterministic fly-to (the `flyToNode`/`flyToHub` path).
- Best current approach for deep-zoom framing of a single small node (near-plane / dolly limits) without clipping.
- Current MSDF label rendering for node/hub labels at varying zoom (LOD), shared with the runtime text foundation (runtime §9).
- The small-model option for caption-driven cold-context repair (local in-browser VLM vs a cloud call) and its current best checkpoint — coordinate with canvas-spec §10 (local VLM re-caption) so repair and re-caption share one model story where possible.
- Whether the `EDGE_COLORS` table needs additive entries for any new galaxy-mode hub↔hub reasons.

---

## 13. Supersession table (what this spec replaces)

| Superseded text | Location (archived) | Replaced by |
|---|---|---|
| 5-mode taxonomy incl. `hub-world` (the node-editor default) / `preview-hub` | `archive/PRISM-EDITOR-BUILD-SPEC.md` (mixed 5/3, e.g. `:138`,`:283`,`:328` RA-06) | §1 + runtime §6 (galaxy is the editor map; canonical 3 modes) |
| Galaxy mode behavior (orbit layout, LOD, tethers, filter, multi-select) | `archive/PRISM-EDITOR-BUILD-SPEC.md` §6 Phase 3 (SC-012–SC-017, `:155`–`:160`) | §3 (re-homed + aligned to dormant-sphere presentation) |
| Hub drill-in + node reveal + inspector | `archive/PRISM-EDITOR-BUILD-SPEC.md` §6 Phase 4 (SC-018–SC-021) | §3.1, §4, §5 |
| Node editor as a surface that defaults to assembled/visual editing | `archive/PRISM-EDITOR-BUILD-SPEC.md` Phase-5 transform handles in editor (SC-025, `:174`) | §5.2/§5.3 + canvas-spec §1.3 (visual editing is canvas-only; node editor = purpose) |
| `App_Name_World` purpose/registry fields | `archive/PRISM-EDITOR-BUILD-SPEC.md` §3/RA-01 | runtime §8 (`<app>_world`); surfaced here via Hub/Node editors §4/§5 |
| Edit/save/rebuild as the Round-2 preview-store + legacy `VisualPreview` dual system | `archive/PRISM-EDITOR-BUILD-SPEC.md` RA-16 + the legacy regen path | §9 (one unified verifying path; legacy path → future-source) |

---

*End of PRISM-NODE-EDITOR-SPEC.md*
