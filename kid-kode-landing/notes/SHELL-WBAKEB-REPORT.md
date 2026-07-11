# SHELL W-BAKE-B — Full-Roster Bakeoff Under the Playbook

**Wave:** PRISM-WBAKEB · **Authority:** `docs/prism/RATIFICATION-2026-07-09.md` · **Method inheritance:** SHELL-WBAKE-REPORT.md + SHELL-WPCP-REPORT.md (blinding, ledgers, capture discipline = the W-PCP standard) · **Dates:** 2026-07-10 → 2026-07-11
**Nature:** measurement wave. Every number traces to a committed artifact under `kid-kode-landing/notes/bakeoff-b/`. No production config/routing/cascade was touched (I-BB1). Everything runs under the PCP: **L1 v2.1 + frozen L2**, byte-identical across all contestants (I-BB2, hashes in `notes/bakeoff-b/ibb2-hashes.json`).

---

## 1. D0 — L1 v2.1 + live route inventory

### 1.1 L1 v2.1 (commit `daaedb77`)

The three measured W-PCP §9 refinements land **additively** on L1 v2 (V1 byte-frozen, sha `957bd0f7` unchanged; L2 template byte-frozen, sha `9c7c5d70` unchanged):

1. **White-subject key-light exposure ceiling** (key ≤ 1.2, rim ≤ 0.8, total direct ≤ 2.0; `BLOWN_WHITE_KEY` MUST-FIX) in `DESIGN_DOCTRINE_L1_BLOCK` — the user-advocate's exposure-ceiling observation from W-PCP §9.
2. **IMPORT DISCIPLINE block** on the dependency gate: the gsap NAMED-import rule + the ctx.THREE-is-NodeMaterial-free rule + the canonical resolvable-import header — the dominant residual crash class the W-PCP probe surfaced (gpt-oss 85% residual crashes were import discipline, not API knowledge).
3. The canonical loader-spelling + fontAtlas surface refinements carried in the regenerated runtime-surface block.

L1 v2 7,585B → **v2.1 9,039B** (+364 tok, well under the 12K cap). **Byte-stability re-proven: 100 calls → 1 hash** (sha256 L1 `7d1e28bd`, `notes/verification/wpcp/byte-stability.json`). Runtime surface `--check` OK (drift-free vs live compiler). The exact bytes every lane reads: `notes/bakeoff-b/l1-v2.1-system.txt` + `notes/bakeoff-b/l2-world-frozen.txt` (I-BB2 manifest: `notes/bakeoff-b/ibb2-hashes.json`). *Founder-awareness note (criteria-reviewer NIT): the v2.1 blocks live in the production prompt-content file `src/lib/prism/codegen/pcp-blocks.ts` — an additive-only edit (+21 lines, 0 deletions), byte-hash-frozen above; routing/cascade/verifier untouched (I-BB1 verified by the reviewer over the full wave diff).*

### 1.2 Live route inventory (D0.2, commit `409e339a`; probes in `notes/bakeoff-b/probes/`)

The credential surface expanded materially since W-BAKE (which had NO OpenRouter/OpenAI/Inception keys and 402-unfunded Cerebras/DeepInfra):

| Provider | /models | 1-tok funding probe | Verdict |
|---|---|---|---|
| Fireworks | 200 (7) | **200** | LIVE |
| Groq | 200 (17) | **200** | LIVE |
| Cerebras | 200 (3) | **200** | LIVE — was 402 at W-BAKE (now funded) |
| DeepInfra | 200 (169) | **200** | LIVE — was 402 at W-BAKE (now funded) |
| OpenRouter | 200 (346) | **200** | LIVE — **NEW** (absent at W-BAKE) |
| OpenAI direct | 200 (125) | **429 insufficient_quota** | catalog visible, UNFUNDED — cannot generate |
| Inception direct | 200 (1) | **200** (`mercury-2`) | LIVE for mercury-2; `mercury-coder` 403 access-denied |
| Anthropic (claude CLI) | — | ok ×4 | LIVE (haiku-4.5, sonnet-5, fable-5, opus-4.8) — vision judges only |

**GPT-5.6 catalog probe:** all three tiers (`gpt-5.6-sol/terra/luna`) are GA in the OpenAI catalog on this key, but the direct key is quota-blocked (429). All three are reachable via **OpenRouter** (`openai/gpt-5.6-{sol,terra,luna}`) — that route is used. No GPT-5.5-mini/GPT-5-nano fallback needed.

**UNREACHABLE (I-BB5, proof committed, never extrapolated):**
- `mai-code-1-flash` — absent from every keyed catalog (openrouter 346 / deepinfra 169 / fireworks / groq / cerebras / openai). No Azure/Foundry credentials.
- `mercury-coder` — Inception 403 `model_access_denied` ("only available to accounts created before February 24, 2026"); not hosted on OpenRouter or any other keyed catalog. **`mercury-2` substitutes as the D5 seam executor (disclosed).**

**Method improvement over W-BAKE:** ALL generation rides ONE uniform OpenAI-compatible HTTP harness (W-BAKE ran its Claude lanes through the CLI with a ~2K envelope confound). The founder claude CLI is used ONLY for the Fable/Opus vision judges (vision Read is CLI-only). Reasoning models are capped uniformly (OpenRouter `reasoning.max_tokens = 2048`, `max_tokens = 16384` — I-BB2-identical across contestants; see commit `74cfe712` for the measured truncation de-risk).

### 1.3 D1 roster (cheapest live route each; `scripts/bakeoff/contestants-b.mjs`)

