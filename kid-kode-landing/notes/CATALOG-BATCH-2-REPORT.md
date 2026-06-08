# Catalog Batch 2 — +63 NEW animation primitives (toward 300)

**Date:** 2026-06-08 · **Model:** claude-opus-4-8 (Opus 4.8) · **Branch:** `prism-editor-build`
(NO commit — staged for Logan) · **Mode:** parallel dynamic-workflow build, evidence-verified,
**+ a real-GPU glass spot-check on Logan's Mac GPU**.

Continues the [ULTRACODE pilot](ULTRACODE-PILOT-REPORT.md) (24) and
[catalog batch 1](CATALOG-BATCH-REPORT.md) (66). This run built the next **63 NEW** primitives
against the frozen `Animatable` contract, in 3 internal verified waves (E/F/G).

---

## TL;DR

**63 / 63 new primitives built and contract-conformant on the first orchestration of each wave.**
The catalog grew **90 → 153** (51% of the spec's ≥300 target). Every primitive registers in the
shared Animatable registry, ships a live `ControlSchema`, and appears in the Animation Picker.
The transmissive-glass family — flagged in batch 1 as headless-only-unverifiable — was **rendered
on a real WebGPU/Metal GPU** this run and **all 11 captured with real refraction** (backend=`webgpu`,
device-lost 0).

| Gate | Result |
|---|---|
| Built + contract-conformant (headless vitest) | **63 / 63** new (full suite **475/475**, 153 files) |
| `tsc --noEmit` baseline-diff gate | **0 net new type errors** (2 caught mid-run, fixed centrally) |
| Browser: renders (shared rig, 153 tiles) | **153 / 153** |
| Browser: plays / controls / fully-verified | **147 / 146 / 144** of 153 · of the 63 new: **60/63** fully verified |
| Device-lost across all tiles · real console errors | **0 · 0** · hover-plays proven |
| Art-fidelity stage-1 (metrics, 63 new) | **44 PASS / 19 polish** — first-hand vision pass → ~5 genuine nits, ~14 false-positives |
| Parallel-build failures · file collisions | **0 · 0** |
| Dependency-guard / forbidden-pattern blocks reaching final | **0** (no new deps) |
| **Real-GPU glass spot-check (Logan's GPU, WebGPU/Metal)** | **11/11 captured · backend `webgpu` · device-lost 0** |

---

## Running total toward 300

| | Count |
|---|---|
| Pilot (pre-existing) | 24 |
| Batch 1 | 66 |
| **Batch 2 (this run)** | **63** |
| **Total registered** | **153** |
| Remaining toward ≥300 | ~147 |

By category after this run (registry barrel, auto-generated):
`transform 19 · fade 8 · scroll 11 · pointer 8 · text 16 · wave 13 · displacement 10 · mask 6 ·
blur 4 · shimmer 10 · glass 12 · caustics 5 · volumetric 9 · smoke 6 · particles 16` = **153**.

---

## New primitives by category (63)

**transform — 3D reveals (8):** `flip-3d` (full half-turn + edge-on foreshorten), `cube-rotate`
(cube-face arc), `card-fold` (crease unfold), `unfold` (springy accordion), `door-open` (left/right
hinge swing), `zoom-rotate-in` (zoom + full spin), `depth-pop` (z-rush + perspective scale),
`tumble` (dual-axis X+Y).

**fade (3):** `fade-up` (fade + drift up), `fade-scale` (fade from 0.9), `cross-dissolve` (tinted
mid-dip film cross-fade).

**scroll (4):** `scroll-zoom` (scroll-scrubbed scale), `scroll-fade-stack` (enter/exit band),
`scroll-skew` (velocity shear), `scroll-color-shift` (scroll-driven hue/emissive).

**pointer (2):** `pointer-tilt-3d` (trading-card 3D tilt to cursor), `spotlight-follow` (TSL emissive
hotspot tracks pointer).

**text — kinetic typography (7):** `split-3d` (double-door halves), `liquid-text` (continuous liquid
wave loop), `stretch-text` (elastic squash-stretch), `decode-text` (sequential decrypt lock),
`text-blur-in` (per-glyph focus resolve), `text-pop-each` (backOut per-glyph pop), `text-spotlight`
(emissive sweep band).

**wave — cloth/hair/water (5):** `cloth-sway` (top-pinned drape billow), `hair-sway` (in-plane strand
sway), `banner-flutter` (vertical gusty travel), `water-surface` (calm interfering ripples),
`wind-ripple` (moving gust front).

**mask / wipe (4, TSL alpha):** `wipe-linear` (directional front), `clock-wipe` (radial hand),
`blinds-wipe` (venetian slats), `diamond-wipe` (expanding diamond/square).

**blur (2):** `motion-blur-streak` (velocity-stretch smear), `defocus-pulse` (looping focus breathing).

**displacement / transitions (5):** `paint-spread` (TSL center-out organic blot), `splat-reveal` (TSL
metaball-union splats), `crumble` (CPU gravity-fall shards), `dissolve-burn` (TSL ember-rim burn),
`voxelize` (CPU cube scatter→assemble).

**shimmer / light-refraction (5, TSL):** `light-sweep` (specular band), `caustic-shimmer` (soft
interference), `prism-spectrum` (rolling spectral bands), `glint-streak` (anamorphic lens streaks),
`pearlescent` (pastel mother-of-pearl).

**glass / dispersion (4, TSL transmission ⚑):** `chromatic-aberration` (RGB-split fringe),
`bevel-glass` (chamfered-edge refraction), `water-droplet` (water lens, sphere), `ice-glass`
(crystalline crack facets).

**caustics (2, TSL):** `pool-caustics` (sharp light-net cells), `caustic-net` (thin filament threads).

**smoke / fluid (3, TSL):** `ink-bloom` (turbulent diffusing cloud), `smoke-plume` (rising curling
plume), `dust-cloud` (drifting haze w/ motes).

**volumetric (2, TSL):** `campfire` (tight blackbody flame), `aurora` (waving green→violet curtains).

**particles — GPGPU compute / physics (7, deterministic `THREE.Points`):** `swarm` (curl-field +
attractor), `flocking` (coherent migrating band), `attractor` (Lorenz/Aizawa orbit), `morph-cloud`
(sphere↔cube↔torus blend), `gravity-drop` (floor-bounce physics), `explosion` (radial burst),
`vortex` (inward whirlpool).

`⚑` = transmission/IBL — real-GPU spot-checked this run (see below).

---

## Per-wave orchestration behavior

Each wave = N parallel Opus subagents (1 primitive each, disjoint `<name>.ts` + test files), each
self-verifying with `vitest` on its own test, returning a structured result. The orchestrator (this
session) then regenerated the registry barrel (`catalog-wire-barrel.mjs`), ran the full vitest suite
+ the `tsc` baseline-diff gate centrally, and wrote incremental progress — **once per wave, after the
fan-out** (so agents never contend on the shared barrel).

| Wave | Theme | N | Wall-clock | Subagent tokens | Built ok (1st orchestration) |
|---|---|---|---|---|---|
| E | transform/fade/scroll/pointer/text (CPU) | 21 | ~2.8 min | 1.73 M | 21/21 |
| F | text/wave-cloth/mask(TSL)/blur/displacement/physics | 21 | ~3.8 min | 1.80 M | 21/21 |
| G | shimmer/glass/caustics/smoke/volumetric/GPGPU particles (TSL) | 21 | ~3.5 min | 1.85 M | 21/21 |
| **Total** | | **63** | **~10.1 min** | **~5.38 M** | **63/63** |

**Contention / races:** zero. Every agent wrote 2 disjoint files; the shared barrel `index.ts` was
regenerated once by the orchestrator after each fan-out. Agents ran no dev server / no browser → zero
GPU/port contention during the parallel phase.

**Failures caught & fixed by the loop (fix-don't-skip held — no dep downgrade, no contract weakening):**
1. **`splat-reveal.ts` (Wave F)** — TSL metaball-union accumulator (`let acc = float(0)`) hit the
   narrow fluent `VarNode` typing when reassigned via `max(...)`; the `smoothstep().mul(uniform)`
   receiver also tripped a strict-overload error. **vitest passed; the central `tsc` baseline-diff
   gate caught it** (exactly the gap the gate exists to close). Fixed centrally with the canonical
   `type TNode = any` opaque-node alias (mirrors `foam.ts`/`clouds.ts`) + casting the receiver.
2. **`pool-caustics.ts` (Wave G)** — same class: the voronoi `dMin` accumulator (`let dMin = float(8)`
   reassigned via `min(...)`). Fixed with the opaque-node `any` annotation.

Both fixes are type-only (no behavior change); vitest stayed green for both. Net `tsc`: **0 new errors**
(baseline 10, unchanged).

---

## Verification

### Layer 1 — contract + determinism (headless vitest, authoritative for the contract)
Full animatable suite: **475 / 475 tests across 153 files** (3+ per new primitive: `runConformance`,
a deterministic PLAYS assertion on CPU-observable state, and a CONTROLS assertion). GPU-only node-material
effects publish live `uniform()` handles on `target.userData.<name>` (the contract's documented scratch
space) and assert on `uniform.value` / transform / particle-position state, never on rendered pixels.
`tsc --noEmit` baseline-diff: **0 new type errors**.

### Layer 2 — browser renders / plays / controls (shared preview rig, headless swiftshader)
_`node scripts/verify-catalog.mjs` against one `next dev`, all 153 tiles through the ONE shared
WebGPU→WebGL2 context._

```
{ total:153, renders:153, plays:147, controls:146, fullyVerified:144,
  realConsoleErrorCount:0, deviceLostTotal:0, contextLostConsoleCount:0,
  hoverPlaysProof:true, backend:"webgl" }
```

- **renders 153/153 · device-lost 0 · real console errors 0 · hover-plays proven.** The 154-tile shared
  rig held at zero GL-context churn — it scales to 153.
- **Of the 63 new: 60 fully verified in-browser** (render+play+controls). The **3 soft misses are all
  explainable, all vitest-green**:
  - `scroll-skew` (controls miss) — **scroll-velocity-driven**: a paused frame has zero velocity, so a
    frozen frame doesn't shear (same class as batch-1's input-driven `hover-lift`). vitest proves
    consecutive distinct scroll values produce nonzero `rotation.z`.
  - `bevel-glass`, `water-droplet` (play / play+controls miss) — **transmissive glass under-renders
    headless swiftshader** (the exact reason for the real-GPU spot-check). Both render with real
    refraction on the WebGPU GPU (below). vitest proves their uniforms animate.

---

## Gallery + art-fidelity (mid-animation frames)

All 63 new-primitive frames are saved under `notes/verification/catalog-batch-2/tiles/` (+ the
full-picker shot `catalog-full-153.png` and `verify-catalog-report-153.json`).

**Stage-1 art-fidelity (objective metrics): 44 PASS / 19 NEEDS-POLISH** of 63. A first-hand **vision
spot-check** (frames opened and judged directly across every category) sorts the 19 into four buckets —
**none are functional breakages** (same pattern batch-1's vision pass established):

| Bucket | Primitives | Verdict |
|---|---|---|
| **Sparse-by-design particle field** (bright points on the correct dark bg; the metric's "too dark" is the known false-positive) | swarm, vortex, explosion, flocking, gravity-drop, morph-cloud, attractor | **Look-correct** — `swarm` reads as a blue school, `voxelize`/cubes scatter cleanly. Pass on intent. |
| **Capture-timing** (one-shot caught at a low-energy frame — edge-on / pre-reveal / early fade) | flip-3d, fade-up, zoom-rotate-in, decode-text, wipe-linear, dissolve-burn, voxelize | **Works** — e.g. `flip-3d` caught at a dim edge-on angle. Fix = capture at a mid-phase hold (carried-forward harness item). |
| **Real-GPU transmission under-render (⚑)** | bevel-glass, chromatic-aberration, water-droplet | **Renders on real GPU** — see the spot-check; headless swiftshader can't draw transmission. |
| **Genuine subtle-TSL thumbnail punch** | ink-bloom, dust-cloud | **Real (minor) nit** — dark-on-dark by nature (ink in water / thin dust); a brightness/tint or lighter backdrop gives thumbnail punch. |

**Premium PASS exemplars confirmed by eye:** **aurora** (waving green→violet curtains), **campfire**
(warm blackbody flame), **prism-spectrum** (rolling pastel rainbow over a UI card), **voxelize**
(blue/purple cube scatter), **cloth-sway** (billowing drape), **pool-caustics** (bright caustic cells),
**light-sweep** (glossy specular sheen), **clock-wipe** (radial alpha front).

> Net genuine art-polish surface ≈ **5 / 63** (2 subtle-TSL: ink-bloom, dust-cloud + 3 clear-glass that
> want an environment backdrop — see below) — even cleaner than batch-1's ~8/66. The other 14 flags are
> capture-timing / sparse-field metric false-positives the vision pass clears.

---

## GLASS / TRANSMISSION REAL-GPU SPOT-CHECK ✅ (Logan's Mac GPU — authorized)

**The headless swiftshader rig under-renders transmission/IBL** (batch 1 flagged 6 glass primitives as
"functionally verified, look unconfirmable headless"). This run drove the **real installed Google Chrome
148 in HEADED mode with hardware GPU** (`scripts/verify-catalog-realgpu.mjs`, `channel:'chrome'`,
`--enable-unsafe-webgpu`, NO swiftshader), focusing each glass primitive into the shared-rig detail
viewport at a mid-animation hold.

**Result: the rig initialized on `backend: "webgpu"` (real WebGPU/Metal), device-lost 0, and all 11
transmissive-glass primitives captured with REAL refraction** — the headless under-render is resolved.
Frames: `notes/verification/catalog-batch-2/real-gpu/*.png` (+ `real-gpu-report.json`).

| Primitive | Origin | Real-GPU look (judged first-hand) |
|---|---|---|
| `iridescent-glass` | batch 1 | **Vivid** — full chromatic rainbow ring + specular glints (was ~empty headless) |
| `dispersion` | batch 1 | **Vivid** — warm copper refractive sphere, edge dispersion + glints |
| `liquid-glass` | batch 1 | **Premium** — dark glass with anamorphic refracted light streaks |
| `crystal-facet` | batch 1 | **Premium** — faceted crystal with bright facet specular highlights |
| `glass-refraction` | pre-pilot | **Premium** — vivid purple refractive sphere with env glints |
| `ice-glass` | **batch 2 NEW** | **Premium** — crystalline crack-facet normal over a cold-tinted card |
| `bevel-glass` | **batch 2 NEW** | **Good** — clear panel, visible bevel rim + corner glints |
| `chromatic-aberration` | **batch 2 NEW** | **Good** — clear card with warm RGB-split edge fringe + highlight |
| `frosted-glass` | batch 1 | **Real but subtle** — frosted sphere, soft subsurface glow + micro-roughness grain |
| `refraction-warp` | batch 1 | **Real but subtle** — clear sphere silhouette + refracted glints |
| `water-droplet` | **batch 2 NEW** | **Real but subtle** — droplet silhouette, surface-tension wobble + refractive glints |

**Honest sub-finding (the one remaining art lever, NOT a defect):** the 3 "real but subtle" entries
(`water-droplet`, `refraction-warp`, `frosted-glass`) are **clear/near-clear glass over the pure-dark
catalog backdrop** — clear glass only shows where it refracts or reflects *something*, so on a near-black
background they read mainly at edges/highlights. They render correct transmission on the real GPU; an
**environment map / lit backdrop behind the glass subject** is what would make them visibly magnify and
sparkle. This is a preview-rig art decision, recorded for the rig owner — no primitive code change is
implied. Nothing was faked; every frame is a real WebGPU capture.

---

## Orchestration metrics (summary)

- **63/63** primitives built ok on the **first** orchestration of every wave (E/F/G).
- **~10.1 min** total build wall-clock across 3 waves; **~5.38 M** subagent tokens; peak parallelism
  ~14 (cap `min(16, cores−2)` per workflow).
- **0** parallel-build failures, **0** file collisions, **0** new dependencies (dependency-allowlist
  guard never tripped).
- **2** central TSL-typing fixes (splat-reveal, pool-caustics) — both surfaced by the tsc baseline-diff
  gate after vitest passed, both fixed without weakening the contract or downgrading anything.
- Reusable harness extended: `notes/catalog-batch-2-workflow.mjs` (specs embedded, wave-selectable via
  `{batchLabel}`) + `notes/catalog-batch-2-specs.json` (63 specs) + the new
  `scripts/verify-catalog-realgpu.mjs` (headed real-GPU spot-check).

---

## What remains (toward ≥300)

~147 primitives remain (153/300, 51%). This run stopped at a clean wave boundary (63, top of the 50–70
target) per the resumable-batch instruction. The same pipeline (specs → parallel agents → wire-barrel →
vitest + tsc gate → browser/art pass → real-GPU spot-check) is ready to continue. Candidate fill for the
next run: more 3D-transform reveals, more kinetic typography, additional GPGPU compute particles
(curl-noise fields, SPH-style fluid points), more cloth/hair/physics, additional fluid/volumetric
variants, and the optional preview-rig environment-backdrop work that would let the clear-glass subset
sparkle at tile size.

---

## Plain-language summary (for Logan)

We added **63 brand-new animation effects**, taking your catalog from 90 to **153 — past the halfway mark
to 300**. They cover the categories you asked for: 3D-flip/cube/door/fold card reveals, more kinetic text
(liquid, decode, split, stretch, pop, spotlight), cloth/hair/banner/water sway, four new mask wipes
(linear, clock, blinds, diamond), paint-spread / splat / burn / voxelize / crumble transitions, new
shimmer (light-sweep, prism-spectrum, pearlescent, glint streaks, caustic shimmer), four new glass types
(chromatic, beveled, water-droplet, ice), pool caustics, ink-bloom / smoke-plume / dust fluid, campfire
and aurora, and seven physics/compute particle systems (swarm, flocking, strange-attractor, shape-morph
cloud, gravity bounce, explosion, vortex).

**How it was built:** the same way as last time — **many assistants built them at once**, in three waves
of 21, all **63 done on the first try with zero collisions**, in about **10 minutes of build time**. After
each wave the registry was rebuilt and two automatic checks ran: a strict type-check and the full test
suite — **475 tests, all green**. Two small type slips on shader effects were caught by the type-check and
fixed properly (nothing skipped or weakened).

**The glass question from last time is answered.** Last batch I flagged the see-through glass effects as
"can't fully verify without a real graphics card." This run I used **your Mac's GPU** (with your okay):
real Chrome rendered the catalog on **real WebGPU**, and **all 11 glass effects captured with real
refraction** — the iridescent and dispersion ones are genuinely gorgeous (rainbow rings, copper
refraction), and the new ice-glass looks great. The one honest note: three of the *clear* glass effects
(water droplet, refraction warp, frosted) are real but look subtle on the pure-black catalog background —
clear glass only sparkles when there's something behind it to bend; putting a lit backdrop behind them in
the preview would make them pop. No effect is broken.

**Everything is staged, not committed** — it's all there for your review on `prism-editor-build`.
```
Catalog: 24 (pilot) + 66 (batch 1) + 63 (batch 2) = 153 / 300.
```
