# SHELL W-VIS — Visual Convergence & Design-Lane Upgrade

**Wave:** PRISM-WVIS · **Branch:** `codex/prism-recovery-harness-20260630` ·
**Authority:** `docs/prism/RATIFICATION-2026-07-09.md` +
`docs/prism/BAKEOFF-TABLE-SIGNED.md` + `SHELL-WBAKEB-REPORT.md` §3/§6 ·
**Cap:** \$85 metered hard, \$35 D1 sub-cap, \$0.50 stop margin.

---

## 0. The lede (I-V4 — stated plainly, up front)

Two findings dominate this wave, and both are stated before anything else.

**FINDING 1 — the D1 convergence verdict is negative and it is decisive.**
Same-model, single-iteration, critique-and-frame revision **does not converge
failing visual renders toward the SLO. It degrades them on average.** Across a
stratified 60-render failing sample, one revision iteration moved mean score
**26.7 → 22.7 (Δ₁ = −4.0)**, and **0 / 60** renders reached ≥85 within one
iteration. A no-feedback **best-of-2 resample control did better (+5.9)** than
the loop on the same renders (−2.4). **The production SLO is not one
revision-loop away.** The value of this wave is therefore not the D5
see-then-revise loop — it is the *generation-side* levers (D2/D3/D4/D6), which
are built, tested, and demonstrably functional.

**FINDING 2 — the wave hit a hard, three-way funding boundary mid-execution,
so the D7 SLO number is UNFILLED.** During D7 all three inference routes drained
simultaneously: the founder Claude subscription (CLI / subscription-equivalent
lane) returned `429 — out of usage credits, resets Jul 15 9pm CT`; OpenRouter
went to a negative balance (−\$0.77 of the \$99 credit line); DeepInfra returned
`402 — needs positive balance`. This blocks (a) D1 iteration-2 judging and (b)
the D7 revise pass + blind-rotation judging that produce the SLO number. The
D7 **generation pass is complete and its objective metrics are strong**, but the
subjective ≥85 within-budget SLO cannot be computed under a blind-rotation judge
without a funded route. It is reported UNFILLED-pending-funding, not
manufactured. Re-funding is a founder billing decision (and no autonomous
payment mechanism exists here).

**Disposition.** The *run* is complete — every reachable deliverable executed and
every result disclosed — but the *product* is not a win. The criteria-reviewer
passed the wave's work and report (0 MUST-FIX); the user-advocate returned
**DISPLEASED** because 2D UI is systemically broken and the ≥85 SLO is unmeasured
(§6). The marker at the foot of this report terminates the run; it does not claim
the SLO was met. The unmet gap is handed to W-DISPATCH (§7).

Everything below is the evidence for those two sentences.

---

## 1. D1 — Loop-convergence probe (the decisive measurement)

**Design.** Input = the 369 judged renders + region-anchored critiques from
`notes/bakeoff-b/` (the signed W-BAKEB corpus). A stratified sample of **60
failing renders** (6 per model × 10 models; band × 2D/3D strata; parse-failures
excluded as a D6 format problem, not a convergence problem) each carried its own
critique. **Loop arm:** same-model revision (signed repair law) given the
critique **and** the model's own 800px frame — vision arm for the six
vision-confirmed models (fable/opus/sonnet/haiku/gemini/kimi via OpenRouter
`image_url`), a labeled **text-critique-only** arm for the four text-only models
(glm/deepseek/mercury/gpt-oss). Re-render → blind re-judge under W-BAKEB rotation
(`judgeModel: claude-fable-5`). **Control arm:** best-of-2 blind resample on 20
specs, no feedback.

### 1.1 Overall convergence (n = 60, iteration 1)

| Metric | Value |
|---|---|
| Mean score before (S₀) | **26.7** |
| Mean score after 1 iter (S₁) | **22.7** |
| **Mean Δ₁** | **−4.0** |
| Reached ≥85 within 1 iter | **0 / 60 (0%)** |
| Mean wall / iter | 4.4 s |
| Mean metered cost / iter | \$0.130 |

Iteration-2 was generated (52 revise calls, ledgered) but **not judged** — the
judge route drained before the iter-2 blind batch could run (§5, anomaly 1).
The within-2 cell is therefore UNFILLED; the within-1 signal (−4.0, 0/60)
already settles the verdict.

### 1.2 By revision arm — the frame helps, the text critique hurts