| Model | Route | $/MTok in/out | Axes |
|---|---|---|---|
| claude-haiku-4.5 | deepinfra | 1.0 / 5.0 | functional + design |
| claude-sonnet-5 | openrouter | 2.0 / 10.0 | functional + design |
| gpt-oss-120b | fireworks | 0.15 / 0.6 | functional + design |
| deepseek-v4-flash | openrouter | 0.084 / 0.168 | functional + design |
| glm-5.2 | openrouter | 0.42 / 1.32 | functional + design |
| kimi-k2.7-code | openrouter | 0.72 / 3.49 | functional + design |
| gemini-3.5-flash | openrouter | 1.5 / 9.0 | functional + design |
| mercury-2 | inception | 0.25 / 0.75 | functional + design |
| gpt-5.6-luna | openrouter | 1.0 / 6.0 | functional + design |
| gpt-5.6-terra | openrouter | 2.5 / 15.0 | functional + design |
| gpt-5.6-sol | openrouter | 5.0 / 30.0 | functional + design |
| claude-fable-5 *(ceiling reference — design axis ONLY, I-BB4)* | openrouter | 10.0 / 50.0 | design |
| claude-opus-4.8 *(ceiling reference — design axis ONLY, I-BB4)* | openrouter | 5.0 / 25.0 | design |

---

## 2. D2 — Axis 1: functional first-pass (spec §11, unchanged protocol)

Same frozen 50-node functional corpus as W-BAKE (concat-hash unchanged since freeze `359d1eca`, I-BB2), identical PCP prompts (L1 v2.1 + frozen L2), **3 runs per node per model**, rule-based verify via the shipped `src/lib/prism/codegen/verifier.ts::verifyNodeModule`, **no repair in the primary pass**. Grader: `tests/unit/wbakeb-verify-axis1.test.ts` (env-gated); metrics artifact: `notes/bakeoff-b/runs/functional/verify-metrics.json`; per-row verdicts: `runs/functional/verify-logs/<model>/`. Transport-failed rows (mid-wave 402 boundaries, §8) are **excluded from rates and counted separately** — never scored, never extrapolated (I-BB5).

### 2.1 First-pass table (primary: first-pass verification rate)

| Model | First-pass | By-run r1/r2/r3 | Parse raw→destripped | Int-bearing | simple/moderate/complex | p50 wall | p95 wall | Cost/node | Transport gaps |
|---|---|---|---|---|---|---|---|---|---|
| gpt-5.6-luna | **100.0%** | 100% / 100% / 100% | 100.0%→100.0% | 100.0% (n=33) | 100.0% / 100.0% / 100.0% | 317ms | 751ms | $0.0200 | 0 |
| mercury-2 | **97.3%** | 98% / 98% / 96% | 100.0%→100.0% | 100.0% (n=33) | 95.6% / 100.0% / 100.0% | 3.4s | 5.5s | $0.0013 | 0 |
| claude-sonnet-5 | **96.7%** | 94% / 98% / 98% | 100.0%→100.0% | 87.9% (n=33) | 100.0% / 88.9% / 100.0% | 5.2s | 94.0s | $0.0822 | 0 |
| gpt-oss-120b | **93.3%** | 86% / 98% / 96% | 100.0%→100.0% | 93.9% (n=33) | 91.1% / 95.6% / 100.0% | 11.4s | 18.3s | $0.0017 | 0 |
| glm-5.2 | **90.7%** | 91% / 93% / 87% | 33.6%→93.6% | 97.0% (n=33) | 86.7% / 97.7% / 100.0% | 51.3s | 237.1s | $0.0140 | 10 |
| kimi-k2.7-code | **87.9%** | 89% / 91% / 84% | 91.7%→95.5% | 92.6% (n=27) | 85.6% / 92.9% / — | 1.1s | 263.2s | $0.0327 | 18 |
| deepseek-v4-flash | **84.0%** | 90% / 82% / 80% | 0.0%→97.3% | 87.9% (n=33) | 83.3% / 84.4% / 86.7% | 1.8s | 120.5s | $0.0008 | 0 |
| claude-haiku-4.5 | **81.3%** | 84% / 80% / 80% | 2.7%→100.0% | 93.9% (n=33) | 73.3% / 95.6% / 86.7% | 7.2s | 11.9s | $0.0093 | 0 |
| gemini-3.5-flash | **33.3%** | 34% / 30% / 36% | 68.0%→69.3% | 63.6% (n=33) | 17.8% / 60.0% / 46.7% | 1.5s | 1.8s | $0.0276 | 0 |
| gpt-5.6-terra | — (0/65 attempts reached the model) | — | — | — | — | — | — | — | 65 |
| gpt-5.6-sol | — (0/25 attempts reached the model) | — | — | — | — | — | — | — | 25 |

Coverage disclosures (I-BB5, all with committed 402 evidence — §8): **glm-5.2 140/150** verified-gradeable rows (10 transport-dead: 9 complex + 1 moderate), **kimi-k2.7-code 132/150** (18 transport-dead: **all 15 complex-tier rows** + 3 moderate). The dead rows cluster in the complex tier because complex nodes have the longest generations — they were the timeout/402 victims on the slow DeepInfra reroute. **Read the headline rates accordingly: kimi's 87.9% covers ZERO complex-tier rows; glm's 90.7% covers 6 of 15.** Their true full-corpus rates are unknowable this wave and are NOT extrapolated. **gpt-5.6-sol/terra: zero generations** — OpenRouter-only lanes; every attempt returned 402 (`probes/openrouter-refund-check.json`). Wall-time note: glm/kimi/deepseek/sonnet lanes are **mixed-route** (OpenRouter → DeepInfra mid-wave, §8) and their p95s embed the DeepInfra queue's 130–280s tail; per-call route + wall are in each row JSON.

