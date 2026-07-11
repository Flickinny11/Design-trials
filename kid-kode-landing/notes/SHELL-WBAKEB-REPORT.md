# SHELL W-BAKE-B — Full-Roster Bakeoff Under the Playbook

**Wave:** PRISM-WBAKEB · **Authority:** `docs/prism/RATIFICATION-2026-07-09.md` · **Method inheritance:** SHELL-WBAKE-REPORT.md + SHELL-WPCP-REPORT.md (blinding, ledgers, capture discipline = the W-PCP standard) · **Dates:** 2026-07-10 → (in progress)
**Nature:** measurement wave. Every number traces to a committed artifact under `kid-kode-landing/notes/bakeoff-b/`. No production config/routing/cascade was touched (I-BB1). Everything runs under the PCP: **L1 v2.1 + frozen L2**, byte-identical across all contestants (I-BB2, hashes in `notes/bakeoff-b/ibb2-hashes.json`).

---

## 1. D0 — L1 v2.1 + live route inventory

### 1.1 L1 v2.1 (commit `daaedb77`)

The three measured W-PCP §9 refinements land **additively** on L1 v2 (V1 byte-frozen, sha `957bd0f7` unchanged; L2 template byte-frozen, sha `9c7c5d70` unchanged):

1. **White-subject key-light exposure ceiling** (key ≤ 1.2, rim ≤ 0.8, total direct ≤ 2.0; `BLOWN_WHITE_KEY` MUST-FIX) in `DESIGN_DOCTRINE_L1_BLOCK` — the user-advocate's exposure-ceiling observation from W-PCP §9.
2. **IMPORT DISCIPLINE block** on the dependency gate: the gsap NAMED-import rule + the ctx.THREE-is-NodeMaterial-free rule + the canonical resolvable-import header — the dominant residual crash class the W-PCP probe surfaced (gpt-oss 85% residual crashes were import discipline, not API knowledge).
3. The canonical loader-spelling + fontAtlas surface refinements carried in the regenerated runtime-surface block.

L1 v2 7,585B → **v2.1 9,039B** (+364 tok, well under the 12K cap). **Byte-stability re-proven: 100 calls → 1 hash** (sha256 L1 `7d1e28bd`, `notes/verification/wpcp/byte-stability.json`). Runtime surface `--check` OK (drift-free vs live compiler). The exact bytes every lane reads: `notes/bakeoff-b/l1-v2.1-system.txt` + `notes/bakeoff-b/l2-world-frozen.txt` (I-BB2 manifest: `notes/bakeoff-b/ibb2-hashes.json`).

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

*(FILLING — 20 frozen visual specs × 2 runs per model incl. both ceiling references; real runtime mounts, W-2D capture discipline, pre-blinded hash-ordered frames; judge ROTATION: Fable 5 judges all non-Fable renders, Opus 4.8 judges Fable renders — zero self-judging; deterministic dep pre-gate.)*

## 4. D4 — Axis 3: critic agreement (real pool)

*(PENDING D3 — golden set 30 renders + 6 seeded known-bad; ground truth Fable 5 two-pass w/ disclosed self-disagreement; candidates sonnet-5, gemini-3.5-flash, qwen3.7-plus, haiku-4.5; selection rule: cheapest with rank corr ≥0.85 AND MUST-FIX detection ≥90%, else UNFILLED.)*

## 5. D5 — Mercury seam test (delta-executor audition)

*(PENDING D3 — 20 real region-anchored critic deltas; mercury-2 + haiku-4.5 apply all 20; fix-success via blind before/after Fable region re-judge; wall p50 + cost per fix. Audition, not a routing decision.)*

## 6. PROPOSED §6.2 routing table

*(PENDING all axes.)*

## 7. Cost ledger

*(FILLING — per-call ledgers under `notes/bakeoff-b/ledgers/`; $120 hard cap, $0.50 stop margin, per-lane caps.)*

## 8. Disclosed anomalies

*(FILLING.)*

## 9. Judge verdicts (verbatim)

*(PENDING — criteria-reviewer + user-advocate, both required, 0 MUST-FIX.)*

## 10. Founder sign-off gate

This table is a PROPOSAL. Nothing routes until Logan signs.
