'use client';

// PRISM SHELL — DOMAIN PURCHASE MODAL (SHELL W5B / E16, 2026-07-05)
//
// The in-UI "buy a custom URL without leaving the platform" flow: search a
// name → see availability + pricing across TLDs → one-click purchase → Connect
// auto-DNS attaches it to the current deploy. Sandbox until vendor keys are set
// (every price cites its source + freshness, so a sandbox price is never
// mistaken for live — I5). Clean-but-premium working surface (Decision A).

import { useCallback, useEffect, useState } from 'react';
import type {
  DomainAvailability,
  DomainProvider,
  DomainProviderDescriptor,
} from '../../../../packages/shared-interfaces/src/prism-domains';
import {
  listDomainProviders,
  purchaseDomainClient,
  searchDomainsClient,
} from '@/lib/shell/domains-client';

export default function DomainPurchaseModal({
  projectId,
  deployId,
  initialQuery,
  onClose,
  onPurchased,
}: {
  projectId: string;
  deployId: string;
  initialQuery: string;
  onClose: () => void;
  onPurchased: (domain: string) => void;
}) {
  const [providers, setProviders] = useState<DomainProviderDescriptor[]>([]);
  const [provider, setProvider] = useState<DomainProvider>('entri');
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<DomainAvailability[]>([]);
  const [busy, setBusy] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    void listDomainProviders().then(setProviders);
  }, []);

  const onSearch = useCallback(async () => {
    if (!query.trim()) return;
    setBusy(true);
    setResults(await searchDomainsClient(query.trim(), provider));
    setBusy(false);
  }, [query, provider]);

  const onBuy = useCallback(async (domain: string) => {
    setBuying(domain);
    const order = await purchaseDomainClient({ projectId, deployId, domain, provider });
    setBuying(null);
    if (order) {
      onPurchased(domain);
      onClose();
    }
  }, [projectId, deployId, provider, onPurchased, onClose]);

  const activeProvider = providers.find((p) => p.provider === provider);

  return (
    <div className="dm-overlay" role="dialog" aria-modal="true" aria-label="Buy a custom domain">
      <div className="dm-modal">
        <div className="dm-head">
          <div>
            <p className="dm-kicker">Custom domain · E16</p>
            <h3 className="dm-title">Buy a URL — without leaving Prism</h3>
          </div>
          <button type="button" className="dm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="dm-providers" role="tablist" aria-label="Domain provider">
          {providers.map((p) => (
            <button
              key={p.provider}
              type="button"
              role="tab"
              aria-selected={p.provider === provider}
              className="dm-provider"
              data-active={p.provider === provider ? 'true' : 'false'}
              onClick={() => setProvider(p.provider)}
            >
              {p.label}
              <span className="dm-provider-mode" data-mode={p.mode}>{p.mode}</span>
            </button>
          ))}
        </div>

        <div className="dm-search">
          <input
            className="dm-input"
            value={query}
            placeholder="your-app-name"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void onSearch(); }}
            aria-label="Domain name to search"
          />
          <button type="button" className="bw1-minibtn" onClick={onSearch} disabled={busy}>
            {busy ? 'Searching…' : 'Search'}
          </button>
        </div>

        <ul className="dm-results">
          {results.map((r) => (
            <li key={r.domain} className="dm-result" data-available={r.available ? 'true' : 'false'}>
              <span className="dm-domain">{r.domain}</span>
              {r.available && r.price ? (
                <span className="dm-price">${r.price.registerUsd}<span className="dm-renew">/yr · renews ${r.price.renewUsd}</span></span>
              ) : (
                <span className="dm-taken">taken</span>
              )}
              {r.available ? (
                <button type="button" className="bw1-minibtn dm-buy" onClick={() => onBuy(r.domain)} disabled={buying === r.domain}>
                  {buying === r.domain ? 'Connecting…' : 'Buy & connect'}
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        {results.length > 0 ? (
          <p className="dm-source">
            Pricing: {results[0].source}. {activeProvider?.mode === 'sandbox'
              ? `Sandbox — no charge until ${activeProvider.requiredEnv.join(' / ')} is set.`
              : 'Live registrar.'}
          </p>
        ) : (
          <p className="dm-hint">Search a name to see availability and pricing across .com / .io / .app / .dev / .co.</p>
        )}
      </div>
    </div>
  );
}
