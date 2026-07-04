// PRISM SHELL — INTEGRATIONS ROUTE (SHELL W3, spec §10 S6 / §12 W3)
//
// /app/integrations — the Integrations surface. Under the /app/* session guard
// (layout verifies Better Auth). A ?project=<id> param scopes the surface to a
// project; the server validates ownership here (I11 — an unowned/foreign id
// resolves to null and the surface renders tenant-wide, never leaking that the
// project exists). All interactive work lives in IntegrationsShell (client);
// this server component only resolves the project context + mounts fonts.

import '@/components/shell/design/prism-premium.css';
import './integrations.css';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import IntegrationsShell from '@/components/shell/integrations/IntegrationsShell';
import { shellDisplay, shellMono } from '@/components/shell/design/shell-fonts';
import { auth, ensureAuthSchema } from '@/server/auth/auth';
import { getProject } from '@/server/tenancy/tenant-store';

export const metadata = { title: 'Integrations — Prism' };

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in'); // layout guards; belt-and-braces

  const sp = await searchParams;
  const raw = Array.isArray(sp.project) ? sp.project[0] : sp.project;
  let projectId: string | null = null;
  let projectName: string | null = null;
  if (typeof raw === 'string' && raw) {
    // Ownership check (I11): not-owned == not-found → render tenant-wide.
    const owned = await getProject(session.user.id, raw).catch(() => null);
    if (owned) {
      projectId = owned.id;
      projectName = owned.name;
    }
  }

  return (
    <div className={`ig-viewport ${shellDisplay.variable} ${shellMono.variable}`}>
      <IntegrationsShell projectId={projectId} projectName={projectName} />
    </div>
  );
}
