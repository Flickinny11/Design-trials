'use client';

// PRISM SHELL — SETTINGS PANEL (SHELL W4)
//
// Account identity, default build model (config-driven from model-config, spec
// 7.4 — never a hardcoded model string), and integrations shortcut. Model
// availability comes from the single config source; a `gated` model shows but
// cannot be chosen. Clean-but-premium working surface (Decision A).

import { useMemo, useState } from 'react';
import { getModelRegistry, getDefaultModel } from '@/lib/shell/model-config';

export default function SettingsPanel({
  userName,
  userEmail,
  planTier,
}: {
  userName: string;
  userEmail: string;
  planTier: string;
}) {
  const models = useMemo(() => getModelRegistry(), []);
  const [modelId, setModelId] = useState(() => getDefaultModel().id);

  return (
    <section className="dw-panel" aria-labelledby="dw-settings-h">
      <div className="dw-panel-head">
        <div>
          <p className="dw-panel-kicker">SETTINGS</p>
          <h2 id="dw-settings-h" className="dw-panel-title">
            Account &amp; defaults
          </h2>
        </div>
        <span className="dw-tier" data-tier={planTier}>
          {planTier.toUpperCase()}
        </span>
      </div>

      <dl className="dw-settings-list">
        <div className="dw-settings-row">
          <dt>Name</dt>
          <dd>{userName}</dd>
        </div>
        <div className="dw-settings-row">
          <dt>Email</dt>
          <dd>{userEmail}</dd>
        </div>
        <div className="dw-settings-row">
          <dt>Plan</dt>
          <dd>{planTier}</dd>
        </div>
        <div className="dw-settings-row">
          <dt>
            <label htmlFor="dw-model">Default build model</label>
          </dt>
          <dd>
            <select
              id="dw-model"
              className="dw-select"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
            >
              {models.map((mdl) => (
                <option key={mdl.id} value={mdl.id} disabled={mdl.status !== 'active'}>
                  {mdl.label}
                  {mdl.status === 'gated' ? ' — request access' : ''}
                </option>
              ))}
            </select>
          </dd>
        </div>
      </dl>

      <div className="dw-settings-links">
        <a className="dw-btn dw-btn-ghost" href="/app/integrations">
          Manage integrations
        </a>
      </div>
      <p className="dw-panel-foot">
        Billing, API keys, and team seats arrive with the deploy &amp; billing
        phase. Model availability is config-driven — no hardcoded model.
      </p>
    </section>
  );
}
