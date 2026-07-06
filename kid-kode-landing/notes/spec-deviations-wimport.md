# PRISM-WIMPORT — spec deviations record
# (written BEFORE deviating code, per W-IMPORT prompt requirement 7)
# Wave: PRISM INGEST — GitHub repo → Prism runtime (founder-directed 2026-07-05).
# Started 2026-07-06. Contract: notes/ROADMAP-TO-SHIP.md §"W-IMPORT DESIGN DECISION".

The design law is settled in the roadmap: **import = REGENERATION, not transpile.**
Import is a PLAN SOURCE that emits the SAME `BuildBrief` guided-build produces; the
existing Conductor pipeline regenerates the app as Prism nodes. Everything below is
an additive seam, recorded before the code that introduces it.

## D1 — DIFFUSION-ENGINE-SPEC.md path does not exist; plan→graph→node contract sourced live

The W-IMPORT prompt's READ-FIRST list cites `docs/prism/DIFFUSION-ENGINE-SPEC.md`
(plan → graph → node contract). That file does not exist in this repo (same finding as
W-FR D1). The plan→graph→node contract is sourced from the live code, which is the
build truth:
- **Plan format** = `BuildBrief` (`packages/shared-interfaces/src/prism-intake.ts`).
- **Conductor consumption** = `runConductor` loads the persisted brief by `projectId`
  → `resolveBlueprint(brief, direction)` → `BuildBlueprint` → `assembleGraph` →
  real `GraphSource`/`PrismNode` graph (`src/server/conductor/{conductor,planner,
  blueprint,graph-assembler}.ts`).
- **Hub derivation** = `deriveSections(brief)` splits the `sections` brief line on
  `[,\n•·|/]+`, ≤40-char segments, first 4 → hubs (`blueprint.ts:91`).

Import synthesizes a valid `BuildBrief`; the Conductor is untouched. I-SPEC intact.

## D2 — Import is a PLAN SOURCE via brief lines (option a), NOT the BuildBlueprint seam (option b)

Two ways to control the regenerated structure from an analyzed repo: (a) encode the
analyzed routes as the brief's `sections` line so the deterministic planner reproduces
them; (b) target the `BuildBlueprint` interface directly (the planner-agnostic seam).
W-IMPORT v1 takes **(a)**. Rationale: the roadmap law is "import = a plan source, not a
second engine." Option (a) keeps import as pure intake — it emits a `BuildBrief` that is
editable like any guided-build plan (deliverable 2 requirement) and reuses the ENTIRE
build pipeline with zero new engine surface. Option (b) would make import a second
planner. The analyzed routes ride the `sections` line; archetype/tone/backend/
integrations ride their keyed lines; brand tokens fold into `brandProfile`. This is the
honest reading of "the repo is an extremely rich prompt + asset source."

## D3 — AST tooling: the TypeScript compiler API (already a dependency), ZERO new deps

The FRESH-DATED RESEARCH DUTY asked for the current best repo-analysis approach.
Verified 2026-07-06: the state-of-the-art repo→context packer is **repomix** (npm),
and AST-based extraction is the recommended path for React/Next route+component
analysis; Next.js 2026 conventions are App-Router-first (`app/**/page.tsx` routes,
`route.ts` handlers, `'use client'` boundary, Server Actions for forms).

Decision: the analyzer uses the **TypeScript compiler API** (`import ts from
'typescript'`) for component/import/copy extraction. `typescript@5.7.2` is ALREADY a
project dependency, so this adds **zero** supply-chain surface (contrast W-FR D3, which
had to allowlist `hyparquet-writer`). `ts.createSourceFile(..., ScriptKind.TSX)` is
pure syntactic parsing — no Program, no type-checker, no config resolution — so it is
robust to a repo that doesn't compile. A parse failure fails open to a regex fallback
for copy extraction (I-FAILOPEN); it never dead-ends an import. Routes/API are
extracted from file-system conventions (no AST needed). repomix is NOT added — the
analyzer produces STRUCTURED FACTS (routes, components, brand tokens), which is more
precise than packing the whole repo for an LLM prompt.

## D4 — Repo-source abstraction: LocalDirSource + public GitHubUrlSource; GitHub App auth typed + STUBBED

The prompt scopes v1 to "public URL now; typed GitHubApp auth interface STUBBED until
founder's GitHub App arrives." Implemented as a `RepoSource` interface
(`listFiles()` + `readFile(path)` + `meta`) with three implementations:
- `LocalDirSource` — `node:fs` over a local path. Powers the authored fixture + all
  unit tests (network-free, deterministic).
