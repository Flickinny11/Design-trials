// PRISM SHELL — CONDUCTOR + DEPLOY + VERIFY CONTRACT — prism-conductor.ts
// (SHELL W5, 2026-07-04)
//
// Contract-first (spec I4) shapes for the v1 prompt-to-app engine — the
// **Conductor** (founder lock H, PRISM-SHELL-DECISIONS-2026-07-04): one
// orchestrator per user build that reads an approved Build Brief (W2),
// authors the graph EXCLUSIVELY through the certified node paths (validated
// additive plans + schema-completeness gate), streams hydration + verification
// evidence, checkpoints to the E1 timeline, and is interruptible + resumable.
//
// Transport (I1, SSE-only): the Conductor RUN streams over the SAME async-
// generator tRPC transport the chat uses, yielding `AgentStreamEvent`s
// (prism-agent.ts) — its plan/build/verify evidence rides the existing
// `tool-step-*` variants (E4). No new transport, no WebSocket, no polling.
// This file adds the RESULT shapes (status, verify latch, deploy record,
// export manifest) the RUN produces and the deploy/export procedures return.
//
// Deploy (S7 / E14 / E15): a typed DeployTarget-kind vocabulary + a deploy
// record. The prism-cloud target serves a shareable PREVIEW URL from this
// app (E14, always available). External hosts (Vercel/Netlify/Cloudflare +
// Modal/RunPod/Vast) are the E15 seed vocabulary; W5 ships them env-gated in
// dry-run — W5B extends the SAME record shape (§14.1). Export (E7) is the
// deployable runtime bundle manifest.
//
// I5: no secrets ever ride these shapes. A preview URL carries a capability
// TOKEN bound to a project snapshot — a reference, never a credential. Env
// var NAMES may appear (for the "you must set X" surface); values never do.
//
// Discipline: ADDITIVE ONLY — never remove or repurpose a variant/field.

import { z } from 'zod';
import { prismTenancyIdSchema } from './prism-tenancy';

/** Wire version for the Conductor/deploy surface. */
export const PRISM_CONDUCTOR_CONTRACT_VERSION = 1 as const;

// ── Conductor run ─────────────────────────────────────────────────────────────

/** `conductor.run` input — a project sitting at `plan-pending` (an approved
 *  Build Brief exists). NO owner field (I11): the tenant is the session. The
 *  RUN streams AgentStreamEvents (prism-agent.ts); this is only its input. */
export const conductorRunInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    /** Requested model id (spec 7.4). The server resolves it against the
     *  model-config registry and falls back to the default — never trusts a
     *  stale string. Optional: absent → account/project default. */
    modelId: z.string().min(1).max(120).optional(),
    /** Force a fresh build even when a built graph already exists (rebuild).
     *  Absent/false → resume-or-build (idempotent: a built project re-verifies
     *  rather than re-authoring). */
    rebuild: z.boolean().optional(),
  })
  .strict();
export type ConductorRunInput = z.infer<typeof conductorRunInputSchema>;

/** The phase ladder the Conductor drives (mirrors + extends the tenancy
 *  `buildState` with the transient verify phase). `built` = the graph is
 *  authored AND the verify latch has run. */
export const conductorPhaseSchema = z.enum([
  'idle',
  'planning',
  'building',
  'verifying',
  'built',
  'failed',
]);
export type ConductorPhase = z.infer<typeof conductorPhaseSchema>;

// ── §11 verification latch ────────────────────────────────────────────────────

/** One verification check's settled state. `evidence` is a short list of
 *  human-readable proof lines (streamed into chat as E4 tool-step body). */
export const verifyCheckStatusSchema = z.enum([
  'pass',
  'fail',
  'pending',
  'skipped',
]);
export type VerifyCheckStatus = z.infer<typeof verifyCheckStatusSchema>;

export const verifyCheckSchema = z.object({
  status: verifyCheckStatusSchema,
  label: z.string().min(1).max(120),
  /** Proof lines (counts, ids, matched palette hexes). Never secrets. */
  evidence: z.array(z.string().max(300)).max(40),
  detail: z.string().max(600).optional(),
});
export type VerifyCheck = z.infer<typeof verifyCheckSchema>;

