# Prism Flight Recorder — corpus schema

> GENERATED from `src/lib/flight-recorder/schema.ts` by
> `scripts/flight-recorder-schema-doc.mjs`. Do not edit by hand — re-run the
> generator. This is the training-corpus contract an acquirer's ML engineer reads.

## Provenance

- **Corpus schema version:** `prism-fr-v1`
- **OTel Semantic Conventions pinned:** `1.43.0` (GenAI content-capture shape from `1.37.0`)
- **GenAI conventions status:** `development` — experimental; treat every `gen_ai.*` key as subject to change
- **Verified:** 2026-07-05 (this machine, against opentelemetry.io + the semantic-conventions repo)
- **Namespaces:** `gen_ai.*` keys are VERBATIM OTel strings (collector-readable); Prism-specific columns live under a separate top-level `prism.*` root, never nested under `gen_ai.*`.

## Record envelope (every record)

Common envelope on EVERY record. `consent` gates the training sink: consent=false records are quarantined to a separate non-training sink (I-CONSENT). `schema_version` + `otel` pin the corpus format + standard.

| Field | Type | Notes |
| --- | --- | --- |
| `schema_version` **(req)** | `typeof FLIGHT_RECORDER_SCHEMA_VERSION` |  |
| `record_id` **(req)** | `string` | Globally-unique record id (ULID-like: sortable timestamp + random). |
| `record_type` **(req)** | `FlightRecordType` |  |
| `touchpoint` **(req)** | `PrismTouchpoint` |  |
| `created_at` **(req)** | `string` | ISO-8601 creation time (span start where a duration is meaningful). |
| `ended_at` | `string` | Optional span end for duration-bearing records. |
| `consent` **(req)** | `boolean` | Consent flag — TRUE only records reach the training sink (I-CONSENT). |
| `consent_basis` **(req)** | `ConsentBasis` |  |
| `tenant_id` | `string` | Scoping. tenant_id is a hashed/opaque id — never an email (I-PII). |
| `user_ref` | `string` |  |
| `project_id` | `string` | opaque user reference (never raw email — I-PII) |
| `session_id` | `string` |  |
| `otel` | `GenAiAttributes` | OTel + Prism attribute bags (both optional; a record fills what it has). |
| `prism` | `PrismAttributes` |  |

## Record types

### `BuildSessionRecord`

A whole build (plan → graph shape → SLA tier → cost → outcome).

| Field | Type | Notes |
| --- | --- | --- |
| `app_name` | `string` |  |
| `direction_id` | `string` |  |
| `plan_origin` | `'stub' | 'live' | null` |  |
| `hub_count` | `number` |  |
| `node_count` | `number` |  |
| `repaired_count` | `number` |  |
| `sla_tier` | `string` |  |
| `outcome` | `'built' | 'error' | 'aborted' | (string & {})` |  |
| `verified_shippable` | `boolean` |  |

### `NodeAttemptRecord`

One node-generation attempt: spec → code → SWE-RM score → repair chain. The volume-king record (thousands per build). `prism.swe_rm.*` + `prism.repair.*` carry the reward + failure labels.

| Field | Type | Notes |
| --- | --- | --- |
| `spec` | `{ caption?: string; subtype?: string; render_mode?: string; [k: string]: unknown }` | The node spec that drove generation (caption/visual/behavior). Scrubbed. |
| `succeeded` | `boolean` | Whether the attempt yielded a renderable node. |

### `EditEventRecord`

