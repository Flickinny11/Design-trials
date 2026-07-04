// PRISM SHELL — /app/* SESSION BOUNDARY (SHELL W1A, spec §14 W1A)
//
// The REAL guard behind the middleware's optimistic cookie check: every
// /app/* render verifies the session against Better Auth server-side. No
// valid session → premium sign-in, preserving the intended destination.
// Data access below this layer is separately gated (protectedProcedure,
// guarded asset routes) — this boundary is about pages, those are about
// data; both fail closed (I11).

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import '@/components/shell/design/prism-premium.css';
import '@/components/shell/nav/shell-nav.css';
import ShellNav3D from '@/components/shell/nav/ShellNav3D';
import { shellDisplay, shellMono } from '@/components/shell/design/shell-fonts';
import { auth, ensureAuthSchema } from '../../server/auth/auth';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/sign-in');
  }
  const user = session.user as typeof session.user & { planTier?: string };
  return (
    <div className={`${shellDisplay.variable} ${shellMono.variable}`}>
      {children}
      {/* E13 global slide-out nav — present on dashboard AND builder; renders
          null when this layout is inside the engine iframe (client-side). */}
      <ShellNav3D
        userName={user.name}
        userEmail={user.email}
        planTier={typeof user.planTier === 'string' ? user.planTier : 'free'}
      />
    </div>
  );
}
