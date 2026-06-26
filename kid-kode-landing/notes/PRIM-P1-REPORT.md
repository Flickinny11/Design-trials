# PRISM PRIMITIVE SYSTEM — PHASE P-1 — BUILD REPORT

**Status: RUN COMPLETE.** Branch `prism-editor-build`. Route **`/primitive-lab`** (isolated R3F WebGL, the toolbar-chassis idiom — never the unified three/webgpu graph scene). Production untouched.

One line: parametric, schema-driven **Pane / Cube / Sphere** primitives, each a real **NODE**, instantiated from an in-canvas palette and reshaped live by an in-canvas **Inspector** — in the founder-approved glass + worn-alloy chassis language, zero DOM.

---

## 1. What shipped (spec §1 + §5 + §0 + §7)

### Parametric geometry from schema numbers (§1.1 / §1.5 / F-3)
Geometry is GENERATED FROM SCHEMA NUMBERS and rebuilt LIVE on edit — never a baked GLB for these clean forms.
- **Pane** — `THREE.Shape` rounded-rect + `ExtrudeGeometry` with a milled front/back bevel and one `Path` HOLE per cutout (parametric, **not** CSG; F-8). Reuses the committed chassis `GlassPane` technique, generalized to w/h/thickness/cornerRadius/bevel/cutouts[].
- **Cube** — `RoundedBoxGeometry` (three-stdlib), parametric w/h/d + corner + segments.
- **Sphere** — `SphereGeometry`, parametric radius + tessellation.
- Files: `src/components/editor/primitive/primitive-geometry.ts`, `PrimitiveMesh.tsx` (live `useMemo` keyed on `JSON.stringify(params)`, geometry disposed on swap).

### Materials = the approved chassis set (§2 / F-4)
- **glass-*** (clear / smoke / tinted) → the `GlassPane` `MeshPhysicalMaterial` transmission look (real refraction off the shared studio IBL).
- **worn-*** (emerald / sapphire / bronze / oxblood / gunmetal) → `applyWornMaterial` + the 5 generated jewel-tone PBR sets (albedo+normal+rough+metal+ao). Worn brushed alloy, never glossy plastic.
- Shared studio IBL + AgX tone mapping + the chassis lighting rig → primitives MATCH `/toolbar-chassis` + `/keyframe-editor` by construction.
- File: `primitive-materials.ts`.

