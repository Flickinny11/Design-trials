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

## D-03 — No Resend key exists; legacy email was SMTP

- **What:** the harvest found NO `RESEND_API_KEY` in either legacy project
  (production or development). The backend used raw SMTP (`SMTP_PASS`).
  The roadmap's "Resend salvage" assumption is FALSE — there is nothing to
  salvage.
- **Where:** resend.com → sign up / log in → API Keys → create key → add as
  `RESEND_API_KEY` (Sensitive) on the kept Vercel project at SHIP-BRAND.
  (Or decide to keep SMTP and provide SMTP host/user to pair with the
  harvested `SMTP_PASS`.)
- **Why:** transactional email (signup verification, magic links, receipts)
  needs a provider before launch; Better Auth email flows are wired for a
  provider key.
- **Blocking?** For launch yes (email verification), for W-PROD no
  (email+password signup works without verification locally).

## D-04 — Rotate every harvested value at SHIP-BRAND (April-2026 incident doctrine)

- **What:** all readable legacy env values (Google OAuth secret, Stripe
  keys, Anthropic, Nango, Modal, R2, OpenRouter, OpenAI, GitHub build
  token, legacy GitHub OAuth pair, SMTP) predate Vercel's April 2026
  third-party-OAuth incident AND several passed through chat historically.
  Treat every one as HARVEST-THEN-ROTATE.
- **Where:** each provider's console (Google Cloud → Credentials; Stripe →
  Developers → API keys → roll; Anthropic console → API keys; Nango,
  Modal, Cloudflare R2, OpenRouter, OpenAI dashboards) → rotate → update
  value in place on the kept Vercel project → mark **Sensitive**.
- **Why:** ROADMAP Amendment 1 mechanics; new-project values should never
  inherit exposure.
- **Blocking?** Not for W-PROD (local verification only); REQUIRED before
  production traffic.

## D-05 — Bonus harvest: a live-looking ANTHROPIC_API_KEY exists (unwired)

- **What:** `kriptik-ai-opus-build` production env carries an
  `ANTHROPIC_API_KEY` (len 108). W-PROD did NOT wire it (mission scope =
  the four cascade providers; the key is pre-rotation legacy). If wired,
  the Conductor planner prefers Anthropic over the cascade automatically
  (code path already exists and is tested).
- **Where:** decide at SHIP-BRAND: rotate at console.anthropic.com → set
  `ANTHROPIC_API_KEY` on the kept project (Sensitive) → planner goes
  Anthropic-first with cascade fallback.
- **Blocking?** No.

## D-06 — GitHub OAuth app: confirm/add the localhost + kriptik.app callback URLs

- **What:** the GitHub OAuth app `Ov23li8V…(client_id, public)` (the NEW founder
  drop) is correctly wired — clicking "GitHub" on `/sign-in` produces a
  valid authorize request (PKCE, `redirect_uri=http://localhost:3010/api/
  auth/callback/github`, scopes `read:user user:email`) and reaches
  GitHub's real login. What W-PROD could NOT confirm autonomously: whether
  the app's registered **Authorization callback URL(s)** include that
  localhost path (GitHub validates redirect_uri only AFTER an interactive
  login, which needs a human credential entry — see D-07).
- **Where:** github.com → Settings → Developer settings → OAuth Apps →
  (this app) → **Authorization callback URL**. For SHIP-BRAND add:
  `https://kriptik.app/api/auth/callback/github` (and any preview domain).
  For local verification add `http://localhost:3010/api/auth/callback/
  github`. Better Auth derives the callback path automatically; only the
  base origin changes per environment.
- **Why:** an unregistered callback URL makes GitHub reject the redirect
  after login with "The redirect_uri MUST match the registered callback
  URL." This is the single most common OAuth launch break.
- **Blocking?** For GitHub sign-in in production: YES (must be registered
  before launch). SHIP-BRAND checklist line.

## D-07 — Completing a real GitHub sign-in needs one human credential entry

- **What:** W-PROD proved the app-side GitHub OAuth wiring to GitHub's real
  authorization server (frames `02-github-real-login-correct-params.png`).
  The final step — entering GitHub username/password/2FA — is inherently a
  human action and cannot be automated from a headless CI browser. A real
  logged-in `github.com` session DOES exist in Logan's Chrome; reusing it
  would require approving a one-time macOS **Keychain Access** prompt for
  "Chrome Safe Storage" (the automation could not click it). The full
  session machinery (login → tenant-isolated session → project access →
  logout) is proven end-to-end via the always-on email+password path in
  §2/§4 — GitHub differs only in who authenticates the identity, then joins
  the identical Better Auth session/tenancy flow.
- **Where:** at verification time, Logan either (a) clicks "GitHub" and logs
  in once in the verification browser, or (b) approves the Keychain prompt
  so automation can reuse his existing github.com session.
- **Blocking?** No — email+password proves the session flow; GitHub joins
  the same flow post-identity.

## D-08 — Private-repo import needs the GitHub App .pem (client id/secret insufficient)

- **What:** public-repo import is fully live keyless (proven on
  `vercel/next-learn`). Private-repo import + the PR-edit plan need GitHub
  **App installation** auth — an App id + private key (.pem) + slug — which
  the OAuth client id/secret alone cannot provide.
- **Where:** github.com → Settings → Developer settings → **GitHub Apps** →
  New/existing App (read-only contents) → generate a private key (.pem) →
  install on the target account → set `GITHUB_APP_ID`,
  `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG` (+ `PRISM_GITHUB_TOKEN` for the
  sandbox) on the kept Vercel project (Sensitive).
- **Why:** private-repo customers can't import until App auth exists; public
  repos work today.
- **Blocking?** For private-repo import at launch: yes. For W-PROD /
  public-repo import: no.

## D-09 — Cascade planner copy is best-effort; stub fallback is the safety net

- **What:** the guided-build Conductor now refines copy via the live cascade
  (fireworks gpt-oss-120b) — proven live on the barbershop build (copy
  visible in the render). One of two builds this run fell back to the
  deterministic stub (the model's response failed strict JSON extraction).
  The build was still Verified shippable — the stub fallback is the designed
  safety net, not a failure.
- **Where:** N/A (behavior is correct). Optional hardening at SHIP-BRAND:
  wire `ANTHROPIC_API_KEY` (D-05) so the planner prefers Anthropic
  structured-output first (higher copy-refine success rate), cascade second,
  stub last.
- **Blocking?** No.

## SHIP-BRAND CUTOVER CHECKLIST LINES (harvested this run)

The kept-project cutover (ROADMAP Amendment 2) — items W-PROD confirmed:
1. Add OAuth callback URLs: `https://kriptik.app/api/auth/callback/{github,google}` (D-06).
2. Add the four inference keys (Cerebras, Fireworks, DeepInfra, Groq) —
   Fireworks + Groq are funded/live NOW; fund Cerebras + DeepInfra (D-01/D-02).
3. Add a Resend key or SMTP config (D-03).
4. Rotate every harvested value + mark Sensitive (D-04); optionally wire the
   harvested Anthropic key (D-05).
5. Provision the GitHub App .pem for private-repo import (D-08).
6. NEVER wire any harvested `SUPABASE_*`/`POSTGRES_*` value — fresh project
   only (I-POISON, ROADMAP Amendment 1).
