# PRISM FOUNDATION AUDIT — WAVE 1: INTEGRITY REPORT

**Date:** 2026-06-22 · **Branch:** `prism-editor-build` · **Mode:** READ-ONLY (no app code changed)
**Graph audited:** `kid-kode-landing/public/prism-mock/home/live-graph.json` (flat `nodes[]`, 331 nodes, 6 hubs)
**Method:** graph census (node script over live-graph.json) + 5 parallel read-only code-trace agents (Opus 4.8) over `src/`, every claim file:line-cited and spot-verified by the orchestrator.

---

## HEADLINE

**The runtime MODEL is sound; the marquee ARTIFACTS are not yet graph-native.**

- The 331-node body is genuinely **graph-native**: every node is tethered (`parentHubId`), every node carries a populated **`intent.caption`** (cold-model-readable), and every node renders through the graph-driven `ArtifactNode` path — text, mesh, and plane render modes are first-class **without** any `codeRef`. Headers, footers, nav, brand, and the static hero watches (s1/s2/s5) **are** nodes. 3D hub backgrounds are **hub-data** (`PrismHub.background[]`), which is *correct* per Ruler §1 ("Hub stores the page's background visual").
- **BUT** the three signature interactive 3D artifacts — the **configurator watch** (the literal hero of the whole app), the **orrery complication**, and the **hub-transition curtain** — are **hardcoded React/Three components imported directly into `GraphScene` and rendered as JSX siblings of the node map**, with **no graph node** and **no `codeRef`** driving them. This is a direct violation of the central invariant *"the graph IS the app; every element is a self-contained node."*
- Additionally, **7 nodes render nothing** (or the wrong shape): 6 ambience planes and 1 empty-text node produce no artifact in preview-app.

**Verdict:** `MOSTLY-SOUND-WITH-FIXES`, trending **`NEEDS-GREENLIGHT-REFACTOR`** for the centerpiece. The foundation's *substrate* is real and working; the foundation's *flagship content* (Phase 1/2/3 visual build) was shipped as hardcoded scene components rather than as nodes. Bringing the watch/orrery/transition into the graph is a **structural re-architecture** (NEEDS GREENLIGHT, see the Remediation Plan), not a safe mechanical fix.

---

## TRUE NODE COUNT & SHAPE

| Metric | Value |
|---|---|
| Total nodes in graph | **331** |
| Per hub | s1-arrival 37 · s2-movement 40 · s3-materia 62 · s4-celestia 41 · s5-acquire 49 · s6-atelier 102 |
| Nodes with populated `intent.caption` | **331 / 331** (100%) |
| Nodes with populated `intent.behaviorSpec` (interactions/apiCalls/dataBindings) | **0 / 331** |
| Nodes with populated `intent.contracts` | **0 / 331** |
| Nodes with non-empty `codeRef` | **0 / 331** |
| Visual source: procedural (`meshPrimitive`+`materialSpec`) | 193 |
| Visual source: text (`textSpec`) | 122 |
| Visual source: media (`meshUrl`/`imageSpec`) | 9 |
| Visual source: **none** (orphan — render nothing/wrong) | **7** |
| renderMode distribution | mesh 199 · text 123 · plane 9 |
| Hardcoded scene-content components rendered OUTSIDE the node map | **3** (watch, orrery, transition) + 2 headless controllers |

### Where the spec / caption lives (the "no `schema` field" question, answered)

There is **no field literally named `schema`** — that is why the quick signal read "zero schema fields." The per-node spec/caption lives in **`intent`**, which on every node carries:

- `intent.caption` — the human-readable, cold-model-readable description. **Populated on all 331 nodes.** ✅
- `intent.behaviorSpec` — `{ interactions, apiCalls, dataBindings, emits, listens, triggersDownstream }`. **Empty templates on all 331 nodes.** ⚠️
- `intent.contracts` — `{ inputs, outputs }`. **Empty on all 331 nodes.** ⚠️
- `intent.stateEffects`, `intent.visualSpec` — present, largely empty.

