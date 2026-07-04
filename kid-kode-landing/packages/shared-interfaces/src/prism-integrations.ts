// PRISM SHELL — INTEGRATIONS + GITHUB CONTRACT — prism-integrations.ts (SHELL W3)
//
// Contract-first (spec I4) shapes for the Integrations surface (spec §10 S6,
// §12 W3) built on the Nango spine (decision B — Nango SOLO) with the
// "connect anything" rider (decision C — the search-any-platform affordance
// LEADS; a catalog miss flows into the agent-authored-connector request path).
//
// SECURITY DISCIPLINE (spec I5 / INV-R13, HARD):
//   - NOTHING here carries a raw token, secret, key, or credential. Every
//     connection is a CAPABILITY REFERENCE only (provider + opaque ids). The
//     raw credential lives in Nango's vault (or the server-side secrets vault)
//     and is resolved server-side with audit logging — it never crosses this
//     wire, never enters state, logs, URLs, or graph data.
//   - `capabilityRefSchema` is `.strict()` and enumerates ONLY non-secret
//     fields, so a token can't ride along even by accident (the schema refuses
//     unknown keys at the edge).
//
// TENANT ISOLATION (spec I11): note what is ABSENT from every request schema —
// a tenant/owner id. The owning tenant is derived server-side from the Better
// Auth session; the contract makes cross-tenant requests inexpressible.
//
// Discipline: ADDITIVE ONLY — never remove or repurpose a field/variant.

import { z } from 'zod';
import { prismTenancyIdSchema } from './prism-tenancy';

/** Wire version for the integrations surface. */
export const PRISM_INTEGRATIONS_CONTRACT_VERSION = 1 as const;

// ── Auth methods (mirror lib/prism-graph IntegrationAuthMethod, C2) ──────────

export const integrationAuthMethodSchema = z.enum([
  'oauth2.1',
  'mcp',
  'api-token',
  'cli',
]);
export type IntegrationAuthMethod = z.infer<typeof integrationAuthMethodSchema>;

/** Curated-catalog category buckets (config-driven head; task 3). Open-ended
 *  string at persistence so new buckets add without a contract bump. */
export const integrationCategorySchema = z.string().min(1).max(40);
export type IntegrationCategory = z.infer<typeof integrationCategorySchema>;

// ── Capability reference (references ONLY — the I5 wall) ──────────────────────

/** A capability REFERENCE — the only integration artifact Prism ever holds
 *  client-side or persists in project data. `.strict()` so no token/secret key
 *  can smuggle through. Mirrors lib/prism-graph CapabilityRef's non-secret
 *  fields plus the shell's connection metadata. */
export const capabilityRefSchema = z
  .object({
    /** Stable non-secret reference id (e.g. `nango:stripe:conn_x`). */
    refId: z.string().min(1).max(200),
    /** Access scope the vault checks server-side (e.g. `stripe:connect`). */
    scope: z.string().min(1).max(200),
    /** Display label ("Stripe (oauth2.1)"). Never a secret. */
    label: z.string().max(200).optional(),
    /** The broker that owns the credential ('nango' | 'mcp' | 'github'). */
    provider: z.string().min(1).max(60),
    authMethod: integrationAuthMethodSchema,
    /** Provider integration key (e.g. 'stripe'). Non-secret. */
    integrationId: z.string().max(120).optional(),
    /** Provider connection id. Opaque, non-secret — the vault resolves the
     *  live credential from it server-side, never the client. */
    connectionId: z.string().max(200).optional(),
  })
  .strict();
export type CapabilityRefWire = z.infer<typeof capabilityRefSchema>;

// ── Catalog tiles (curated head; config-driven ~12) ──────────────────────────

/** A connectable platform tile. Shared by the Integrations surface AND the W2
 *  intake connect card (task 6 — intake tiles bind to THIS catalog). */
