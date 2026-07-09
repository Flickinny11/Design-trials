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
export const FLIGHT_RECORDER_SCHEMA_VERSION = "prism-fr-v1" as const;

/** Provenance pins for the OTel alignment — emitted in the schema doc header and
 *  queryable so an acquirer's ML engineer can see exactly what standard this maps
 *  to and at what version it was authored. */
export const OTEL_ALIGNMENT = {
  semconvVersion: "1.43.0",
  contentCaptureFrom: "1.37.0",
  genaiStatus: "development",
  genaiHome:
    "open-telemetry/semantic-conventions-genai (no tagged release yet)",
  verifiedOn: "2026-07-05",
} as const;

// ─── OTel GenAI attribute subset (verbatim dotted keys) ──────────────────────
// Keys are the EXACT OpenTelemetry strings so the emitted JSON is collector-
// readable without a mapping layer. All optional: a record populates only the
// keys its upstream actually reports (data honesty — nulls, never invented
// numbers). See OTEL_ALIGNMENT for the source version.

/** OTel `gen_ai.provider.name` well-known enum (open — other values allowed).
 *  `gen_ai.provider.name` replaced the deprecated `gen_ai.system` in v1.37.0. */
export type GenAiProviderName =
  | "anthropic"
  | "openai"
  | "aws.bedrock"
  | "azure.ai.inference"
  | "azure.ai.openai"
  | "cohere"
  | "deepseek"
  | "gcp.gemini"
  | "gcp.gen_ai"
  | "gcp.vertex_ai"
  | "groq"
  | "ibm.watsonx.ai"
  | "mistral_ai"
  | "perplexity"
  | "x_ai"
  // Prism extensions to the open enum for its own inference fabric / vendors:
  | "replicate"
  | "tripo"
  | "fal"
  | "cerebras"
  | "fireworks"
  | "deepinfra"
  | "openrouter"
  | "prism" // Prism's own future fine-tuned models (self-learning flywheel).
  | (string & {});

/** OTel `gen_ai.operation.name` enum (v1.43.0). */
export type GenAiOperationName =
  | "chat"
  | "create_agent"
  | "embeddings"
  | "execute_tool"
  | "generate_content"
  | "invoke_agent"
  | "invoke_workflow"
  | "retrieval"
  | "text_completion"
  | (string & {});

/** A GenAI message (OTel `gen_ai.input.messages` / `gen_ai.output.messages`
 *  element): role + typed parts. Content capture is OPT-IN and PII-scrubbed at
 *  write; see recorder scrub.ts. */
