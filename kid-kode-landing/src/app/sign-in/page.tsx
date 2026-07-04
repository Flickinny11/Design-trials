// PRISM SHELL — SIGN-IN ROUTE (SHELL W1A, spec §1 S1)
//
// Server shell for the premium auth surface: resolves provider availability
// (from env, server-side — I5) and bounces already-signed-in visitors
// straight to their destination. All rendering is the shared AuthScreen.

import '@/components/shell/design/prism-premium.css';
import '@/components/shell/auth/auth.css';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AuthScreen from '@/components/shell/auth/AuthScreen';
import { shellDisplay, shellMono } from '@/components/shell/design/shell-fonts';
import { auth, configuredSocialProviders, ensureAuthSchema } from '@/server/auth/auth';
import { safeNextPath } from '@/lib/shell/safe-next-path';

export const metadata = { title: 'Sign in — Prism' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect(nextPath);
  return (
    <div className={`${shellDisplay.variable} ${shellMono.variable}`}>
      <AuthScreen
        mode="sign-in"
        providers={configuredSocialProviders()}
        nextPath={nextPath}
      />
    </div>
  );
}