/** The completion latch (spec §11 / Sentinel v4). "Verified shippable" (I9)
 *  requires behavioral + visual + deploy to pass; `advocate` is the fresh-
 *  context human-grade pass (run by the verification harness, recorded here).
 *  `verifiedShippable` is the single boolean the badge reads (I9). */
export const verifyLatchSchema = z.object({
  v: z.literal(PRISM_CONDUCTOR_CONTRACT_VERSION),
  /** Structural-behavioral: every node schema-complete, one PrismRootNode,
   *  edges resolve, graph mounts in the Prism runtime (W5-D5). */
  behavioral: verifyCheckSchema,
  /** Direction-Board conformance (§11.3): authored palette/material/type
   *  match the chosen board — generic output is a MUST-FIX fail. */
  visual: verifyCheckSchema,
  /** The deployed/previewable app is reachable (S7). */
  deploy: verifyCheckSchema,
  /** Fresh-context user-advocate (§11.4) — blocks completion. `pending` until
   *  the harness records the pass; never auto-passed by the server. */
  advocate: verifyCheckSchema,
  /** I9 — true only when behavioral + visual + deploy pass. The advocate pass
   *  is enforced by the verification harness, not the runtime badge. */
  verifiedShippable: z.boolean(),
  ranAt: z.string().datetime(),
});
export type VerifyLatch = z.infer<typeof verifyLatchSchema>;

// ── Conductor status (resume / poll) ──────────────────────────────────────────

/** `conductor.status` output — enough to resume or render the current build
 *  state without replaying the stream. Persisted per-project by the server. */
export const conductorStatusSchema = z.object({
  v: z.literal(PRISM_CONDUCTOR_CONTRACT_VERSION),
  projectId: prismTenancyIdSchema,
  phase: conductorPhaseSchema,
  /** Node/hub counts of the authored graph (0 before a build). */
  hubCount: z.number().int().nonnegative(),
  nodeCount: z.number().int().nonnegative(),
  /** The chosen Direction Board id the build conformed to (§11.3). */
  directionId: z.string().max(80).nullable(),
  /** The last verify latch, if the build reached verify. */
  latch: verifyLatchSchema.nullable(),
  /** Resolved model id that drove (drives) the build (spec 7.4). */
  modelId: z.string().max(120).nullable(),
  /** Provenance of the planner: `stub` = deterministic dry-run (no API key),
   *  `live` = model-driven. Honest, like the prompt-edit orchestrator. */
  origin: z.enum(['stub', 'live']).nullable(),
  updatedAt: z.string().datetime(),
});
export type ConductorStatus = z.infer<typeof conductorStatusSchema>;

export const conductorStatusInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type ConductorStatusInput = z.infer<typeof conductorStatusInputSchema>;

// ── Deploy targets (E15 vocabulary) + records (E14) ──────────────────────────

/** The typed DeployTarget-kind registry (E15). Frontend seed: prism-cloud
 *  (default, this app), vercel, netlify, cloudflare. Backend/GPU seed: modal,
 *  runpod, vast (W5B activates them). Additive: new hosts append. */
export const deployTargetKindSchema = z.enum([
  'prism-cloud',
  'vercel',
  'netlify',
  'cloudflare',
  'modal',
  'runpod',
  'vast',
]);
export type DeployTargetKind = z.infer<typeof deployTargetKindSchema>;

/** Frontend vs backend/GPU category (E15/E19). */
export const deployCategorySchema = z.enum(['frontend', 'backend']);
export type DeployCategory = z.infer<typeof deployCategorySchema>;

/** `live` = the host token was present and the deploy really shipped; `dry-run`
 *  = env-gated, so the deploy produced a local preview URL + a host config
 *  manifest as evidence (never blocks — W5 prompt). */
export const deployModeSchema = z.enum(['live', 'dry-run']);
export type DeployMode = z.infer<typeof deployModeSchema>;

export const deployStatusSchema = z.enum([
  'queued',
  'deploying',
  'live',
  'verified',
  'failed',
  'rolled-back',
]);
export type DeployStatus = z.infer<typeof deployStatusSchema>;

