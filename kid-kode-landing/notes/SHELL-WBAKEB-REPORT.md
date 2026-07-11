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

*(FILLING — lanes in flight. 50 frozen nodes × 3 runs per model, rule-based verify via the shipped `verifyNodeModule`, no repair; separate single repair-allowed pass on failures.)*

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
