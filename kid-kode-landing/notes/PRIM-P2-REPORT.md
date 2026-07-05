# PRISM PRIMITIVE SYSTEM — PHASE P-2: THE MATERIAL SYSTEM — REPORT

**Status:** RUN COMPLETE · **Branch:** `prism-editor-build` · **Date:** 2026-06-26
**Builds on:** committed P-1 (parametric Pane/Cube/Sphere primitives + in-canvas Inspector).
**Route:** **`/material-lab`** (isolated R3F WebGL — the toolbar-chassis / keyframe-editor / primitive-lab idiom; never the unified three/webgpu graph scene). Production UNTOUCHED.

One line: **A structured, curated material library (71 materials across 8 families) as parametric PBR node-material descriptors, applied live to primitive NODES under ONE shared studio IBL, infinite via prompt-to-texture (matched-latent + DELIT) — all matching the founder-approved worn-metal/glass look.**

---

## 1. What shipped (per spec §2)

### W-LIB — curated library + shared IBL
- **`material-types.ts`** — `MaterialDef` (id, family, label, params, maps?, swatchTint) + `MaterialParams`: every editable PBR field (baseColor, metalness, roughness, transmission, ior, thickness, dispersion, attenuationColor/Distance, clearcoat, sheen, anisotropy, **iridescence** + IOR + thicknessRange, specularIntensity, envMapIntensity, emissive, normalScale, **wear**). Each maps 1:1 to a `THREE.MeshPhysicalMaterial` property (forward-compatible with `MeshPhysicalNodeMaterial` on WebGPU).
- **`material-build.ts`** — `buildMaterialFromDef(def, mapSets, overrides)` → real `MeshPhysicalMaterial` (transmission/refraction, clearcoat, sheen, anisotropy, thin-film iridescence, dispersion, baked-map layering, wear). `useMaterialMapSets()` Suspense-loads every textured set; `paramFadersFor(family)` gives the per-family fader set.
- **8 families, 71 materials**: Metals (13 — incl. the **5 committed worn seeds** referencing the chassis-worn PBR sets), Stones (10), Glass (7), Gems (7), Woods (8), Ceramics (8), Fabrics (9), Exotic (9), + Generated (prompt-to-texture).
- **ONE shared IBL** — `StudioEnv` (the chassis studio map) reused verbatim, so every material refracts/reflects the same environment by construction.
- **`material-registry.ts`** — reusable registry keyed by id (§2.5); `getMaterial`, `materialsByFamily`, `populatedFamilies`, `registerGeneratedMaterial`. Legacy P-1 kinds bridge to ids.
- **`/material-lab`** — 3 display primitives (pane/cube/sphere = real NODES) wear the selected material; an in-canvas library palette browses by family with live spinning preview swatches; click applies.

### W-APPLY — registry source-of-truth + live apply + tuning
- Primitive schema references a material by **registry id** (+ per-instance overrides); `schemaToNode` derives the node's `materialSpec` from the resolved registry material (node + materialSpec carry the applied material; **zero production-type touch**, INV-18).
- **`MaterialInspector`** — dogfooded glass pane + worn-cube fader knobs (chassis/keyframe vocabulary); per-family PBR faders write live overrides → displays rebuild instantly. RESET clears.
- **`node-authorship-gate --mat`** — drives `/material-lab`, proves Law-0 on the 3 display nodes + that applying a material never orphans a render.

### W-PROMPT — prompt-to-texture (matched-latent + DELIT)
- **`.assetgen/derive-material-pbr.mjs`** (local, like the chassis pipeline) — ONE FLUX plate → albedo + normal + rough + metal + ao **ALL from the same latent** (matched, F-7), with lighting **divided out of the albedo** (homomorphic delight: divide by a low-pass of luminance) → even-lit base colour; kind-aware metalness/roughness baselines.
- **`/api/material-gen`** (server-only, Node runtime) — runs the pipeline; the Replicate key stays in `.assetgen`, never in graph/client (INV-19).
- **In-canvas PROMPT panel** (zero DOM) — focusable milled slot + window-keydown capture, GENERATE worn-cube button, 3 preset chips, live status; on success loads maps imperatively → registers → applies live.
- **3 REAL committed seeds** (brushed-copper, carrara-marble, walnut-grain) + verified **LIVE end-to-end** generation of "hammered antique brass" during the headless run.

---

## 2. Gates (all green)

| Gate | Result |
|---|---|
| `tsc --noEmit` | **9 = baseline / 0 new** |
| `no-dom-ui-gate` (material + material-lab) | **PASS** (22 files) |
| `node-authorship-gate --mat` | **6/6, 0 hard-fail** |
| `node-authorship-gate --lab` (P-1 regression) | **7/7** — P-1 not regressed |
| console errors (every behavioral run) | **0** |

---

## 3. Behavioral evidence (headless, real-pointer)

