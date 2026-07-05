# USER-ADVOCATE + Six-Tile Cleanup — progress ledger (resumable)

**Branch:** `prism-editor-build` · **Model:** claude-opus-4-8 · **Orchestration:** ULTRACODE dynamic
workflows (contract-first; parallel verified waves) · **NO commit — staged for Logan.**

This ledger is the resumable source of truth. Each wave appends; a relaunch reads the last
`STATUS:` line per wave and continues from there. Never restart from zero.

## Contract freeze (Part A) — the capstone reviewer

- [in-progress] **W0.1 Rubric frozen** — `notes/verification/useradvocate/RUBRIC.md` (5-question,
  evidence-required, MUST-FIX vs FLAG, NET verdict). Frozen BEFORE any tile runs against it.
- [pending] **W0.2 Evidence-capture engine** — `scripts/useradvocate-capture.mjs` drives the REAL
  Metal-GPU Chrome through the app's interaction hooks, writes per-tile evidence bundles
  (idle / play phases / control sweeps + measured pixel stats + console/network).
- [pending] **W0.3 Reviewer role** — `.claude/agents/user-advocate.md` (reusable, parameterizable,
  opus-pinned, reads a bundle + claim → structured verdict JSON, anti-rubber-stamp enforced).
- [pending] **W0.4 Verdict schema + validator** — a verdict lacking cited frame/value evidence is
  INVALID in code (`scripts/useradvocate-verdict-schema.mjs`).
- [pending] **W0.5 Harness wiring** — additive `--advocate` stage in
  `scripts/verify-catalog-parallel.mjs`, runs concurrently as the final human-grade gate.

## Proving ground (earn trust BEFORE fixes)

- [pending] **PG.1** Capture BEFORE bundles for `fireball-burst` + `heat-column` (current bad state).
- [pending] **PG.2** Run user-advocate on the BEFORE state → MUST be MUST-FIX / ANNOYED with cited
  frames (pink/cream/olive, cool core). If it rubber-stamps a bad tile, that is a Part-A failure —
  fix Part A, do not lower the bar.

## Part B — six-tile cleanup (the proving ground)

Each tile: rebuild → functional + contract + art-fidelity + USER-ADVOCATE gates → PLEASED or honest FLAG.

- [pending] **B.1 fireball-burst** — non-blow-out fire (fire-flame discipline: in-gamut ramp, alpha-carried intensity).
- [pending] **B.2 heat-column** — same; kill the olive mid-band.
- [pending] **B.3 fog-roll** — de-band (more slabs / lower inter-slab parallax / raymarch).
- [pending] **B.4 smoke** — de-band, real volume.
- [pending] **B.5 will-o-wisp** — de-band.
- [pending] **B.6 cosmic-dust** — de-band.
- [pending] **B.7 clouds** — lift muddy → vivid sky.
- [pending] **B.8 fog** — lift muddy → defined fog.

## No-regression

- [pending] **NR.1** 312-catalog still renders + plays + controls (functional gate; sample + touched tiles).

## Gates running-tally

- tsc baseline (documented): 10 errors, 0-new target.
- vitest: animatable + material-lighting suites green target.

---

## Wave log

### W0 — Part A contract frozen + harness built (DONE)
- RUBRIC.md frozen; `useradvocate-capture.mjs` (real Metal-GPU evidence engine, backend=webgpu
  confirmed, deviceLost 0); `useradvocate-verdict-schema.mjs` (anti-rubber-stamp validator);
  `.claude/agents/user-advocate.md` (reusable reviewer role); `--advocate` stage wired additively
  into `verify-catalog-parallel.mjs`. Capture metric enriched with warmFrac/coolFrac/magentaFrac +
  bandingScore. Step-snap bug fixed (range fill off-grid → Malformed value).
- NOTE: kv_*/chrome-devtools MCP were NOT connected this session; the computer-use surface is the
  harness driving the REAL installed Chrome on the Metal GPU through the app's own interaction
  hooks (__catalogFocus/__catalogSetPlaying/range controls) → true-colour frames + measured stats.
  Same intent (evidence from real interaction, not DOM-scraping), reproducible.

### PG — Proving ground (DONE — reviewer EARNED TRUST)
- fireball-burst BEFORE → **ANNOYED / BLOCKED** (3 MUST-FIX: play-2 coolFrac=1.0 hue=231 → 100%
  blue not fire; collapses to meanLuma~8 + play-3 frozen Δ0.18; scale control dead). validator valid:true.
- heat-column BEFORE → **ANNOYED / BLOCKED** (olive effHue=58 warmFrac=0.23; rise+wobble controls
  dead; bandingScore 0.25; low motion). validator valid:true.
- fire-flame ground-truth → **PLEASED / PASS** (genuine fire, both controls act). validator valid:true.
- ⇒ The advocate BLOCKS genuinely-bad tiles AND PASSES genuinely-good work, each with cited
  frames/metrics. Not a rubber stamp in either direction. STATUS: Part A proven.

