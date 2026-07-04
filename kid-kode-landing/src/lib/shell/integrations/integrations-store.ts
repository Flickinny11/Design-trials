'use client';

// PRISM SHELL — INTEGRATIONS STORE (SHELL W3, spec I3 — one store per concern)
//
// The single Zustand store for the Integrations surface. Holds catalog +
// search + connections + connector requests + GitHub + the per-app (E5)
// capability panel, and the async actions that talk to the tRPC client. State
// carries capability REFERENCES only (I5) — the wire schemas already refused
// any token before it reached here.

import { create } from 'zustand';
import type {
  CatalogTile,
  ConnectorRequest,
  GithubImport,
  GithubInstallation,
  GithubPrEditPlan,
  GithubRepo,
  IntegrationAuthMethod,
  IntegrationConnection,
  IntegrationSearchOutput,
  ProjectCapabilityBinding,
} from '../../../../packages/shared-interfaces/src/prism-integrations';
import * as client from '../integrations-client';

interface ConnectResultView {
  connection: IntegrationConnection;
  authUrl: string | null;
  boundToProject: boolean;
}

interface IntegrationsState {
  projectId: string | null;

  // Catalog + search (connect-anything LEADS).
  catalog: CatalogTile[];
  query: string;
  search: IntegrationSearchOutput | null;
  searching: boolean;

  // Connections + long-tail requests.
  connections: IntegrationConnection[];
  requests: ConnectorRequest[];

  // White-label connect modal.
  modalTile: CatalogTile | null;
  connecting: boolean;
  lastConnect: ConnectResultView | null;

  // GitHub App.
  githubInstallUrl: string | null;
  githubSandbox: boolean;
  installations: GithubInstallation[];
  reposByInstall: Record<string, GithubRepo[]>;
  githubBusy: boolean;
  prPlan: GithubPrEditPlan | null;

  // E5 per-app panel.
  bindings: ProjectCapabilityBinding[];
  projectGithubImport: GithubImport | null;

  error: string | null;

  init: (projectId: string | null) => Promise<void>;
  setQuery: (q: string) => void;
  runSearch: () => Promise<void>;
  openConnect: (tile: CatalogTile) => void;
  closeConnect: () => void;
  confirmConnect: (method: IntegrationAuthMethod) => Promise<void>;
  reauth: (connectionId: string) => Promise<void>;
  revoke: (connectionId: string) => Promise<void>;
  submitConnectorRequest: (platform: string, note?: string) => Promise<void>;
  loadRepos: (installationId: string) => Promise<void>;
  importRepo: (installationId: string, repoFullName: string) => Promise<void>;
  loadPrPlan: (repoFullName: string, description: string) => Promise<void>;
  unbind: (bindingId: string) => Promise<void>;
  refreshProject: () => Promise<void>;
}

