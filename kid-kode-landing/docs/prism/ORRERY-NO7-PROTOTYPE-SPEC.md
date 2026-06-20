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

## §9 — SUCCESS CRITERIA (hardened — binary, automatable, graded by computer-use agent)

Every criterion is binary PASS/FAIL. The test agent observes via Playwright MCP (`mcp__playwright__browser_*`) + JS evaluation + console inspection. Evidence saved to `notes/verification/<SC-id>/`. "I added it" is never done — the signal must appear.

Status legend: `[ ]` = not yet shipped · `[~]` = partial · `[x]` = done+evidence

---

### §9.1 — Configurator Core (F5.1 — delivered)

**SC-O1 — Layer selectability**
- `[x]` SC-O1.1 Hub `s6-atelier` loads without console error. Signal: `kv_check_console` 0 errors after navigating to the Atelier hub.
- `[x]` SC-O1.2 All 11 layer nodes render in the swatch rail (movement/case/bezel/dial/hands/indices/crown/complications/lume/strap/engraving). Signal: `evaluate(() => document.querySelectorAll('canvas').length > 0)` + scene-graph assertion `window.__PRISM_DEBUG_STORES__.graphSource.getState().graph.hubs['s6-atelier'].nodes.length >= 60` (confirmed 79 nodes on 2026-06-20).
- `[x]` SC-O1.3 Clicking a layer node sets `useConfiguratorStore.activeLayer` to that layer ID. Signal: `evaluate(() => window.__PRISM_DEBUG_STORES__.configurator.getState().activeLayer)` equals the clicked layer string within 500ms. (Store is exposed via the dev-only `__PRISM_DEBUG_STORES__.configurator` handle in `src/app/page.tsx`.)
- `[x]` SC-O1.4 Selecting a layer dims non-active watch-part nodes. Signal: screenshot diff — non-selected watch parts have visually lower luminance (advocate: ≥25% darker or explicit opacity reduction visible in screenshot).
- `[ ]` SC-O1.5 Camera eases to frame the selected layer. Signal: `evaluate(() => window.__PRISM_CAM_POS__)` changes within 800ms of layer click (camera position vector changes by ≥0.05 units from pre-click position). *(F6 — world weave required for camera spline)*

**SC-O2 — Tap-to-apply material mutation**
- `[x]` SC-O2.1 Tapping a variant node updates the watch part material with no page reload. Signal: `performance.getEntriesByType('navigation').length === 1` (stable) after 3 variant taps.
- `[x]` SC-O2.2 Zero `"rebuilt scene"` or `"createNode"` log entries after a variant tap. Signal: console assertion.
- `[x]` SC-O2.3 Price readout node (`orr-atelier-price`) MSDF text updates within 300ms of variant change. Signal: screenshot of price node before/after — text must differ.
- `[x]` SC-O2.4 Summary text node (`orr-atelier-summary`) updates within 300ms of variant change. Signal: screenshot diff.
- `[x]` SC-O2.5 `useConfiguratorStore.getState().rev` increments by 1 for each accepted change. Signal: JS eval before and after tap.
- `[ ]` SC-O2.6 No dropped frames during 3 rapid sequential variant taps (< 500ms apart). Signal: DevTools `performance.now()` delta between taps never exceeds 50ms rAF stall. *(F7 perf sweep)*

**SC-O3 — Constraint-as-feature**
- `[x]` SC-O3.1 Selecting "moonphase" complication when movement is "automatic" succeeds: `store.build.complications` includes "moonphase".
- `[x]` SC-O3.2 Selecting "moonphase" when movement is "manual" or "skeleton" is rejected: `store.build.complications` is NOT "moonphase" (movement variants are automatic/manual/tourbillon/skeleton — there is no "quartz"; only automatic + tourbillon permit moonphase). Verified 2026-06-20 via `__PRISM_DEBUG_STORES__.configurator`.
- `[x]` SC-O3.3 The reason text node (`orr-atelier-reason`) is non-empty when a constraint rejection fires. Signal: screenshot shows visible reason string; `evaluate(() => window.__PRISM_DEBUG_STORES__.configurator.getState().lastReason)` equals "Moonphase requires the Automatic or Tourbillon movement." Verified 2026-06-20.
- `[x]` SC-O3.4 Constrained variants are visually dimmed/disabled, never hidden. Signal: all variant nodes present in scene graph (`window.__PRISM_DEBUG_STORES__.graphSource.getState().graph.hubs['s6-atelier'].nodes.length` stable); only material/opacity changes.
- `[x]` SC-O3.5 Constraint cascades: with moonphase selected under tourbillon, changing movement to "manual" auto-resets complications to "none". Signal: `store.build.complications === 'none'` after the movement change. Verified 2026-06-20.

