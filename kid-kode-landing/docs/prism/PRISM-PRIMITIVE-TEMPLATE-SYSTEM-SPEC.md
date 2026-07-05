# PRISM — PRIMITIVE & TEMPLATE SYSTEM — CANONICAL SPEC (v1)
Status: ACTIVE. Owner: Logan. Drives: future ultracode build arc (after TOOLBAR + KEYFRAME land).
One line: **A library of customizable 3D building blocks for the canvas editor, where every block is a parametric, schema-driven NODE — geometry from numbers, photoreal materials, infinite via prompt-to-texture — composed/stacked/connected in 3D space.**

The glass pane and stone/metal cube button (built in the TOOLBAR/KEYFRAME arc) are NOT "the toolbar." They are PRIMITIVE #1 and #2 of this library. The chrome is dogfooded FROM the library.

---

## 0. PRIME INVARIANT — THE NODE LAW (non-negotiable, mechanically enforced)
INV-0.1  Every element a user adds to a build IS a node. No exceptions. Galaxy = the node UNBUILT (dormant sphere). Canvas/Preview = the node REALIZED (the 3D artifact in its space). One cannot exist without the other.
INV-0.2  The node is the SOURCE OF TRUTH; the visible 3D form is its realization. Editing the form edits the node's schema. There is no "visual-only" object.
INV-0.3  Instantiation is AUTOMATIC: dropping a primitive/template creates the node(s) and registers them in `live-graph.json` in the same action that renders them. No path renders a primitive without first creating its backing node.
INV-0.4  A composite/template creates a SUBGRAPH (multiple nodes + edges), all registered, in one action.
INV-0.5  ENFORCEMENT: `scripts/node-authorship-gate.mjs` FAILS the build if any rendered editor/canvas element lacks a registered backing node. Extend the gate's coverage to the instantiation pipeline. This law is not a promise — the gate holds it.

---

## 1. PILLAR — THE NODE-PRIMITIVE (the atom)
A primitive = a NODE whose realized form is a PARAMETRIC geometry + a MATERIAL, both driven by the node's schema. NOT a baked GLB (baked GLBs are reserved for organic/generated forms only).

