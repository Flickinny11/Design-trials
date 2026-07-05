// PRISM MARKETING — LANDING (SHELL W6, S2)
//
// The public landing. Server-rendered for SEO; the only client islands are the
// 3D showpieces (hero, feature icons, template jewels), each lazy + poster-
// backed so first paint is instant (DL8). Sections: hero + prompt bar → stats →
// how it works → capabilities → template gallery teaser → pricing teaser → FAQ
// → closing CTA. Every CTA routes into the app (no dead-ends).

import type { Metadata } from 'next';
import Link from 'next/link';
import LandingHero from '@/components/marketing/LandingHero';
import { FeatureIcon, TemplateThumb } from '@/components/marketing/islands';
import IntegrationsWall from '@/components/marketing/forge/IntegrationsWall';
import { FEATURES, HOW_STEPS, STATS, TEMPLATES, PRICING_TIERS, FAQ, MANAGED_CARE } from '@/lib/marketing/content';

export const metadata: Metadata = {
  title: 'Describe it. Watch it build. Ship it.',
  description:
    'Prism turns a sentence into a real, running application — authored as a live 3D world, verified before it ships, and yours to deploy anywhere. Start free.',
  alternates: { canonical: '/home' },
};

export default function LandingPage() {
  const teaserTemplates = TEMPLATES.slice(0, 3);
  return (
    <>
      <LandingHero />

      {/* Stat strip */}
      <section className="mk-wrap" aria-label="At a glance">
        <div className="mk-stats">
          {STATS.map((s) => (
            <div className="mk-stat" key={s.label}>
              <div className="mk-stat-value">{s.value}</div>
              <div className="mk-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mk-section mk-wrap" aria-labelledby="mk-how">
        <p className="mk-kicker">How it works</p>
        <h2 className="mk-h2" id="mk-how">
          From a sentence to a shipped app, in three moves.
        </h2>
        <p className="mk-lead">
          The guided path does the heavy lifting — you stay in control at every gate.
        </p>
        <div className="mk-steps">
          {HOW_STEPS.map((step) => (
            <article className="mk-step" key={step.n}>
              <div className="mk-step-n">{step.n}</div>
              <div className="mk-step-kicker">{step.kicker}</div>
              <h3 className="mk-step-title">{step.title}</h3>
              <p className="mk-step-body">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Capabilities / features */}
      <section className="mk-section mk-wrap" aria-labelledby="mk-features">
        <p className="mk-kicker">What you get</p>
        <h2 className="mk-h2" id="mk-features">
          A real engine, not a template.
        </h2>
        <p className="mk-lead">
          Everything renders in one continuous 3D scene — the same engine that builds
          your app powers this page.
        </p>
        <div className="mk-features">
          {FEATURES.map((f) => (
            <article className="mk-feature" key={f.title}>
              <div className="mk-feature-icon">
                <FeatureIcon icon={f.icon} />
              </div>
              <h3 className="mk-feature-title">{f.title}</h3>
              <p className="mk-feature-body">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Integrations wall — DL15 real, colored, 3D brand marks */}
      <section className="mk-section mk-wrap" aria-labelledby="mk-integrations">
        <p className="mk-kicker">Connect anything</p>
        <h2 className="mk-h2" id="mk-integrations">
          Wire in the tools you already use.
        </h2>
        <p className="mk-lead">
          A curated one-click catalog covers the popular integrations — and when
          something is not on the list, an agent authors a connector for it. If it has
          an API, you can wire it. Secrets stay server-side; nothing sensitive touches
          the browser.
        </p>
        <IntegrationsWall />
      </section>

      {/* Gallery teaser */}
      <section className="mk-section mk-wrap" aria-labelledby="mk-gallery-teaser">
        <p className="mk-kicker">Start from a masterpiece</p>
        <h2 className="mk-h2" id="mk-gallery-teaser">
          Remix a template, or start from your own idea.
        </h2>
        <p className="mk-lead">
          Every template is a real .prism graph. Fork one into your account and make it
          yours.
        </p>
        <div className="mk-gallery">
          {teaserTemplates.map((t) => (
            <article className="mk-card" key={t.slug}>
              <div className="mk-card-thumb">
                <TemplateThumb accent={t.accent} />
              </div>
              <div className="mk-card-body">
                <h3 className="mk-card-name">{t.name}</h3>
                <p className="mk-card-tag">{t.tagline}</p>
                <div className="mk-tags">
                  {t.tags.map((tag) => (
                    <span className="mk-tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mk-card-foot">
                  <Link href={`/sign-up?next=${encodeURIComponent('/app?panel=templates')}`} className="mk-btn mk-btn-ghost">
                    Remix
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div style={{ marginTop: 32 }}>
          <Link href="/gallery" className="mk-btn mk-btn-solid">
            Browse all templates
          </Link>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mk-section mk-wrap" aria-labelledby="mk-pricing-teaser">
        <p className="mk-kicker">Pricing</p>
        <h2 className="mk-h2" id="mk-pricing-teaser">
          Start free. Scale when you ship.
        </h2>
        <p className="mk-lead">
          Real per-tenant limits, an honest usage meter, and no lock-in on any tier.
        </p>
        <div className="mk-pricing">
          {PRICING_TIERS.map((tier) => (
            <article className="mk-tier" key={tier.id} data-featured={tier.featured ? 'true' : 'false'}>
              {tier.featured ? <span className="mk-tier-badge">Most popular</span> : null}
              <h3 className="mk-tier-name">{tier.name}</h3>
              <div className="mk-tier-price">
                <span className="mk-tier-price-value">{tier.price}</span>
                {tier.cadence ? <span className="mk-tier-price-cadence">{tier.cadence}</span> : null}
              </div>
              <p className="mk-tier-summary">{tier.summary}</p>
              <div className="mk-tier-cta">
                <Link href={tier.ctaHref} className={`mk-btn ${tier.featured ? 'mk-btn-red' : 'mk-btn-solid'}`}>
                  {tier.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
        <p className="mk-care-line">
          <span className="mk-care-line-price">{MANAGED_CARE.name} — {MANAGED_CARE.price}{' '}{MANAGED_CARE.cadence}</span>
          {' '}keeps a shipped app healthy on Pro and Enterprise. The free fix-anytime
          path is always on for everyone.
        </p>
        <div style={{ marginTop: 28 }}>
          <Link href="/pricing" className="mk-btn mk-btn-ghost">
            Compare tiers in full
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mk-section mk-wrap" aria-labelledby="mk-faq">
        <p className="mk-kicker">Questions</p>
        <h2 className="mk-h2" id="mk-faq">
          The honest answers.
        </h2>
        <div className="mk-faq">
          {FAQ.map((item) => (
            <div className="mk-faq-item" key={item.q}>
              <h3 className="mk-faq-q">{item.q}</h3>
              <p className="mk-faq-a">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mk-cta-band" aria-labelledby="mk-cta">
        <div className="mk-wrap">
          <h2 className="mk-cta-h" id="mk-cta">
            Your next app is one sentence away.
          </h2>
          <p className="mk-cta-sub">
            Describe what you want to build. Prism takes it from there — and you own the result.
          </p>
          <div className="mk-cta-actions">
            <Link href="/app/build" className="mk-btn mk-btn-red">
              Start building — free
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
