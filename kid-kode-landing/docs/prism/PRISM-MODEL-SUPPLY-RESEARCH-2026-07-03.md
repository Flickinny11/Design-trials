# PRISM-MODEL-SUPPLY-RESEARCH — 2026-07-03

> Research note, not a spec. Feeds OD1/OD2/OD4 and bakeoff §11 of
> PRISM-SWARM-DISPATCH-SPEC.md (draft). All model/pool choices remain
> founder decisions gated on bakeoff evidence. Web-verified 2026-07-03.

## 1. Quality landscape (coding), July 2026

- Leaderboards (llm-stats 07-02, Vellum 07-01, BenchLM): Claude Fable 5 /
  Mythos 5 lead coding; Claude Opus 4.8 (May 28, $5/$25, SWE-bench Pro 69.2%,
  Fast Mode $10/$50 at ~2.5x speed) is the top generally-priced frontier.
- **Claude Sonnet 5 — NEW June 30, 2026.** $2/$10 intro (then $3/$15), 1M ctx,
  SWE-bench Pro 63.2%, beats GPT-5.5 on every directly comparable benchmark at
  40-50% lower cost. Caveat: tokenizer emits ~1.0-1.35x more tokens for the
  same text — cost math must use effective tokens, not sticker price.
- OpenAI: GPT-5.5 / 5.5-Pro (long-context surcharge above 272K);
  GPT-5.3 Codex — 77.3 SWE-bench Pro, reported as the strongest open-weight
  coding result; GPT-5.4-mini as speed tier.
- Google: Gemini 3.1 Pro (accuracy/research leader), Gemini 3.5 Flash
  ($1.50/$9.00 price-performance pick), Gemini 3.5 Pro expected July.
- Open/frontier-open coders now in range of our simple/moderate tiers:
  DeepSeek V4-Flash ($0.14/$0.28, 1M ctx, MIT, Haiku-tier reports),
  GLM 5.2, Kimi K2.6 / K2.7-Code, MiniMax M3 (~$0.60/M in, 1M ctx) and M2.7,
  Qwen 3.7 Max, KAT-Coder-Pro V1 (73.4% SWE-bench Verified).

## 2. Speed tier

- Cerebras: ~3,000 tok/s (gpt-oss-120B), up to 4,000 with speculative
  decoding; TTFT 80-150ms; open-weight catalog only (Qwen, Kimi K2, GLM,
  Llama; no Claude/GPT/Gemini). 99%+ published uptime.
- Groq: sub-100ms TTFT, ~476-1,200 tok/s; customer reports of throttling
  before stated limits — treat as burst pool, never base capacity.
- SambaNova: 435 tok/s on MiniMax M2.7 (frontier-open coder on custom silicon).
- Fireworks: adaptive speculative decoding; strongest structured-output path;
  dedicated deployments = capacity bound by replicas purchased, not rate
  limits. Together (ATLAS), Baseten, DeepInfra similar dedicated patterns.
- **Mercury 2 (Inception, Feb 2026): alive and validated.** >1,000 tok/s on
  Blackwell, $0.25/$0.75 per MTok, AIME-2026 90%, Haiku-4.5/GPT-5-mini-class
  intelligence, OpenAI-compatible, enterprise tier = custom rate limits + SLA.
  Production case: Augment Code replaced Opus 4.7 on a subagent — 82% latency
  and 90% cost reduction at equal quality. OD2 answer strengthens to
  "bakeoff, with pre-approval likely if it wins simple tier."
- DiffusionGemma (Google, June 10, 2026): open-weight 26B MoE diffusion;
  ~4x faster inference but AIME 69.1% vs Mercury 2's 90% — monitor, don't bet.

## 3. Supply mechanics — how "won't rate-limit us" actually works

No provider sells unlimited. At platform scale you BUY deterministic capacity
and let the ledger arbitrate the rest. Verified mechanics:

- **Anthropic direct.** (a) Priority Tier: committed ITPM/OTPM capacity,
  prioritized over all traffic, exposes anthropic-priority-*-limit/remaining/
  reset headers — plugs directly into ledger C2 header parsing.
  (b) **Cache-aware rate limiting: cached input tokens do NOT count toward
  ITPM.** With A6 (>=85% L1+L2 cache hit), effective Anthropic ITPM is ~5-7x
  the stated number. Our compiler architecture is literally a throughput
  multiplier on this provider. (c) May 6, 2026 capacity expansion
  (SpaceX/Colossus, 220K GPUs): Tier-1 Opus ITPM +1500%; Tier 4 ~10M input
  tok/min, Haiku up to ~4M ITPM; Custom tier = no spend cap, negotiated.
  (d) Batch API: 50% off, separate limit pool — candidate for repair-lane
  overflow and overnight optimization jobs, never the blast lane.
