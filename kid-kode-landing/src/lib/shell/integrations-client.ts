'use client';

// PRISM SHELL — INTEGRATIONS CLIENT (SHELL W3)
//
// Client half of the integrations tRPC surface (same link discipline as
// tenancy-client.ts / intake-client.ts). Identity is NEVER sent — the server
// derives the tenant from the session cookie (I11). Every response is
// RE-VALIDATED against the Zod contract at this edge (the consumer trusts the
// contract, not the transport typing) — and the strict capability-ref schema
// guarantees no token can ride a response into client state (I5).

import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from '../../server/trpc/router';
import {
  catalogListOutputSchema,
  connectOutputSchema,
  connectionsListOutputSchema,
  connectorRequestsListOutputSchema,
  githubImportSchema,
  githubInstallationsOutputSchema,
  githubInstallUrlOutputSchema,
  githubPrEditPlanSchema,
  githubReposOutputSchema,
  integrationSearchOutputSchema,
  projectCapabilitiesOutputSchema,
  connectorRequestSchema,
  type CatalogListOutput,
  type ConnectInput,
  type ConnectOutput,
  type ConnectionsListOutput,
  type ConnectorRequest,
  type ConnectorRequestsListOutput,
  type GithubImport,
  type GithubImportInput,
  type GithubInstallationsOutput,
  type GithubInstallUrlOutput,
  type GithubPrEditPlan,
  type GithubReposOutput,
  type IntegrationSearchInput,
  type IntegrationSearchOutput,
  type ProjectCapabilitiesOutput,
  type RequestConnectorInput,
} from '../../../packages/shared-interfaces/src/prism-integrations';

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchStreamLink({ url: '/api/trpc' })],
});

export async function fetchCatalog(): Promise<CatalogListOutput> {
  return catalogListOutputSchema.parse(await trpc.integrations.catalog.query());
}

export async function searchIntegrations(
  input: IntegrationSearchInput,
): Promise<IntegrationSearchOutput> {
  return integrationSearchOutputSchema.parse(
    await trpc.integrations.search.query(input),
  );
}

export async function connectIntegration(input: ConnectInput): Promise<ConnectOutput> {
  return connectOutputSchema.parse(await trpc.integrations.connect.mutate(input));
}

export async function listConnections(): Promise<ConnectionsListOutput> {
  return connectionsListOutputSchema.parse(
    await trpc.integrations.connections.list.query(),
  );
}

export async function reauthConnection(connectionId: string) {
  return trpc.integrations.connections.reauth.mutate({ connectionId });
}

export async function revokeConnection(connectionId: string) {
  return trpc.integrations.connections.revoke.mutate({ connectionId });
}

export async function requestConnector(
  input: RequestConnectorInput,
): Promise<ConnectorRequest> {
  const res = await trpc.integrations.requestConnector.mutate(input);
  return connectorRequestSchema.parse(res.request);
}

export async function listConnectorRequests(): Promise<ConnectorRequestsListOutput> {
  return connectorRequestsListOutputSchema.parse(
    await trpc.integrations.connectorRequests.query(),
  );
}

// ── GitHub ────────────────────────────────────────────────────────────────────

export async function githubInstallUrl(): Promise<GithubInstallUrlOutput> {
  return githubInstallUrlOutputSchema.parse(
    await trpc.integrations.github.installUrl.query(),
  );
}

export async function githubInstallations(): Promise<GithubInstallationsOutput> {
  return githubInstallationsOutputSchema.parse(
    await trpc.integrations.github.installations.query(),
  );
}

export async function githubRepos(installationId: string): Promise<GithubReposOutput> {
  return githubReposOutputSchema.parse(
    await trpc.integrations.github.repos.query({ installationId }),
  );
}

export async function githubImportRepo(input: GithubImportInput): Promise<GithubImport> {
  const res = await trpc.integrations.github.importRepo.mutate(input);
  return githubImportSchema.parse(res.githubImport);
}

export async function githubPrEditPlan(input: {
  projectId: string;
  repoFullName: string;
  description: string;
}): Promise<GithubPrEditPlan> {
  const res = await trpc.integrations.github.prEditPlan.query(input);
  return githubPrEditPlanSchema.parse(res.plan);
}

// ── E5 per-app capabilities ────────────────────────────────────────────────────

export async function projectCapabilities(
  projectId: string,
): Promise<ProjectCapabilitiesOutput> {
  return projectCapabilitiesOutputSchema.parse(
    await trpc.integrations.project.capabilities.query({ projectId }),
  );
}

export async function unbindCapability(projectId: string, bindingId: string) {
  return trpc.integrations.project.unbindCapability.mutate({ projectId, bindingId });
}
