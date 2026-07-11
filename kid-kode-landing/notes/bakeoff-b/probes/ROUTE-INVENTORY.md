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