| Arm | n | S₀ | S₁ | Δ₁ |
|---|---|---|---|---|
| **vision** (critique + own frame) | 36 | 28.9 | 28.3 | **−0.6** |
| **text-critique-only** (no frame) | 24 | 23.4 | 14.3 | **−9.1** |

Seeing its own render keeps a model roughly break-even; a text critique with no
frame actively **destroys** score (−9.1). This is a real result: blind textual
self-repair is worse than doing nothing.

### 1.3 By model class — a few climb, most fall

| Model | S₀ | S₁ | Δ₁ | ≥85 w/1 |
|---|---|---|---|---|
| claude-fable-5 | 33.2 | 50.2 | **+17.0** | 0/6 |
| gemini-3.5-flash | 19.0 | 35.0 | **+16.0** | 0/6 |
| claude-opus-4.8 | 30.3 | 36.5 | **+6.2** | 0/6 |
| gpt-oss-120b | 14.0 | 15.2 | +1.2 | 0/6 |
| claude-haiku-4.5 | 24.3 | 18.8 | −5.5 | 0/6 |
| mercury-2 | 22.3 | 13.5 | −8.8 | 0/6 |
| glm-5.2 | 25.0 | 10.8 | −14.2 | 0/6 |
| deepseek-v4-flash | 32.3 | 17.7 | −14.7 | 0/6 |
| kimi-k2.7-code | 36.8 | 21.0 | −15.8 | 0/6 |
| claude-sonnet-5 | 29.7 | 8.5 | **−21.2** | 0/6 |

Only the ceiling ref (fable) and two others climb; the SLO contestant floor
(sonnet) *falls the hardest* (−21.2). **No model — not even fable — reached ≥85
from a deep-failing seed in one iteration.**

### 1.4 Control: resampling beats the loop

Best-of-2 blind resample vs the same-render loop (11 of 20 control specs judged
before the funding boundary; 9 unjudged — §5 anomaly 3):

| Strategy | Mean Δ vs S₀ |
|---|---|
| **Best-of-2 blind resample** (no feedback) | **+5.9** |
| Same-render loop revision (blind, take revision) | **−2.4** |
| Loop *best-of-1* (oracle keeps better of orig/revised) | +9.1 |

You only gain if a **judge selects** the better of N samples; taking the blind
revision loses. And even best-of-2 did not reach ≥85 (0/11) from these seeds.

### 1.5 D1 verdict

> **The same-model single-iteration revision loop does not converge visual
> nodes to the SLO. On average it degrades quality; a frame keeps it
> break-even, a text-only critique makes it markedly worse, and a no-feedback
> best-of-2 resample outperforms it. The SLO is NOT one wave / one loop away —
> the convergence mechanism must be generation-side (D2/D3/D4/D6) and
> selection-based (best-of-N under a judge), not blind self-revision.**

D1 spend: **metered \$17.11 of the \$35 sub-cap**; subscription-equivalent
(founder-CLI judge) \$14.18. Recompute source: `notes/wvis/d1/d1-metrics.json`,
`scores-iter1.json`, `scores-control.json`.

---

## 2. The six levers — evidence (all additive; I-V1)

All lever code is additive to the routing law of `BAKEOFF-TABLE-SIGNED.md`
(tiers unchanged — this wave changes *how* lanes work, never *which* model runs
a tier). Verified WITHOUT inference: **88 passed / 1 skipped** across the four
WVIS suites + the flight-recorder suite.

### 2.1 D2 — Spec-manifest completeness gate (kills MISSING_SPEC_ELEMENT)

Generators emit an `@spec-manifest` end-comment mapping every L3 spec element
(deterministic ids `text.*/color.*/effects.*/layer.*/interaction.*/primitive.*`)
to a code location. A deterministic pre-render gate rejects
missing/unparseable/ghost-location manifests back to the generator with one-retry
feedback (`SPEC_MANIFEST_INCOMPLETE`). Opt-in (`enforceSpecManifest`) so legacy
stored modules verify unchanged; the codegen lane opts in for new generations.
**`tests/unit/WVIS.spec-manifest.test.ts` — 12 tests green, including the seeded
incomplete-manifest judge fixture.** Live proof it fires in production is in §3.1
(sonnet: gate triggered 9 retries, recovered 18/20).

### 2.2 D3 — Preset libraries (render-proven; I-V2)

| Library | Count | Requirement |
|---|---|---|
| Light rigs (key/fill/rim, mood-tagged) | **14** | ≥12 ✓ |
| Camera framings | **12** | ≥10 ✓ |
| Composition layouts (2D + 3D) | **12** | ≥10 ✓ |

