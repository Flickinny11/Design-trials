# ROADMAP-TO-SHIP (founder-aligned 2026-07-05 21:42; plan-canonical on Logan's OK)

## SEQUENCE (each wave gated by dual judges; founder frames-review at boundaries)
1. W-FR  FLIGHT RECORDER — IN FLIGHT (launched 21:40). Day-1 corpus + OTel
   GenAI-aligned schema + PII/consent law + golden eval seed + ToS draft.
2. W-IMPORT  "PRISM INGEST" — GitHub repo -> Prism runtime. Spec'd below.
3. W-PROD  PRODUCTION UX GATE — near-human computer-use verification of the
   REAL app with REAL keys: signup, login (Google/GitHub), project create,
   guided build end-to-end, GH import, edit, generate-3D, ship, return-visit,
   billing surfaces. Every journey evidenced with recordings/frames. Requires
   founder key drop (list below). This is the "users will actually have a
   great experience" gate — nothing ships without it green.
4. SHIP-BRAND — KripTik repo + domain, full env wiring (§9 of self-learning
   proposal), key ROTATION (chat-shared keys), OAuth/Resend salvage, fresh
   Supabase/R2, W-IM investor mezzanine lands here (reads recorder corpus).
5. LAUNCH — recorder + mezzanine live from first user. W-FS/W-EV/W-TR follow
   per ratified gates.

## W-IMPORT DESIGN DECISION (the ultrathink answer)
Users' existing apps CANNOT run inside the Prism runtime as-is — the graph
IS the app (immutable invariant). So import is REGENERATION, not transpile:
  a) ANALYZE (read-only GitHub App): extract routes, components, data models,
     API surface, copy, brand tokens (colors/type/assets) from the repo.
  b) SYNTHESIZE PLAN: emit the SAME plan format guided-build produces — the
     repo is treated as an extremely rich prompt + asset source.
  c) USER APPROVES PLAN (existing gate), then normal parallel node build
     regenerates the app AS Prism nodes against the typed contract.
  d) FIDELITY REPORT: honest per-feature mapping (carried / adapted /
     needs-you), so users trust what "import" means.
This matches the contamination-aware ethos (never transplant unverified
code), reuses the ENTIRE existing build pipeline (import = a plan source,
not a second engine), and is honest marketing: "bring your app's DNA into
Prism," not "we run webpack apps." v1 scope: Next.js/React repos (the
target-user majority). v2: more frameworks + data-migration helpers.
The W2 intake's "Import an existing GitHub repo" checkbox is the surface.

## FOUNDER KEY DROP (gather for W-PROD; deliver at the W-FR boundary)
Salvage from legacy kriptik.app: Google OAuth client id/secret, GitHub OAuth
client id/secret, Resend API key. NEW: GitHub App (read-only; for imports)
app id + private key. Fresh: Supabase project (URL, anon, service role),
Cloudflare R2 (account id, access key id, secret). Accounts: Vercel token,
Modal token/secret, Nango secret, Stripe (secret + webhook secret, test mode
fine for W-PROD). Inference: Anthropic, plus any of Cerebras / Fireworks /
DeepInfra / Groq / OpenRouter available now (cascade degrades gracefully).
Already on disk: Replicate, Tripo. ALL keys: files under .assetgen/ or
.env.local (gitignored), chmod 600 — and ALL rotate at SHIP-BRAND since
several passed through chat.

## AMENDMENT 2026-07-05 22:18 — ENV/SECRETS DOCTRINE (founder-aligned)
Verified via connected Vercel MCP: team "Logan's projects", legacy projects
kriptik-ai-opus-build + kriptik-ai-opus-build-backend hold the env treasure.

MECHANICS (fresh-verified against Vercel docs 2026-07-05):
- Env vars are PER-PROJECT. New KripTik project won't see the old project's
  vars automatically. Harvest path: `vercel env pull` on the old project ->
  set on the new project (or promote shared keys to TEAM-level vars).