// ── Backend/GPU node endpoint (E15/E19) ──────────────────────────────────────

/** The typed I/O contract a backend/GPU node's deployed endpoint honors. The
 *  Conductor generates it from the node class; the post-ship latch (W5B-D2)
 *  builds a fixture `sampleInput` and asserts the round-trip output matches
 *  `outputKind`. Names/shapes only — never a secret (I5). */
export const inferenceContractSchema = z.object({
  /** The node class this endpoint serves (E19 node→target mapping). */
  nodeClass: z.string().min(1).max(80),
  /** The open-source model family the endpoint runs (dry-run: a deterministic
   *  reference stand-in of this class; live: the real deployed model). */
  model: z.string().min(1).max(120),
  inputKind: z.enum(['text', 'image-url', 'json']),
  outputKind: z.enum(['label', 'embedding', 'text', 'json']),
  /** A tiny fixture the latch sends to prove a real inference round-trip. */
  sampleInput: z.string().max(600),
});
export type InferenceContract = z.infer<typeof inferenceContractSchema>;

/** One inference round-trip result the endpoint returns + the latch validates.
 *  `mode` mirrors the deploy: `dry-run` = the reference model answered; `live`
 *  = the deployed host endpoint answered. */
export const inferenceResultSchema = z.object({
  mode: deployModeSchema,
  model: z.string().min(1).max(120),
  outputKind: z.enum(['label', 'embedding', 'text', 'json']),
  /** Human-readable primary output (label text, decoded text, or a summary). */
  output: z.string().max(600),
  /** Confidence / score when the output is a classification (0..1). */
  score: z.number().min(0).max(1).nullable(),
  /** Latency the endpoint reports (ms) — evidence, not a guarantee. */
  latencyMs: z.number().int().nonnegative(),
});
export type InferenceResult = z.infer<typeof inferenceResultSchema>;

/** A DeployTarget descriptor the ship UI renders (E15/E18). `available` reflects
 *  whether the host's env token is present; unavailable hosts still deploy in
 *  dry-run. `requiredEnv` are the NAMES the founder must set (I5 — names only). */
export const deployTargetDescriptorSchema = z.object({
  kind: deployTargetKindSchema,
  label: z.string().min(1).max(80),
  category: deployCategorySchema,
  available: z.boolean(),
  /** Env var NAMES gating live deploys (values never appear — I5). */
  requiredEnv: z.array(z.string().min(1).max(80)).max(12),
  /** One-line "what this host is for" (recommendations surface, E18 seed). */
  note: z.string().max(200).optional(),
});
export type DeployTargetDescriptor = z.infer<typeof deployTargetDescriptorSchema>;

/** A deploy record — the E14 preview deployment (or a live ship). `previewUrl`
 *  is the shareable Lovable-class URL (this app's token-guarded /preview route
 *  in dry-run; the host's URL when live). `snapshotRef` pins the exact graph
 *  snapshot that was shipped (rollback = restore + redeploy). */
export const deployRecordSchema = z.object({
  id: prismTenancyIdSchema,
  projectId: prismTenancyIdSchema,
  kind: deployTargetKindSchema,
  category: deployCategorySchema,
  mode: deployModeSchema,
  status: deployStatusSchema,
  /** Shareable preview URL (E14). Relative or absolute; the token binds it to
   *  this project snapshot. */
  previewUrl: z.string().min(1).max(600),
  /** Production URL once a live ship lands (W5B mostly). Null in dry-run. */
  productionUrl: z.string().max(600).nullable(),
  /** Opaque capability token gating the preview read (a REFERENCE, not a
   *  secret — I5). Bound to (tenant, project, snapshot). */
  token: z.string().min(8).max(200),
  /** The E1 checkpoint / graph snapshot this deploy shipped. */
  snapshotRef: z.string().min(1).max(400),
  /** Optional custom domain (E16 is W5B; W5 stores the field + a stub verify). */
  customDomain: z.string().max(253).nullable(),
  /** Domain verification state (stub until DNS is testable — W5B). */
  domainStatus: z.enum(['none', 'pending', 'verified']).default('none'),
  /** Pointer to the generated host-config manifest (dry-run evidence / E7). */
  manifestRef: z.string().max(400).nullable(),
  /** Post-ship verification (§11.2 against the shipped URL/endpoint — W5B/E15).
   *  Additive: legacy W5 records omit it. */
  postShip: verifyCheckSchema.optional(),
  /** Backend/GPU deploys (E19) expose a token-guarded inference endpoint URL
   *  the latch round-trips against. Null/absent for frontend deploys. */
  endpointUrl: z.string().max(600).nullable().optional(),
  /** The endpoint's I/O contract (E19), present only for backend deploys. */
  inferenceContract: inferenceContractSchema.nullable().optional(),
  createdAt: z.string().datetime(),
});
export type DeployRecord = z.infer<typeof deployRecordSchema>;

