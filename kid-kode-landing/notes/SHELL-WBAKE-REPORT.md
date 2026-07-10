# SHELL W-BAKE — Three-Axis Model Bakeoff Report

**Wave:** PRISM-WBAKE (spec §11 + OD12) · **Authority:** `docs/prism/RATIFICATION-2026-07-09.md` · **Dates:** 2026-07-09 → 2026-07-10
**Nature:** measurement wave. Every number below traces to a committed artifact under `kid-kode-landing/notes/bakeoff/` (I-B3). No production config was touched (I-B1).

---

## 1. D0 — Spec v0.2 amendment (first commit of the chain)

Commit **`2499651b`** (`shell-wbake D0`):

- `docs/prism/PRISM-SWARM-DISPATCH-SPEC.md` footer/status → **"v0.2 — RATIFIED 2026-07-09 per RATIFICATION-2026-07-09.md"**; OD1–OD7 dispositions applied inline in §12 (one line each, marked RATIFIED). Spec body otherwise untouched.
- `docs/prism/PRISM-SWARM-DISPATCH-AMENDMENT-B.md` created — OD8–OD13 verbatim from the ratification record, marked RATIFIED 2026-07-09.
- `docs/prism/SPEC-INDEX.md` — swarm-dispatch status line updated, citing the record (founder sign-off for this edit = the record itself).

The ratification record and the WBAKE chain prompt were committed in the same commit as chain authority.

## 2. D1 — Corpus construction + freeze proof

Commit **`359d1eca`** (`shell-wbake D1`), authored ONCE before any contestant call (I-B2):

- **Functional corpus** (`notes/bakeoff/corpus/functional/`): 50 node specs from the Nova Atelier reference plan — 33 derived via the certified `authorNode` path + 17 disclosed extras; stratified **30 simple / 15 moderate / 5 complex**; 9 of the 15 moderate cases are integration-bearing (≥8 required) plus 2 complex-int, **11 integration-bearing total**. Prompts: `L1 = SHARED_SYSTEM_PROMPT` verbatim, ONE compiled L2 WORLD block (content-hashed `worldHash`), per-case frozen L3 strings.
- **Visual corpus** (`notes/bakeoff/corpus/visual/`): 20 hero/visual node specs, **8 genuinely 3D** (camera, lighting, materials, motion; ≥6 required). Full visualSpecs authored once by the Fable 5 design-director pass with concrete values (hex ramps, type scale, spacing rhythm, camera+light params, material refs, cubic-bezier curves, contrast minimums); $3.91 ledgered, transcripts committed.
- **Freeze proof:** sha256 freeze manifests committed with the corpus. `git diff 359d1eca..HEAD -- notes/bakeoff/corpus/` = **0 lines**, working tree clean — zero post-freeze edits, so no runs were invalidated. The corpus regenerator reproduces the frozen corpus byte-identically (commit `aac8835b`).

## 3. D2 — Axis 1: functional first-pass verification (spec §11)

Commit **`6113ded4`** (`AXIS 1 CLOSED`). 10 ratified contestants; identical L1+L2+L3 per node; 3 runs per node, temperature per model card default; verification through the **shipped** `src/lib/prism/codegen/verifier.ts::verifyNodeModule`, NO repair in the primary pass. Raw generations, verifier logs and metrics: `notes/bakeoff/runs/axis1/` (`verify-metrics.json` is the graded rollup).

### Reachability (proof committed per model)

| Contestant | Route | Status |
|---|---|---|
| Claude Haiku 4.5 | claude CLI (founder-authenticated) | RAN (150/150) |
| Claude Sonnet 5 | claude CLI | RAN (150/150) |
| GLM-5.2 | Fireworks | RAN (150 attempted, 42 transport errors → 108 graded) |
| DeepSeek V4-Flash | Fireworks | RAN (150 attempted, 35 transport errors → 115 graded) |
| Kimi K2.7 Code | Fireworks | **TRUNCATED at 7 graded** — Fireworks account suspended mid-lane (HTTP 412) |
| gpt-oss-120b (open control) | Fireworks → **Groq** (dual-homed mid-wave) | RAN (150 attempted, 13 transport errors → 137 graded) |
| Gemini 3.5 Flash | DeepInfra | **BLOCKED-402** (unfunded; reprobed, proof in `runs/axis1/gemini-3.5-flash-BLOCKED.json`) |
| MAI-Code-1-Flash | none found | **UNREACHABLE** (proof committed) |
| GPT-5-nano | none found | **UNREACHABLE** (proof committed) |
| Mercury 2 | none found | **UNREACHABLE** (proof committed) |

No OpenRouter key exists on this machine (`.constellation/` absent — checked again 2026-07-10); no Anthropic API key, Google, OpenAI, Azure, or Inception credentials. Cerebras + DeepInfra keys exist but return 402 (founder console actions D-01/D-02 from W-PROD still pending).

### Axis 1 metrics (first-pass rate = primary; graded through the shipped verifier)

