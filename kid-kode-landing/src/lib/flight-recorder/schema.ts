// PRISM FLIGHT RECORDER — schema v1 (W-FR, founder-ratified 2026-07-05).
//
// The durable, versioned training corpus + OTel-compatible observability record.
// Every model interaction, node generation, verification signal, and user
// keep/edit/regen decision the platform produces is recorded through ONE of the
// six discriminated record types below. Dual purpose by construction:
//   • OBSERVABILITY — the gen_ai.* attributes are VERBATIM OpenTelemetry GenAI
//     semantic-convention keys (dotted string keys, quoted), so an OTel
//     collector can read this corpus directly.
//   • TRAINING — the prism.* extension namespace carries the platform-specific
//     reward + human-signal columns (SWE-RM score, repair class, keep/edit/regen)
//     that make each record an independently-usable training sample.
//
// ─── FRESH-DATED RESEARCH (verified 2026-07-05, this machine) ────────────────
// OTel Semantic Conventions release pinned: v1.43.0 (published 2026-07-03,
// confirmed via `gh api repos/open-telemetry/semantic-conventions/releases/latest`).
// The GenAI content-capture shape (system_instructions / input.messages /
// output.messages) landed in v1.37.0 and is unchanged through v1.43.0.
// GenAI conventions status: DEVELOPMENT (experimental — NOT stable; treat every
// gen_ai.* key as subject to change). The gen_ai.* conventions are migrating to a
// dedicated repo (open-telemetry/semantic-conventions-genai) which has no tagged
// release yet, so the last VERSIONED number is the main-repo release, pinned here.
// Custom fields live under a top-level `prism.*` root, NEVER nested under gen_ai.*
// (OTel naming rule: do not extend a reserved semconv namespace).
// ─────────────────────────────────────────────────────────────────────────────

/** Corpus schema version. Bump on any breaking record-shape change; the writer
 *  stamps this on every record so a reader can migrate old partitions. */
export const FLIGHT_RECORDER_SCHEMA_VERSION = 'prism-fr-v1' as const;

/** Provenance pins for the OTel alignment — emitted in the schema doc header and
 *  queryable so an acquirer's ML engineer can see exactly what standard this maps
 *  to and at what version it was authored. */
export const OTEL_ALIGNMENT = {
  semconvVersion: '1.43.0',
  contentCaptureFrom: '1.37.0',
  genaiStatus: 'development',
  genaiHome: 'open-telemetry/semantic-conventions-genai (no tagged release yet)',
  verifiedOn: '2026-07-05',
} as const;

// ─── OTel GenAI attribute subset (verbatim dotted keys) ──────────────────────
// Keys are the EXACT OpenTelemetry strings so the emitted JSON is collector-
// readable without a mapping layer. All optional: a record populates only the
// keys its upstream actually reports (data honesty — nulls, never invented
// numbers). See OTEL_ALIGNMENT for the source version.

/** OTel `gen_ai.provider.name` well-known enum (open — other values allowed).
 *  `gen_ai.provider.name` replaced the deprecated `gen_ai.system` in v1.37.0. */
export type GenAiProviderName =
  | 'anthropic'
  | 'openai'
  | 'aws.bedrock'
  | 'azure.ai.inference'
  | 'azure.ai.openai'
  | 'cohere'
  | 'deepseek'
  | 'gcp.gemini'
  | 'gcp.gen_ai'
  | 'gcp.vertex_ai'
  | 'groq'
  | 'ibm.watsonx.ai'
  | 'mistral_ai'
  | 'perplexity'
  | 'x_ai'
  // Prism extensions to the open enum for its own inference fabric / vendors:
  | 'replicate'
  | 'tripo'
  | 'fal'
  | 'cerebras'
  | 'fireworks'
  | 'deepinfra'
  | 'openrouter'
  | 'prism' // Prism's own future fine-tuned models (self-learning flywheel).
  | (string & {});

