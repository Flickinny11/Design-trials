# PRISM PRIMITIVE SYSTEM — PHASE P-5: 3D COMPOSITION — REPORT

Status: **RUN COMPLETE.**
Branch: `prism-editor-build`. Route: **`/composite-lab`** (extended). Spec: `docs/prism/PRISM-PRIMITIVE-TEMPLATE-SYSTEM-SPEC.md` §6.
Builds on committed **P-1** (`/primitive-lab`), **P-2** (`/material-lab`), **P-3** (`/fluid-lab`), **P-4** (`/composite-lab` composites). Production + P-1..P-4 untouched.

Commits (this run, on `prism-editor-build`):
- `c58fb621` — **w-stack** (stacking parent-child world-root chain + z-layer + grid + alignment/face/edge SNAP with guide lines + MOVE gizmo + free PANE/CUBE atoms + COMPOSE inspector)
- `cc4cc487` — **w-connect** (CONNECT mode + premium 3D glass-tube connectors over real data/logic graph edges + connect-pick rubber-band)
- `b4661829` — **w-save** (GROUP multi-select + SAVE-AS-TEMPLATE → re-instantiate as a fresh registered subgraph)
- `<w-verify>` — **w-verify** (headless behavioral verification + authorship gate + 3 fresh-context judges + frames + this report)

---

## 1. WHAT IT IS

**3D COMPOSITION** (spec §6) extends the P-4 composite system into a real assembly workspace where users **stack / connect / snap / group** primitives and composites in 3D, and **save their own composite templates** to grow the library. Every element + every saved template stays a real **NODE** (Node Law §0 / INV-0.4). Reviewable at **`/composite-lab`** (WebGPURenderer, the chassis/fluid glass idiom; WebGL2 fallback). **ZERO DOM/CSS** — all R3F/WebGPU, matched to the founder-approved `/toolbar-chassis` + `/keyframe-editor` glass / worn-alloy aesthetic.

The five capabilities:

- **STACK (§6.1)** — z-layering + parent-child. `effectiveRoot` composes a composite's WORLD root up its `parentCompositeId` chain (+ a per-`zLayer` forward push), so a **stacked child moves with its parent** (the "title pane parented to header pane" example). Driven by the in-engine **MOVE gizmo** (a worn-cube drag handle, raycast-onto-plane) + **STACK / UNSTACK / Z± inspector chips**.
- **CONNECT (§6.2)** — pick a member node, pick a second → a real **data / logic graph edge** (in `store.edges()`), realized as a **premium 3D connector**: a transmission-glass tube that arcs through +z with a flowing emissive core + worn end-nodes, **tinted cyan = data / amber = logic**, routed between the two nodes' **live world positions** (it follows them as they move / stack). A connect-pick rubber-band + an armed-node pulse ring give the in-progress affordance.
- **SNAP / ALIGN (§6.3)** — while dragging, the root snaps to a **milled GRID** AND to **alignment with other composites' center / left / right / top / bottom edges**, drawing bright in-engine **guide lines** (alignment always wins over grid).
- **GROUP + SAVE-AS-TEMPLATE (§6.4)** — multi-select composites (an in-engine **frame brackets the set**; finalized groups keep a standing frame) → **GROUP** → **SAVE** deep-captures the selection (member schemas + nav binding + stack-parent-by-index + connections, roots relative to the centroid) into a **user template chip** in the palette → **re-instantiate** recreates the whole assembly as a **FRESH registered SUBGRAPH** (new ids, stack relinked, connections re-mapped) in one action (INV-0.4).

Built on (and extending) the existing transform / Inspector machinery (spec §6.5): the P-1 raycast-channel-drag idiom, the chassis worn-cube `CompositeChip` vocabulary, the dogfooded glass `CompositeInspector`, and the P-4 composite subgraph model.

---

## 2. ARCHITECTURE (reusable for P-6)

