# PRISM MASTER SPEC — the front-door

**Status:** Capstone / front-door. **Authoritative for** (1) the consolidated runtime-model summary, (2) the **ONE design law** (editor chrome + app content), and (3) the binding styleguide pointers. **Not a replacement** for the Ruler or the canonical-3 — it defers all runtime-truth to them.
**Date:** 2026-06-22 · **Branch:** `prism-editor-build` · **Compiled by:** PRISM Foundation Audit (Wave 2).
**Precedence:** This file sits *beside* `SPEC-INDEX.md` as the human entry point. Where it summarizes a canonical-3 clause, the canonical-3 wins on detail; where any spec conflicts with the Ruler, **the Ruler wins** (`../PRISM-INTENT-ANCHOR.md`).

> **Why this file exists.** The runtime model was already nailed in the Ruler + canonical-3, but the *design direction* was scattered across `ORRERY-NO7-VISION.md`, `DESIGN-REFERENCES.md`, `CINEMATIC-PRIMITIVES-LIBRARY.md`, and operator mandates — and it was **missing the one law that would have prevented the Wave-1 drift**: *every artifact is a node.* This file consolidates the design law, adds that missing law, and points at the authoritative runtime specs. Read `SPEC-INDEX.md` for full precedence and `AUDIT-INTEGRITY-REPORT.md` for what the current build violates.

---

## PART A — THE RUNTIME MODEL (authoritative source = Ruler + canonical-3; this is the summary)

> Full truth: `../PRISM-INTENT-ANCHOR.md` (Ruler), `PRISM-RUNTIME-SPEC.md`, `PRISM-NODE-EDITOR-SPEC.md` (+ `-V2`), `PRISM-CANVAS-EDITOR-SPEC.md`. Citations below are into those files.

1. **The graph IS the app.** There is no file system. The node graph holds everything a traditional app keeps in files. When every node tethered to a hub has built, the assembled result *is* the running page — there is no separate compile-to-a-page step (RUNTIME §5.1, INV-R5; Ruler §0/§1).
2. **A node is a self-contained element.** Identity + its artifact(s) (3D object / image / video / **code-based artifact**) + code + animations + **schema/data** + backend + integrations + functions + tether points + target 3D position + behavior + its **caption**. Node size is relative to contents. It *is* the element, not a picture of it (Ruler §1).
3. **Every node is tethered to a hub** (`parentHubId`). A **hub** is a page; it stores the page's **background visual**, plan, the list/role of its tethered nodes, and the build-critical captions. The **`global` hub** holds elements shared across every page (Ruler §1; this is why 3D backgrounds are **hub-data**, `PrismHub.background[]`, not nodes — and that is correct).
4. **Code is behavior, not UI elements.** Visible UI identity comes from generated images used as textures, generated meshes/splats, or code-driven MSDF text. **Code positions, composes, animates — it does not hand-draw visible UI primitives** (CANVAS §2-dec-2 / INV-3; kid-kode CLAUDE.md invariant 8: "images are textures; code is scene composition AND behavior").
5. **Two-state model (INVARIANT).** A node is in exactly one state: **node-state** (dormant sphere in galaxy) **XOR** **built-state** (the literal artifact at its coded 3D position, running its code). Never both (Ruler §2; RUNTIME INV-R2/FP-R2).
6. **Built modes render the LITERAL artifact — never a copy, thumbnail, pre-rendered image, or empty-Group stand-in. A node with no buildable artifact stays a sphere; it is not faked.** (RUNTIME **INV-R5 / FP-R3** — *the clause the Wave-1 hardcoded watch/orrery/transition and the 7 orphan nodes violate*.)
7. **Three view modes are states of one continuous scene:** `galaxy | canvas | preview-app`. Exactly three — `hub-world`/`preview-hub`/`split`/`editor` are retired (RUNTIME §1.3, FP-R8; CANVAS §1.1). **Boot = `preview-app`** (RUNTIME §6.3). One `THREE.Scene`, one `three` instance, no second visible renderer, no split-pane (RUNTIME INV-R1/FP-R1/FP-R6).
   - **galaxy** — unbuilt graph; the file-directory/navigational map. Spheres sized by contents, exterior label = artifact name, small colored icons for what the node holds + one icon for visual type. Free 3D nav; click hub/node → zoom-and-lock; hub editor / node editor slide in (Ruler §3a/§5/§6; NODE-EDITOR §2/§3).
   - **canvas** — built + editable: 3D drag-and-drop visual editor (select, move, corner-resize, rotate in 3D), home of the keyframe editor. **A node added in Canvas MUST create a corresponding graph node tethered to its hub** (CANVAS §1.2, SC-3). Visual editing happens *here*, never in the node editor.
   - **preview-app** — built + played: the actual running app, the literal artifacts running their code with live drivers; the same scene objects as canvas with handles hidden (RUNTIME INV-R4 — *not* a separate compiled `PrismHost` mount).
