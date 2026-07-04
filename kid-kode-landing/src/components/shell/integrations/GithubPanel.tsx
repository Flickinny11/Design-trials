'use client';

// PRISM SHELL — GITHUB APP PANEL (SHELL W3, S6 / I7 / task 4)
//
// Installation + repo selection, import-repo (wired to the intake GitHub card),
// and the PR-based edit path contract for production apps (I7 — branch + PR, no
// force-push, per-action confirm on irreversible steps). Sandbox-first: with
// the App unconfigured this drives a deterministic sandbox so the flow is fully
// exercisable; the install button points at the real App once keyed.

import { useEffect, useState } from 'react';
import { useIntegrationsStore } from '@/lib/shell/integrations/integrations-store';
import BrandMark2D from './BrandMark2D';

export default function GithubPanel() {
  const installUrl = useIntegrationsStore((s) => s.githubInstallUrl);
  const sandbox = useIntegrationsStore((s) => s.githubSandbox);
  const installations = useIntegrationsStore((s) => s.installations);
  const reposByInstall = useIntegrationsStore((s) => s.reposByInstall);
  const loadRepos = useIntegrationsStore((s) => s.loadRepos);
  const importRepo = useIntegrationsStore((s) => s.importRepo);
  const loadPrPlan = useIntegrationsStore((s) => s.loadPrPlan);
  const prPlan = useIntegrationsStore((s) => s.prPlan);
  const projectId = useIntegrationsStore((s) => s.projectId);
  const projectGithubImport = useIntegrationsStore((s) => s.projectGithubImport);
  const busy = useIntegrationsStore((s) => s.githubBusy);

  const [selectedInstall, setSelectedInstall] = useState<string | null>(null);

  // Auto-select the sole installation and load its repos.
  useEffect(() => {
    if (!selectedInstall && installations.length > 0) {
      const id = installations[0].installationId;
      setSelectedInstall(id);
      void loadRepos(id);
    }
  }, [installations, selectedInstall, loadRepos]);

  const repos = selectedInstall ? reposByInstall[selectedInstall] ?? [] : [];

  return (
    <section className="ig-section" aria-label="GitHub">
      <div className="ig-section-head">
        <h2 className="ig-section-title">
          <span className="ig-section-mark">
            <BrandMark2D brandKey="github" size={22} decorative />
          </span>
          GitHub
        </h2>
        <p className="ig-section-sub">
          Install the Prism GitHub App, import a repo, and edit production apps through
          pull requests — never a force-push.
        </p>
      </div>

      <div className="ig-gh-install">
        <a
          className="ig-btn ig-btn--primary"
          href={sandbox ? undefined : installUrl ?? undefined}
          target={sandbox ? undefined : '_blank'}
          rel="noreferrer"
          aria-disabled={sandbox}
          data-sandbox={sandbox ? 'true' : 'false'}
          onClick={(e) => {
            if (sandbox) e.preventDefault();
          }}
        >
          {sandbox ? 'Install (sandbox)' : 'Install the Prism GitHub App'}
        </a>
        {sandbox ? (
          <span className="ig-gh-sandbox-note">
            Sandbox mode — set the GitHub App env vars to enable real installs.
          </span>
        ) : null}
      </div>

      {installations.length > 0 ? (
        <div className="ig-gh-installs">
          {installations.map((inst) => (
            <button
              key={inst.installationId}
              type="button"
              className="ig-gh-inst"
              data-selected={selectedInstall === inst.installationId ? 'true' : 'false'}
              onClick={() => {
                setSelectedInstall(inst.installationId);
                void loadRepos(inst.installationId);
              }}
            >
              {inst.account}
              <span className="ig-gh-inst-type">{inst.accountType}</span>
            </button>
          ))}
        </div>
      ) : null}

      {repos.length > 0 ? (
        <ul className="ig-gh-repos">
          {repos.map((r) => {
            const imported = projectGithubImport?.repoFullName === r.fullName;
            return (
              <li key={r.fullName} className="ig-gh-repo">
                <div className="ig-gh-repo-body">
                  <span className="ig-gh-repo-name">
                    {r.fullName}
                    {r.private ? <span className="ig-gh-badge">private</span> : null}
                  </span>
                  {r.description ? (
                    <span className="ig-gh-repo-desc">{r.description}</span>
                  ) : null}
                  <span className="ig-gh-repo-branch">default: {r.defaultBranch}</span>
                </div>
                <div className="ig-gh-repo-actions">
                  <button
                    type="button"
                    className="ig-btn ig-btn--sm"
                    disabled={busy || !projectId || imported}
                    onClick={() => selectedInstall && void importRepo(selectedInstall, r.fullName)}
                    title={projectId ? undefined : 'Open a project to import into it'}
                  >
                    {imported ? 'Imported' : 'Import'}
                  </button>
                  <button
                    type="button"
                    className="ig-btn ig-btn--sm"
                    disabled={!projectId}
                    onClick={() => void loadPrPlan(r.fullName, 'Apply Prism edits to this app')}
                  >
                    PR-edit path
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!projectId ? (
        <p className="ig-note">
          Open a project (from the builder) to import a repo into it or preview its
          PR-based edit path.
        </p>
      ) : null}

      {prPlan ? (
        <div className="ig-pr-plan" role="region" aria-label="PR-based edit path">
          <p className="ig-pr-plan-head">
            Production edit → <code>{prPlan.branch}</code> off <code>{prPlan.baseBranch}</code>
          </p>
          <p className="ig-pr-plan-summary">{prPlan.summary}</p>
          <ol className="ig-pr-steps">
            {prPlan.actions.map((a, i) => (
              <li key={i} className="ig-pr-step" data-confirm={a.requiresConfirm ? 'true' : 'false'}>
                <span className="ig-pr-step-label">{a.label}</span>
                {a.irreversible ? <span className="ig-pr-tag ig-pr-tag--irrev">irreversible</span> : null}
                {a.requiresConfirm ? <span className="ig-pr-tag">confirm</span> : null}
              </li>
            ))}
          </ol>
          <p className="ig-pr-plan-foot">Force-push: never. History is never rewritten (I7).</p>
        </div>
      ) : null}
    </section>
  );
}
