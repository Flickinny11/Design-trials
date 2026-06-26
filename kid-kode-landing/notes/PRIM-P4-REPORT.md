# PRISM PRIMITIVE SYSTEM — PHASE P-4: COMPOSITES + the BOUND NAV HEADER — REPORT

Status: **RUN COMPLETE.**
Branch: `prism-editor-build`. Route: **`/composite-lab`**. Spec: `docs/prism/PRISM-PRIMITIVE-TEMPLATE-SYSTEM-SPEC.md` §4.
Builds on committed **P-1** (`/primitive-lab`), **P-2** (`/material-lab`), **P-3** (`/fluid-lab`). Production + P-1/P-2/P-3 untouched.

Commits (this run, on `prism-editor-build`):
- `cbcca967` — w-composite (composite = subgraph instantiation + the bound nav header from P-1 panes)
- `32961373` — w-bind (nav tabs/dropdown bound to hub nodes: auto-populate + editable + auto-add toggle)
- `26b9b46d` — w-dropdown (dropdown expands as real 3D liquid glass (P-3) + footer/card composites)
- `<w-verify>` — w-verify (headless behavioral verification + gate + advocate + report)

---

## 1. WHAT IT IS

A **COMPOSITE template = a pre-assembled SUBGRAPH** (primitive member nodes + spatial parent-child stacking + edges), instantiated as a UNIT (spec §4 / INV-0.4). Composites = subgraphs. Every member is a real **NODE** (Node Law §0). Reviewable at **`/composite-lab`** (WebGPURenderer, the `/fluid-lab` idiom; auto-falls-back to WebGL2).