8. **The node editor edits PURPOSE, not visuals:** backend, functions, integrations, schema, behavior, caption. Image/video/3D artifacts appear in its "visual" section; code-based artifacts appear only when built. No visual-editor mode inside it (Ruler §6; NODE-EDITOR §5).
9. **Building is explicit; toggling never rebuilds.** Built-state is produced only by **Build Node / Build Selected / Build All** — entering a mode is not a build. The build is the pop-transition (sphere animates to coded position, pops, artifact revealed and runs). Results are cached by content hash (`builtSnapshot`); mode toggles serve cache in O(1). Surgical per-node rebuild on edit keeps every other node's `THREE.Object3D` reference stable (Ruler §4; RUNTIME DECISION-4/§5/§7, INV-R6/R7/R8).
10. **`createNode` contract:** `createNode(config, ctx): THREE.Object3D`, **synchronous**; async loading inside primitives via cached `ctx` loaders; `userData.cleanup()` disposes geom/mat/tex + kills timelines; `userData.handlers.*` for events; never adds itself to the scene (the manager mounts) (RUNTIME §9, INV-R9; carried from the renderer migration).
11. **Text is real MSDF** (`three-msdf-text-webgpu`) from a real font — never `TextGeometry`, never diffusion-baked letterforms, never DOM overlays. AI may generate the texture/material **fill** poured into letterforms, never the letter shapes (RUNTIME INV-R11; CANVAS §2-dec-8/§7).
12. **Secrets are capability references only.** Raw secret values never appear in graph data, `src/lib/**`, `src/components/**`, or the client bundle; resolution is server-side (`src/server/secrets/**` / `server-only`) with audit logging (RUNTIME INV-R13).
13. **Captions are storage/display/edit in the prototype.** Every node and hub carries a caption rich enough that a cold, context-free model can understand the element/page's intent, appearance, and behavior. The caption **format** and the **auto-update / caption-driven repair** mechanism are **deferred future-engine work** (Ruler §0/§9; NODE-EDITOR §7). *The prototype must store, display, and edit captions — it is not required to auto-regenerate them.*
14. **Frozen graph / additive schema.** The runtime never alters topology; schema growth is additive-only with safe defaults (RUNTIME INV-R10; CANVAS INV-8).

---

## PART B — THE ONE DESIGN LAW

> Binding for **both** surfaces. MUST-FIX on violation. Source: `ORRERY-NO7-VISION.md` §1, `PRISM-CANVAS-EDITOR-SPEC.md` §2/§7/§10/§11, `CINEMATIC-PRIMITIVES-LIBRARY.md`, `ORRERY-NO7-PROTOTYPE-SPEC.md` §3.4/§4, and the operator mandate. **Law 0 is new** — it is the law the corpus was missing, and the proximate fix for the Wave-1 drift.

### LAW 0 — EVERY ARTIFACT IS A NODE (the corrective)
**Every element — including every photoreal artifact (the watch, the orrery complication, hub transitions, ambient layers, every hero object) — is a graph NODE**, authored via `createNode`/`codeRef` and tethered to a hub, realized through the two-state model. **A hardcoded React/Three component that renders scene content outside the node map is forbidden** (RUNTIME INV-R5/FP-R3, §4 "each node maps to ONE scene object"; CANVAS §1.2). Procedural geometry is fine — *as the return value of a node's `createNode`*, not as a standalone scene component. The hub-transition uses the sanctioned `fly-through` cinematic primitive at hub-manager level (CPL), not a hardcoded curtain.
- **Verification corollary (closes the SC gap):** a success criterion for an artifact MUST assert **node authorship** — the object was produced by a node's `createNode`/`codeRef` (e.g. the mounted `Object3D` carries `userData.nodeId` and the graph contains that node with a real factory) — **not merely that an object of that name exists** in the scene. Name/count-only checks (the `ORRERY-NO7-PROTOTYPE-SPEC` SC-O pattern) pass hardcoded components and must be upgraded.