1.1  PARAMETRIC, NOT BAKED. "reshape / resize / change thickness / corner radius / cutouts" are LIVE schema edits that rebuild the geometry instantly — never a mesh-regeneration job, never a re-download.
1.2  Geometry kinds (each parametric): Pane (extruded rounded-rect, parametric thickness + corner radius + cutouts[] holes — the reference's ExtrudeGeometry+Shape+Path-holes), Cube/Button (RoundedBox params), Sphere, Cylinder, Capsule, Frame/Ring, Plane, Custom-Extrude (user-drawn profile extruded), Text (engraved-into-surface via CSG / extruded / SDF).
1.3  Customization schema (the editable surface, per node): dimensions (w/h/d), thickness, cornerRadius, bevel, cutouts[] {shape, x, y, w, h, r}, subdivisions, materialRef, tint, contrast, transform {pos, rot, scale}, plus per-kind params. ALL exposed in the Inspector.
1.4  A primitive is a FULL node — it also carries caption/intent, position, animations, integrations, functions. A primitive can have behavior and data binding, not just be a dumb shape.
1.5  GEOMETRY TECH (current, 2026): parametric-first (Three ExtrudeGeometry / Shape / Path holes / RoundedBoxGeometry). three-bvh-csg (v0.0.18, gkjohnson, on three-mesh-bvh) ONLY for genuine booleans — engraving text into glass, milling complex grooves/cuts. Do NOT live-CSG things that parametric geometry handles (cutouts in a pane are parametric holes, not CSG).
1.6  All materials are TSL (Three Shading Language) node materials on WebGPU (r184+). TSL is mandated: it compiles to WGSL/GLSL and stays forward-current as the ecosystem moves.

---

## 2. PILLAR — THE MATERIAL SYSTEM (the skin)
A structured, layered library — massive curated list + INFINITE via prompt-to-texture.

2.1  Families: Metals (brass, steel, copper, gold, titanium, gunmetal, chrome + aged/worn variants), Stones (marble varieties, onyx, malachite, granite, travertine, lapis, slate), Glass (clear, smoke, frosted, tinted, liquid), Gems (ruby, sapphire, emerald, diamond, amber), Woods, Ceramics, Fabrics/Leather, Fluids (Pillar 3), Exotic (iridescent, holographic, soap-film, oil-slick, patina, bioluminescent).
2.2  Each material = a PARAMETRIC TSL node-material with editable params: baseColor/tint, roughness, metalness, clearcoat, transmission, IOR, thickness, sheen, anisotropy, normal/displacement strength, wear/patina amount. Real PBR + transmission + clearcoat so EVERY material refracts/reflects correctly under one shared HDRI/IBL environment.
2.3  PBR maps come from (a) the curated pre-generated sets (e.g. the worn oxblood/emerald/sapphire/bronze/gunmetal sets from the TOOLBAR arc) OR (b) PROMPT-TO-TEXTURE on demand.
2.4  PROMPT-TO-TEXTURE (REUSE the existing pipeline): user types a surface description -> generate a MATCHED PBR set. 2026 STANDARD, MANDATORY: all maps from ONE latent (physical consistency — the scratch in albedo matches the bump in normal matches the roughness change) AND delit (lighting separated out of albedo — Cook-Torrance/SVBRDF estimation). Tools available: Replicate/FLUX (tiling materials), Tripo (UV-aware object texturing — suits primitives), and the matched-delit approach proven by Meshy/Scenario/3DTexel/Patina/Hunyuan3D in 2026. This makes the material list effectively infinite.
2.5  Materials are a REUSABLE REGISTRY keyed by id; primitive schemas reference a material by id. A generated material is saved and reusable across primitives.

---

## 3. PILLAR — THE FLUID SYSTEM (the living material)
Customizable 3D fluids as a special material/primitive class, built on TSL + WebGPU compute.

3.1  IMPLEMENTATION (current path, "stays current"): TSL + WebGPU compute. Choose per element: MLS-MPM particle fluid (cf. threejs.org webgpu_compute_particles_fluid) for volumetric; screen-space velocity-pressure / simplified Navier-Stokes via TSL StorageTexture for surfaces; shader-driven flow surface for "liquid glass." Entire sim runs on GPU (no CPU round-trip).
3.2  Editable params (the customization surface): viscosity (togetherness), surfaceTension, flowSpeed, flowDirection/pattern, thickness/depth, turbulence/agitation, IOR/refraction, tint/opacity, damping, particleCount/scale, reactsToInteraction (cursor/scroll).
3.3  3D LIQUID GLASS is NOT a one-off animation. It is the fluid system applied to a transmission-glass surface (flow + warp + refraction on a parameterized timeline). ANY glass element can "go liquid" via these params. The nav dropdown expansion (Pillar 4) is one instance.
3.4  Fluids are still NODES (a fluid primitive = a node with a fluid material + params).

---

## 4. PILLAR — COMPOSITES & BOUND TEMPLATES (assemblies)
A composite template = a pre-assembled SUBGRAPH (primitive nodes + spatial parent-child relationships + edges), instantiated as a unit. Composites = subgraphs (the established bipartite-DAG model).

4.1  NAV HEADER (the canonical example): base pane node + title pane node (stacked) + N tab pane nodes (one per page) + dropdown node (liquid-glass). Every piece a real node, stacked in 3D, registered as a subgraph.
4.2  BOUND / REACTIVE (the menu answer): the nav's tabs + dropdown items are a DATA BINDING to the app's own HUB nodes. The graph already knows the pages (= hubs). The nav is a VIEW over the hub set.
   4.2.1  AUTO-POPULATE: on instantiation, read current hub nodes -> generate one tab + one menu item per hub. Pre-populated, zero wiring.
   4.2.2  EDITABLE: user can override — add / remove / reorder / rename tabs, pin manual (non-hub) items, hide hubs.
   4.2.3  AUTO-ADD TOGGLE: ON -> new hubs appear in the nav automatically as the user builds; OFF -> frozen to the current set.
4.3  Other composites (each a subgraph template): footer, sidebar, card, modal/dialog, dropdown, tab bar, list, grid, form + fields, hero section, CTA, pricing table, avatar+badge, accordion, carousel, toolbar (dogfood), keyframe track group (dogfood).

---

## 5. PILLAR — INSTANTIATION PIPELINE (the automatic node creation)
5.1  `instantiatePrimitive(templateId)`: create node (schema cloned from template) -> register in live-graph -> Galaxy shows it unbuilt -> Canvas/Preview realizes it via the existing node-realization (dormant-sphere -> built) path.
5.2  `instantiateComposite(templateId)`: create the subgraph (all member nodes + edges) -> register all -> realize the assembly.
5.3  Editing an instance in Canvas writes to the node's schema (single source of truth).
5.4  Gate (INV-0.5) verifies every instance has a backing node.

---

## 6. PILLAR — 3D COMPOSITION (stack / connect / snap / group)
6.1  STACK: z-layering + parent-child (title pane parented to header pane).
6.2  CONNECT: graph edges (data/logic) with visible 3D connectors.
6.3  SNAP/ALIGN: 3D snapping + alignment guides; grid + face/edge snap.
6.4  GROUP & SAVE-AS-TEMPLATE: multi-select a stacked assembly -> save as a NEW composite template. Users grow the library themselves. (Enhancement.)
6.5  Built on the existing transform/Inspector machinery (FIX2 Inspector + transform gizmo), extended.

---

## 7. PILLAR — LIBRARY UX (in-canvas, NO DOM)
7.1  A 3D-native library/palette (in the canvas, zero DOM/CSS/Tailwind/`<Html>`), browsable + searchable, each entry a live spinning 3D preview (same mechanic as the cube buttons).
7.2  Sections: Primitives (geometry) · Composites (assemblies) · Materials (skins incl. fluids + prompt-to-texture) · Saved (user's own).
7.3  Drag-to-canvas instantiates (-> node, Pillar 5). Select an instance -> Inspector exposes the full schema (Pillars 1-3).
7.4  DOGFOOD: the toolbar + keyframe editor + node-editor panels are rebuilt FROM these primitives. The glass pane in the node editor is literally the same Pane primitive a customer uses. ("Enough = not enough" made structural.)

---

## 8. TAXONOMY (build out over time; not exhaustive)
PRIMITIVES: Pane, Cube/Button, Sphere, Cylinder, Capsule, Frame/Ring, Plane, Custom-Extrude, Text, Icon (abstract 3D shape), Image-plane, Video-plane, Model-slot, Fluid-volume, Fluid-surface.
COMPOSITES: Nav header (bound), Footer, Sidebar, Card, Modal, Dropdown (liquid-glass), Tab bar, List, Grid, Form, Hero, CTA, Pricing table, Avatar+badge, Accordion, Carousel, Toolbar, Keyframe track group.
MATERIALS: see Pillar 2.1 + infinite via prompt-to-texture.

---

## 9. TOOLS / VERSIONS (current as of 2026-06; use these, not older defaults)
- Geometry: Three parametric (ExtrudeGeometry/Shape/RoundedBox) + three-bvh-csg v0.0.18 (booleans only).
- Shaders/materials: TSL (Three Shading Language) node materials, WebGPU, Three r184+. MANDATED (forward-current).
- Fluids: TSL + WebGPU compute (MLS-MPM / screen-space solvers). MANDATED path.
- Texture gen: prompt-to-texture via matched-latent + DELIT PBR (one latent, lighting stripped). Reuse existing pipeline; Tripo UV-aware for objects, Replicate/FLUX for tiling.
- Environment: one shared HDRI/IBL for correct refraction/reflection across all materials.

---

## 10. FORBIDDEN PATTERNS (gate-enforced where noted)
F-1  ANY element that is not a node. (node-authorship-gate FAIL)
F-2  ANY DOM / CSS / Tailwind / inline-style / CSS-module / drei `<Html>` in editor chrome or the library. (no-dom-ui-gate FAIL)
F-3  Baked-GLB-only primitives for clean geometric forms (panes/cubes/spheres must be parametric). Baked GLB allowed ONLY for organic/generated forms.
F-4  Glossy-plastic / toy "3D-icon-pack" materials. Materials must be real PBR/transmission, lit so texture reads (worn-metal/stone bar).
F-5  Stock/library icons of any kind. All icons custom 3D.
F-6  Emoji anywhere.
F-7  Independently-generated PBR maps (must be matched-latent + delit).
F-8  Live-CSG for things parametric geometry handles (perf + correctness).

---

## 11. BUILD PHASING (sequence; each phase reviewable by Logan)
P-0  (in progress) TOOLBAR arc — produces Pane + Cube primitives + worn-material library seed + engraved-glass technique. KEYFRAME arc — adds grooved-pane + small-cube (fader) + dogfood proof.
P-1  Primitive engine: parametric Pane/Cube/Sphere as nodes + Inspector schema (reshape/resize/thickness/material) + instantiation pipeline + gate coverage.
P-2  Material system: curated library + shared IBL + prompt-to-texture integration (matched-delit).
P-3  Fluid system: TSL/WebGPU fluid material + params + liquid-glass surface.
P-4  Composites: subgraph templates + the BOUND nav header (auto-populate/editable/auto-add).
P-5  3D composition: stack/connect/snap/group + save-as-template.
P-6  Library UX (in-canvas palette) + dogfood chrome rebuilt from primitives.

---

## 12. DONE = EVIDENCE (per the project law)
No phase is "done" on assertion. Done = rendered frames + gate outputs (node-authorship PASS, no-dom-ui PASS, tsc 0-new, 0 console errors) + Logan's eyes on the result. The autonomous agent never self-grades aesthetics.