| Model | Graded | First-pass | By run (spread) | Simple | Moderate | Complex | Parse raw / fence-strip | p50 / p95 wall | Cost per node | Top violations |
|---|---|---|---|---|---|---|---|---|---|---|
| **claude-haiku-4.5** | 150 | **88.0%** | .90/.84/.90 (0.06) | 94.4% (n=90) | 80.0% (n=45) | 73.3% (n=15) | 0.02 / 1.00 | 77.5s / 115.6s | $0.0489¹ | GLB_LOADER 9, TEXT_CONTENT 5 |
| **kimi-k2.7-code** | **7 ⚠** | 85.7%-of-7 | .67/1/1 (0.33) | 85.7% (n=7) | — (n=0) | — (n=0) | 0.43 / 1.00 | 46.8s / 62.4s | $0.0284 | CLEANUP 1 |
| **glm-5.2** | 108 | **76.9%** | (0.083) | 78.2% (n=78) | 76.0% (n=25) | 60.0% (n=5) | 0.14 / 0.95 | 90.2s / 103.9s | $0.0367 | TEXT 9, GLB 7, PARSE 5 |
| **gpt-oss-120b** | 137 | **72.3%** | (0.052) | 75.3% (n=85) | 73.7% (n=38) | 50.0% (n=14) | 1.00 / 1.00 | 17.9s / 68.1s | **$0.0016** | TEXT 17, GLB 13, CLEANUP 9 |
| **claude-sonnet-5** | 150 | **60.0%** | .62/.56/.62 (0.06) | 45.6% (n=90) | **82.2%** (n=45) | **80.0%** (n=15) | 0.32 / 1.00 | **14.0s / 21.6s** | $0.0499¹ | TEXT_CONTENT 55 |
| **deepseek-v4-flash** | 115 | **59.1%** | .49/.60/.71 (0.22) | 62.0% (n=71) | 51.5% (n=33) | 63.6% (n=11) | 0.00 / 0.99 | 19.5s / 45.0s | $0.0010⁴ | TEXT 27, GLB 10, WINDOW 6 |

¹ Claude-lane costs are **subscription-equivalent** (computed from CLI-reported usage at published API rates) — the CLI bills against the founder's subscription, not metered dollars. Claude-lane wall times include a small constant CLI harness envelope (~2K tokens), disclosed; p50 wall for haiku includes CLI startup and is not transport-comparable with raw-API lanes.
⁴ Corrected 2026-07-10 after the criteria-reviewer's recount: the metrics rollup had a stale deepseek cost ($0.0038) predating the fireworks-rate correction of commit `aac8835b` (the recompute script fixed raw records + ledgers but not `verify-metrics.json`). The rollup was regenerated through the shipped verifier test (byte-identical grading, cost re-derived from the corrected raw records) and recommitted.

**Integration-bearing subset** (11 frozen cases: 9 moderate-int + 2 complex-int; first-pass across all 3 runs, recounted from `verify-logs/`):

| Model | Integration-bearing first-pass |
|---|---|
| claude-haiku-4.5 | **81.8% (27/33)** |
| claude-sonnet-5 | 75.8% (25/33) |
| glm-5.2 | 75.0% (15/20 graded) |
| gpt-oss-120b | 62.1% (18/29 graded) |
| deepseek-v4-flash | 44.0% (11/25 graded) |
| kimi-k2.7-code | no coverage (lane truncated before the integration cases) |

**Reading the table honestly:**
- **haiku-4.5 is the first-pass leader at full coverage (88.0%)** with the lowest complex-tier drop.
- **sonnet-5's 60.0% is dominated by a single simple-tier failure cluster**: 55 MISSING_TEXT_CONTENT hits. Inspection of the raw generations (e.g. `runs/axis1/claude-sonnet-5/f-01-simple-r1.json`) shows sonnet **does** render real MSDF text via `ctx.fontAtlas` — but it **hardcodes the copy inline** instead of iterating `config.textContent`, which the shipped verifier (and spec §10.C L385) correctly rejects: node copy must stay data-driven or regeneration breaks. A real, narrow, highly repair-able habit (see repair table) — moderate 82.2% and complex 80.0% are the strongest of any model.
- **kimi-k2.7-code's 85.7% is 7 nodes** — the Fireworks suspension killed the lane (HTTP 412, mid-run). Not comparable; reported as truncated, never extrapolated.
- **gpt-oss-120b is 30× cheaper than the Claude lanes** at 72.3% and the only model with 100% raw parse (no fences ever).

### Repair-loop depth (separate single-repair-allowed pass on first-pass failures)

| Model | Attempted | Fixed at depth 1 | Still failing | Transport-blocked |
|---|---|---|---|---|
| claude-haiku-4.5 | 5² | 5 | 0 | 0 |
| claude-sonnet-5 | 19² | 19 | 0 | 0 |
| gpt-oss-120b | 0 | 0 | 0 | **14** (Fireworks suspension hit the repair pass; relabeled honestly) |
| glm-5.2 / deepseek / kimi | — | — | — | repair pass blocked by the same suspension |

² Repair targets = **run-1 verification failures** (one repair call per failing node from run 1, frozen repair prompt identical across contestants; `run-axis1.mjs --repair`), not all 3 runs' failures — coverage disclosed.

---

## 4. D3 — Axis 2: design quality (OD12a)

**Method.** Every reachable contestant executed the SAME 20 frozen visualSpecs, 2 runs per node, identical L1+L2+L3 (the shipped system prompt verbatim). Renders go through the **real runtime mount path** — `/bakeoff-lab` executes each esbuild-CJS module against the app's own `three/webgpu` / `three/tsl` / `gsap` instances via `mountFromGraphSource` + `registerCodeRef`, under the frozen case's camera/light rig. Frames are captured blind (contestant names never reach the judge), fresh page per capture, WebGL2 fallback (W-2D capture discipline), fixed 2500ms settle. A deterministic dependency pre-gate (import scan vs the allowlist) records violations as automatic MUST-FIX before judging; unparseable/untransformable generations are unrenderable **scored artifacts** (their fallback/blank frames are judged as-is — the honesty gate; nothing retouched).

