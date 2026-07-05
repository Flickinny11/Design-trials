// PRISM MARKETING — TERMS SHELL (SHELL W6, S2)

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern your use of Prism.',
  alternates: { canonical: '/legal/terms' },
};

export default function TermsPage() {
  return (
    <section className="mk-section mk-wrap">
      <div className="mk-prose">
        <h2>Terms of Service</h2>
        <p>
          <em>Version 1 shell · last updated 2026-07-04.</em> These terms are a working
          draft maintained as Prism approaches general availability. They will be
          finalized before paid billing goes live.
        </p>

        <h3>1. Your account</h3>
        <p>
          You are responsible for your account and for keeping your credentials secure.
          Each account is an isolated tenant — your projects, storage, and builds are
          private to you unless you explicitly share them.
        </p>

        <h3>2. Your content</h3>
        <p>
          You own what you build. Prism claims no ownership over your prompts, graphs, or
          deployed applications. You may export a portable bundle of any project at any
          time.
        </p>

        <h3>3. Acceptable use</h3>
        <p>
          Do not use Prism to build or distribute unlawful, harmful, or infringing
          applications, and do not attempt to breach the isolation between tenants.
        </p>

        <h3>4. Service &amp; availability</h3>
        <p>
          Prism is provided on an as-is basis during this pre-general-availability period.
          Limits and quotas are described on the <Link href="/pricing">pricing page</Link>{' '}
          and enforced per account.
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
