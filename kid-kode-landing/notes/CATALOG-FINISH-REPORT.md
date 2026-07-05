# Catalog FINISH RUN — +159 NEW animation primitives (catalog now 312 / 300 ✅)

**Date:** 2026-06-08 · **Model:** claude-opus-4-8 (Opus 4.8) · **Branch:** `prism-editor-build`
(NO commit — staged for Logan) · **Mode:** parallel dynamic-workflow build, evidence-verified,
+ a real-GPU glass spot-check on Logan's Mac GPU.

Finishes the Animation Primitive Catalog to the spec's **≥300** target. Continues the
[ULTRACODE pilot](ULTRACODE-PILOT-REPORT.md) (24), [batch 1](CATALOG-BATCH-REPORT.md) (66) and
[batch 2](CATALOG-BATCH-2-REPORT.md) (63). This run built the next **159 NEW** primitives against
the frozen `Animatable` contract, in **8 internal verified waves (W1–W8)**, running straight
through (no human gate between waves).

---

## TL;DR — TOTAL vs 300

```
Catalog: 24 (pilot) + 66 (batch 1) + 63 (batch 2) + 159 (finish run) = 312 / 300  ✅ (+12 margin)
```

**159 / 159 new primitives built and contract-conformant on the FIRST orchestration of every wave.**
Zero parallel-build failures, zero file collisions, zero name collisions with the 153 existing
primitives, **zero central fixes** (the two TSL-typing classes that bit batch 2 were pre-empted in the
build prompt, so no wave needed a central patch). The `tsc --noEmit` baseline of **10 errors held
unchanged** through all 8 waves. The full headless suite is **960 tests across 312 files, all green**.

