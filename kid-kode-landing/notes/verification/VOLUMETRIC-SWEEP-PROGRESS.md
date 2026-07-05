# VOLUMETRIC SWEEP — progress ledger (resumable)

**Branch:** `prism-editor-build` · **Model:** claude-fable-5 (confirmed at session start; no
opus-4-8 fallback observed so far) · **Orchestration:** ULTRACODE dynamic workflows ·
**NO commit — staged for Logan.**

Mission: kill the blocky slab look catalog-wide. Convert the 7 `volumetric:true` slab holdouts
(`godray`, `supernova`, `volumetric-cone`, `dust-cloud`, `ink-bloom`, `mist-drift`,
`wispy-smoke`) to the proven single-quad in-shader recipe (smoke.ts + _volume-fbm.ts), re-grade
the whole volumetric family for consistency, full advocate + no-regression verification.

Each wave appends below; a relaunch reads the last `STATUS:` line per wave and continues.

## Waves

- [pending] **W0 Baselines** — tsc error count (target baseline 10, 0-new), vitest for the 7
  tiles, BEFORE advocate-capture bundles for the 7 (`useradvocate-sixtile/<tile>/before/`).
- [pending] **W0.5 Rubric amendment** — photoreal/anti-blocky bar appended to
  `notes/verification/useradvocate/RUBRIC.md` (dated amendment; additive).
- [pending] **W1 Triage** — vision re-grade of the whole volumetric family (category
  'volumetric' + smoke/fog family incl. the 6 already-fixed) from existing catalog-parallel
  frames → extra-offender list.
- [pending] **W2 Convert** — 7 parallel agents rewrite the holdouts per the smoke.ts recipe
  (volumetric:false, _volume-fbm noise, schema/uniforms/userData preserved). Per-tile vitest +
  tsc 0-new.
- [pending] **W3 Extra offenders** — same recipe for any W1 finds.
- [pending] **W4 AFTER capture + advocate** — capture after-bundles, user-advocate verdicts
  (schema-validated), fix/regrade loop until PLEASED or honest FLAG.
- [pending] **W5 No-regression** — verify-catalog-parallel full 312 renders+plays+controls;
  full animatable vitest; tsc 0-new.
- [pending] **W6 Report** — notes/VOLUMETRIC-SWEEP-REPORT.md + frames copied to
  notes/verification/volumetric-sweep/. Env clean (no orphan servers/ports).

## Per-tile ledger

| tile | before captured | converted | vitest | after captured | advocate | notes |
|---|---|---|---|---|---|---|
| godray | ✓ | ✓ | 3/3 | – | – | moiré comb → soft beams + orbiting source |
| supernova | ✓ | ✓ | 3/3 | – | – | purple ring → warm detonation, persistent core |
| volumetric-cone | ✓ | ✓ | 3/3 | – | – | lattice grid → smooth sweeping cone + motes |
| dust-cloud | ✓ | ✓ | 3/3 | – | – | mud wall → thin warm parallax haze |
| ink-bloom | ✓ | ✓ | 3/3 | – | – | glitch mush → drop-point bloom, organic front |
| mist-drift | ✓ | ✓ | 3/3 | – | – | patchwork+seam → 3-layer ground mist |
| wispy-smoke | ✓ | ✓ | 3/3 | – | – | shelf steps → sparse curling tendrils |
| nebula (W1 offender) | n/a (catalog frame) | ✓ | 3/3 | – | – | green mush → layered gas + dust lanes + round stars |

## Wave log

### W0 — Baselines (DONE)
- tsc baseline: **0 errors** (`npx tsc --noEmit` clean — better than the documented 10; bar is 0-new).
- BEFORE bundles captured for all 7 holdouts → `useradvocate-sixtile/<tile>/before/`,
  backend=webgpu, deviceLost=0. Vision-confirmed defects: godray moiré/herringbone aliasing;
  supernova flat purple ring + spoke asterisk; volumetric-cone square lattice grid + beige wall;
  ink-bloom corrupted rectangular mush; mist-drift grey patchwork + center seam; dust-cloud muddy
  blobs + step artifacts; wispy-smoke horizontal shelf steps. Several clip hard at quad edges.
