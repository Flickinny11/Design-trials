'use client';

// PRISM SHELL — CONNECT-ANYTHING SEARCH (SHELL W3, decision C RIDER)
//
// The affordance that LEADS the Integrations surface (S6 rider): a
// search-any-platform input. On a HIT the catalog tiles render (one-click
// connect). On a MISS the search flows DIRECTLY into the agent-authored-
// connector request path — never buried, never a dead end. Copy can promise
// "integrate with virtually anything, one click" because the long tail is real.

import { useEffect, useRef, useState } from 'react';
import { useIntegrationsStore } from '@/lib/shell/integrations/integrations-store';
import { TileButton } from './CatalogTiles';

export default function ConnectAnythingSearch() {
  const query = useIntegrationsStore((s) => s.query);
  const setQuery = useIntegrationsStore((s) => s.setQuery);
  const runSearch = useIntegrationsStore((s) => s.runSearch);
  const search = useIntegrationsStore((s) => s.search);
  const searching = useIntegrationsStore((s) => s.searching);
  const submitRequest = useIntegrationsStore((s) => s.submitConnectorRequest);
  const requests = useIntegrationsStore((s) => s.requests);

  const [note, setNote] = useState('');
  const [justRequested, setJustRequested] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search as the user types (guards fast typing in the store too).
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void runSearch(), 220);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, runSearch]);

  const miss = Boolean(search && search.miss);
  const hits = search?.hits ?? [];
  const article = /^[aeiou]/i.test(query.trim()) ? 'an' : 'a';
  const alreadyRequested = requests.some(
    (r) => r.platform.toLowerCase() === query.trim().toLowerCase(),
  );

  async function handleRequest() {
    const platform = query.trim();
    if (!platform) return;
    await submitRequest(platform, note.trim() || undefined);
    setJustRequested(platform);
    setNote('');
  }

  return (
    <div className="ig-search">
      <div className="ig-search-field">
        <span className="ig-search-icon" aria-hidden>
          {searching ? '···' : '⌕'}
        </span>
        <input
          type="text"
          className="ig-search-input"
          value={query}
          placeholder="Connect anything — search Stripe, Notion, your own API…"
          onChange={(e) => {
            setQuery(e.target.value);
            setJustRequested(null);
          }}
          aria-label="Search any platform to connect"
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            className="ig-search-clear"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        ) : null}
      </div>

      {query.trim() ? (
        <div className="ig-search-results" role="region" aria-label="Search results">
          {hits.length > 0 ? (
            <div className="ig-tile-grid ig-tile-grid--results">
              {hits.map((t) => (
                <TileButton key={t.providerId} tile={t} />
              ))}
            </div>
          ) : null}

          {miss ? (
            <div className="ig-miss">
              <p className="ig-miss-lead">
                No one-click tile for <strong>“{query.trim()}”</strong> yet — Prism can
                author a connector for it.
              </p>
              <p className="ig-miss-sub">
                Describe what it should do (optional), and it joins the connector queue.
              </p>
              <textarea
                className="ig-miss-note"
                rows={2}
                value={note}
                placeholder={`What should the ${query.trim()} connector do?`}
                onChange={(e) => setNote(e.target.value)}
                aria-label="Connector request note"
              />
              <button
                type="button"
                className="ig-btn ig-btn--primary"
                onClick={handleRequest}
                disabled={alreadyRequested || justRequested === query.trim()}
              >
                {alreadyRequested || justRequested === query.trim()
                  ? 'Requested — queued'
                  : `Request ${article} ${query.trim()} connector`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