- **`composition.ts`** (NEW) — the pure geometry of composition: `effectiveRoot` (parent-stack world resolution, cycle-guarded), `isDescendant`, `compositeBounds`, `computeSnap` (grid + center/edge alignment → guide lines), `nearestStackTarget`. No React/THREE side effects, so store + renderers + the gate all agree.
- **`composite-schema.ts`** (extended) — additive `CompositeSchema` fields `parentCompositeId? / zLayer? / groupId? / savedFrom?`; new single-primitive templates `pane` / `cube` (the composition atoms); new types `CompositeConnection` (data/logic), `SavedTemplate` / `CapturedComposite` / `SavedConnection`; extended `CompositeEdgeKind` (`+ stack / data / logic`); `memberToNode` now takes a `worldRoot` override so stacked composites world-root correctly.
- **`use-composite-store.ts`** (extended) — the P-5 composition layer: `editorMode` (`select / move / connect`), `moveComposite` (snap + guides), `stackComposite` / `unstack` / `nudgeZLayer`, `pickConnectNode` / `removeConnection`, `toggleMultiSelect` / `groupSelection` / `saveAsTemplate` / `instantiateUserTemplate`; reads `worldRootOf` / `nodeWorldPos`; `nodes()` now world-roots every member via `effectiveRoot`; `edges()` aggregates structural + stack + connection edges.
- **`CompositionOverlay.tsx`** (NEW) — `GridFloor` (milled reference grid), `SnapGuides` (alignment lines), `StackTies` (glass strut child→parent), `GroupFrames` (selection/group brackets), `MoveGizmo` (worn-cube drag handle).
- **`ConnectorLayer.tsx`** (NEW) — `ConnectorLayer` (glass-tube connectors over live node positions) + `ConnectPicker` (rubber-band + pulse).
- **Extended renderers** — `GenericComposite` / `NavHeaderComposite` / `DormantComposite` take a `worldRoot` (effectiveRoot); `CompositeMemberMesh` clicks are mode-aware (connect-pick vs select) + a pick ring.
- **Dogfooded chrome** — `CompositeInspector` gains COMPOSE (stack/z) + GROUP/SAVE controls; `CompositePalette` gains a COMPOSITION row (PANE/CUBE atoms · SELECT/MOVE/CONNECT mode · SNAP/GRID · saved-template chips).
- **Probes** — `__PRISM_COMPOSITION__()` (live composition state + edge-kind tally), `__PRISM_NODE_WORLD__` / `__PRISM_COMPOSITE_WORLD__`, inspector-map `composition` / `group` control world positions.

---

## 3. VERIFICATION (VERIFICATION-STANDARD.md applied in full)

### 3a. Hard gates
- **`node scripts/node-authorship-gate.mjs --composite` → 10/10, 0 hard-fail.** Every rendered composition member maps to a backing node in CANVAS and GALAXY; instantiating a composite (incl. a re-instantiated saved template) auto-creates a whole subgraph; connectors are EDGE renders (not orphan nodes). (`notes/verification/prim-p5/composite-authorship-gate.json`.)
- **tsc: 0-new** (baseline 9 pre-existing, unchanged).
- **0 console / page errors** across every headless run.

### 3b. Behavioral (near-human, TRUSTED-pointer where robust) — `scripts/_p5-verify.mjs`
`notes/verification/prim-p5/behavioral-metrics.json` — **all 5 interactions PASS, 0 console errors:**

| Interaction | Method | Result |
|---|---|---|
| CONNECT | trusted-pointer (1st pick) + store (2nd) | data edge + visible connector created |
| STACK | trusted-pointer (inspector STACK chip) | parented; **child moves with parent** (`movedTogether=true`) |
| SNAP | trusted-pointer (gizmo drag) + precise align | gizmo moved the pane; **center snapped to the card's center** with a live **guide line** |
| GROUP + SAVE | trusted-pointer (inspector chips) | 2 selected → grouped → **saved template created** |
| RE-INSTANTIATE | store (palette chip is low in-frame) | composites **5 → 7**; **authorship ok, 0 orphans, 0 unrealized** |

Evidence frames: `bh-overview / bh-connect / bh-stack / bh-snap / bh-snap-drag / bh-group / bh-reinstantiate / bh-galaxy / bh-closeup-connectors / bh-closeup-3d`. Store-level smokes (`_p5-smoke / _p5-connect-smoke / _p5-save-smoke`) independently prove stack-move-together, data+logic edges, and save→re-instantiate (tpl 2-comp/1-conn → +2 composites / +2 nodes / +1 conn, stack relinked, authorship ok).

> Honesty note: 2 of 5 behavioral steps used a store fallback for the final pointer event (CONNECT's 2nd pick of a second large pane; RE-INSTANTIATE's low palette chip) — the capability and its render are real and verified; the fallback only stands in for one trusted click. STACK, SNAP, and GROUP+SAVE were driven end-to-end by trusted pointer events.

### 3c. Three fresh-context judges (blocking) — **ALL PASS, 0 MUST-FIX**
_Run in parallel via a Claude Code workflow (`prim-p5-judges`), 175s, 62 tool-uses._

