'use client';

// PRISM SHELL — TEMPLATES (E2 gallery SHELL, SHELL W4)
//
// The starter-graph gallery shell. The full curated set of .prism template
// graphs + Remix-into-your-account seeds in W8 (spec §12 W8); here the shell is
// real and USABLE — each starter routes into Guided Build pre-seeded with its
// brief so nothing is a dead tile (an S3 "not a void" requirement applied to
// the panel). Clean-but-premium working surface (Decision A).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { remixTemplate } from '@/lib/shell/tenancy-client';

interface Starter {
  key: string;
  name: string;
  blurb: string;
  seed: string;
}

// W8 E2 — the LIVE, remixable SR-flagship templates (real .prism graphs in the
// registry). Preview opens the running template; Remix forks it straight into
// this account (the user is already authed here) and opens the builder.
interface LiveTemplate {
  slug: string;
  name: string;
  blurb: string;
}
const LIVE_TEMPLATES: readonly LiveTemplate[] = [
  {
    slug: 'kinetic-scroll-hero',
    name: 'Aperture — Kinetic Scroll Hero',
    blurb: 'Scroll-scrub product hero, kinetic type, cursor parallax, dissolve.',
  },
  {
    slug: 'cursor-gallery',
    name: 'Atlas — Cursor Gallery',
    blurb: 'Cursor-reactive editorial grid, magnetic beam cursor, veil transition.',
  },
  {
    slug: 'particle-showpiece',
    name: 'Nova — Particle Showpiece',
    blurb: 'Cursor attract/repel particle field, halo cursor, glass sweep.',
  },
];

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
  const [remixing, setRemixing] = useState<string | null>(null);

  const doRemix = async (slug: string) => {
    if (remixing) return;
    setRemixing(slug);
    try {
      const project = await remixTemplate(slug);
      router.push(`/app/builder/${project.id}`);
    } catch {
      setRemixing(null);
    }
  };

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
        Remix a real .prism template into your account — the graph opens in the
        builder, fully editable on the canvas and in the node editors.
      </p>
      <ul className="dw-tpl-grid" data-live-templates>
        {LIVE_TEMPLATES.map((t) => (
          <li key={t.slug}>
            <div className="dw-tpl-card" style={{ cursor: 'default' }}>
              <span className="dw-tpl-mark" aria-hidden />
              <span className="dw-tpl-name">{t.name}</span>
              <span className="dw-tpl-blurb">{t.blurb}</span>
              <span className="dw-tpl-remix" style={{ display: 'flex', gap: 12 }}>
                <a href={`/templates/${t.slug}`} target="_blank" rel="noreferrer">
                  Preview ↗
                </a>
                <button
                  type="button"
                  onClick={() => void doRemix(t.slug)}
                  disabled={remixing === t.slug}
                  style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', font: 'inherit', padding: 0 }}
                  data-testid={`remix-${t.slug}`}
                >
                  {remixing === t.slug ? 'Forking…' : 'Remix →'}
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="dw-panel-lead" style={{ marginTop: 24 }}>
        Or start from a brief — these open Guided Build pre-seeded.
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
