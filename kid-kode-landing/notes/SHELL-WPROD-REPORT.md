# SHELL-WPROD REPORT — Production Readiness Gate (keys live)

Status: IN PROGRESS (skeleton — sections fill as evidence lands)
Wave: PRISM-WPROD, authored 2026-07-07, executed 2026-07-09
Branch: codex/prism-recovery-harness-20260630
Method: REAL credentials (../.assetgen/, chmod 600, gitignored; INV-19 —
values never appear in logs, reports, or commits; HTTP codes only), real
browser journeys against a real production build, live provider calls with
spend logged.

## 1. Provider cascade — live proof

**New module `src/server/inference/`** (additive; engine invariant 10
"provider-agnostic inference"): four OpenAI-compatible adapters behind one
`completeWithCascade()` with the ROADMAP-ratified failover order
**Cerebras → Fireworks → DeepInfra → Groq**, all serving the SAME open
model family (`gpt-oss-120b`) so degradation crosses vendors, not model
quality. Keys resolve server-only (`key-source.ts`): env var first, then
the founder key-drop file under `PRISM_KEYS_DIR` (default `../.assetgen` —
the established generative-pipeline precedent). Every attempt lands in a
sanitized ledger (provider, HTTP status, latency, tokens, cost estimate —
never key material, never response bodies on error).

**Wired into the product:** `resolveBlueprint` (Conductor planner) now goes
LIVE through the cascade when `ANTHROPIC_API_KEY` is absent — same bounded
`CopyPlan` shape, same deterministic structure, honest provenance threaded
end-to-end (`BuildBlueprint.provider/providerModel` → conductor stream line
`planner: live (<provider> · <model>)` → flight-recorder
`gen_ai.provider.name`). Any cascade miss → the proven stub (a build never
blocks).

**Live results (2026-07-09, `tests/unit/wprod-cascade-live-proof.test.ts`
with `WPROD_LIVE=1`; artifact
`notes/verification/wprod/cascade/live-results.json`):**

| Provider | Key auth (GET /models) | Chat completion | Latency | Tokens (p/c) | Cost est. |
|---|---|---|---|---|---|
| cerebras | HTTP 200 | **HTTP 402** payment_required (no billing — D-01) | 249ms | — | — |
| fireworks | HTTP 200 | **HTTP 200** ✓ "…blue…" | 587ms | 74/76 | $0.0000567 |
| deepinfra | HTTP 200 | **HTTP 402** needs positive balance (D-02) | 259ms | — | — |
| groq | HTTP 200 | **HTTP 200** ✓ "It is blue." | 483ms | 90/116 | $0.0000831 |

**Failover proven twice, live:**
- **Natural** (no mock needed — Tier 1 is genuinely down): `cerebras:402 →
  fireworks:OK`, answered in 733ms.
- **Forced drill** (`failProviders:['cerebras']` through the production code
  path): cerebras skipped as `forced-failure` → fireworks answers.

**Hermeticity find (fixed):** with real keys on disk the pre-existing
"entirely offline" W5 conductor test silently went live through the new
cascade (6.1s runtime, real network). Fixed at the harness level —
`vitest.config.mjs` now points `PRISM_KEYS_DIR` at a void for every test
(conductor test back to 1.1s, truly offline); the `WPROD_LIVE=1` proof
suite opts back in explicitly. Ops kill switch added:
`PRISM_INFERENCE_DISABLE=1`.

Unit coverage: `wprod-inference-cascade.test.ts` (10 tests — order, no-key
skip, HTTP failover, forced drill, total-failure null, key-leak guard, cost
math) + `wprod-planner-cascade.test.ts` (3 tests — live provenance +
structure identity, all-fail → stub, keyless → stub with zero network).

## 2. GitHub OAuth — real login journey

_(login → session → project access → logout, real browser, frames;
kriptik.app callback URL → SHIP-BRAND checklist line)_

## 3. Vercel harvest attempt

_(vercel env pull on kriptik-ai-opus-build + -backend; Sensitive-marked /
unreadable values → decision list; I-POISON: no old-Supabase values wired
anywhere)_

## 4. Full real journeys (production build)

_(signup/login, create project, guided build E2E, public-repo import E2E,
one LIVE generate-3D, ship flow, return visit + reopen — frames per journey)_

## 5. Flight recorder live check

_(per-type record counts from the dev ledger covering every journey above)_

## 6. Founder decision list

See `notes/WPROD-DECISION-LIST.md` — the SHIP-BRAND cutover input.

## 7. Spend log

_(every live call: provider, HTTP code, latency, tokens, cost estimate)_

## 8. Gates

- [ ] tsc: baseline
- [ ] verify aggregate EXIT 0
- [ ] W5B ship gate green
- [ ] affected suites green

## 9. Judges (fresh-context, 0 MUST-FIX required)

_(criteria-reviewer + user-advocate as release manager — verdicts appended
verbatim on completion)_

## 10. Invariants

_(I-SECRETS/INV-19, I-POISON, I-PROVENANCE, I-ADDITIVE — evidence per item)_