/** OTel `gen_ai.operation.name` enum (v1.43.0). */
export type GenAiOperationName =
  | 'chat'
  | 'create_agent'
  | 'embeddings'
  | 'execute_tool'
  | 'generate_content'
  | 'invoke_agent'
  | 'invoke_workflow'
  | 'retrieval'
  | 'text_completion'
  | (string & {});

/** A GenAI message (OTel `gen_ai.input.messages` / `gen_ai.output.messages`
 *  element): role + typed parts. Content capture is OPT-IN and PII-scrubbed at
 *  write; see recorder scrub.ts. */
export interface GenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | (string & {});
  parts: Array<{
    type: 'text' | 'reasoning' | 'tool_call' | 'tool_call_response' | 'blob' | 'uri' | (string & {});
    /** Free-text content — scrubbed at write. Present only when content capture is on. */
    content?: string;
    [k: string]: unknown;
  }>;
  finish_reason?: string;
}

/** The OTel GenAI attribute subset Prism records. Keys are VERBATIM OTel v1.43.0
 *  dotted strings so an OTel collector reads them directly. Every field optional
 *  — a record carries only what its upstream reported. */
export interface GenAiAttributes {
  // Provenance
  'gen_ai.provider.name'?: GenAiProviderName;
  'gen_ai.operation.name'?: GenAiOperationName;
  'gen_ai.request.model'?: string;
  'gen_ai.response.model'?: string;
  'gen_ai.response.id'?: string;
  'gen_ai.conversation.id'?: string;

  // Request params (nullable — recorded where the caller sets them)
  'gen_ai.request.temperature'?: number;
  'gen_ai.request.max_tokens'?: number;
  'gen_ai.request.top_p'?: number;
  'gen_ai.request.top_k'?: number;
  'gen_ai.request.seed'?: number;
  'gen_ai.request.stop_sequences'?: string[];
  'gen_ai.request.choice.count'?: number;

  // Response
  'gen_ai.response.finish_reasons'?: string[];
  'gen_ai.output.type'?: 'text' | 'json' | 'image' | 'speech' | (string & {});

  // Token usage — v1.37.0+ names (input/output; prompt/completion are deprecated)
  'gen_ai.usage.input_tokens'?: number;
  'gen_ai.usage.output_tokens'?: number;
  'gen_ai.usage.cache_creation.input_tokens'?: number;
  'gen_ai.usage.cache_read.input_tokens'?: number;
  'gen_ai.usage.reasoning.output_tokens'?: number;

  // Content capture (opt-in, scrubbed). v1.37.0 shape.
  'gen_ai.system_instructions'?: string;
  'gen_ai.input.messages'?: GenAiMessage[];
  'gen_ai.output.messages'?: GenAiMessage[];

  // Agent / multi-agent (DEVELOPMENT — highest-churn subset, recorded when known)
  'gen_ai.agent.id'?: string;
  'gen_ai.agent.name'?: string;
  'gen_ai.tool.name'?: string;
  'gen_ai.tool.call.id'?: string;
}

// ─── prism.* extension namespace (top-level root, per OTel naming rule) ───────
// The platform-specific reward + human-signal columns. These are what turn an
// observability trace into a training sample: the SWE-RM reward, the repair-chain
// outcome class, the convergence gate result, and the downstream keep/edit/regen
// decision. Keys are dotted `prism.*` strings for a uniform attribute bag; NEVER
// nested under gen_ai.* (would risk a future OTel clash).

/** Repair attempt classification (contamination-aware repair, engine INV-3). */
export type PrismRepairClass =
  | 'none' // first attempt, no repair
  | 'schema-gate' // failed the completeness gate → regenerated from spec
  | 'render-defensive' // renderMode/asset backstop repair
  | 'frontier-escalation' // attempt ≥3 escalated to a frontier model
  | (string & {});

/** The downstream human decision on a generated/edited node — the Cursor-style
 *  accept/reject goldmine. */
export type PrismUserDecision = 'keep' | 'edit' | 'regen' | 'undo' | 'accept' | 'pending' | (string & {});

