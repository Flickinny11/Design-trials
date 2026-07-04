'use client';

// PRISM SHELL — CONNECTED ACCOUNTS MANAGEMENT (SHELL W3, S6)
//
// The management surface for connected accounts: re-auth, revoke, and scope
// review (S6 checklist). Each row shows the REAL brand mark, the status, the
// capability-reference id (NOT a secret — the reference is safe to display),
// and the scopes the connection carries. Working surface (DL10): clean rows,
// no heavy 3D.

import type { ConnectionStatus } from '../../../../packages/shared-interfaces/src/prism-integrations';
import { useIntegrationsStore } from '@/lib/shell/integrations/integrations-store';
import BrandMark2D from './BrandMark2D';

const STATUS_COPY: Record<ConnectionStatus, string> = {
  pending: 'Authorizing',
  connected: 'Connected',
  'needs-reauth': 'Needs re-auth',
  revoked: 'Revoked',
};

export default function ConnectedAccounts() {
  const connections = useIntegrationsStore((s) => s.connections);
  const reauth = useIntegrationsStore((s) => s.reauth);
  const revoke = useIntegrationsStore((s) => s.revoke);

  return (
    <section className="ig-section" aria-label="Connected accounts">
      <div className="ig-section-head">
        <h2 className="ig-section-title">Connected accounts</h2>
        <p className="ig-section-sub">
          Manage authorization. Prism stores a capability reference only — never a key.
        </p>
      </div>

      {connections.length === 0 ? (
        <p className="ig-empty">
          Nothing connected yet. Search above or pick a tile to connect your first platform.
        </p>
      ) : (
        <ul className="ig-conn-list">
          {connections.map((c) => (
            <li key={c.id} className="ig-conn" data-status={c.status}>
              <span className="ig-conn-mark">
                <BrandMark2D brandKey={c.brandMark} size={26} decorative />
              </span>
              <div className="ig-conn-body">
                <div className="ig-conn-top">
                  <span className="ig-conn-name">{c.platform}</span>
                  <span className="ig-conn-status" data-status={c.status}>
                    {STATUS_COPY[c.status]}
                  </span>
                </div>
                <p className="ig-conn-ref">
                  ref <code>{c.capabilityRef.refId}</code> · via {c.capabilityRef.provider}
                </p>
                <div className="ig-conn-scopes" aria-label="Scopes">
                  {c.scopes.map((s) => (
                    <span key={s} className="ig-scope-chip">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ig-conn-actions">
                <button
                  type="button"
                  className="ig-btn ig-btn--sm"
                  onClick={() => void reauth(c.id)}
                >
                  Re-auth
                </button>
                <button
                  type="button"
                  className="ig-btn ig-btn--sm ig-btn--danger"
                  onClick={() => void revoke(c.id)}
                >
                  Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
