# SHELL W5B — SHIP ANYWHERE (E15–E20) — RUN REPORT

**Branch:** `codex/prism-recovery-harness-20260630` · **Commits:** `6219bae4`
(deviations, BEFORE code) → `42a1f3ee` (E15) → `68a45fa5` (E16) → `560fae87`
(E17) → `7a3c5931` (E19) → `cf77eff0` (E18) → `7e3b74e6` (E20) → `cbe930b6`
(§14.1 gate test) → `f1de4886` (frames) → `d1c27f6d` (advocate follow-up) →
report.
**Gate:** spec §14.1 (W5B). Runs AFTER the W1–W8 chain completed (all green).
**Governing:** ENHANCEMENTS E15–E20 (founder anchors) · DECISIONS (ship-anywhere
record) · W5 report (DeployTarget seam) · V-STANDARD · DL1–DL15.

## What shipped

W5B makes a built Prism app **shippable anywhere** — to many frontend and
backend/GPU hosts, with a real post-ship verification, an in-platform domain
flow, a "make it profitable" completeness scan, live host recommendations, and
a managed-care stub. Everything env-gated builds fully in dry-run/sandbox and
lists exact env var NAMES; no raw secret ever leaves the server (I5); nothing
blocks on a missing key, and no dry-run is ever labeled "live".

### E15 — Host adapters + post-ship verification (§11.2)
`src/server/deploy/*`. The `DeployTarget` registry (W5 seam) is extended so the
Conductor **reads a host's requirements** (`buildHostRequirements` → config
artifacts + generated config + `requiredEnv` NAMES + the post-ship check type),
**generates that host's config**, **deploys**, and then **verifies the shipped
artifact** (`post-ship-verify.ts`, §11.2):
- **frontend** (`http-reachable`) — the shipped preview resolves to its pinned
  snapshot (a real round-trip through the token-guarded `/preview` route); a
  live external host's `productionUrl` is probed by a real HTTP GET.
- **backend/GPU** (`inference-roundtrip`) — the deployed model endpoint answers
  a **REAL inference call**. A backend deploy mints a token-guarded endpoint
  (`/api/prism/model/[deployId]`) backed in dry-run by a deterministic
  open-source reference model (`reference-model.ts`, a DistilBERT-SST2 /
  MiniLM-class stand-in); the latch sends the contract's fixture and validates
  the response shape. A live host token would proxy to the real model.
The post-ship result becomes the §11 latch's `deploy` check (surfaced in chat,
E4). Deploy record gains additive `postShip`, `endpointUrl`, `inferenceContract`.

### E16 — Domains in-platform (Entri Sell/Connect/Monitor + registrar seams)
`src/server/domains/*` + `prism-domains.ts`. A typed `DomainProvider` registry:
`entri` (default spine) + `vercel-registrar` + `cloudflare-registrar` (config
alternates). Flow: **search availability + pricing** → **in-UI purchase modal**
(`DomainPurchaseModal`) → **Connect auto-DNS** (generated DNS records written to
the deploy) → **Monitor webhook** (`/api/prism/domains/webhook`, HMAC-verified,
resolves the deploy via a global index, flips `domainStatus`). Absent vendor
keys everything runs **sandbox** (deterministic, source-cited, no charge, no
real registration); the webhook fixture is signed with a documented sandbox
secret. Bad signatures rejected; 202-always (no existence leak).

### E17 — "Ship & Make Profitable" completeness scan
`src/server/conductor/{completeness-scan,capability-authoring,ship-flow}.ts`.
The SHIP entry (and any NL "ship / make profitable" message, `isShipIntent`)
runs a **completeness scan** of the app graph across the 7 founder categories
(auth · db · storage · payments · subscriptions · email · analytics). Presence
is judged on STRONG signals only (a capability reference / integration binding /
backend ref / an authored capability node) — a "Pricing" section title does NOT
make payments present. Missing capabilities render as **one-click cards IN the
streaming chat** (an additive `'cards'` ChatSegment, bound to the W3 catalog).
Accepting a card has the Conductor **author the capability's nodes through the
certified node path** (`authorNode` + `sanitizeAdditive` + `applyPlanRendererDefaults`
+ `validatePlanRendererFields`) with a real capability REFERENCE (I5), then
**re-verify** the §11 latch and re-scan. (Added a PostHog analytics tile to the
W3 catalog so `analytics` has a real provider.)

