// PRISM MARKETING — GALLERY (SHELL W6, S2 / E2 templates + showcase)
//
// E2: a starter gallery of .prism template graphs. "Remix" forks a template
// into the visitor's account — the handoff is the same auth-aware path as the
// prompt bar (sign-up → build). Server-rendered; each card's signature jewel is
// a lazy 3D island.

import type { Metadata } from 'next';
import Link from 'next/link';
import { TemplateThumb } from '@/components/marketing/islands';
import { TEMPLATES } from '@/lib/marketing/content';

export const metadata: Metadata = {
  title: 'Gallery',
  description:
    'Start from a masterpiece. Fork a real .prism template into your account and make it yours — commerce, SaaS, portfolio, dashboard, and more.',
  alternates: { canonical: '/gallery' },
};

function remixHref(slug: string, live?: boolean): string {
  // W8 E2: live templates fork the real .prism graph into the account
  // (/app?remix=<slug> resolves post-auth). Aspirational cards route to a fresh
  // build seeded by the template idea.
  const next = live ? `/app?remix=${slug}` : `/app/build?template=${slug}`;
  return `/sign-up?next=${encodeURIComponent(next)}`;
}

export default function GalleryPage() {
  return (
    <>
      <section className="mk-section mk-wrap" aria-labelledby="mk-gal-title">
        <p className="mk-kicker">Templates</p>
        <h1 className="mk-h2" id="mk-gal-title" style={{ fontSize: 'clamp(34px, 5.4vw, 58px)', maxWidth: '20ch' }}>
          Start from a masterpiece.
        </h1>
        <p className="mk-lead">
          Every template is a real .prism graph — not a screenshot. Fork one into your
          account, then build on it by conversation or on the canvas.
        </p>

        <div className="mk-gallery" style={{ marginTop: 40 }}>
          {TEMPLATES.map((t) => (
            <article className="mk-card" key={t.slug}>
              <div className="mk-card-thumb">
                <TemplateThumb accent={t.accent} />
              </div>
              <div className="mk-card-body">
                <h2 className="mk-card-name">
                  {t.name}
                  {t.live ? (
                    <span className="mk-tag" style={{ marginLeft: 8, verticalAlign: 'middle', color: '#d8a24a', borderColor: 'rgba(216,162,74,0.4)' }}>
                      Live
                    </span>
                  ) : null}
                </h2>
                <p className="mk-card-tag">{t.tagline}</p>
                <div className="mk-tags">
                  {t.tags.map((tag) => (
                    <span className="mk-tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mk-card-foot">
                  {t.live ? (
                    <Link href={`/templates/${t.slug}`} className="mk-btn mk-btn-red">
                      Preview
                    </Link>
                  ) : null}
                  <Link href={remixHref(t.slug, t.live)} className={t.live ? 'mk-btn mk-btn-ghost' : 'mk-btn mk-btn-red'}>
                    Remix
                  </Link>
                  {!t.live ? (
                    <Link href="/app/build" className="mk-btn mk-btn-ghost">
                      Start fresh
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-cta-band" aria-labelledby="mk-gal-cta">
        <div className="mk-wrap">
          <h2 className="mk-cta-h" id="mk-gal-cta">
            None of these? Describe your own.
          </h2>
          <p className="mk-cta-sub">
            Templates are a head start, not a limit. Start from a blank prompt and build
            exactly what you imagine.
          </p>
          <div className="mk-cta-actions">
            <Link href="/app/build" className="mk-btn mk-btn-red">
              Start from a prompt
            </Link>
            <Link href="/how-it-works" className="mk-btn mk-btn-ghost">
              See how it works
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
