// PRISM SHELL — INTEGRATIONS ROUTER (SHELL W3 — Integrations + GitHub)
//
// The integrations-concern tRPC surface (spec §10 S6, §12 W3) on the Nango
// spine (decision B). Every procedure is `protectedProcedure` — the tenant is
// derived from the session (I11); no request names another tenant's data.
//
// I5 (HARD): nothing here returns or persists a raw token. `connect` yields a
// capability REFERENCE (via the provider-agnostic CapabilityProvider — Nango
// when keyed, the MCP reference adapter's sandbox offline) and stores it; the
// raw credential stays in the broker's vault. The wire schema
// (`capabilityRefSchema`, `.strict()`) refuses any stray secret key.
//
// Offline/sandbox: with no NANGO_SECRET_KEY the CapabilityProvider factory
// serves the MCP reference adapter, so search + one-click connect work
// headlessly against a real-provider sandbox catalog. Head tiles the offline
// adapter doesn't model still connect via a router-built SANDBOX reference —
// so every curated tile is connectable in the gate.

import 'server-only';
import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import {
  PRISM_INTEGRATIONS_CONTRACT_VERSION,
  capabilityRefSchema,
  catalogListOutputSchema,
  connectInputSchema,
  connectOutputSchema,
  connectionIdInputSchema,
  connectionsListOutputSchema,
  connectorRequestsListOutputSchema,
  githubImportInputSchema,
  githubInstallationsOutputSchema,
  githubInstallUrlOutputSchema,
  githubPrEditPlanInputSchema,
  githubReposInputSchema,
  githubReposOutputSchema,
  integrationSearchInputSchema,
  integrationSearchOutputSchema,
  projectCapabilitiesInputSchema,
  projectCapabilitiesOutputSchema,
  requestConnectorInputSchema,
  unbindCapabilityInputSchema,
  type CapabilityRefWire,
  type CatalogTile,
  type ConnectOutput,
  type GithubImport,
  type IntegrationAuthMethod,
  type IntegrationConnection,
  type ProjectCapabilityBinding,
} from '../../../../packages/shared-interfaces/src/prism-integrations';
import {
  CATALOG_BY_ID,
  INTEGRATION_CATALOG,
  searchCatalog,
} from '../../../lib/shell/integrations/catalog';
import { getCapabilityProvider } from '../../capabilities/capability-provider';
import * as gh from '../../integrations/github-app';
import * as store from '../../tenancy/tenant-store';
import { protectedProcedure, router } from '../init';

function nowIso(): string {
  return new Date().toISOString();
}

/** Display scopes per platform (scope review). Public facts, never secrets. */
function scopesFor(providerId: string, method: IntegrationAuthMethod): string[] {
  const byId: Record<string, string[]> = {
    stripe: ['charges:read', 'payment_intents:write', 'customers:write'],
    shopify: ['read_products', 'read_orders'],
    slack: ['chat:write', 'channels:read'],
    resend: ['emails:send'],
    twilio: ['sms:send', 'calls:read'],
    sendgrid: ['mail:send'],
    supabase: ['database:read', 'database:write', 'auth:read'],
    airtable: ['data.records:read', 'data.records:write'],
    postgres: ['sql:read', 'sql:write'],
    notion: ['content:read', 'content:write'],
    x: ['tweet:read', 'tweet:write', 'users:read'],
    discord: ['bot', 'webhook.incoming'],
  };
  return byId[providerId] ?? [`${providerId}:${method === 'oauth2.1' ? 'read' : 'access'}`];
}

/** Env var NAMES a platform populates in the built app. NAMES only — the values
 *  live in the server vault as capability refs (E5 / I5). */
function envKeysFor(providerId: string): string[] {
  const byId: Record<string, string[]> = {
    stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    shopify: ['SHOPIFY_ADMIN_TOKEN'],
    slack: ['SLACK_BOT_TOKEN'],
    resend: ['RESEND_API_KEY'],
    twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    sendgrid: ['SENDGRID_API_KEY'],
    supabase: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    airtable: ['AIRTABLE_TOKEN'],
    postgres: ['DATABASE_URL'],
    notion: ['NOTION_TOKEN'],
    x: ['X_API_KEY', 'X_API_SECRET'],
    discord: ['DISCORD_BOT_TOKEN'],
  };
  return byId[providerId] ?? [`${providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_TOKEN`];
}