### E18 — Host recommendations + live pricing
`src/server/deploy/pricing.ts`. On ship, the flow **recommends** frontend hosts
always and backend hosts **only when the graph has GPU nodes** (E19), ranked by
fit for what was built. Pricing is **fetched at run time** with a **≤24h cache**;
each price cites its **source + freshness** (`live` / `cached` / `static`) so a
cached/sandbox price is never presented as live. Absent a live feed
(`PRISM_PRICING_FEED_URL`) a dated, source-cited static table is used and
labeled `static`. Rendered in the ShipTab recommendations strip.

### E19 — Backend/GPU nodes → adapters
`src/server/deploy/backend-nodes.ts`. The **node→target mapping contract**: a
node is backend when it has a `backendRef`, a `backend-`/`model-` subtype, or a
`model:*` capability scope; each backend node class (text-classifier /
text-embedder / text-generator / image-model / workflow) maps to its eligible
GPU/serverless targets (modal/runpod/vast), a default target, an inference
contract, and a generated host config. `conductor.backendMap` exposes it;
`recommendHosts` and the E15 deploy both read it. A backend node authored
through the certified path (`addBackendNodeToGraph`) deploys to its default
target and is verified by the latch's inference round-trip.

### E20 — Managed-care tier stub
`src/server/care/*` + `prism-care.ts`. An honest stub: the care tier **gates on
`planTier`** (pro/enterprise), arms a **scheduled post-deploy check scaffold**
(health / self-heal / optimization) that reuses the **node-agent self-heal
seam** (`node-agent:self-heal`), and shows a **pricing stub**. Checks are
`flagged` until monitoring keys (`PRISM_CARE_MONITOR_KEY`) exist — live agents do
not run against a user's shipped app in v1. The **free path is always on**: any
user can prompt their own fixes through the normal node-agent. Persisted per
project (`care-config.json`); `care` tRPC router.

## Gate evidence (spec §14.1)

| Gate item | Result |
|---|---|
| Fixture app ships to ≥2 targets (≥1 backend), post-ship verification green | **PASS** — the `§14.1 GATE` headless test ships to `vercel` (frontend) + `runpod` (backend) with both `postShip.status === 'pass'`; the browser frames deploy `prism-cloud` + `modal` (backend) verified. |
| Backend adapter deploys an OSS model endpoint + latch validates a REAL inference round-trip | **PASS** — `modal`/`runpod` deploy → token-guarded `/api/prism/model/[id]` endpoint → `runReferenceInference` round-trip validated against the contract (dry-run, labeled dry-run). |
| Vercel path end-to-end (live-or-dryrun) | **PASS (dry-run)** — Vercel deploy generates `vercel.json`/`next.config.js` config + post-ship reachability green; live push is the documented remaining seam (see follow-ups). |
| Domain flow proven sandbox | **PASS** — search → purchase (sandbox order + auto-DNS) → signed Monitor webhook flips `domainStatus` to verified; bad signature rejected. Frame `03-domain-modal.png`. |
| Completeness scan adds a capability end-to-end | **PASS** — fixture missing payments → scan offers a Stripe card → accept authors schema-complete `capability-payments` node (real capability ref) → latch green → re-scan shows payments present. |
| All frames both viewports | **PASS** — `notes/verification/shell-w5b/` desktop (01, 01a panel, 01b backend, 01c care, 02 cards, 03 domain) + mobile (04). `frames-summary.json`: builtBadge=true, hosts=7, recs=2, care=true, cards=7, domainResults=5. |
| DL sweep | **Clean** — no purple, no emoji/icon-packs, no hardcoded model strings in components (model ids live server-side only), `--pp-*` tokens; brand chips are material glass tokens. |
| tsc 0-new | **9 = 9** baseline (pre-existing errors only). |
| full verify + tenancy | **EXIT 0** — verify:prism 14/14 · galaxy 7/7 · global-shell 6/6 · parity 6/6 · schema 338/338 · **tenancy 35/35** · share-matrix 30/30 · collab 15/15. |
| Headless W5B suite | **11/11 pass** (`tests/unit/shell-w5b-ship-anywhere.test.ts`): E15×3, E16×2, E17×2, E18, E19, E20, §14.1 gate. |
| Dual fresh-context judges 0 MUST-FIX | **PASS** — `prism-criteria-reviewer`: **PASS, 0 MUST-FIX** (all E15–E20 met by real/typed/used code, I5/I10/I11 hold, deviations-before-code confirmed; 3 non-blocking nits). `user-advocate` (after re-review of the new evidence): **PLEASED / PASS, 0 MUST-FIX** — all 5 claims pass on cited frames (it read `01c-managed-care.png` + re-measured the material chip directly); the earlier evidence-gap MUST-FIX is resolved. |

