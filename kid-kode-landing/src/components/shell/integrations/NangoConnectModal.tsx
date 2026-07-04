'use client';

// PRISM SHELL — WHITE-LABEL NANGO CONNECT UI (SHELL W3, S6 / decision B)
//
// The one-click connect flow, WHITE-LABELED in the Prism design system — the
// user authorizes "with Prism", never a raw Nango screen and never a shell
// field asking for a token (I5 / FP3: credential entry is delegated to the
// broker). The modal shows the real brand mark, the auth method, and the exact
// scopes the connection will carry (scope review up-front). On confirm the
// managed connect yields a capability REFERENCE (stored), and the hosted
// authorization link is offered — the raw credential never touches the shell.

import { useEffect, useRef } from 'react';
import type { IntegrationAuthMethod } from '../../../../packages/shared-interfaces/src/prism-integrations';
import { useIntegrationsStore } from '@/lib/shell/integrations/integrations-store';
import BrandMark2D from './BrandMark2D';

const METHOD_LABEL: Record<IntegrationAuthMethod, string> = {
  'oauth2.1': 'OAuth 2.1',
  'api-token': 'API token',
  mcp: 'MCP',
  cli: 'CLI',
};

/** Preview of the scopes a platform's connection carries (mirrors the server's
 *  scope list so the user reviews scope BEFORE authorizing). */
const SCOPE_PREVIEW: Record<string, string[]> = {
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

export default function NangoConnectModal() {
  const tile = useIntegrationsStore((s) => s.modalTile);
  const close = useIntegrationsStore((s) => s.closeConnect);
  const confirm = useIntegrationsStore((s) => s.confirmConnect);
  const connecting = useIntegrationsStore((s) => s.connecting);
  const lastConnect = useIntegrationsStore((s) => s.lastConnect);
  const projectId = useIntegrationsStore((s) => s.projectId);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus-trap-lite: focus the dialog on open; Escape closes.
  useEffect(() => {
    if (!tile) return;
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tile, close]);

  if (!tile) return null;

  const method: IntegrationAuthMethod = tile.authMethods[0];
  const scopes = SCOPE_PREVIEW[tile.providerId] ?? [`${tile.providerId}:access`];
  const done = lastConnect?.connection.providerId === tile.providerId;

  return (
    <div className="ig-modal-scrim" onMouseDown={close}>
      <div
        className="ig-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Connect ${tile.label}`}
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ig-modal-brandrow">
          <span className="ig-modal-mark">
            <BrandMark2D brandKey={tile.brandMark} size={34} />
          </span>
          <span className="ig-modal-x" aria-hidden>
            ⇄
          </span>
          <span className="ig-modal-prism" aria-hidden>
            <span className="ig-modal-prism-dot" />
            Prism
          </span>
        </div>

        {!done ? (
          <>
            <h2 className="ig-modal-title">Connect {tile.label}</h2>
            <p className="ig-modal-lead">
              You authorize <strong>with Prism</strong> — Prism brokers the connection
              through {method === 'oauth2.1' ? 'a secure OAuth handoff' : 'a managed token vault'}.
              Your credentials go straight to the vault; they never touch this app.
            </p>

            <dl className="ig-modal-meta">
              <div>
                <dt>Method</dt>
                <dd>{METHOD_LABEL[method]}</dd>
              </div>
              <div>
                <dt>Stored as</dt>
                <dd>Capability reference (no secret)</dd>
              </div>
              {projectId ? (
                <div>
                  <dt>Binds to</dt>
                  <dd>This project</dd>
                </div>
              ) : null}
            </dl>

            <div className="ig-modal-scopes">
              <p className="ig-modal-scopes-label">This grants Prism:</p>
              <ul>
                {scopes.map((s) => (
                  <li key={s}>
                    <code>{s}</code>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ig-modal-actions">
              <button type="button" className="ig-btn" onClick={close} disabled={connecting}>
                Cancel
              </button>
              <button
                type="button"
                className="ig-btn ig-btn--primary"
                onClick={() => void confirm(method)}
                disabled={connecting}
              >
                {connecting ? 'Authorizing…' : `Authorize ${tile.label} with Prism`}
              </button>
            </div>
          </>
        ) : (
          <div className="ig-modal-done" role="status">
            <p className="ig-modal-done-badge">Connected</p>
            <h2 className="ig-modal-title">{tile.label} is connected</h2>
            <p className="ig-modal-lead">
              A capability reference is stored{lastConnect?.boundToProject ? ' and bound to this project' : ''}.
              Manage, re-auth, or revoke it in Connected accounts below.
            </p>
            {lastConnect?.authUrl ? (
              <p className="ig-modal-hosted">
                Hosted authorization: <code>{lastConnect.authUrl}</code>
              </p>
            ) : null}
            <div className="ig-modal-actions">
              <button type="button" className="ig-btn ig-btn--primary" onClick={close}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