/** Narrow an adapter CapabilityRef (loose `[k]: unknown`) to the strict wire
 *  shape — parse strips anything that isn't an allowed non-secret field. */
function toWireRef(
  raw: { refId: string; scope: string; label?: string; provider?: unknown; connectionId?: unknown },
  input: { providerId: string; method: IntegrationAuthMethod },
): CapabilityRefWire {
  return capabilityRefSchema.parse({
    refId: raw.refId,
    scope: raw.scope,
    label: raw.label,
    provider: typeof raw.provider === 'string' ? raw.provider : 'mcp',
    authMethod: input.method,
    integrationId: input.providerId,
    connectionId:
      typeof raw.connectionId === 'string' ? raw.connectionId : input.providerId,
  });
}

/** A router-built SANDBOX reference for a head tile the offline adapter does
 *  not model. Still a reference only (no token). */
function sandboxRef(input: {
  providerId: string;
  method: IntegrationAuthMethod;
}): CapabilityRefWire {
  const tile = CATALOG_BY_ID.get(input.providerId);
  return capabilityRefSchema.parse({
    refId: `sandbox:${input.providerId}:${input.method}`,
    scope: `${input.providerId}:connect`,
    label: `${tile?.label ?? input.providerId} (${input.method})`,
    provider: 'sandbox',
    authMethod: input.method,
    integrationId: input.providerId,
    connectionId: `sandbox-${input.providerId}`,
  });
}

/** Map an MCP/provider PlatformDescriptor to a catalog tile (enriches search
 *  hits beyond the curated head). */
function descriptorToTile(d: {
  platformId: string;
  platform: string;
  brandKey: string;
  authMethods: IntegrationAuthMethod[];
  category?: string;
  description?: string;
}): CatalogTile {
  return {
    providerId: d.platformId,
    label: d.platform,
    brandMark: d.brandKey,
    category: d.category ?? 'Other',
    hint: d.description?.slice(0, 120),
    authMethods: d.authMethods.length ? d.authMethods : ['api-token'],
  };
}

