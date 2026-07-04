// PRISM SHELL — ACCOUNTS & TENANCY CONTRACT — prism-tenancy.ts (SHELL W1A, 2026-07-04)
//
// Contract-first (spec I4) shapes for accounts, orgs, projects, project
// versions, and plan tiers (spec §14 W1A; E1 snapshot pointers; E6 tier
// stubs). These are the wire shapes the tenancy tRPC router validates at the
// edge and the per-tenant store persists — written for the real product, not
// a stub, so W4 (dashboard), W5 (build/E1 timeline), and W7 (org sharing)
// extend them additively.
//
// TENANT ISOLATION (spec §8 I11, §14): note what is deliberately ABSENT from
// every request schema below — a tenant/owner id. The owning tenant is ONLY
// ever derived server-side from the Better Auth session; no client-supplied
// field can name another tenant's data. The contract makes cross-tenant
// requests inexpressible, and the store fails closed on top of that.
//
// Auth itself is Better Auth (I2) — its user/session tables are Better
// Auth's own schema. `prismUserSchema` is the SHELL-FACING projection of
// that user (plus the E6 plan-tier stub carried as a Better Auth additional
// field); it never replaces or forks the auth system's storage.
//
// Discipline: ADDITIVE ONLY — never remove or repurpose a variant or field.

import { z } from 'zod';

/** Contract version for the tenancy surface. At v1 consumers may assert
 *  equality; the first bump must encode a compat policy in-schema (W0
 *  obligation, carried). */
export const PRISM_TENANCY_CONTRACT_VERSION = 1 as const;

// ── Identifiers ──────────────────────────────────────────────────────────────

/** Better Auth issues opaque ids; ours are slugs. Both must be single path
 *  segments — NO separators that could traverse the tenant-keyed store
 *  (I11: the id grammar itself refuses `../`, `/`, `\`, NUL). */
export const prismTenancyIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, 'single path-segment id (alnum, -, _)');

// ── Plan tiers (E6 — schema now, billing provider later) ────────────────────

export const prismPlanTierSchema = z.enum(['free', 'pro', 'enterprise']);
export type PrismPlanTier = z.infer<typeof prismPlanTierSchema>;

export const PRISM_DEFAULT_PLAN_TIER: PrismPlanTier = 'free';

// ── Build lifecycle (W2-D4 — additive project-row field) ─────────────────────

/** Where a project sits on the build ladder. Guided-Build intake hands a
 *  project off to the builder in `plan-pending` (an approved Build Brief exists
 *  but the Conductor has not authored a plan yet); the real Plan → Build →
 *  Verify phases (spec §3 Phases 3–5) land in W5 behind this same field.
 *  `intake` = created but no approved brief yet; `built` = a verified app
 *  exists. Additive-only: never remove or repurpose a variant. */
export const prismBuildStateSchema = z.enum([
  'intake',
  'plan-pending',
  'planning',
  'building',
  'built',
]);
export type PrismBuildState = z.infer<typeof prismBuildStateSchema>;

// ── User (shell-facing projection of the Better Auth user) ──────────────────

export const prismUserSchema = z.object({
  id: prismTenancyIdSchema,
  email: z.string().email().max(320),
  name: z.string().max(200),
  /** Avatar URL from the OAuth provider (Google/GitHub) when present. */
  image: z.string().max(2048).nullish(),
  /** E6 tier stub — lives as a Better Auth additional field on the user
   *  row; billing integration (Stripe) lands in the testing phase. */
  planTier: prismPlanTierSchema.default(PRISM_DEFAULT_PLAN_TIER),
  createdAt: z.string().datetime(),
});
export type PrismUser = z.infer<typeof prismUserSchema>;

// ── Org (enterprise-tier stub — Decision E scoping: multiplayer/shared
//    dashboards are an ENTERPRISE capability; multi-tenant independence is
//    the default posture) ────────────────────────────────────────────────────

export const prismOrgSchema = z.object({
  id: prismTenancyIdSchema,
  name: z.string().min(1).max(200),
  ownerUserId: prismTenancyIdSchema,
  /** Orgs exist only at the enterprise tier in v1 (founder scope
   *  clarification 2026-07-04). Field kept as the full enum so tier
   *  changes stay a data change. */
  planTier: prismPlanTierSchema,
  /** Seats — W7 replaces with a real membership surface; additive until. */
  memberUserIds: z.array(prismTenancyIdSchema),
  createdAt: z.string().datetime(),
});
export type PrismOrg = z.infer<typeof prismOrgSchema>;

// ── Project ──────────────────────────────────────────────────────────────────