export const catalogTileSchema = z.object({
  /** Provider/platform key — also the brand-mark key (real logo). */
  providerId: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  /** Brand-mark key for the 3D brand glyph (DL15). Defaults to providerId. */
  brandMark: z.string().min(1).max(80),
  category: integrationCategorySchema,
  hint: z.string().max(120).optional(),
  authMethods: z.array(integrationAuthMethodSchema).min(1).max(4),
});
export type CatalogTile = z.infer<typeof catalogTileSchema>;

// ── Connections (a connected account — managed: re-auth/revoke/scope) ─────────

export const connectionStatusSchema = z.enum([
  /** Connect session opened; hosted authorization not yet completed. */
  'pending',
  /** Authorized and usable. */
  'connected',
  /** Credential expired/withdrawn — needs re-auth. */
  'needs-reauth',
  /** User revoked — retained as a tombstone-free removal (deleted from list). */
  'revoked',
]);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

/** A connected third-party account for this tenant. Carries a capability
 *  REFERENCE only (I5). Managed via re-auth / revoke / scope-review. */
export const integrationConnectionSchema = z.object({
  id: prismTenancyIdSchema,
  providerId: z.string().min(1).max(80),
  platform: z.string().min(1).max(80),
  brandMark: z.string().min(1).max(80),
  authMethod: integrationAuthMethodSchema,
  status: connectionStatusSchema,
  capabilityRef: capabilityRefSchema,
  /** OAuth-style scopes the connection carries (display + scope review). Each
   *  is a plain scope string, never a secret. */
  scopes: z.array(z.string().min(1).max(120)).max(40),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type IntegrationConnection = z.infer<typeof integrationConnectionSchema>;

// ── Connector requests (long-tail — the "connect anything" queue, decision C) ─

export const connectorRequestStatusSchema = z.enum([
  'queued',
  'authoring',
  'ready',
  'declined',
]);
export type ConnectorRequestStatus = z.infer<typeof connectorRequestStatusSchema>;

/** A record that the user asked Prism to author a connector for a platform the
 *  curated catalog missed. The authoring AGENT is W5+ scope — this is the
 *  QUEUE CONTRACT now (task 1). */
export const connectorRequestSchema = z.object({
  id: prismTenancyIdSchema,
  /** What the user typed / named ("Acme CRM", "my internal API"). */
  platform: z.string().min(1).max(160),
  note: z.string().max(2000).optional(),
  /** Where the ask originated (surface search vs intake). */
  origin: z.enum(['integrations', 'intake', 'builder']),
  /** Optional project the request is scoped to. */
  projectId: prismTenancyIdSchema.nullish(),
  status: connectorRequestStatusSchema,
  createdAt: z.string().datetime(),
});
export type ConnectorRequest = z.infer<typeof connectorRequestSchema>;

// ── GitHub App (installations, repos, import, PR-based edit path — I7) ────────

export const githubInstallationSchema = z.object({
  /** GitHub installation id (opaque, non-secret). */
  installationId: z.string().min(1).max(120),
  /** Account the App is installed on ("acme-inc"). */
  account: z.string().min(1).max(120),
  accountType: z.enum(['User', 'Organization']),
  /** Whether this is a real installation or the sandbox/mock (creds absent). */
  sandbox: z.boolean(),
  createdAt: z.string().datetime(),
});
export type GithubInstallation = z.infer<typeof githubInstallationSchema>;

export const githubRepoSchema = z.object({
  /** "owner/name". */
  fullName: z.string().min(1).max(200),
  private: z.boolean(),
  defaultBranch: z.string().min(1).max(120),
  description: z.string().max(300).nullish(),
});
export type GithubRepo = z.infer<typeof githubRepoSchema>;

/** A repo imported into a project (wired to the intake GitHub card). Stores a
 *  capability REFERENCE to the installation, never a token. */
export const githubImportSchema = z.object({
  id: prismTenancyIdSchema,
  installationId: z.string().min(1).max(120),
  repoFullName: z.string().min(1).max(200),
  projectId: prismTenancyIdSchema,
  capabilityRef: capabilityRefSchema,
  createdAt: z.string().datetime(),
});
export type GithubImport = z.infer<typeof githubImportSchema>;

/** The PR-based edit path CONTRACT for a production app (I7 — no force-push,
 *  per-action confirm for anything irreversible). This is the plan the shell
 *  shows before any prod edit; execution lands with W5's build orchestrator. */
export const githubPrEditPlanSchema = z.object({
  repoFullName: z.string().min(1).max(200),
  /** New branch the edit is authored on (never a push to default). */
  branch: z.string().min(1).max(200),
  baseBranch: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  summary: z.string().max(2000),
  /** Ordered actions; any `irreversible` step needs explicit per-action
   *  confirmation (I7). `forcePush` is always false (never permitted). */
  actions: z
    .array(
      z.object({
        label: z.string().min(1).max(160),
        irreversible: z.boolean(),
        requiresConfirm: z.boolean(),
      }),
    )
    .max(40),
  forcePush: z.literal(false),
});
export type GithubPrEditPlan = z.infer<typeof githubPrEditPlanSchema>;

// ── E5 — per-app env / capability panel (references only; scope review) ──────

/** One capability a project uses — a REFERENCE into a tenant connection, with
 *  the scopes it exercises (scope review). No raw env value ever appears; env
 *  keys are NAMES bound to capability refs, resolved server-side (E5 / I5). */
export const projectCapabilityBindingSchema = z.object({
  id: prismTenancyIdSchema,
  /** The tenant connection this binding references. */
  connectionId: prismTenancyIdSchema,
  providerId: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  capabilityRef: capabilityRefSchema,
  /** Scopes this project actually uses from the connection (scope review). */
  scopes: z.array(z.string().min(1).max(120)).max(40),
  /** Env var NAMES this capability populates in the built app (values live in
   *  the server vault as refs; the name↔ref map is all the client sees). */
  envKeys: z.array(z.string().min(1).max(120)).max(40),
  createdAt: z.string().datetime(),
});
export type ProjectCapabilityBinding = z.infer<typeof projectCapabilityBindingSchema>;

// ── Router IO (the tRPC edge validates EXACTLY these) ─────────────────────────

export const catalogListOutputSchema = z.object({
  v: z.literal(PRISM_INTEGRATIONS_CONTRACT_VERSION),
  tiles: z.array(catalogTileSchema).max(200),
});
export type CatalogListOutput = z.infer<typeof catalogListOutputSchema>;

export const integrationSearchInputSchema = z
  .object({ query: z.string().max(160), limit: z.number().int().min(1).max(48).optional() })
  .strict();
export type IntegrationSearchInput = z.infer<typeof integrationSearchInputSchema>;

/** Search result — catalog/provider HITS plus a MISS flag. On a miss the UI
 *  offers the connector request path (decision C rider). */
export const integrationSearchOutputSchema = z.object({
  v: z.literal(PRISM_INTEGRATIONS_CONTRACT_VERSION),
  query: z.string().max(160),
  hits: z.array(catalogTileSchema).max(48),
  /** True when nothing matched — the connect-anything request path leads. */
  miss: z.boolean(),
});
export type IntegrationSearchOutput = z.infer<typeof integrationSearchOutputSchema>;

export const connectInputSchema = z
  .object({
    providerId: z.string().min(1).max(80),
    method: integrationAuthMethodSchema,
    /** Optional project to bind the resulting capability to (E5). */
    projectId: prismTenancyIdSchema.nullish(),
  })
  .strict();
export type ConnectInput = z.infer<typeof connectInputSchema>;

export const connectOutputSchema = z.object({
  v: z.literal(PRISM_INTEGRATIONS_CONTRACT_VERSION),
  connection: integrationConnectionSchema,
  /** Hosted authorization URL (Nango Connect / sandbox sentinel). Opening it is
   *  the white-label handoff; the ref is already stored. */
  authUrl: z.string().max(2048).nullable(),
  /** The project binding created, when a projectId was supplied. */
  binding: projectCapabilityBindingSchema.nullable(),
});
export type ConnectOutput = z.infer<typeof connectOutputSchema>;

export const connectionIdInputSchema = z
  .object({ connectionId: prismTenancyIdSchema })
  .strict();
export type ConnectionIdInput = z.infer<typeof connectionIdInputSchema>;

export const connectionsListOutputSchema = z.object({
  v: z.literal(PRISM_INTEGRATIONS_CONTRACT_VERSION),
  connections: z.array(integrationConnectionSchema).max(200),
});
export type ConnectionsListOutput = z.infer<typeof connectionsListOutputSchema>;

export const requestConnectorInputSchema = z
  .object({
    platform: z.string().min(1).max(160),
    note: z.string().max(2000).optional(),
    origin: z.enum(['integrations', 'intake', 'builder']).default('integrations'),
    projectId: prismTenancyIdSchema.nullish(),
  })
  .strict();
export type RequestConnectorInput = z.infer<typeof requestConnectorInputSchema>;

export const connectorRequestsListOutputSchema = z.object({
  v: z.literal(PRISM_INTEGRATIONS_CONTRACT_VERSION),
  requests: z.array(connectorRequestSchema).max(200),
});
export type ConnectorRequestsListOutput = z.infer<typeof connectorRequestsListOutputSchema>;

// GitHub IO
export const githubInstallUrlOutputSchema = z.object({
  v: z.literal(PRISM_INTEGRATIONS_CONTRACT_VERSION),
  url: z.string().max(2048),
  sandbox: z.boolean(),
});
export type GithubInstallUrlOutput = z.infer<typeof githubInstallUrlOutputSchema>;

export const githubInstallationsOutputSchema = z.object({
  v: z.literal(PRISM_INTEGRATIONS_CONTRACT_VERSION),
  installations: z.array(githubInstallationSchema).max(100),
});
export type GithubInstallationsOutput = z.infer<typeof githubInstallationsOutputSchema>;

export const githubReposInputSchema = z
  .object({ installationId: z.string().min(1).max(120) })
  .strict();
export type GithubReposInput = z.infer<typeof githubReposInputSchema>;

export const githubReposOutputSchema = z.object({
  v: z.literal(PRISM_INTEGRATIONS_CONTRACT_VERSION),
  repos: z.array(githubRepoSchema).max(200),
});
export type GithubReposOutput = z.infer<typeof githubReposOutputSchema>;

export const githubImportInputSchema = z
  .object({
    installationId: z.string().min(1).max(120),
    repoFullName: z.string().min(1).max(200),
    projectId: prismTenancyIdSchema,
  })
  .strict();
export type GithubImportInput = z.infer<typeof githubImportInputSchema>;

export const githubPrEditPlanInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    repoFullName: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
  })
  .strict();
export type GithubPrEditPlanInput = z.infer<typeof githubPrEditPlanInputSchema>;

// E5 IO
export const projectCapabilitiesInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type ProjectCapabilitiesInput = z.infer<typeof projectCapabilitiesInputSchema>;

export const projectCapabilitiesOutputSchema = z.object({
  v: z.literal(PRISM_INTEGRATIONS_CONTRACT_VERSION),
  bindings: z.array(projectCapabilityBindingSchema).max(200),
  githubImport: githubImportSchema.nullable(),
});
export type ProjectCapabilitiesOutput = z.infer<typeof projectCapabilitiesOutputSchema>;

export const unbindCapabilityInputSchema = z
  .object({ projectId: prismTenancyIdSchema, bindingId: prismTenancyIdSchema })
  .strict();
export type UnbindCapabilityInput = z.infer<typeof unbindCapabilityInputSchema>;
