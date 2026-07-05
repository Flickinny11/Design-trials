// PRISM MARKETING — CHANGELOG (SHELL W6, S2)
//
// A public changelog shell. Entries mirror the shipped shell waves so the
// timeline is truthful. Server-rendered.

import type { Metadata } from 'next';
import Link from 'next/link';
import { CHANGELOG } from '@/lib/marketing/content';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'What is new in Prism — the shipped milestones, newest first.',
  alternates: { canonical: '/changelog' },
};

export default function ChangelogPage() {
  return (
    <>
      <section className="mk-section mk-wrap" aria-labelledby="mk-cl-title">
        <p className="mk-kicker">Changelog</p>
        <h1 className="mk-h2" id="mk-cl-title" style={{ fontSize: 'clamp(34px, 5.4vw, 58px)', maxWidth: '18ch' }}>
          What is new in Prism.
        </h1>
        <p className="mk-lead">The shipped milestones, newest first.</p>

        <div className="mk-log" style={{ marginTop: 40 }}>
          {CHANGELOG.map((entry) => (
            <article className="mk-log-entry" key={entry.version}>
              <div className="mk-log-meta">
                <span className="mk-log-ver">{entry.version}</span>
                <time className="mk-log-date" dateTime={entry.date}>
                  {entry.date}
                </time>
              </div>
              <div>
                <h2 className="mk-log-title">{entry.title}</h2>
                <ul className="mk-log-notes">
                  {entry.notes.map((note) => (
                    <li className="mk-log-note" key={note}>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-cta-band" aria-labelledby="mk-cl-cta">
        <div className="mk-wrap">
          <h2 className="mk-cta-h" id="mk-cl-cta">
            Build on the newest Prism.
          </h2>
          <p className="mk-cta-sub">Every improvement above is live in the builder today.</p>
          <div className="mk-cta-actions">
            <Link href="/app/build" className="mk-btn mk-btn-red">
              Start building
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
