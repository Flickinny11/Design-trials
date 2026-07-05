'use client';

// PRISM MARKETING — HERO (SHELL W9, S2 hero / DL8 DL11 DL16)
//
// The Forge hero: a FULL-BLEED live WebGPU stage — the dispersive prism, the
// compute-particle galaxy, the machined pedestal — with the copy and Phase-0
// prompt riding on top behind a legibility scrim. The headline is SSR'd (LCP
// never waits on 3D); the stage hydrates behind the static poster via Lazy3D
// and degrades to the poster on low-GPU / no-WebGL (DL8). The camera answers
// the pointer and the scroll — the visitor's own motion directs the scene.

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import Lazy3D from './Lazy3D';
import { HeroPoster } from './posters';
import HeroPrompt from './HeroPrompt';
import { usePrefersReducedMotion } from '../shell/builder/use-reduced-motion';
import { useMkScrollProgress } from './forge/use-mk-scroll';

const HeroForgeStage = dynamic(() => import('./forge/HeroForgeStage'), { ssr: false });

export default function LandingHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const progress = useMkScrollProgress(sectionRef);
  const reduced = usePrefersReducedMotion();
  const [backend, setBackend] = useState<string | null>(null);

  // Honest badge: name the backend actually rendering (WebGPU or WebGL2).
  useEffect(() => {
    let alive = true;
    const read = () => {
      const b = (window as unknown as { __PRISM_MK_BACKEND__?: string }).__PRISM_MK_BACKEND__;
      if (b && alive) setBackend(b);
      else if (alive) setTimeout(read, 500);
    };
    read();
    return () => {
      alive = false;
    };
  }, []);

  const onPointerMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.current.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  };

  return (
    <section
      ref={sectionRef}
      className="mk-hero-forge"
      aria-labelledby="mk-hero-title"
      onPointerMove={onPointerMove}
    >
      {/* Full-bleed live stage behind the copy */}
      <div className="mk-hero-forge-stage" aria-hidden="true">
        <Lazy3D poster={<HeroPoster />} heavy rootMargin="600px">
          <HeroForgeStage progress={progress} pointer={pointer} reduced={reduced} />
        </Lazy3D>
        <div className="mk-hero-forge-scrim" />
      </div>

      <div className="mk-wrap mk-hero-forge-inner">
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
      </div>

      <span className="mk-hero-badge mk-hero-badge--forge">
        <span className="mk-live-dot" aria-hidden="true" />
        {backend === 'webgpu' ? 'Live · WebGPU' : backend === 'webgl2' ? 'Live · WebGL2' : 'Live · real-time 3D'}
      </span>
      <span className="mk-hero-scrollcue" aria-hidden="true">
        Scroll
        <svg width="10" height="26" viewBox="0 0 10 26">
          <path d="M5 1v20M1.5 17.5 5 21l3.5-3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </section>
  );
}
