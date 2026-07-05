// PRISM MARKETING — LEGAL INDEX (SHELL W6, S2)
//
// Legal hub — links to the terms and privacy shells plus a contact anchor
// (referenced by the enterprise/sales CTAs). Server-rendered.

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Legal',
  description: 'Prism legal center — terms of service, privacy policy, and how to reach us.',
  alternates: { canonical: '/legal' },
};

export default function LegalPage() {
  return (
    <section className="mk-section mk-wrap">
      <div className="mk-prose">
        <h2>Legal center</h2>
        <p>
          The documents that govern your use of Prism. These are v1 shells maintained as
          the product moves toward general availability.
        </p>
        <ul>
          <li>
            <Link href="/legal/terms">Terms of Service</Link> — the agreement between you
            and Prism.
          </li>
          <li>
            <Link href="/legal/privacy">Privacy Policy</Link> — what we collect and how we
            handle it.
          </li>
        </ul>

        <h2 id="contact">Contact</h2>
        <p>
          For sales, enterprise, security, or legal enquiries, reach us at{' '}
          <a href="mailto:hello@prism.build">hello@prism.build</a>. Enterprise plans
          include a shared org dashboard, live multiplayer, SSO, and dedicated support —
          tell us about your team and we will get you set up.
        </p>
        <p style={{ marginTop: 24 }}>
          <Link href="/pricing" className="mk-btn mk-btn-ghost">
            Back to pricing
          </Link>
        </p>
      </div>
    </section>
  );
}
