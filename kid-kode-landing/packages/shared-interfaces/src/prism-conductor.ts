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
  createdAt: z.string().datetime(),
});
export type DeployRecord = z.infer<typeof deployRecordSchema>;

export const deployInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    kind: deployTargetKindSchema.default('prism-cloud'),
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
