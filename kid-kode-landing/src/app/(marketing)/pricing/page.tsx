// PRISM MARKETING — PRICING (SHELL W6, S2 / E6 tier stubs)
//
// E6 "schema now, Stripe later": prices are honestly labelled stubs; the limits
// mirror the real per-tier quotas the usage meter enforces. Model identity is
// pulled from the single model-config source (getModelRegistry) — NO model-id
// strings live in this component (spec 7.4 / FP4).

import type { Metadata } from 'next';
import Link from 'next/link';
import { PRICING_TIERS, FAQ } from '@/lib/marketing/content';
import { getModelRegistry } from '@/lib/shell/model-config';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Start free and scale when you ship. Real per-tenant limits, an honest usage meter, and no lock-in on any tier.',
  alternates: { canonical: '/pricing' },
};

function CheckMark() {
  return (
    <svg className="mk-perk-mark" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5l3 3 7-8" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PricingPage() {
  // FP4-safe: labels + availability come from config, never literal ids.
  const models = getModelRegistry();
  return (
    <>
      <section className="mk-section mk-wrap" aria-labelledby="mk-pr-title">
        <p className="mk-kicker">Pricing</p>
        <h1 className="mk-h2" id="mk-pr-title" style={{ fontSize: 'clamp(34px, 5.4vw, 58px)', maxWidth: '18ch' }}>
          Start free. Scale when you ship.
        </h1>
        <p className="mk-lead">
          Prices below are indicative while billing is being wired — the usage limits
          are the real per-tenant quotas already enforced in the app.
        </p>

        <div className="mk-pricing" style={{ marginTop: 40 }}>
          {PRICING_TIERS.map((tier) => (
            <article className="mk-tier" key={tier.id} data-featured={tier.featured ? 'true' : 'false'}>
              {tier.featured ? <span className="mk-tier-badge">Most popular</span> : null}
              <h2 className="mk-tier-name">{tier.name}</h2>
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
              <dl className="mk-tier-limits">
                {tier.limits.map((l) => (
                  <div key={l.label} style={{ display: 'contents' }}>
                    <dt className="mk-limit-label">{l.label}</dt>
                    <dd className="mk-limit-value">{l.value}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mk-perks">
                {tier.perks.map((perk) => (
                  <li className="mk-perk" key={perk}>
                    <CheckMark />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {/* Model availability — from the single config source, not literals. */}
        <div className="mk-model-note">
          <strong>Every tier builds with the latest models.</strong>{' '}
          {models.map((m, i) => (
            <span key={m.id}>
              {i > 0 ? ' · ' : ''}
              {m.label}
              {m.status === 'gated' ? ` (${m.statusNote ?? 'coming soon'})` : ''}
            </span>
          ))}
          . Model choice is a setting, not a plan gate — the newest model is always
          the default.
        </div>
      </section>

      <section className="mk-section mk-wrap" aria-labelledby="mk-pr-faq">
        <p className="mk-kicker">Billing questions</p>
        <h2 className="mk-h2" id="mk-pr-faq">
          What you should know
        </h2>
        <div className="mk-faq">
          <div className="mk-faq-item">
            <h3 className="mk-faq-q">Why are the prices marked as stubs?</h3>
            <p className="mk-faq-a">
              Billing is being wired now. The tiers and their limits are real and already
              enforced per account; the dollar figures will finalize when checkout goes live.
              The usage meter in the app shows your real counts against these quotas today.
            </p>
          </div>
          {FAQ.slice(1).map((item) => (
            <div className="mk-faq-item" key={item.q}>
              <h3 className="mk-faq-q">{item.q}</h3>
              <p className="mk-faq-a">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-cta-band" aria-labelledby="mk-pr-cta">
        <div className="mk-wrap">
          <h2 className="mk-cta-h" id="mk-pr-cta">
            The free tier ships real apps.
          </h2>
          <p className="mk-cta-sub">No card to start. Build something and deploy it today.</p>
          <div className="mk-cta-actions">
            <Link href="/app/build" className="mk-btn mk-btn-red">
              Start free
            </Link>
            <Link href="/legal#contact" className="mk-btn mk-btn-ghost">
              Talk to sales
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