- **Azure Foundry PTU.** Deterministic latency/throughput; min ~$2,448/mo per
  unit; break-even ~300K TPM sustained 8h+/day (~60-80% utilization);
  spillover-to-standard native. CAUTIONS: capacity approval can take weeks —
  lead time is real; PTU deployments lock to specific model versions (the
  model-independent part is the quota, not the deployment).
- **AWS Bedrock PT.** Model-agnostic within a provider family; Claude 1-hour
  prompt-cache TTL since Jan 2026 (cached reads ~10% of input rate).
- **Vertex AI PT + CUDs.** Up to 57% off at 3-year commit (locks model
  family); Model Garden = broadest multi-vendor catalog (Claude + Gemini +
  open weights under one quota surface).
- **Dedicated GPU inference (Fireworks/Baseten/Together).** No rate limits by
  construction — throughput = replicas purchased. Best home for open-weight
  simple-tier winners at Stage 2.
- Break-even doctrine unchanged from v0.1 §6.1: pay-go multi-pool until
  sustained >150-200M tok/month, then provision to ~p50 demand, keep pay-go
  as burst, owned SGLang as Stage-3 baseline + terminal lane from day one.

## 4. Role-based recommendation (bakeoff confirms; config, not code)

| Role | Recommendation (evidence-pending) | Supply path |
|---|---|---|
| Planner + SAD loop (per-build, low vol) | Claude Opus 4.8; Sonnet 5 challenger | Anthropic direct (priority tier) |
| Simple-tier blast (60-80% of nodes) | Bakeoff: Mercury 2, Gemini 3.5 Flash, DeepSeek V4-Flash, MAI-Code-1-Flash*, MiniMax M3 | Dedicated/PTU + pay-go burst |
| Moderate + integration nodes | Claude Haiku 4.5 (cache-aware ITPM), Sonnet 5, Gemini 3.5 Flash | Anthropic direct + Vertex |
| Complex nodes | Claude Sonnet 5 (price disruptor), Gemini 3 Pro | Anthropic direct + Vertex |
| Escalation (repair attempt 3) | Claude Opus 4.8 (Fast Mode only if latency-critical) | Anthropic direct |
| Edit-path interactive (prompt-to-edit) | Haiku 4.5 or Sonnet 5 w/ retrieval bundle; Mercury 2 challenger | Anthropic direct; abstention gate first |
| Verification | SWE-RM on Modal (unchanged) | Owned |

*MAI-Code-1-Flash: June 2026 findings stand; Azure Foundry availability to be
confirmed at bakeoff signup — flagged, not assumed.

## 5. Bakeoff contestant update (replaces v0.1 §11 item 2 on ratification)

Simple tier: Mercury 2 · Gemini 3.5 Flash · DeepSeek V4-Flash · MAI-Code-1-
Flash* · MiniMax M3 · GPT-5.4-mini. Moderate: Claude Haiku 4.5 · Claude
Sonnet 5 · Gemini 3.5 Flash · Kimi K2.7-Code. Complex: Claude Sonnet 5 ·
Gemini 3 Pro · GPT-5.5. Escalation reference: Claude Opus 4.8.
Each contestant runs WITH and WITHOUT retrieved skill hints (Amendment A
hint-ablation arm). Primary metric unchanged: first-pass verification rate.
Cost normalization MUST use effective tokens (Sonnet-5/Opus-4.7+ tokenizer
factor ~1.0-1.35x), not sticker rates.

## 6. Sources (retrieved 2026-07-03)

llm-stats.com coding leaderboard (07-02) · vellum.ai/llm-leaderboard (07-01) ·
benchlm.ai/coding · felloai.com/best-ai-models (07-02, Sonnet 5 launch) ·
platform.claude.com service-tiers + rate-limits docs · finout.io Anthropic
pricing guide (Opus 4.8) · mindstudio.ai tier-limits (May 2026 increases) ·
futureagi.com + usage.ai + internative.net + bitslovers.com (PTU/PT/CUD
mechanics) · truefoundry.com (PTU lead-time caution) · inceptionlabs.ai +
decrypt.co + cryptobriefing.com (Mercury 2, DiffusionGemma) · cerebras.ai +
gmicloud.ai + speko.ai + inworld.ai (speed tier) · kilo.ai leaderboard
(open coders).

---
*Research note v1 — 2026-07-03 — for founder review alongside
PRISM-SWARM-DISPATCH-SPEC.md v0.1 and Amendment A. Not ratified, not canonical.*
