'use client';

// PRISM SHELL — E6 USAGE METER (SHELL W4)
//
// Per-tenant usage + plan-tier badge. Numbers are REAL per-tenant counts
// (projects, verified builds, checkpoints) against the tier's configured quotas
// (usage-config.ts); the meter is honestly labelled `stub` until a billing
// provider lands (E6 — schema now, Stripe later). Clean-but-premium working
// surface (Decision A).

import { useEffect, useState } from 'react';
import type { PrismUsageOutput } from '../../../../packages/shared-interfaces/src/prism-tenancy';
import { getUsage } from '@/lib/shell/tenancy-client';

function pct(used: number, limit: number | null): number {
  if (limit == null || limit === 0) return used > 0 ? 8 : 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

export default function UsagePanel({ planTier }: { planTier: string }) {
  const [usage, setUsage] = useState<PrismUsageOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUsage()
      .then(setUsage)
      .catch(() => setError('Could not load usage.'));
  }, []);

  return (
    <section className="dw-panel" aria-labelledby="dw-usage-h">
      <div className="dw-panel-head">
        <div>
          <p className="dw-panel-kicker">USAGE · E6</p>
          <h2 id="dw-usage-h" className="dw-panel-title">
            Plan &amp; credits
          </h2>
        </div>
        <span className="dw-tier" data-tier={usage?.tier ?? planTier}>
          {(usage?.tier ?? planTier).toUpperCase()}
        </span>
      </div>

      {error ? (
        <p className="dw-error" role="alert">
          {error}
        </p>
      ) : null}

      {usage ? (
        <>
          <ul className="dw-usage-grid">
            {usage.metrics.map((mtr) => (
              <li key={mtr.key} className="dw-usage-card">
                <div className="dw-usage-top">
                  <span className="dw-usage-label">{mtr.label}</span>
                  <span className="dw-usage-count">
                    {mtr.used}
                    <span className="dw-usage-limit">
                      {mtr.limit == null ? ' / ∞' : ` / ${mtr.limit}`}
                    </span>
                  </span>
                </div>
                <div
                  className="dw-gauge"
                  role="progressbar"
                  aria-valuenow={mtr.used}
                  aria-valuemin={0}
                  aria-valuemax={mtr.limit ?? mtr.used}
                  aria-label={`${mtr.label} usage`}
                >
                  <span
                    className="dw-gauge-fill"
                    data-full={pct(mtr.used, mtr.limit) >= 90 ? 'true' : 'false'}
                    style={{ width: `${pct(mtr.used, mtr.limit)}%` }}
                  />
                </div>
                <span className="dw-usage-unit">{mtr.unit}</span>
              </li>
            ))}
          </ul>
          <p className="dw-usage-note">
            {usage.source === 'stub'
              ? 'Live figures from your account; billing & metered credits arrive in the testing phase.'
              : 'Live billing figures.'}{' '}
            Measured {new Date(usage.asOf).toLocaleString()}.
          </p>
        </>
      ) : !error ? (
        <p className="dw-panel-loading">Loading usage…</p>
      ) : null}
    </section>
  );
}