### B.1 — EDITOR CHROME (Prism's own UI — dogfood: every technique sold to customers appears here)
- **Toolbar = a photoreal 3D Liquid-Glass object** that warps/bends with movement — volumetric depth, transparency, ambient refraction. **Not** iOS "liquid glass," **not** CSS glassmorphism; a real shader/generated surface (DESIGN-REFERENCES SDF `opSmoothUnion` / refraction cookbook, TSL transmission; the `soap-scum` and `bioluminescent` material experiments from the open-design workspace are the intended look references).
- **Buttons = photoreal 3D objects "sunk" into the glass.** Hover = **3–4 full end-over-end spins on the horizontal axis** (accelerate on click, smooth decel). **Mostly no text** — tooltips on hover; a *few* may carry photoreal **animated engraving**.
- **Icons = ALL custom, 3D, colored, animated** (gradients + shadows), with tooltips. **NEVER** emoji, **NEVER** Lucide/Feather/line-icons, no lightning-bolts/generic boxes (VISION §1.3).
- **Node editor = same liquid-glass base.** Tabs/sections are their own photoreal 3D objects with premium animated icons + tooltips + tab-hover animations; volumetric depth + shadow + ambient light.
- **Keyframe editor** — finish the started materials (don't leave it half-styled).
- **No grotesque/default fonts.** Premium type only.

### B.2 — APP CONTENT (what the editor renders — beat the best Slider Revolution templates)
From `ORRERY-NO7-VISION.md` §1 (inherited, non-negotiable):
1. **Dogfood** — any technique sold to customers appears in Prism's own chrome.
2. **No flatness** — no 2D-skew-faking-3D, no flat AI-default panels. Real depth, real lighting, real PBR. Nothing flat, ever (operator mandate: Tailwind-style flat UI = MUST-FIX).
3. **No stock or emoji icons, ever** — all icons custom, dimensional, premium.
4. **Photoreal materials** — metals, dials, gems, straps render with real light response.
5. **Cinematic motion** — scenes, not cuts. Everything eases per `DESIGN-REFERENCES.md` + the `CINEMATIC-PRIMITIVES-LIBRARY.md` primitives. Nothing snaps.
6. **"Enough = not enough"** — sparse / generic / first-draft output fails the user-advocate gate.
7. **Evidence over assertion** — done is proven with a rendered screenshot or interaction trace, never claimed.

**Material / lighting / text laws (CANVAS):**
- **Materials** are native Three.js PBR (`MeshPhysicalNodeMaterial`): base color, metalness, roughness, transmission/IOR/dispersion, clearcoat, emissive, normal/displacement (CANVAS §11). **Material-as-node-swap** (PROTOTYPE §3.4): geometry = GLB; **finish = TSL node swap** (`colorNode`/`metalnessNode`/`roughnessNode`/anisotropy); surface pattern = generated KTX2 texture. No per-finish GLB.
- **Lighting** is scene-wide IBL/env + key/fill/rim + soft shadows, tiered T0→T3 by device, with a per-node `receivesLighting` toggle; image-planes default UNLIT (preserve diffusion appearance), meshes/splats are lit (CANVAS §2-dec-7/§10).
- **Glass budget** (PROTOTYPE §4): hero liquid-glass on ≤3 surfaces, ≤2 live transmission re-renders on screen at once — enforce a hard counter.
- **Asset generation** (VISION §7): photoreal parts/textures/HDRIs via Replicate (FLUX.2, Hunyuan3D/TRELLIS/Tripo) + optional Hyper3D/Rodin for hero 3D; exact geometry built procedurally and dressed with generated PBR + HDRIs; **every asset clears the art-fidelity gate** — AI never ships rough. *(Per the Logan inbox, Tripo v3.1 is funded; pick the best model per object.)*

### B.3 — BINDING STYLEGUIDE POINTERS
- `DESIGN-REFERENCES.md` — the awwwards-grade **technique vocabulary** (TSL/WebGPU, SDF `opSmoothUnion` for liquid/organic, FBM/domain-warp noise, fluid + Rapier physics, the shader cookbook, dispose()/InstancedMesh perf). **Runtime-legal subset only** — its DOM-WebGL libraries (curtains.js, VFX-JS, OGL, Locomotive, Barba, raw GLSL) are **forbidden** under INV-R1/R11; cite them as background, never as implementation.
- `CINEMATIC-PRIMITIVES-LIBRARY.md` — the 9 seed motion primitives + 6 TSL shaders + quality bars (60fps WebGPU / ≥45fps WebGL2 fallback). Animation may *also* be authored from scratch (CANVAS §2-dec-6, rescinding the old "no bespoke" rule) — but bespoke animation still implements the `Animatable` contract and is still applied **to a node**, never to a hardcoded component.

---

## PART C — APPLYING THIS

- **Runtime / mode / build / cache / createNode / secrets question?** → canonical-3 (`SPEC-INDEX.md` boundary map §2).
- **What should it look like?** → Part B + the styleguide pointers.
- **Is the current build compliant?** → `notes/AUDIT-INTEGRITY-REPORT.md` (no — 3 CRITICAL hardcoded-artifact violations + 7 orphan nodes).
- **How do I fix it?** → `notes/AUDIT-REMEDIATION-PLAN.md` (the watch/orrery/transition → node migration is NEEDS-GREENLIGHT, not a safe auto-fix).
- **What's deferred?** → caption auto-update + caption-driven repair + the diffusion engine (Ruler §0/§9; `PRISM-ENGINE-SPEC-V3.md`, future-source).

---

*End PRISM-MASTER-SPEC.md. This is the front-door, not the law-of-last-resort — that is the Ruler.*
