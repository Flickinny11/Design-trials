# SHELL W-3 — Integrations + GitHub (Nango spine) — RUN REPORT

**Branch:** `codex/prism-recovery-harness-20260630`
**Status marker:** `PRISM-SHELL-W3: RUN COMPLETE`
**Date:** 2026-07-04

Governing: Spec §8 (I5, I7), §10 (S6 + C-rider), §12 (W3) · DECISIONS B
(Nango SOLO) + C rider (connect-anything LEADS) · ENHANCEMENTS E5 · DESIGN LAW
DL2/DL3/DL7/DL8/DL10/DL15 · V-STANDARD · NEAR-HUMAN-QA.

## Commits (this wave, additive)

| # | Commit | Slice |
|---|--------|-------|
| 1 | `1751840a` | Contract (`prism-integrations.ts`) + curated head catalog + W2 intake tiles bound to catalog |
| 2 | `c8ff3bc5` | Server: DNS-rebind-hardened `safe-fetch` (+wired into `seedFromUrl`), GitHub App adapter, per-tenant integration store |
| 3 | `32096466` | Integrations tRPC router (mounted on appRouter) |
| 4 | `37de1cc0` | `/app/integrations` surface (search-leads, hero, catalog, Connect modal, mgmt, GitHub, E5) + builder tab + dashboard nav |
| 5 | `2d42c036` | a11y — decorative brand marks aria-hidden beside text labels |

## Tasks → evidence

1. **Integrations surface; connect-anything search LEADS (C rider).** `/app/integrations`
   (`IntegrationsShell`); `ConnectAnythingSearch` is the first control below the hero.
   Search HIT → catalog tiles (one-click). Search MISS → the agent-authored-connector
   request path renders inline (request UI + `integrations.requestConnector` → server
   queue record). Evidence: `verification/shell-w3/01/02` (surface), connector queue
   proven with "Acme CRM · QUEUED".
2. **White-label Nango Connect UI + connected-account mgmt.** `NangoConnectModal` —
   Prism-branded ("authorize **with Prism**"), method + scope review up front, yields a
   capability reference. `ConnectedAccounts` — re-auth, revoke, scope chips. Evidence:
   `03-nango-connect-modal.png`; revoke behaviorally swept the connection **and** its
   project binding.
3. **Curated head catalog (~12 tiles, config-driven).** `src/lib/shell/integrations/catalog.ts`
   — 12 tiles across Payments/Comms/Data/Social. Sandbox-connected Stripe end-to-end
   headlessly → `cap_stripe_oauth2.1_1s2pg3` (`04-connected-and-e5-bound.png`).