**SC-O4 — Color (partial — full picker in F5.3)**
- `[x]` SC-O4.1 ≥6 dial color variant nodes are present in the swatch rail for the dial layer. Signal: `graphSource.getState().graph.hubs['s6-atelier'].nodes` contains ≥6 nodes with `functionBinding.layer === 'dial'` (confirmed 9 on 2026-06-20: navy/silver/black/green/salmon/meteorite/guilloche/aventurine/enamel).
- `[x]` SC-O4.2 Tapping a dial variant updates `store.build.dial` to the correct variantId. Signal: JS eval.
- `[ ]` SC-O4.3 Full HSV picker sets dial color live (no rebuild). *(F5.3 — needs color picker node)*
- `[ ]` SC-O4.4 Sample-a-color-from-image sets the dial live via canvas pixel pick. *(F5.3)*

---

### §9.2 — Drag-Drop + Physics (F5.2 — delivered)

**SC-O5 — Drag-drop Rapier snap**
- `[x]` SC-O5.1 `window.__ATELIER_RAPIER_READY__` is `true` within 3s of Atelier hub load. Signal: `waitFor(() => window.__ATELIER_RAPIER_READY__ === true, {timeout: 3000})`.
- `[x]` SC-O5.2 Pointer-down on a variant chip node (swatch) starts the drag — ghost cube `BoxGeometry` appears. Signal: no error in console; screenshot shows a cube following cursor after pointerdown.
- `[x]` SC-O5.3 Ghost cube tracks pointer with spring lag (visually trails pointer). Signal: screenshot taken mid-drag shows ghost offset from cursor by 1-5px.
- `[x]` SC-O5.4 Hovering ghost over any `orr-atelier-watch-*` node activates the valid-drop glow. Signal: screenshot shows green/white highlight on watch-part surface.
- `[x]` SC-O5.5 Dropping over a valid watch target fires `store.setLayer(layer, variant)`. Signal: JS eval of `store.build[droppedLayer]` equals the dragged variantId within 600ms of pointerup.
- `[x]` SC-O5.6 Settlement animation (ghost shrinks to zero) completes within 600ms of drop. Signal: screenshot taken at T+700ms shows no ghost cube.
- `[x]` SC-O5.7 A drop outside valid targets cancels the drag without changing the build. Signal: `store.build` unchanged after drop on background.
- `[ ]` SC-O5.8 Mobile viewport (375×812): drag-drop replaced by tap-confirm; bottom-sheet catalog visible. *(F7 responsive)*

---

### §9.3 — Save / Share / Reset (F5.1 — delivered)

**SC-O6 — Serialization round-trip**
- `[x]` SC-O6.1 Clicking SAVE button writes `localStorage['orrery-no7-build']` with a valid JSON string. Signal: `evaluate(() => JSON.parse(localStorage.getItem('orrery-no7-build')))` returns non-null object.
- `[x]` SC-O6.2 Saved JSON has `v: 1` and `build` key with all 11 layer IDs present. Signal: JS eval checks `Object.keys(parsed.build).length === 11`.
- `[x]` SC-O6.3 Hard-reload restores the saved build (restore round-trip). Signal: after `navigate(url)` fresh load, `store.build` equals the pre-saved build within 500ms.
- `[x]` SC-O6.4 RESET button reverts build to DEFAULT_BUILD and clears localStorage key. Signal: `localStorage.getItem('orrery-no7-build')` is null after reset; `store.build` equals DEFAULT_BUILD.
- `[ ]` SC-O6.5 SHARE button produces a data-URL snapshot copied to clipboard. Signal: `evaluate(() => navigator.clipboard.readText())` returns a string starting with `"data:image/png"`. *(F5.4 — offscreen render)*