**38 presets, 38 committed `.webp` thumbs on disk (the visual proof), 38
proof-bundle JSONs** (compiled module + sceneSpec) under
`notes/bakeoff/renders/bundles/wvis-presets/` (`light-rigs/`,
`camera-framings/`, `composition-layouts/`). No catalog entry without a thumb
(I-V2). Re-verified this session: `node scripts/wvis/d3-proof-bundles.mjs` →
"38 preset proof bundles (0 transform failures)". Numbers reflect the physical-light retune (spot keys ~×12.5, points ~×8
under decay-2 candela; commit `4e2e9332`) — e.g. `rig-product-hero` key is now
`intensity 65`. Design-director emits preset **selections + parameters** on
`PrismVisualSpec.presetSelections` (additive, INV-18); freeform numbers are the
fallback (absent selection ⇒ byte-identical prompt). `WVIS.design-presets.test.ts`
— 12 green (one stale assertion `intensity 5.2 → 65` corrected this session).

### 2.3 D4 — Reference-frame conditioning

Per visual node a FLUX composition frame (no-text negative per INV-11) rides the
generation call for multimodal routes; text-only routes get a structured frame
description (labeled arm in the recorder). Critic scores render-vs-frame via
`FRAME_FIDELITY_RUBRIC_ADDENDUM` alongside the DL rubric. **Live coverage in D7:
image arm 20/20 on BOTH models** (§3.1) — every gen call carried its frame.

### 2.4 D5 — Hero lane: see-then-revise default

`design-lane.ts` makes generate → mount+capture → same-model reads-own-frame →
revise the default, OD11-budgeted (hero ≤2 seen iterations, standard ≤1),
best-of-2 on hero, deterministic hero classifier with plan override.
`WVIS.design-lane.test.ts` green. **Caveat, per D1:** the measured convergence
value of this loop is ≤0 from deep-failing seeds; its role in production is
best-of-N *selection*, not blind acceptance of the revision (§1.5, §7).

### 2.5 D6 — Protocol wrappers + 2-nearest exemplars

Model-specific wrappers (raw-output for haiku/deepseek fence habits; no-prose for
gemini/glm; plan-then-code + END-ordered constraint checklist universal) +
exemplar retrieval upgraded to the **2 nearest** by node class/style (8 annotated
committed pairs) replacing the generic six. `WVIS.protocol-wrappers.test.ts`
green. Flight-recorder columns `prism.design.*` (iterations_used,
iteration_scores, presets, reference_frame arm, frame_fidelity, best_of) +
`prism.sentinel.luna_first_pass_regression` (signed-table condition 4) — suite
green.

---

## 3. D7 — SLO validation (partial: generation pass complete, judged SLO UNFILLED)

**Design (as specified).** Re-run the frozen 20 visual specs (8 hero / 12
standard; 8×3D, 12×2D) through the UPGRADED lane (D2+D3+D4+D5+D6 active) with
**claude-sonnet-5** (contestant reliability floor) and **claude-fable-5** (ceiling
ref); blind judging, W-BAKEB rotation (Fable judges the sonnet lane, Opus judges
the Fable lane), W-2D capture discipline.

**What ran.** The generation pass (r100) completed for both models and frames
were captured. The see-then-revise pass (r101/r102) and the blind-rotation judge
were cut off by the funding boundary (§5). Under the rotation rule, Opus (this
orchestrator) is a legal judge only for the *fable* ceiling lane — the *sonnet*
contestant floor's assigned judge is Fable, which lives on the dead CLI route.
A lopsided, half-lane subjective SLO would violate I-V3/I-V4, so **the subjective
≥85 within-budget SLO is reported UNFILLED**, and only the *objective*
generation-pass metrics (below) are reported as numbers.

### 3.1 The generation-pass objective metrics ARE strong

| Metric | claude-fable-5 (ceiling) | claude-sonnet-5 (floor) |
|---|---|---|
| Gen OK (API call) | 20/20 | 20/20 |
| Module parsed (default-export present) | 20/20 | 19/20 (v-16 PARSE_FAILURE) |
| **D2 manifest gate pass** | 20/20 (0 retries) | **18/20 (9 retries fired)** |
| Renderable, 0 dep-violations | 20/20 | 18/20 |
| **D4 reference-frame image arm** | 20/20 | 20/20 |
| Frames mounted (`nodeMounted`) | 20/20 | 18/20 |
| Wall p50 | 70 s | 2.2 s |
| Gen cost | \$13.62 sub-equiv | \$3.06 metered |