A node edit: before/after spec diff → regen → keep/undo. The accept/reject goldmine (Cursor's entire signal). `prism.user.decision` is the label.

| Field | Type | Notes |
| --- | --- | --- |
| `before` | `Record<string, unknown>` | Snapshot of the touched spec fields before + after (scrubbed). |
| `after` | `Record<string, unknown>` |  |
| `plan_ref` | `string` | Plan id linking the plan → apply → keep/undo chain. |
| `applied_count` | `number` |  |

### `CapabilityUsageRecord`

Wraps a W10 CapabilityUsage metering event (generative-3D / material-gen). Recorded now, charged later (E20). Cost where tokens aren't reported (D7).

| Field | Type | Notes |
| --- | --- | --- |
| `capability_id` | `string` |  |
| `job_id` | `string` |  |
| `result_asset_ref` | `string` |  |
| `ok` | `boolean` |  |

### `VerifySignalRecord`

A verification signal: a judge or gate outcome (`prism.verify.*`).

| Field | Type | Notes |
| --- | --- | --- |
| `gate` | `string` |  |
| `outcome` | `'pass' | 'fail' | 'must-fix' | 'pending' | (string & {})` |  |
| `evidence` | `string[]` |  |

### `UserSignalRecord`

A session-lifecycle signal: ship / abandon / return (proposal §3).

| Field | Type | Notes |
| --- | --- | --- |
| `signal` | `'ship' | 'abandon' | 'return' | (string & {})` |  |
| `detail` | `string` |  |

## OTel GenAI attributes (`gen_ai.*`, verbatim)

The OTel GenAI attribute subset Prism records. Keys are VERBATIM OTel v1.43.0 dotted strings so an OTel collector reads them directly. Every field optional — a record carries only what its upstream reported.

| Field | Type | Notes |
| --- | --- | --- |
| `'gen_ai.provider.name'` | `GenAiProviderName` | Provenance |
| `'gen_ai.operation.name'` | `GenAiOperationName` |  |
| `'gen_ai.request.model'` | `string` |  |
| `'gen_ai.response.model'` | `string` |  |
| `'gen_ai.response.id'` | `string` |  |
| `'gen_ai.conversation.id'` | `string` |  |
| `'gen_ai.request.temperature'` | `number` | Request params (nullable — recorded where the caller sets them) |
| `'gen_ai.request.max_tokens'` | `number` |  |
| `'gen_ai.request.top_p'` | `number` |  |
| `'gen_ai.request.top_k'` | `number` |  |
| `'gen_ai.request.seed'` | `number` |  |
| `'gen_ai.request.stop_sequences'` | `string[]` |  |
| `'gen_ai.request.choice.count'` | `number` |  |
| `'gen_ai.response.finish_reasons'` | `string[]` | Response |
| `'gen_ai.output.type'` | `'text' | 'json' | 'image' | 'speech' | (string & {})` |  |
| `'gen_ai.usage.input_tokens'` | `number` | Token usage — v1.37.0+ names (input/output; prompt/completion are deprecated) |
| `'gen_ai.usage.output_tokens'` | `number` |  |
| `'gen_ai.usage.cache_creation.input_tokens'` | `number` |  |
| `'gen_ai.usage.cache_read.input_tokens'` | `number` |  |
| `'gen_ai.usage.reasoning.output_tokens'` | `number` |  |
| `'gen_ai.system_instructions'` | `string` | Content capture (opt-in, scrubbed). v1.37.0 shape. |
| `'gen_ai.input.messages'` | `GenAiMessage[]` |  |
| `'gen_ai.output.messages'` | `GenAiMessage[]` |  |
| `'gen_ai.agent.id'` | `string` | Agent / multi-agent (DEVELOPMENT — highest-churn subset, recorded when known) |
| `'gen_ai.agent.name'` | `string` |  |
| `'gen_ai.tool.name'` | `string` |  |
| `'gen_ai.tool.call.id'` | `string` |  |

## Prism extension attributes (`prism.*`)

The Prism extension attribute bag. All optional; a record carries the columns its touchpoint produces. Dotted `prism.*` keys, verbatim in emitted JSON.

| Field | Type | Notes |
| --- | --- | --- |
| `'prism.node.id'` | `string` | Graph provenance (engine invariant 1: the graph is the app) |
| `'prism.node.subtype'` | `string` |  |
| `'prism.node.render_mode'` | `string` |  |
| `'prism.graph.ref'` | `string` |  |
| `'prism.hub.id'` | `string` | project/graph identifier |
| `'prism.app.archetype'` | `string` |  |
| `'prism.reward.score'` | `number | null` | watch-atelier, dashboard, … (segment key for eval slices) Reward + verification signals (the training labels). TWO reward columns by design: `prism.reward.*` is the GENERAL reward axis, populated in live data from WHATEVER scorer ran (`prism.reward.source` names it) — in the mock that is the schema-completeness gate; in production it is the SWE-RM model. `prism.swe_rm.*` is reserved for the canonical SWE-RM 30B reward model specifically (null until that scorer is wired at W-TR) so the SWE-RM lineage stays unambiguous and is never mislabeled from a proxy signal. |
| `'prism.reward.source'` | `'swe-rm' | 'schema-completeness-gate' | 'golden-eval' | 'codegen-fixture' | (string & {})` | [0,1] reward from the scorer named below |
| `'prism.reward.issues'` | `string[]` |  |
| `'prism.swe_rm.score'` | `number | null` | issue/violation list from that scorer |
| `'prism.swe_rm.issues'` | `string[]` | SWE-RM 30B reward model score; null until wired (W-TR) |
| `'prism.repair.attempt'` | `number` | issue list from the SWE-RM reward model |
| `'prism.repair.class'` | `PrismRepairClass` | 0-based attempt index in the repair chain |
| `'prism.repair.outcome'` | `'repaired' | 'unrepairable' | 'not-needed' | (string & {})` |  |
| `'prism.convergence.passed'` | `boolean` |  |
| `'prism.verify.gate'` | `string` | convergence gate result |
| `'prism.verify.outcome'` | `'pass' | 'fail' | 'must-fix' | 'pending' | (string & {})` | which gate ('schema-completeness', 'behavioral', 'visual', 'deploy', 'advocate') |
| `'prism.verify.judge'` | `string` |  |
| `'prism.user.decision'` | `PrismUserDecision` | 'criteria-reviewer' | 'user-advocate' | 'automated' Human decision signals |
| `'prism.edit.instruction'` | `string` |  |
| `'prism.edit.fields'` | `string[]` | the natural-language edit request (scrubbed) |
| `'prism.cost.unit'` | `'credits' | 'usd'` | which spec fields changed (before/after keys) Cost basis (the W10 metering columns — cost where tokens aren't reported) |
| `'prism.cost.amount'` | `number` |  |
| `'prism.cost.estimated'` | `boolean` |  |
| `'prism.capability.id'` | `string` |  |
| `'prism.capability.live'` | `boolean` | W10 capability tile id ('tripo.text-to-3d') |
| `'prism.latency.ms'` | `number` | ran against a live vendor vs demo-safe path Timing |

## Enumerations

- **`GenAiProviderName`** — 'anthropic', 'openai', 'aws.bedrock', 'azure.ai.inference', 'azure.ai.openai', 'cohere', 'deepseek', 'gcp.gemini', 'gcp.gen_ai', 'gcp.vertex_ai', 'groq', 'ibm.watsonx.ai', 'mistral_ai', 'perplexity', 'x_ai', 'replicate', 'tripo', 'fal', 'cerebras', 'fireworks', 'deepinfra', 'openrouter', 'prism' _(open enum)_
- **`GenAiOperationName`** — 'chat', 'create_agent', 'embeddings', 'execute_tool', 'generate_content', 'invoke_agent', 'invoke_workflow', 'retrieval', 'text_completion' _(open enum)_
- **`PrismRepairClass`** — 'none', 'schema-gate', 'render-defensive', 'frontier-escalation' _(open enum)_
- **`PrismUserDecision`** — 'keep', 'edit', 'regen', 'undo', 'accept', 'pending' _(open enum)_
- **`PrismTouchpoint`** — 'guided-build', 'conductor', 'node-edit', 'self-heal', 'material-gen', 'generative-3d', 'import', 'verify', 'session' _(open enum)_
- **`ConsentBasis`** — 'override', 'tenant-flag', 'env-default' _(open enum)_
- **`FlightRecordType`** — 'build_session', 'node_attempt', 'edit_event', 'capability_usage', 'verify_signal', 'user_signal', 'import_event'

## Scrub coverage (I-PII / I-SECRETS)

Scrubbed at WRITE time (`src/lib/flight-recorder/scrub.ts`), proven by
`tests/unit/flight-recorder/scrub.test.ts`:

- **Redacted with high precision:** emails, phone numbers, US SSN, payment cards, and a broad family of secret/key shapes (provider-prefixed keys `sk-`/`sk-ant-`/`gh*_`/`AIza`/`xox*-`/`sk_live_`/`r8_`, AWS access-key ids, JWTs, bearer tokens, `key=value` secrets, and long hex/base64 blobs). Object fields named like secrets are dropped entirely.
- **Personal names:** redacted precisely when the recorder supplies the actor's known identifiers (name + email) — the server always has these. Generic open-vocabulary name NER is a documented SHIP-BRAND enhancement, NOT faked here (data honesty).

## Consent + quarantine (I-CONSENT)

Every record carries `consent` + `consent_basis`. `consent=true` records reach the TRAINING sink; `consent=false` records are QUARANTINED to a separate non-training sink so an enterprise opt-out is honored end-to-end. Resolution order: per-call override → tenant flag (seam, wired at SHIP-BRAND) → env default (`PRISM_FR_CONSENT_DEFAULT`).

## Storage layout

Append-only NDJSON under `.data/flight-recorder/<family>/<YYYY-MM-DD>/<touchpoint>.ndjson` (gitignored). Partitioned by day + touchpoint. `scripts/flight-recorder-compact.mjs` rolls a day's NDJSON into Parquet. An R2 `RemoteObjectSink` is a typed, env-gated seam wired at SHIP-BRAND.
