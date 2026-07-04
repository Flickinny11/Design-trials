// PRISM SHELL — SIGN-UP ROUTE (SHELL W1A, spec §1 S1)
//
// Same premium surface as /sign-in in create-account mode (name field +
// signUp flow). One shared component — the two routes can never drift.

import '@/components/shell/design/prism-premium.css';
import '@/components/shell/auth/auth.css';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AuthScreen from '@/components/shell/auth/AuthScreen';
import { shellDisplay, shellMono } from '@/components/shell/design/shell-fonts';
import { auth, configuredSocialProviders, ensureAuthSchema } from '@/server/auth/auth';
import { safeNextPath } from '@/lib/shell/safe-next-path';

export const metadata = { title: 'Create your account — Prism' };

export default async function SignUpPage({
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
        mode="sign-up"
        providers={configuredSocialProviders()}
        nextPath={nextPath}
      />
    </div>
  );
}