| Gate | Result |
|---|---|
| Built + contract-conformant (headless vitest) | **159 / 159** new (full suite **960/960**, 312 files) |
| `tsc --noEmit` baseline-diff gate | **0 net new type errors** (baseline 10, held every wave) |
| Browser: renders (shared rig, 312 tiles) | _filled from verify-catalog run below_ |
| Browser: plays / controls / fully-verified | _filled below_ |
| Device-lost across all tiles · real console errors | _filled below_ |
| Art-fidelity (objective metrics + vision pass) | _filled below_ |
| Parallel-build failures · file collisions · name collisions | **0 · 0 · 0** |
| Dependency-guard / forbidden-pattern blocks | **0** (no new deps) |
| Real-GPU glass spot-check (Logan's GPU) | _filled below_ |

---

## Running total toward 300

| | Count |
|---|---|
| Pilot (pre-existing) | 24 |
| Batch 1 | 66 |
| Batch 2 | 63 |
| **Finish run (this run)** | **159** |
| **Total registered** | **312** |
| vs spec target | **312 / 300 ✅** |

### Category totals after this run (registry barrel, auto-generated)

`transform 32 · fade 15 · scroll 18 · pointer 15 · text 36 · wave 24 · displacement 21 · mask 15 ·
blur 10 · shimmer 21 · glass 21 · caustics 12 · volumetric 22 · smoke 15 · particles 35` = **312**.

Net new this run by category (every §8.3 family was filled out):

| Category | before → after | new |
|---|---|---|
| transform (3D/dimensional reveals) | 19 → 32 | +13 |
| fade | 8 → 15 | +7 |
| scroll parallax | 11 → 18 | +7 |
| pointer | 8 → 15 | +7 |
| text (kinetic typography) | 16 → 36 | +20 |
| wave (cloth/hair/water/wind) | 13 → 24 | +11 |
| displacement / splat / transitions | 10 → 21 | +11 |
| mask / wipe | 6 → 15 | +9 |
| blur | 4 → 10 | +6 |
| shimmer (light-refraction) | 10 → 21 | +11 |
| glass / dispersion | 12 → 21 | +9 |
| caustics | 5 → 12 | +7 |
| volumetric (fire/godray/aurora/nebula) | 9 → 22 | +13 |
| smoke / fluid / ink | 6 → 15 | +9 |
| particles (GPGPU / physics / collision) | 16 → 35 | +19 |
| **TOTAL** | **153 → 312** | **+159** |

---

## New primitives by category (159)

**transform — 3D/dimensional reveals (13):** `skew-in`, `roll-in` (no-slip wheel), `pivot-drop`
(top-hinge), `zoom-out-in` (reverse zoom + undershoot), `corner-peel`, `accordion-y` (vertical
springy), `perspective-tilt-in`, `pendulum-settle` (damped swing), `hinge-fall` (leave), `drop-bounce`
(squash landing), `spiral-in` (helical), `squash-stretch-in` (anticipation), `flip-board` (split-flap).

**fade (7):** `fade-down`, `fade-rotate`, `fade-pulse` (idle loop), `fade-in-out`, `fade-vignette`
(TSL radial), `fade-flicker-in` (projector), `fade-checker` (TSL).

**scroll (7):** `scroll-flip`, `scroll-blur`, `scroll-stagger-rise` (child bands), `scroll-progress-fill`
(TSL), `scroll-tilt`, `scroll-depth-dolly`, `scroll-shrink-away`.

**pointer (7):** `pointer-attract-scale`, `pointer-ripple` (TSL rings), `pointer-shine` (TSL anamorphic),
`pointer-displace` (CPU plane dimple), `pointer-hue-shift`, `pointer-orbit` (azimuth track), `pointer-press`.

**text — kinetic typography (20):** `text-jump`, `text-rotate-each`, `text-flip-each`, `text-fade-up-each`,
`text-scale-wave`, `text-shake`, `text-elastic-in`, `text-swing-in`, `text-typewriter-cursor`,
`text-gradient-sweep`, `text-draw-on`, `text-extrude-rotate`, `text-wave-3d`, `text-counter-roll`,
`text-mask-reveal`, `text-magnetic-in`, `text-glow-pulse`, `text-perspective-in`, `text-wave-color`,
`text-squash-each`.

**wave — cloth/hair/water/wind (11):** `sail-bulge`, `ripple-concentric`, `ripple-interference`,
`wave-cross`, `gel-wobble`, `drape-fold`, `curtain-wave`, `seaweed-sway`, `wheat-field`, `trampoline`,
`heat-haze-warp`.

**mask / wipe (9, TSL alpha):** `ring-wipe`, `checker-wipe`, `spiral-wipe`, `wedge-wipe`, `bars-wipe`,
`noise-wipe`, `cross-wipe`, `zigzag-wipe`, `wave-wipe`.

**displacement / splat / transitions (11):** `shatter-assemble` (converge), `ripple-displace` (TSL uv warp),
`wave-distort-in` (CPU settling), `liquefy-reveal` (TSL metaball), `origami-fold` (CPU multi-panel),
`slice-strips`, `tiles-assemble` (mosaic), `tear-reveal` (TSL ragged), `crumble-to-particles`, `datamosh`
(TSL block-smear), `swirl-warp` (TSL whirlpool).

**blur (6):** `blur-slide-in` (ghost trail), `blur-spin` (rotational ghosts), `tilt-shift-pulse` (TSL band),
`blur-dissolve-out` (exit), `chromatic-blur` (RGB ghosts), `focus-rack` (rack focus + bloom snap).

**shimmer — light-refraction (11, TSL):** `brushed-metal` (anisotropic), `gold-glint`, `diamond-sparkle`
(4-point), `starfield-twinkle`, `rainbow-fresnel-edge`, `velvet-sheen`, `satin-band`, `neon-edge-pulse`,
`glimmer-dust`, `liquid-metal-flow`, `moonstone-sheen`.

**glass / dispersion (9, TSL transmission ⚑):** `soap-bubble` (thin-film sphere), `gemstone-cut`
(colored absorbing), `smoked-glass`, `fluted-glass`, `liquid-fill-glass`, `crystal-ball`, `acrylic-edge`
(edge-lit), `holo-glass`, `aerogel-haze`.

**caustics (7, TSL):** `caustic-spots`, `edge-caustics`, `lava-caustics`, `gem-caustics`, `caustic-rings`,
`flowing-caustics`, `dappled-light`.

**volumetric — fire/godray/aurora/nebula (13, TSL):** `torch-flame`, `candle-flame`, `gas-flame` (blue),
`fireball-burst`, `smoky-fire`, `lightning-bolt`, `galaxy-spiral`, `volumetric-cone`, `supernova`,
`heat-column`, `will-o-wisp`, `magma-cracks`, `cosmic-dust`.

**smoke / fluid / ink (9, TSL):** `fog-roll`, `ink-swirl` (vortex), `smoke-ring` (toroid), `smoke-trail`,
`mist-drift`, `smoke-burst`, `ink-drip`, `genie-column`, `dust-poof`.

**particles — GPGPU / physics / collision (19, deterministic `THREE.Points`):** `fireworks` (multi-shell),
`galaxy-particles` (differential rotation), `dna-helix`, `particle-assemble`, `pendulum-wave`, `orbit-rings`
(Keplerian), `magnetic-field` (dipole lines), `wave-grid`, `murmuration`, `ticker-tape`, `spark-shower`
(welding + bounce), `collision-balls` (elastic physics), `meteor-shower`, `rain-splash` (floor crowns),
`snow-globe` (bounded), `petal-fall`, `debris-tornado` (funnel), `fluid-sph` (neighbor repulsion),
`spring-lattice` (Hooke propagation).

`⚑` = transmission/IBL — real-GPU spot-checked this run (see below).

---

## Per-wave orchestration behavior

Same proven pipeline as batch 2: each wave = N parallel Opus 4.8 subagents (1 primitive each, two
disjoint files: `<name>.ts` + its test), each self-verifying with `vitest` on its own test and returning
a structured result. The orchestrator (this session) then regenerated the registry barrel
(`catalog-wire-barrel.mjs`), ran the full vitest suite + the `tsc` baseline-diff gate centrally, updated
`CATALOG-PROGRESS.md`, and staged — **once per wave, after the fan-out** (so agents never contend on the
shared barrel).

| Wave | Theme | N | ok (1st orch.) | catalog total | wall-clock | subagent tokens | tsc | vitest |
|---|---|---|---|---|---|---|---|---|
| W1 | transform 3D reveals + fade | 20 | **20/20** | 173 | ~2.7 min | 1.63 M | 10 (0 new) ✅ | 537/537 ✅ |
| W2 | text kinetic typography | 20 | **20/20** | 193 | ~2.9 min | 1.71 M | 10 (0 new) ✅ | 598/598 ✅ |
| W3 | scroll + pointer + blur | 20 | **20/20** | 213 | ~3.1 min | 1.70 M | 10 (0 new) ✅ | 661/661 ✅ |
| W4 | wave/cloth/water + mask wipes | 20 | **20/20** | 233 | ~4.1 min | 1.73 M | 10 (0 new) ✅ | 722/722 ✅ |
| W5 | displacement/transitions + smoke/fluid | 20 | **20/20** | 253 | ~4.5 min | 1.79 M | 10 (0 new) ✅ | 782/782 ✅ |
| W6 | shimmer + glass/dispersion (⚑10 glass) | 20 | **20/20** | 273 | ~3.6 min | 1.77 M | 10 (0 new) ✅ | 842/842 ✅ |
| W7 | caustics + volumetric (fire/aurora/nebula) | 20 | **20/20** | 293 | ~4.6 min | 1.80 M | 10 (0 new) ✅ | 903/903 ✅ |
| W8 | particles GPGPU/physics/collision | 19 | **19/19** | **312** | ~3.7 min | 1.64 M | 10 (0 new) ✅ | 960/960 ✅ |
| **Total** | | **159** | **159/159** | **312** | **~29.2 min** | **~13.78 M** | **0 new** | **960/960** |

**Contention / races:** zero across all 8 waves. Every agent wrote 2 disjoint files; the shared barrel
`index.ts` was regenerated once by the orchestrator after each fan-out. Agents ran no dev server / no
browser → zero GPU/port contention during the parallel build phase. Peak parallelism ~14 (cap
`min(16, cores−2)` per workflow).

**Failures caught & fixed by the loop:** **none required a central fix.** The two TSL-typing classes that
the `tsc` gate caught in batch 2 (fluent-`VarNode` accumulator reassignment in `splat-reveal`/`pool-caustics`,
and the strict-overload `n()`/wrapping on uniform handles) were written into the build prompt as explicit
gotchas, so every TSL agent applied the `let x: any` accumulator alias + the `(mat as unknown as {...})`
node-assignment cast pre-emptively. The baseline-diff gate ran after every wave and stayed at exactly 10
(0 net new) throughout. (Fix-don't-skip held: no dependency downgrade, no contract weakening, no loosened
assertion in any agent.)

---

## Verification

### Layer 1 — contract + determinism (headless vitest, authoritative for the contract)
Full animatable suite: **960 / 960 tests across 312 files** (3+ per primitive: `runConformance`, a
deterministic PLAYS assertion on CPU-observable state, and a CONTROLS assertion). GPU-only node-material
effects publish their live `uniform()` handles on `target.userData.<name>` (the contract's documented
scratch space) and assert on `uniform.value` / transform / particle-position state, never on rendered
pixels. `tsc --noEmit` baseline-diff: **0 net new type errors** (10 → 10).

### Layer 2 — browser renders / plays / controls (shared preview rig, headless swiftshader)
_`node scripts/verify-catalog.mjs` against one `next dev`, all 312 tiles through the ONE shared
WebGPU→WebGL2 context._

<!-- FILL: paste verify-catalog summary JSON -->
```
{ total:312, renders:?, plays:?, controls:?, fullyVerified:?,
  realConsoleErrorCount:?, deviceLostTotal:?, hoverPlaysProof:?, backend:"webgl" }
```

<!-- FILL: of the 159 new, N fully verified; explain any soft misses (input-driven controls,
     transmissive-glass headless under-render — all vitest-green). -->

---

## Gallery + art-fidelity (mid-animation frames)

<!-- FILL: frame counts, gallery exemplars, stage-1 metrics PASS/polish, vision-pass buckets,
     net genuine art-polish surface. Frames under notes/verification/catalog-finish/. -->

---

## GLASS / TRANSMISSION REAL-GPU SPOT-CHECK (Logan's Mac GPU — authorized)

<!-- FILL: scripts/verify-catalog-realgpu.mjs over the 9 new glass primitives + carry-overs;
     backend, device-lost, per-primitive look. -->

---

## Orchestration metrics (summary)

- **159/159** primitives built ok on the **first** orchestration of every wave (W1–W8).
- **~29.2 min** total build wall-clock across 8 waves; **~13.78 M** subagent tokens; peak parallelism ~14.
- **0** parallel-build failures, **0** file collisions, **0** name collisions, **0** new dependencies.
- **0** central fixes — the batch-2 TSL-typing gotchas were pre-empted in the build prompt and the tsc
  baseline-diff gate held at 10 every wave.
- Reusable harness: `notes/catalog-finish-workflow.mjs` (159 specs embedded, wave-selectable via
  `{batchLabel:'W1'..'W8'}`) + the existing `catalog-wire-barrel.mjs` + `scripts/verify-catalog.mjs`
  + `scripts/verify-catalog-realgpu.mjs`.

---

## Anything that could NOT meet the bar (honest)

<!-- FILL after verification: list any primitive that failed render/play/controls in-browser and
     could not be brought to the bar, flagged honestly. -->

---

## Art-polish to-do (carried forward — OUT OF SCOPE this run, per instruction)

- The clear-glass backdrop / environment-map work (batch-2 carry-forward): clear/near-clear transmissive
  glass (`refraction-warp`, `frosted-glass`, `water-droplet`, and now `crystal-ball`, `fluted-glass`,
  `holo-glass`) only sparkles when there is something behind it to refract; on the pure-dark catalog
  backdrop they read mainly at edges/highlights. An environment map / lit backdrop behind the glass
  subject in the preview rig would make the whole clear-glass family magnify and sparkle at tile size.
- The ~5-nit art polish (subtle-TSL thumbnail punch on dark-on-dark fluids like `ink-bloom`/`dust-cloud`)
  remains the later focused step — explicitly out of scope here.
- Capture-timing: a few one-shot primitives (`flip-3d`, `wipe`-family, `hinge-fall`) photograph best at a
  mid-phase hold; the shared rig's single capture frame can catch a low-energy moment. A mid-phase-hold
  capture tweak to the rig is a carried-forward harness item, not a primitive defect.

---

## Plain-language summary (for Logan)

<!-- FILL after verification with final numbers. -->