- `GitHubUrlSource` — public GitHub REST fetch (git tree + raw contents). The fetch is
  **injected** at the tRPC route boundary using the existing SSRF-hardened
  `src/server/net/safe-fetch.ts` (`server-only`); the pure analyze pipeline never
  imports it, so vitest can import the pipeline under plain node. No unauthenticated
  writes; read-only.
- `GitHubAppSource` (INTERFACE + throwing stub) — installation-token auth for private
  repos. `githubAppConfigured()` already exists (`src/server/integrations/github-app.ts`);
  the App-authed source reports `configured:false` and throws a clear
  "not yet configured (arrives with the founder's GitHub App)" until the app id +
  private key land. The key interface is typed, NEVER logged (INV-19).

## D5 — Flight recorder: a 7th first-class record type `import_event` (additive)

The prompt requires "import_event records (analyze/synthesize/approve/regen/fidelity)
through the existing recorder" as "first-class corpus records" — "premium training
data." The lighter path (reuse `recordUserSignal` with a new signal value) would
under-deliver on "first-class." So a **7th discriminated record type** `import_event`
is added to `schema.ts`:
- `record_type: 'import_event'`, `stage: 'analyze'|'synthesize'|'approve'|'regen'|
  'fidelity'`, plus import-specific typed fields (`framework`, `route_count`,
  `component_count`, `carried_count`/`adapted_count`/`needs_you_count`,
  `supported`, `repo_ref`).
- Touchpoint `'import'` added to the open `PrismTouchpoint` union.
This is a NON-breaking additive schema change (the writer/sinks are generic over
`FlightRecord`; adding a union member + a `recordImportEvent` helper + a
`FLIGHT_RECORD_TYPES` entry touches nothing that partitions on type). Schema version
stays `prism-fr-v1` (additive, not breaking). PII scrub already deep-scrubs every
string value, so repo-derived free text (commit copy, emails) is redacted at write
with no extra work; `repo_ref` (owner/repo) is a public identifier, not PII.

## D6 — Analysis progress streams over the EXISTING async-generator transport (I-SSE), new event contract

I-SSE forbids a NEW realtime channel. The repo has NO `text/event-stream` route — the
"one channel" is the tRPC async-generator over `httpBatchStreamLink` at `/api/trpc`
(what `conductor.run` and `agent.chat` already use). `ingest.analyze` is a **streaming
mutation on that same transport** — it adds no new channel. It yields a NEW
`IngestStreamEvent` contract (stage-start / stage-progress / stage-end / result /
error) rather than reusing `AgentStreamEvent`, because the terminal payload (analysis +
synthesized brief + fidelity) does not fit the chat-oriented `AgentStreamEvent` union.
A new *contract* over the *existing transport* is additive and honest; a new *channel*
is not, and none is added.

## D7 — Fidelity report persistence: additive tenant-store sidecar, mirrors saveBrief

The fidelity report is "rendered post-plan and attached to the project." It is rendered
in the intake brief phase (where the imported plan is reviewed, pre-approval) and
persisted per-tenant as a project sidecar (`fidelity.json`) via a new additive
`saveFidelityReport`/`getFidelityReport` pair that mirrors `saveBrief`/`getBrief`
exactly (same tenant-fail-closed posture, size ceiling, `insideTenant` path guard). It
is attached after approval by an additive `ingest.attachFidelity({ projectId, report })`
mutation so the certified `intake.finalize` procedure is not modified. I-ADDITIVE
intact.

## D8 — Intake surface: additive within the existing `connect` card, zero restyle

The "Import an existing GitHub repo" checkbox + `owner/repo` field already exist
(`DecisionCard.tsx`, the `connect` card) and already round-trip through the store →
brief → contract. W-IMPORT adds, WITHIN the existing `.iv-connect-github` section, an
"Analyze repo" affordance + a progress/result panel, and a store action `applyImport()`
that absorbs the synthesized brief into working state and lands the user on the existing
approval gate (`goToBrief`). No certified `iv-*` class is restyled; no new intake phase
is introduced. If analysis fails, the checkbox degrades to today's behavior (the repo
ref still rides the `github` brief line) — plain guided-build, never a dead end
(I-FAILOPEN).

## D9 — Framework support: Next.js/React v1; explicit "not yet supported" path

v1 detects Next.js (App Router + Pages Router) and generic React. A repo that is
neither is reported as `supported:false` with a named framework guess and a clear
message; the import degrades to a prompt-seeded guided build (the repo name + package
description still seed a brief). This is I-FAILOPEN and I-HONEST-FIDELITY: import never
claims to have understood a framework it did not.
