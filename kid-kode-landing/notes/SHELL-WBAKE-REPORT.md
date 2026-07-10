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

- **Functional corpus** (`notes/bakeoff/corpus/functional/`): 50 node specs from the Nova Atelier reference plan — 33 derived via the certified `authorNode` path + 17 disclosed extras; stratified **30 simple / 15 moderate / 5 complex**, 9 integration-bearing (≥8 required). Prompts: `L1 = SHARED_SYSTEM_PROMPT` verbatim, ONE compiled L2 WORLD block (content-hashed `worldHash`), per-case frozen L3 strings.
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
| **deepseek-v4-flash** | 115 | **59.1%** | .49/.60/.71 (0.22) | 62.0% (n=71) | 51.5% (n=33) | 63.6% (n=11) | 0.00 / 0.99 | 19.5s / 45.0s | $0.0038 | TEXT 27, GLB 10, WINDOW 6 |

¹ Claude-lane costs are **subscription-equivalent** (computed from CLI-reported usage at published API rates) — the CLI bills against the founder's subscription, not metered dollars. Claude-lane wall times include a small constant CLI harness envelope (~2K tokens), disclosed; p50 wall for haiku includes CLI startup and is not transport-comparable with raw-API lanes.

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

**[FILLED IN §4 BELOW AFTER AGGREGATION — see aggregate.json]**

## 5. D4 — Axis 3: critic agreement (OD12b)

**[FILLED IN §5 BELOW AFTER AGGREGATION]**

## 6. §6.2 winner-per-tier proposal

**[FILLED AFTER AXES 2–3 CLOSE]**

## 7. Cost ledger totals

**[FILLED FROM ledger-merged.json]**

## 8. Disclosed anomalies

**[FILLED — running list maintained during the wave]**

## 9. Judge verdicts (verbatim)

**[APPENDED AFTER BOTH JUDGES RUN]**

## 10. Founder sign-off gate

This table is a **PROPOSAL**. Nothing routes until Logan signs. Per spec §11.5 and the ratification addendum, W-DISPATCH fires only after the founder signs the completed §6.2 evidence table; `PrismDispatchConfig`, cascade order, provider wiring, and runtime model selection are untouched by this wave (I-B1).
