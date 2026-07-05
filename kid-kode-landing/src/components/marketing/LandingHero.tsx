'use client';

// PRISM MARKETING — HERO (SHELL W6, S2 hero / DL8)
//
// The landing hero: headline + sub + the Phase-0 prompt bar on the left, the
// live 3D showpiece on the right. The headline and prompt are server-rendered
// (this client component's initial HTML is SSR'd) so first paint is instant and
// the LCP element (the headline) never waits on 3D. The showpiece is a
// dynamic(ssr:false) island behind a static poster inside Lazy3D — it hydrates
// after paint and degrades to the poster on low-GPU / no-WebGL (DL8).

import dynamic from 'next/dynamic';
import Lazy3D from './Lazy3D';
import { HeroPoster } from './posters';
import HeroPrompt from './HeroPrompt';

const HeroShowpiece3D = dynamic(() => import('./HeroShowpiece3D'), { ssr: false });

export default function LandingHero() {
  return (
    <section className="mk-hero mk-wrap" aria-labelledby="mk-hero-title">
      <div className="mk-hero-grid">
        <div className="mk-hero-copy">
          <p className="mk-hero-eyebrow">
            <span className="mk-dot" aria-hidden="true" />
            Prompt-to-app, rendered in real 3D
          </p>
          <h1 className="mk-h1" id="mk-hero-title">
            Describe it. Watch it <span className="mk-h1-accent">build</span>. Ship it.
          </h1>
          <p className="mk-hero-sub">
            Prism turns a sentence into a real, running application — authored as a
            live 3D world, verified before it ships, and yours to deploy anywhere.
          </p>
          <HeroPrompt />
        </div>

        <div className="mk-hero-stage">
          <Lazy3D poster={<HeroPoster />} heavy>
            <HeroShowpiece3D />
          </Lazy3D>
          <span className="mk-hero-badge">
            <span className="mk-live-dot" aria-hidden="true" />
            Live · real-time 3D
          </span>
        </div>
      </div>
    </section>
  );
}
