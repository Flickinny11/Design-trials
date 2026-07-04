'use client';

// PRISM SHELL — AUTH SCREEN (SHELL W1A, spec §1 S1 / §14 W1A / DESIGN LAW)
//
// The premium sign-in / sign-up surface. Dark-first (DL1), --pp-* token
// layer (DL2/DL7), Fraunces display × JetBrains Mono utility (DL3, founder
// lock "font A"). The three primary actions — Google, GitHub, Email — are
// rendered objects on ONE shared canvas (AuthObjectRow, DL11/DL12 + DL8
// rider). The email form itself is a working surface: clean-but-premium
// DOM fields (Decision A / DL10 restraint), no glassmorphism, no icon
// packs, no credential ever typed for a THIRD-PARTY service here (I5 —
// these fields are our own first-party auth only).
//
// All flows ride the ONE Better Auth client (I2). OAuth = full-page
// redirect to /api/auth (one click); email = signIn/signUp then a client
// navigation to the guarded destination.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signIn, signUp } from '@/lib/shell/auth-client';
import AuthObjectRow, { type AuthProviderCell } from './AuthObjectRow';

export interface AuthScreenProps {
  mode: 'sign-in' | 'sign-up';
  providers: { google: boolean; github: boolean };
  /** Server-sanitized in-app destination (always a same-origin path). */
  nextPath: string;
}

export default function AuthScreen({ mode, providers, nextPath }: AuthScreenProps) {
  const router = useRouter();
  const [emailOpen, setEmailOpen] = useState(false);
  const [busy, setBusy] = useState<'google' | 'github' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const signingUp = mode === 'sign-up';

  async function social(provider: 'google' | 'github') {
    setError(null);
    setBusy(provider);
    const { error: err } = await signIn.social({
      provider,
      callbackURL: nextPath,
    });
    // On success the browser is navigating to the provider; only an error
    // returns control here.
    if (err) {
      setError(err.message ?? `Could not reach ${provider}.`);
      setBusy(null);
    }
  }

  async function submitEmail() {
    if (busy) return;
    setError(null);
    if (!email || !password || (signingUp && !name)) {
      setError(
        signingUp
          ? 'Name, email, and password are all required.'
          : 'Email and password are required.',
      );
      return;
    }
    setBusy('email');
    const result = signingUp
      ? await signUp.email({ name, email, password })
      : await signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? 'Authentication failed.');
      setBusy(null);
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  const cells: AuthProviderCell[] = [
    {
      key: 'google',
      label: 'Google',
      sublabel: providers.google ? 'one click' : 'awaiting keys',
      enabled: providers.google,
      busy: busy === 'google',
      onActivate: () => void social('google'),
    },
    {
      key: 'github',
      label: 'GitHub',
      sublabel: providers.github ? 'one click' : 'awaiting keys',
      enabled: providers.github,
      busy: busy === 'github',
      onActivate: () => void social('github'),
    },
    {
      key: 'email',
      label: emailOpen ? 'Continue' : 'Email',
      sublabel: emailOpen
        ? busy === 'email'
          ? 'working'
          : signingUp
            ? 'create account'
            : 'sign in'
        : 'with password',
      enabled: true,
      busy: busy === 'email',
      onActivate: () => {
        if (!emailOpen) {
          setEmailOpen(true);
          return;
        }
        void submitEmail();
      },
    },
  ];

  return (
    <main className="aw1-screen">
      <div className="aw1-stage">
        <p className="aw1-kicker">PRISM · ACCOUNTS</p>
        <h1 className="aw1-headline">
          {signingUp ? 'Create your account' : 'Sign in'}
        </h1>
        <p className="aw1-sub">
          One account. Every project, build, and asset in it is yours alone —
          isolated per tenant, by law of the system.
        </p>

        <section className="aw1-card" aria-label="Sign-in methods">
          <AuthObjectRow cells={cells} />

          {emailOpen && (
            <form
              className="aw1-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submitEmail();
              }}
            >
              {signingUp && (
                <label className="aw1-field">
                  <span className="aw1-field-label">Name</span>
                  <input
                    className="aw1-input"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy === 'email'}
                  />
                </label>
              )}
              <label className="aw1-field">
                <span className="aw1-field-label">Email</span>
                <input
                  className="aw1-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy === 'email'}
                />
              </label>
              <label className="aw1-field">
                <span className="aw1-field-label">Password</span>
                <input
                  className="aw1-input"
                  type="password"
                  autoComplete={signingUp ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy === 'email'}
                />
              </label>
              {/* Keyboard path: Enter submits; the jewel is the pointer path. */}
              <button type="submit" className="aw1-submit-fallback">
                {signingUp ? 'Create account' : 'Sign in'}
              </button>
            </form>
          )}

          <p className="aw1-error" role="alert" aria-live="polite">
            {error ?? ''}
          </p>
        </section>

        <p className="aw1-switch">
          {signingUp ? (
            <>
              Already have an account?{' '}
              <a
                href={`/sign-in${nextPath !== '/app' ? `?next=${encodeURIComponent(nextPath)}` : ''}`}
              >
                Sign in
              </a>
            </>
          ) : (
            <>
              New to Prism?{' '}
              <a
                href={`/sign-up${nextPath !== '/app' ? `?next=${encodeURIComponent(nextPath)}` : ''}`}
              >
                Create an account
              </a>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