### NODE LAW — every primitive IS a node (§0, INV-0.1..0.5)
- The `PrimitiveSchema` is the single source of truth; `schemaToNode` emits a genuine `PrismNode` carrying `meshPrimitive` + `materialSpec` (the production node-authorship gate's `hasRealArtifact` keys on `meshPrimitive`). **Zero production-type changes** — `src/lib/prism-graph/types.ts` was NOT modified.
- `instantiate(kind)` creates the node AND it is rendered from the same store in the same action — one cannot exist without the other.
- **Two-state scene** (INV-R2): GALAXY shows every node UNBUILT (dormant seed sphere + engraved caption); CANVAS shows every node REALIZED. The mode toggle switches the whole set.
- Files: `use-lab-graph-store.ts`, `primitive-schema.ts`, `DormantNode.tsx`.

### Instantiation pipeline (§5) + in-canvas chrome (§7, dogfooded §7.4)
- **ADD PRIMITIVE** palette: a glass bar (a Pane primitive) with one worn-cube button per kind (hover-spin, engraved labels). Click → node created + realized.
- **GALAXY / CANVAS** mode toggle (active = emerald).
- Both built FROM the primitives themselves (the panel is a Pane, the buttons are Cubes).
- File: `PrimitiveChrome.tsx`.

### In-canvas Inspector — live reshape (§1.3 / §7, zero DOM)
- Select a primitive → the Inspector opens (the panel is a glass Pane with the fader channels milled as cutouts; controls are worn-cube fader knobs riding the channels — the keyframe vocabulary).
- Editing writes the node schema → geometry/material **rebuild instantly**:
  - fader channels per kind: Pane W/H/THICKNESS/CORNER/BEVEL · Cube W/H/D/CORNER · Sphere RADIUS/SEGMENTS · + material CONTRAST.
  - 8 material swatches (glass clear/smoke/tinted + 5 worn tones).
  - **ADD CUTOUT** (pane → mills a parametric rounded-rect hole) + **REMOVE**.
- `ClickCatcher` behind each glass panel so clicking the panel never falls through the transmissive glass to the backdrop and deselects.
- File: `Inspector.tsx`, `ClickCatcher.tsx`, `EngravedText.tsx`.

### Gate coverage (INV-0.5)
- `scripts/node-authorship-gate.mjs` extended with a **`--lab`** mode driving `/primitive-lab`: a primitive rendered without a backing node = FAIL. The probe `__PRISM_PRIM_AUTHORSHIP__` traverses the LIVE scene (`userData.prismPrimitive` + `prismNodeId`) and cross-checks the lab graph; a self-test proves a synthetic orphan WOULD be caught.

---

## 2. Verification — HEADLESS, behavioral, near-human (VERIFICATION-STANDARD in full)

All Playwright `chromium.launch({ headless: true })` — never a headed window on the founder's screen. Real pointer events (`page.mouse` click/drag projected from the live camera matrices).

### Behavioral (evidence: `notes/verification/prim-p1/full-metrics.json` + frames)
| Check | Result |
|---|---|
| Opens with pane/cube/sphere realized | 3 nodes, all rendered as backing nodes |
| Pane reshape (HEIGHT↑, CORNER↑) + smoke glass + 2 cutouts | vertices **11,748 → 32,928** (live rebuild), material→glass-smoke, cutouts 0→2 |
| Cube instantiate (palette click) + reshape | nodes **3→4**; bbox W 1.4→0.8, D 1.4→3.4 (live rebuild); material→worn-oxblood |
| Sphere instantiate + reshape (RADIUS, SEGMENTS) | nodes **4→5**; vertices 1225→220 (live rebuild); material→worn-gunmetal |
| GALAXY (unbuilt) | 5 dormant seeds, **0 orphans** |
| CANVAS (realized) | 5 rendered = 5 nodes, all realized, **0 orphans** |
| Console errors | **0** across the whole session |

### Gates
- `no-dom-ui-gate.mjs src/components/editor/primitive src/app/primitive-lab` → **PASS** (15 files).
- `node-authorship-gate.mjs --lab` → **7/7 ok, 0 hard-fail** (probe live, classifier self-test live, instantiate creates node, canvas 0 orphans + all realized, galaxy 0 orphans, 0 page errors). Report: `notes/verification/fix1/primitive-authorship-gate.json`.
- `tsc --noEmit` → **9 = baseline / 0 new** (all 9 are pre-existing GraphScene + test errors).
- `git diff` confirms `src/lib/prism-graph/types.ts` unchanged (additive-zero).

### Fresh-context reviews (both blocking, no build context)
- **user-advocate**: **PLEASED**, gate PASS, **0 MUST-FIX**. Axes — STYLE 4, FUNCTION 5, INTUITIVENESS 4, SATISFACTION 5. Cited frames for every claim. Nice-to-haves (all addressed or non-blocking): engraved chrome label legibility → **fixed** (deeper deboss contrast + larger + nearer front face); flatter background → **improved** (brighter studio backdrop + env 0.74); galaxy seeds plain (per-kind core tint already present).
- **spec-conformance reviewer**: **CONFORMS**, 0 MUST-FIX. All 7 checks PASS — parametric-not-baked, Node Law (gate fails on orphan), parametric cutouts (no CSG dep), zero DOM, custom 3D glyphs (no stock icons / no emoji), real PBR/transmission materials, production safety (types.ts untouched, isolated route).

### Evidence frames (`notes/verification/prim-p1/`)
`full-01-overview` · `full-02-pane-glass-cutouts` · `full-03-cube-reshaped` · `full-04-sphere-reshaped` · `full-05-galaxy` · `full-06-final-canvas` · `winspector-open/-fader-drag/-material/-cutout` · `wgeo-coldload/-rebuild` · `wnode-canvas/-galaxy/-after-click-instantiate` · `ref-toolbar-chassis` · `ref-keyframe-editor` (approved-look references) · `jpg/` (resized).

---

## 3. Files

New under `src/components/editor/primitive/`: `primitive-schema.ts`, `primitive-geometry.ts`, `primitive-materials.ts`, `PrimitiveMesh.tsx`, `DormantNode.tsx`, `PrimitiveChrome.tsx`, `Inspector.tsx`, `ClickCatcher.tsx`, `EngravedText.tsx`, `PrimitiveLabScene.tsx`, `use-lab-graph-store.ts`.
New route `src/app/primitive-lab/`: `page.tsx`, `layout.tsx`, `primitive-lab.css`.
Modified (additive only): `scripts/node-authorship-gate.mjs` (`--lab` mode).

## 4. Verify hooks (editor-chrome window; FP-05 does not apply outside runtime/node)
`__PRISM_PRIM_SCENE__` · `__PRISM_PRIM_STORE__()` · `__PRISM_PRIM_AUTHORSHIP__()` + `__PRISM_PRIM_AUTHORSHIP_SELFTEST__()` · `__PRISM_PRIM_CAM__.set(px,py,pz,tx,ty,tz)` · `__PRISM_PRIM_INSTANTIATE__(kind)` · `__PRISM_PRIM_PALETTE_POS__` · `__PRISM_PRIM_INSPECTOR_MAP__()`.

## 5. Deliberate decisions / deviations
- **Isolated lab graph store** (not the production `live-graph.json`): honors "do not touch production" while being faithful to the Node Law — every primitive is a real `PrismNode` and the gate enforces it. Phase work that wires primitives into the production graph is a later phase.
- **Pane → production `plane` `meshPrimitive` marker**: the node carries a coarse `meshPrimitive` so it is a real graph artifact; the full parametric detail (cutouts/bevel/cornerRadius) lives in the lab schema the renderer reads. Chosen to avoid extending production types (additive-zero).
- **`three-bvh-csg` not used** (not installed): cutouts are parametric `Shape.holes` per spec §1.5 / F-8.

## 6. Out of scope (later phases, per spec §11)
Material library + prompt-to-texture (P-2), fluids (P-3), composites + bound nav (P-4), 3D composition snap/group (P-5), the full in-canvas library palette + dogfood-rebuilt production chrome (P-6).
