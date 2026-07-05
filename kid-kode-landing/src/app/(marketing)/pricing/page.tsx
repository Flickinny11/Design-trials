// PRISM MARKETING — PRICING (SHELL W6, S2 / E6 tier stubs)
//
// E6 "schema now, Stripe later": prices are honestly labelled stubs; the limits
// mirror the real per-tier quotas the usage meter enforces. Model identity is
// pulled from the single model-config source (getModelRegistry) — NO model-id
// strings live in this component (spec 7.4 / FP4).

import type { Metadata } from 'next';
import Link from 'next/link';
import { PRICING_TIERS, FAQ, MANAGED_CARE, SHIP_FACTS } from '@/lib/marketing/content';
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
          Every tier is free while Prism is in preview — the usage limits below are
          the real per-tenant quotas already enforced in the app. The only price set
          today is Managed Care; plan pricing finalizes when checkout goes live.
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

        {/* Managed Care — the one committed price (managed-care.ts). */}
        <div className="mk-care" role="group" aria-labelledby="mk-care-title">
          <div className="mk-care-head">
            <div>
              <p className="mk-kicker mk-care-kicker">Keep it running</p>
              <h2 className="mk-care-name" id="mk-care-title">{MANAGED_CARE.name}</h2>
            </div>
            <div className="mk-care-price">
              <span className="mk-care-price-value">{MANAGED_CARE.price}</span>
              <span className="mk-care-price-cadence">{MANAGED_CARE.cadence}</span>
            </div>
          </div>
          <p className="mk-care-summary">{MANAGED_CARE.summary}</p>
          <p className="mk-care-elig">{MANAGED_CARE.eligibility} · {MANAGED_CARE.note}</p>
          <p className="mk-care-free">{MANAGED_CARE.freePath}</p>
        </div>

        {/* Ship & own — the deployment truth (W5/W5B). */}
        <div className="mk-shipfacts" aria-label="Ship and own">
          {SHIP_FACTS.map((f) => (
            <div className="mk-shipfact" key={f.title}>
              <h3 className="mk-shipfact-title">{f.title}</h3>
              <p className="mk-shipfact-body">{f.body}</p>
            </div>
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
            <h3 className="mk-faq-q">What does it cost right now?</h3>
            <p className="mk-faq-a">
              Nothing. Prism is in preview, so every plan is free to use today — the
              tiers and their limits are real and enforced per account, but checkout
              isn&rsquo;t wired yet. The only set price is Managed Care at $39/mo per app,
              and even that is opt-in: you can always prompt Prism to fix or optimize a
              shipped app for free. The usage meter shows your real counts today.
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
