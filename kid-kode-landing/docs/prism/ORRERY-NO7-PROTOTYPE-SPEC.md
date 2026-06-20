# ORRERY No.7 — PROTOTYPE APP BUILD SPEC (F5+)

**The prototype luxury-watchmaker app + custom 3D watch configurator that proves the Prism editor builds real, shippable, beautiful 3D apps.**

- Compiled: 2026-06-20 · Author: resumed build session (Fable 5) · Feeds from `notes/PROTOTYPE-V2-RESEARCH-BRIEF.md` + `memory/prism-prototype-vision.md`.
- Repo: `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing` · Branch: `prism-editor-build`.
- **This is the PROTOTYPE-APP spec, not a canonical-3 editor spec.** It is subordinate to the ruler (`../PRISM-INTENT-ANCHOR.md`) and the canonical-3 (`PRISM-RUNTIME-SPEC.md`, `PRISM-NODE-EDITOR-SPEC.md`, `PRISM-CANVAS-EDITOR-SPEC.md`). Where this spec and a canonical-3 invariant conflict, the canonical-3 wins. This spec adds the *app content* the editor renders; it never relaxes a runtime invariant.

---

## §0 — WHERE THIS PICKS UP

Build phases shipped (git, branch `prism-editor-build`): **F0** de-brass identity → **F1** chrome material → **F2/F2b** identity depth → **F3/F3-fix** node-editor fixes → **F4a/F4a-fix** app shell + Arrival hub → **F4b/F4b-fix** four hubs (The Movement / Materia / Celestia / Acquire) + persistent shell. Last commit `802deb15`. App serves on `:3000` (HTTP 200).

The prototype is **ORRERY No.7** and currently is a cinematic marketing site (5 hubs). The 2026-06-19 scope expansion (recorded in `memory/prism-prototype-vision.md`) adds: it must be a **complete app** — and its centerpiece becomes a **custom watch DESIGNER / configurator (The Atelier)**. **F5+ in this spec builds that.**

The graph IS the app (INV-1). Every surface below is authored as **Prism nodes** in the live graph (`public/prism-mock/home/live-graph.json`, source under `src/lib/prism/mock-app-source/`), realized by the synchronous `createNode(config, ctx): THREE.Object3D` contract, rendered into the single `three/webgpu` scene across the canonical 3 view modes (`galaxy | canvas | preview-app`; boot = `preview-app`).

---

## §1 — STACK (LOCKED, from brief §1.3)