---

### §9.4 — Photoreal Assets (F5.3 — next phase)

**SC-O7 — Live movement tick**
- `[ ]` SC-O7.1 The seconds-hand node rotates exactly 6°/sec when caliber is "automatic" or "manual". Signal: JS eval of `node.rotation.z` at T+0 and T+1000ms differ by ~0.105 rad.
- `[ ]` SC-O7.2 Movement animation does not pause when the configurator layer is changed. Signal: rotation continues incrementing through a layer-change event.
- `[ ]` SC-O7.3 "Skeleton" movement caliber shows visible mechanism parts (sub-dial nodes visible through dial). Signal: screenshot shows gear geometry.

**SC-O8 — Dial textures (fal KTX2)**
- `[ ]` SC-O8.1 Guilloché dial shows a repeating geometric pattern texture (not solid color). Signal: screenshot of dial layer shows pattern, not flat fill.
- `[ ]` SC-O8.2 Meteorite dial shows a Widmanstätten crystalline texture. Signal: screenshot + advocate grade ≥4/5 on texture realism.
- `[ ]` SC-O8.3 Aventurine dial shows blue sparkle/mineral texture. Signal: screenshot + advocate grade ≥4/5.
- `[ ]` SC-O8.4 Enamel dial shows deep opaque color with no visible pixel artifacts. Signal: screenshot — no blocky JPEG artifacts; smooth gradient.
- `[ ]` SC-O8.5 Textures are KTX2 format (not PNG/JPG). Signal: DevTools network filter `*.ktx2` shows requests.
- `[ ]` SC-O8.6 Texture fetch uses Draco GLB + KTX2Loader. Signal: zero WASM instantiation errors in console.

---

### §9.5 — Liquid Glass / Crystal (F5.4)

**SC-O10 — Transmission budget**
- `[ ]` SC-O10.1 `window.__PRISM_TRANSMISSION_COUNT__` never exceeds 2 (hard guard). Signal: JS eval after any scene state + console for "TRANSMISSION LIMIT" guard log.
- `[ ]` SC-O10.2 Sapphire crystal over the watch renders with visible IOR lensing (objects behind refract). Signal: screenshot shows refracted watch face behind crystal dome, not flat glass.
- `[ ]` SC-O10.3 Atelier panel glass uses screen-space UV displacement (no second transmission render). Signal: `window.__PRISM_TRANSMISSION_COUNT__` ≤ 1 when panel is visible alone.
- `[ ]` SC-O10.4 Nav glass uses one shared render target reused across nav items. Signal: `window.__PRISM_TRANSMISSION_COUNT__` does not exceed 2 with crystal + panel both visible.

---

### §9.6 — World & Scroll (F6)

**SC-O9 — Continuous orrery world**
- `[ ]` SC-O9.1 Scrolling from scroll=0% to scroll=100% has no page navigation event. Signal: `performance.getEntriesByType('navigation').length === 1` after full scroll.
- `[ ]` SC-O9.2 Camera position changes continuously with scrollY (no position jump > 0.5 units per frame). Signal: sample camera position every 100ms during scroll, max delta ≤ 0.5.
- `[ ]` SC-O9.3 At scroll ~65%, Atelier hub geometry is visible (not disposed). Signal: screenshot at scroll=65% shows configurator components; scene graph `s6-atelier` nodes still mounted.
- `[ ]` SC-O9.4 Zero `THREE.Scene.remove` calls during a full scroll traverse. Signal: `console.count` hook on `remove` = 0.
- `[ ]` SC-O9.5 Web Audio orrery hum plays during scroll (not silence). Signal: `AudioContext.state === 'running'` during scroll.

---

### §9.7 — Responsive & Fallback (F7)