export const deployInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    kind: deployTargetKindSchema.default('prism-cloud'),
    /** Backend/GPU node class this deploy serves (E19). Optional; frontend
     *  deploys ignore it. */
    nodeClass: z.string().min(1).max(80).optional(),
  })
  .strict();
export type DeployInput = z.infer<typeof deployInputSchema>;

export const deployListInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type DeployListInput = z.infer<typeof deployListInputSchema>;

/** `conductor.rollback` input — restore a prior E1 checkpoint and redeploy it
 *  (S7 rollback). NO owner (I11). */
export const deployRollbackInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    /** The E1 version to roll back to. */
    versionId: prismTenancyIdSchema,
    kind: deployTargetKindSchema.default('prism-cloud'),
  })
  .strict();
export type DeployRollbackInput = z.infer<typeof deployRollbackInputSchema>;

export const deploySetDomainInputSchema = z
  .object({
    deployId: prismTenancyIdSchema,
    projectId: prismTenancyIdSchema,
    /** A DNS name; empty string clears it. RFC-1035-ish soft bound. */
    domain: z.string().max(253),
  })
  .strict();
export type DeploySetDomainInput = z.infer<typeof deploySetDomainInputSchema>;

/** `conductor.deploy` / `rollback` output — the record plus the live target
 *  descriptor list so the ship UI can render one-click hosts (E18 seed). */
export const deployOutputSchema = z.object({
  v: z.literal(PRISM_CONDUCTOR_CONTRACT_VERSION),
  deploy: deployRecordSchema,
  targets: z.array(deployTargetDescriptorSchema),
});
export type DeployOutput = z.infer<typeof deployOutputSchema>;

export const deployListOutputSchema = z.object({
  v: z.literal(PRISM_CONDUCTOR_CONTRACT_VERSION),
  deploys: z.array(deployRecordSchema),
  targets: z.array(deployTargetDescriptorSchema),
});
export type DeployListOutput = z.infer<typeof deployListOutputSchema>;

// ── E18 host recommendations + live pricing ──────────────────────────────────

/** Current pricing for one host, fetched at run time (E18). `asOf` + `source`
 *  are cited in the UI so a cached/sandbox price is never mistaken for live. */
export const hostPricingSchema = z.object({
  kind: deployTargetKindSchema,
  /** Short headline price string, e.g. "Free hobby · $20/mo pro" or
   *  "~$0.60/hr A10G". */
  headline: z.string().min(1).max(120),
  /** `live` = fetched from a pricing feed this run; `cached` = within the ≤24h
   *  cache; `static` = the dated fallback table (no live feed configured). */
  freshness: z.enum(['live', 'cached', 'static']),
  /** ISO date the price reflects. */
  asOf: z.string().min(4).max(40),
  /** The public source the price was compiled from (cited in UI). */
  source: z.string().min(1).max(200),
});
export type HostPricing = z.infer<typeof hostPricingSchema>;

/** A ranked host recommendation for the built graph (E18). */
export const hostRecommendationSchema = z.object({
  kind: deployTargetKindSchema,
  label: z.string().min(1).max(80),
  category: deployCategorySchema,
  available: z.boolean(),
  /** Why this host is recommended for THIS app (graph-derived). */
  reason: z.string().min(1).max(200),
  /** Rank within its category (0 = top pick). */
  rank: z.number().int().nonnegative(),
  pricing: hostPricingSchema,
});
export type HostRecommendation = z.infer<typeof hostRecommendationSchema>;

