# VOLUMETRIC SWEEP — final report (2026-06-09)

**Mission:** kill the blocky slab look catalog-wide; premium 4K motion-graphics quality.
**Model:** `claude-fable-5` (confirmed at session start; **no opus-4-8 fallback occurred** at any
point — all orchestration, vision critique, and subagent work ran on the pinned model/fleet).
**Branch:** `prism-editor-build` · **NO commit — all changes staged in the working tree for Logan.**
**Evidence:** `notes/verification/volumetric-sweep/<tile>/{before,after}/` + `after-verdict.json`
per tile. Resumable ledger: `notes/verification/VOLUMETRIC-SWEEP-PROGRESS.md`.

---

## Headline

The 7 slab holdouts (`godray`, `supernova`, `volumetric-cone`, `dust-cloud`, `ink-bloom`,
`mist-drift`, `wispy-smoke`) are converted from the 5-slab stacked-quad mechanism
(`volumetric:true`) to **ONE flat quad with the volume built entirely in-shader** (layered
domain-warped ≥5-octave quintic fbm from the shared `_volume-fbm` helper + depth-fade +
organic alpha silhouettes). The whole volumetric family was then re-graded for consistency,
which surfaced and fixed **3 more offenders** (`nebula`, `light-shafts`, `smoky-fire`) and
**2 latent control/edge-case defects** on previously-passed tiles (`cosmic-dust` square stars
at scale-low; `fireball-burst`/`gas-flame` re-confirmed clean).

**Final gate: all 13 graded tiles → user-advocate PLEASED / PASS, 0 MUST-FIX**, every verdict
schema-validated (evidence-cited, anti-rubber-stamp). `volumetric:true` no longer exists
anywhere in the catalog.

## Per-tile before → after (advocate verdict, evidence-cited)

| tile | BEFORE (slab/offender state) | AFTER (final) | advocate |
|---|---|---|---|
| godray | severe moiré/herringbone aliasing band, olive wash, flat | warm-amber irregular beam star, rotating source, beams w/ ragged fbm tips, banding 0.157–0.276, no artifacts | **PLEASED / PASS** (4 flags) |
| supernova | flat dim purple ring + 6-spoke asterisk | white-hot flash → filamentary shock shell → ember remnant; banding 0.11, warmFrac 1.0 | **PLEASED / PASS** (2 flags) |
| volumetric-cone | square lattice grid, beige wall, hard rect clip | smooth sweeping light cone + drifting motes; banding ≤0.129 | **PLEASED / PASS** (3 flags) |
| dust-cloud | opaque tan "sandpaper square" (orig: muddy blobs + step artifacts) | thin warm drifting haze, organic silhouette; hue 34°, banding 0.209–0.226 | **PLEASED / PASS** (3 flags) |
| ink-bloom | full-frame corrupted rectangular mush | drop-point ink bloom, organic lobed front, transparent surround; banding 0.175–0.183; **all controls visibly live** | **PLEASED / PASS** (3 flags) |
| mist-drift | grey rectangular patchwork + mid-quad seam | soft ground-hugging mist bank, drift parallax; banding 0.236–0.240, no seams | **PLEASED / PASS** (3 flags) |
| wispy-smoke | horizontal shelf steps, blotchy patchwork | thin curling rising tendrils; banding 0.112–0.122; **rise control now height+speed** (heat-column precedent) | **PLEASED / PASS** (2 flags) |
| nebula *(re-grade offender)* | flat pale-green mush, repeating grain, clipped speckles | deep-space layered gas + dust lanes + round Gaussian stars; hue 262°, banding 0.177 | **PLEASED / PASS** (2 flags) |
| light-shafts *(re-grade offender)* | heavy per-pixel stipple grain, full-frame rect | smooth irregular golden god-ray fan (per-ray length/width/intensity variance, dropouts); banding 0.165–0.186 | **PLEASED / PASS** (3 flags) |
| smoky-fire *(re-grade offender)* | flat grey TV-static rectangle floating above fire | organic flame feeding a churning smoke plume w/ ember transition; banding 0.434 < fire-flame ground-truth 0.491 | **PLEASED / PASS** (3 flags) |
| cosmic-dust *(re-grade)* | square star quads exposed at scale-low | scale-invariant round Gaussian stars (cell-window math fixed at every scale) | **PLEASED / PASS** (2 flags) |
| fireball-burst *(re-grade)* | triage suspect (loop-phase black frames) | confirmed genuine fireball: hue 37°, warmFrac 0.87, matches fire-flame ground truth | **PLEASED / PASS** (2 flags) |
| gas-flame *(re-grade)* | triage suspect (stamped cones) | confirmed clean blue gas burner; effHue 203°, sat 0.68; jets/intensity controls live | **PLEASED / PASS** (2 flags) |