- CAVEAT: vars marked "Sensitive" are non-readable forever (no dashboard, no
  ls, no pull). Any Sensitive-marked key must be re-copied from its PROVIDER
  console, not from Vercel.
- SECURITY (fresh find): Vercel's April 2026 incident (third-party OAuth
  compromise) exposed customers' NON-sensitive env vars; Vercel guidance =
  rotate non-sensitive secrets. Legacy project predates the incident ->
  treat every harvested value as HARVEST-THEN-ROTATE at SHIP-BRAND, and mark
  all new secrets Sensitive in the new project.

CLEAN-SLATE DOCTRINE (founder's leak nightmare = RLS/config failure; wiping
DATA does not wipe the misconfiguration):
- Supabase: NEW PROJECT (not a wipe). Policies, triggers, auth config, and
  storage bucket policies live outside the tables — a wiped project can
  still carry the exact bug that leaked user data across accounts. A fresh
  project takes minutes, costs one key-paste, guarantees zero carryover.
  Schema + RLS are regenerated from OUR specs with tests.
- R2: KEEP Cloudflare account credentials (they carry), create NEW buckets.
- Stripe: KEEP account + keys (no real customers ever existed -> live ledger
  empty), one-click "delete all test data", create fresh products/webhooks.
- Vercel: keep account; new project for KripTik; old projects retired after
  harvest.
- OAuth (Google/GitHub): carry as-is (provider-console config already
  correct); ADD new redirect URIs for the new domains at SHIP-BRAND.
- Founder acquires NEW: Cerebras, Fireworks, DeepInfra, Groq keys + a
  read-only GitHub App (for W-IMPORT).

## AMENDMENT 2 — 2026-07-06 08:15 — CUTOVER DOCTRINE REVISED (founder direction, verified better)
FOUNDER IS RIGHT: keep the existing Vercel project `kriptik-ai-opus-build`
(holds kriptik.app + *.kriptik.app, all env vars) and REPOINT its Git source
to the new KripTik repo. Supersedes Amendment 1's "new Vercel project."
Fresh-verified 2026-07-06 (Vercel docs): connecting a project to a different
GitHub repo is a supported Settings > Git operation; env vars, domains, and
settings belong to the PROJECT, not the repo.
WHY BETTER: (1) Sensitive-marked env vars are unreadable/unharvestable — in
a kept project they simply keep WORKING; a new project would force console
re-copies. (2) Domain + DNS continuity, zero propagation risk. (3) Fewer
moving parts at cutover.

SHIP-BRAND CUTOVER CHECKLIST (in order):
1. AUDIT project settings BEFORE repoint: framework preset is currently
   "vite" -> must become Next.js; root directory -> new app path; build/
   install commands; disable any crons; review integrations — ESPECIALLY a
   Supabase marketplace integration if present (it manages SUPABASE_* vars
   pointed at the poisoned project; unlink or re-link to the fresh project).
2. Settings > Git: disconnect old repo -> connect new KripTik repo.
3. Deploy to PREVIEW first; full smoke test on preview URL; then promote to
   production (kriptik.app flips only at promotion).
4. UPDATE (not reuse) project-scoped values in place: Supabase URL + keys
   (fresh project — Supabase keys ARE the pointer to the old poisoned
   project; account-scoped creds like Stripe/Cloudflare/Modal/Nango/Google/
   GH/Resend carry), new R2 bucket names, new Stripe webhook secret.
5. ADD: Cerebras, Fireworks, DeepInfra, Groq, GitHub App creds. Mark all
   secrets Sensitive going forward (April 2026 incident doctrine).
6. DELETE old broken deployments (immutable *.vercel.app URLs stay reachable
   otherwise); rotate all pre-existing secrets at provider consoles and
   update values in place.
7. Harvest opus-build-backend's env vars into the main project as needed;
   retire that project (engine lives on Cloudflare/Modal per spec).
8. Delete/archive the old repo LAST, after production is verified green.