export interface GenAiMessage {
  role: "system" | "user" | "assistant" | "tool" | (string & {});
  parts: Array<{
    type:
      | "text"
      | "reasoning"
      | "tool_call"
      | "tool_call_response"
      | "blob"
      | "uri"
      | (string & {});
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
  "gen_ai.provider.name"?: GenAiProviderName;
  "gen_ai.operation.name"?: GenAiOperationName;
  "gen_ai.request.model"?: string;
  "gen_ai.response.model"?: string;
  "gen_ai.response.id"?: string;
  "gen_ai.conversation.id"?: string;

  // Request params (nullable — recorded where the caller sets them)
  "gen_ai.request.temperature"?: number;
  "gen_ai.request.max_tokens"?: number;
  "gen_ai.request.top_p"?: number;
  "gen_ai.request.top_k"?: number;
  "gen_ai.request.seed"?: number;
  "gen_ai.request.stop_sequences"?: string[];
  "gen_ai.request.choice.count"?: number;

  // Response
  "gen_ai.response.finish_reasons"?: string[];
  "gen_ai.output.type"?: "text" | "json" | "image" | "speech" | (string & {});

  // Token usage — v1.37.0+ names (input/output; prompt/completion are deprecated)
  "gen_ai.usage.input_tokens"?: number;
  "gen_ai.usage.output_tokens"?: number;
  "gen_ai.usage.cache_creation.input_tokens"?: number;
  "gen_ai.usage.cache_read.input_tokens"?: number;
  "gen_ai.usage.reasoning.output_tokens"?: number;

  // Content capture (opt-in, scrubbed). v1.37.0 shape.
  "gen_ai.system_instructions"?: string;
  "gen_ai.input.messages"?: GenAiMessage[];
  "gen_ai.output.messages"?: GenAiMessage[];

  // Agent / multi-agent (DEVELOPMENT — highest-churn subset, recorded when known)
  "gen_ai.agent.id"?: string;
  "gen_ai.agent.name"?: string;
  "gen_ai.tool.name"?: string;
  "gen_ai.tool.call.id"?: string;
}

// ─── prism.* extension namespace (top-level root, per OTel naming rule) ───────
// The platform-specific reward + human-signal columns. These are what turn an
// observability trace into a training sample: the SWE-RM reward, the repair-chain
// outcome class, the convergence gate result, and the downstream keep/edit/regen
// decision. Keys are dotted `prism.*` strings for a uniform attribute bag; NEVER
// nested under gen_ai.* (would risk a future OTel clash).

/** Repair attempt classification (contamination-aware repair, engine INV-3). */
export type PrismRepairClass =
  | "none" // first attempt, no repair
  | "schema-gate" // failed the completeness gate → regenerated from spec
  | "render-defensive" // renderMode/asset backstop repair
  | "frontier-escalation" // attempt ≥3 escalated to a frontier model
  | (string & {});

/** The downstream human decision on a generated/edited node — the Cursor-style
 *  accept/reject goldmine. */
export type PrismUserDecision =
  "keep" | "edit" | "regen" | "undo" | "accept" | "pending" | (string & {});

/** Which product touchpoint emitted the record (partition key alongside day). */
export type PrismTouchpoint =
  | "guided-build" // W2 intake
  | "conductor" // W5 build pipeline
  | "node-edit" // editor prompt-edit / regen
  | "self-heal" // autonomous repair (E20)
  | "material-gen" // prompt-to-texture route
  | "generative-3d" // W10 generative capability family
  | "import" // W-IMPORT — PRISM INGEST (GitHub repo → plan source → regen)
  | "verify" // judge / gate outcomes
  | "session" // ship / abandon / return lifecycle
  | "design-grammar" // W-DG1 — design-grammar harvest (analysis + distillation)
  | "catalog" // W-TPL — template catalog (new-hub-from-template + section drop)
  | "render-mode" // W-2D — per-hub 2d/3d render-mode toggles + authoring
  | (string & {});

/** The Prism extension attribute bag. All optional; a record carries the columns
 *  its touchpoint produces. Dotted `prism.*` keys, verbatim in emitted JSON. */
export interface PrismAttributes {
  // Graph provenance (engine invariant 1: the graph is the app)
  "prism.node.id"?: string;
  "prism.node.subtype"?: string;
  "prism.node.render_mode"?: string;
  "prism.graph.ref"?: string; // project/graph identifier
  "prism.hub.id"?: string;
  "prism.app.archetype"?: string; // watch-atelier, dashboard, … (segment key for eval slices)

  // Reward + verification signals (the training labels).
  //
  // TWO reward columns by design: `prism.reward.*` is the GENERAL reward axis,
  // populated in live data from WHATEVER scorer ran (`prism.reward.source` names
  // it) — in the mock that is the schema-completeness gate; in production it is
  // the SWE-RM model. `prism.swe_rm.*` is reserved for the canonical SWE-RM 30B
  // reward model specifically (null until that scorer is wired at W-TR) so the
  // SWE-RM lineage stays unambiguous and is never mislabeled from a proxy signal.
  "prism.reward.score"?: number | null; // [0,1] reward from the scorer named below
  "prism.reward.source"?:
    | "swe-rm"
    | "schema-completeness-gate"
    | "golden-eval"
    | "codegen-fixture"
    | (string & {});
  "prism.reward.issues"?: string[]; // issue/violation list from that scorer
  "prism.swe_rm.score"?: number | null; // SWE-RM 30B reward model score; null until wired (W-TR)
  "prism.swe_rm.issues"?: string[]; // issue list from the SWE-RM reward model
  "prism.repair.attempt"?: number; // 0-based attempt index in the repair chain
  "prism.repair.class"?: PrismRepairClass;
  "prism.repair.outcome"?:
    "repaired" | "unrepairable" | "not-needed" | (string & {});
  "prism.convergence.passed"?: boolean; // convergence gate result
  "prism.verify.gate"?: string; // which gate ('schema-completeness', 'behavioral', 'visual', 'deploy', 'advocate')
  "prism.verify.outcome"?:
    "pass" | "fail" | "must-fix" | "pending" | (string & {});
  "prism.verify.judge"?: string; // 'criteria-reviewer' | 'user-advocate' | 'automated'

