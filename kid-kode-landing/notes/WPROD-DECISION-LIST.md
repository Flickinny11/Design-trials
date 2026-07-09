# WPROD FOUNDER DECISION LIST — SHIP-BRAND cutover input

Every item that needs Logan, each with the exact console path and why.
Authored during PRISM-WPROD (2026-07-09). Items append as the run finds them.

## Format

Each entry: **what** / **where (exact console path)** / **why** / **blocking?**

---

## D-01 — Cerebras account has no inference billing (key valid, completions 402)

- **What:** the dropped `cerebras.key` authenticates (GET `/v1/models` → HTTP
  200) but EVERY chat completion returns HTTP 402
  `payment_required` ("Payment required to access this resource. Visit your
  billing tab.") — tried `gpt-oss-120b`, `gemma-4-31b`, `zai-glm-4.7`.
- **Where:** cloud.cerebras.ai → your organization → **Billing** tab → add a
  payment method / credits (or attach the free-tier quota if the org predates
  it).
- **Why:** Cerebras is Tier 1 of the ratified inference cascade (Cerebras →
  Fireworks → DeepInfra → Groq). The cascade fails over cleanly today (proven
  live), so this does NOT block launch — it costs us the fastest tier.
- **Blocking?** No (cascade degrades gracefully; Fireworks answers in ~700ms).

## D-02 — DeepInfra account has zero balance (key valid, completions 402)

- **What:** the dropped `deepinfra.key` authenticates (GET
  `/v1/openai/models` → HTTP 200, 174 models) but chat completions return
  HTTP 402: "You need positive balance to do inference. Please add balance
  manually or setup top-up."
- **Where:** deepinfra.com → Dashboard → **Billing** → add balance or enable
  auto top-up.
- **Why:** DeepInfra is Tier 3 of the cascade and the cheapest per-token
  (~$0.09/M in / $0.45/M out for gpt-oss-120b) — worth funding as the
  cost-optimal tier.
- **Blocking?** No (Fireworks + Groq are live and funded; cascade proven).