**Contestant coverage note.** Only 3 of the 6 Axis-1-reachable contestants could run Axis 2: the Fireworks suspension (anomaly 1) removed glm-5.2, deepseek-v4-flash, and kimi-k2.7-code before their visual lanes started. gpt-oss-120b ran on Groq with a 4096-token completion cap (anomaly 3). The Axis-2 table is therefore **claude-haiku-4.5 · claude-sonnet-5 · gpt-oss-120b**, and the §6.2 design-quality evidence for the three Fireworks-hosted models is declared MISSING, not guessed.

**Judge.** Fable 5 (vision), blind comparative per-case batches (all contestants' frames for one case ride one call), few-shot region-anchored rubric built from Design Law DL1–DL16 + two committed grammar-harvest exemplars as calibration anchors, 0–100 score + enumerated MUST-FIX defects (flat voids, all-black buttons, default-blue drift, dead lighting, broken spatial composition, blank renders). Deterministic merges on top: dep-gate violations and recorded `moduleRuntimeError`s.

**Pass 2 (authoritative).** Pass-1 scoring was invalidated for text by the WebGL2 text blackout (anomaly 5 — instrument blind spot, proven by probe). After the lab-side fix, **all frames were re-captured and fully re-judged**; the numbers below are pass 2. Pass-1 artifacts are archived (`frames-pass1-textblind/`, `judge/axis2-pass1-textblind/`) and remain part of the evidence trail.

### Axis 2 metrics (pass 2 — text-visible instrument; 0–100 vs the frozen visualSpec + DL rubric)

| Model | Renders scored | Mean ± sd | 3D subset (8 cases) | 2D subset (12 cases) | MUST-FIX rate | Mean MUST-FIX/render | Runtime-crash rate¹ | Unrenderable² | Top defects |
|---|---|---|---|---|---|---|---|---|---|
| **claude-sonnet-5** | 40/40 | **16.0 ± 12.4** | **17.9** | 14.8 | 100% | 5.4 | 65% (26/40) | 0 | MISSING_SPEC 39, FLAT_VOID 31, RUNTIME_ERROR 26, SCALE 25, OFF_PALETTE 20 |
| **claude-haiku-4.5** | 40/40 | 12.8 ± 12.6 | 12.8 | 12.8 | 100% | 5.1 | 80% (32/40) | 0 | MISSING_SPEC 39, FLAT_VOID 36, RUNTIME_ERROR 32, BLANK 24, SCALE 18 |
| **gpt-oss-120b** | 35/40³ | 6.8 ± 5.6 | 9.4 | 4.6 | 100% | 4.6 | 71% (25/35) | 9³ | MISSING_SPEC 32, FLAT_VOID 31, BLANK 28, RUNTIME_ERROR 25, SCALE 12 |

¹ Renders whose module THREW at `createNode` time in the real runtime (deterministic, from per-frame `moduleRuntimeError` probes; the frame then shows the runtime's fallback plane and is judged as-is).
² Generations whose output failed esbuild transform (syntactically invalid JS) — captured as fallback frames and judged (scores 1–4 with BLANK_RENDER), never dropped.
³ 5 gpt-oss generations (v-16-r2, v-18-r1, v-19-r1/r2, v-20-r2) are **transport-blocked, not scored**: Groq's on_demand tier hit its 200K tokens/day ceiling mid-lane (verbatim 429 committed; refills ~2K/hour — unreachable within the wave) and Fireworks remains suspended. Absent from the mean (a transport failure is not a model failure); disclosed as missing coverage. gpt-oss is fully absent from the v-19 batch and half-covered on v-16/v-18/v-20.

**Reading the table honestly:**
- **Nobody one-shots design.** The best mean is sonnet's 16.0/100 with a 100% MUST-FIX rate. Top single render: 58/100 (sonnet's glass prism, haiku's gradient CTA), i.e. "recognizable execution of the concept with real defects" — never ship-grade. Judged blind against demanding Fable-authored visualSpecs with concrete hex/camera/light/type targets, so low absolute numbers are expected — but the **runtime crash rates (65–80%)** are the headline: most visual one-shot modules don't survive `createNode` in the real runtime. Static Axis-1 verification (60–88% first-pass) cannot see this; only rendered execution can. **This is direct evidence that OD11's per-node vision micro-loop + repair is load-bearing, not an optimization.**
- **Crash taxonomy** (83 crashing frames clustered by message): ~47 (57%) are guesses at the undocumented ctx API surface — `ctx.textureLoader.load` (real: `loadTexture`), `ctx.glbLoader.load`, `ctx.fontAtlas.createTextMesh`/called-as-function, hallucinated `createTextMesh` import from `@/text`; ~8 gsap misuse; ~5 TSL/webgpu import confusion (`MeshStandardNodeMaterial` from `three/tsl`); rest config-shape guesses. See §6 cross-cutting recommendation.
- **sonnet-5 leads design** on mean, 3D subset, and owns the two strongest renders; its GARBLED_TEXT cluster (7 renders of literal `[object Object]`) is the object-first `createText` signature guess — visible and correctly penalized under the pass-2 instrument.
- **gpt-oss-120b collapses on the visual corpus** (6.8 mean, 9 unrenderable of 35): the 4096-token completion cap (Groq TPM tier) truncated 8/35 generations mid-module, directly feeding the unrenderable count — an acknowledged lane handicap on top of a real capability gap (its renderable frames still average far below the Claude lanes).
- **3D vs 2D:** sonnet and gpt-oss score *higher* on the genuinely-3D cases than 2D layout cases — the 2D cases demand text/layout precision (where the API-guessing failure modes dominate), while 3D cases give partial credit for materials/lighting life.

## 5. D4 — Axis 3: critic agreement (OD12b)

**Method.** Golden set = 30 renders spanning the quality range: 24 sampled evenly across the pass-2 D3 score distribution (contestant + case diversity caps) + the 6 seeded known-bad renders (deliberate DL violations, proven end-to-end through the runtime). Every golden frame is downscaled once to an identical 800px JPEG so ground truth and every critic judge the **same pixels** through their differing transports (CLI `Read` vs base64 data URLs) — disclosed. Ground truth = Fable 5, TWO independent passes, same rubric module as the D3 judge (one rubric everywhere); per-render final = mean of pass scores + union of MUST-FIX; **pass disagreement measured and disclosed, never smoothed**. Critics run the per-node micro-loop shape (one frame per call — production-realistic; clean per-critique cost + latency).

**Candidate pool at run time (anomaly 8):** Claude Sonnet 5 (claude CLI) ran; Gemini 3.5 Flash (DeepInfra 402) and Qwen3.7-Plus (Fireworks 412) were transport-blocked with committed reprobe records. The selection rule (cheapest candidate with Spearman ≥ 0.85 AND MUST-FIX detection ≥ 90%) is therefore evaluated over a **one-candidate pool** — whatever the outcome, the founder should read it as conditional until the two blocked candidates can be measured on funded routes.

### Ground truth (Fable 5, 2 passes on the 30-render golden set)

- **Score self-agreement: mean |Δ| = 1.5 points (0–100 scale), max |Δ| = 9** — tight; per-render final = mean of passes.
- **Defect-list self-disagreement: 17 of 30 renders** had at least one defect named in only one pass (union taken for ground truth; high-confidence positives for detection scoring = defects present in BOTH passes, or seeded). Disclosed, not smoothed.

### Critic candidates

| Candidate | Route | Judged | Spearman vs GT | MUST-FIX detection | Seeded-bad detection | Cost/critique | p50 latency |
|---|---|---|---|---|---|---|---|
| **claude-sonnet-5** | claude CLI (vision) | 30/30, 0 parse failures | **0.743** | **100%** (30/30) | **100%** (6/6) | $0.207¹ | 20.0s |
| gemini-3.5-flash | DeepInfra | **BLOCKED-402** (unfunded; reprobed 2026-07-10T06:03Z) | — | — | — | — | — |
| qwen3.7-plus | Fireworks (vision) | **BLOCKED-412** (account suspended; reprobed 2026-07-10T06:03Z) | — | — | — | — | — |

¹ Subscription-equivalent (CLI usage at published API rates).

### Selection (rule: cheapest with Spearman ≥ 0.85 AND MUST-FIX detection ≥ 90%)

> **UNFILLED.** No candidate qualifies. Sonnet 5 clears the detection bar decisively but its rank correlation (0.743) is below the 0.85 threshold — it reliably *flags that something is wrong* but does not order render quality the way the Fable ground truth does. Per the ratified rule, **escalation-tier critique stays on Fable/Opus and the cheap per-node critic slot is UNFILLED.**

**Honest caveats on this measurement:**
- The pool was degenerate (1 of 3 candidates reachable — anomaly 8). UNFILLED is the verdict *for this pool on this day*, not proof that no cheap critic exists; re-run Gemini 3.5 Flash and Qwen3.7-Plus when routes are funded.
- Every golden render carries ground-truth MUST-FIX defects (the corpus produced no defect-free renders — §4's 100% MUST-FIX rate propagates into the golden set). A critic that always flags something would trivially score 100% detection, so **detection could not discriminate; the discriminative load fell entirely on rank correlation**, which is exactly where sonnet fell short. A future golden set should include known-good renders (e.g. shipped W9A/W-TPL frames) to measure false-positive rate.
- Spearman over a bottom-heavy score distribution (most renders 3–15) is noisier than over a uniform one, even with the top-end renders sampled in (golden set spans 3–58).

## 6. §6.2 winner-per-tier proposal

> **This table is a PROPOSAL built from the evidence above. Nothing routes until Logan signs (§10).** Where the ratified candidate list for a tier was mostly unreachable, that is said plainly rather than papered over with the models that happened to be up.

| §6.2 tier | Proposed | Evidence basis | Honest caveat |
|---|---|---|---|
| **simple (60–80%)** | **gpt-oss-120b** (open control) primary · deepseek-v4-flash alternate | 75.3% simple-tier first-pass at **$0.0016/node** — 30× cheaper than the Claude lanes at a rate 19 points below haiku's; 100% raw parse (never fences); spread 0.05 (stable across runs). DeepSeek: 62.0% simple at $0.0010/node (corrected — §3 note ⁴) with the worst run spread (0.22). Artifacts: `runs/axis1/verify-metrics.json`, raw gens + verifier logs per model. | **4 of the 5 ratified simple-tier candidates were never measured** (Gemini 402-blocked; MAI/GPT-5-nano/Mercury unreachable). This slot's evidence is the weakest of the table; a funded re-probe wave should re-run this tier before the config lands. Dual-homing (D2) exists for gpt-oss (Fireworks+Groq, both proven live this wave) but Groq's on_demand tier caps at 200K tokens/day — real dual-homing needs the Fireworks account unblocked or a Dev-tier Groq key. |
| **moderate + integration** | **claude-haiku-4.5** | 80.0% moderate-tier first-pass (n=45), 94.4% simple, best full-coverage overall rate (88.0%); repair 5/5 at depth 1; integration-bearing cases ride the moderate tier (D3) and haiku leads the integration-bearing subset at **81.8% (27/33 across all 11 int-cases; 81.5% on the 9 moderate-int alone)** — see the §3 integration sub-table (sonnet 75.8%, gpt-oss 62.1%, deepseek 44.0%). | $0.049/node (subscription-equivalent basis — metered API pricing would be similar order). p50 wall 77s through the CLI harness is not transport-comparable with raw-API lanes. |
| **complex** | **claude-sonnet-5** | 80.0% complex-tier first-pass (best with full coverage), 82.2% moderate; its 60.0% overall is one narrow repair-able habit (hardcoded copy vs `config.textContent` — §3), fixed 19/19 at repair depth 1; **best Axis-2 design mean of all contestants** (§4) and the two top-scoring renders of the visual corpus. | Complex tier n=15 per the frozen stratification — a thin slice; sonnet's simple-tier text habit must be caught by the verifier + repair loop (it is). |
| **repair (attempts 1–2)** | **same model as original generation** (per spec) | Depth-1 repair fixed 100% of attempted failures for both Claude lanes (haiku 5/5, sonnet 19/19) with the frozen repair prompt. | Non-Claude repair passes were transport-blocked by the Fireworks suspension — same-model repair for those lanes is UNMEASURED, not confirmed. |
| **escalation (attempt 3)** | **Fable 5 / Opus 4.8** (config, per spec) | Not a bakeoff contestant tier; Fable 5 served as D3/D4 judge & ground truth this wave. | — |
| **design execution (OD9/OD11 context)** | **No contestant one-shots visual quality — keep 3D hero/design authorship on Fable/Opus/Sonnet-class + mandatory vision micro-loop** | Axis-2: best per-model design mean is 16.0/100 (sonnet) with a 100% MUST-FIX rate and 65–80% runtime crash rates on the visual corpus (§4). The OD11 per-node vision micro-loop is not an optimization — on this evidence it is load-bearing. | Axis-2 measured only 3 contestants (anomaly 1). |

**Cross-cutting recommendation (cheap, high-leverage):** ~57% of runtime crashes on the visual corpus trace to the shipped L1's undocumented ctx API surface (`ctx.fontAtlas.createText(content, opts)`, `ctx.textureLoader.loadTexture`, `ctx.glbLoader`'s real method names). One L1 block listing the callable surface would likely lift every tier's first-pass and crash rates before any routing decision matters. Evidence: crash-cluster histogram in §4, per-frame `moduleRuntimeError` in the committed metas.

## 7. Cost ledger totals

Every inference call this wave is ledgered per-call with provider, model, tokens, and cost (W-BG pattern); merged in `notes/bakeoff/ledger-merged.json` by `aggregate.mjs`. "Subscription-equivalent" = claude-CLI usage priced at published API rates (the CLI bills the founder's subscription, not metered dollars) — counted against the cap anyway, conservatively.

| Ledger | Calls | Metered USD | Subscription-equivalent USD | Covers |
|---|---|---|---|---|
| `ledger.json` | 767 | $4.49 | $20.64 | D1 design-director ($3.91) + Axis-1 contestant lanes + repair passes |
| `ledger-axis2.json` | 167 | $0.09 | $24.37 | Axis-2 contestant lanes (Claude CLI + Groq) |
| `ledger-judge.json` | 51 | $0.00 | $32.91 | D3 judge (pass 1 + pass 2) + D4 two-pass ground truth (incl. the 3 disclosed burned batches) |
| `ledger-critics.json` | 30 | $0.00 | $6.22 | D4 critic candidates (Sonnet 5; blocked candidates cost $0) |
| **Wave total** | **1,015** | **$4.58** | **$84.14** | **$88.72 of the $120 hard cap** (soft stop $100 never reached) |

The pass-2 re-judge (~$14) and the discarded pass-1 judging (~$11.7) are both real, both ledgered, and both part of the price of catching the text-blackout instrument bug mid-wave rather than shipping blind numbers.

## 8. Disclosed anomalies

Chronological; none softened (I-B4).

1. **Fireworks account SUSPENDED mid-wave (HTTP 412, monthly spend cap)** — killed the kimi-k2.7-code Axis-1 lane at 7/150 graded, blocked all Fireworks gap-fills and the non-Claude repair passes, removed Qwen3.7-Plus (vision) from the Axis-3 candidate pool, and forced gpt-oss-120b's Axis-2 lane onto Groq (same open weights, dual-homed; disclosed per-run). Founder notified during the wave (commit `6b5e735c`).
2. **claude CLI cwd contamination (fixed before scoring)** — spawning the CLI from the repo cwd injected ~28–30K tokens of project context into every Claude-lane contestant call (prompt purity + ~10× cost). ALL Claude lanes were redone from a clean-room cwd at effort=low (≈ API default, no extended thinking); the contaminated pilot is quarantined under `runs/pilot-dirty-envelope/` and was never scored.
3. **Groq TPD ceiling** — the on_demand tier's 200K tokens/day cap (verbatim 429 body committed: "Limit 200000, Used 198589") blocked the last 7 gpt-oss Axis-2 generations on 2026-07-09 night; a paced retry loop back-filled them when the window freed. Additionally the 8K-TPM tier forced `max_tokens: 4096` for the whole gpt-oss Axis-2 lane (Claude lanes ran at the CLI default) — **8 of 35 completed gpt-oss generations truncated at the 4096 ceiling**, an acknowledged comparability handicap for that lane. The last 5 generations never completed on any route (TPD exhausted + Fireworks suspended) and are disclosed as missing coverage in §4, not scored.
4. **Session cut mid-judging (2026-07-09 23:18)** — the founder-subscription model window closed while D3 batch-015 was in flight; the judge's error path auto-scored 2 gpt-oss v-15 blank-frame renders NO_RENDER=0 although frames existed. On resume the entries were removed (backup committed) and the case re-judged as a full comparative batch. Superseded by the pass-2 re-judge (anomaly 5) but disclosed as part of the pass-1 history.
5. **THE BIG ONE — WebGL2 text blackout in the capture instrument (found + fixed + re-measured 2026-07-10).** The product's `createText()` deliberately returns an **invisible placeholder Group** on WebGL2 canvases (`three-msdf-text-webgpu`'s NodeMaterial only compiles on WebGPU — `src/lib/prism/runtime/shared/text.ts`), and the capture rig must run the WebGL2 fallback (headless WebGPU screenshots are blank/dithered — W-2D). Net effect: **every contestant's text — including correct `ctx.fontAtlas.createText(content, opts)` calls — was structurally invisible to the design judge in pass 1.** Proven with a hand-authored harness probe through the real lab path (`notes/bakeoff/probes/text-probe/`): correct-signature calls rendered zero glyphs before the fix and crisp glyphs after (the committed after-frame; the "before" state is preserved wholesale in the archived pass-1 frames — compare `renders/frames-pass1-textblind/claude-sonnet-5/v-10-bento-metrics-r2.png`, textless, against `renders/frames/claude-sonnet-5/v-10-bento-metrics-r2.png`, six visible text nodes). Fix: the lab (dev-only route) injects a WebGL2-compatible TSL median-of-RGB MSDF factory via the existing `createFontAtlas({ msdfTextFactory })` seam — same BMFont atlas, same call contract, zero production-path changes (`src/app/bakeoff-lab/webgl2-msdf-text.ts`). All contestant frames were **re-captured and fully re-judged (pass 2)**; pass-1 frames and judge artifacts are archived untouched under `renders/frames-pass1-textblind/` and `judge/axis2-pass1-textblind/` (I-B3). Fidelity caveat: the lab factory's AA is a smoothstep band, so very small glyphs read slightly softer than the true WebGPU renderer; presence, content, scale, color, and placement are faithful. **Product finding that outlives the bakeoff:** any real user on a WebGL2-fallback device gets NO flat-MSDF text from this factory path today — same family as the W8 "extruded-text" workaround; belongs on the founder decision list.
6. **The shipped L1 prompt under-specifies the text API** — it says "render text content from config.textContent via ctx.fontAtlas" but never documents the callable surface (`createText(content: string, opts)`). Contestants guessed: object-first arg shapes, hallucinated `createTextMesh` imports from `@/text`, `ctx.fontAtlas(...)` called as a function. These are real failures under the shipped contract (the same prompt production uses), but a one-line signature in L1 would likely lift every model's text success — cheap prompt fix, big effect; recommended for the dispatch wave.
7. **Blocked/unreachable coverage (Axis 1 §3 table):** Gemini 3.5 Flash BLOCKED-402 (DeepInfra unfunded, reprobed live at critic time too), MAI-Code-1-Flash / GPT-5-nano / Mercury 2 UNREACHABLE on every available route (proof files committed). No OpenRouter key exists on this machine (`.constellation/` absent), so the ratified "else OpenRouter" fallback was unavailable — disclosed rather than substituted.
8. **Axis-3 candidate pool degenerate** — of the three ratified critic candidates, Gemini 3.5 Flash (DeepInfra 402) and Qwen3.7-Plus (Fireworks 412) were transport-blocked at run time; only Claude Sonnet 5 could be measured. The selection is therefore conditional (see §5) and the two blocked candidates carry honest BLOCKED records with reprobe timestamps.
9. **Golden-set sampler bug (caught + fixed before ground truth completed)** — the v1 sampler's per-contestant cap of 6 allows at most 18 capped picks across 3 contestants; the remaining 6 of 24 fell through a cap-less fallback returning the LOWEST unpicked scores, so the "even" sample was [3..14] and never touched the 16–58 top of the range — which would have compressed the Spearman rank-correlation into noise. Caught after 2 of 12 ground-truth batches had run; the run was stopped, the sampler fixed (cap = target/#contestants, outward-from-quantile search), the set rebuilt spanning [3..58] with 8/8/8 contestant balance, and ground truth restarted from scratch. The 2 aborted batches are archived (`judge/golden/aborted-gt-v1-sampler/`) and their ~$2 of judge spend stays honestly in the ledger. (One further GT batch was burned when the judge led its reply with a prose preamble and the script's bare `JSON.parse` crashed — parser hardened to balanced-object extraction, run restarted; all spend ledgered.)

## 9. Judge verdicts (verbatim)

Both fresh-context judges ran against HEAD `0999b6de` (the D4-close commit). Full verdicts verbatim in Appendix A (criteria-reviewer) and Appendix B (user-advocate as founder proxy).

- **criteria-reviewer: PASS with 1 MUST-FIX** — a stale deepseek-v4-flash cost in `verify-metrics.json`/§3 ($0.0038/node) contradicting its own corrected raw records ($0.0010/node; the `aac8835b` rate-recompute fixed raw records + ledgers but not the metrics rollup). **Addressed in this commit:** the rollup was regenerated through the shipped verifier test (grading byte-identical; only the deepseek cost re-derived), §3 and §6 corrected, correction disclosed as table note ⁴. Both NITS also addressed: the integration-bearing subset is now a first-class §3 sub-table covering all 11 int-cases for every graded contestant (the §6 haiku citation carries both 27/33=81.8% and the moderate-int-only 22/27=81.5%), and anomaly 5 now cites a committed before/after frame pair for the text-blackout proof.
- **user-advocate (founder proxy): GATE: PASS · FOUNDER PROXY: PLEASED · 0 MUST-FIX** — verified 6 frames with its own eyes against the report's claims (all matched, including sonnet's worst frame), re-derived every §6 winner's basis from the committed artifacts, and confirmed the report "makes the sign/send-back distinction FOR the founder and never papers a gap with the models that happened to be up." Its two non-blocking observations (integration subset deserved a first-class table; §9 was a placeholder at its read-point) are both resolved in this final revision.

