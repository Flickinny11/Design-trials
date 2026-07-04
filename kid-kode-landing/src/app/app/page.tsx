// PRISM SHELL — POST-AUTH DASHBOARD ROUTE (SHELL W1A; real S3 lands in W4)
//
// The signed-in landing. The /app layout has already verified the session;
// this page resolves it again for the identity and reads THIS tenant's
// projects straight from the tenant store (server-side, session-keyed —
// the same I11 surface the tRPC router uses).

import '@/components/shell/design/prism-premium.css';
import '@/components/shell/auth/auth.css';
import '@/components/shell/dashboard/dashboard.css';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/shell/dashboard/DashboardShell';
import { shellDisplay, shellMono } from '@/components/shell/design/shell-fonts';
import { auth, ensureAuthSchema } from '@/server/auth/auth';
import { listProjects } from '@/server/tenancy/tenant-store';

export const metadata = { title: 'Dashboard — Prism' };

export default async function DashboardPage() {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in'); // layout guards; belt-and-braces
  const user = session.user as typeof session.user & { planTier?: string };
  const projects = await listProjects(user.id);
  return (
    <div className={`${shellDisplay.variable} ${shellMono.variable}`}>
      <DashboardShell
        userName={user.name}
        userEmail={user.email}
        planTier={typeof user.planTier === 'string' ? user.planTier : 'free'}
        initialProjects={projects}
      />
    </div>
  );
}