/** Which product touchpoint emitted the record (partition key alongside day). */
export type PrismTouchpoint =
  | 'guided-build' // W2 intake
  | 'conductor' // W5 build pipeline
  | 'node-edit' // editor prompt-edit / regen
  | 'self-heal' // autonomous repair (E20)
  | 'material-gen' // prompt-to-texture route
  | 'generative-3d' // W10 generative capability family
  | 'verify' // judge / gate outcomes
  | 'session' // ship / abandon / return lifecycle
  | (string & {});

/** The Prism extension attribute bag. All optional; a record carries the columns
 *  its touchpoint produces. Dotted `prism.*` keys, verbatim in emitted JSON. */
export interface PrismAttributes {
  // Graph provenance (engine invariant 1: the graph is the app)
  'prism.node.id'?: string;
  'prism.node.subtype'?: string;
  'prism.node.render_mode'?: string;
  'prism.graph.ref'?: string; // project/graph identifier
  'prism.hub.id'?: string;
  'prism.app.archetype'?: string; // watch-atelier, dashboard, … (segment key for eval slices)

  // Reward + verification signals (the training labels).
  //
  // TWO reward columns by design: `prism.reward.*` is the GENERAL reward axis,
  // populated in live data from WHATEVER scorer ran (`prism.reward.source` names
  // it) — in the mock that is the schema-completeness gate; in production it is
  // the SWE-RM model. `prism.swe_rm.*` is reserved for the canonical SWE-RM 30B
  // reward model specifically (null until that scorer is wired at W-TR) so the
  // SWE-RM lineage stays unambiguous and is never mislabeled from a proxy signal.
  'prism.reward.score'?: number | null; // [0,1] reward from the scorer named below
  'prism.reward.source'?: 'swe-rm' | 'schema-completeness-gate' | 'golden-eval' | 'codegen-fixture' | (string & {});
  'prism.reward.issues'?: string[]; // issue/violation list from that scorer
  'prism.swe_rm.score'?: number | null; // SWE-RM 30B reward model score; null until wired (W-TR)
  'prism.swe_rm.issues'?: string[]; // issue list from the SWE-RM reward model
  'prism.repair.attempt'?: number; // 0-based attempt index in the repair chain
  'prism.repair.class'?: PrismRepairClass;
  'prism.repair.outcome'?: 'repaired' | 'unrepairable' | 'not-needed' | (string & {});
  'prism.convergence.passed'?: boolean; // convergence gate result
  'prism.verify.gate'?: string; // which gate ('schema-completeness', 'behavioral', 'visual', 'deploy', 'advocate')
  'prism.verify.outcome'?: 'pass' | 'fail' | 'must-fix' | 'pending' | (string & {});
  'prism.verify.judge'?: string; // 'criteria-reviewer' | 'user-advocate' | 'automated'

  // Human decision signals
  'prism.user.decision'?: PrismUserDecision;
  'prism.edit.instruction'?: string; // the natural-language edit request (scrubbed)
  'prism.edit.fields'?: string[]; // which spec fields changed (before/after keys)

  // Cost basis (the W10 metering columns — cost where tokens aren't reported)
  'prism.cost.unit'?: 'credits' | 'usd';
  'prism.cost.amount'?: number;
  'prism.cost.estimated'?: boolean;
  'prism.capability.id'?: string; // W10 capability tile id ('tripo.text-to-3d')
  'prism.capability.live'?: boolean; // ran against a live vendor vs demo-safe path

  // Timing
  'prism.latency.ms'?: number;
}

// ─── Record envelope + the six discriminated record types ────────────────────

/** Consent basis — how the consent flag on this record was resolved (D6). */
export type ConsentBasis = 'override' | 'tenant-flag' | 'env-default' | (string & {});

/** Common envelope on EVERY record. `consent` gates the training sink:
 *  consent=false records are quarantined to a separate non-training sink
 *  (I-CONSENT). `schema_version` + `otel` pin the corpus format + standard. */
