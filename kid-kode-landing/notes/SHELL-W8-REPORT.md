# SHELL W-8 — SR Benchmark + Competitive Polish — RUN REPORT

Branch `codex/prism-recovery-harness-20260630`. Additive. Evidence law.
Founder goal on record: **exceed Slider Revolution on capability,
intuitiveness, ease of use, and visuals — in every way.**

Governing: Spec §14 (W8) · ENHANCEMENTS E2/E8/E9/E10/E11 · canonical-3 · DESIGN
LAW · V-STANDARD · NEAR-HUMAN-QA. Fresh SR reference set captured at run time
(2026-07-05, sliderrevolution.com).

---

## 1. What shipped (all additive; INV-18 respected)

### E8 — Scroll-scrub + section-aware in-view driver
- **Real in-view intersection**, not "play-once-on-mount". A new `inview`
  source on the shared `DriverHub` (`src/lib/prism/runtime/shared/drivers.ts`)
  carries per-node `{ visible, progress }`, fed **every frame** by the host
  projecting each built node's world-centre through the live camera
  (`SceneDriverHost` in `GraphScene.tsx`; `startDriverFeed` in
  `ConductorRuntime.tsx`). Pure geometry helper `runtime/shared/inview.ts`
  (three-free, DOM-free, node-tested).