- STATUS: W0 complete.

### W0.5 — Rubric amendment (DONE)
- Photoreal/anti-blocky bar appended to `useradvocate/RUBRIC.md` as a dated additive amendment
  (slab banding, lattice grid, seams, jagged edges, blow-out = MUST-FIX; cite frame+bandingScore).
- STATUS: W0.5 complete.

### W1 — Family triage (DONE)
- 21 non-holdout family tiles vision-graded (3 parallel agents) against the photoreal bar.
- CLEAN ×15: aurora, campfire, candle-flame, clouds, fire-flame, fog, fog-roll, galaxy-spiral,
  heat-column, lightning-bolt, magma-cracks, plasma, smoke, torch-flame, will-o-wisp.
- OFFENDER ×2: **nebula** (flat muddy green, blocky grain — pre-polish frame caveat),
  **cosmic-dust** (square star sprites per after/_starcrop.png — may be a stale diagnostic;
  sixtile pass claimed round stars).
- SUSPECT ×4: fireball-burst (play-2/3 nearly black — capture timing vs real defect),
  gas-flame (stamped identical cones), light-shafts (stippled/grainy rays), smoky-fire (flat
  smoke band). All 6 get FRESH captures before any rebuild decision.
- STATUS: W1 complete.

### W2/W3 — Conversions (DONE: 8/8 code-complete)
- 7 holdouts rewritten volumetric:false single-quad, all noise via `_volume-fbm`, soft
  edge-vignettes (kills the hard quad clipping), schema/userData/duration/controls preserved.
  Additive tiles (godray/supernova/volumetric-cone) use in-gamut ramps + alpha-carried
  intensity, capped composite (no blow-out). Per-tile vitest 3/3 ×7.
- nebula (W1 offender) art-rebuilt: layered fbmWarped gas + dust lanes + round Gaussian stars.
  vitest 3/3.
- tsc ground truth re-measured: **10 errors, all pre-existing** (GraphScene.tsx + 9 in old
  integration/editor-build tests), none in touched files → 0-new PASS. (The earlier "0
  baseline" reading was bogus — that run had no node on PATH.)
- STATUS: W2/W3 complete; W4 after-capture running (13 tiles: 8 rebuilt + 5 re-checks).

### W4 R1 — after-capture + Fable-5 vision critique (DONE)
- 13 tiles captured on webgpu, deviceLost=0 (8 rebuilt + 5 re-checks).
- Re-checks resolved: **fireball-burst** clean luminous fireball (triage's black frames were
  loop-phase timing, refuted); **cosmic-dust** stars ROUND on fresh capture (triage's square-star
  call was a pixelated-crop over-read; advocate had already PASSED it); **gas-flame** smooth
  premium cones (stamped-row regularity = design; taste-flag at most). → these 3 go to the
  advocate as-is.
- Confirmed offenders: **light-shafts** (heavy stipple/dither grain + full-frame rectangle),
  **smoky-fire** (flat grey static rectangle floating above the fire).
- Rebuilt-8 residuals (vision critique, photoreal bar): godray lens-flare pinch cross + faint
  quad rectangle; supernova polar wrap seam at 9-o'clock (raw atan angle into fbm); volumetric-
  cone faint stair-steps + disconnected apex bloob; dust-cloud OPAQUE tan sandpaper square;
  ink-bloom full-frame + hard quad cut; mist-drift vertical streaks (reads waterfall) +
  rectangle; wispy-smoke harsh torn-paper blotches; nebula milky over-exposure + rounded-rect
  silhouette.
- Systemic round-2 lesson: the SILHOUETTE must come from the effect's own organic shape (alpha
  exactly 0 around it, fbm-modulated falloff) — a uniform vignette just rounds the rectangle.
  Never feed raw atan angle into noise (wrap seam) — embed via cos/sin.
- STATUS: W4 R1 critique complete → R2 fix wave launched (10 agents: the 8 + light-shafts +
  smoky-fire).