Signal readings:
- **gpt-5.6-luna one-shots the corpus**: 150/150 first-pass, sub-second p50 (317ms), $0.02/node, 100% raw-compliant output (zero fences). No other model touches this profile.
- **mercury-2** (diffusion) is the value standout: 97.3% at $0.0013/node with tight tails (5.5s p95).
- **claude-sonnet-5** 96.7% but its cost/node ($0.0822) carries the pre-bound adaptive-thinking burn (§8) — 4–6× the observed post-bound rate.
- **gemini-3.5-flash collapses on this corpus (33.3%)**: 53× MISSING_CLEANUP + 46× PARSE_FAILURE, worst on the *simple* tier (17.8%) — it omits `userData.cleanup` on trivial nodes and emits non-extractable prose/fence wrappers that survive fence-stripping. This is a systematic-habit failure, not capability noise (by-run spread only 34/30/36%).
- Parse-vs-verify split: deepseek (0% raw → 97.3% destripped) and haiku (2.7% → 100%) are pure fence habits — cheap to normalize in harness; gemini's 68→69.3% is NOT a fence habit — its output is structurally non-extractable.

### 2.2 Single repair-allowed pass (separate; frozen repair prompt, exact verifier violations fed back)

`scripts/bakeoff/run-repair-b.mjs` — one repair attempt per run-1 failure, same L1 v2.1 + L2, previous output + enumerated violations appended. Repair rows graded by the same verifier (`run='repair'` in the metrics artifact).

| Model | Run-1 failures repaired | Fixed at depth 1 | Repair success |
|---|---|---|---|
| claude-haiku-4.5 | 8 | 8 | **100.0%** |
| claude-sonnet-5 | 3 | 3 | **100.0%** |
| mercury-2 | 1 | 1 | **100.0%** |
| deepseek-v4-flash | 5 | 3 | 60.0% |
| kimi-k2.7-code | 5 | 2 | 40.0% |
| gemini-3.5-flash | 33 | 9 | **27.3%** |
| gpt-oss-120b | 7 | 1 | 14.3% |