## 10. Founder sign-off gate

This table is a **PROPOSAL**. Nothing routes until Logan signs. Per spec §11.5 and the ratification addendum, W-DISPATCH fires only after the founder signs the completed §6.2 evidence table; `PrismDispatchConfig`, cascade order, provider wiring, and runtime model selection are untouched by this wave (I-B1).

---

## Appendix A — criteria-reviewer verdict (verbatim)

> **VERDICT: PASS with 1 MUST-FIX** (a stale/contradicted cost number in the report that does not match its own committed raw artifacts). Everything else — every load-bearing measurement, the freeze, I-B1, the instrument fix, the Spearman, the key scan — reproduces independently and cleanly.
>
> **SCOPE:** All 8 wave mandates. HEAD `0999b6de`; working tree restored to clean after the sanctioned verifier re-run.
>
> **Mandate 1 — Independent recount of ≥3 models' metrics (haiku, sonnet, gpt-oss).** Recounted directly from raw `verify-logs/<model>/*.json` (pass = empty `violations`; repair-run logs excluded; transport errors cross-checked against `ok:false` in raw gens). **All three reproduce verify-metrics.json and report §3/§4 exactly:** claude-haiku-4.5 132/150 = **88.0%** (r1 .90 / r2 .84 / r3 .90); simple 85/90=94.4%, moderate 36/45=80.0%, complex 11/15=73.3%. claude-sonnet-5 90/150 = **60.0%** (.62/.56/.62); simple 41/90=45.6%, moderate 37/45=82.2%, complex 12/15=80.0%; TEXT_CONTENT 55. gpt-oss-120b 99/137 = **72.3%**; simple 64/85=75.3%, moderate 28/38=73.7%, complex 7/14=50.0%. Transport-error denominators cross-check clean: gpt-oss 13→137, glm 42→108, deepseek 35→115, kimi 143→7. Axis 2 (from `judge/axis2/scores.json`, 115 renders): **sonnet 16.0±12.4 (3D 17.9 / 2D 14.8), 65% crash (26/40)**; **haiku 12.8±12.6, 80% crash (32/40)**; **gpt-oss 6.8±5.6 (3D 9.4 / 2D 4.6), 71% crash (25/35)**. The 5 transport-blocked gpt-oss renders are exactly v-16-r2/v-18-r1/v-19-r1/v-19-r2/v-20-r2 as claimed.
>
> **Mandate 2 — Re-run the shipped verifier.** `WBAKE_VERIFY_AXIS1=1 npx vitest run tests/unit/wbake-verify-axis1.test.ts` → 1 passed. **All verify-logs regenerated byte-identically (0 changed); grading fully deterministic.** The ONLY diff was in `verify-metrics.json`, confined to deepseek-v4-flash's cost — see MUST-FIX.
>
> **Mandate 3 — Corpus freeze integrity — PASS.** `git diff 359d1eca..HEAD -- notes/bakeoff/corpus/` = 0 lines; working tree clean; corpus authored once at 359d1eca. Verified **52 functional + 21 visual file hashes** against the committed sha256 freeze manifests — 0 mismatches.
>
> **Mandate 4 — I-B1 — PASS.** Full `src/` footprint of the wave is 3 files, all dev-only lab (`src/app/bakeoff-lab/page.tsx`, `src/app/bakeoff-lab/webgl2-msdf-text.ts`, `src/app/api/bakeoff/bundle/route.ts`, dev-gated). Zero changes to `src/server/inference/**`, zero to `src/lib/prism/runtime/**`, no PrismDispatchConfig / cascade / runtime-model-selection changes.
>
> **Mandate 5 — Instrument-fix audit — PASS.** Probe artifacts present; pass-1 archives present (231 files across 3 contestants + 20 batches); commit `74e04296` touched exactly the two lab files.
>
> **Mandate 6 — Axis 3 Spearman spot-check — PASS.** Independently recomputed tie-corrected Spearman = **0.7425** — matches. MUST-FIX detection 30/30, seeded 6/6. Selection correctly **UNFILLED** (0.743 < 0.85). gemini/qwen carry blocked records with reprobe timestamps.
>
> **Mandate 7 — I-B6 key-material scan — PASS.** Zero hits for key-shaped values in committed artifacts; env-var names/paths only.
>
> **Mandate 8 — Traceability, 5 random numbers — 5/5 traced** (glm 76.9% = 83/108; haiku 22/27 int-subset; the two 58/100 renders; wave $88.72 to the penny; gpt-oss $0.001594/node). Extra: 115 scored renders all distinct, every one has a backing frame PNG on disk (0 phantom renders).
>
> **MUST-FIX:** deepseek-v4-flash cost stale in `verify-metrics.json`/§3 (`$0.0038430` vs `$0.0010179` from its own corrected raw records; `recompute-costs.mjs` fixed raw records + ledgers in `aac8835b` but not the rollup). Direction is conservative (true number makes deepseek cheaper) but I-B3 forbids untraceable numbers.
>
> **NITS:** (1) §6.2 "integration-bearing subset" 22/27 cites moderate-int only; all 11 `integrationBearing:true` cases give 27/33 = 81.8% — unify. (2) Text-probe "before" frame not committed as an image (pass-1 archives + after-frame sufficient, but committing a before-frame would close the loop).