export const recommendationsInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type RecommendationsInput = z.infer<typeof recommendationsInputSchema>;

export const recommendationsOutputSchema = z.object({
  v: z.literal(PRISM_CONDUCTOR_CONTRACT_VERSION),
  /** Does the graph have backend/GPU nodes (E19)? Gates the backend recs. */
  hasBackend: z.boolean(),
  frontend: z.array(hostRecommendationSchema).max(8),
  backend: z.array(hostRecommendationSchema).max(8),
});
export type RecommendationsOutput = z.infer<typeof recommendationsOutputSchema>;

// ── E15 host requirements (what the Conductor reads + generates config from) ──

/** The requirements a host declares — what the Conductor must generate to ship
 *  the Prism runtime bundle there (E15: "reads the selected host's
 *  requirements and generates that host's config"). Config fields carry the
 *  GENERATED values (never a secret — I5); `requiredEnv` are the NAMES the
 *  founder must set for a live deploy. */
export const hostRequirementsSchema = z.object({
  kind: deployTargetKindSchema,
  category: deployCategorySchema,
  /** e.g. "next.config", "vercel.json", "modal app stub" — the config file(s)
   *  this host needs, described. */
  configArtifacts: z.array(z.string().min(1).max(120)).max(12),
  /** The generated host-config the Conductor produced (key → value; no
   *  secrets). Mirrors HostConfigManifest.config. */
  generatedConfig: z.record(z.string(), z.string()),
  requiredEnv: z.array(z.string().min(1).max(80)).max(24),
  /** The verification the post-ship latch will run against this host (§11.2). */
  postShipCheck: z.enum(['http-reachable', 'inference-roundtrip']),
});
export type HostRequirements = z.infer<typeof hostRequirementsSchema>;

export const deployRequirementsInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    kind: deployTargetKindSchema,
  })
  .strict();
export type DeployRequirementsInput = z.infer<typeof deployRequirementsInputSchema>;

export const deployRequirementsOutputSchema = z.object({
  v: z.literal(PRISM_CONDUCTOR_CONTRACT_VERSION),
  requirements: hostRequirementsSchema,
});
export type DeployRequirementsOutput = z.infer<typeof deployRequirementsOutputSchema>;

// ── E17 "Ship & Make Profitable" completeness scan ───────────────────────────

/** The capability categories the completeness scan checks an app graph for
 *  (founder anchor: auth, db, storage, payments, subscriptions, email,
 *  analytics). */
export const capabilityCategorySchema = z.enum([
  'auth',
  'db',
  'storage',
  'payments',
  'subscriptions',
  'email',
  'analytics',
]);
export type CapabilityCategory = z.infer<typeof capabilityCategorySchema>;

/** A recommended one-click capability card — the W3 catalog tile that fills a
 *  missing capability, rendered IN the streaming chat (E17). Accepting it has
 *  the Conductor author the capability's nodes through the certified path. */
export const capabilityCardSchema = z.object({
  category: capabilityCategorySchema,
  title: z.string().min(1).max(80),
  description: z.string().max(240),
  /** The catalog provider this card attaches (binds to W3 INTEGRATION_CATALOG). */
  providerId: z.string().min(1).max(60),
  providerLabel: z.string().min(1).max(60),
  /** The brand-mark id the card renders (real glyph — no stock icon). */
  brandMark: z.string().min(1).max(60),
});
export type CapabilityCard = z.infer<typeof capabilityCardSchema>;

/** One category's presence verdict in the scanned graph. */
export const completenessItemSchema = z.object({
  category: capabilityCategorySchema,
  present: z.boolean(),
  /** Why we judged it present/missing (node ids / integration ids / keywords). */
  evidence: z.string().max(240),
  /** The one-click card offered when the capability is missing. */
  card: capabilityCardSchema.nullable(),
});
export type CompletenessItem = z.infer<typeof completenessItemSchema>;