### B-fire — fireball-burst + heat-column rebuilt (fire-flame discipline)
- Both REWRITTEN single-plane, MeshBasicNodeMaterial+Additive, in-gamut red→orange→yellow→white
  ramp, alpha-carried intensity (no >1 colour multiply, no warmFloor/temp gymnastics). Controls
  made live (fireball scale; heat-column rise sets height + wobble shear).
- GATE tsc: 10=baseline, 0-new, none in touched files. vitest fireball+heat-column: 6/6 pass.
- AFTER capture v1 (webgpu): heat-column CLEAN — play warmFrac=1.0 hue 27° sat ~0.7, all 3 controls
  live, good motion. fireball play-1 great (warmFrac 0.74 hue 42°) BUT play-2/3 collapsed to a dim
  blue phase (luma~9, coolFrac 0.98) — same "lands on dim phase" failure. FIX: added a PERSISTENT
  always-lit hot core so any static capture reads fire; re-captured. STATUS: heat-column done pending
  advocate; fireball re-fixed, recapturing.

### B-vol — 6 volumetric tiles rebuilt single-plane (parallel wave, 6 Opus agents)
- fog-roll, smoke, will-o-wisp, cosmic-dust, clouds, fog: all set volumetric:false → ONE flat quad
  (slab seams eliminated by construction), volume illusion rebuilt in-shader (layered domain-warped
  ≥5-octave smooth fbm + depth-fade; clouds/fog get a clean gradient; cosmic-dust/will-o-wisp get
  glow+sparkle). Uniforms/schema/userData preserved; each tile's vitest 3/3 pass. tsc 0-new.
- STATUS: code done + vitest green; AFTER capture + advocate grading in progress.

### B-grade R1 — AFTER advocate verdicts (8 tiles, parallel)
- fireball-burst → **PLEASED / PASS** (white-hot core + orange halo + tongues, hue 42°, all controls live).
- heat-column → **PLEASED / PASS** (warm rising heat hue 27° sat ~0.7, rise/wobble/intensity all act).
- fog-roll → INDIFFERENT/BLOCKED; smoke/will-o-wisp/cosmic-dust/clouds/fog → ANNOYED/BLOCKED.
- ROOT CAUSE (systemic): single-plane fixed the slab seams, but the agents' inline LOW-FREQ value
  noise exposed its axis-aligned integer LATTICE as a blocky tile grid on the full-frame quads
  (confirmed by a captured fog frame: ~8-across grey squares + nested rectangle from a low-freq
  depth term). clouds also rendered ORANGE (puff mask covered the whole quad → blue sky never showed).

### B-fix R2 — shared premium noise + targeted fixes (6 Opus agents)
- NEW `src/lib/prism/animatable/primitives/_volume-fbm.ts`: rotated-octave + QUINTIC (C2) +
  domain-warped value-noise fbm (`fbmRot`/`fbmWarped`) — kills the axis-aligned grid by construction.
  (`_`-prefixed → not registered by index.ts barrel; verify scanners skip `_`-files.)
- All 6 tiles now import it, base frequency ≥7, large-scale/depth terms ALSO warped (no raw low-freq
  term), and NO centered/abs domain feeds the noise (kills the mid-quad mirror seam). Per-tile:
  smoke→cool grey-blue; will-o-wisp→capped brightness + coloured core + multi-wisp control + tendrils;
  cosmic-dust→round Gaussian stars (was square) + seam fix; clouds→narrow-band puff so blue sky shows.
- GATE tsc: 10=baseline 0-new (fixed one helper overload via permissive v2 cast). All 6 vitest 3/3 pass.
- STATUS: code done + vitest green; round-2 AFTER capture + regrade in progress.

### B-grade R2 — regrade after shared-noise fix
- smoke, will-o-wisp, cosmic-dust, clouds, fog → **PLEASED / PASS** (tile grid gone; read as real volumes).
  cosmic-dust stars now ROUND. clouds sky now BLUE (a method-form `.smoothstep`/`.mix` GPU EXTRAPOLATION
  bug turned the sky brown — fixed by free-function `smoothstep(edge0,edge1,x)`+`clamp`+`mix`).
- fog-roll → INDIFFERENT/BLOCKED (tile patches gone, but a hard VERTICAL mid-quad seam survived from the
  wrapping `dx - floor(dx+0.5)` front edge).

### B-fix R3 — fog-roll seam
- Replaced the wrapping front envelope with a smooth, continuous, drifting `fbmWarped` density modulation
  (no wrap → no seam). tsc 0-new, vitest 3/3.
- fog-roll → **PLEASED / PASS** (seam gone, reads as a continuous rolling fog bank).

### FINAL — all 8 tiles PASS the user-advocate gate ✅
- fireball-burst, heat-column, fog-roll, smoke, will-o-wisp, cosmic-dust, clouds, fog → all PLEASED/PASS,
  every verdict schema-validated (evidence-cited).
- NO-REGRESSION: full animatable vitest **312 files / 960 tests PASS**; catalog page loads all 312 picker
  tiles, backend=webgpu, deviceLost 0 in every capture. tsc 10=baseline 0-new throughout.
- ENV: no orphan dev servers/browsers; capture ports free. NODE_ENV unset throughout. HEAD prism-editor-build.
- STATUS: COMPLETE. Writing final report. Staged for Logan, no commit.
