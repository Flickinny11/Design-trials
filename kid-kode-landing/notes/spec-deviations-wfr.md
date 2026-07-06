# PRISM-WFR — spec deviations record
# (written BEFORE deviating code, per W-FR prompt requirement 8)
# Wave: FLIGHT RECORDER (founder-ratified 2026-07-05). Started 2026-07-05.

## D1 — DIFFUSION-ENGINE-SPEC.md path does not exist; SSE law sourced from PRISM-ENGINE-SPEC-V3.md

The W-FR prompt's READ-FIRST list cites `docs/prism/DIFFUSION-ENGINE-SPEC.md`
(INVARIANT 5: SSE only). That file does not exist anywhere in this repo or the
parent workspace (verified via `find` across `/Users/loganbaird/Prototype_Prism`).
The buildEvents/SSE law lives in `docs/prism/PRISM-ENGINE-SPEC-V3.md`:

- L446–447: "V2 Invariant 5: 'SSE is the only real-time channel.' V3 Behavior:
  SSE remains the channel for Cortex … Events are also persisted to
  `buildEvents` asynchronously for history."
- §25 "SSE Event Types" (L1702+).

**Resolution:** the recorder honors that law as written — it is a SINK
(asynchronous persistence of events that already flow), never a new realtime
channel. No WebSocket, no SSE endpoint, no polling stream is added by W-FR.

## D2 — keep/undo signals originate client-side; captured via an additive ingest route

The editor's accept (keep) and undo actions live in client chrome
(`src/components/editor/node-agent/node-agent-controller.ts` — `accept()`,
`undo()`, `fireSelfHeal()`). "Server-side capture only" is honored by adding
ONE additive route, `POST /api/prism/flight-recorder`, that receives a minimal
outcome beacon (edit id, node ids, outcome kind) fire-and-forget from the
controller. ALL recording logic — validation, consent resolution, PII scrub,
sink writes — runs server-side inside that route. This is a plain
request/response POST (same shape as every other `/api/prism/*` route), not a
realtime channel — I-SSE intact. The route is ingest-only: it never returns
recorded data (the dev ledger reads via a separate dev-only GET, PII-scrubbed).

## D3 — Parquet compaction adds one pure-JS devDependency (`hyparquet-writer`)

The spec requires "NDJSON sink with daily rotation + Parquet compaction
script". Writing Parquet (Thrift metadata + encodings) from scratch with zero
deps is not honest engineering. `hyparquet-writer` (0.16.x, pure JS, single
transitive dep `hyparquet`, no native code) is added as a devDependency, used
ONLY by `scripts/flight-recorder-compact.mjs` (offline compaction — never in
the request path, never in the client bundle). Allowlist entry added to
`.claude/hooks/dependency-allowlist-check.py` (DEVDEP_ALLOW) with rationale
logged in `notes/mockup-pipeline.md` §10, per that hook's stated procedure.

## D4 — R2 sink is a typed interface + env-gated stub (per spec, recorded for clarity)

The prompt itself specifies "R2 sink as a typed interface behind the same
writer (stub until R2 creds; wired at SHIP-BRAND)". Implemented exactly so:
`RemoteObjectSink` interface + an R2 implementation that reports
`configured: false` when `PRISM_R2_*` env vars are absent and is skipped by
the writer (fail-open). No AWS SDK is added now; the signing client lands at
SHIP-BRAND with the creds.

## D5 — user_signal 'abandon' is schema-supported but not wired in this wave

`user_signal` covers ship / abandon / return per the ratified proposal §3.
'ship' (deploy success) and 'return' (resume of a built project) are wired in
the Conductor now. 'abandon' requires session-lifecycle/inactivity tracking
that does not exist in the mock shell; inventing a fake heuristic would poison
the corpus. The schema carries the value; the wiring lands with real session
telemetry (SHIP-BRAND window). Recorded here so it is a visible deferral, not
a silent gap.

## D6 — consent resolution: per-record flag now; tenant-level flag is a seam

I-CONSENT requires a consent flag on every record and consent=false quarantined
from the training sink. Implemented: every emit resolves consent as
(per-call override) ?? (tenant consent lookup seam) ?? (env
`PRISM_FR_CONSENT_DEFAULT`, default `true` on this dev machine — dev/demo data
is the founder's own). The tenant store does not yet carry an enterprise
opt-out field; the recorder exposes `resolveConsent({ tenantId, override })`
so wiring the real tenant flag at SHIP-BRAND is a one-line change inside the
recorder, not a schema or call-site change. The quarantine path itself
(consent=false → separate non-training sink) is fully implemented and covered
by tests + the demo.

## D7 — token usage attributes are recorded where the provider reports them

`gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` are nullable in
schema v1. The live prompt-edit orchestrator (Vercel AI SDK `generateObject`)
exposes usage on its result and it is recorded when present; the deterministic
stub orchestrator, the Conductor's deterministic planner, and the spawned
vendor pipelines (Tripo/Replicate/FLUX shell clients) do not report token
counts — those records carry cost/credits instead (the W10 cost basis). This
is data honesty: nulls where the upstream does not report, never invented
numbers.