This is direct, objective proof the gen-side levers work: the **D2 gate fired on
sonnet (9 retries) and recovered 18/20 complete manifests**; **D4 rode 100% of
gen calls**; the two lanes produced 39/40 module-parseable, dep-clean modules and
38/40 mounted renders. (Sonnet's 2 non-mounts are v-12 — SPEC_MANIFEST_INCOMPLETE,
12 unmapped elements — and v-16 — PARSE_FAILURE, no default export. Both are the
gate/parse doing their job; the empty v-16 frame carries `nodeMounted:false` and
is disclosed, not hidden.)

**Capture-backend caveat (disclosed):** the D7 frames were captured under the
**WebGL2 fallback** (`navigator.gpu` undefined in the capture initScript), not
WebGPU. The defect this section judges is a geometry/composition failure
(mis-scaled element, camera too close) that is backend-independent — it renders
identically either way — so the qualitative read stands. W-DISPATCH should
re-capture the *fixed* frames under WebGPU before trusting color/material fidelity
(§7).

### 3.2 Qualitative frame read (6 frames eye-checked; honest and mixed)

The gen frames are **not uniformly production-grade — they split cleanly by
category**, which is itself the D7 finding:

| Frame | Category | Read |
|---|---|---|
| fable `v-01-orbit-product-hero` | 3D hero | **Production-grade.** Gold-cased orrery watch, guilloché dial, red jewels, dramatic key light, pedestal, soft shadow. |
| sonnet `v-01-orbit-product-hero` | 3D hero | **Strong.** Same composition, real materials + lighting. |
| fable `v-03-glass-prism-refraction` | 3D hero | **Strong.** Real glass transmission, red jewel refracting inside the prism. |
| sonnet `v-14-pricing-card` | 2D hero | **Broken.** Oversized blurred panel fills frame, camera far too close. |
| fable `v-14-pricing-card` | 2D hero | **Broken.** Same intrusive oversized element, unreadable. |
| sonnet `v-09-editorial-oversized-type` | 2D std | **Broken.** Extreme close-up, oversized blurry blob, red accent line. |

**Systemic finding (both lanes):** the **best 3D hero shots (v-01, v-03) render
production-grade**; **2D UI cases are systemically broken**; and the 3D win is
*not* clean — the same intrusive element already creeps into v-02/v-05/v-08 at
smaller scale (the user-advocate flagged this; it is corrected here). One shared
backing/reference-frame element is mounted at a scale/position that is a
negligible background artifact on the strongest 3D hero shots but *fills the
frame* on flat 2D compositions (camera too close, element mis-scaled). It is
model-independent (fable and sonnet fail v-14 identically), so it lives in the
2D composition/camera preset → scene mapping, not in a model. This is exactly the
kind of defect blind D7 validation exists to surface; it is the top inheritance
for W-DISPATCH (§7).

Frames: `notes/wvis/d7/frames/<model>/<case>-r100.png` (+ `.meta.json` probes).

### 3.3 The SLO number

> **D7 within-budget ≥85 SLO (per model, vs the signed ≥80% target): UNFILLED —
> pending a funded judge route.** The generation pass that feeds it is complete
> and its plumbing is sound (§3.1); the subjective quality it needs is genuinely
> mixed (§3.2) and *must* be measured by the blind-rotation judge, not
> estimated. See §7 for the completion path.

---

## 4. Cost ledger (per-call, `notes/wvis/ledgers/`)

| Ledger | Metered | Sub-equiv |
|---|---:|---:|
| d1-control | \$2.02 | — |
| d1-revise-iter1 | \$7.80 | — |
| d1-revise-iter2 | \$7.30 | — |
| d1-judge-iter1 | — | \$11.77 |
| d1-judge-control | — | \$2.41 |
| d7-ref-frames (FLUX) | \$0.80 | — |
| d7-sonnet (gen+partial revise) | \$7.17 | — |
| d7-fable (gen via CLI) | — | \$13.62 |
| **TOTAL** | **\$25.09 / \$85** | **\$27.80** |

Metered headroom remaining: **\$59.91**. The wave was **not** stopped by its own
budget — it was stopped by the *prepaid balances of the metered providers* and
the *subscription usage window*, which are external to the \$85 cap. D1 stayed
inside its \$35 sub-cap (\$17.11).

---

## 5. Disclosed anomalies