export interface RecordEnvelope {
  schema_version: typeof FLIGHT_RECORDER_SCHEMA_VERSION;
  /** Globally-unique record id (ULID-like: sortable timestamp + random). */
  record_id: string;
  record_type: FlightRecordType;
  touchpoint: PrismTouchpoint;
  /** ISO-8601 creation time (span start where a duration is meaningful). */
  created_at: string;
  /** Optional span end for duration-bearing records. */
  ended_at?: string;
  /** Consent flag — TRUE only records reach the training sink (I-CONSENT). */
  consent: boolean;
  consent_basis: ConsentBasis;
  /** Scoping. tenant_id is a hashed/opaque id — never an email (I-PII). */
  tenant_id?: string;
  user_ref?: string; // opaque user reference (never raw email — I-PII)
  project_id?: string;
  session_id?: string;
  /** OTel + Prism attribute bags (both optional; a record fills what it has). */
  otel?: GenAiAttributes;
  prism?: PrismAttributes;
}

export type FlightRecordType =
  | 'build_session'
  | 'node_attempt'
  | 'edit_event'
  | 'capability_usage'
  | 'verify_signal'
  | 'user_signal';

/** A whole build (plan → graph shape → SLA tier → cost → outcome). */
export interface BuildSessionRecord extends RecordEnvelope {
  record_type: 'build_session';
  app_name?: string;
  direction_id?: string;
  plan_origin?: 'stub' | 'live' | null;
  hub_count?: number;
  node_count?: number;
  repaired_count?: number;
  sla_tier?: string;
  outcome?: 'built' | 'error' | 'aborted' | (string & {});
  verified_shippable?: boolean;
}

/** One node-generation attempt: spec → code → SWE-RM score → repair chain.
 *  The volume-king record (thousands per build). `prism.swe_rm.*` +
 *  `prism.repair.*` carry the reward + failure labels. */
export interface NodeAttemptRecord extends RecordEnvelope {
  record_type: 'node_attempt';
  /** The node spec that drove generation (caption/visual/behavior). Scrubbed. */
  spec?: { caption?: string; subtype?: string; render_mode?: string; [k: string]: unknown };
  /** Whether the attempt yielded a renderable node. */
  succeeded?: boolean;
}

/** A node edit: before/after spec diff → regen → keep/undo. The accept/reject
 *  goldmine (Cursor's entire signal). `prism.user.decision` is the label. */
export interface EditEventRecord extends RecordEnvelope {
  record_type: 'edit_event';
  /** Snapshot of the touched spec fields before + after (scrubbed). */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  /** Plan id linking the plan → apply → keep/undo chain. */
  plan_ref?: string;
  applied_count?: number;
}

/** Wraps a W10 CapabilityUsage metering event (generative-3D / material-gen).
 *  Recorded now, charged later (E20). Cost where tokens aren't reported (D7). */
export interface CapabilityUsageRecord extends RecordEnvelope {
  record_type: 'capability_usage';
  capability_id?: string;
  job_id?: string;
  result_asset_ref?: string;
  ok?: boolean; // false = metered failed invocation (every invocation is metered)
}

/** A verification signal: a judge or gate outcome (`prism.verify.*`). */
export interface VerifySignalRecord extends RecordEnvelope {
  record_type: 'verify_signal';
  gate?: string;
  outcome?: 'pass' | 'fail' | 'must-fix' | 'pending' | (string & {});
  evidence?: string[]; // short evidence lines (scrubbed)
}

/** A session-lifecycle signal: ship / abandon / return (proposal §3). */
export interface UserSignalRecord extends RecordEnvelope {
  record_type: 'user_signal';
  signal?: 'ship' | 'abandon' | 'return' | (string & {});
  detail?: string; // e.g. deploy url host (scrubbed), resume reason
}

/** The tagged union the writer accepts. */
export type FlightRecord =
  | BuildSessionRecord
  | NodeAttemptRecord
  | EditEventRecord
  | CapabilityUsageRecord
  | VerifySignalRecord
  | UserSignalRecord;

/** All record type names (drives the schema doc + dev ledger grouping). */
export const FLIGHT_RECORD_TYPES: FlightRecordType[] = [
  'build_session',
  'node_attempt',
  'edit_event',
  'capability_usage',
  'verify_signal',
  'user_signal',
];
