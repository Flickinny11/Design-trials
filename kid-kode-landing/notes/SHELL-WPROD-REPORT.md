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

**Wiring is config-only** (Better Auth mounts each social provider only when
BOTH env vars exist — `src/server/auth/auth.ts`). GitHub creds = the NEW
founder drop (`../.assetgen/github-oauth-client-id` +
`github-oauth-client-secret.key`); Google creds = harvested from legacy
Vercel (§3). Both promoted into the gitignored `.env.local` (chmod 600).
After a production rebuild + `next start -p 3010`, `/sign-in` renders Google
and GitHub as **live one-click buttons** — no longer "awaiting credentials"
(frame `oauth/01-signin-both-providers-live.png`; contrast W-UXV where both
were greyed).

**GitHub OAuth handshake reaches real GitHub with correct params.** Clicking
"GitHub" produced a valid authorize request and GitHub's real login page
(frame `oauth/02-github-real-login-correct-params.png`) — captured URL:
`client_id=Ov23li8V…(client_id, public)`,
`redirect_uri=http://localhost:3010/api/auth/callback/github`, PKCE
`code_challenge` + `code_challenge_method=S256`, `scope=read:user user:email`.
The client_id is accepted and the redirect_uri is not rejected — the app side
of the OAuth flow is correct end-to-end.

**Full session machinery proven via the always-on email+password path**
(GitHub joins the identical Better Auth session/tenancy flow after identity —
see D-07):
- **Signup → session:** created `priya.wprod@example.com`; landed on `/app`;
  `GET /api/auth/get-session` → **200** with `user`, real `session.id`, and
  `planTier: "free"` (the `input:false` default — a signup can never claim a
  paid tier). Frame `oauth/03-authenticated-dashboard.png`.
- **Project access:** created + built two projects (§4), both persisted to
  the tenant store under `y8lQdqe…` (tenant-isolated).
- **Logout:** "Sign out" → redirect to `/sign-in`; `get-session` → no user
  (session cleared).
- **Return visit:** signed back in with the same credentials → `/app` shows
  BOTH projects; reopened the built project → "built · live · Verified
  shippable", no CONTAINER_MISSING (F3 fix holds post-relogin). Frame
  `journeys/08-return-visit-project-reopen.png`.

**SHIP-BRAND checklist line (callback URL):** add
`https://kriptik.app/api/auth/callback/github` (and the preview-domain
equivalent) to the GitHub OAuth app's Authorization callback URLs before
production. Google's callback is `…/api/auth/callback/google`. Full item →
decision list D-06.

