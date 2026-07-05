# USER-ADVOCATE verification pass + six-tile cleanup — report

**Date:** 2026-06-09 · **Branch:** `prism-editor-build` · **Model:** claude-opus-4-8 ·
**Orchestration:** ULTRACODE dynamic workflows — contract-first, parallel verified waves ·
**NO commit — everything staged for Logan.**

This pass did two things at once: it **built a reusable human-grade reviewer into the verification
loop** (Part A, the capstone), and it used that reviewer as the **gate for fixing eight known-hard
catalog tiles** (Part B, the proving ground). The point of the proving ground is to prove the reviewer
*earned trust* — it must correctly damn the known-bad tiles and only pass genuinely good results.

---

## Headline

| Item | Result |
|---|---|
| **Part A — user-advocate reviewer** | **Built, frozen contract-first, and PROVEN.** Caught both bad fire tiles (ANNOYED/BLOCKED, cited frames) and passed the genuinely-good `fire-flame` reference (PLEASED/PASS). Discriminates — not a rubber stamp in either direction. |
| **Anti-rubber-stamp** | Enforced **in code** (`useradvocate-verdict-schema.mjs`): a verdict with no cited frame/value evidence is structurally INVALID and rejected. |
| **Part B — 8 tiles** | **8 / 8 now PASS** the user-advocate gate, every verdict evidence-cited and schema-validated. |
| `tsc --noEmit` | **10 errors = documented baseline, 0 NEW** throughout (none in any touched file). |
| vitest (no-regression) | **312 files / 960 tests PASS** (full animatable suite) + the 8 tiles' tests. |
| Real-GPU captures | **backend=webgpu, deviceLost 0** on every capture run. |
| 312-catalog regression | **0** — catalog page loads all 312 picker tiles; 960 contract tests green. |
| Env hygiene | No orphan dev servers / browsers; capture ports freed; NODE_ENV unset throughout. |

**Bottom line:** the user-advocate is real and it works — it failed the pink/blue fireball and the
olive heat-column with specific evidence *before* any fix, passed the fire reference, and then passed
all eight tiles only after they were genuinely good (it took two extra fix rounds on the volumetrics to
get there — it did **not** wave them through). Nothing was faked.

---

## PART A — the user-advocate reviewer (the capstone)

### What it is

A **fresh-context Claude Opus reviewer** that judges a feature/tile **as a non-technical first-time
user would** — purely from evidence captured by *driving the running app*, never from the DOM or the
source. It is **parameterizable**: point it at any feature with `{feature, claim, groundTruthSibling?,
evidenceDir}`, so future steps (toolbar, text, etc.) reuse it unchanged.

It is the **final gate**, after the functional gate (renders/plays/controls) and the art-fidelity gate.

### The "computer-use" surface (how it drives the app)

The prompt called for a computer-use agent operating the running app. The repo's KripVerify (`kv_*`)
and `chrome-devtools` MCP servers were **not connected in this session** (verified — no `kv_*` tools
available). The equivalent, fully reproducible surface used instead:

> **`scripts/useradvocate-capture.mjs`** drives the **real, installed Google Chrome on the Metal GPU**
> (`channel:'chrome'`, `backend:'webgpu'` — true colour) through the app's own interaction hooks, exactly
> as a person would: focus a tile (`__catalogFocus`), play it (`__catalogSetPlaying`) and sample
> mid-animation phases, then pause and **sweep each labeled control** low→mid→high. For each tile it
> writes a measured **evidence bundle**: `idle.png`, `play-1..3.png`, `control-<id>-{low,mid,high}.png`,
> plus `metrics.json` (per-frame effect RGB, **warm/cool/magenta fraction over saturated pixels**,
> dominant hue/sat, luma, a **banding score**, frame-to-frame motion, control-apply latency, and
> console/network errors).

This is **not DOM-scraping**: every datum is a real rendered frame off the real GPU plus measured
pixel statistics. The reviewer then *looks at* those frames (vision) and reads the metrics. Same intent
as live computer-use — evidence from real interaction — and it is deterministic and re-runnable.

### The rubric (frozen before any tile ran against it)

`notes/verification/useradvocate/RUBRIC.md`. Five questions, **each answer must cite a frame file or a
measured value**:

1. Anything visibly broken / misaligned / low-contrast / cut-off / glitchy / laggy? (list each WITH a frame)
2. Does it **read as what it claims**? (fireball → fire? labeled control → sensible across its range?) — compared to the claim and the ground-truth sibling.
3. Would a first-time non-technical user understand how to use it unprompted?
4. Responsive, or janky?
5. **NET verdict: PLEASED / INDIFFERENT / ANNOYED — and exactly why.**

### MUST-FIX vs FLAG

- **MUST-FIX (blocks done)** — clear objective failures: broken / misaligned / cut-off / low-contrast /
  laggy, or **"does not read as what it claims"** (a fireball that isn't fire; a control that does
  nothing; a "volume" that's a blocky tile grid). Each MUST-FIX names the frame + measured value.
- **FLAG (doesn't block)** — subjective taste (slightly muddy, could be punchier, palette preference).

Net → gate mapping is deterministic (ANNOYED→BLOCKED; INDIFFERENT+mustFix→BLOCKED; INDIFFERENT→PASS-WITH-FLAGS;
PLEASED→PASS; PLEASED+mustFix→INVALID contradiction).

### Anti-rubber-stamp — enforced in code (load-bearing)

`scripts/useradvocate-verdict-schema.mjs` **rejects** a verdict if any rubric answer has empty evidence
or cites nothing real (no bundle file, no measured value); if net/gate disagree with the table; if a
non-PLEASED verdict has no MUST-FIX; or if PLEASED has a MUST-FIX. A rejected verdict is **neither pass
nor fail** — it's sent back to re-grade with evidence. This is the structural defense against the prior
failure mode (*53 tasks "verified" while the runtime showed only a background*). **Evidence or it
didn't happen.**

### How it's wired into the parallel harness

- A reusable agent definition `.claude/agents/user-advocate.md` (the reviewer role; opus; read-only,
  never modifies product files).
- `scripts/verify-catalog-parallel.mjs` gains an **additive** `--advocate <tiles>` final gate that runs
  *after* the functional + art-fidelity tiers, delegates to the real-GPU capture engine, and records a
  `pending-review` advocate slot per tile for the reviewer fan-out (the verdicts are then produced by
  N user-advocate agents **concurrently**, same parallel pattern as the catalog verify). The existing
  312-tile behavior is unchanged when `--advocate` is absent.

---

## PROOF IT EARNED TRUST (the real point)

The reviewer was run on the **current bad state** of the fire pair *before any fix*, on a **positive
control** (the known-good `fire-flame`), and on the **after** state. Verdicts are evidence-cited and
schema-validated.

| Tile | State | NET | Gate | Cited evidence (excerpt) |
|---|---|---|---|---|
| fireball-burst | **BEFORE** | **ANNOYED** | **BLOCKED** | `play-2 coolFrac=1.0 hue=231° → 100% BLUE, not fire`; collapses to `meanLuma~8`, play-3 frozen `Δ=0.18`; **`scale` control dead** |
| heat-column | **BEFORE** | **ANNOYED** | **BLOCKED** | `play-2 effHue=58° (olive), warmFrac=0.23`; static; **`rise` & `wobble` controls dead** |
| fire-flame (reference) | ground-truth | **PLEASED** | **PASS** | white-hot core + amber tongues; `warmFrac 0.78`; both controls act |
| fireball-burst | AFTER | **PLEASED** | **PASS** | white-hot core + orange halo + tongues, `effHue 42°`; all 3 controls live |
| heat-column | AFTER | **PLEASED** | **PASS** | warm rising heat `effHue 27° sat ~0.7`; rise/wobble/intensity all act |

The reviewer also **refused to wave through** the volumetric tiles' first two fix attempts:
round-1 single-plane (still a blocky **tile grid** — BLOCKED on all 6) and round-2 (5 fixed, but
**fog-roll** still had a hard **vertical seam** — BLOCKED). Only after the seam was removed did it pass.
That is the behavior of a gate that is working: it cost two extra rounds rather than rubber-stamping.

**Visual proof:** `notes/verification/useradvocate-sixtile/_SHEET-fire-before-after.png` (fireball
blue/pink-nebula → warm fireball; heat-column olive-haze → warm rising heat) and
`_SHEET-fire-vs-groundtruth.png` (after vs the `fire-flame` reference).

---

## PART B — the eight tiles

All single-plane, TSL-only, contract-preserving (same uniforms/schema). Frames + per-tile verdict JSON
under `notes/verification/useradvocate-sixtile/<tile>/{before,after}/` and `<tile>/after-verdict.json`.

| Tile | Before (the defect) | After (what it reads as) | Final verdict |
|---|---|---|---|
| **fireball-burst** | pink ring / blue core / cream nebula, 100% blue at most phases, dead `scale` | white-hot core, orange halo, red flame tongues — **fire**; `scale` live | **PLEASED / PASS** |
| **heat-column** | static olive-green haze, dead `rise`+`wobble` | warm ember-red→orange rising heat column; all controls live | **PLEASED / PASS** |
| **fog-roll** | blocky slab tiles → (r2) hard vertical seam | smooth continuous rolling fog bank, no seam | **PLEASED / PASS** |
| **smoke** | brick/shelf tile grid, muddy warm-grey | soft billowing rising smoke volume | **PLEASED / PASS** |
| **will-o-wisp** | tiled grid + blown-out colorless white blob, broken `wisps` | luminous magenta wisp core + drifting tendrils; `wisps` adds distinct lights | **PLEASED / PASS** |
| **cosmic-dust** | 2×2 cross-seam brick mosaic, **square** stars | vivid violet/magenta nebula with dust lanes + **round** twinkling stars | **PLEASED / PASS** |
| **clouds** | muddy + (r1/r2) **orange/brown sky** (zero blue) + tile grid | bright white billowing cumulus over a **clean blue sky** | **PLEASED / PASS** |
| **fog** | hard rectangular square-tile checkerboard | clean defined drifting fog with front-to-back depth | **PLEASED / PASS** |

Contact sheets: `_SHEET-volumetrics-after.png` (all six volumetrics).

### The fix discipline (why it worked this time)

- **Fire pair** rebuilt to copy `fire-flame`'s exact recipe: single plane, `MeshBasicNodeMaterial` +
  AdditiveBlending, an **in-gamut** red→orange→yellow→white ramp that is **never multiplied past 1**, with
  brightness carried by the **alpha** and the field **thresholded** so only hot regions emit. The prior
  versions pushed colour past gamut and spread warm energy at mid-alpha over the dark-blue background,
  which read as pink/cream/olive. fireball additionally got a **persistent hot core** so any static
  capture lands on fire (the prior burst faded to a dim blue-bg phase mid-cycle).
- **6 volumetrics**: the slab-stack seams were removed by going **single-plane**, but the agents' first
  pass exposed the value-noise's axis-aligned **integer lattice** as a tile grid. Fixed with a shared
  premium-noise helper `src/lib/prism/animatable/primitives/_volume-fbm.ts` — **rotated-octave + quintic
  (C2) + domain-warped** value noise (`fbmRot`/`fbmWarped`) that cannot read as a square grid — at base
  frequency ≥7, with no centered/abs domain feeding the noise (which had caused mid-quad mirror seams).

---

## Orchestration metrics

| Wave | Shape | Peak ∥ | Outcome |
|---|---|---|---|
| W0 — Part A build | orchestrator inline | 1 | rubric frozen; capture engine; verdict validator; agent def; harness wiring |
| PG — proving ground | parallel advocates | 3 | fireball+heat BEFORE → ANNOYED/BLOCKED; fire-flame → PLEASED/PASS |
| B-fire | orchestrator inline | 1 | fireball + heat-column rewritten (fire-flame discipline) |
| B-vol r1 | parallel Opus agents | 6 | 6 volumetrics → single-plane in-shader |
| B-grade r1 | parallel advocates | **8** | fireball+heat PASS; 6 volumetrics BLOCKED (tile grid) |
| B-vol r2 | parallel Opus agents | 6 | shared `_volume-fbm` + per-tile fixes |
| B-grade r2 | parallel advocates | 6 | 5 PASS; fog-roll BLOCKED (vertical seam); clouds brown-sky GPU bug fixed inline |
| B-fix r3 | orchestrator inline | 1 | fog-roll seam removed |
| regrade | advocate | 1 | fog-roll → PASS |

**Peak parallelism: 8** concurrent Opus agents (the AFTER grading wave). **Real-GPU captures:
backend=webgpu, deviceLost 0** across ~10 capture runs.

### Failures encountered + how they were fixed (fix-don't-skip; nothing faked, no dep downgraded)

1. **Capture range-control fill rejected off-step values** ("Malformed value") → snap control values to the step grid.
2. **`_volume-fbm` tsc overload** on a chained `vec2(node,node)` → permissive `v2` cast (same loose-cast discipline as the primitives).
3. **fireball collapsed to a dim blue-bg phase mid-cycle** (advocate caught it) → added a persistent always-lit hot core.
4. **6 volumetrics still tile-gridded** after single-plane (advocate caught it) → shared rotated-octave/quintic/domain-warped noise helper.
5. **clouds sky rendered brown** despite correct blue colour math. Root-caused empirically (constant-blue rendered blue; `sky` alone rendered blue; the composite went warm) to a **method-form `.smoothstep`/`.mix` GPU extrapolation** on the cast nodes → switched to free-function `smoothstep(edge0,edge1,x)` + `clamp` + `mix`. Confirmed: meanRGB went from warm to B>R blue.
6. **fog-roll vertical seam** from a wrapping `dx - floor(dx+0.5)` front edge (advocate caught it) → continuous drifting `fbmWarped` density modulation.

### tsc + vitest (final)

- **`tsc --noEmit`:** 10 = the documented pre-existing baseline (1 GraphScene GLProps + 9 test-file
  NodeContext mocks), **0 NEW**, none in any touched primitive or the new helper.
- **vitest:** **312 files / 960 tests PASS** (full animatable suite) — the no-regression proof. All 8
  touched tiles' tests pass (uniforms/schema/contract preserved).

---

## Honest flags (non-blocking; nothing here blocks a PASS)

- **smoke** reads warm-neutral grey rather than the claimed cool grey-blue (FLAG — clearly reads as smoke).
- **clouds** horizon lower-third reads slightly green-olive rather than fully blue (FLAG — the sky clearly reads blue overall).
- **cosmic-dust** brighter stars sit on a slightly regular spacing at mid density (FLAG); default drift is gentle.
- **fog-roll** fills the quad fairly evenly — reads as ambient drifting fog more than a hard "rolls in from one side" bank (FLAG — acceptable for fog).
- **will-o-wisp** at the largest `glowSize` blooms to near-white in the centre (FLAG).
- **Capture limitation:** motion-type controls (speed/drift/roll) show `changed=false` in the *paused*
  control-sweep because their effect is motion; the reviewers judge those from the play-frame deltas. A
  future capture upgrade could sweep speed-type controls during playback.
- **Guardrails:** no second renderer / PixiJS; no diffusion-drawn text; no global-fps; **no dependency
  downgrades**; no new deps (the shared noise helper is local). Additive-only changes; the frozen
  Animatable contract and all 304 other primitives are untouched (960 tests green).

---

## Plain-language summary for Logan

**Did the user-advocate prove it catches real problems without rubber-stamping?** Yes, clearly. I built
it as a fresh set of eyes that *drives your running app on the real GPU* — focuses a tile, plays it,
wiggles every slider — and then judges what it sees like a normal person, with a hard rule: **it has to
point at the exact frame or number behind every claim, or the verdict is thrown out by a validator.**
Before I changed anything, it looked at the broken fireball and said *"that's a pink-and-blue blurry
orb, 100% of its colour is blue — that is not fire — ANNOYED, blocked,"* and it said the heat column
was *"a static olive-green smudge with two dead sliders."* It also looked at your known-good `fire-flame`
and correctly said *"that's real fire — pleased, pass."* So it fails the bad and passes the good. And
when my first two attempts at the smoke/fog/cloud tiles were still blocky, **it refused to pass them** —
it cost me two extra rounds of work instead of letting them through. That's exactly the behavior you
want from a gate.

**Are the eight tiles fixed?** Yes — all eight now pass it with cited evidence:
- **The fireball and heat column read as real fire/heat now** (warm white-hot cores, orange flames) —
  the pink/blue and olive are gone. See `_SHEET-fire-before-after.png`.
- **The smoke, fog, fog-roll, will-o-wisp and cosmic-dust** went from blocky tile grids to real soft
  volumes (the trick was a better noise that can't show a square grid).
- **The clouds** are now bright white over a **clean blue sky** — there was a sneaky GPU bug turning the
  sky brown that I root-caused and fixed.

Nothing regressed: your full 312-tile catalog still passes all 960 tests and loads fine on the GPU.
**Nothing is committed — it's all staged for your review on `prism-editor-build`,** with every
before/after frame and every reviewer verdict under `kid-kode-landing/notes/verification/useradvocate-sixtile/`.

One honest note: a handful of subjective nits remain (a slightly green cloud-horizon, smoke that's more
warm-grey than blue-grey, gentle nebula drift) — I've flagged each rather than papering over it.