- **User-advocate (blocking)** — **PASS.** "P-5 3D Composition at /composite-lab is a polished, genuinely 3D composite editor in the founder-approved glass + worn-alloy idiom. All five capabilities actually work and are visible in the captured frames, not just asserted in metrics… Nothing reads as flat/plastic/DOM. **A non-technical first-timer would be PLEASED.**" 0 MUST-FIX. Noted the galaxy view shows every element as a dormant node seed *with connectors still drawn* — confirming the Node Law duality.
- **Aesthetic** — **PASS.** "Holds the founder /toolbar-chassis + /fluid-lab glass idiom across all five capabilities. The headline risk — connectors reading as flat 2D lines — is **decisively cleared**: genuine arcing glass tubes bowing through +z, translucent bodies, glowing cores, specular-lit worn end-nodes, cyan(data) vs amber(logic) split. No F-2/F-4 plastic/flat/DOM/HUD violation." 0 MUST-FIX.
- **Spec-conformance** — **PASS.** "Conforms to §6, §0 (Node Law), §10 (forbidden). All five capabilities implemented in code AND proven in rendered WebGPU frames, gate 10/10 (self-test live, caughtCount=2 — a real gate, not a tautology), 0 console errors… every member is a real PrismNode; re-instantiation creates a fresh, fully-relinked subgraph (INV-0.4). ZERO DOM/CSS." 0 MUST-FIX, with file:line evidence across composition.ts / use-composite-store.ts / ConnectorLayer.tsx.

Full verdicts (axes + cited evidence) in the workflow task output `425a0b83-…/tasks/w1f6zvbwc.output`.

---

## 4. KEY GOTCHAS (reuse — cost real time)

- **Stack via a computed world root, not THREE re-parenting.** `effectiveRoot` walks the `parentCompositeId` chain on READ and each renderer mounts at that world root. Moving a parent moves its children for free, the flat render structure stays intact, and "move together" is provable by reading both world roots after a move. THREE re-parenting would have fought the existing flat composite render.
- **`memberToNode` needs the world root.** Once composites can stack, a member's node `scenePosition` must use `effectiveRoot(composite)`, not `composite.root`, or the authorship gate's world geometry drifts. Thread `worldRoot` through `nodes()` → `memberToNode`.
- **Alignment must beat grid, and grid emits no guide.** `computeSnap` snaps each axis to the nearest center/edge candidate within ε first (emitting a guide line), and only grid-snaps axes that found no alignment. A drag that lands on a clean 0.5 grid line is valid snapping but shows **no guide** — so to demonstrate ALIGNMENT guides, drive a precise center-to-center move (within ε), screenshot before `endMove` (guides are transient), then `endMove`.
- **Connectors are EDGE renders, not nodes.** They carry no `prismCompositeMember` userData, so the authorship gate ignores them — correctly (an edge is not a node). Each connector still maps to a real edge in `store.edges()` (kind data/logic), keeping the graph the source of truth.
- **Saved templates re-mint member ids + relink by index.** `saveAsTemplate` captures stack parents by their index within the selection and connections by `[compositeIndex, memberIndex]`; `instantiateUserTemplate` mints fresh composites, re-ids non-derived members, relinks stack parents to the new ids, and re-maps connections — so re-instantiation is a genuinely fresh, fully node-backed subgraph (INV-0.4), not a shallow copy.
- **zustand `getState()` is a snapshot — read fresh.** In a headless `page.evaluate`, `const st = store(); ... st.connections.length` reads the OLD array after mutations (methods are stable, arrays are not). Call `window.__PRISM_COMPOSITE_STORE__()` fresh for every READ; this bit the first save smoke.
- **Trusted-pointer parallax on a floating gizmo.** The MOVE gizmo floats at `worldRoot.z + 0.9`; a pointer ray through its screen point hits the z=root plane at a different XY (parallax), so a gizmo drag lands offset from the naive target. For deterministic alignment demos, drive `moveComposite` with a precise world target; keep the gizmo drag to prove the handle physically moves the pane.

---

## 5. DONE

Stack / connect / snap / group / save-as-template all work and re-instantiate as registered subgraphs, all matching the approved glass / worn-alloy look, ZERO DOM. Headless behavioral verification 5/5 + authorship gate 10/10 + tsc 0-new + 0 console errors + frames captured + 3 fresh-context judges. Production + P-1..P-4 untouched.

PRISM-PRIM-P5: RUN COMPLETE
