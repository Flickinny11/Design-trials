'use client';

// PRISM SHELL — TEMPLATES (E2 gallery SHELL, SHELL W4)
//
// The starter-graph gallery shell. The full curated set of .prism template
// graphs + Remix-into-your-account seeds in W8 (spec §12 W8); here the shell is
// real and USABLE — each starter routes into Guided Build pre-seeded with its
// brief so nothing is a dead tile (an S3 "not a void" requirement applied to
// the panel). Clean-but-premium working surface (Decision A).

import { useRouter } from 'next/navigation';

interface Starter {
  key: string;
  name: string;
  blurb: string;
  seed: string;
}

const STARTERS: readonly Starter[] = [
  {
    key: 'landing',
    name: 'Product landing',
    blurb: 'Hero showpiece, features, pricing, CTA — a premium 3D landing.',
    seed: 'A premium product landing page with a 3D hero showpiece, feature sections, pricing, and a call to action',
  },
  {
    key: 'dashboard',
    name: 'SaaS dashboard',
    blurb: 'Auth, data tables, charts, settings — a working app shell.',
    seed: 'A SaaS dashboard with authentication, data tables, charts, and a settings page',
  },
  {
    key: 'portfolio',
    name: 'Portfolio',
    blurb: 'Scroll-journey gallery with cursor-reactive, cinematic motion.',
    seed: 'A cinematic portfolio site with a scroll journey, a cursor-reactive gallery, and animated case studies',
  },
  {
    key: 'store',
    name: 'Storefront',
    blurb: 'Catalog, cart, checkout, payments — commerce-ready.',
    seed: 'An online storefront with a product catalog, cart, checkout, and payments',
  },
];

export default function TemplatesPanel() {
  const router = useRouter();
  return (
    <section className="dw-panel" aria-labelledby="dw-templates-h">
      <div className="dw-panel-head">
        <div>
          <p className="dw-panel-kicker">TEMPLATES · E2</p>
          <h2 id="dw-templates-h" className="dw-panel-title">
            Start from a graph
          </h2>
        </div>
      </div>
      <p className="dw-panel-lead">
        Remix a starter into your account. The full curated gallery lands soon —
        every starter here already opens Guided Build pre-seeded.
      </p>
      <ul className="dw-tpl-grid">
        {STARTERS.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              className="dw-tpl-card"
              onClick={() =>
                router.push(`/app/build?prompt=${encodeURIComponent(s.seed)}`)
              }
            >
              <span className="dw-tpl-mark" aria-hidden />
              <span className="dw-tpl-name">{s.name}</span>
              <span className="dw-tpl-blurb">{s.blurb}</span>
              <span className="dw-tpl-remix">Remix →</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
