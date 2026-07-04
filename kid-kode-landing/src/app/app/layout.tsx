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
  return <>{children}</>;
}