So the **caption** half of "a cold model can understand any node" is satisfied (storage + display + edit exist; all populated). The **behavior/contract** half is structurally absent in the live graph (the legacy seed `home-hub.legacy.json` *did* hand-author `behaviorSpec` interactions; the live 331-node graph dropped them).

---

## THE AUTO-CAPTION / SCHEMA-UPDATE MECHANISM — DOES IT EXIST?

**Answer: NO — and per the Ruler this is *intended-deferred*, not a foundation defect.**

- **Captions are static authored strings** set once at node-creation time. Each builder hardcodes a constant: `create-element-node.ts:48` (`'New element — blank bubble…'`), `create-object-node.ts:46` (`'New ' + kind`), `image-helpers.ts:149` (from filename), `AddNodeDialog.tsx:73` (user-typed). `behaviorSpec`/`contracts` are authored as **empty templates** at creation and **never populated** by any path.
- **On modify, nothing re-derives.** `useGraphSourceStore.updateNode` (`:467-475`) is a pure shallow merge `{...n, ...patch}`. Moving, recoloring, resizing, or swapping a node's artifact leaves `intent.caption` frozen and `behaviorSpec` empty. `usePreviewStateStore` (the live-edit buffer) is a dumb `Partial<PrismNode>` merge with no derivation. The only `describeNode`/`describeNodePatch` (`useGraphSourceStore.ts:293-317`) produce **undo-history labels** ("Move", "Rename") for the zundo timeline — never written back onto the node.
- A broad grep for `updateSchema|autoCaption|describeNode|annotate|regenerateCaption|generateCaption|qwen|llm` found **no caption/schema generator** in `src/`.

**Why this is not scored as a CRITICAL foundation violation:** the Ruler (`PRISM-INTENT-ANCHOR.md`) **§0** and **§9** state explicitly that the engine/harness and the **caption *format* + caption-driven repair are FUTURE work** ("the prototype needs caption *storage + display/edit*; the formal format is hardened later"; "the path does NOT exist yet" — §8). The prototype is required to *store, display, and edit* captions — which it does. Auto-regeneration on modify is a future-engine capability, correctly absent. **It is logged here as a HIGH-priority documented gap** (the behavior half is empty, and modify-staleness will mislead any future cold model), but it is on the deferred roadmap, not a broken-foundation item.

---

## INTEGRITY TABLE — element → { node? · tethered? · spec/caption field · media-or-code · in-graph-or-hardcoded }

