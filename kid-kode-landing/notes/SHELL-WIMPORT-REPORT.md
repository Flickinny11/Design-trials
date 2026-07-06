# PRISM-WIMPORT — "PRISM INGEST" — RUN REPORT

**Wave:** W-IMPORT (GitHub repo → Prism runtime). Founder-directed 2026-07-05; built 2026-07-06.
**Branch:** `codex/prism-recovery-harness-20260630` (not switched).
**Design law:** import = **REGENERATION, not transpile** (ROADMAP-TO-SHIP.md).
**Status:** ✅ **RUN COMPLETE** — both fresh-context judges PASS, 0 MUST-FIX.
**Commits:** `72c97df4 … fa8cc1a5` (9 commits after the Flight-Recorder base `9e00103f`).

---

## 0. TL;DR
Users bring an existing app's DNA into Prism. Their app can't run in the Prism runtime as-is
(the graph IS the app), so import = **ANALYZE the repo → SYNTHESIZE the exact same `BuildBrief`
guided-build produces → user approves at the EXISTING gate → the untouched Conductor regenerates
the app as Prism nodes → a FIDELITY REPORT tells the user honestly what carried, adapted, and
needs them.** Import is a **plan source, not a second engine**. Proven end-to-end LIVE on two
fixtures (a local authored Next.js app + the real public `shadcn-ui/taxonomy`, ~250 files),
including the full `analyze → synthesize → fidelity → approve → regen` lifecycle recorded as
first-class training-corpus records. `npm run verify` EXIT 0; tsc 0-new; both judges 0 MUST-FIX.

## 1. What shipped (per deliverable)
1. **Analyzer** (`src/lib/ingest/`) — framework detection (Next.js App/Pages Router + generic
   React + honest "not yet supported" path); routes/API from FS conventions; components,
   import hierarchy, client boundary, and copy via the **TypeScript compiler API** (zero new
   dep, D3); data models (Prisma/Drizzle/Zod/Mongoose/TS); integrations from deps (capability
   refs, never creds); brand tokens (colours, fonts, image assets). Repo-source abstraction:
   `LocalDirSource` + public `GitHubUrlSource` (SSRF-safe fetch injected at the route) +
   typed `GitHubAppSource` stub for private repos (INV-19). ✅
2. **Plan synthesis → BuildBrief** (`synthesize.ts`) — builds an `IntakeWorking` from the
   analysis and runs the **real `deriveBrief`**, so a synthesized brief is structurally
   identical to a guided-build brief and editable at the same gate. Analyzed routes ride the
   `sections` line (→ Conductor hubs); archetype/tone/backend/integrations ride their keyed
   lines; nearest Direction Board matched for material+type; the repo's OWN palette preserved
   on top. ✅
3. **Intake wiring** (`GithubImportPanel`, `ingest-client`, `intake-store.applyImport`) — the
   "Import an existing GitHub repo" checkbox is now real: repo-URL input, an Analyze action,
   streamed progress over the EXISTING tRPC transport (I-SSE), and the synthesized plan lands
   at the existing approval gate, fully editable. Zero restyle of certified intake. ✅
4. **Fidelity report** (`fidelity.ts`, `FidelityLedger`) — honest per-feature
   carried/adapted/needs-you ledger, rendered post-plan in the brief phase and persisted onto
   the project on approval (`attachFidelity` → tenant-store `fidelity.json`). ✅
5. **Regen proof** (below) — full path on two fixtures. ✅
6. **Flight recorder** — 7th first-class record type `import_event`
   (analyze/synthesize/approve/regen/fidelity) + `recordImportEvent` + `'import'` touchpoint;
   emitted at all five stages; PII scrub applies to repo contents (proven by test). ✅
7. **Spec deviations** (`notes/spec-deviations-wimport.md`) — D1–D9, written before code. ✅

