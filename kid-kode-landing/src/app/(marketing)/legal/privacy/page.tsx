// PRISM MARKETING — PRIVACY SHELL (SHELL W6, S2)

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Prism collects and how we handle it.',
  alternates: { canonical: '/legal/privacy' },
};

export default function PrivacyPage() {
  return (
    <section className="mk-section mk-wrap">
      <div className="mk-prose">
        <h2>Privacy Policy</h2>
        <p>
          <em>Version 1 shell · last updated 2026-07-04.</em> A working draft maintained
          as Prism approaches general availability.
        </p>

        <h3>What we collect</h3>
        <ul>
          <li>Account basics — your name and email, via Better Auth (Google, GitHub, or email).</li>
          <li>Your projects and builds — stored in your isolated tenant.</li>
          <li>Operational logs needed to run and secure the service.</li>
        </ul>

        <h3>What we do not do</h3>
        <p>
          We do not sell your data, and we do not expose one tenant&rsquo;s content to
          another. Integration secrets are delegated to the provider and resolved
          server-side — Prism stores capability references, never raw tokens or keys.
        </p>

        <h3>Your controls</h3>
        <p>
          You can export a portable bundle of any project and delete projects at any time.
          For data or deletion requests, contact{' '}
          <a href="mailto:privacy@prism.build">privacy@prism.build</a>.
        </p>

        <p style={{ marginTop: 28 }}>
          <Link href="/legal" className="mk-btn mk-btn-ghost">
            Back to legal
          </Link>
        </p>
      </div>
    </section>
  );
}