export const integrationsRouter = router({
  /** The curated head catalog (config-driven). */
  catalog: protectedProcedure.query(() =>
    catalogListOutputSchema.parse({
      v: PRISM_INTEGRATIONS_CONTRACT_VERSION,
      tiles: INTEGRATION_CATALOG,
    }),
  ),

  /** Connect-anything search (decision C rider). Catalog + provider hits; on a
   *  MISS the client leads with the connector request path. */
  search: protectedProcedure
    .input(integrationSearchInputSchema)
    .query(async ({ input }) => {
      const limit = input.limit ?? 24;
      const catalogHits = searchCatalog(input.query, limit);
      const seen = new Set(catalogHits.map((t) => t.providerId));
      let providerHits: CatalogTile[] = [];
      try {
        const descriptors = await getCapabilityProvider().searchPlatforms(input.query, limit);
        providerHits = descriptors
          .filter((d) => !seen.has(d.platformId))
          .map(descriptorToTile);
      } catch {
        providerHits = [];
      }
      const hits = [...catalogHits, ...providerHits].slice(0, limit);
      return integrationSearchOutputSchema.parse({
        v: PRISM_INTEGRATIONS_CONTRACT_VERSION,
        query: input.query,
        hits,
        miss: input.query.trim().length > 0 && hits.length === 0,
      });
    }),

  /** One-click connect (C2). Yields a capability REFERENCE, stores the
   *  connection, and (when a project is named) binds it to the project (E5).
   *  Sandbox offline; live Nango when keyed — same shape, no UI rework. */
  connect: protectedProcedure
    .input(connectInputSchema)
    .mutation(async ({ ctx, input }): Promise<ConnectOutput> => {
      const tenant = ctx.session.user.id;
      const tile = CATALOG_BY_ID.get(input.providerId);
      if (tile && !tile.authMethods.includes(input.method)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${tile.label} does not support ${input.method}`,
        });
      }

      const provider = getCapabilityProvider();
      const connectArgs = { providerId: input.providerId, method: input.method };
      let refWire: CapabilityRefWire | null = null;
      let authUrl: string | null = null;
      try {
        const r = await provider.connect({ platformId: input.providerId, method: input.method });
        if (r.ok && r.capabilityRef) {
          refWire = toWireRef(r.capabilityRef, connectArgs);
          authUrl = r.authUrl ?? null;
        }
      } catch {
        refWire = null;
      }
      if (!refWire) {
        // The offline adapter doesn't model this head tile — sandbox reference.
        refWire = sandboxRef(connectArgs);
        authUrl =
          input.method === 'oauth2.1'
            ? `prism-sandbox://connect/${input.providerId}`
            : null;
      }

      // Live Nango leaves the connection PENDING until the hosted flow finishes;
      // the sandbox completes synthetically so the gate lands a usable ref.
      const status: IntegrationConnection['status'] = provider.live ? 'pending' : 'connected';
      const connection: IntegrationConnection = {
        id: `conn-${randomUUID()}`,
        providerId: input.providerId,
        platform: tile?.label ?? refWire.label ?? input.providerId,
        brandMark: tile?.brandMark ?? input.providerId,
        authMethod: input.method,
        status,
        capabilityRef: refWire,
        scopes: scopesFor(input.providerId, input.method),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      const saved = await store.addConnection(tenant, connection);

      let binding: ProjectCapabilityBinding | null = null;
      if (input.projectId) {
        const candidate: ProjectCapabilityBinding = {
          id: `bind-${randomUUID()}`,
          connectionId: saved.id,
          providerId: input.providerId,
          label: saved.platform,
          capabilityRef: refWire,
          scopes: saved.scopes,
          envKeys: envKeysFor(input.providerId),
          createdAt: nowIso(),
        };
        // Fails closed to null if the project isn't this tenant's (I11).
        binding = await store.addProjectBinding(tenant, input.projectId, candidate);
      }

      return connectOutputSchema.parse({
        v: PRISM_INTEGRATIONS_CONTRACT_VERSION,
        connection: saved,
        authUrl,
        binding,
      });
    }),

  connections: router({
    list: protectedProcedure.query(async ({ ctx }) =>
      connectionsListOutputSchema.parse({
        v: PRISM_INTEGRATIONS_CONTRACT_VERSION,
        connections: await store.listConnections(ctx.session.user.id),
      }),
    ),

    /** Re-auth — refresh the connection (sandbox marks it connected again and
     *  returns a fresh hosted URL). */
    reauth: protectedProcedure
      .input(connectionIdInputSchema)
      .mutation(async ({ ctx, input }) => {
        const provider = getCapabilityProvider();
        const updated = await store.updateConnection(
          ctx.session.user.id,
          input.connectionId,
          (c) => ({ ...c, status: provider.live ? 'pending' : 'connected' }),
        );
        if (!updated) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found.' });
        }
        const authUrl =
          updated.authMethod === 'oauth2.1'
            ? provider.live
              ? `nango://reauth/${updated.providerId}`
              : `prism-sandbox://connect/${updated.providerId}`
            : null;
        return { v: PRISM_INTEGRATIONS_CONTRACT_VERSION, connection: updated, authUrl };
      }),

    /** Revoke — remove the connection AND sweep any project bindings that
     *  reference it (no dangling capability refs). */
    revoke: protectedProcedure
      .input(connectionIdInputSchema)
      .mutation(async ({ ctx, input }) => {
        const tenant = ctx.session.user.id;
        const removed = await store.removeConnection(tenant, input.connectionId);
        if (!removed) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found.' });
        }
        const projects = await store.listProjects(tenant);
        for (const p of projects) {
          const pi = await store.getProjectIntegrations(tenant, p.id);
          if (!pi) continue;
          for (const b of pi.bindings) {
            if (b.connectionId === input.connectionId) {
              await store.removeProjectBinding(tenant, p.id, b.id);
            }
          }
        }
        return { v: PRISM_INTEGRATIONS_CONTRACT_VERSION, revoked: true };
      }),
  }),

  /** The "connect anything" long-tail queue record (decision C rider). The
   *  authoring agent is W5+ scope — this is the QUEUE CONTRACT. */
  requestConnector: protectedProcedure
    .input(requestConnectorInputSchema)
    .mutation(async ({ ctx, input }) => {
      const record = await store.addConnectorRequest(ctx.session.user.id, {
        id: `req-${randomUUID()}`,
        platform: input.platform,
        note: input.note,
        origin: input.origin,
        projectId: input.projectId ?? null,
        status: 'queued',
        createdAt: nowIso(),
      });
      return { v: PRISM_INTEGRATIONS_CONTRACT_VERSION, request: record };
    }),

  connectorRequests: protectedProcedure.query(async ({ ctx }) =>
    connectorRequestsListOutputSchema.parse({
      v: PRISM_INTEGRATIONS_CONTRACT_VERSION,
      requests: await store.listConnectorRequests(ctx.session.user.id),
    }),
  ),

  // ── GitHub App (installation/repo selection + PR-based edit path, I7) ──────
  github: router({
    installUrl: protectedProcedure.query(() =>
      githubInstallUrlOutputSchema.parse({
        v: PRISM_INTEGRATIONS_CONTRACT_VERSION,
        ...gh.installUrl(),
      }),
    ),

    installations: protectedProcedure.query(async () =>
      githubInstallationsOutputSchema.parse({
        v: PRISM_INTEGRATIONS_CONTRACT_VERSION,
        installations: await gh.listInstallations(),
      }),
    ),

    repos: protectedProcedure
      .input(githubReposInputSchema)
      .query(async ({ input }) =>
        githubReposOutputSchema.parse({
          v: PRISM_INTEGRATIONS_CONTRACT_VERSION,
          repos: await gh.listRepos(input.installationId),
        }),
      ),

    /** Import a repo into a project (wired to the intake GitHub card). Stores a
     *  capability REFERENCE to the installation — never a token. */
    importRepo: protectedProcedure
      .input(githubImportInputSchema)
      .mutation(async ({ ctx, input }) => {
        const record: GithubImport = {
          id: `ghimp-${randomUUID()}`,
          installationId: input.installationId,
          repoFullName: input.repoFullName,
          projectId: input.projectId,
          capabilityRef: gh.capabilityRefForInstallation(input.installationId),
          createdAt: nowIso(),
        };
        const saved = await store.setGithubImport(
          ctx.session.user.id,
          input.projectId,
          record,
        );
        if (!saved) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
        }
        return { v: PRISM_INTEGRATIONS_CONTRACT_VERSION, githubImport: saved };
      }),

    /** The PR-based edit path contract for a production app (I7). */
    prEditPlan: protectedProcedure
      .input(githubPrEditPlanInputSchema)
      .query(async ({ ctx, input }) => {
        const owned = await store.getProject(ctx.session.user.id, input.projectId);
        if (!owned) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
        }
        return {
          v: PRISM_INTEGRATIONS_CONTRACT_VERSION,
          plan: gh.prEditPlan({
            repoFullName: input.repoFullName,
            description: input.description,
          }),
        };
      }),
  }),

  // ── E5 — per-app env / capability panel (references only, scope review) ────
  project: router({
    capabilities: protectedProcedure
      .input(projectCapabilitiesInputSchema)
      .query(async ({ ctx, input }) => {
        const pi = await store.getProjectIntegrations(ctx.session.user.id, input.projectId);
        if (!pi) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
        }
        return projectCapabilitiesOutputSchema.parse({
          v: PRISM_INTEGRATIONS_CONTRACT_VERSION,
          bindings: pi.bindings,
          githubImport: pi.githubImport,
        });
      }),

    unbindCapability: protectedProcedure
      .input(unbindCapabilityInputSchema)
      .mutation(async ({ ctx, input }) => {
        const ok = await store.removeProjectBinding(
          ctx.session.user.id,
          input.projectId,
          input.bindingId,
        );
        if (!ok) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Binding not found.' });
        }
        return { v: PRISM_INTEGRATIONS_CONTRACT_VERSION, unbound: true };
      }),
  }),
});