| Element | Node? | Tethered? | Spec/caption field | Visual = media or code | In graph or hardcoded | Severity |
|---|---|---|---|---|---|---|
| **331 graph nodes** (text/mesh/plane) | yes | yes (`parentHubId`) | `intent.caption` ✅ (behaviorSpec ∅) | code-procedural (193) / text (122) / media (9) | **in-graph** via `ArtifactNode` | OK |
| Headers / footers / nav / brand (`shell-*`, `app-header`, `app-footer`, `nav-link`, `brand-wordmark`) | yes | yes | `intent.caption` ✅ | code-procedural (`meshPrimitive`) + text | **in-graph** | OK |
| Static hero watches s1/s2/s5 (`product-hero` → `watch.glb`) | yes | yes | `intent.caption` ✅ | **media** (`meshUrl` GLB) | **in-graph** | OK |
| 3D hub backgrounds (nebula + particle layers) | no (hub-data) | n/a (hub-level) | none (hub `background[]` config) | code-param (TSL driven by hub data) | **hub-data** (`PrismHub.background[]`, all 6 hubs) | OK¹ |
| `VolumetricNebulaLayer` (TSL raymarch) | no | — | — | code algorithm, **params from hub data** | hub-data-driven | OK |
| **`AtelierWatchRig`** — s6 configurator watch | **NO** | no | none | **code** (hardcoded GLB urls + procedural geo) | **HARDCODED** (`GraphScene.tsx:4169`) | **CRITICAL** |
| **`OrreryComplicationRig`** — s4 solar-system complication | **NO** | no | none | **code** (hardcoded `PLANETS[]` + procedural geo) | **HARDCODED** (`GraphScene.tsx:4171`) | **CRITICAL** |
| **`HubSceneTransition`** — brass-curtain hub transition | **NO** | no | none | **code** (in-component TSL material) | **HARDCODED** (`GraphScene.tsx:4397`) | **CRITICAL** |
| `AtelierApplier` — finish/text applier (headless) | no | no | none | none (returns null) | **HARDCODED** controller (`GraphScene.tsx:4164`) | HIGH² |
| `AtelierDragController` — drag-to-apply (headless) | no | no | none | none (returns null; procedural ghost chip) | **HARDCODED** controller (`GraphScene.tsx:4166`) | HIGH² |
| 6 ambience planes (`orr-arrival-dust`, `orr-movement-rings`, `orr-celestia-starfield/-galaxy/-orbits`, `orr-acquire-sweep`) | yes | yes | `intent.caption` ✅ | **none** (renderMode `plane`, no source) | in-graph but **artifact missing** | **CRITICAL³** |
| `orr-atelier-reason` (text node, `textSpec.content=""`) | yes | yes | `intent.caption` ✅ | **none** (empty text → empty Group) | in-graph but **artifact missing** | **CRITICAL³** |
| Legacy parallax backdrops (`bg-macro`, `bg-still`, `bg-planetarium`, `bg-gallery`, `atelier-bg-gallery`) | no (hub-data) | — | — | media (image plate, hub `background[]` w/ no `kind`) | hub-data, **split render path** | MED |
| Topology/galaxy lights, `Environment` HDRI, `WorldSun`, `Stars` | no | — | — | code (editor universe ambiance) | hardcoded editor-viz chrome | MED⁴ |
| Editor chrome (gizmos, viewport frame, marquee, diagnostics, driver hosts, `ChromeSlabLayer`) | no | — | — | code (authoring UI) | hardcoded — **correctly not a node** | OK |

¹ Backgrounds-as-hub-data is **correct** per Ruler §1 ("Hub stores the page's background visual"). They are hub-level config, not nodes, by design — flagged only because they are a parallel representation outside `nodes[]`.
² Headless behavior controllers with no own visual — but they live as hardcoded React outside the graph and reference **dead nodeIds** (`orr-atelier-watch-bezel/-crown/-case/-dial/-lug-*` in `src/lib/prism/atelier/config.ts:76,85,94,128`; iterated by `src/lib/prism/atelier/applier.ts:41`) that **do not exist** in the live graph. The behavior logic for the hero watch lives in code + a `window.__ATELIER_RIG__` imperative bridge, not in any node.
³ These ARE nodes (so not "renders-but-no-node") — the inverse defect: **node exists, artifact missing**. In canvas they render a generic stage-0 glass bubble (wrong shape); in preview-app they render **nothing** (`GraphScene.tsx:3168` returns null for stage-0 bubbles in previewMode; empty-text yields an empty Group).
⁴ Galaxy/universe-visualization ambiance is editor chrome, not built-app content; the s6 `Environment` HDRI is IBL (lighting-domain), not a content element.

---

## VIOLATIONS — by severity

### CRITICAL (renders scene content but has NO node, OR is a node whose artifact never renders)

**C1 — The configurator watch is not a node.** `AtelierWatchRig.tsx` renders the *entire* flagship watch (case + bezel + crown + dial + chapter ring + indices + hands + crystal + strap + exhibition movement) from **hardcoded GLB URLs** (`case-gen.glb`, `bezel-gen.glb`, `crown-gen.glb`, `tourbillon.glb`) + procedural geometry, dressed live from `useConfiguratorStore`. It is mounted as a hardcoded JSX sibling at `GraphScene.tsx:4169`, outside the `nodes.map` block (4147-4153). **Proof it is not a node:** s6-atelier's 102 nodes are 46 `atelier-swatch`, 19 `atelier-text`, 12 `nav-hit`, 6 `nav-link`, 4 `atelier-button`, + shell — **zero watch-part nodes**; a grep for any `watch-(case|bezel|crown|dial|…)` node across all 331 returns 0. *This is the single most central violation: the literal hero of the app is invisible to the graph.*

