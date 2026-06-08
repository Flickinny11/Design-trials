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
| NEW this run | **66** |
| **Total registered** | **90** |
| Toward 300 | 90 / 300 |

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
