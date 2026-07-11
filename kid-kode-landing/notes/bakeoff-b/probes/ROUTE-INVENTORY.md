# W-BAKE-B D0.2 — Live route inventory (probed 2026-07-10)

Raw artifacts: `route-inventory.json`, `<provider>-models.json` in this dir.
Key VALUES never printed/logged (I-BB6). The credential surface expanded
materially since W-BAKE, which is why this re-probe is load-bearing.

## Provider reachability

| Provider | key source | /models | 1-tok funding | verdict |
|---|---|---|---|---|
| Fireworks | `.assetgen/fireworks.key` | 200 (7) | **200** | LIVE |
| Groq | `.assetgen/groq.key` | 200 (17) | **200** | LIVE (qwen3.6, gpt-oss) |
| Cerebras | `.assetgen/cerebras.key` | 200 (3) | **200** | LIVE — was 402 at W-BAKE (now funded) |
| DeepInfra | `.assetgen/deepinfra.key` | 200 (169) | **200** | LIVE — was 402 at W-BAKE (now funded) |
| OpenRouter | `env:OPENROUTER_API_KEY` / `.constellation/openrouter.key` | 200 (346) | **200** | LIVE — NEW (absent at W-BAKE) |
| OpenAI direct | `env:OPENAI_API_KEY` | 200 (125) | **429 insufficient_quota** | catalog visible, **UNFUNDED** — cannot generate |
| Inception direct | `env:INCEPTION_API_KEY` | 200 (1) | **200** (`mercury-2`) | LIVE for mercury-2; `mercury-coder` 403 access-denied |
| Anthropic (claude CLI) | founder-authenticated | — | ok ×4 | LIVE (haiku-4.5, sonnet-5, fable-5, opus-4.8) — used for the VISION JUDGE |

## OpenAI GPT-5.6 catalog probe (D0 item 2)

GPT-5.6 tiers **are GA in the OpenAI catalog** on this key
(`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` present) — but the OpenAI
**direct** key is `insufficient_quota` (429), so direct generation is
impossible. All three tiers ARE reachable via **OpenRouter**
(`openai/gpt-5.6-{sol,terra,luna}`), which is the route used. No fallback to
GPT-5.5-mini/GPT-5-nano was needed.

## Cheapest-live-route decision per roster model (D1)

| Model | Route | Provider model id | $/MTok in/out |
|---|---|---|---|
| claude-haiku-4.5 | deepinfra | anthropic/claude-haiku-4-5 | 1.0 / 5.0 |
| claude-sonnet-5 | openrouter | anthropic/claude-sonnet-5 | 2.0 / 10.0 |
| gpt-oss-120b | fireworks | accounts/fireworks/models/gpt-oss-120b | 0.15 / 0.6 |
| deepseek-v4-flash | openrouter | deepseek/deepseek-v4-flash | 0.084 / 0.168 |
| glm-5.2 | openrouter | z-ai/glm-5.2 | 0.42 / 1.32 |
| kimi-k2.7-code | openrouter | moonshotai/kimi-k2.7-code | 0.72 / 3.49 |
| gemini-3.5-flash | openrouter | google/gemini-3.5-flash | 1.5 / 9.0 |
| mercury-2 | inception | mercury-2 | 0.25 / 0.75 |
| gpt-5.6-luna | openrouter | openai/gpt-5.6-luna | 1.0 / 6.0 |
| gpt-5.6-terra | openrouter | openai/gpt-5.6-terra | 2.5 / 15.0 |
| gpt-5.6-sol | openrouter | openai/gpt-5.6-sol | 5.0 / 30.0 |
| claude-fable-5 *(ceiling ref, design only)* | openrouter | anthropic/claude-fable-5 | 10.0 / 50.0 |
| claude-opus-4.8 *(ceiling ref, design only)* | openrouter | anthropic/claude-opus-4.8 | 5.0 / 25.0 |
| qwen3.7-plus *(D4 critic)* | openrouter | qwen/qwen3.7-plus | 0.32 / 1.28 |

**All generation rides ONE uniform OpenAI-compatible HTTP harness** (method
improvement over W-BAKE, which ran its Claude lanes through the CLI with a ~2K
envelope confound). The founder claude CLI is used ONLY for the Fable/Opus
vision judges (vision Read is CLI-only).

## UNREACHABLE (recorded with proof — I-BB5, never extrapolated)

- **mai-code-1-flash** — absent from every keyed catalog (openrouter 346 /
  deepinfra 169 / fireworks / groq / cerebras / openai). grep mai/microsoft
  returns only `microsoft/phi-4` + `wizardlm-2`. No Azure/Foundry creds.
- **mercury-coder** — Inception 403 `model_access_denied`: "only available to
  accounts created before February 24, 2026." Not on OpenRouter (only
  `inception/mercury-2`) or any other keyed catalog. `mercury-2` substitutes as
  the D5 seam executor (disclosed).

## MID-WAVE EVENT (2026-07-10 ~21:55 CDT) — OpenRouter 402 + reroute

OpenRouter went **402 insufficient_credits mid-run** (credits endpoint:
`total_credits: 74, total_usage: 75.26` — overdrawn; raw 402 bodies preserved
in the affected lane run dirs as `ok:false` rows). The D0 funding probe at
20:48 CDT was a true 200 — the account drained DURING the wave (this key also
carried W-PCP and other prior waves).

**Reroute (evidence: `deepinfra-reroute-funding.json`, all 200 with metered
usage):** every roster model with a live alternate route moved to DeepInfra —

| Model | New route | DeepInfra model id | $/MTok in/out |
|---|---|---|---|
| claude-sonnet-5 | deepinfra | anthropic/claude-sonnet-5 | 2.0 / 10.0 |
| deepseek-v4-flash | deepinfra | deepseek-ai/DeepSeek-V4-Flash | 0.09 / 0.18 |
| glm-5.2 | deepinfra | zai-org/GLM-5.2 | 0.93 / 3.0 |
| kimi-k2.7-code | deepinfra | moonshotai/Kimi-K2.7-Code | 0.74 / 3.5 |
| gemini-3.5-flash | deepinfra | google/gemini-3.5-flash | 1.5 / 9.0 |
| claude-fable-5 *(ceiling ref)* | deepinfra | anthropic/claude-fable-5 | 10.0 / 50.0 |
| claude-opus-4.8 *(ceiling ref)* | deepinfra | anthropic/claude-opus-4-8 | 5.0 / 25.0 |

Lanes partially generated on OpenRouter before the 402 are **mixed-route**:
each ledger row records the route that call actually rode; `ok:false` 402 rows
are retried on the new route (run-gen-b resume semantics skip only `ok:true`).
Same L1 v2.1 + frozen L2 bytes on both routes (I-BB2 unaffected).

**Blocked at the 402 boundary (no alternate keyed route; I-BB5):**
- `gpt-5.6-terra` functional (0/150 ok) + design (0/40) — OpenRouter-only.
- `gpt-5.6-sol` functional (0/150 ok) + design (0/40) — OpenRouter-only.
- `gpt-5.6-luna` **design** (0/40; its functional lane completed 150/150
  BEFORE the drain) — OpenRouter-only.
- `qwen3.7-plus` (D4 critic) — not in any alternate keyed catalog.

These run iff OpenRouter credits are restored before the wave closes;
otherwise reported UNREACHABLE-mid-wave with the 402 evidence, never
extrapolated.