gpt-5.6-luna had **zero** run-1 failures (nothing to repair). **glm-5.2's repair pass is 402-blocked** (its only live route died before its lane completed — §8); kimi's repair covers the 5 run-1 failures that existed at the pre-drain verify snapshot. Readings: **haiku is perfectly feedback-steerable** (8/8 — consistent with the W-PCP finding that haiku's failures are habit, not capability), while **gemini's failures resist its own repair** (27.3% — the cleanup omission recurs even when the violation is quoted back verbatim), and gpt-oss fixes almost nothing at depth 1 (14.3%, consistent with W-PCP's import-discipline residual).

## 3. D3 — Axis 2: design quality under the playbook

Same frozen 20 visual specs (concat-hash unchanged since the W-BAKE freeze, I-BB2), **2 runs per node per model, ALL contestants + both ceiling references**. Real runtime mounts on the `/bakeoff-lab` route, W-2D capture discipline verbatim (fresh page per capture, WebGL2 fallback initScript, 2500ms settle, status line hidden), **pre-blinded anonymous 800px JPEGs in per-case hash-ordered batches** (I-BB3; mapping files under `judge/blind/*/mapping.json`, committed after judging completed). **Judge rotation, zero self-judging:** Fable 5 judged all 329 non-Fable renders; Opus 4.8 judged Fable's 40 (`judgeModel` recorded per row in `judge/scores.json`). Same DL rubric, few-shot region-anchored, 2 calibration exemplars per batch. Deterministic dependency pre-gate ran per output (allowlist `three/webgpu, three/tsl, gsap, @/primitives, @/text`): **7 violating renders (gpt-oss ×5, gemini ×2) — recorded as `DEP_GATE_VIOLATION` MUST-FIX, still judged** per D3 item 6. 369 of 369 reachable renders scored; unrenderable outputs were captured and scored as rendered artifacts (BLANK_RENDER ≤10), never dropped.

### 3.1 Design table (0–100, hard-graded: 85+ = founder-shippable)

| Model | n | Design mean ± sd | MUST-FIX rate | Crash rate | 3D subset (n/mean/crash) | 2D subset (n/mean/crash) | Gap vs Fable | Gap vs Opus |
|---|---|---|---|---|---|---|---|---|
| *claude-fable-5 (ceiling reference — NOT a tier contestant, I-BB4)* | 40 | **30.9 ± 18.6** | 97.5% | **0%** | 16 / 21.9 / 0% | 24 / 37.0 / 0% | — | — |
| *claude-opus-4.8 (ceiling reference — NOT a tier contestant, I-BB4)* | 40 | **23.6 ± 14.0** | 100% | **0%** | 16 / 25.3 / 0% | 24 / 22.5 / 0% | — | — |
| kimi-k2.7-code ⚠ n=17 | 17 | 21.6 ± 22.5 | 100% | 52.9% | 15 / 16.5 / 60% | **2** / 60.0 / 0% | −9.3 | −1.9 |
| deepseek-v4-flash | 39 | **19.8 ± 16.3** | 100% | 30.8% | 16 / 18.2 / 38% | 23 / 21.0 / 26% | −11.1 | −3.7 |
| claude-sonnet-5 | 40 | **18.6 ± 14.2** | 100% | **22.5%** | 16 / 21.8 / 13% | 24 / 16.5 / 29% | −12.4 | −5.0 |
| claude-haiku-4.5 | 40 | **18.3 ± 13.3** | 100% | **22.5%** | 16 / 21.3 / 6% | 24 / 16.2 / 33% | −12.7 | −5.3 |
| mercury-2 | 40 | 13.8 ± 9.5 | 100% | 42.5% | 16 / 16.9 / 44% | 24 / 11.7 / 42% | −17.2 | −9.8 |
| gemini-3.5-flash | 40 | 11.4 ± 12.9 | 100% | 75.0% | 16 / 16.9 / 63% | 24 / 7.8 / 83% | −19.5 | −12.2 |
| glm-5.2 | 33 | 11.2 ± 12.6 | 100% | 69.7% | 16 / 11.3 / 81% | 17 / 11.1 / 59% | −19.8 | −12.4 |
| gpt-oss-120b | 40 | 10.6 ± 6.6 | 100% | 42.5% | 16 / 10.8 / 69% | 24 / 10.5 / 25% | −20.3 | −13.0 |
| gpt-5.6-luna | 0 | — 402-blocked (design lane never reached the model; functional completed pre-drain) | — | — | — | — | — | — |

Coverage disclosures (I-BB5): **kimi n=17 of 40** (402-truncated) — its 21.6 mean is a small-n artifact: sd 22.5, and its 2D subset is **two renders** (one scored 74). Do not read kimi's rank as real. **glm n=33**, **deepseek n=39** (each missing rows are transport-dead, never scored). Metrics artifact: `notes/bakeoff-b/axis2-metrics.json`.

### 3.2 Readings

- **The ceiling-gap is real and it is mostly CRASH + composition, not taste.** Both ceiling references ran **zero crashes in 80 renders** while every contestant crashed 22–75% of the time. The best contestant full-coverage mean (deepseek 19.8) sits **11.1 points under Fable** and 3.7 under Opus.
- **Nobody one-shots ship-grade — including the ceiling.** 368 of 369 renders carry ≥1 MUST-FIX; the single 0-MUST-FIX render in the entire wave is Fable's `v-18-nav-dock` **r2** (scored 84, the wave's top frame; its r1 sibling scored 12 — same model, same spec, one run apart, which is itself a one-shot-variance datapoint). *(Run suffix corrected r1→r2 per the user-advocate's raw-scores check.)* The OD11 micro-loop stays load-bearing at every tier.
- **Defect profile (all renders):** MISSING_SPEC_ELEMENT ×297, FLAT_VOID ×225, BROKEN_COMPOSITION ×197, DEAD_LIGHTING ×165, OFF_PALETTE ×130 — spec-compliance and composition dominate; palette discipline (DL2) is mid-list, i.e. the PCP's numeric doctrine is holding the color line better than W-BAKE's freeform arm did.
- **Fable's edge is 2D-editorial** (37.0 on the 2D subset vs Opus 22.5), while **Opus leads the 3D subset** (25.3 vs 21.9) — the two references are not interchangeable; they anchor different halves of the corpus.
- **Sonnet + haiku are the reliability contestants** (22.5% crash, the contestant floor), consistent with their Axis-1 profile; deepseek buys 1.2 more design points than sonnet at +8pp crash.

## 4. D4 — Axis 3: critic agreement (real pool)

**Golden set:** 30 renders — 24 D3-judged renders sampled evenly across the score distribution (W-BAKE v2 outward-quantile sampler, case cap 3, contestant cap 3) **+ 6 seeded known-bad** reused from W-BAKE (deliberate Design-Law violations), all downscaled to the identical 800px JPEGs every D4 participant judges (`judge/golden/golden-set.json` + `frames/`). *Composition reading disclosed: the mission line "30 renders spanning quality from D3 + ≥6 seeded known-bad" is implemented as 24+6=30 with the seeded renders inside the 30 — the committed builder's interpretation; the ≥6 seeded floor is met.*

**Ground truth:** Fable 5, **two fully independent passes**, same rubric prompt as every critic (`rubric.mjs`). Per-render final = mean of pass scores, MUST-FIX positives = defect present in BOTH passes (or seeded). Self-disagreement disclosed, never smoothed: **mean |Δscore| between passes 2.5, max 14; 29/30 renders had ≥1 defect-label disagreement between passes** (scores are stable; defect *labels* churn — the rubric's defect taxonomy overlaps at the edges). Artifact: `judge/golden/ground-truth.json`. Ground truth ran into the founder-CLI **429 session limit** (~23:35 CDT, resets 01:00) at pass-1 batch 6 — resumed cleanly from cached batches at 01:11 (§8).

**Candidates** (ratified pool; same rubric + exemplars, one frame per call):

| Candidate | Route | n | Rank corr (Spearman) | MUST-FIX detection (n=29) | Seeded-bad detection (n=6) | $/critique | p50 latency |
|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | claude-cli | 30 | 0.827 | **100%** | **100%** | $0.218 | 25.0s |
| claude-haiku-4.5 | claude-cli | 30 | 0.809 | **96.6%** | **100%** | $0.041 | 28.7s |
| gemini-3.5-flash | — | 0 | UNREACHABLE (both keyed vision routes 402; re-probed at critic launch, `probes/d4-critic-reachability.json`) | — | — | — | — |
| qwen3.7-plus | — | 0 | UNREACHABLE (OpenRouter-only lane, 402 boundary #1; re-probed at critic launch) | — | — | — | — |

**Selection rule (unchanged): cheapest with rank correlation ≥0.85 AND MUST-FIX detection ≥90% → no candidate qualifies → Axis 3 is declared UNFILLED.** Both reachable candidates clear the MUST-FIX bar decisively and both catch all 6 seeded known-bads, but both miss the rank-correlation bar (0.827 / 0.809 vs 0.85). Escalation-tier critique stays on Fable/Opus. Artifact: `notes/bakeoff-b/axis3-metrics.json`.

Readings:
- **The near-miss is real but it is a near-MISS.** Sonnet at 0.827 is 0.023 under the bar; the bar exists because a critic that misranks mid-band renders sends the micro-loop's repair budget to the wrong nodes. Neither candidate is certified this wave; neither is extrapolated past its number.
- **Haiku is 5.3× cheaper than sonnet at critique** ($0.041 vs $0.218) with near-identical correlation (0.809 vs 0.827) — if a future wave re-runs Axis 3 with the two 402-blocked candidates live, haiku's cost profile makes it the one to beat at the bar.
- **The pool was half-unreachable (I-BB5):** gemini-3.5-flash and qwen3.7-plus never generated a verdict; the UNFILLED verdict is therefore *provisional across the full ratified pool* — it certifies "no reachable candidate qualifies", and the two blocked candidates carry committed 402 evidence, never inferred scores.

## 5. D5 — Mercury seam test (delta-executor audition)

**Setup:** 20 real region-anchored critic deltas harvested from failing D3 renders (score <60, renderable, judge-emitted rubric defects only, sha-ordered, contestant cap 4 — `seam/plan.json`). Each executor received the failing module's source + ONE anchored defect (defect / region / critic note) with the instruction "apply the SMALLEST change that fixes this defect in that region while preserving everything else." Re-rendered under the identical capture discipline; **fix-success judged blind** (anonymous hash-ordered before/after pairs, Fable 5, region-scoped verdict; `seam/blind/mapping.json` committed after judging). **mercury-2 substitutes for the 403-gated mercury-coder** (§1, disclosed). This is a **seam audition, not a routing decision.**

| Executor | Route | Deltas | Module survives edit | Fix-success (mount-gated) | Wall p50 | Cost/delta-attempt |
|---|---|---|---|---|---|---|
| mercury-2 | inception (metered HTTP) | 20 | 15/20 (5 broke parse/transform) | **1/20 (5%)** | 4.2s | $0.0031 |
| claude-haiku-4.5 | founder CLI (sub-equivalent) | 20 | **20/20** | **2/20 (10%)** | 74.3s | $0.0422 |

Wall/cost columns are **not route-comparable** (§8: haiku's metered route died at 402 boundary #2; it rides the founder CLI while mercury rides metered HTTP).

**Integrity note (disclosed, deterministic):** the blind judge initially returned 2 fixed verdicts per executor. One of mercury's (s-20, OFF_PALETTE) was a **false positive: its edited module failed to default-export and never mounted** — the "on-palette dark field" the judge approved was the empty lab background. A deterministic **mount gate** (capture probe `nodeMounted`) now voids fixed-verdicts on unmounted modules (`seam-metrics.json: fixVoidedByMountGate`); no unfixed verdict was touched.

Readings:
- **The seam hypothesis fails its audition at both price points.** 5–10% fix-success means region-anchored critic deltas are NOT reliably executable as surgical edits by either a fast diffusion coder or a cheap autoregressive coder — the W-BAKE hypothesis that a cheap "delta executor" could discharge critic MUST-FIXes does not survive contact with real deltas from real failing renders.
- **The two failure modes are opposite and instructive.** Mercury edits fast (4.2s p50) but **broke the module outright in 5/20 edits** (25% parse/transform kill rate — a "smallest change" that doesn't survive esbuild is worse than no change). Haiku **never broke the module** (20/20 mount) but its edits under-shoot: the anchored defect persists nearly-identically in the re-render (verdict notes repeatedly read "AFTER is nearly identical to BEFORE in the anchored region").
- **What fixes DID land** (3 total): two were whole-frame BLANK_RENDER rescues by haiku (s-01 prism scene, s-19 empty-state panel — i.e., effectively re-generations, not surgical edits) and one mercury FLAT_VOID fill (s-13, lit graded floor). The pattern: when the "delta" is really "rebuild the scene", executors can act; when it demands a targeted regional correction inside working code, neither lands it.
- **Implication for the micro-loop:** the OD11 repair path should keep feeding critic deltas back to the ORIGINATING generator with full verifier context (§2.2 shows haiku 8/8, sonnet 3/3 repair success on *functional* violations) rather than to a third-party seam executor on *visual* deltas. Visual-delta execution remains an open seam.

## 6. PROPOSED §6.2 routing table

> **This table is a PROPOSAL built from the evidence above. Nothing routes until Logan signs (§10).** Where a tier's evidence is partial (402 boundaries, unreachable lanes), that is stated in the caveat column rather than papered over. No production config was touched this wave (I-BB1).

| §6.2 tier | Proposed | Evidence basis (artifacts) | Honest caveat |
|---|---|---|---|
| **simple** | **mercury-2** primary · **gpt-oss-120b** alternate (open-weights control) | mercury: 95.6% simple-tier first-pass at **$0.0013/node**, 3.4s p50 / 5.5s p95, 100% raw parse, 0 transport gaps — near-luna reliability at 1/15th luna's cost (`runs/functional/verify-metrics.json`). gpt-oss: 91.1% simple at $0.0017, dual-homed (Fireworks + Groq both live-probed this wave, `probes/route-inventory.json`). | mercury-2 is **single-provider** (Inception only; not on any aggregator we key) — no dual-homing exists today, and Inception's account-age gate on mercury-coder (§1) is live evidence of platform-access risk. gpt-oss's repair is weak (1/7 depth-1, §2.2) — its failures escalate rather than self-repair. |
| **moderate + integration** | **gpt-5.6-luna** primary · **mercury-2** alternate | luna: **100% moderate AND 100% integration-bearing (n=33)** at 317ms p50, $0.0200/node, 150/150 first-pass overall — the only model that one-shots the corpus (`verify-metrics.json`, `verify-logs/gpt-5.6-luna/`). mercury: 100% moderate, 100% int-bearing, $0.0013. | luna is reachable **only via OpenRouter on current keys** (direct OpenAI key quota-blocked, §1) — the SAME aggregator whose credits drained mid-wave and killed luna's design lane (§8.1). Routing production simple/moderate volume through an aggregator that 402'd mid-wave requires a funded direct key or a top-up discipline first. |
| **complex** | **gpt-5.6-luna** primary · **claude-sonnet-5** alternate | luna: 100% complex (45/45 rows). sonnet: 100% complex, and its failures elsewhere are 100% feedback-steerable (3/3 depth-1 repair, §2.2). | glm-5.2 also ran 100% on complex — but on **6 of 15 nodes** (402-truncated, I-BB5) and is not proposed on partial coverage. kimi has ZERO complex coverage (§2). sonnet's cost/node this wave ($0.0822) embeds the pre-bound thinking burn (§8.3); budget from its post-bound rate. |
| **repair (attempts 1–2)** | **same model as original generation** — NOT a third-party seam executor | haiku 8/8, sonnet 3/3, mercury 1/1 at depth 1 with the frozen repair prompt (§2.2, `runs/functional/verify-logs/*/repair`). D5 killed the alternative: region-anchored deltas handed to a cheap third-party executor land 5–10% (§5, `seam-metrics.json`). | Same-model repair is UNMEASURED for glm (402-blocked pass). gemini's self-repair is 27.3% — see the exclusion row. |
| **escalation (attempt 3)** | **Fable 5 / Opus 4.8** (per spec) | Not a contestant tier (I-BB4). Both ceiling references ran 0 crashes in 80 design renders (§3.1) — the reliability profile escalation exists to buy. | — |
| **design execution (OD9/OD11)** | **No contestant one-shots visual quality — keep design authorship on Fable/Opus-class + the mandatory OD11 vision micro-loop.** Where a reference split matters: Fable leads 2D-editorial (37.0 vs Opus 22.5), Opus leads the 3D subset (25.3 vs 21.9). | Best contestant full-coverage design mean is 19.8/100 (deepseek) vs Fable's 30.9 ceiling; 368/369 renders carry ≥1 MUST-FIX; contestant crash floor 22.5% vs ceiling 0% (§3, `axis2-metrics.json`). | The ceiling itself doesn't one-shot ship-grade (Fable mean 30.9, one 0-MUST-FIX render in the whole wave) — the micro-loop is load-bearing at every tier. gpt-5.6-luna's design lane is **unmeasured** (402-blocked): its 100% functional profile earns it a design-lane re-run next funded wave, not a design seat now. |
| **critic (escalation-tier critique)** | **UNFILLED** — critique stays on Fable/Opus | D4 selection rule over the real pool: sonnet 0.827 / haiku 0.809 rank-corr, both under the 0.85 bar despite 100%/96.6% MUST-FIX detection (`axis3-metrics.json`). | Pool was half-unreachable (gemini, qwen — 402 evidence committed). UNFILLED certifies "no *reachable* candidate qualifies." |
| **EXCLUDE from all codegen tiers** | **gemini-3.5-flash** | 33.3% functional first-pass with a *systematic* habit failure (53× MISSING_CLEANUP, 46× PARSE_FAILURE, worst on the simple tier), repair-resistant at 27.3% even with violations quoted back (§2). Design: 11.4 mean at 75% crash (§3). | Its lane was transport-clean (0 gaps) — this is the model, not the route. |

**Cross-cutting observations for the signature call:**
1. **The wave's biggest single finding is gpt-5.6-luna**: 150/150 first-pass, 317ms p50, $0.02/node, zero fences, zero transport gaps — no other lane has ever posted this profile on the frozen corpus. Its two blockers are *operational*, not capability: no funded direct route, and zero design-axis evidence.
2. **The W-BAKE→W-BAKEB delta validates the PCP**: under L1 v2.1 + frozen L2, first-pass rates moved from W-BAKE's 60–88% band to 81–100% for every non-gemini lane, and the W-BAKE ctx-API crash cluster (~57% of crashes) is gone from the defect histogram (§3.2).
3. **Don't route ANY tier on kimi/glm numbers this wave** — their coverage holes sit exactly on the hardest rows (I-BB5, §2).

## 7. Cost ledger

Every inference call this wave is ledgered per-call with provider, model, route, tokens, and cost. Two currencies are tracked and **never blended**: **metered USD** (real provider dollars — the currency the $120 hard cap protects and the two 402 boundaries exhausted) and **subscription-equivalent USD** (founder claude-CLI usage priced at published API rates; bills the founder's subscription, not metered credits).

| Ledger group | Calls | Metered USD | Sub-equivalent USD | Covers |
|---|---|---|---|---|
| `ledgers/ledger-functional-*` | 1,321 | $27.74 | — | Axis-1 lanes (9 reached models × 150 + retries/probes) |
| `ledgers/ledger-design-*` | 369 | $33.19 | $0.33 | Axis-2 lanes (8 contestants + 2 ceiling refs; $0.33 = 1 fable CLI row, §8.5) |
| `ledgers/ledger-repair-*` | 62 | $1.04 | — | Axis-1 single repair pass (7 lanes) |
| `ledgers/ledger-seam-*` | 40 | $0.06 | $0.84 | D5 executors (mercury metered; haiku CLI, §8.8) |
| `judge/ledger-judge.json` | 83 | — | $43.88 | D3 design judge (Fable 329 renders + Opus 40, blind batches) |
| `judge/ledger-golden.json` | 12 | — | $7.70 | D4 ground truth (Fable two-pass × 6 batches) |
| `judge/ledger-critics.json` | 60 | — | $7.76 | D4 critic candidates (sonnet 30 + haiku 30; blocked candidates $0) |
| `seam/ledger-seam-judge.json` | 40 | — | $12.79 | D5 blind before/after region judge (Fable) |
| **Wave total** | **1,987** | **$62.03 of the $120 hard cap** | **$73.32 (disclosed, uncapped)** | merged $135.35 |

**Cap semantics (decided mid-wave, disclosed §8.11):** the $120 hard cap with $0.50 stop margin is enforced on **metered** spend — per-lane caps, funding probes, and both 402 boundaries all operate in that currency. Founder-CLI judging/critique is subscription-equivalent: fully ledgered above, reported, and excluded from the metered cap. (W-BAKE counted sub-equivalent against the cap "conservatively" and landed at $88.72 merged where it never bound; this wave's 2.4×-larger judging volume made the conservative blend bind falsely while $58 of real headroom remained.)

## 8. Disclosed anomalies

1. **OpenRouter 402 mid-wave (~21:55 CDT), first funding boundary.** The D0 funding probe at 20:48 was a true 200; the account drained DURING the wave (credits endpoint: `total_credits 74 < total_usage 75.26`; `probes/openrouter-refund-check.json`, re-probed 22:16 — still 402). Seven models rerouted to DeepInfra with fresh funding probes all 200 (`probes/deepinfra-reroute-funding.json`); affected lanes are **mixed-route** with the per-call route in every ledger row. gpt-5.6-sol/terra (functional+design), gpt-5.6-luna (design only) and qwen3.7-plus (D4 critic) had **no alternate keyed route** — blocked at the boundary (I-BB5), never extrapolated.
2. **DeepInfra 402 (~23:05 CDT), SECOND funding boundary** (`probes/deepinfra-402-check.json`). Killed the reroute lane mid-tail: glm-5.2 (10 functional + 7 design rows), kimi-k2.7-code (18 functional + 23 design rows), glm's repair pass, and the gemini-3.5-flash D4 vision critic. **The dead functional rows cluster in the complex tier** (kimi: all 15; glm: 9 of 15) because complex nodes have the longest generations — coverage bias is disclosed inline in §2.
3. **Uncapped adaptive thinking on the DeepInfra Anthropic passthrough** burned ~7K thinking-tokens/call on sonnet-5 before the effort bound landed (commit `59706058`); sonnet's functional cost/node ($0.0822) embeds that burn — its post-bound design-lane rate ran ~4–6× cheaper. Reasoning was then bounded uniformly on the reroute (anthropic/* → `thinking.adaptive` + `effort: low`; others → `reasoning_effort: low`), mirroring the OpenRouter `reasoning.max_tokens = 2048` cap (I-BB2: prompt bytes unchanged).
4. **Transport timeout retuned mid-wave (transport-only, disclosed):** GLM/Kimi on DeepInfra run 130–280s/call; the fixed 300s clip made their slow tails permanent transport failures, so the remaining rows were mopped up at a 600s clip (`WBAKEB_GEN_TIMEOUT_MS`, commit `21429810`). Prompt bytes untouched; wall-time distributions embed the mixed timeouts and are disclosed in §2.
5. **One fable ceiling row rode the founder CLI lane** (v-15-testimonial-panel-r1, the single row left when DeepInfra died): same L1 v2.1 + L2 bytes, ~2K CLI envelope, subscription-equivalent billing, route recorded in the row JSON. The other 39/40 fable rows are metered DeepInfra.
6. **Lane caps resized twice under the unchanged $120 global cap:** sonnet 14→19 (its functional pre-bound burn left <$2 design headroom → lane stopped at 16/40 before resume) and fable 16→20 (stopped 39/40). Both resizes are commented in `contestants-b.mjs` with spend-at-resize.
7. **mercury-coder is 403 access-denied** on Inception (account-age gate) and hosted nowhere else keyed — **mercury-2 substitutes as the D5 seam executor** (§1, §5). **mai-code-1-flash** is absent from every keyed catalog — UNREACHABLE with evidence.
8. **D5 executor transport asymmetry:** haiku-4.5's metered route died at boundary #2, so its seam-executor calls ride the founder CLI (subscription-equivalent, ~2K envelope) while mercury-2 rides metered HTTP — **wall/cost columns in §5 are not route-comparable** and are labeled as such.
9. **claude-mem side-effect:** the memory plugin drops auto-generated `CLAUDE.md` files into directories the session touches; one landed inside `runs/design/` mid-wave and crashed the bundle scanner (fixed by filtering non-directories, commit `21429810`). No run data was affected.
10. **gemini-3.5-flash's Axis-1 collapse is a finding, not an anomaly** (33.3% first-pass, repair-resistant at 27.3%) — recorded in §2; its generations were transport-clean (0 gaps).
11. **THIRD boundary: founder-CLI 429 session limit (~23:35 CDT, "resets 1am").** D4 ground-truth pass-1 hit the claude-CLI session limit at batch 6 (verbatim 429 in `logs/golden-truth.log`); the chain waited out the reset and resumed at 01:11 CDT from cached batches — zero re-judging, zero loss. Every remaining phase (ground truth pass 2, both critics, seam judge) ran post-reset in one clean window.
12. **Cap-semantics correction (stop-condition only, mid-wave, commit-referenced):** the newest harness phases (golden judge, critics, seam judge) initially enforced the $120 cap on the *merged* metered + subscription-equivalent total. At resume, merged stood at $112.10 while metered was $62.50 — the blend was about to falsely kill D4/D5 with ~$58 of real headroom left. The guards were changed to enforce the cap on **metered spend** (the currency the cap protects; consistent with the per-lane caps and every milestone commit's "global metered $X of $120" tracking). Prompt bytes, protocol, and ledgering untouched; both currencies remain fully ledgered (§7). The seam-executor ledger's totals were re-attributed by per-call `billing` (haiku CLI calls had been lumped into `meteredUsd`; calls array unchanged).
13. **D5 blind-judge false positive caught by a deterministic mount gate (§5):** mercury-2's s-20 "fix" never mounted (`module did not default-export a function`; capture probe `nodeMounted: false`) — the judge approved the empty lab background as an on-palette field. The metrics phase now voids fixed-verdicts on unmounted modules (`fixVoidedByMountGate`), analogous to the D3 rule that unrenderables are scored as rendered artifacts. Raw judge verdicts are preserved unmodified in `seam/judge-verdicts.json`.
14. **D4 golden-set composition reading (disclosed in §4):** the committed builder implements "30 renders + ≥6 seeded known-bad" as 24 D3-sampled + 6 seeded = 30 total (seeded inside the 30). The ≥6 seeded floor is met; extending to 36 mid-run would have shifted the cached batch boundaries and invalidated the completed pass-1 judging, so the committed interpretation stands.

## 9. Judge verdicts (verbatim)

Both judges ran fresh-context on 2026-07-11 against the committed artifacts (milestone-4 state, commit `04fe1d45`). Full transcripts summarized; verdict lines and MUST-FIX lists verbatim.

### 9.1 criteria-reviewer

Independently recounted **6 models on Axis 1** from raw `verify-logs/` rows and **7 models on Axis 2** from raw `judge/scores.json` — every figure reproduces §2.1/§3.1 to the digit ("Zero divergences"). Re-ran the shipped verifier on a 13-generation sample (10 headline + 3 violation-bearing): **13/13 reproduce the logged verdicts**. I-BB2: live-recomputed sha256 of L1 v2.1 (`7d1e28bd…`), frozen L2 (`9c7c5d70…`), and both corpus concat-hashes — all match `ibb2-hashes.json`. I-BB3: leak-scanned all 41 judge-visible batch inputs — **0 contestant-name leaks**; blind mappings in separate files, committed after judging. I-BB1: diffed the full wave range (`7ea64a32..HEAD`) — `src/server/inference/**`, `verifier.ts`, `prompts.ts` all **UNTOUCHED**; the only production-codegen edit is the disclosed additive L1 v2.1 block in `pcp-blocks.ts` (+21/-0). Route probes verified from committed artifacts (declined a live paid re-probe as temporally inconsistent with the wave snapshot — reasoning stated). D4 Spearman independently recomputed (sonnet **0.8270**, haiku **0.8090**); D5 mount-gate proof confirmed (`s-20-r1.meta.json` → `nodeMounted: false`). Cost ledger re-summed: **1,987 calls, metered $62.03 / sub-equiv $73.32** — matches §7; metered under cap confirmed.

One NIT (not blocking, addressed in §1.1): make the `pcp-blocks.ts` production-file edit explicit for the founder.

> ## MUST-FIX
> (none)
>
> **CRITERIA-REVIEWER: PASS (0 MUST-FIX)**

### 9.2 user-advocate (founder proxy)

Read the report + raw metrics artifacts and **eye-checked 8 real frames** against their scores (Fable nav-dock r2=84 "genuinely clean"; its r1=12 "IS a void"; gemini nav-dock black void; glm formless grey blob at 4; Opus orrery 66 legible-but-flat; deepseek footer 72 readable-but-overflowing; the D5 s-01 before/after pair; mercury s-20's empty ink frame behind the voided false positive). Per-tier stakes: simple **CONDITIONAL-YES** (mercury-2 numbers hold; sign only with the gpt-oss fallback retained, as proposed), moderate+integration/complex **CONDITIONAL-YES** (luna 150/150 real and complete; "I would not route production volume through [OpenRouter] until a funded direct key or top-up discipline exists — the report says exactly this"), repair same-model **YES**, design ceiling+micro-loop **YES**, critic UNFILLED **YES** ("correct per the rule… handled honestly"). Ceiling-gap: "honestly stated — the frames match the numbers… I counted exactly **1** zero-MUST-FIX render in `scores.json`." Anomalies: "honest conduct — I would not feel deceived… the deterministic mount gate catching this is exactly the integrity mechanism I exist to demand." One FLAG (corrected in §3.2): top-frame citation said r1, raw scores say r2.

> ### MUST-FIX list
> (empty)
>
> **PLEASED.** The proposal is evidence-backed at every tier, the ceiling-gap and coverage holes are stated more conservatively than the raw data would allow, the anomalies are disclosed with committed proof, and the one defect I found is a cosmetic citation slip (r1↔r2) that leaves every number and conclusion intact. This is the honest measurement wave the §6.2 signature call needs.
>
> **Would you sign the §6.2 proposal as scoped (with its caveats): YES**

## 10. Founder sign-off gate

This table is a PROPOSAL. Nothing routes until Logan signs.

The signature call, stated once more in one line each:
- **Sign-ready as scoped:** simple → mercury-2 (+gpt-oss fallback), repair → same-model, design → ceiling + OD11 micro-loop, critic → UNFILLED.
- **Sign conditional on one operational fix:** luna's moderate/integration/complex seats need a funded non-aggregator route (or top-up discipline) before production volume rides them — and luna owes a design-lane run next funded wave.
- **Do not route anything on kimi/glm numbers this wave** (coverage holes sit on the hardest rows).

PRISM-WBAKEB: RUN COMPLETE