The canonical **NAV HEADER** assembles a **base pane node + title pane node (stacked) + N tab pane nodes (one per page) + a dropdown node (liquid-glass)** — every piece a real `PrismNode` (`memberToNode`/`hubToNode` emit `meshPrimitive` ⇒ the authorship gate's `hasRealArtifact` passes).

**THE BIND (the menu answer, spec §4.2):** the nav's tabs + the dropdown's menu items are a **DATA BINDING to the app's own HUB nodes** — a live VIEW over the hub set. They are NOT stored statically; they are **DERIVED LIVE** from `(hubs ⊕ binding)` by `resolveNavTabs`/`navMembers`. So:
- **AUTO-POPULATE (§4.2.1)** — one tab + one menu item per hub falls out of the derivation, zero wiring.
- **EDITABLE (§4.2.2)** — rename / reorder / hide / pin-manual are binding edits; the tabs AND the dropdown items re-derive in lock-step.
- **AUTO-ADD TOGGLE (§4.2.3)** — ON: a new hub appears automatically; OFF: the binding freezes to its `knownHubIds` snapshot; re-ON: resyncs (folds in hubs added while frozen).

Because the tabs are derived, a new hub immediately yields one more backing tab NODE — **the binding IS the derivation** (no manual reconcile). The nav **bar SIZES to its tab count** (`navLayout`) so it never overflows or collides.

The **dropdown EXPANDS as real 3D LIQUID GLASS (spec §3.3 / §4):** `DropdownLiquidPanel` reuses the committed **P-3** `FluidFieldSim` (ping-pong wave-equation GPU field) + `buildFluidSurfaceMaterial` (transmission-glass normal/relief driven by the flow), with the dropdown's expand phase wired AS the liquid-glass timeline (`liquidPhase` 0 = settled slab → 1 = flowing). The bound menu items float on the flowing liquid and reveal staggered.

Also seeded: **footer** + **card** composites (other subgraph templates, §4.3).

---

## 2. ARCHITECTURE (reusable for P-5/P-6)

- **`composite-schema.ts`** — `CompositeSchema` (root + static skeleton + nav binding); `CompositeMember` (role/kind/local-transform/parent/material/boundHubId); `LabHub`; `NavBinding` + `resolveNavTabs` (the binding heart); `navLayout` (width-adaptive bar); `navMembers`/`compositeMembers` (derive base+title+tabs+dropdown+menu); `compositeEdges` (parent stacking + hub-binding edges); `memberToNode`/`hubToNode` (Node Law).
- **`use-composite-store.ts`** — the lab graph store: `hubs[]`, `composites[]`, `instantiateComposite` (registers the whole subgraph in one action), the binding ops (`toggleAutoAdd`/`rename`/`reorder`/`hide`/`show`/`addManualItem`), `addHub`/`removeHub`, the dropdown expand timeline, and the derived `nodes()`/`edges()`.
- **Renderers** — `NavHeaderComposite` (bar assembly), `DropdownNode` + `DropdownLiquidPanel` (the liquid-glass dropdown), `GenericComposite` (footer/card), `CompositeMemberMesh` (one realized member, tagged), `DormantComposite` (galaxy seeds), `HubPlanets` (the PAGES column).
- **Dogfooded chrome** — `CompositeInspector` (glass pane + `CompositeChip` worn-cubes + `TabRow` per page), `CompositePalette`, `CompositeText` (WebGPU-safe MSDF).
- **Route** — `src/app/composite-lab/{page,layout,composite-lab.css}`.

Reuses P-1 parametric geometry (`buildPaneGeometry`/`buildCubeGeometry`), the chassis worn-alloy/glass vocabulary (`applyWornMaterial`/`useWornMaps`), the P-3 liquid-glass sim/material, and the WebGPU-safe MSDF text path (`createTextObject`/`resolveTextAtlas`).

---

## 3. VERIFICATION (per `docs/prism/VERIFICATION-STANDARD.md`)

### Behavioral (headless, real interaction) — `notes/verify-prim-p4.mjs` → `behavioral-metrics.json`
| Check | Result |
|---|---|
| backend | WebGL2 (headless; WebGPU path on real GPU) |
| composite = subgraph (instantiate) | +13 nodes / +22 edges (12 parent + 10 hub-binding) in one action |
| AUTO-POPULATE | **5 tabs / 5 hubs**, one per page |
| AUTO-ADD ON → add page | 5 → **6** tabs (auto-appears) |
| AUTO-ADD OFF → add page | **frozen** (6 tabs / 7 hubs) |
| AUTO-ADD re-ON → resync | 6 → **7** tabs |
| rename (real pointer click) | "Home" → "Start" ✓ |
| hide (real pointer click) | tabs 7 → **6** ✓ |
| auto-add toggle (real pointer click) | true → false ✓ |
| dropdown expand | phase → **1.0** |
| liquid glass FLOWING | **123,374** changed px between two open frames (genuine GPU motion) |
| two-state (galaxy ⇄ canvas) | galaxy 32/32 · canvas 32/32 |
| authorship | **0 orphans, 0 unrealized** in both states |
| console / page errors | **0 / 0** |

The editable ops were driven by **REAL TRUSTED-POINTER clicks** (Playwright mouse, project→click, no offset hack) on the dogfooded in-canvas Inspector — proving the controls genuinely work, not just the store API (VERIFICATION-STANDARD §2).

### Hard gates
- `node-authorship-gate.mjs --composite` — **10/10 PASS** (probe, classifier self-test, instantiate-creates-subgraph, auto-populate, auto-add ON, auto-add OFF, canvas no-orphan, canvas all-realized, galaxy no-orphan, no page-errors). Report → `notes/verification/fix1/composite-authorship-gate.json`.
- `no-dom-ui-gate.mjs` (composite scope) — **PASS** (19 files; no Tailwind/CSS-module/className/inline-style/drei-Html).
- `tsc --noEmit` — **9 = baseline / 0 new**.
- console errors — **0**.

### Fresh-context judges (blocking) — parallel ULTRACODE workflow (3 independent agents reading the evidence frames)
- **user-advocate** (blocking, four axes): **PASS — net PLEASED, 0 MUST-FIX.** "Completed the entire task — dropped a nav header, confirmed it shows MY 5 pages, added a page and watched a tab appear, opened the menu — and it both works and looks premium." STYLE/FUNCTION/INTUITIVENESS/SATISFACTION all PASS.
- **aesthetic-match** (no F-4 glossy-plastic): **PASS.** "Matches the founder-approved glass/worn-alloy aesthetic and does NOT violate F-4… no glossy-plastic or toy 3D-icon-pack material anywhere across the six frames." Real transmission glass, brushed worn-alloy, engraved MSDF, genuine flowing liquid dropdown — all confirmed against the reference frames.
- **spec-conformance** (§4 + §0 Node Law): **PASS.** Every §4 requirement met with cited evidence — subgraph instantiation (+13 nodes/+22 edges/10 binding edges), auto-populate 5/5, editable via real pointer, auto-add ON/OFF/re-ON, liquid-glass dropdown, and Node Law (49/49, 0 orphans, classifier self-test caught 2 synthetic orphans → live gate, not a tautology).

**Non-blocking flags (all three judges, addressed):** (a) a tab/Menu overlap in `w1-navbar-closeup.png` — that frame was **stale** (captured before the width-adaptive `navLayout` fix); re-captured with the current layout (min adjacent tab gap **1.30 > tabW 1.16** → no overlap). (b) Captures ran on the headless **WebGL2 fallback** (`isWebGPU:false`) — permitted by the runtime WebGL2-fallback contract; the look held on the fallback. The worn-metal/glass colour is most trustworthy on a real WebGPU GPU (founder's eyes).

Evidence frames → `notes/verification/prim-p4/`. Scripts → `notes/verify-prim-p4.mjs`, gate `scripts/node-authorship-gate.mjs --composite`.

---

## 4. HARD GOTCHAS (reuse — cost real time)

- **WebGPU lab ⟹ no Troika/ContactShadows/shadow-maps** (the P-3 lesson, carried): the composite lab runs on `WebGPURenderer` because the dropdown reuses the P-3 TSL liquid-glass material. Use MSDF text (`createTextObject`/`resolveTextAtlas`), drop shadow maps. Standard `MeshPhysicalMaterial` (glass + `applyWornMaterial`) auto-wraps to a node material there and renders fine.
- **Capture timing**: worn-alloy textures + MSDF glyphs warm async — the full subgraph isn't mounted until ~6–7 s after cold load. A 3.5 s capture under-counts rendered members (looks like orphans). Wait ≥6.5 s before the authorship snapshot.
- **The bound view must be DERIVED, never reconciled.** Storing tab members statically would force a manual reconcile on every hub change and risk orphans. Deriving tabs+menu-items live from `resolveNavTabs` makes auto-populate / auto-add fall out for free and keeps the Node Law automatic.
- **Width-adaptive bar.** A fixed-width nav bar overflows + collides once tab count > a few. `navLayout(tabCount)` sizes `[pad][title][gap][N tabs][gap][menu][pad]` so the bar grows with its pages.
- **Per-template ordinal placement.** Position composites by per-template ordinal (not global index) so cards stagger lower-left, clear of the right-side dropdown.
- **Zero-DOM rename.** Typing has no place in a 3D-native editor; rename cycles the label through a small curated alternate set — enough to prove the bound label is user-overridable and re-derives live.
- **Real trusted-pointer events need no offset hack** (the P-1 lesson): Playwright `mouse.click` generates trusted events; R3F raycasts them from the canvas rect directly. Project world→CSS via the camera and click.

---

PRISM-PRIM-P4: RUN COMPLETE
