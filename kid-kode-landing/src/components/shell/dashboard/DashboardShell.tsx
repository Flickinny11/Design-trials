'use client';

// PRISM SHELL — DASHBOARD PLACEHOLDER (SHELL W1A; superseded by W4)
//
// The post-auth landing: proves the account → tenant-data loop end-to-end
// (list YOUR projects, create one, open the builder, sign out). W4 replaces
// this with the real gallery/launchpad surface (S3); until then it is a
// clean-but-premium working surface (Decision A) whose one primary action —
// CREATE — is a rendered object (DL12) on the shared-canvas row.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PrismProject } from '../../../../packages/shared-interfaces/src/prism-tenancy';
import { signOut } from '@/lib/shell/auth-client';
import { createProject } from '@/lib/shell/tenancy-client';
import AuthObjectRow from '../auth/AuthObjectRow';

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
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const project = await createProject({ name: name.trim() || 'Untitled Build' });
      router.push(`/app/builder/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the project.');
      setBusy(false);
    }
  }

  async function leave() {
    await signOut();
    router.push('/sign-in');
    router.refresh();
  }

  return (
    <main className="dw1-screen">
      <header className="dw1-topbar">
        <p className="dw1-kicker">PRISM · DASHBOARD</p>
        <div className="dw1-account">
          <span className="dw1-account-id">
            {userName} · {userEmail} · {planTier.toUpperCase()}
          </span>
          <button type="button" className="dw1-signout" onClick={() => void leave()}>
            Sign out
          </button>
        </div>
      </header>

      <section className="dw1-launch" aria-label="Start a new build">
        <h1 className="dw1-headline">Your studio</h1>
        <p className="dw1-sub">
          Full dashboard lands in W4 — every project below is already yours
          alone, stored per tenant.
        </p>
        <div className="dw1-launchrow">
          <input
            className="dw1-input"
            type="text"
            placeholder="Name your build"
            aria-label="New build name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void create();
            }}
            disabled={busy}
          />
          <div className="dw1-createbtn">
            <AuthObjectRow
              zoom={30}
              cells={[
                {
                  key: 'email',
                  label: 'Create',
                  sublabel: busy ? 'working' : 'new build',
                  enabled: !busy,
                  busy,
                  onActivate: () => void create(),
                },
              ]}
            />
          </div>
        </div>
        <p className="dw1-error" role="alert" aria-live="polite">
          {error ?? ''}
        </p>
        <p className="dw1-guided-hint">
          Not sure where to start?{' '}
          <a
            className="dw1-guided-link"
            href={name.trim() ? `/app/build?prompt=${encodeURIComponent(name.trim())}` : '/app/build'}
          >
            Start a guided build →
          </a>{' '}
          Prism asks a few questions, shows design directions, and writes a brief you approve.
        </p>
      </section>

      <section className="dw1-projects" aria-label="Your projects">
        <h2 className="dw1-sectionlabel">PROJECTS</h2>
        {initialProjects.length === 0 ? (
          <p className="dw1-empty">
            Nothing here yet. Name a build above and press CREATE — the
            builder opens on your first project.
          </p>
        ) : (
          <ul className="dw1-list">
            {initialProjects.map((p) => (
              <li key={p.id}>
                <a className="dw1-project" href={`/app/builder/${p.id}`}>
                  <span className="dw1-project-name">{p.name}</span>
                  <span className="dw1-project-meta">
                    {new Date(p.updatedAt).toLocaleString()} · {p.id.slice(0, 13)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