Before/after frames per tile: `notes/verification/volumetric-sweep/<tile>/before/play-2.png` vs
`after/play-2.png` (re-grade tiles without a slab "before" carry the fresh-capture evidence and
their full after bundle).

## How it was verified (evidence, not assertion)

- **4 fix rounds with vision-critique between each** (Fable-5 grading its own real-GPU frames
  against the photoreal bar before spending the advocate): R1 conversion (8 tiles) → critique
  found quad-silhouettes/seams/texture-swatch looks → R2 (10 tiles) → critique found
  over-corrections (beam-less godray, near-invisible dust/mist, sawtooth ink, clip-art starburst)
  → R3 (5 tiles) → **independent user-advocate gate (13 agents, frozen rubric + photoreal
  amendment)** → 3 BLOCKED on real evidence → R4 surgical fixes → regrade → **13/13 PASS**.
- **Rubric amendment** (the photoreal bar) recorded as a dated additive section in
  `notes/verification/useradvocate/RUBRIC.md` (blocky/stacked/tiled/jagged/low-poly/
  game-engine-cheap ⇒ MUST-FIX; cite frame + bandingScore).
- All captures on the **real Metal GPU, backend=webgpu, deviceLost=0** in every run.

## Gates

| gate | result |
|---|---|
| Advocate (13 tiles) | **13/13 PLEASED / PASS, 0 MUST-FIX**, verdicts schema-validated |
| Functional (13 touched tiles, final state) | **13/13** renders+plays+controls (120 s run, deviceLost 0) |
| Full-catalog no-regression | **302/312** in the under-load full run; the 10 fails decompose into **5 load-flaky** (drop-bounce, iris-wipe, liquefy-reveal, roll-in, spiral-in — all pass on quiet retry) + **5 pre-existing** (see Honest flags); **every tile that passed the committed baseline still passes** |
| vitest | **312 files / 960 tests PASS** |
| tsc | **10 errors = documented pre-existing baseline, 0 new** (1 GraphScene.tsx + 9 old test fixtures; none in swept files) |
| Schema discipline | additive-only: every SCHEMA, userData key/handle, duration/onParamChange/dispose contract byte-preserved across all 13 tiles |
| Environment | no orphan dev servers/browsers; ports 4799/4811 free at exit |

## Honest flags (non-blocking, reported as-is)

1. **5 pre-existing harness failures, untouched by this sweep:** `dust-poof`, `hover-lift`,
   `pointer-attract-scale`, `pointer-press`, `scroll-skew` fail the parallel harness's
   plays/controls drive consistently — and **already carried `verdict=fail` in the committed
   sign-off artifact** (`git show 920237c:.../results.json`). All are pointer/scroll/enter
   driver-gated tiles; none import `_volume-fbm`, none are in this sweep's diff. They need a
   harness-side driver fix (or a tile fix) in a separate pass.
2. **Temporal-rate controls are stills-invisible by nature:** `speed`/`drift`-class knobs can't
   change a frozen frame; the advocate flags (not blocks) them when the tile's other controls
   visibly act. A temporal-delta capture mode would close this measurement gap.
3. **Taste flags** retained in the verdicts (e.g. supernova's subtle `rays` slider, mist-drift's
   slightly taupe tint, ink-bloom's modest default presence) — all cited in the per-tile
   `after-verdict.json`.
4. `*.ts.bak-*` backups of every edited primitive sit alongside the sources (per Logan's
   backup-before-edit preference); delete after review if unwanted.

## Files changed (staged, not committed)

- `src/lib/prism/animatable/primitives/`: `godray.ts`, `supernova.ts`, `volumetric-cone.ts`,
  `dust-cloud.ts`, `ink-bloom.ts`, `mist-drift.ts`, `wispy-smoke.ts` (slab→single-quad
  conversions), `nebula.ts`, `light-shafts.ts`, `smoky-fire.ts` (art rebuilds),
  `cosmic-dust.ts` (star-window fix). No test edits were needed (all contract tests passed
  unmodified). Plus notes/evidence under `notes/`.

## Plain-language summary for Logan

The seven "Minecraft-looking" volumetric tiles are gone. Each one is now a single smooth
GPU-shader volume — the god rays are soft golden beams instead of a glitchy zigzag mess, the
supernova actually explodes (white-hot flash, turbulent shock ring, embers) instead of showing
a flat purple donut, the ink drop blooms like real ink in water, and the dust/mist/smoke tiles
read as soft drifting hazes instead of grey cardboard rectangles. While re-checking the whole
family, three more weak tiles (nebula, light-shafts, smoky-fire) got the same treatment, and a
hidden "square stars" bug in cosmic-dust was fixed. A skeptical reviewer agent that judges the
real rendered frames like a first-time user signed off on all thirteen — zero must-fix issues —
and the full 312-tile catalog, the type checker, and all 960 tests confirm nothing else broke.
Nothing is committed; it's all sitting in the working tree for your review.