**SC-O11 — Progressive fallback**
- `[ ]` SC-O11.1 On forced WebGPU failure (`navigator.gpu = undefined`), WebGL2 canvas initializes within 5s. Signal: `evaluate(() => document.querySelector('canvas')?.getContext('webgl2') !== null)` = true.
- `[ ]` SC-O11.2 No blank white page: even on full WebGPU+WebGL2 failure, a static poster `<img>` renders. Signal: screenshot at T+5s shows non-white pixel content.
- `[ ]` SC-O11.3 Console shows zero unhandled rejection errors during fallback path.

**SC-O12 — Responsive breakpoints**
- `[ ]` SC-O12.1 At 375×812 viewport (mobile): bottom-sheet catalog visible, side-rail hidden. Signal: screenshot at that viewport shows bottom panel; no side-rail DOM element.
- `[ ]` SC-O12.2 At 375×812: tapping a swatch applies material (tap-only, no drag). Signal: JS eval of `store.build` after tap in mobile viewport.
- `[ ]` SC-O12.3 At 768×1024 (tablet): full side-rail visible; drag enabled. Signal: screenshot.

---

### §9.8 — Performance (F7)

**SC-O13 — Speed targets**
- `[ ]` SC-O13.1 LCP ≤ 3000ms. Signal: `evaluate(() => new PerformanceObserver(list => list.getEntriesByType('largest-contentful-paint')[0].startTime)` ≤ 3000.
- `[ ]` SC-O13.2 3D init deferred after LCP. Signal: `window.__THREE_INIT_TIME__` timestamp > `window.__LCP_TIME__`.
- `[ ]` SC-O13.3 60fps during configurator layer swap. Signal: `requestAnimationFrame` timing — no gaps > 20ms in a 2s window after a layer tap.
- `[ ]` SC-O13.4 Rapier drag maintains 60fps. Signal: same rAF check during pointer-move event on ghost cube.
- `[ ]` SC-O13.5 Asset bundle ≤ 250KB gzip for initial JS (deferred heavy chunks). Signal: DevTools Network tab total JS transferred ≤ 250KB before canvas init.

---

### §9.9 — Material Correctness (active invariants)

**SC-O14 — PBR materials, no regressions**
- `[x]` SC-O14.1 Watch case mesh has `roughness` and `metalness` uniforms (TSL PBR, not default MeshStandardMaterial). Signal: `evaluate(() => scene.getObjectByName('orr-atelier-watch-case')?.material?.roughness !== undefined)`.
- `[x]` SC-O14.2 Zero `THREE.MeshBasicMaterial` on any watch-part mesh (all lit). Signal: grep source + scene-graph assertion `node.material.type !== 'MeshBasicMaterial'`.
- `[ ]` SC-O14.3 After r184 npm patch bump: zero console errors from `THREE.WebGPURenderer`. Signal: `kv_check_console` 0 errors after `npm update` run.
- `[ ]` SC-O14.4 Crystal/glass layer node has `ior > 1.0` on its material. Signal: JS eval of `node.material.ior` ≥ 1.7 (sapphire ≈ 1.76).

---

### §9.10 — Benchmark (F8 — vision-graded)

**SC-O15 — Champion-level craft**
- `[ ]` SC-O15.1 Side-by-side screenshot vs best SliderRevolution 3D template: advocate agent grades Prism WINS on 3D realism, motion quality, and customization depth.
- `[ ]` SC-O15.2 Side-by-side vs Cartier W&W interactive: advocate grades Prism WITHIN-RANGE or BETTER on material craft and watch presentation.
- `[ ]` SC-O15.3 Side-by-side vs Apple product page (iPhone deep personalisation): advocate grades Prism MATCHES on configurator UX and delight.
- `[ ]` SC-O15.4 A non-technical user can build and save a complete watch in under 90 seconds with no instruction (usability advocate test).

---

### §9.11 — Always-On Invariants (any phase, grep + eval)

