# SHELL W-1A — ACCOUNTS & TENANCY — RUN REPORT

**Branch:** `codex/prism-recovery-harness-20260630`
**Implementation commit:** `d25e53b8`
**Date:** 2026-07-04
**Status:** `PRISM-SHELL-W1A: RUN COMPLETE` — dual judges PASS, 0 MUST-FIX (round 1).
**Discipline:** Additive only. Evidence law. Deviations logged BEFORE code.

Better Auth is the ONE auth system (I2, `sameSite:'lax'`). No secrets client-side
(I5). Canvas `/` untouched (FP7). Contract-first: Zod schemas before routes (I4).
This wave was a **finish pass** — a prior session had built the W1A slice but left
it uncommitted with no report and no judges; this session audited it end-to-end,
re-ran every gate, independently re-drove the flow headless, then committed,
judged, and finalized.

---

## 1. Tasks → evidence

| # | Task | Delivered | Primary evidence |
|---|------|-----------|------------------|
| 1 | Better Auth: Google + GitHub one-click + sessions; auth screens under DESIGN LAW | `src/server/auth/auth.ts` (both social providers mount only when both env vars present; email/password always-on; `planTier` E6 stub `input:false`; `sameSite:'lax'` pinned). Screens: `sign-in/page.tsx`, `sign-up/page.tsx`, `components/shell/auth/{AuthScreen,AuthObjectRow}.tsx` + `auth.css` — 3 provider actions are REAL rendered 3D objects on ONE shared ortho canvas (DL11/DL12/DL14, premium-materials canon), dark-first, Fraunces×JBM (DL3) | `verification/shell-w1a/desktop/01-signin-cold.png`, `.../04-signup-cold.png`, fresh `finish-2026-07-04/desktop-01-signin.png` |
| 2 | Contract-first schema (tRPC+Zod): user, org (enterprise stub), project, projectVersion (E1 pointer), planTier (E6) — additive `prism-` types | `packages/shared-interfaces/src/prism-tenancy.ts` (+ `index.ts` export). Every request schema is `.strict()` and OWNER-FREE — cross-tenant is inexpressible | `tests/unit/prism-tenancy-contract.test.ts` (16/16) |
| 3 | Per-tenant storage keyed by tenant | `src/server/tenancy/tenant-store.ts` — projects/graphs/versions/assets under `.data/tenancy/tenants/<tenantId>/`; id-grammar refuses traversal; resolved paths re-checked inside root; not-owned == not-found. Assets are content-addressed binaries on guarded REST routes (`src/app/api/tenant/assets/**`) | `tests/unit/tenant-store.test.ts` (5/5) + isolation probe |
| 4 | I11 isolation probe (CI): two seeded users; every route owner-only; cross-tenant fails closed; wired into `npm run verify` | `scripts/verify-tenant-isolation.mjs` — hermetic two-user HTTP probe: **26/26 GREEN** | probe output §3; wired as `verify:tenancy` in `package.json` |
| 5 | Route guards: /app/* requires session; signed-out → sign-in; post-auth → dashboard placeholder | `src/middleware.ts` (optimistic cookie edge check), `src/app/app/layout.tsx` (real server-side getSession), `src/app/app/page.tsx` + `components/shell/dashboard/DashboardShell.tsx`. `agent.chat` moved public→protected (builds are tenant data) | `verification/shell-w1a/desktop/06-dashboard-first-run.png`, `.../09-signout-guard-redirect.png`, fresh `finish-2026-07-04/desktop-06-signout-guard.png` |

---

## 2. Gate table (all GREEN — judges independently re-ran these)

| Gate | Result | How measured |
|------|--------|--------------|
| `tsc --noEmit` 0-new | **9 = 9 baseline** (0 in any W1A file) | pre-existing errors are GraphScene GLProps + 8 editor-build/integration `NodeContext.THREE`; none touch W1A |
| Unit tests | **320/320** (incl. 21 new: 16 contract + 5 store) | `vitest run tests/unit` |
| `npm run verify` (full chain) | **exit 0** | prism + repair-loop + galaxy + global-shell + parity-static + schema + tenancy |
| `verify:schema` | **338/338 nodes** self-describing | schema-completeness-gate |
| `verify:tenancy` (I11) | **26/26** | hermetic two-user probe (§3) |
| DL sweep (auth/dashboard surfaces) | **CLEAN** | 0 backdrop-filter/gradient-as-material/box-shadow-depth-fake as premium look; 0 icon packs; 0 emoji; premium look is rendered 3D |
| Secrets client-side (I5) | **CLEAN** | 0 `process.env`/`*_SECRET`/`clientSecret` in any `'use client'` file; `server-only` on all 4 secret-touching modules; `.data/` gitignored, nothing tracked |
| Canvas `/` + existing routes (FP7) | **UNTOUCHED** | diff touches 0 of `src/app/page.tsx`, `src/components/editor/**`, `src/lib/prism/**`, `prism-graph` types |
| Perf (DL8) desktop + mobile | **60fps both**, 1 shared canvas/surface, 0 console errors | `finish-2026-07-04/metrics.json` |

---

## 3. I11 isolation probe — 26/26 GREEN

Boots its own hermetic `next dev` on a private port against throwaway
`PRISM_AUTH_DB` / `PRISM_TENANCY_DIR`, seeds two REAL Better Auth users, and
sweeps every tenant-data route with (a) owner, (b) the other tenant, (c) no
session:

```
anon.app-redirect       anonymous /app → 307 /sign-in?next=%2Fapp
anon.project.list       UNAUTHORIZED     anon.agent.chat  UNAUTHORIZED
anon.asset.post         401
seed.signup (x2 200)    seed.plan-tier (free, never client-set)   seed.signin
owner.project.create / graph.save / version.create / asset.put / asset.get / graph.get   all OK
cross.tenancy.project.get / rename / setModelOverride / graph.get / graph.save / version.list / version.create   all NOT_FOUND
cross.project.list      B sees ONLY B (empty)
cross.asset.get 404     cross.asset.post 404     cross.no-corruption
wall.traversal-id       BAD_REQUEST      wall.owner-smuggle  REJECTED (.strict())
→ 26/26 · TENANT ISOLATION GREEN (I11)
```

Not-owned and non-existent are the **same** observable outcome — a cross-tenant
probe learns nothing, not even existence.

---

## 4. Headless flow proof (fresh finish-pass, `finish-2026-07-04/`)

Independently re-drove the whole flow against the committed working tree with
Chrome DevTools MCP (hermetic `.data`), 0 console errors on every surface:

1. `desktop-01-signin` — cold sign-in; Google/GitHub powered-down "AWAITING KEYS", Email live red jewel.
2. `desktop-02-signup-filled` — real create-account form filled.
3. `desktop-03-dashboard-firstrun` — landed on `/app`, header `Prism Founder · founder-w1a@prism.test · FREE` (planTier server-set), empty PROJECTS.
4. `desktop-04-create-lands-in-builder` — created "Founder Atelier" → `/app/builder/proj-0497cd1f…`, builder titled with the **real tenant project name**.
5. `desktop-05-dashboard-with-project` — project persisted in PROJECTS with real id + timestamp.
6. `desktop-06-signout-guard` — SIGN OUT → `/sign-in`; direct nav to `/app` while signed out → `307 /sign-in?next=%2Fapp`.
7. `desktop-07-canvas-unbroken` — ORRERY "Time, machined." `/` scene fully intact.
8. `mobile-01-signin` / `mobile-02-dashboard` (390×844@2) — 3-column provider row (no wrap/overflow), objects crisp, tenant data survives sign-out/in.

Perf (`metrics.json`): mobile sign-in 3 objects **60fps / 78MB / 1 canvas**;
desktop dashboard **60fps / 83MB / 1 canvas**; desktop sign-in 3 objects
**60fps / 85MB / 1 canvas**. DL8 rider honored — one shared GL context per
surface, never per-button.

The original prior-session frames (`desktop/01–10`, `mobile/01–04`) are retained;
they additionally show two-tenant isolation on mobile (`mobile/03` Gamma vs
`mobile/04` Alpha see different project lists).

---

## 5. FOUNDER ACTION — OAuth env vars to go live

W1A-D3: this repo's env has **no** Google/GitHub OAuth app credentials, so per
the wave prompt Better Auth is wired fully for both providers against placeholder
env names and the flow is proven on the email/password dev path. To light up the
one-click social buttons (they currently render honestly as **"AWAITING KEYS"**),
set these and restart:

| Env var | Purpose | Where to get it |
|---------|---------|-----------------|
| `GOOGLE_CLIENT_ID` | Google one-click | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (Web) |
| `GOOGLE_CLIENT_SECRET` | ″ | same OAuth client |
| `GITHUB_CLIENT_ID` | GitHub one-click | GitHub → Settings → Developer settings → OAuth Apps → New |
| `GITHUB_CLIENT_SECRET` | ″ | same OAuth app (generate a client secret) |
| `BETTER_AUTH_SECRET` | Session-cookie signing secret (REQUIRED in prod) | generate: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public base URL, e.g. `https://app.prism.example` (dev infers from request) | your deploy origin |

**Authorized redirect / callback URLs** to register in each provider console
(replace origin with `BETTER_AUTH_URL`, or `http://localhost:3000` in dev):
- Google: `{origin}/api/auth/callback/google`
- GitHub: `{origin}/api/auth/callback/github`

A provider button auto-activates the moment BOTH of its env vars are present —
no code change. Setting the vars requires no migration (auth schema
self-provisions on first touch).

**Production storage swap (W1A-D1/D2, config-only):** hand Better Auth a
Postgres/Supabase connection through the same `database:` option in `auth.ts`,
and repoint the tenant-store fs calls at Supabase/R2 behind their unchanged
tenant-key-first signatures. No call site or isolation surface changes.

---

## 6. Deviations (logged BEFORE code — `docs/spec-deviations-prism.md` §W1A)

- **W1A-D1** — Auth DB = Node 22 `node:sqlite` file under gitignored `.data/`, not a hosted DB. Matches the repo's established local-store precedent (`snippets/store.ts`); zero new native deps; prod swap = config-only.
- **W1A-D2** — Per-tenant storage = tenant-keyed server-only file store under `.data/tenancy/`, same shape as `assets/store.ts` + `secrets/vault.ts`. Owner id always from the server session; isolation enforced at the data layer regardless of backing store.
- **W1A-D3** — OAuth providers built against placeholder env names (no creds in env); email/password path proves the flow headless; exact env var list in §5.

No formal spec-invariant deviations.

---

## 7. Should-fix ledger (all non-blocking; judges raised, deferred with rationale)

| Item | Raised by | Decision |
|------|-----------|----------|
| `tenant-store.serialized()` per-tenant promise chain retains a settled-rejected state at high concurrency; recommended long-term fix is an explicit queue | criteria-reviewer (NIT) | **Defer.** Reviewer: "Not a correctness bug today"; the chain self-heals (next op runs via the reject handler) and every caller awaits the returned promise. A real DB owns transactions in the D1/D2 swap. Changing it now is a refactor, not a one-liner. |
| Dashboard resolves the session twice (layout guard + page identity) | criteria-reviewer (NIT) | **Defer to W4.** Deliberate belt-and-braces (both fail closed); cheap; W4's real S3 dashboard can thread one resolve down. |
| "CREATE" label ~1–2px kisses the jewel pedestal on the dashboard card | user-advocate (nice-to-have) | **Defer to W4.** Advocate: "pure taste, not a defect." This dashboard is an explicit W4-superseded placeholder; a fix would also re-open the just-validated evidence frames for a throwaway surface. |

---

## 8. Judge verdicts (round 1 — both PASS, 0 MUST-FIX)

**prism-criteria-reviewer → `pass`, MUST-FIX: NONE.** Independently re-ran tsc
(9=9), `verify:tenancy` (26/26 against a real booted server), the 21 unit tests,
`verify:schema` (338/338); confirmed I2 (Better Auth only, `sameSite:'lax'`
pinned), I5 (no client-side secrets, `server-only` on all secret modules, `.data/`
gitignored), I4 (`.strict()` owner-free schemas, `protectedProcedure` the sole
door), FP7 (canvas + editor + runtime untouched), additive-only, and a clean DL
sweep (primary actions are genuine rendered 3D objects, not CSS). Deviations
D1–D3 well-reasoned and logged before code.

**user-advocate → net PLEASED, gate PASS, 0 MUST-FIX.** Judged from the pixels
as a non-technical user: signup→dashboard→builder→persist→signout-guard reads as
"real, complete, on-brand"; screens are "genuinely premium-2026" (true-black,
red/black/white, neo-serif display + monospace utility); the provider actions are
"actual rendered 3D forms (faceted Google orb, floating GitHub cube, octahedral
red email jewel on metallic pedestals) — not CSS, not an icon pack, no
glassmorphism, no purple AI-slop"; OAuth "AWAITING KEYS" is honest; mobile parity
real with no overflow; canvas `/` unbroken; and per-tenant isolation is visible
across two accounts. Single flag is the cosmetic label-kiss (§7).

---

## 9. Readiness for later waves

- **W1B / W2 (Intake):** account context is live — `tenancy.me`, `project.*`,
  `graph.*`, `version.*` procedures and the guarded asset routes are the tenant
  data surface the intake/build flow writes through. `agent.chat` is now
  session-guarded, so build turns already carry the tenant wall.
- **W4 (Dashboard, S3):** replaces the `DashboardShell` placeholder. The schema
  (`prismProject`, `prismProjectVersion`, `prismOrg`) and the `listProjects`
  server surface are ready; W4 owns the two deferred dashboard nits (§7).
- **W5 (Conductor/Deploy, E1 timeline):** `projectVersion` snapshot pointers and
  `version.create/list` are in place for the checkpoint/restore UI; builds persist
  as tenant data.
- **W7 (Collab/Settings):** `prismOrg` (enterprise-tier stub, `memberUserIds`)
  and `planTier` (E6) are schema-ready for org sharing + billing flips; the tier
  is server-owned (`input:false`), never client-assignable.

---

`PRISM-SHELL-W1A: RUN COMPLETE`