## Deviations (recorded BEFORE code — `docs/spec-deviations-prism.md` §W5B)
- **W5B-D1** Post-ship verification runs through an injectable fetch seam; in
  dry-run it targets this app's own token-guarded routes (a real round-trip).
- **W5B-D2** A backend deploy's "model endpoint" is a deterministic OSS
  reference model in dry-run; the latch validates a REAL inference round-trip.
- **W5B-D3** Domains run through a typed `DomainProvider` registry; availability,
  pricing, purchase, auto-DNS are deterministic + sandboxed until vendor keys.
- **W5B-D4** E17 cards ride an additive `'cards'` ChatSegment; the scan +
  capability authoring reuse the Conductor's certified node path.
- **W5B-D5** E18 pricing is fetched at run time with a ≤24h cache + cited source;
  the fallback is a dated, source-cited static table labeled `static`.
- **W5B-D6** E20 managed-care is a tier-gated stub; scheduled checks reuse the
  node-agent self-heal seam; live monitoring agents flagged post-testing-keys.

## Environment variables (founder must set to go live; W5B does NOT block on any)

**Frontend hosts (E15):**
- Vercel — `VERCEL_TOKEN`
- Netlify — `NETLIFY_AUTH_TOKEN`
- Cloudflare — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Prism Cloud — none (always live; served by this app)

**Backend / GPU hosts (E15 · E19):**
- Modal — `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`
- RunPod — `RUNPOD_API_KEY`
- Vast.ai — `VAST_API_KEY`

**Domains (E16):**
- Entri (Sell/Connect/Monitor) — `ENTRI_APPLICATION_ID`, `ENTRI_SECRET`
- Entri Monitor webhook HMAC — `ENTRI_WEBHOOK_SECRET` (sandbox uses a documented
  fixture secret)
- Vercel Domains Registrar — `VERCEL_TOKEN` (reused)
- Cloudflare Registrar — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (reused)

**Pricing (E18):**
- `PRISM_PRICING_FEED_URL` — optional live pricing feed; absent → dated static
  table labeled `static`.

**Managed care (E20):**
- `PRISM_CARE_MONITOR_KEY` — enables live monitoring agents; absent → scheduled
  checks are `flagged` (armed, not running live).

**Conductor / storage (carried from W5):**
- `ANTHROPIC_API_KEY` (+ optional `PRISM_CONDUCTOR_MODEL`) — live planner;
  absent → deterministic dry-run planner.
- `PRISM_TENANCY_DIR`, `PRISM_PREVIEW_TOKENS_DIR`, `PRISM_DOMAIN_INDEX_DIR` —
  dev storage paths (default under `.data/`; swap for KV/DB behind the same
  surface).

## Follow-ups (non-blocking, logged)
- **Live host-adapter push (E15 seam).** In `live` mode (host token present) the
  deploy record's `productionUrl` is still `null` — the real push to
  Vercel/Modal/etc. that returns a production URL is the remaining seam; today
  the live path falls back to the token-guarded preview reachability. The
  honest choice (do NOT fabricate a `productionUrl` / never fake "live") is kept;
  closing the seam means wiring each host's real deploy API behind the existing
  `DeployTarget` interface. Flagged by the criteria reviewer, allowed by the
  "live-or-dryrun" gate.
- **Pricing feed URL in `source`.** When a live feed returns no explicit source,
  `pricing.ts` echoes the feed URL in the cited `source`; prefer a fixed label.
- **KripVerify/Metal-GPU** for the built-app preview remains the canonical
  vision-layer upgrade (carried from W5); the W5B ship surfaces are DOM and were
  captured directly.

**Marker:** `PRISM-SHELL-W5B: RUN COMPLETE`