1. **Three-route funding exhaustion (the load-bearing anomaly).** CLI /
   subscription-equivalent: `429 out of usage credits, resets Jul 15 9pm CT`.
   OpenRouter: negative balance (−\$0.77 of \$99; `402`). DeepInfra: `402 needs
   positive balance`. All three confirmed by live probe this session. Blocks D1
   iter-2 judging + D7 revise/judge/SLO. Re-funding is a founder billing action.
2. **Systemic 2D-composition defect** in the upgraded gen lane (§3.2): a shared
   backing/reference element intrudes; negligible on 3D, frame-filling on 2D.
   Model-independent → preset/scene-mapping bug, not a model regression.
3. **D1 control partially judged** (11/20) before the boundary; aggregate
   (best-of-2 +5.9 vs loop −2.4) is over the 11 judged specs.
4. **D7 revise incomplete:** fable revise1 0/20 (CLI hit the `429` window mid-
   stage — the exact model-switch boundary at 01:25 CT), sonnet revise1 14/20
   (5×`402`, 1–2 legitimate "kept previous as final" — incl. the already-broken
   v-16 whose gen module never parsed).
5. **Stale test assertion fixed:** `WVIS.design-presets.test.ts` expected the
   pre-retune `intensity 5.2`; corrected to the shipped `intensity 65`. Product
   was correct; the test lagged the `4e2e9332` retune.

---

## 6. Judge verdicts (verbatim)

Both judges ran in fresh context on this report + the raw artifacts. Neither
route external inference — they run on the orchestrator session (Opus), which is
why they were reachable when the metered/CLI generation routes were not.

### 6.1 criteria-reviewer — **PASS, 0 MUST-FIX**

> **VERDICT: PASS — 0 MUST-FIX.** Every headline number in
> `notes/SHELL-WVIS-REPORT.md` reproduces exactly from raw artifacts. The
> honesty claims (UNFILLED SLO, additive-only, funding boundary) hold under
> adversarial recount.

Per-item (all recomputed from raw, not trusted from the report):
- **Item 1 — D1 convergence recount: PASS.** S0 26.7 / S1 22.72 / Δ1 −3.98 /
  0-60 ≥85; vision −0.6, text −9.1; control best-of-2 +5.9 vs loop −2.4; all 10
  per-model rows reproduce; every s1 matches `scores-iter1.json`, every s0 matches
  `sample.json originalScore` (0 divergence).
- **Item 2 — D7 objective gen metrics: PASS.** fable 20/20 gate 0-retry; sonnet
  18/20 gate 9-retries; both image-arm 20/20; mounted 20/20 & 18/20. Sonnet's 2
  gate failures = v-12 (12 unmapped) + v-16 (PARSE_FAILURE) = the 2 non-mounts.
- **Item 3 — SLO honestly UNFILLED: PASS.** No `scores.json` anywhere; fable
  r101 = 20/20 CLI transportError, sonnet r101 = 5× HTTP 402. "manufacturing a
  lopsided half-lane number would have been the dishonest move, and they refused
  it."
- **Item 4 — preset re-render / provenance (I-V2): PASS.** `d3-proof-bundles.mjs`
  → "38 preset proof bundles (0 transform failures)"; 14+12+12=38; parameter
  provenance byte-exact (rig-product-hero emits SpotLight(…,65)/…/AmbientLight(…,0.1)
  identical to light-rigs.ts).
- **Item 5 — D2 gate rejects seeded incomplete manifest: PASS.** vitest 12/12;
  the SEEDED_INCOMPLETE_MODULE fixture is genuine (omits color.accent +
  primitive.orbit, ghost-locates color.gradient), asserts ok===false. "Not a
  no-op."
- **Item 6 — I-V1 additive-only: PASS.** WVIS range 803 files, 29,274 insertions,
  **1 deletion** (a single line in prompts.ts gaining `${manifestSection}`).
  `contestants-b.mjs` bit-identical; `BAKEOFF-TABLE-SIGNED.md` untouched.
- **MUST-FIX: NONE.** Nits (non-blocking, all folded into this report revision):
  §3.1 sonnet strict module-parse is 19/20 not 20/20; "38 proof frames" are
  proof-bundle JSONs + 38 webp thumbs; anomaly-4 kept-previous is 1–2.

### 6.2 user-advocate (founder proxy) — **DISPLEASED**

The advocate eye-checked 14 D7 frames across both models and both categories.
Verbatim conclusions:

> **Q1 — Does the "3D production-grade / 2D systemically broken" split hold?**
> "Mostly yes, with one honest refinement. The 2D half of the claim is fully
> confirmed… fable and sonnet fail v-14 *identically* — so it's a preset/scene-
> mapping bug, not a model. The 3D half is slightly over-stated: v-01 and v-03
> are genuinely production-grade, but v-02, v-05, and v-08 already show the same
> intrusive white/gray blob creeping in."
>
> **Q2 — Would Logan ship these?** "3D hero (v-01, v-03): YES, ship as-is… 3D
> secondary (v-02, v-05, v-08): NO, not until the blob is fixed… 2D (all): NO,
> absolutely not. Not one 2D frame is presentable."
>
> **Q3 — Is UNFILLED honest, or burying a failure?** "Honest and defensible…
> the report leads with the *bad* news (the D1 −4.0 convergence result and the
> 2D defect) in paragraph one… You don't lead with your worst finding if you're
> trying to bury it. The judge route being defunded (not the number being
> suppressed) is a legitimate reason to mark the subjective SLO UNFILLED."
>
> **DISPLEASED** — "The wave is honest and the 3D hero shots are shippable, but
> with 2D UI systemically broken across every frame, the intrusive-element bug
> bleeding into half the 3D cases too, and the actual ≥85 SLO number unfilled, I
> cannot sign this as done — the top-priority 2D composition/camera fix must land
> and the SLO must be measured on a funded route before I'd call it a win."

**Reading of the split verdict.** The two verdicts are not in conflict: the
criteria-reviewer certifies the *wave's work and its report are correct and
honest* (0 MUST-FIX); the user-advocate certifies the *product is not yet a
win* (2D broken, SLO unmeasured). Both are true, and both are recorded here
without softening. This wave delivered a decisive (negative) D1 measurement and
six built-and-verified levers; it did **not** reach the visual SLO, and the
advocate is right that it is not "done" as a product. That gap is the explicit
charter of W-DISPATCH (§7).

---

## 7. What W-DISPATCH inherits

1. **The convergence architecture is decided (D1).** Do **not** build visual
   convergence on blind same-model single-iteration revision — it degrades
   (−4.0; text-only −9.1). Build it on (a) **generation-side quality** (the D2/
   D3/D4/D6 levers, all shipped and functional here) and (b) **best-of-N
   selection under a judge** (+5.9 vs −2.4). Even selection did not reach 85 from
   deep-failing seeds in one round — depth of the first pass matters more than
   iteration count.
2. **The gen-side levers are durable inheritance.** D2 manifest gate (fires +
   recovers, live-proven), D3 38-preset render-proven library, D4 reference-frame
   conditioning (100% image-arm coverage), D6 wrappers + 2-nearest exemplars —
   all additive, tested, and on `PrismVisualSpec`/the codegen path.
3. **Open defect to fix first:** the 2D-composition/camera-framing → scene
   mapping (§3.2). 3D product renders already clear a high bar; flat 2D UI does
   not. This is the single highest-leverage fix for the SLO.
4. **Open work, funding-gated:** re-fund one metered route (or wait for the
   Jul 15 9pm CT subscription reset) → (a) judge D1 iter-2 for the within-2 cell,
   (b) complete the D7 revise pass, (c) run the D7 blind-rotation judge → fill the
   real SLO number. All harness code for this exists and is committed
   (`scripts/wvis/d7-lane.mjs`, `d7-judge.mjs`, `d7-metrics.mjs`,
   `d1-revise.mjs`, `d1-judge.mjs`); it resumes on a funded route with no new
   build.

---

## 8. Invariant attestation

- **I-V1** Additive only; routing tiers per `BAKEOFF-TABLE-SIGNED.md` unchanged
  (git diff = new files under `src/lib/prism/{design-presets,codegen}`, tests,
  `notes/wvis/`, scripts; no tier reassignment). ✓
- **I-V2** All 38 D3 presets render-proven with committed thumbs. ✓
- **I-V3** Blinding + judge rotation per W-BAKEB where a judge ran (D1 iter1 +
  control); D7 rotation judge could not run (funding) → SLO UNFILLED rather than
  a blinding-compromised number. ✓ (honest non-run)
- **I-V4** Poor/incomplete convergence disclosed in the first paragraph. ✓
- **I-V5 / INV-19** No key material in any artifact; key values never printed. ✓
- **I-V6** Marker verbatim below. ✓

---

PRISM-WVIS: RUN COMPLETE