/** The full completeness scan (E17). `cards` is the subset the chat renders. */
export const completenessScanSchema = z.object({
  v: z.literal(PRISM_CONDUCTOR_CONTRACT_VERSION),
  projectId: prismTenancyIdSchema,
  items: z.array(completenessItemSchema).max(16),
  cards: z.array(capabilityCardSchema).max(16),
  presentCount: z.number().int().nonnegative(),
  missingCount: z.number().int().nonnegative(),
  scannedAt: z.string().datetime(),
});
export type CompletenessScan = z.infer<typeof completenessScanSchema>;

export const completenessInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type CompletenessInput = z.infer<typeof completenessInputSchema>;

/** `conductor.addCapability` input — accept a card. The Conductor authors the
 *  capability's nodes through the certified node path + re-verifies. */
export const addCapabilityInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    category: capabilityCategorySchema,
  })
  .strict();
export type AddCapabilityInput = z.infer<typeof addCapabilityInputSchema>;

export const addCapabilityOutputSchema = z.object({
  v: z.literal(PRISM_CONDUCTOR_CONTRACT_VERSION),
  category: capabilityCategorySchema,
  /** Node ids the Conductor authored for this capability (certified path). */
  addedNodeIds: z.array(z.string().max(120)).max(24),
  /** The re-run latch after adding the capability. */
  latch: verifyLatchSchema,
  /** The scan re-run after adding (so the UI updates remaining cards). */
  scan: completenessScanSchema,
});
export type AddCapabilityOutput = z.infer<typeof addCapabilityOutputSchema>;

// ── E7 export bundle manifest ────────────────────────────────────────────────

/** One asset referenced by the export bundle (a URL + size; bytes ride the
 *  guarded asset route, never this JSON). */
export const exportAssetSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().min(1).max(600),
  bytes: z.number().int().nonnegative(),
});
export type ExportAsset = z.infer<typeof exportAssetSchema>;

/** E7 — the deployable runtime bundle manifest: the .prism graph + assets +
 *  a hosting manifest. Honest positioning: this is ownership of the RUNNING
 *  app (the runtime IS the product), not React source. */
export const exportManifestSchema = z.object({
  v: z.literal(PRISM_CONDUCTOR_CONTRACT_VERSION),
  projectId: prismTenancyIdSchema,
  appName: z.string().min(1).max(200),
  /** The artifact kind — a Prism runtime graph bundle. */
  artifact: z.literal('prism-runtime-bundle'),
  generatedAt: z.string().datetime(),
  /** Node/hub/edge counts (the graph JSON rides the download route). */
  graphSummary: z.object({
    hubs: z.number().int().nonnegative(),
    nodes: z.number().int().nonnegative(),
    edges: z.number().int().nonnegative(),
    hasRootNode: z.boolean(),
  }),
  assets: z.array(exportAssetSchema).max(512),
  /** The hosting manifest — the runtime + entry + env NAMES a host needs. */
  hosting: z.object({
    runtime: z.literal('three-webgpu'),
    entry: z.string().min(1).max(200),
    target: deployTargetKindSchema,
    /** Env var NAMES the host must provide (values never appear — I5). */
    requiredEnv: z.array(z.string().min(1).max(80)).max(24),
  }),
});
export type ExportManifest = z.infer<typeof exportManifestSchema>;

export const exportInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type ExportInput = z.infer<typeof exportInputSchema>;

export const exportOutputSchema = z.object({
  v: z.literal(PRISM_CONDUCTOR_CONTRACT_VERSION),
  manifest: exportManifestSchema,
  /** Guarded download URL for the full bundle (graph + manifest zip). */
  downloadUrl: z.string().min(1).max(600),
});
export type ExportOutput = z.infer<typeof exportOutputSchema>;

// ── Parse helpers (pure) ──────────────────────────────────────────────────────

export function parseConductorRunInput(value: unknown): ConductorRunInput {
  return conductorRunInputSchema.parse(value);
}

export function parseVerifyLatch(value: unknown): VerifyLatch {
  return verifyLatchSchema.parse(value);
}

export function parseConductorStatus(value: unknown): ConductorStatus {
  return conductorStatusSchema.parse(value);
}