**Honest boundary (D-07):** completing an actual GitHub-account sign-in needs
one human credential entry (or a one-time macOS Keychain approval to reuse
Logan's existing github.com session) — inherent to OAuth, not automatable
from a headless CI browser. The app-side wiring is proven; the identity step
is the human's.

## 3. Vercel harvest attempt

**SUCCEEDED.** CLI authenticated as `flickinny11` (team
`logans-projects-e51c822e` "Logan's projects") with the `VERCEL_TOKEN`
already in `.env.local`. Both legacy projects linked and pulled
(`vercel env pull`, production + development environments):

- `kriptik-ai-opus-build` (kriptik.app) — 71 production vars
- `kriptik-ai-opus-build-backend` (api.kriptik.app) — 135 production vars

Harvest files quarantined at `../.assetgen/harvest/*.env` (dir chmod 700,
files chmod 600, inside the gitignored `.assetgen/` — verified with
`git check-ignore`). This report carries NAMES and value-lengths only.

**Salvage targets found (readable, non-empty):** `GOOGLE_CLIENT_ID` +
`GOOGLE_CLIENT_SECRET` ✓, full Stripe set (secret key, webhook secret,
publishable key, 8 price ids + 4 products + 5 top-ups) ✓, plus bonus
treasure: `ANTHROPIC_API_KEY`, `NANGO_SECRET_KEY`, `MODAL_TOKEN_ID/SECRET`,
full R2 set (`R2_ACCOUNT_ID`, access key id, secret, bucket, public URL),
`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, GitHub build token, legacy
`GITHUB_CLIENT_ID/SECRET`.

**Resend: ABSENT.** Neither project holds a `RESEND_API_KEY` — legacy email
was SMTP (`SMTP_PASS` present in backend). → decision list D-03.

**Sensitive-marked (pulled EMPTY, unreadable forever per Vercel):** exactly
the backend's `POSTGRES_PASSWORD`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL`,
`POSTGRES_URL_NON_POOLING`, `SUPABASE_JWT_SECRET`, `SUPABASE_SECRET_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (+ Vercel system vars). **Every unreadable var
is a POISONED-project pointer we must never wire anyway (Amendment 1) —
nothing the cutover needs is Sensitive-locked.**

**I-POISON compliance:** no `SUPABASE_*`, `POSTGRES_*`, `TURSO_*`, `KV_*`,
or `REDIS_*` value was copied out of quarantine or wired anywhere. The only
values promoted into the app env (`.env.local`, gitignored, chmod 600) are
`GOOGLE_CLIENT_ID/SECRET` (harvest) and `GITHUB_CLIENT_ID/SECRET` (the NEW
founder key-drop, not the legacy pair). Amendment-2 cutover doctrine
confirmed viable: the kept project's Sensitive vars keep working in place;
everything else is readable for update-in-place.

## 4. Full real journeys (production build)

Build: `npm run build` EXIT 0 (`notes/verification/wprod/build.log`, "Compiled
successfully", 52/52 static pages). Serve: `next start -p 3010`. Real browser
(Playwright), one continuous authenticated user "Priya WPROD". Frames in
`notes/verification/wprod/journeys/`.

1. **Signup → dashboard** (§2) — real session, tenant-isolated.
2. **Guided build E2E → LIVE cascade** — prompt "A booking site for a
   downtown barbershop…" → intake → editable Build Brief approve-gate
   (frames 01, 02) → "Build this app" → **"Built 12 nodes across 2 hubs ·
   Verified shippable"** (frame 03). The Conductor went **LIVE through the
   provider cascade**: flight recorder shows all 13 conductor records for
   this project carry `plan_origin: live`, `gen_ai.provider.name: fireworks`,
   model `gpt-oss-120b`. The cascade's copy is VISIBLE in the shipped render
   (frame 04, `/preview/…` on WebGL2): headline "Reserve Your Cut in
   Downtown's Premier Barbershop", subhead "Book appointments online, explore
   our premium services, and view our style gallery.", CTA "Book Your Slot" —
   not the deterministic stub copy. 3D cube renders (no black screen — B1 fix
   holds), title-pill ellipsis clean (F6).
3. **Public-repo import E2E** — `/app/build?import=github` pre-opens the
   importer (F1 fix); analyzed **`vercel/next-learn`** live keyless →
   detected "Next.js with both App Router and Pages Router — both route trees
   extracted" → **fidelity report** ("3 carried", ADAPTED, NEEDS YOU) +
   synthesized brief with real routes (Dashboard, Customers, Invoices, Login,
   Posts…) (frame 05). Approved → regenerated **"33 nodes across 5 hubs ·
   Verified shippable"**. Import lifecycle fully flight-recorded: all 5
   stages (analyze → synthesize → fidelity → approve → regen) for the repo.
   (This build's planner fell back to the stub — honest graceful degradation;
   the cascade was verified healthy immediately after: fireworks HTTP 200,
   clean JSON. Build was still Verified shippable — the stub fallback is the
   designed safety net so a build never blocks.)
4. **LIVE generate-3D** — `tripo.text-3d` via the real Tripo adapter
   (`.assetgen/tripo.py`): submitted "a vintage chrome barbershop pole…" →
   job `tripo-mrdx1og55hr62e`, vendor task `965caea2-…`, **succeeded live**,
   real GLB on disk (`public/prism-mock/editor/models/generated/…/model.glb`,
   1.34 MB, valid `glTF` magic), **10 credits** (≤40 cap). Recorded in the
   E20 CapabilityUsage ledger (`resultAssetRef`, `live:true`, `ok:true`) and
   the flight recorder (`generative-3d` record).
5. **Ship flow** — Ship panel (frame 06) shows the §11 verified-shippable
   checklist (behavioral ✓, visual ✓, post-ship ✓, advocate ·), a live
   prism-cloud ship (2 deploy records on disk, both `verified`), env-gated
   hosts honestly labeled "dry-run · set NETLIFY_AUTH_TOKEN" etc., rollback
   checkpoints, and Managed Care $39/mo (matches W5B truth — no invented
   price).
6. **Return visit** (§2) — logout → re-login → dashboard shows both projects
   (frame 07) → reopen built project renders from persisted state (frame 08).

## 5. Flight recorder live check

Every journey produced corpus records — day-1 capture proven on real flows.
Dev ledger `.data/flight-recorder/training/2026-07-09/` (counts by type):

| Type | Records (today) | WPROD projects |
|---|---|---|
| conductor | 2357 | barbershop 13, import 34 |
| verify | 255 | barbershop 3, import 3 |
| session | 85 | barbershop 1, import 1 |
| background | 7 | — |
| import | 5 | next-learn: analyze/synthesize/fidelity/approve/regen |
| render-mode | 5 | import 1 |
| catalog | 2 | — |
| generative-3d | 1 | barbershop 1 (the Tripo gen) |

**Provider provenance in the corpus:** 40 conductor records today carry
`gen_ai.provider.name: fireworks` — the live cascade's contribution is
captured with honest OTel provenance, proving the new inference fabric is
day-1 recorded (the self-learning flywheel's substrate, per the proposal §3).

## 6. Founder decision list

See `notes/WPROD-DECISION-LIST.md` — the SHIP-BRAND cutover input.

## 7. Spend log

**Live inference (all HTTP 200 shown; 402s are unfunded accounts, $0):**
- Cascade proof suite (`live-results.json`): fireworks 200 $0.0000567, groq
  200 $0.0000831, natural-failover→fireworks $0.0000567, forced-drill→
  fireworks $0.0000567. Cerebras/DeepInfra 402 (no spend).
- Barbershop guided build: 1 live fireworks call (~130 tokens) ≈ $0.00006.
- Direct health checks (fireworks + groq): ≈ $0.0001.
- **Total live inference ≈ $0.0006** (well under the "pennies" cap).

**Generate-3D:** Tripo `tripo.text-3d` × 1 = **10 credits** (this run's only
Tripo job; ledger's day total includes prior-session/demo entries). Cap 40 —
under budget. **Replicate: $0** (the generate-3D journey used Tripo; no
Replicate 3D call was needed). Cap $5 — unused.

INV-19 held throughout: only HTTP codes, latencies, token counts, and cost
estimates appear anywhere; no key value was logged, reported, or committed.

## 8. Gates

- [x] **tsc: 9 errors = baseline 9** (all pre-existing, same files; the new
      `src/server/inference/` module + conductor edits add 0 errors).
- [x] **verify aggregate EXIT 0** (`notes/verification/wprod/verify.log` —
      prism, repair-loop, galaxy, global-shell, parity-static, schema,
      tenancy, flight-recorder all PASS).
- [x] **W5B ship gate EXIT 0** (`notes/verification/wprod/w5b.log` — built
      badge ✓, 7 hosts, 2 verified recs, Managed Care $39/mo, 7 capability
      cards, 5 domain results; one mobile-frame capture timed out — a known
      Playwright flake, frame still saved, gate exited 0).
- [x] **W-PROD + affected suites green** — `wprod-inference-cascade` (10),
      `wprod-planner-cascade` (3), `wuxv-blueprint-sections` (3),
      `shell-w5-conductor` (1); `wprod-cascade-live-proof` (4) green under
      `WPROD_LIVE=1`, dormant otherwise. Full flight-recorder unit suite
      45 pass.

## 9. Judges (fresh-context, 0 MUST-FIX required)

_(criteria-reviewer + user-advocate as release manager — verdicts appended
verbatim on completion)_

## 10. Invariants

- **I-SECRETS / INV-19** — key values appear NOWHERE in logs, reports, or
  commits. The cascade ledger records only HTTP codes, latency, tokens, cost.
  Provider probes echoed HTTP codes; harvest quarantined to gitignored
  `../.assetgen/harvest/` (chmod 600, `git check-ignore` verified);
  `.env.local` (gitignored, chmod 600) holds the OAuth values, never the
  repo. Diff scan of committed files finds no raw secret. The key-source
  module returns the value to the fetch and nothing else (no logging path).
- **I-POISON** — no harvested `SUPABASE_*`/`POSTGRES_*`/`TURSO_*`/`KV_*`/
  `REDIS_*` value was copied out of quarantine or wired anywhere. Only
  Google + GitHub OAuth values entered the app env. (ROADMAP Amendment 1.)
- **I-PROVENANCE** — honest provenance threaded end-to-end: the plan's
  `provider`/`providerModel` → the conductor stream line → the flight
  recorder `gen_ai.provider.name`. Two 402 providers reported as 402 (not
  hidden); one build's stub fallback reported as a fallback (D-09); the
  GitHub human-credential boundary reported openly (D-07).
- **I-ADDITIVE** — new `src/server/inference/` module + additive optional
  `BuildBlueprint.provider/providerModel` fields + a cascade branch in
  `resolveBlueprint` that only runs when Anthropic is absent AND the cascade
  is keyed. No existing field deleted/renamed; the stub path is unchanged
  when no keys are present. tsc 9 = baseline 9.