export const prismProjectSchema = z.object({
  id: prismTenancyIdSchema,
  /** The owning tenant (Better Auth user id). Present on the ENTITY so the
   *  store can assert ownership; never accepted from request input. */
  ownerUserId: prismTenancyIdSchema,
  /** Enterprise org scope — null for the default independent-tenant case. */
  orgId: prismTenancyIdSchema.nullish(),
  name: z.string().min(1).max(200),
  /** Pointer into the tenant store's graph space (never inline graph bytes
   *  on the project row). */
  graphRef: z.string().max(400).nullish(),
  /** Per-project model override (spec 7.2) — a model-config id, resolved
   *  against the single config source (7.4). Null = account default. */
  modelOverrideId: z.string().max(120).nullish(),
  /** Build ladder position (W2-D4). Absent on legacy rows == pre-intake. */
  buildState: prismBuildStateSchema.nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PrismProject = z.infer<typeof prismProjectSchema>;

// ── Project version (E1 — named checkpoints as .prism graph SNAPSHOT
//    POINTERS; one-click restore lands with the W4/W5 timeline UI) ───────────

export const prismProjectVersionSchema = z.object({
  id: prismTenancyIdSchema,
  projectId: prismTenancyIdSchema,
  label: z.string().min(1).max(200),
  /** Pointer to the immutable snapshot in the tenant store — E1 says
   *  snapshot POINTER; bytes live in tenant-keyed storage only. */
  graphSnapshotRef: z.string().min(1).max(400),
  createdByUserId: prismTenancyIdSchema,
  createdAt: z.string().datetime(),
});
export type PrismProjectVersion = z.infer<typeof prismProjectVersionSchema>;

// ── Asset metadata (tenant-keyed binary storage; bytes ride the guarded
//    asset route, never tRPC JSON) ───────────────────────────────────────────

export const prismTenantAssetSchema = z.object({
  /** Content hash — the asset id IS its sha256 (established store idiom). */
  id: z.string().regex(/^[a-f0-9]{64}$/, 'sha256 content hash'),
  projectId: prismTenancyIdSchema,
  name: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  bytes: z.number().int().nonnegative(),
  /** Tenant-scoped serving path (session-guarded route) — never a public
   *  or cross-tenant URL. */
  url: z.string().max(400),
  createdAt: z.string().datetime(),
});
export type PrismTenantAsset = z.infer<typeof prismTenantAssetSchema>;

// ── Tenancy router IO (the tRPC edge validates EXACTLY these) ───────────────

/** `tenancy.me` output. */
export const tenancyMeOutputSchema = z.object({
  v: z.literal(PRISM_TENANCY_CONTRACT_VERSION),
  user: prismUserSchema,
  orgs: z.array(prismOrgSchema),
});
export type TenancyMeOutput = z.infer<typeof tenancyMeOutputSchema>;

/** `tenancy.project.create` input — note: NO owner field (I11). */
export const projectCreateInputSchema = z
  .object({
    name: z.string().min(1).max(200),
    modelOverrideId: z.string().max(120).nullish(),
  })
  .strict();
export type ProjectCreateInput = z.infer<typeof projectCreateInputSchema>;

export const projectGetInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type ProjectGetInput = z.infer<typeof projectGetInputSchema>;

export const projectRenameInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    name: z.string().min(1).max(200),
  })
  .strict();
export type ProjectRenameInput = z.infer<typeof projectRenameInputSchema>;

export const projectSetModelOverrideInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    /** Null clears the override back to the account default (7.2). */
    modelOverrideId: z.string().max(120).nullable(),
  })
  .strict();
export type ProjectSetModelOverrideInput = z.infer<
  typeof projectSetModelOverrideInputSchema
>;

/** Graph payloads are JSON objects (the .prism graph source). The wire cap
 *  guards the JSON edge; the store enforces its own byte ceiling. */
export const graphSaveInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    graph: z.record(z.string(), z.unknown()),
  })
  .strict();
export type GraphSaveInput = z.infer<typeof graphSaveInputSchema>;

export const graphGetInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type GraphGetInput = z.infer<typeof graphGetInputSchema>;

export const versionCreateInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    label: z.string().min(1).max(200),
  })
  .strict();
export type VersionCreateInput = z.infer<typeof versionCreateInputSchema>;

export const versionListInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type VersionListInput = z.infer<typeof versionListInputSchema>;

/** `tenancy.version.restore` (E1 one-click restore, W4). Restores a named
 *  checkpoint's immutable snapshot back onto the live graph. Owner-free
 *  (I11): the tenant is the session, and BOTH the project and the version
 *  must belong to it or the store fails closed. */
export const versionRestoreInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    versionId: prismTenancyIdSchema,
  })
  .strict();
export type VersionRestoreInput = z.infer<typeof versionRestoreInputSchema>;

/** `tenancy.version.restore` output — the restored graph, so the client can
 *  re-verify the round-trip (E1 re-verify hook) without a second fetch. */
export const versionRestoreOutputSchema = z.object({
  version: prismProjectVersionSchema,
  graph: z.record(z.string(), z.unknown()),
});
export type VersionRestoreOutput = z.infer<typeof versionRestoreOutputSchema>;

// ── Project delete / duplicate (W4 gallery card actions) ─────────────────────

export const projectDeleteInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type ProjectDeleteInput = z.infer<typeof projectDeleteInputSchema>;

export const projectDuplicateInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type ProjectDuplicateInput = z.infer<typeof projectDuplicateInputSchema>;

// ── Usage meter + plan tiers (E6 — schema now, billing provider later) ───────

/** One row of the usage meter. `limit === null` means the tier has no cap on
 *  this metric. `used`/`limit` are whole counts in `unit`; the shell renders a
 *  gauge from the ratio and a tier badge from the plan. */
export const prismUsageMetricSchema = z.object({
  key: z.enum(['projects', 'builds', 'credits', 'collaborators']),
  label: z.string().min(1).max(80),
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative().nullable(),
  unit: z.string().min(1).max(24),
});
export type PrismUsageMetric = z.infer<typeof prismUsageMetricSchema>;

/** `tenancy.usage.get` output. `source` names where the numbers came from —
 *  `stub` in v1 (real per-tenant counts + configured quotas; NO billing
 *  provider yet, E6) so the shell can honestly label the meter until Stripe
 *  lands in the testing phase. */
export const prismUsageOutputSchema = z.object({
  v: z.literal(PRISM_TENANCY_CONTRACT_VERSION),
  tier: prismPlanTierSchema,
  source: z.enum(['stub', 'billing']),
  metrics: z.array(prismUsageMetricSchema),
  asOf: z.string().datetime(),
});
export type PrismUsageOutput = z.infer<typeof prismUsageOutputSchema>;