| INV | Check | Signal |
|-----|-------|--------|
| INV-G1 | Graph is the app | `typeof window.__PRISM_DEBUG_STORES__.graphSource !== 'undefined'` = true (the live zustand source graph drives the scene) |
| INV-G2 | No THREE.TextGeometry | `grep -r "TextGeometry" src/` = 0 results |
| INV-G3 | No DOM text in nodes | `grep -r "document\." src/lib/prism src/components/atelier` = 0 (except `devicePixelRatio`) |
| INV-G4 | No PixiJS | `grep -r "pixi" package.json src/` = 0 results |
| INV-G5 | Synchronous createNode | `createNode` return type is `THREE.Object3D` with no `await` at top level |
| INV-G6 | No raw secrets in graph | `grep -E "FAL_KEY\|sk-\|OPENAI" public/prism-mock/home/live-graph.json` = 0 |
| INV-G7 | Exactly 3 view modes | `grep -r "galaxy\|canvas\|preview-app" src/` all match; no `hub-world\|preview-hub\|editor\|split` literals |
| INV-G8 | Allowlist before import | `.claude/hooks/dependency-allowlist-check.py RUNTIME_ALLOW` contains every import in `package.json` that the hook checks |
| INV-G9 | Capability refs only | `functionBinding` nodes in live-graph.json carry no API keys, only `kind` + semantic params |
| INV-G10 | Transmission cap | `window.__PRISM_TRANSMISSION_COUNT__` ≤ 2 at all times when glass is visible |

---

## §10 — REAL PLAN FORWARD (F5.3 → close)

### §10.1 — Immediate: F5.3 Photoreal Dial Textures (~$1.50 of remaining $39.28 budget)

The highest-ROI spend is **dial textures only** — 7 KTX2 sets that make the configurator look real without requiring full part GLBs. Proxy geometry is good enough for demo.

**What to provision (in priority order):**

| Asset | Provider | Est. Cost | Why |
|-------|----------|-----------|-----|
| Guilloché texture 1500×1500 | fal-ai/flux-2-pro → KTX2 | $0.045 | Hero customization |
| Solarized gradient texture | flux-2-pro → KTX2 | $0.045 | Easy win, dramatic |
| Meteorite Widmanstätten texture | flux-2-pro → KTX2 | $0.045 | Unique, premium |
| Aventurine blue sparkle | flux-2-pro → KTX2 | $0.045 | Luxury signal |
| Enamel deep cobalt | flux-2-pro → KTX2 | $0.045 | Classic |
| Enamel cream/white | flux-2-pro → KTX2 | $0.045 | Clean variant |
| Alligator strap leather | flux-2-pro → KTX2 | $0.045 | Strap layer |
| Rubber strap texture | flux-2-pro → KTX2 | $0.045 | Sports variant |
| **Total** | | **~$0.36** | Well under cap |

**What to skip for now:** movement GLB ($0.675), case GLBs (3×$0.675), bezel GLBs (4×$0.675) — proxy geometry works for all configurator logic; photoreal parts are F5.4+ when real GLBs are justified.

**Wiring:** `scripts/provision-watch-parts.mjs --only dial-guilloche` etc. → KTX2 → bound via `materialSpec.map` on dial proxy mesh → `setMaterialSpec` live swap.

### §10.2 — F5.4: Sapphire Crystal + Liquid Glass (~1 session)

1. Add crystal mesh node on top of dial (thin dome, `MeshPhysicalNodeMaterial`, `ior: 1.76`, `thickness: 0.08`, `transmission: 0.95`, `roughness: 0.02`)
2. Add `__PRISM_TRANSMISSION_COUNT__` guard counter in `GraphScene` — throw/warn if > 2
3. Atelier panel chrome: screen-space UV displacement (Path C), no extra transmission target
4. Shared nav glass render target (one `WebGLRenderTarget`, reused)
5. **Gate:** SC-O10.1..O10.4 all PASS

### §10.3 — F6: World Weave (~2-3 sessions)

1. Add Lenis smooth scroll + GSAP ScrollTrigger to `AppShell`
2. Define scroll spline (`CatmullRomCurve3`) through all 6 hub positions
3. `scroll-path-scrub` primitive: animates `cameraAnim.position` + `targetAnim.position` on scroll
4. `scroll-orbit-scrub` primitive: drives orbital ring rotations
5. Atelier region at ~65% scroll: `sticky-pin` + component detach animation (parts fly from orbital shells to configurator tray)
6. Celestia: built watch flies to orbit position at ~85% scroll
7. Web Audio: orrery hum (synthesized drone, pitch shifts per shell), mechanical ticks during assembly
8. **Gate:** SC-O9.1..O9.5 all PASS; no seam between Arrival and Acquire