| Decision | Value |
|---|---|
| three | r184 (`three/webgpu`, TSL only) — **stay; no architecture jump** |
| R3F / drei / postprocessing | v9 / v10 / v6 — `npm update` floats, **no v10/v7/v11 alphas** |
| gsap | bump pinned `3.13.0` → `^3.15.0` (SplitText/MorphSVG/ScrollSmoother now free) |
| smooth scroll | **Lenis** + **GSAP ScrollTrigger** (scroll-category primitives register triggers) |
| physics (configurator snap) | **`@dimforge/rapier3d-compat@0.19.3`** (NEW — allowlist first) |
| cinematic sequencing | **GSAP timelines** (theatre.js = optional/frozen 0.7.2, do not depend) |
| "sample color from image" | **pure-canvas pixel pick — NO transformers.js** (resolves brief risk #1; avoids WebGPU device contention) |
| asset compression | **Draco** geometry + **KTX2** textures, mandatory |
| env capture (optional) | `@mkkellogg/gaussian-splats-3d` (NEW — allowlist first, only if used) |

**Gate (INV — supply chain):** every NEW import (`rapier3d-compat`, optionally `@mkkellogg/gaussian-splats-3d`) MUST be added to `.claude/hooks/dependency-allowlist-check.sh` **before** the import is written, or the PreToolUse hook blocks the build. transformers.js is **not** added (decided out).

---

## §2 — ORRERY No.7: THE WORLD (the SliderRevolution killer)

**Thesis (brief §4.4):** every benchmark site is a film you scroll. Ours is a film you scroll *that hands you the controls and lets you build the watch inside the same 3D world — then keeps filming.* That fusion is the differentiator an SR template categorically cannot do, and a Prism-built shippable app can.

**One continuous orrery, not disposed scenes.** The five hubs are **regions of one persistent world**, not Cartier-style load/dispose alcoves (resolves risk #7). Nested orbital shells carry watch components as "planets." A single camera flies a **continuous spline path** through the shells on scroll — no load seams.

- **Scroll = orbital mechanics.** `scroll.y/limit.y` (0→1) advances orbital time: rings rotate, components precess into alignment, the camera dollies/orbits along the spline. Primitives: `scroll-path-scrub`, `scroll-orbit-scrub`, `scroll-depth-dolly`, `scroll-rotate-3d`, `sticky-pin`, `scrub-morph`, `reveal-mask-scroll` (brief §2.2 F1). Camera = GSAP timeline driving `cameraAnim` position + separate `targetAnim` look-at, `scrub:1`.
- **Region map along the spline:** `Arrival` (orrery overview, hero) → `The Movement` (dive into the caliber shell, live mechanism) → `Materia` (material plates shell) → **`The Atelier` (NEW F5 — the configurator climax; flythrough decelerates, components detach into the user's hands)** → `Celestia` (the built watch becomes the hero, orbiting) → `Acquire` (price/checkout, still in-world).
- **Persistence budget (resolves risk #7):** keep all orbital shells resident; apply `THREE.LOD` by distance + frustum culling + `InstancedMesh` for satellites/particles, GPU-compute particles via TSL `instancedArray`+`computeAsync` for the cosmos dust (brief §2.3). IntersectionObserver-gated dynamic `import()` of heavy per-region node bundles. Target: no scene disposal, no load seam, sub-3s LCP (defer 3D init after LCP).
- **Material-real (brief §4.4):** WebGPU + TSL `MeshPhysicalNodeMaterial`; real-time relight on scroll (Apple "device catches light"); GPU path-tracing / SSGI reserved for hero stills + the Celestia close (desktop tier only — see risk #3 fallback).
- **Craft / table-stakes:** `cinematicSilk` Bézier easings; Web Audio score (orrery hum per shell, mechanical ticks during assembly); skippable intro; **progressive WebGPU→WebGL2→static-poster fallback** (no blank page, ~95% coverage).

---

## §3 — THE ATELIER: 3D WATCH CONFIGURATOR (F5 core)

Authored as a Prism **hub** (`atelier`) whose nodes realize the configurator. No DOM UI for the 3D surfaces; MSDF text only (INV-R11); secrets/capabilities server-side only (INV-R13).

### §3.1 Ordered assembly stack (build-from-the-movement-out)
11 catalog layers, each a node group; layers gate in build order so the preview is always coherent (brief §5.2):

1. Movement/Caliber (auto/manual/tourbillon/skeleton — **runs live**, drives price floor + legal complications)
2. Case (shape × size × material-finish-as-node-swap)
3. Bezel (smooth/fluted/gem-set/tachymeter/dive — snaps to case top ring)
4. **Dial** (plain/guilloché/solarized/skeleton/enamel/meteorite/aventurine — the hero customization; full color picker + curated palette + sample-from-image)
5. Hands (dauphine/baton/sword/breguet/syringe — constrained to dial-legible contrast)
6. Indices/Markers (applied/printed/roman/arabic/diamond — couples to hands)
7. Crown (onion/flat/screw-down/gem-set — material defaults from case)
8. Complications (date/GMT/moonphase/chrono/power-reserve/small-seconds — **gated by movement**, illegal combos disabled with inline reason, never hidden)
9. Lume (none/blue/green/ice — triggers night/UV preview mode)
10. Strap/Bracelet (leather/alligator/rubber/NATO/integrated/Milanese — buckle defaults from case)
11. Engraving (caseback/clasp text, MSDF, real-time engraved-surface render)

**Constraint-as-feature (CPQ):** illegal combos disabled with reason chips ("Moonphase requires Automatic or Tourbillon caliber"), never dead-ends.
**Curated + custom dual track per axis:** curated palette (fast, on-brand) + full HSV picker + **sample-a-color-from-an-image** (pure-canvas pixel pick).

### §3.2 Interaction (ship BOTH, default by device — brief §5.3/5.4)
- **A. Tap-to-apply (primary, all devices):** select layer → part isolates/highlights (camera eases to frame it, others dim) → tap variant → material mutates **in place, instantly** via TSL `uniform()` node update (zero rebuild, no FBO reload).
- **B. Drag-drop magnetic snap (desktop showpiece — the Prism flex):** drag a part chip onto the watch; **anchor socket per layer** (case-top ring / dial-well / crown-stem / lug-bars); valid sockets glow on drag-near; part eases into socket with spring-settle + audio click. Primitives `magnet-snap`/`gravity-well`/`spring-arrive`/`drop-bounce`; **Rapier** collision/joints; reuse repo `hub-geometry.findNearestHub` + Round-2 Clone+auto-snap (SC-075..077).
- **Responsive:** desktop = drag+tap, side-rail; tablet = tap primary, larger targets; mobile = **drag→tap collapse**, bottom-sheet catalog, one layer at a time, reduced postprocessing, static-poster if WebGPU+WebGL both fail.

### §3.3 Feels-fast (brief §5.5)
Optimistic in-place mutation · camera eases to active layer · low-poly Draco proxy first then LOD swap · **instant shareable snapshot render** on completion (Nike pattern) · **live mechanism ticking** while configuring (Piaget) · immediate constraint feedback.

### §3.4 Material-as-node-swap (resolves risk #6)
Case/strap/metal finishes = TSL node swaps (`colorNode`/`metalnessNode`/`roughnessNode`/`anisotropy`), **no per-material GLB**. Dial **textures** (guilloché/solarized/meteorite/aventurine/enamel) ARE fal-generated KTX2 maps bound to the dial base GLB — texture, not just node params. Confirmed split: geometry GLB per shape/type; finish = node; surface pattern = texture.

### §3.5 Save / share / buy contract (resolves risk #8)
A watch build serializes to the **per-layer `ControlSchema` param set** (movement id, case shape+size+finish, bezel, dial+color+texture, hands, indices, crown, complications[], lume, strap+buckle, engraving). This JSON is the save/share/restore unit and the "buyable artifact" payload. Snapshot render = offscreen high-res still of the configured node group. Routes through `usePreviewStateStore` → Save / Save-and-Rebuild (RA-16) like every other node edit.

---

## §4 — LIQUID GLASS (used, not the basis — brief §3.5)

Hero accent on **≤3 surfaces**, **≤2 live transmission re-renders on screen at once** (hard runtime guard/counter — resolves risk #2):
1. **Sapphire crystal over the watch** (signature) — TSL `MeshPhysicalNodeMaterial`, `ior 1.76`, low `chromaticAberration ~0.04`, thin thickness, specular sweep tracking the orbit camera. Path B.
2. **Atelier panel chrome** — one floating glass control surface; **Path C screen-space UV-displacement** (no 2nd transmission render); solid tint behind labels.
3. **Nav/dropdown** — a *single* shared glass layer (one render target reused), bevel+specular, never per-item.
Everywhere else opaque. Always pair glass-over-text with adaptive tint. Primitives: `liquid-glass`, `glass-refraction`, `dispersion`, `crystal-facet`, `bevel-glass` (glass category).

---

## §5 — RESOLVED OPEN RISKS (brief §7)

| # | Risk | Decision |
|---|---|---|
| 1 | transformers.js WebGPU contention | **Drop it.** Sample-from-image = pure-canvas pixel pick. No ML on the GPU device. |
| 2 | transmission re-render budget | Hard counter, **≤2 live**; Path C screen-space for panels/nav; Path B only crystal + one more max. |
| 3 | path tracing on mobile | Desktop-only path tracing. Tiers: WebGPU desktop = path-traced hero stills; WebGL2 = baked lighting + reduced samples; both fail = static poster. Decision tree via `navigator.gpu?.requestAdapter()`. |
| 4 | theatre.js vs GSAP | **GSAP timelines** cover all scroll choreography. theatre.js not adopted. |
| 5 | r181→r182 transparent regression | After `npm update` patch bumps, **verify all watch/glass materials render** before locking (verification gate in every F5+ phase). |
| 6 | material node-swap vs GLB | Geometry=GLB, finish=node, surface pattern=fal KTX2 texture (see §3.4). |
| 7 | continuous world vs disposal | One persistent world; LOD + culling + instancing + GPU-compute particles; no disposal (see §2). |
| 8 | snapshot/share/buy | Per-layer `ControlSchema` JSON is the serialization unit (see §3.5). |
| 9 | fal cost ceiling | **One-time batch** provision, cache to disk; **CONFIRM budget with operator before spend** (see §6.3). |

---

## §6 — fal PHOTOREAL ASSET PIPELINE + MANIFEST + BUDGET

### §6.1 Pipeline (brief §6.1)
`@fal-ai/client` (server-side, `npm run provision-assets`, needs `FAL_KEY`) → photoreal source images / material captures → Blender model → `.glb` (Draco) + KTX2 textures → `GLTFLoader`+`DRACOLoader`+`KTX2Loader` → TSL `MeshPhysicalNodeMaterial` live finishes. Optional Gaussian splat env. Inspect-every-asset QA: 3 angles, grade geometry/texture/scale 0–5, regen if <4, cap 4 attempts.

### §6.2 Asset manifest (maps to the 11-layer stack)
Movement 1 GLB (animatable mechanism) · Case 3 shapes (finish=node) · Bezel 4 GLBs · Dial 1 base GLB + 7 fal texture sets (KTX2) · Hands 5 GLBs · Indices 5 GLB/decal · Crown 4 GLBs · Complications ~5 sub-dial GLBs · Strap 6 GLBs + fal material textures · Environment 1–2 HDRI/splat backdrops.

### §6.3 Budget (resolves risk #9 — **OPERATOR CONFIRM REQUIRED**)
Brief notes the fal key had ~$45 remaining; `provision-assets` ≈ $0.50/run. The full manifest is a one-time batch (estimate to be computed before spend), cached, never regen-per-build. **Per standing autonomy, nontrivial ongoing cost >$10/mo needs explicit confirm — I will compute the batch total and confirm with the operator before running provisioning.** Until confirmed, F5 builds against **placeholder/proxy geometry** so all logic, snapping, and UI are verifiable without spend.

---

## §7 — PHASED BUILD PLAN (F5 → close)

Each phase: build as nodes → `npm run build:prism` → load real Chrome → **two-layer verify (functional + vision) graded vs §9 SC with saved evidence** → `prism-criteria-reviewer` → commit → `git push origin prism-editor-build`. Big parallel work → dynamic workflows (Opus/Fable); focused work → this session. One coherent commit per sub-step.

- **F5.0 — Stack + scaffold.** `npm update` (float bumps), gsap→3.15, add `rapier3d-compat` to allowlist + install, verify watch/glass materials still render post-bump (risk #5). Add the `atelier` hub to the graph (empty region on the spline). *Gate: app still green, no material regressions.*
- **F5.1 — Proxy configurator (no fal spend).** 11-layer assembly stack with **proxy geometry**: layer selection, camera-eases-to-frame, tap-to-apply in-place node-swap finishes, constraint-as-feature gating, dual-track color (curated + HSV + sample-from-image canvas pick), serialization JSON. *Gate: build a coherent watch end-to-end with proxies; constraints enforce; save/restore round-trips.*
- **F5.2 — Drag-drop + physics.** Rapier sockets per layer, magnetic snap, spring settle, audio click; desktop drag / mobile tap-collapse / bottom-sheet. *Gate: drag a part to its socket and it snaps; mobile falls back to tap.*
- **F5.3 — fal photoreal assets** (AFTER budget confirm). Provision manifest, Blender→Draco+KTX2, swap proxies→real GLBs, live dial textures, live mechanism. Inspect-every-asset QA. *Gate: photoreal parts render at 60fps; ≤2 transmission live.*
- **F5.4 — Sapphire crystal + liquid glass** (§4). Crystal Path B, Atelier panel Path C, shared nav glass; transmission counter guard. *Gate: glass reads as lensing not blur; budget guard holds.*
- **F6 — World weave.** Connect Atelier into the continuous spline (decelerate-to-configure, components detach from orbital shells; built watch flies out to Celestia as the closing hero). Web Audio score, skippable intro. *Gate: one continuous scroll Arrival→Acquire, no seams.*
- **F7 — Responsive + fallback + perf.** Tablet/mobile tiers, WebGPU→WebGL2→poster decision tree, LOD/instancing/atlas, sub-3s LCP, snapshot-share. *Gate: mobile usable; no blank page on WebGL fail; LCP < 3s.*
- **F8 — Bar-beating polish + close.** Path-traced hero stills (desktop), cinematic grade (bloom/DoF/SSAO/vignette/CA/tonemap), Easter eggs, full evidence pass vs §9. *Gate: smokes SR; sits beside Cartier/Apple.*

---

## §8 — VERIFICATION DOCTRINE (binding, from `kid-kode-landing/CLAUDE.md`)

Prism renders into a WebGPU canvas; DOM selectors can't see it. Every phase verified in **two layers**, graded vs the numbered SC with saved evidence under `notes/verification/`. "I added it" is never done.
1. Change → load in **real headed Chrome** (headless software-WebGL under-renders WebGPU — dismiss guided-tips walkthrough).
2. **Functional layer** — Chrome DevTools MCP / KripVerify `kv_check_console`/`kv_check_network`/`kv_evaluate`: zero console errors, scene-graph assertions.
3. **Vision layer** — KripVerify `kv_screenshot`/`kv_click`/`kv_type`/`kv_verify` and/or Claude-in-Chrome: judge the look + **drive it like a user** (toggle modes, select layer, swap finish, drag-snap, build a full watch).
4. **Grade vs §9 SC with evidence.** ANTI-STUCK: after ~2 failed attempts, web-search the current correct approach, root-cause — **never downgrade a dependency** to silence an error.
5. **Fresh-context review** by `prism-criteria-reviewer` (diff + criteria). MUST-FIX blocks "done".

This is the user's custom harness doctrine — observer + sentinel + monitor + near-human computer-use + verification looping + ultracode (Workflow multi-agent).

---

## §9 — SUCCESS CRITERIA (prototype, numbered — the rubric)

**Configurator (F5):**
- SC-O1 All 11 layers selectable; selecting a layer eases the camera to frame it and dims others.
- SC-O2 Tap a variant → finish/material mutates in place instantly (no reload, no rebuild flash).
- SC-O3 Illegal combos are disabled with a visible inline reason; never a dead-end; never silently hidden.
- SC-O4 Color: curated palette + full HSV picker + sample-a-color-from-an-image all set the dial live.
- SC-O5 Desktop drag-drop snaps a part to its socket with spring settle + click; mobile collapses to tap + bottom-sheet.
- SC-O6 A complete watch can be built end-to-end and serialized/restored from the per-layer JSON.
- SC-O7 The movement runs (ticks) live while configuring.
- SC-O8 Instant shareable snapshot render produced on completion.

**World (F6/F7/F8):**
- SC-O9 One continuous scroll Arrival→Acquire with no load seam; Atelier is a region of the same world, not a separate page.
- SC-O10 ≤2 live transmission re-renders on screen at once (guard enforced); glass reads as lensing, not blur.
- SC-O11 Progressive WebGPU→WebGL2→static-poster fallback — never a blank page.
- SC-O12 Responsive desktop/tablet/mobile; mobile usable at reduced budget.
- SC-O13 Sub-3s LCP; 3D init deferred after LCP; 60fps on the hero interactions.
- SC-O14 Materials are physically real (TSL PBR); no regression from the r184 patch bumps (risk #5).
- SC-O15 Side-by-side it smokes the best SliderRevolution 3D/scroll template and sits beside Cartier W&W / Apple product pages.

**Invariants preserved (non-negotiable):** graph-is-the-app; one `three/webgpu` scene; `galaxy|canvas|preview-app` only; TSL-only; MSDF text only (no DOM text, no `THREE.TextGeometry`); synchronous `createNode`; capability-refs only (no client secrets); allowlist updated before any new import.

---

*End ORRERY No.7 prototype spec. Source: `notes/PROTOTYPE-V2-RESEARCH-BRIEF.md`, `memory/prism-prototype-vision.md`, canonical-3 specs, `kid-kode-landing/CLAUDE.md`.*