- `driver-dispatch.ts`: `inview` split from `load` — fires on the **rising
  edge** (section scrolls on-screen), optional **replay** on exit; `scroll`
  gains a **section-relative** scrub mode (SR-style "each section scrubs its own
  animation as it passes"). Default global scroll unchanged (byte-stable).
- `inview` joins `AnimationDriverKind` + the canvas **DRIVER_OPTIONS** ("In
  View" chip); additive `AnimationBindingDriverOptions{section,replay}` with
  **Per-section / Replay** canvas toggles (AnimationFlyout).
- **Keyframe-editor compatible:** a Manual→Scroll→In View transport toggle in
  the KeyframeEditor drives the playhead from the live DriverHub, so a
  scroll/inview-bound timeline is provable in the keyframe editor itself.
- Tests: `W8.inview-driver.test.ts` + driver-dispatch section/replay cases (33
  driver + 43 helper/binding assertions green). INV-6 preserved (playback-only;
  keyframes never authored).

### E9 — Cursor-reactive driver + custom-cursor layer
- **CustomCursorLayer** (`src/components/shell/fx/`) generalizes the editor
  MagneticCursor into a per-app cursor authored on `PrismHub.cursor`
  (ring / halo / dot / beam, magnetic snap, accent, a11y-safe augment,
  reduced-motion + coarse-pointer inert). Look in `custom-cursor.css`; JS only
  sets transform/opacity/classList (chrome discipline — no imperative
  background/border/boxShadow).
- **Shipped-preview reactivity:** `ConductorRuntime` (the shared preview route
  runtime) now feeds the shared DriverHub — pointer, wheel→scroll, per-frame
  tick, per-node in-view projection — AND attaches each node's
  `animationBindings`, so scroll/pointer/inview animations + the cursor-reactive
  particle field are **LIVE in the shipped app**, not just the canvas. (Own
  rAF; never touches the camera-rail `setBeforeRender` slot.)
- The pointer attract/repel **field for particles** = existing catalog pointer
  primitives (attractor/repel/pointer-tilt) reading `hub.pointer`, proven
  reactive (measured below).

### E10 — Transition presets
- Additive `HubTransitionPreset` on `PrismHub` + curated **transition-presets.ts**
  registry: `curtain` (default) · `veil` · `dissolve` · `wipe` · `glass-sweep`,
  each with speed + accent. `resolveTransition()` + `presetForTone()` (intake
  tone → preset mapping).
- `HubSceneTransition` gains `uKind` (curtain/wipe/dissolve reveals) + `uAccent`
  uniforms and preset-scaled close/hold/open timing, read from the **target
  hub's** preset per navigation. Curtain+brass default is byte-identical to
  pre-E10.
- **Canvas exposure:** `SceneFxPicker` in the Hub Inspector — one-click cursor
  style (E9) + transition preset (E10), written via `updateHub`.

### E11 — Three SR-flagship recreations as real `.prism` graphs
- `src/lib/templates/graphs/*.ts` (a lean `node-helpers` authoring layer; every
  element a real `PrismNode` — INV-0.1) + `registry.ts` + a public
  `/templates/[slug]` preview route running each graph in the Prism runtime.
- **(a) Aperture — Kinetic Scroll Hero**, **(b) Atlas — Cursor Gallery**,
  **(c) Nova — Particle Showpiece**. Each: bright 3D-extruded type, photoreal
  materials, live scroll/pointer/inview reactivity, custom cursor, scene
  transition — fully functional in the runtime, editable in canvas/node editors.

### E2 — Template registry + real fork + gallery seeding
- `store.remixTemplate(tenantId, slug)` forks a registry template's **real
  `.prism` graph** into a fresh project (tenant-isolated — I11); tRPC
  `tenancy.project.remixTemplate` + client + `/app?remix=<slug>` post-auth
  handoff opens the builder.
- Both galleries seeded: the W6 **landing gallery** shows the 3 as **Live**
  cards (Preview → `/templates/[slug]`, Remix → sign-up → fork); the W4
  **dashboard TemplatesPanel** shows them with in-app Preview + Remix.

---

## 2. Side-by-side vs Slider Revolution (fresh reference 2026-07-05)

SR7 ships the exact template archetypes we recreated — so these are faithful
recreations, judged head-to-head:

| Our template (frame) | SR equivalent (reference) | Visual verdict |
|---|---|---|
| **Aperture / Kinetic Scroll Hero** — `hero-final.jpeg`: extruded-gold headline, photoreal materials backdrop, floating brass+sapphire plates, hero watch, scroll-scrub + cursor parallax | SR **"Scroll Driven Hero — Layered Parallax"** template | At-least-equal — real 3D bevelled type + photoreal PBR materials over SR's layered-image parallax |
| **Atlas / Cursor Gallery** — `gallery-final.jpeg`: pointer-tilt/parallax macro-material grid, magnetic beam cursor | SR one-page templates w/ section-aware in-view fades | At-least-equal — every tile continuously tilts/parallaxes to the pointer (not a pre-baked in-view fade) |
| **Nova / Particle Showpiece** — `showpiece-final.jpeg`: layered galaxy+nebula+firefly fields, cursor attract/repel constellation | SR **"Particle Effect One"** + Particle Effects Addon (3D clusters that orbit/attract/react to cursor) | At-least-equal — asset-free WebGPU particle layers with a live cursor force field |

**The structural win (superior on capability):** SR templates are *pre-baked
WordPress slider timelines* authored in a visual editor — they play back. Ours
are **real running apps in the Prism runtime**: forkable ("Remix") into an
account, **editable in the canvas + node editors**, reacting **continuously** to
scroll + pointer + in-view (measured, not scripted), with a config-driven custom
cursor and one-click scene transitions. Theirs is a slide; ours is an app.

| Capability | Slider Revolution 7 | Prism W8 |
|---|---|---|
| Scroll-scrub animation | ✅ pre-baked timeline | ✅ **live** DriverHub scrub (global + section-relative) |
| Section-aware in-view triggers | ✅ viewport-boundary fires | ✅ **real per-node camera-frustum intersection** driver |
| Cursor-reactive particles | ✅ addon presets | ✅ **runtime pointer force field** (attractor/repel) |
| Custom cursor | ➖ theme-level | ✅ **per-app config** (ring/halo/dot/beam, magnetic) |
| Scene transitions | ➖ per-slide | ✅ **preset library** (veil/dissolve/wipe/glass-sweep) in canvas |
| Output | WordPress slider markup | **running app** (canvas + node editors, verify-before-ship, forkable) |
| 3D | layered 2D + particle addon | **native WebGPU 3D scene** (PBR, extruded type, GLB) |
| Edit model | visual slider editor | **graph is the app** — canvas + node editors + prompt |

---

## 3. Measured reactivity (real Metal GPU, `window.__prismPreviewDrivers`)

- **E8 scroll scrub:** driving scroll 0 → 0.9 rotated the hero brass plate's mesh
  `rotation.x 0.61 → -0.49` (live scrubbed transform). 884 frame ticks / 1.5 s;
  4 stateful onTicks registered; scroll fed to the hub + per-node
  `setScrollProgress`.
- **E9 cursor field:** moving the pointer (-0.7,0.5)→(0.7,-0.5) moved the Nova
  attract/repel particles `[-0.384,-0.706] → [-0.157,-0.757]`
  (`particlesReactToCursor: true`). 3930 frame ticks; halo cursor mounted.
- **E9 custom cursor:** `custom-cursor-layer` mounts per template with the
  authored style (ring/beam/halo).
- **Text render:** all text nodes on all three templates confirmed
  `MeshPhysicalNodeMaterial` (real extruded 3D — never the flat-MSDF fallback).
- **Console:** 0 errors on every template route.

Evidence: `notes/verification/w8/{hero,gallery,showpiece}-final.jpeg` +
`EVIDENCE.md`.

---

## 4. Gate results

| Gate | Result |
|---|---|
| `npm run verify` (prism · repair-loop · galaxy · global-shell · parity-static · schema · tenancy) | **EXIT 0** |
| verify:tenancy (I11 isolation) | **35/35** |
| verify:collab | **15/15** |
| verify:share-matrix | **30/30** |
| tsc gate | **0 new** (9 = 9 baseline) |
| W8 test suite | **85 assertions green** (inview driver, transition presets, dispatch, bindings, UI helpers) |
| DL / chrome discipline | anti-drift hook enforced (no imperative bg/border/boxShadow; look in CSS) |

### Dual judges (0 MUST-FIX target)
- **prism-criteria-reviewer (fresh context): PASS — 0 MUST-FIX.** All six checks
  clear: schema additivity (INV-18), runtime DOM-purity (FP-05/INV-15), INV-6
  driver-decoupled playback, templates-are-nodes (INV-0.1), no forbidden
  patterns, tenant isolation (I11). Two non-blocking nits (TemplatesPanel data
  duplicates the registry; inline styles on one button).
- **user-advocate (fresh context, non-technical eye):** first pass raised
  **MF-1** (a garbled text row = the flat-MSDF fallback surfacing) + 3
  SHOULD-FIX. After the fix (outline pre-warm + removed outline-missing glyphs)
  the advocate **re-verified every previously-broken row at pixel level** and
  returned **PASS / PLEASED — 0 MUST-FIX**: MF-1 closed on evidence, SF-1
  (gallery footer clip) + SF-2 (hero plate inset) resolved, all three templates
  "premium, legible, and beautiful… SR-flagship class", capability-vs-SR claim
  "still credible… no losing side-by-side". One non-blocking taste note (SF-3:
  hero subhead contrast over the busy backdrop).

**BOTH JUDGES PASS — 0 MUST-FIX.**

---

## 5. Gotchas / learnings (for the next session)

- **Flat-MSDF glyph atlases don't bind in `ConductorRuntime`.** The mock app +
  the canvas render text fine because they use the **3D-extruded** path (font
  outlines), not the flat-MSDF atlas. The 3D path falls back to flat MSDF (→
  garbled red-dust glyphs) when the outline cache is cold OR a glyph (`·`, `—`)
  isn't in the outline set. Fix: **pre-warm outlines** for the graph's text
  chars before mount; keep template copy to outline-covered glyphs.
- **`mount-graph` does not apply the hub `lightingSpec`** — the shipped preview
  always uses the default (dim) rig. Lit materials (extruded text, GLB) read
  only via **reflection of a backdrop**; on pure black they're dark. Give
  dark-scene templates an atmospheric backdrop plane (also enriches them).
- **Beveled extruded text is forced metallic** (`text-object-3d.ts` metalness
  ≥ 0.35) and node materials ignore `.emissive` without an `emissiveNode`, so
  `glow` can't self-light it — it needs the backdrop reflection above.
- **Section-relative scroll scrub is CONSTANT under a fixed preview camera**
  (the node's screen position doesn't change), so use **global** scroll for
  visible scrub in a single-viewport hero; section scrub shines where the camera
  or content moves (canvas orbit / a scroll-journey camera).
- **`ConductorRuntime` never ticked the DriverHub frame** (only the editor's
  SceneDriverHost did) — stateful/time/particle primitives were frozen in the
  shipped preview until W8 added the rAF feed + `attachAnimationBindings`.
- **Next dev `.next` cache corrupts under heavy HMR + a parallel build**
  (`ENOENT … .next/server`) → 500s on the marketing routes; fix is a clean
  restart (`rm -rf .next && next dev`).

---

## 6. Founder actions

None required. All three templates render + function on the shipped preview
route and are Remix-able into an account. Optional polish (criteria nits: unify
TemplatesPanel with the registry; advocate SHOULD-FIX SF-3 hero subhead
contrast) is deferred, non-blocking.

Markers: `PRISM-SHELL-W8: RUN COMPLETE`