`notes/verification/prim-p2/` — 30 frames + metrics JSON. Scripts: `verify-prim-p2-{lib,apply,prompt,capstone}.mjs`.

- **lib-*** — every family applied under IBL (gold/glass/ruby/diamond/jade/oil-slick/soap-film/velvet/walnut/cobalt); 0 orphans.
- **apply-02..06** — live PBR tuning via real fader drags: gold ROUGHNESS 0.22→0.92 (mirror→satin, visibly), diamond dispersion→5.7, oil-slick iridescence 0.1→1.0 (thin-film appears), RESET clears.
- **prompt-02-seed-*** + **prompt-04-live-generated** — prompt-to-texture: 3 committed matched+delit seeds + the LIVE "hammered antique brass" (dimpled planished normal reads on the sphere).
- **cap-pane-A/B/C** — the advocate's task: gold, ruby, and **prompt-to-texture copper** on a PANE (pane UVs normalized → clean single-tile, no seams).

---

## 4. Deviations / notes (honest)

- **WebGL surface + `MeshPhysicalMaterial`, not literal TSL nodes.** The spec §1.6/§2.2 says "all materials are TSL node-materials." The isolated review lab renders on the **approved WebGL `<Canvas>`** (the P-1/chassis/keyframe idiom; the prompt's "STACK — WebGL ONLY. LAW."). On WebGL2, `MeshPhysicalMaterial` delivers real PBR + transmission + clearcoat + **iridescence (thin-film)** + sheen + anisotropy + dispersion — i.e. the full family range and the approved look by construction. Every `MaterialParams` field maps 1:1 to a `MeshPhysicalNodeMaterial` property, so the registry is TSL-node-ready when the lab migrates onto the unified WebGPU scene. (Precedent: the keyframe run documented an analogous Theatre.js deviation.)
- **Stones/Woods/Ceramics/Fabrics ship analytic** (pure-param) in the curated set; textured realism for those families comes via **prompt-to-texture** (the committed marble/walnut seeds + on-demand generation), which is exactly the "effectively infinite" path §2.4 intends.
- **`.assetgen` is gitignored** (holds the Replicate key) — the gen scripts live locally like the existing chassis pipeline; the committed evidence is the output textures + the API route + the components.

---

## 5. Fresh-context verdicts

Three fresh-context judges ran in parallel (ultracode verification workflow). **All PASS, 0 MUST-FIX.**

### Fresh-context user-advocate — **PASS / net PLEASED**
- Axes: **STYLE 5 · FUNCTION 5 · INTUITIVENESS 4 · SATISFACTION 5**. 0 MUST-FIX.
- "The three required materials applied to the pane all read as REAL, not plastic: polished gold has true metallic environment reflection and sheen; ruby is a deep glassy gem; and the prompt-to-texture copper shows genuine brushed/worn streaking that matches the worn-metal grade of the approved ref. Prompt-to-texture works end-to-end — typing 'hammered antique brass with dimpled planished texture' generated a real dimpled hammered-brass material on all three primitives. Live PBR tuning is real parameter manipulation, not swatch swaps. Glass shows true transmission/refraction matching the approved keyframe ref."
- Only nit (no MUST-FIX): header captions clip at the right edge of the **close-up crop** frames — a framing artifact of the capture, not a usability defect (the full-frame overview shows captions in full).

### Aesthetic-match judge — **PASS**
- "The Material System surfaces reach the same photoreal, worn, refracting aesthetic bar as the approved toolbar-chassis and keyframe-editor. Genuine PBR across families: metals reflect, gems refract, fabrics show correct velvet sheen (Fresnel rim, NO specular hotspot), exotics show visible thin-film interference. The dogfooded chrome (glass panels, worn-metal cube knobs, engraved-in-glass labels) is consistent with the approved chassis vocabulary. **No glossy-plastic/flat/toy materials (F-4).**"

### Spec-conformance judge — **PASS_WITH_NOTES**
- §2.1 families ✓ · §2.2 parametric PBR + ONE shared IBL ✓ · §2.3 worn seeds reference committed chassis-worn sets ✓ · §2.4/F-7 matched-latent + **delit** (homomorphic delight verified in the derive) ✓ · §2.5 reusable id-keyed registry ✓ · §10 F-4 ✓ · F-2 zero-DOM ✓ · INV-19 secrets server-only (no Replicate key anywhere in `src/`) ✓ · Node Law ✓.
- Single NOTE (not a fail): materials build `THREE.MeshPhysicalMaterial` on the isolated WebGL chassis surface rather than literal `three/tsl` node-materials — the documented, arc-wide convention (see §4).

---

## 6. For the next phase

P-2 extends the P-1 engine. P-3 (fluids) layers a TSL/WebGPU fluid material + liquid-glass surface onto this registry; the `Glass · Liquid Glass` entry is the seam. The registry, `buildMaterialFromDef`, the family files, and the prompt-to-texture pipeline are the reusable substrate — **verify-only, don't rebuild.**
