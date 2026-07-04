'use client';

// PRISM SHELL — DASHBOARD (SHELL W4, S3)
//
// The signed-in studio. Launchpad is the visual focal point (a 3D showpiece +
// prompt + a real 3D build button → Guided Build); the gallery is a shelf of
// the tenant's projects with real 3D thumbnails, rename/duplicate/delete, and
// the E1 version timeline. New-build options (template, integrations, GitHub
// import, model) are reached via progressive disclosure — not a wall (S3). Side
// panels (Templates/Usage/Settings/Ship) switch via ?panel= so the global
// slide-out nav means the same thing here. First-run shows a guided invitation,
// never a void. The route owns its scroll (root body is locked, W0 gotcha).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PrismProject } from '../../../../packages/shared-interfaces/src/prism-tenancy';
import { listProjects } from '@/lib/shell/tenancy-client';
import { getModelRegistry, getDefaultModel } from '@/lib/shell/model-config';
import LaunchpadHero3D from './LaunchpadHero3D';
import PrimaryButton3D from '../intake/PrimaryButton3D';
import ProjectGallery from './ProjectGallery';
import SettingsPanel from './SettingsPanel';
import ShipPanel from './ShipPanel';
import TemplatesPanel from './TemplatesPanel';
import UsagePanel from './UsagePanel';
import VersionTimelineModal from './VersionTimelineModal';

type Panel = 'projects' | 'templates' | 'usage' | 'settings' | 'ship';
const PANELS: { key: Panel; label: string }[] = [
  { key: 'projects', label: 'Projects' },
  { key: 'templates', label: 'Templates' },
  { key: 'usage', label: 'Usage' },
  { key: 'settings', label: 'Settings' },
  { key: 'ship', label: 'Ship' },
];

export default function DashboardShell({
  userName,
  userEmail,
  planTier,
  initialProjects,
}: {
  userName: string;
  userEmail: string;
  planTier: string;
  initialProjects: PrismProject[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const panelParam = searchParams.get('panel');
  const panel: Panel = PANELS.some((p) => p.key === panelParam)
    ? (panelParam as Panel)
    : 'projects';

  const [projects, setProjects] = useState<PrismProject[]>(initialProjects);
  const [prompt, setPrompt] = useState('');
  const [disclosed, setDisclosed] = useState(false);
  const [model, setModel] = useState(() => getDefaultModel().id);
  const [historyProject, setHistoryProject] = useState<PrismProject | null>(null);
  const models = useMemo(() => getModelRegistry(), []);

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch {
      /* keep last-known list */
    }
  }, []);

  // Keep the gallery honest after a panel round-trip (e.g. return from builder).
  useEffect(() => {
    if (panel === 'projects') void refresh();
  }, [panel, refresh]);

  function setPanel(next: Panel) {
    router.push(next === 'projects' ? '/app' : `/app?panel=${next}`);
  }

  function build() {
    const q = new URLSearchParams();
    if (prompt.trim()) q.set('prompt', prompt.trim());
    if (model && model !== getDefaultModel().id) q.set('model', model);
    const qs = q.toString();
    router.push(qs ? `/app/build?${qs}` : '/app/build');
  }

  const empty = projects.length === 0;

  return (
    <main className="dw-screen">
      <header className="dw-top">
        <p className="dw-kicker">PRISM · STUDIO</p>
        <nav className="dw-switch" aria-label="Dashboard sections">
          {PANELS.map((p) => (
            <button
              key={p.key}
              type="button"
              className="dw-switch-btn"
              data-active={panel === p.key ? 'true' : 'false'}
              aria-current={panel === p.key ? 'page' : undefined}
              onClick={() => setPanel(p.key)}
            >
              {p.label}
            </button>
          ))}
          <a className="dw-switch-link" href="/app/integrations">
            Integrations →
          </a>
        </nav>
      </header>

      {panel === 'projects' ? (
        <>
          <section className="dw-launch" aria-label="Start a new build">
            <div className="dw-launch-copy">
              <h1 className="dw-headline">
                {empty ? `Welcome, ${userName.split(' ')[0] || 'builder'}` : 'What will you build?'}
              </h1>
              <p className="dw-sub">
                Describe an app and Prism builds it — a real 3D runtime, verified
                before it ships. Start from a blank prompt, a template, or your
                GitHub.
              </p>
              <div className="dw-launch-field">
                <textarea
                  className="dw-prompt"
                  rows={2}
                  value={prompt}
                  placeholder="A booking app for a barbershop with payments and SMS reminders…"
                  aria-label="Describe your app"
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) build();
                  }}
                />
                <div className="dw-launch-go">
                  <PrimaryButton3D
                    label="Build"
                    sublabel="start guided"
                    kind="go"
                    ariaLabel="Start a guided build"
                    onClick={build}
                  />
                </div>
              </div>

              <button
                type="button"
                className="dw-disclose"
                aria-expanded={disclosed}
                onClick={() => setDisclosed((d) => !d)}
              >
                {disclosed ? 'Fewer options' : 'More ways to start'}
              </button>
              {disclosed ? (
                <div className="dw-disclose-row">
                  <button type="button" className="dw-chip" onClick={() => setPanel('templates')}>
                    From a template
                  </button>
                  <a className="dw-chip" href="/app/integrations">
                    Import from GitHub
                  </a>
                  <a className="dw-chip" href="/app/integrations">
                    Connect integrations
                  </a>
                  <label className="dw-chip dw-chip-model">
                    <span>Model</span>
                    <select
                      className="dw-chip-select"
                      value={model}
                      aria-label="Default build model"
                      onChange={(e) => setModel(e.target.value)}
                    >
                      {models.map((mdl) => (
                        <option key={mdl.id} value={mdl.id} disabled={mdl.status !== 'active'}>
                          {mdl.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </div>
            <div className="dw-launch-hero">
              <LaunchpadHero3D />
            </div>
          </section>

          <section className="dw-projects" aria-label="Your projects">
            <div className="dw-projects-head">
              <h2 className="dw-section-label">PROJECTS</h2>
              <span className="dw-count">{projects.length}</span>
            </div>
            {empty ? (
              <div className="dw-empty">
                <p className="dw-empty-title">Your studio is ready.</p>
                <p className="dw-empty-body">
                  Describe your first app in the prompt above and press Build —
                  Prism asks a few quick questions, shows 3D design directions,
                  and writes a brief you approve before it builds.
                </p>
                <a className="dw-empty-link" href="/app/build">
                  Start a guided build →
                </a>
              </div>
            ) : (
              <ProjectGallery
                projects={projects}
                onChanged={() => void refresh()}
                onOpenHistory={(p) => setHistoryProject(p)}
              />
            )}
          </section>
        </>
      ) : null}

      {panel === 'templates' ? <TemplatesPanel /> : null}
      {panel === 'usage' ? <UsagePanel planTier={planTier} /> : null}
      {panel === 'settings' ? (
        <SettingsPanel userName={userName} userEmail={userEmail} planTier={planTier} />
      ) : null}
      {panel === 'ship' ? <ShipPanel hasProjects={!empty} /> : null}

      {historyProject ? (
        <VersionTimelineModal
          project={historyProject}
          onClose={() => setHistoryProject(null)}
        />
      ) : null}
    </main>
  );
}