4. **GitHub App.** `github-app.ts` (sandbox-first) + `GithubPanel` — install (sandbox),
   installation/repo selection, import-repo (wired to intake's GitHub card contract),
   and the **PR-based edit path** contract (branch off base, per-action confirm on
   irreversible steps, `forcePush: false`). Evidence: `05-github-pr-path.png` — branch
   `prism/edit-7c10de66` off main, CONFIRM/IRREVERSIBLE tags, "Force-push: never (I7)".
5. **E5 per-app env/capability panel.** `EnvCapabilityPanel` — bound capability refs,
   scope review, and env var **NAMES** (`STRIPE_SECRET_KEY`…) — never values. Values
   resolve server-side via the vault (references only). Evidence: `08-e5-env-capability-panel.png`
   (clean frame: ref `cap_stripe_oauth2.1_1s2pg3`, SCOPES, ENV KEYS names only) +
   `07-full-surface-connected-e5.png` + network scan.
6. **Intake tiles bind to catalog.** `intake-model.ts` connect-card options are derived
   from `intakeHeadTiles()` (no parallel list). `/app/build` verified rendering with 0
   console errors after the binding.

## Gate results

| Gate | Result |
|---|---|
| Headless: search HIT → one-click sandbox connect → capability ref in project | **PASS** — `04-connected-and-e5-bound.png`; ref `cap_stripe_oauth2.1_1s2pg3` bound in E5 |
| Headless: search MISS → request path recorded | **PASS** — "Acme CRM · Sync contacts and deals two-way · QUEUED" |
| GitHub PR-based prod-edit path | **PASS** — `05-github-pr-path.png`; branch+PR, no force-push, per-action confirm |
| Secret-scan: zero leakage | **PASS** — network `secretFieldHits:[]`, `longTokenHits:[]`; on-disk = refs only; source has no raw-secret assignment |
| DNS-rebind fetch hardening (W2 deferral) | **PASS** — `localtest.me`→127.0.0.1 blocked (literal denylist would miss it); loopback + `169.254.169.254` blocked |
| S6 checklist | **GREEN** (below) |
| DL sweep | **GREEN** (below) |
| tsc 0-new | **PASS** — 9 = 9 baseline (pre-existing GraphScene GLProps + editor-build test `NodeContext.THREE`) |
| `npm run verify` (full) incl `verify:tenancy` | **PASS** — EXIT 0; tenancy **26/26 GREEN (I11)** |
| Console errors on surface | **PASS** — 0 errors (2 pre-existing runtime warns: coderef dynamic-dep, THREE.Clock deprecation) |

## S6 per-surface checklist (§10)

- [x] Connect UI white-labeled in the Prism design system (authorizes against Prism brand)
      — `NangoConnectModal`, Prism-branded, no third-party screen, no shell credential field.
- [x] Only capability references stored; re-auth, revoke, scope-review present — proven behaviorally.
- [x] GitHub production-app edits go via branch + PR; no force-push; irreversible actions
      confirmed per-action — `prEditPlan` (`forcePush: false`, per-step `requiresConfirm`).
- [x] On-demand connector request path for catalog misses **[C RIDER: connect-anything
      LEADS]** — search input leads the surface; a miss flows straight into the request path.

## DESIGN LAW sweep

- **DL2** RED/BLACK/WHITE identity — surface uses `--pp-*` tokens + brass/champagne warmth + signal-red accents.
- **DL3** Fraunces × JetBrains Mono, no grotesques — via `shellDisplay`/`shellMono`.
- **DL7** crisp 1px machined hairlines, exact geometry radii, weight-curve motion (no linear).
- **DL8** one shared 3D canvas per surface — the single hero showpiece; working surfaces are 2D.
- **DL10** materiality discipline — worn-metal 3D reserved for the hero moment; catalog/mgmt/GitHub/E5 are clean-but-premium.
- **DL15** REAL brand marks only (2D glyphs/monograms from `brand-assets.ts` + bespoke 3D forms in the hero) — no stock icons, no fakes.
- Reduced-motion honored (hero holds still; animations disabled); responsive to 390px and 380px.

## I5 secret discipline — evidence

- Contract `capabilityRefSchema` is `.strict()` and enumerates ONLY non-secret fields.
- Network payloads (connect / connections / capabilities): no `access_token`/`client_secret`/
  `api_key`/`password`/`private_key` value fields; no `sk_live_`/`ghp_`/`xoxb-`/`AKIA` strings.
- On-disk `.data/tenancy/.../integrations.json`: capability references only
  (`refId`/`scope`/`provider`), no secret material.
- Env panel shows env var **NAMES** only; values live in `src/server/secrets/vault.ts`.

## Deviations

None formal. Two architectural notes (within existing patterns, not spec deviations):

- **W3-N1** Integration persistence was added to `src/server/tenancy/tenant-store.ts` (a new
  "Integrations" section) rather than a separate store module, so every tenant path flows
  through the SAME four isolation walls (`insideTenant`/`safeId`/`serialized`/fail-closed) —
  keeping I11 enforcement in one audited module. The tenancy probe (26/26) covers it.
- **W3-N2** Sandbox-first parity with the Nango adapter: offline, one-click connect yields a
  capability reference via the MCP reference adapter (real-provider sandbox) or a router-built
  sandbox ref for head tiles the offline adapter doesn't model. `provider.live` is false without
  `NANGO_SECRET_KEY`; the shape is identical when keyed (no UI rework). GitHub is sandbox-first
  the same way.

## Founder action — env vars to go live (all optional; sandbox works without them)

**Nango (decision B spine):**
- `NANGO_SECRET_KEY` — the Nango account secret (server-only).
- `NANGO_HOST` — only for a self-hosted Nango.
- `PRISM_CAPABILITY_PROVIDER=nango` — select the Nango adapter (falls back to MCP sandbox if unset/unkeyed).
- `npm i @nangohq/node` — install the SDK (optional dep; absent = offline sandbox).

**GitHub App (I7 PR path):**
- `GITHUB_APP_SLUG` — the App's URL slug (→ real install URL).
- `GITHUB_APP_ID` — numeric App id.
- `GITHUB_APP_PRIVATE_KEY` — PEM; signs installation-token requests (server-only).
- `GITHUB_APP_CLIENT_ID` / `GITHUB_APP_CLIENT_SECRET` — user OAuth for installation selection.

Without any of the above the surface runs a deterministic sandbox end-to-end (verified here).

## Should-fix ledger (non-blocking)

- Live install/repo enumeration (Octokit App auth) and the real Nango hosted-flow completion
  callback are the production swaps behind the sandbox — out of scope for this gate (they need
  founder keys), interfaces are in place.
- `undici` connection-level DNS pinning in `safe-fetch` is best-effort via `optionalImport`;
  the resolve-and-check defense (which closes the W2 rebind gap) is unconditional. Production
  should confirm the pinned dispatcher is active.
- Grammar nit: "Request a **Acme CRM** connector" (a/an) — dynamic string; cosmetic.

## Dual judges — both PASS 0 MUST-FIX (round 1)

- **prism-criteria-reviewer** (fresh-context, diff + criteria): `VERDICT: PASS 0 MUST-FIX`.
  Graded all 10 W3 requirements MET with file:line evidence (contract `.strict()` + owner-free;
  `toWireRef` hand-picks non-secret fields so a rogue adapter token is dropped before parse;
  search LEADS above catalog; PR path `forcePush:false`; E5 names-only; intake bound to catalog;
  safe-fetch refuse-if-any + hop re-validation; I11 walls; zero canvas/engine touches; zero new
  WebSocket/polling). Should-fixes (non-blocking): modal focus trap, safe-fetch TOCTOU (documented),
  scope-map client/server duplication.
- **user-advocate** (fresh-context, evidence-only): `PLEASED — 0 MUST-FIX blockers`. Confirmed the
  connect-anything search LEADS, the white-label Connect modal authorizes "with Prism" with up-front
  scopes, catalog-miss queues, and the GitHub PR path conveys branch+PR safety. Flagged that the E5
  panel was occluded by the modal in `04` (an evidence-capture gap, not a defect) + the a/an nit.

**Round-1 follow-ups taken (all three cheap should-fixes):** (1) modal now has a full Tab focus
trap (`NangoConnectModal`); (2) a/an article fixed ("Request an Acme CRM connector"); (3) recaptured
clean, modal-dismissed frames `07`/`08` that show Connected accounts + the E5 env-key-names panel in
pixels — closing the advocate's evidence flag. Commit `2d42c036` (a11y) + the follow-up polish commit.

## W4 readiness

W4 (Dashboard) can surface per-project integration counts from `integrations.project.capabilities`
and deep-link the launchpad into `/app/integrations?project=<id>`. The catalog contract
(`prism-integrations.ts`) and the tenant-keyed store are the stable seams W4/W5 extend.
