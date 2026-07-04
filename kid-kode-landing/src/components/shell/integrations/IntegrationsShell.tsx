'use client';

// PRISM SHELL — INTEGRATIONS SURFACE (SHELL W3, spec §10 S6 / §12 W3)
//
// The Integrations surface. Under the /app/* session guard. Decision C rider:
// the "connect anything" search LEADS — it is the first thing below the hero,
// above the curated catalog. Nango is the spine (decision B); everything the
// client holds is a capability reference (I5). A ?project= param scopes the
// surface to a project (binds connections + shows the E5 per-app panel).

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useIntegrationsStore } from '@/lib/shell/integrations/integrations-store';
import ConnectAnythingSearch from './ConnectAnythingSearch';
import CatalogTiles from './CatalogTiles';
import ConnectedAccounts from './ConnectedAccounts';
import GithubPanel from './GithubPanel';
import EnvCapabilityPanel from './EnvCapabilityPanel';
import NangoConnectModal from './NangoConnectModal';

const ConnectHero3D = dynamic(() => import('./ConnectHero3D'), {
  ssr: false,
  loading: () => <div className="ig-hero-canvas ig-hero-canvas--loading" aria-hidden />,
});

const STATUS_COPY: Record<string, string> = {
  queued: 'Queued',
  authoring: 'Authoring',
  ready: 'Ready',
  declined: 'Declined',
};

function ConnectorQueue() {
  const requests = useIntegrationsStore((s) => s.requests);
  if (requests.length === 0) return null;
  return (
    <section className="ig-section" aria-label="Connector requests">
      <div className="ig-section-head">
        <h2 className="ig-section-title">Connector queue</h2>
        <p className="ig-section-sub">
          Long-tail platforms you asked Prism to connect. Prism authors the connector
          against Nango; you’ll be notified when it’s ready.
        </p>
      </div>
      <ul className="ig-queue">
        {requests.map((r) => (
          <li key={r.id} className="ig-queue-row">
            <span className="ig-queue-name">{r.platform}</span>
            {r.note ? <span className="ig-queue-note">{r.note}</span> : null}
            <span className="ig-queue-status" data-status={r.status}>
              {STATUS_COPY[r.status] ?? r.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function IntegrationsShell({
  projectId,
  projectName,
}: {
  projectId: string | null;
  projectName?: string | null;
}) {
  const init = useIntegrationsStore((s) => s.init);
  const query = useIntegrationsStore((s) => s.query);
  const catalog = useIntegrationsStore((s) => s.catalog);
  const error = useIntegrationsStore((s) => s.error);

  useEffect(() => {
    void init(projectId);
  }, [init, projectId]);

  return (
    <div className="ig-root">
      <header className="ig-topbar">
        <a href="/app" className="ig-wordmark">
          Prism<span className="ig-wordmark-dot">.</span>
        </a>
        <span className="ig-topbar-kicker">Integrations</span>
        {projectId ? (
          <span className="ig-topbar-project" title={projectId}>
            {projectName || projectId}
          </span>
        ) : null}
        <a href={projectId ? `/app/builder/${projectId}` : '/app'} className="ig-topbar-exit">
          {projectId ? 'Back to builder' : 'Back to dashboard'}
        </a>
      </header>

      <main className="ig-main">
        <section className="ig-hero">
          <ConnectHero3D />
          <div className="ig-hero-copy">
            <p className="ig-kicker">Connect · Nango spine</p>
            <h1 className="ig-h1">Connect anything, one click.</h1>
            <p className="ig-lede">
              A curated catalog covers the head. Search anything else and Prism authors the
              connector — so “integrate with virtually anything” is literally true. No key
              ever touches Prism; every connection is a capability reference.
            </p>
          </div>
        </section>

        {/* The connect-anything search LEADS (decision C rider). */}
        <ConnectAnythingSearch />

        {/* Curated head catalog — hidden while a search is active. */}
        {!query.trim() ? <CatalogTiles tiles={catalog} /> : null}

        {error ? (
          <p className="ig-error" role="alert">
            {error}
          </p>
        ) : null}

        <ConnectedAccounts />
        <ConnectorQueue />
        <GithubPanel />
        <EnvCapabilityPanel />
      </main>

      <NangoConnectModal />
    </div>
  );
}