### W4 R2 — fix wave + recapture + vision critique (DONE)
- 10/10 fixed (key root-causes: dust-cloud's opaque square was a method-form `.mix` arg-order
  bug using haze alpha as the FACTOR; supernova seam was raw atan into fbm → cos/sin embedding;
  mist-drift streaks were inverted anisotropy). tsc settled back to 10-baseline (0 new); the
  transient 15 mid-wave was smoky-fire in-flight.
- Recaptured 10 tiles (webgpu, deviceLost=0). Vision critique:
  **PASS-looking ×5**: supernova (seam gone, turbulent warm shell), wispy-smoke (real curling
  tendrils), nebula (deep space + shaped gas + round stars), smoky-fire (true plume w/ ember
  transition), volumetric-cone (smooth fused cone; borderline-acceptable).
  **Round-3 needed ×5**: godray (over-corrected → beam-less amber blob in all phases),
  dust-cloud (over-corrected → nearly invisible at defaults), mist-drift (same — one dim wisp),
  ink-bloom (jagged sawtooth fringe), light-shafts (perfectly-regular clip-art starburst).
- Pendulum lesson recorded: agents must trace the alpha path numerically at DEFAULT control
  values — "calibrated middle", not over-correction.
- STATUS: R3 fix wave launched (5 agents).

### W4 R3 — targeted fixes + recapture (DONE)
- 5/5 fixed (godray beams restored w/ ragged fbm tips + near-black gaps; dust-cloud presence
  recalibrated to a visible bank; mist-drift bank spans ~80% width / bottom third; ink-bloom
  sawtooth → soft low-freq lobes + diffusion halo; light-shafts → irregular fan w/ dropouts +
  jitter). All vitest 3/3, tsc 10-baseline.
- Recaptured 5 (webgpu, deviceLost=0). Vision: all read premium; handed to the advocate.

### W4 — USER-ADVOCATE GATE (13 tiles, schema-validated verdicts) — 10 PASS / 3 BLOCKED
- **PASS (PLEASED, 0 MUST-FIX)**: godray, supernova, volumetric-cone, dust-cloud, mist-drift,
  nebula, light-shafts, smoky-fire, fireball-burst, gas-flame. Banding scores cited per
  verdict, all < 0.25 default (smoky-fire 0.434 < fire-flame ground-truth 0.491).
- **BLOCKED ×3** (look passed; controls/edge-case issues): ink-bloom (controls visually dead at
  the paused early-growth capture state), wispy-smoke ('rise' is speed-only → invisible frozen),
  cosmic-dust (scale-low cuts star Gaussians into square cell quads).
- STATUS: R4 surgical fixes launched (3 agents). 312 no-regression run going in parallel.

### W4 R4 + W5 + W6 — FINAL (DONE) ✅
- R4 fixes: ink-bloom controls made visibly live at the paused capture state (scale drives
  visible radius, turbulence proportional rim deformation, flow as static advection offset);
  wispy-smoke rise = static reach + speed (heat-column precedent); cosmic-dust star Gaussians
  made scale-invariant (sigma/window bounded by cell edgeRoom). vitest 3/3 ×3, tsc 0-new.
- Advocate REGRADE: **ink-bloom, wispy-smoke, cosmic-dust → PLEASED/PASS** ⇒
  **ALL 13 TILES PASS the advocate gate, 0 MUST-FIX, verdicts schema-validated.**
- W5 no-regression: full run 302/312 under load; 10 fails = 5 load-flaky (pass on quiet retry)
  + 5 PRE-EXISTING (already verdict=fail in committed baseline 920237c; none in sweep diff;
  none import _volume-fbm). 13 touched tiles re-verified at final state: **13/13 r+p+c**.
  vitest **312 files / 960 tests PASS**. tsc **10 = baseline, 0 new**.
- W6: report at `notes/VOLUMETRIC-SWEEP-REPORT.md`; evidence copied to
  `notes/verification/volumetric-sweep/`. Ports 4799/4811 free, no orphan servers.
- Model-pin: claude-fable-5 throughout; no opus fallback observed.
- STATUS: **SWEEP COMPLETE — staged for Logan, NO commit.**
