'use client';

// PRISM SHELL — E5 PER-APP ENV / CAPABILITY PANEL (SHELL W3, E5 / I5)
//
// The per-app view of what this project uses: the capability REFERENCES it is
// bound to, the scopes each exercises (scope review), and the env var NAMES the
// built app will read. There are NO raw values here — the values live in the
// server-side vault as references; the panel shows the name↔reference map only
// (E5 / I5). Rendered only when a project is in context.

import { useIntegrationsStore } from '@/lib/shell/integrations/integrations-store';
import BrandMark2D from './BrandMark2D';

export default function EnvCapabilityPanel() {
  const projectId = useIntegrationsStore((s) => s.projectId);
  const bindings = useIntegrationsStore((s) => s.bindings);
  const githubImport = useIntegrationsStore((s) => s.projectGithubImport);
  const unbind = useIntegrationsStore((s) => s.unbind);

  if (!projectId) return null;

  return (
    <section className="ig-section ig-section--env" aria-label="App environment & capabilities">
      <div className="ig-section-head">
        <h2 className="ig-section-title">This app’s environment</h2>
        <p className="ig-section-sub">
          Capability references &amp; env keys for <code>{projectId}</code>. Values live in
          the server vault — only references and key names appear here (E5).
        </p>
      </div>

      {githubImport ? (
        <div className="ig-env-github">
          <span className="ig-env-github-mark">
            <BrandMark2D brandKey="github" size={20} />
          </span>
          Imported repo: <code>{githubImport.repoFullName}</code>
        </div>
      ) : null}

      {bindings.length === 0 ? (
        <p className="ig-empty">
          No capabilities bound to this app yet. Connect a platform above to bind one.
        </p>
      ) : (
        <ul className="ig-env-list">
          {bindings.map((b) => (
            <li key={b.id} className="ig-env-row">
              <div className="ig-env-row-head">
                <span className="ig-env-mark">
                  <BrandMark2D brandKey={b.providerId} size={22} />
                </span>
                <span className="ig-env-name">{b.label}</span>
                <button
                  type="button"
                  className="ig-btn ig-btn--sm ig-btn--danger"
                  onClick={() => void unbind(b.id)}
                >
                  Unbind
                </button>
              </div>
              <p className="ig-env-ref">
                ref <code>{b.capabilityRef.refId}</code>
              </p>
              <div className="ig-env-cols">
                <div>
                  <p className="ig-env-collabel">Scopes</p>
                  <div className="ig-conn-scopes">
                    {b.scopes.map((s) => (
                      <span key={s} className="ig-scope-chip">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="ig-env-collabel">Env keys</p>
                  <div className="ig-conn-scopes">
                    {b.envKeys.map((k) => (
                      <span key={k} className="ig-scope-chip ig-scope-chip--env">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
