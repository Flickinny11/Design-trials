# Catalog Batch Run — incremental progress (resumable)

**Model:** claude-opus-4-8 · **Branch:** `prism-editor-build` (NO commit — staged for Logan) ·
**Goal:** grow the Animation Primitive Catalog toward ≥300 (PRISM-CANVAS-EDITOR-SPEC §8.3).
**This run target:** +50–70 NEW primitives (resumable; another run continues).

Pipeline per batch: parallel Opus agents (1/primitive, disjoint files) → per-agent vitest →
central wire-barrel → full vitest suite → tsc baseline-diff gate. Browser + art-fidelity run
once at the end over everything.

## Running total

| | Count |
|---|---|
| Pre-existing (pilot) | 24 |
| Batch 1 | 66 |
| **Total before batch 2** | **90** |
| Toward 300 (before batch 2) | 90 / 300 |

### Batch 2 (this run, target +50–70) — ✅ COMPLETE (+63, catalog 90 → 153 / 300)

Verification: browser shared-rig **renders 153/153, plays 147, controls 146, device-lost 0, console
errors 0, hover-plays proven**; of the 63 new, **60/63 fully verified** (3 soft misses = scroll-skew
input-driven + bevel-glass/water-droplet headless-transmission, all vitest-green). Art-fidelity
stage-1 **44 PASS / 19 polish** → first-hand vision pass: ~5 genuine nits, ~14 false-positives.
**Real-GPU glass spot-check (Logan's GPU): backend `webgpu`, 11/11 glass captured with real
refraction, device-lost 0.** Full write-up: `CATALOG-BATCH-2-REPORT.md`.


| Wave | Theme | N | ok | wall | tokens | gate |
|---|---|---|---|---|---|---|
| E | transform/fade/scroll/pointer/text (CPU) | 21 | **21/21** | ~2.8 min | 1.73 M | vitest **342/342** (111 files) · tsc **10** (0 new) ✅ |
| F | text/wave/cloth/mask/blur/displacement/physics | 21 | **21/21** | ~3.8 min | 1.80 M | vitest **409/409** (132 files) · tsc **10** (1 new TSL error in `splat-reveal` fixed centrally → 0 new) ✅ |
| G | shimmer/glass/caustics/smoke/volumetric/GPGPU particles | 21 | **21/21** | ~3.5 min | 1.85 M | vitest **475/475** (153 files) · tsc **10** (1 new TSL error in `pool-caustics` fixed centrally → 0 new) ✅ |

**Batch-2 BUILD COMPLETE: 63/63 new primitives. Catalog 90 → 153 / 300.**

Wave G central fix (fix-don't-skip): `pool-caustics.ts` voronoi `dMin` accumulator hit the same narrow
VarNode typing as splat-reveal; fixed with the opaque-node `any` type. No behavior change; vitest stayed green.

Category totals after batch 2 (registry barrel): transform 19 · fade 8 · scroll 11 · pointer 8 · text 16 ·
wave 13 · displacement 10 · mask 6 · blur 4 · shimmer 10 · glass 12 · caustics 5 · volumetric 9 · smoke 6 ·
particles 16 = **153**.

Build orchestration: 3 waves × 21 parallel Opus agents, **63/63 ok on first orchestration of each wave**,
~10.1 min total build wall-clock, ~5.38 M subagent tokens, 0 parallel-build failures, 0 file collisions
(every agent wrote 2 disjoint files; the shared barrel regenerated once per wave by the orchestrator). The
only central fixes were 2 TSL-typing slips that vitest passed but the tsc baseline-diff gate caught — exactly
the gap the gate exists to close.

Wave F central fix (fix-don't-skip): `splat-reveal.ts` TSL metaball-union accumulator hit the narrow
fluent VarNode typing (vitest passed, tsc caught it). Fixed by the canonical `type TNode = any` node
alias (mirrors `foam.ts`/`clouds.ts`) + casting the `smoothstep().mul(uniform)` receiver. No behavior
change; vitest stayed 3/3.

Build phase COMPLETE: 66/66 new primitives, vitest **277/277**, tsc gate **0 new errors**.
Browser + art-fidelity verification: see below.

## Batch A — tweens & motion — DONE ✅ (16/16)

transform×8, fade×4, scroll×4. All CPU except `dissolve-noise` (TSL opacity).
Build: 16 parallel agents, ~2.3 min, 1.30M subagent tokens, 16/16 ok first orchestration.
Gates: vitest **123/123** (whole animatable suite) · tsc baseline-diff **0 new errors**.

- transform: flip, bounce, elastic, overshoot, rotate-in, swing, float (loop), jelly
- fade: flash, blink (loop), fade-through-black, dissolve-noise (TSL)
- scroll: sticky-pin, horizontal-scroll, reveal-mask-scroll, scrub-morph

## Batch B — interaction, text, surface — DONE ✅ (17/17)

scroll×1, pointer×4, text×6, blur×1, mask×1 (iris-wipe TSL), wave×4.
Build: 17 parallel agents, ~2.7 min, 1.40M subagent tokens, 17/17 ok first orchestration.
Gates: vitest **176/176** · tsc baseline-diff **0 new errors**.

- scroll: scroll-rotate-3d · pointer: cursor-trail, parallax-layers, hover-lift, repel
- text: typewriter, glitch-text, neon-flicker-text, wave-text (loop), text-extrude, text-cascade
- blur: zoom-blur · mask: iris-wipe (TSL opacity mask)
- wave: flag-wave, jelly-surface, ripple-pool, ocean-fft (CPU vertex displacement)

## Batch C — glass/shimmer/caustics/displacement — DONE ✅ (16/16, TSL-heavy)

wave×2 (ink-spread, foam), glass×6, shimmer×4, caustics×2, displacement×2.
Build: 16 parallel agents, ~3.4 min, 1.39M subagent tokens, 16/16 ok first orchestration.
Gates: vitest **226/226** · tsc baseline-diff **PASS** (1 new error caught in metallic-sheen.test.ts
— a missing `as unknown` cast — fixed centrally; then 0 new). **8 flagged for real-GPU** art
follow-up (transmissive glass family under-renders headless swiftshader).

- wave(TSL): ink-spread, foam · glass(TSL): dispersion⚑, refraction-warp⚑, iridescent-glass⚑, frosted-glass⚑, liquid-glass⚑, crystal-facet⚑
- shimmer(TSL): holographic, metallic-sheen, iridescence (oil-slick), sparkle-glints
- caustics(TSL): caustics-ripple, underwater-caustics · displacement: shatter (CPU), pixel-dissolve (TSL)
- ⚑ = flagged for real-GPU spot-check (transmission/IBL).

## Batch D — particles, smoke, volumetric — DONE ✅ (17/17)

displacement×2 (melt, glitch-displace — CPU), particles×7 (CPU Points), smoke×2 (TSL), volumetric×6 (TSL).
Build: 17 parallel agents, ~6.2 min, 1.48M subagent tokens, 17/17 ok first orchestration.
Gates: vitest **277/277** (full animatable suite) · tsc baseline-diff **0 new errors**.

- displacement: melt, glitch-displace · particles: confetti, embers(loop), snow(loop), bubbles(loop), fireflies(loop), rain(loop), fountain(loop)
- smoke(TSL): wispy-smoke, steam · volumetric(TSL): fire-flame, clouds, fog, light-shafts, nebula, plasma

## Verification — DONE ✅

- **Browser (shared rig, 90 tiles):** renders **90/90**, plays **87/90**, controls **86/90**,
  fullyVerified **86/90**, device-lost **0**, console errors **0**, hover-plays **true**, backend
  webgl. The 4 soft misses (hover-lift, iris-wipe, refraction-warp, clouds) are explainable
  harness/GPU artifacts — all green in the headless contract+determinism suite.
- **Art-fidelity stage-1:** 43 PASS / 23 NEEDS-POLISH; a first-hand vision spot-check sorts the 23
  into sparse-particle false-positives, capture-timing artifacts, real-GPU glass under-render, and
  ~4 genuine subtle-TSL brightness nits (~8/66 genuine art surface).
- **Frames:** 66 new-primitive frames + full-picker shot + report JSON in
  `notes/verification/catalog-batch-1/`.

Full write-up: `notes/CATALOG-BATCH-REPORT.md`. **No commit — staged for Logan. HEAD =
prism-editor-build.**

---

## FINISH RUN (target ≥300) — resumable, 8 waves W1–W8 (+159 → 312)

Harness: `notes/catalog-finish-workflow.mjs` (159 specs, wave-selectable {batchLabel:'W1'..'W8'}).
Reuses `catalog-wire-barrel.mjs` + `scripts/verify-catalog.mjs` + `scripts/verify-catalog-realgpu.mjs`.
tsc baseline = 10 (unchanged target). No collisions with the 153 existing; no export-name mismatches.

| Wave | Theme | N | ok | catalog total | tsc | vitest |
|---|---|---|---|---|---|---|
| W1 | transform 3D reveals + fade | 20 | **20/20** | 173 | 10 (0 new) ✅ | 537/537 (173 files) ✅ |
| W2 | text kinetic typography | 20 | **20/20** | 193 | 10 (0 new) ✅ | 598/598 (193 files) ✅ |
| W3 | scroll + pointer + blur | 20 | **20/20** | 213 | 10 (0 new) ✅ | 661/661 (213 files) ✅ |
| W4 | wave/cloth/water + mask wipes | 20 | **20/20** | 233 | 10 (0 new) ✅ | 722/722 (233 files) ✅ |
| W5 | displacement/transitions + smoke/fluid | 20 | **20/20** | 253 | 10 (0 new) ✅ | 782/782 (253 files) ✅ |
| W6 | shimmer + glass/dispersion (⚑10 glass real-GPU) | 20 | **20/20** | 273 | 10 (0 new) ✅ | 842/842 (273 files) ✅ |
| W7 | caustics + volumetric (fire/godray/aurora/nebula) | 20 | **20/20** | 293 | 10 (0 new) ✅ | 903/903 (293 files) ✅ |
| W8 | particles GPGPU/physics/collision | 19 | **19/19** | **312** | 10 (0 new) ✅ | 960/960 (312 files) ✅ |

**BUILD COMPLETE: 159/159 new primitives across 8 waves. Catalog 153 → 312 / 300 (≥300 ✅, +12 margin). Zero central fixes — every wave built ok on first orchestration. tsc baseline 10 held throughout.**