## 2. Architecture (the plan-source seam)
```
repo (LocalDirSource | GitHubUrlSource | GitHubAppSource-stub)
  → analyzeRepo()        structured facts (routes, components, data, api, integrations, brand, copy)
  → synthesizeBrief()    → IntakeWorking → deriveBrief() → BuildBrief   (the EXACT guided-build plan)
  → buildFidelityReport()  carried / adapted / needs-you
        ── ingest.analyze streams progress + returns {analysis, brief, fidelity} ──
  → store.applyImport()    lands the brief at the existing approval gate (editable)
  → BuildBrief.onApprove   intake.finalize (project, plan-pending) + ingest.attachFidelity (persist ledger)
  → conductor.run          resolveBlueprint + assembleGraph  →  real PrismNode graph  (UNTOUCHED engine)
```
Import never authors a graph itself — the certified Conductor does. `import_event` records are
written at every stage (route: analyze/synthesize/fidelity; attachFidelity: approve; Conductor:
regen).

## 3. Invariants honored (independently confirmed by the criteria judge)
- **I-ADDITIVE** — certified `intake` router untouched (empty diff); `router.ts` gains one key;
  `intake.css` append-only; Conductor change is a self-contained `if (githubImport.requested)`
  block; tenant-store mirrors `saveBrief`.
- **I-SSE** — `ingest.analyze` is a streaming mutation over the same `httpBatchStreamLink`
  transport `conductor.run` uses. No EventSource, no new event-stream route.
- **I-SECRETS / INV-19** — `GitHubAppAuth.privateKey` is a type field only; presence-checked via
  `Boolean(env)`, never read/logged/serialized; integrations are capability references
  (`evidence: 'dep: <name>'`), never credentials; `.env`/`.env.local` not in the read allowlist;
  live corpus carries only counts + public `repo_ref`.
- **I-HONEST-FIDELITY** — DB/API/auth → `needs-you`; framework/components/integrations →
  `adapted`; only page-routes/copy/present-palette → `carried`. Never a false "carried".
- **I-FAILOPEN** — unrecognized ref / analysis error → friendly message + guided-build; AST parse
  failure → regex fallback; `attachFidelity` best-effort; App source throws a clear "not
  configured" degrade.
- **I-SPEC** — no canonical spec edits (only the *generated* FLIGHT-RECORDER-SCHEMA.md, verified
  fresh by `verify:flight-recorder`).
- **`npm run verify` EXIT 0** — full chain green (verify:prism 14/14, tenancy 35/35,
  flight-recorder PASS). tsc gate: 9 baseline / **0 new**.

## 4. Fresh-dated research (2026-07-06)
Verified today's best repo-analysis approach before building: **repomix** is the SOTA repo→context
packer (with AST compression); Next.js 2026 conventions are **App-Router-first**
(`app/**/page.tsx` routes, `route.ts` handlers, `'use client'` boundary, Server Actions for
forms). Decision: use the **TypeScript compiler API** (already a dependency → zero supply-chain
surface) for AST extraction, and produce **structured facts** rather than packing the whole repo
for an LLM — more precise for route/component/brand extraction. repomix NOT added.

## 5. Regen proof (two fixtures)
- **Fixture (a) — authored local Next.js app** (`tests/fixtures/ingest/acme-notes`: 3 routes, a
  form, an API call, Prisma models, brand CSS). Offline integration test (in the verify path):
  analyze → `nextjs-app`, routes `/ /dashboard /notes/[id]`, API `/api/notes` GET+POST, models
  Note/User, integrations stripe+database, palette #1f6feb → synthesize BuildBrief → fidelity
  (3 carried / 7 adapted / 2 needs-you) → **regen** via real `buildDeterministicBlueprint` +
  `assembleGraph` → **4 hubs / 26 nodes / 1 root**.
- **Fixture (b) — real public repo `shadcn-ui/taxonomy`** (~250 files) over the LIVE GitHub
  fetch path (network-gated deterministic test + live browser E2E): 14 pages, 94 components,
  7 API routes, 14 data models, 5 integrations (Prisma/Vercel Analytics/Auth.js/Postmark/Stripe)
  → fidelity 2 carried / 10 adapted / 4 needs-you → approved (real project, brief+fidelity
  persisted) → **Conductor regenerated 5 hubs / 33 nodes**.