export const useIntegrationsStore = create<IntegrationsState>((set, get) => ({
  projectId: null,
  catalog: [],
  query: '',
  search: null,
  searching: false,
  connections: [],
  requests: [],
  modalTile: null,
  connecting: false,
  lastConnect: null,
  githubInstallUrl: null,
  githubSandbox: true,
  installations: [],
  reposByInstall: {},
  githubBusy: false,
  prPlan: null,
  bindings: [],
  projectGithubImport: null,
  error: null,

  init: async (projectId) => {
    set({ projectId });
    try {
      const [catalog, conns, reqs, installUrl, installs] = await Promise.all([
        client.fetchCatalog(),
        client.listConnections(),
        client.listConnectorRequests(),
        client.githubInstallUrl(),
        client.githubInstallations(),
      ]);
      set({
        catalog: catalog.tiles,
        connections: conns.connections,
        requests: reqs.requests,
        githubInstallUrl: installUrl.url,
        githubSandbox: installUrl.sandbox,
        installations: installs.installations,
      });
      if (projectId) await get().refreshProject();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load integrations' });
    }
  },

  setQuery: (q) => set({ query: q }),

  runSearch: async () => {
    const q = get().query;
    if (!q.trim()) {
      set({ search: null, searching: false });
      return;
    }
    set({ searching: true });
    try {
      const res = await client.searchIntegrations({ query: q });
      // Only apply if the query is still current (guards fast typing).
      if (get().query === q) set({ search: res, searching: false });
    } catch (err) {
      set({ searching: false, error: err instanceof Error ? err.message : 'Search failed' });
    }
  },

  openConnect: (tile) => set({ modalTile: tile, lastConnect: null }),
  closeConnect: () => set({ modalTile: null, connecting: false }),

  confirmConnect: async (method) => {
    const tile = get().modalTile;
    if (!tile) return;
    set({ connecting: true, error: null });
    try {
      const res = await client.connectIntegration({
        providerId: tile.providerId,
        method,
        projectId: get().projectId ?? undefined,
      });
      set((s) => ({
        connecting: false,
        connections: [
          ...s.connections.filter((c) => c.providerId !== res.connection.providerId),
          res.connection,
        ],
        lastConnect: {
          connection: res.connection,
          authUrl: res.authUrl,
          boundToProject: res.binding !== null,
        },
      }));
      if (get().projectId) await get().refreshProject();
    } catch (err) {
      set({ connecting: false, error: err instanceof Error ? err.message : 'Connect failed' });
    }
  },

  reauth: async (connectionId) => {
    try {
      const res = await client.reauthConnection(connectionId);
      set((s) => ({
        connections: s.connections.map((c) =>
          c.id === connectionId ? res.connection : c,
        ),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Re-auth failed' });
    }
  },

  revoke: async (connectionId) => {
    try {
      await client.revokeConnection(connectionId);
      set((s) => ({ connections: s.connections.filter((c) => c.id !== connectionId) }));
      if (get().projectId) await get().refreshProject();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Revoke failed' });
    }
  },

  submitConnectorRequest: async (platform, note) => {
    try {
      const record = await client.requestConnector({
        platform,
        note,
        origin: 'integrations',
        projectId: get().projectId ?? undefined,
      });
      set((s) => ({ requests: [...s.requests, record] }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Request failed' });
    }
  },

  loadRepos: async (installationId) => {
    set({ githubBusy: true });
    try {
      const res = await client.githubRepos(installationId);
      set((s) => ({
        githubBusy: false,
        reposByInstall: { ...s.reposByInstall, [installationId]: res.repos },
      }));
    } catch (err) {
      set({ githubBusy: false, error: err instanceof Error ? err.message : 'Repo list failed' });
    }
  },

  importRepo: async (installationId, repoFullName) => {
    const projectId = get().projectId;
    if (!projectId) {
      set({ error: 'Open a project to import a repo into it.' });
      return;
    }
    set({ githubBusy: true });
    try {
      const imported = await client.githubImportRepo({ installationId, repoFullName, projectId });
      set({ githubBusy: false, projectGithubImport: imported });
      await get().refreshProject();
    } catch (err) {
      set({ githubBusy: false, error: err instanceof Error ? err.message : 'Import failed' });
    }
  },

  loadPrPlan: async (repoFullName, description) => {
    const projectId = get().projectId;
    if (!projectId) return;
    try {
      const plan = await client.githubPrEditPlan({ projectId, repoFullName, description });
      set({ prPlan: plan });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'PR plan failed' });
    }
  },

  unbind: async (bindingId) => {
    const projectId = get().projectId;
    if (!projectId) return;
    try {
      await client.unbindCapability(projectId, bindingId);
      set((s) => ({ bindings: s.bindings.filter((b) => b.id !== bindingId) }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unbind failed' });
    }
  },

  refreshProject: async () => {
    const projectId = get().projectId;
    if (!projectId) return;
    try {
      const res = await client.projectCapabilities(projectId);
      set({ bindings: res.bindings, projectGithubImport: res.githubImport });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load project capabilities' });
    }
  },
}));