### §10.4 — F7: Responsive + Fallback + Perf (~1-2 sessions)

1. Viewport breakpoints: `useBreakpoint()` hook → `xs(375) | sm(768) | lg(1280)`
2. Mobile Atelier: bottom-sheet catalog (`position: fixed; bottom: 0`), one-layer-at-a-time, tap-to-apply
3. WebGPU detection: `navigator.gpu?.requestAdapter()` → if null, `WebGL2Renderer` fallback path
4. Static poster: `public/orrery-poster.webp` rendered once, displayed as `<img>` if both renderers fail
5. LOD: `THREE.LOD` on watch part meshes (3 levels: 2k/512/proxy)
6. `IntersectionObserver` on hub sections → dynamic `import()` of heavy node bundles
7. `web-vitals` library: hook `onLCP` → set `window.__LCP_TIME__`; defer Three.js init until after
8. **Gate:** SC-O11..O13 all PASS; SC-O12 responsive breakpoints confirmed via viewport resize

### §10.5 — F8: Polish + Close (~1 session)

1. Desktop-only path-traced hero stills: `THREE.WebGPURenderer` + `PTRenderer` (off-screen, export-only)
2. Post-processing: `BloomNode + DOFNode + SSAONode + VignetteNode + ChromaticAberrationNode + ACESToneMapping` via TSL `PostProcessing`
3. Easter eggs: secret double-tap on orrery reveals hidden skeleton movement
4. Full evidence pass: run ALL SC-O criteria, grade, save screenshots to `notes/verification/`
5. `prism-criteria-reviewer` final sweep
6. **Gate:** SC-O15.1..O15.4 all PASS (advocate side-by-sides)

---

### §10.6 — Harness: How Every Phase Runs

**Main agent launch pattern (from `~/Prototype_Prism/Design-trials/`):**
```bash
unset NODE_ENV
nohup /Users/loganbaird/.local/bin/claude -p "$(cat ORRERY-ATELIER-PROMPT.md)" \
  --model claude-opus-4-8 \
  --permission-mode bypassPermissions \
  --output-format text > orrery-atelier-run.log 2>&1 &
```

**Sentinel:** `./run-sentinel-orrery.sh` — arms auto-resume on session limits (15-min probe), max 6 resumes, macOS notifications, reads `ORRERY-ATELIER-RESUME-COMBINED.md` for resume.

**Check/go pattern:**
- User says `check` → monitor session reads run log tail + takes Playwright screenshot → reports plain-language + evidence
- User says `go` → monitor approves, agent continues or next sentinel fires
- Every phase boundary → agent commits AUTO-CKPT + appends to `notes/ORRERY-ATELIER-PROGRESS.md`

**Verification inside the agent** (Playwright MCP tools, NOT KripVerify):
- `mcp__playwright__browser_navigate` → `http://localhost:3000`
- `mcp__playwright__browser_wait_for` → canvas visible
- `mcp__playwright__browser_take_screenshot` → save evidence
- `mcp__playwright__browser_evaluate` → JS assertions against SC
- `mcp__playwright__browser_console_messages` → error check
- `mcp__playwright__browser_click` → drive the configurator like a user

**Model:** `claude-opus-4-8` (Fable 5 currently unavailable; switch back when available — sentinel probes `claude-fable-5` first; if probe returns "model not available" falls back to `claude-opus-4-8`)

**Ledger:** `kid-kode-landing/notes/ORRERY-ATELIER-PROGRESS.md` (append-only, one line per wave/phase)

**fal budget guard:** `notes/.atelier-provisioning.json` → `totalCostUsd` must stay ≤ $40; `provision-watch-parts.mjs` enforces this.

---

*End ORRERY No.7 prototype spec. Source: `notes/PROTOTYPE-V2-RESEARCH-BRIEF.md`, `memory/prism-prototype-vision.md`, canonical-3 specs, `kid-kode-landing/CLAUDE.md`.*