- **All five `import_event` stages recorded LIVE** in the production flight recorder:
  `analyze:3, synthesize:3, fidelity:3, approve:1, regen:1` (zero secrets; real tenant id).

## 6. Dual-judge verdicts (fresh-context, 0 MUST-FIX gate — MET)
- **criteria-reviewer → PASS.** All 6 invariants held against the diff; all 7 deliverables real
  (not stubs); tsc PASS (0 new) + full verify EXIT 0 verified independently; PII scrub proven.
  NITs (non-blocking): the `tests/fixtures/**` dep-allowlist exemption slightly widens the
  hook's blind spot (test-only path; low risk); `resolveLocalSource` doubly-guarded (airtight).
- **user-advocate (developer importing their real app) → PLEASED (0 MUST-FIX).** "Honesty is the
  strongest part" — DB/API/auth correctly `needs-you`, "secrets never import" credible and
  infrastructure-backed; DNA fidelity real (taxonomy's exact routes/integrations/models/copy →
  a 5-hub/33-node regenerated app); ledger clear + reassuring on desktop AND mobile; "needs-you"
  reads as a to-do, not a failure. FLAGs (non-blocking taste/capture): desktop fidelity
  screenshot framing artifact; archetype classifier leans "editorial" (every brief line is
  editable).

## 7. Deferrals / needs-founder
- **Private-repo import** needs the founder's read-only **GitHub App** (app id + private key).
  The `GitHubAppSource` seam + `GitHubAppAuth` type are in place; it reports `configured:false`
  and throws a clear degrade until the key lands (then a one-file wiring at SHIP-BRAND). Public
  repos import today.
- **More frameworks (v2)** — v1 fully supports Next.js (App+Pages) + generic React; anything
  else degrades honestly to a prompt-seeded guided build.
- **Archetype heuristic** — leans editorial for content-ish apps; user-editable. A richer
  archetype classifier is a low-priority follow-up.
- **Fixtures dep-allowlist** — the hook now exempts `tests/fixtures/**` manifests (analyzed data,
  never installed); if a fixture ever hosts *runnable* code, re-tighten the exemption.

## 8. Evidence index (`notes/verification/shell-wimport/`)
- `fixture-a-analysis.json`, `fixture-a-brief.json`, `fixture-a-fidelity.json`,
  `fixture-a-graph-summary.json`, `fixture-a-records.json` — fixture (a) full pipeline.
- `fixture-b-taxonomy.json`, `fixture-b-analysis.json`, `fixture-b-graph-summary.json` — real repo.
- `live-import-records.json` — the actual production corpus (11 records, all 5 stages).
- `frame-1..8` — intake brief + fidelity ledger (desktop + mobile), fixture-b, builder
  after-approve + regen.
- `verify-output.txt` — full `npm run verify` chain, EXIT 0.

## 9. Commit log
```
72c97df4 flight-recorder — 7th record type import_event + recordImportEvent + doc regen + scrub test
79ceb5b7 analyzer + plan synthesis + fidelity ledger + wire contract + local fixture + E2E pipeline proof
6816e265 server wiring — ingest tRPC router (streaming, I-SSE) + attachFidelity/getFidelity + tenant-store sidecar + Conductor regen emit
77fcc7a3 intake wiring (client) — GithubImportPanel + applyImport + FidelityLedger + additive CSS
d71e3106 honesty fixes from browser proof — /notes/[id] -> "Notes"; archetype driven by routes not a lone Stripe dep
8e959ee9 fixture-b proof — real shadcn-ui/taxonomy over live GitHub fetch + 9 live records + catch-all polish
6f5fe458 fixture-b regen proof — network-gated deterministic test (5 hubs/33 nodes)
fa8cc1a5 full live E2E — approved taxonomy -> real project -> Conductor regen; ALL 5 import_event stages recorded LIVE
(+ this report)
```

**PRISM-WIMPORT: RUN COMPLETE**