**C2 — The orrery complication is not a node.** `OrreryComplicationRig.tsx` hardcodes a `PLANETS[]` const (4 planets) + procedural sun/glow/rings/planets, time-driven by component refs + `window.__ORRERY__`. Mounted at `GraphScene.tsx:4171`. s4-celestia has an `orr-celestia-armillary` node (`gear-a.glb`) but the rig's clockwork solar system is a separate hardcoded layer with no node.

**C3 — The hub transition is not a node.** `HubSceneTransition.tsx` is a hardcoded React/Three component with its brass-curtain TSL material authored in-component, driven by `useHubTransitionStore`. Mounted at `GraphScene.tsx:4397`. No node, no `codeRef`. (The older DOM-overlay `HubMorphTransition.tsx` is **retired/dead** — `page.tsx:881-884` — and is inert.)

**C4 — 7 orphan nodes render nothing/wrong.** `orr-arrival-dust`, `orr-movement-rings`, `orr-celestia-starfield`, `orr-celestia-galaxy`, `orr-celestia-orbits`, `orr-acquire-sweep` (renderMode `plane`, no `sourceAsset`/`meshPrimitive`/`codeRef`) are treated as stage-0 bubbles → wrong-shape glass sphere in canvas, **nothing** in preview-app. `orr-atelier-reason` (renderMode `text`, `textSpec.content=""`) lays out zero glyphs → empty Group → **nothing** in every mode.

### HIGH

**H1 — Hero-watch behavior lives in hardcoded controllers + dead node refs.** `AtelierApplier` and `AtelierDragController` are headless controllers mounted outside the graph; `config.ts` (`:76,85,94,128`) and `applier.ts:41` target nodeIds (`orr-atelier-watch-bezel/-crown/-case/-dial/-lug-*`) that **are absent** from the live graph. The configurator's part/finish behavior is wired through code + a `window.__ATELIER_RIG__` imperative bridge, not through node behavior.

**H2 — No auto-caption/schema mechanism + empty behavior half.** Captions are static and never re-derive on modify; `behaviorSpec`/`contracts` are empty on all 331 nodes. *Per Ruler §0/§9 this is deferred future-engine work, so it is not a broken-foundation item — but it is the largest documented gap against the "schemas auto-update so a cold model can understand any node" target.*

### MED

**M1 — Backdrop render-path split.** Some hub `background[]` layers lacking a `kind` field route through `SceneBackdropLayer` (flat plate) rather than `HubBackgroundStack`; two background render paths coexist.
**M2 — Procedural vs generated-media gap.** Only 9 of 331 nodes use real generated GLB/image media; 193 are procedural primitives. The standing mandate calls for generated photoreal 3D objects — a **content-fidelity** gap (not an integrity violation; the nodes exist and render).
**M3 — Editor universe-viz ambiance** (lights/HDRI/sun/stars) is hardcoded; acceptable as editor chrome but un-parameterized.

---

## WHAT IS SOUND (so the remediation does not over-correct)

- The graph→scene render path is clean and graph-driven: `page.tsx → GraphScene (nodes.map) → AssembledSceneNode → ArtifactNode`. `ArtifactNode` renders text (MSDF), mesh (`meshPrimitive`), and plane render modes **without** any `codeRef` — procedural artifacts are first-class.
- All 331 nodes are tethered and captioned. Caption **storage/display/edit** (the prototype's required scope) works.
- Headers, footers, nav, brand, CTAs, the static hero watches, and the materia plates **are** nodes.
- 3D backgrounds are correctly hub-data; `VolumetricNebulaLayer` is parameterized by that data (code = algorithm, data = params) — the right shape for "code is behavior."
- Editor chrome (gizmos, frames, diagnostics, drivers, chrome-slab) is correctly **not** in the graph.

---

*End Wave 1 Integrity Report. Spec coherence → `AUDIT-SPEC-REPORT.md`. Fixes → `AUDIT-REMEDIATION-PLAN.md`. Summary → `AUDIT-MASTER-REPORT.md`.*