  // Human decision signals
  "prism.user.decision"?: PrismUserDecision;
  "prism.edit.instruction"?: string; // the natural-language edit request (scrubbed)
  "prism.edit.fields"?: string[]; // which spec fields changed (before/after keys)

  // Cost basis (the W10 metering columns — cost where tokens aren't reported)
  "prism.cost.unit"?: "credits" | "usd";
  "prism.cost.amount"?: number;
  "prism.cost.estimated"?: boolean;
  "prism.capability.id"?: string; // W10 capability tile id ('tripo.text-to-3d')
  "prism.capability.live"?: boolean; // ran against a live vendor vs demo-safe path

  // Timing
  "prism.latency.ms"?: number;
}

// ─── Record envelope + the six discriminated record types ────────────────────

/** Consent basis — how the consent flag on this record was resolved (D6). */
export type ConsentBasis =
  "override" | "tenant-flag" | "env-default" | (string & {});

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
  | "build_session"
  | "node_attempt"
  | "edit_event"
  | "capability_usage"
  | "verify_signal"
  | "user_signal"
  | "import_event"
  | "design_analysis_event"
  | "catalog_event"
  | "render_mode_event";

/** A whole build (plan → graph shape → SLA tier → cost → outcome). */
export interface BuildSessionRecord extends RecordEnvelope {
  record_type: "build_session";
  app_name?: string;
  direction_id?: string;
  plan_origin?: "stub" | "live" | null;
  hub_count?: number;
  node_count?: number;
  repaired_count?: number;
  sla_tier?: string;
  outcome?: "built" | "error" | "aborted" | (string & {});
  verified_shippable?: boolean;
}

/** One node-generation attempt: spec → code → SWE-RM score → repair chain.
 *  The volume-king record (thousands per build). `prism.swe_rm.*` +
 *  `prism.repair.*` carry the reward + failure labels. */
export interface NodeAttemptRecord extends RecordEnvelope {
  record_type: "node_attempt";
  /** The node spec that drove generation (caption/visual/behavior). Scrubbed. */
  spec?: {
    caption?: string;
    subtype?: string;
    render_mode?: string;
    [k: string]: unknown;
  };
  /** Whether the attempt yielded a renderable node. */
  succeeded?: boolean;
}

/** A node edit: before/after spec diff → regen → keep/undo. The accept/reject
 *  goldmine (Cursor's entire signal). `prism.user.decision` is the label. */
export interface EditEventRecord extends RecordEnvelope {
  record_type: "edit_event";
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
  record_type: "capability_usage";
  capability_id?: string;
  job_id?: string;
  result_asset_ref?: string;
  ok?: boolean; // false = metered failed invocation (every invocation is metered)
}

/** A verification signal: a judge or gate outcome (`prism.verify.*`). */
export interface VerifySignalRecord extends RecordEnvelope {
  record_type: "verify_signal";
  gate?: string;
  outcome?: "pass" | "fail" | "must-fix" | "pending" | (string & {});
  evidence?: string[]; // short evidence lines (scrubbed)
}

/** A session-lifecycle signal: ship / abandon / return (proposal §3). */
export interface UserSignalRecord extends RecordEnvelope {
  record_type: "user_signal";
  signal?: "ship" | "abandon" | "return" | (string & {});
  detail?: string; // e.g. deploy url host (scrubbed), resume reason
}

/** Import lifecycle stage (W-IMPORT — PRISM INGEST). The set is fixed but the
 *  union stays open so a future stage is additive. */
export type PrismImportStage =
  | "analyze" // repo read + framework detect + structural extraction
  | "synthesize" // analysis → BuildBrief (the plan)
  | "approve" // user approved the imported plan at the existing gate
  | "regen" // Conductor regenerated the app as Prism nodes from the plan
  | "fidelity" // per-feature carried/adapted/needs-you ledger produced
  | (string & {});

/** One import lifecycle event (W-IMPORT). Import traces are premium training
 *  data: the analyzed-repo → synthesized-plan → regenerated-graph chain is a
 *  labeled example of "existing app DNA → Prism graph". `repo_ref` is a public
 *  owner/repo identifier (not PII); repo-derived free text is scrubbed at write
 *  like every other string. */
export interface ImportEventRecord extends RecordEnvelope {
  record_type: "import_event";
  stage: PrismImportStage;
  /** owner/repo or host/owner/repo — a public identifier, not personal data. */
  repo_ref?: string;
  /** Detected framework ('nextjs-app' | 'nextjs-pages' | 'react' | 'unknown'). */
  framework?: string;
  /** Whether v1 supports the detected framework (analyze stage). */
  supported?: boolean;
  /** Structural counts extracted (analyze stage). */
  route_count?: number;
  component_count?: number;
  api_count?: number;
  /** Fidelity ledger tallies (fidelity stage — I-HONEST-FIDELITY). */
  carried_count?: number;
  adapted_count?: number;
  needs_you_count?: number;
  /** Stage outcome (false = failed/degraded, still recorded — data honesty). */
  ok?: boolean;
  /** Short human note (scrubbed at write). */
  detail?: string;
}

/** Design-grammar harvest lifecycle stage (W-DG1). The set is fixed but the
 *  union stays open so a future stage is additive. Exemplar *generation* spend
 *  is metered through the existing `capability_usage` record (DEV-1); this
 *  record type captures the analysis/distillation/gap lifecycle. */
export type PrismDesignAnalysisStage =
  | "enumerate" // gallery/source enumeration (title + url + category)
  | "analyze" // live motion-protocol analysis of one source
  | "distill" // one technique FAMILY distilled from ≥1 deep source
  | "exemplar" // an original exemplar registered against a family
  | "gap" // a capability gap recorded for the gap report
  | (string & {});

/** One design-grammar harvest event (W-DG1). These are analysis telemetry, not
 *  user data: `source_url` is a public template/site URL (not PII) and any
 *  free text is scrubbed at write like every other string. The distilled
 *  families are OUR own vocabulary — no source assets or copy are ever carried
 *  (legal doctrine, PLAN §2). */
export interface DesignAnalysisEventRecord extends RecordEnvelope {
  record_type: "design_analysis_event";
  stage: PrismDesignAnalysisStage;
  /** Kebab-case family id this event concerns (distill/exemplar/gap stages). */
  family_id?: string;
  /** Public source URL analyzed (analyze/enumerate stages) — not PII. */
  source_url?: string;
  /** Source kind (mirrors the design-grammar corpus vocabulary; kept inline so
   *  telemetry never imports the corpus types). Open union. */
  source_type?: "sr-template" | "awwwards" | "other" | (string & {});
  /** How deeply the source was analyzed. Open union. */
  analysis_depth?: "deep" | "listing" | (string & {});
  /** Honesty gate value for the family (distill/gap stages). Open union. */
  readiness?: "ready" | "partial" | "gap" | (string & {});
  /** Element types the family produces (distill stage). */
  element_types?: string[];
  /** Exemplars registered against the family (distill/exemplar stages). */
  exemplar_count?: number;
  /** Stage outcome (false = failed/degraded, still recorded — data honesty). */
  ok?: boolean;
  /** Short human note (scrubbed at write). */
  detail?: string;
}

/** Template-catalog lifecycle stage (W-TPL). The set is fixed but the union
 *  stays open so a future stage is additive. */
export type PrismCatalogStage =
  | "browse" // picker opened / template searched
  | "instantiate-hub" // a hub template dropped as a new planet in the galaxy
  | "drop-section" // a section template dropped into an existing hub
  | (string & {});

/** One template-catalog event (W-TPL). These are premium training data: a
 *  labeled example of "archetype + grammar family → a real Prism graph the user
 *  chose to instantiate", plus which sections users reach for. The template slug
 *  and family id are OUR own catalog vocabulary (no third-party assets/copy are
 *  ever carried — legal doctrine, PLAN §2); user hub names are free text and are
 *  scrubbed at write like every other string. */
export interface CatalogEventRecord extends RecordEnvelope {
  record_type: "catalog_event";
  stage: PrismCatalogStage;
  /** Hub-template slug (instantiate-hub / browse). */
  template_slug?: string;
  /** Archetype shelf (landing | marketing | … ). */
  archetype?: string;
  /** Primary grammar family id (kebab, or `legacy:` tag). */
  primary_family?: string;
  /** Section-template slug + kind (drop-section). */
  section_slug?: string;
  section_kind?: string;
  /** Render-route decision of record for the template hero (R1..R4). */
  route?: string;
  /** Nodes minted by the instantiation / section drop. */
  node_count?: number;
  /** Remapped id of the new hub (instantiate-hub) or target hub (drop-section) —
   *  a server/session id, not PII. */
  hub_ref?: string;
  /** Search query on a browse event (scrubbed at write). */
  query?: string;
  /** Stage outcome (false = failed/degraded, still recorded — data honesty). */
  ok?: boolean;
  /** Short human note (scrubbed at write). */
  detail?: string;
}

/** Which surface flipped/assigned the hub render mode (W-2D). The set is
 *  fixed but the union stays open so a future surface is additive. */
export type PrismRenderModeSurface =
  | "canvas-hud" // the canvas camera-HUD mode chip toggle
  | "hub-inspector" // the galaxy/canvas Hub Inspector Visual-tab toggle
  | "conductor" // the planner assigned the mode while authoring a hub
  | "template" // a hub template declared the mode at instantiation
  | (string & {});

/** One per-hub render-mode event (W-2D). Mode choices are taste training
 *  data: "this hub's content wanted a flat 2d composition" is a labeled
 *  example of composition intent, keyed by our own vocabulary (hub ids are
 *  session/server ids, not PII; free text is scrubbed at write). Toggles are
 *  non-destructive by law, so from/to pairs are safe to learn from. */
export interface RenderModeEventRecord extends RecordEnvelope {
  record_type: "render_mode_event";
  surface: PrismRenderModeSurface;
  /** The hub whose composition mode changed / was assigned. */
  hub_ref?: string;
  /** Mode before the change ('3d' | '2d'; absent for a fresh assignment). */
  from_mode?: string;
  /** Mode after the change ('3d' | '2d'). */
  to_mode?: string;
  /** Hub archetype/title hint when known (scrubbed at write). */
  hub_hint?: string;
  /** Stage outcome (false = failed/degraded, still recorded — data honesty). */
  ok?: boolean;
  /** Short human note (scrubbed at write). */
  detail?: string;
}

/** The tagged union the writer accepts. */
export type FlightRecord =
  | BuildSessionRecord
  | NodeAttemptRecord
  | EditEventRecord
  | CapabilityUsageRecord
  | VerifySignalRecord
  | UserSignalRecord
  | ImportEventRecord
  | DesignAnalysisEventRecord
  | CatalogEventRecord
  | RenderModeEventRecord;

/** All record type names (drives the schema doc + dev ledger grouping). */
export const FLIGHT_RECORD_TYPES: FlightRecordType[] = [
  "build_session",
  "node_attempt",
  "edit_event",
  "capability_usage",
  "verify_signal",
  "user_signal",
  "import_event",
  "design_analysis_event",
  "catalog_event",
  "render_mode_event",
];