*(Disposition: the MUST-FIX and both NITS are addressed in the final revision — §9.)*

## Appendix B — user-advocate / founder-proxy verdict (verbatim)

> **GATE: PASS**
>
> **FOUNDER PROXY: PLEASED**
>
> **MUST-FIX list:** (empty)
>
> I read `notes/SHELL-WBAKE-REPORT.md` top to bottom as Logan, then refused to trust a single number until I'd traced it to a committed artifact and looked at the frames myself. Every load-bearing claim held.
>
> **1. Does the evidence justify each per-tier winner in §6? Yes — and where it doesn't, the report says so louder than I would have.** moderate+integration → haiku: firstPass 0.88, simple 94.4%, moderate 80.0%, repair 5/5 — matches to the decimal; this row I would sign today. complex → sonnet: complex 80.0%, moderate 82.2%, the 60.0% overall is one cluster (55 MISSING_TEXT_CONTENT), repair 19/19; the report is honest that complex n=15 is "a thin slice" — I'd sign conditional on the verifier+repair loop catching sonnet's text habit, which the evidence shows it does. simple → gpt-oss: 75.3% at $0.0016/node, 100% raw parse — confirmed; **but the report's own caveat is the most prominent one in the table** ("4 of the 5 ratified simple-tier candidates were never measured … the weakest of the table") — not buried; honest. repair → same-model: Claude lanes 5/5 and 19/19; the report says non-Claude repair is "UNMEASURED, not confirmed" — true to the artifact.
>
> **2. Would I stake real user credits on this table? The report makes the distinction FOR me.** Sign today: moderate+integration (haiku), complex (sonnet), design-execution (keep on Fable/Opus + mandatory vision loop). Send back for a re-run: simple tier (4/5 candidates never measured) and the critic slot (1/3 reachable). The report explicitly labels both as conditional/weakest and tells me what unblocks them.
>
> **3. Frames vs report — all six matched.** sonnet v-03 glass-prism r1: genuine translucent 3D prism with pink internal refraction — one of the two 58/100 tops, recognizable concept, real defects. haiku v-11 gradient-cta r1: clean red→pink glossy button, textless — the other 58. text-probe after-fix: crisp legible "HARNESS TEXT PROBE" — proves the WebGL2 MSDF instrument fix, slightly soft AA exactly as disclosed. sonnet v-10 bento r2: gray bento grid with SIX literal "[object Object]" text nodes — exactly the GARBLED_TEXT disaster the report describes for its own recommended complex-tier winner. It did not hide sonnet's worst frame. seeded bad-3: genuine default-blue AI-slop card validating the critic's 100% seeded detection.
>
> **4. The hard founder questions — all answered without spin.** (a) 7–16/100 design scores: §4 names the 65–80% runtime crash rates as the headline and draws the product conclusion (OD11 vision micro-loop is load-bearing, not an optimization). (b) Critic UNFILLED: §5 tells me what to DO — escalation stays on Fable/Opus; re-run Gemini + Qwen on funded routes; and self-diagnoses why the measurement was weak. (c) Two providers down: §3/§8 name the exact founder actions (Fireworks billing unblock; DeepInfra/Cerebras console actions D-01/D-02; no OpenRouter key exists). (d) Completion accounting: kimi 143 transport errors leaving 7 graded — genuinely uncomparable; gpt-oss 35/40 with the 5 missing frames named individually. This is the honesty standard I exist to enforce.
>
> **5. Anti-rubber-stamp.** Two things, neither a blocker: the integration-bearing subset deserved a first-class row in the graded table, not a parenthetical; and §9 was a placeholder at my read-point. *(Both resolved in the final revision — §9.)*
>
> The report's defining quality is that it makes the sign/send-back distinction FOR the founder and never papers a gap with the models that happened to be up. That is exactly the honest evidence table OD12 asked for. I would sign the strong rows and send the simple-tier + critic slot back for a funded re-run — and the report already told me to do precisely that.

---

PRISM-WBAKE: RUN COMPLETE
