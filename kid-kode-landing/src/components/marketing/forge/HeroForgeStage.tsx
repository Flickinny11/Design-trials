'use client';

// PRISM MARKETING — HERO STAGE MOUNT (SHELL W9)
//
// The dynamic-import boundary for the Forge: MarketingCanvas (three/webgpu) +
// the scene, faded in once the first frame exists. Kept separate from
// LandingHero so the heavy renderer chunk loads lazily behind the poster.

import { useState, type RefObject } from 'react';
import MarketingCanvas from './MarketingCanvas';
import HeroForgeScene from './HeroForge3D';

export default function HeroForgeStage({
  progress,
  pointer,
  reduced,
}: {
  progress: RefObject<number>;
  pointer: RefObject<{ x: number; y: number }>;
  reduced: boolean;
}) {
  const [ready, setReady] = useState(false);
  return (
    <div
      className="mk-hero-forge-canvas"
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 700ms var(--pp-ease-hero, ease)' }}
    >
      <MarketingCanvas
        camera={{ position: [-2.6, 1.75, 6.6], fov: 38, near: 0.1, far: 60 }}
        onReady={() => setReady(true)}
        style={{ position: 'absolute', inset: 0 }}
      >
        <HeroForgeScene progress={progress} pointer={pointer} reduced={reduced} />
      </MarketingCanvas>
    </div>
  );
}
