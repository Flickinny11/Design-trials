'use client';

// PRISM MARKETING — INTEGRATIONS WALL (SHELL W9, req #4 / DL15)
//
// The one place DL5's icon ban lifts: real third-party brand marks, COLORED and
// 3D, in each brand's actual palette. We REUSE the shipped shell BrandMark set
// (src/components/shell/intake/BrandMark3D.tsx — imported, never modified) so the
// marketing wall and the in-app integration tiles render the identical marks.
//
// One shared WebGPU canvas holds every mark (bounds live GPU contexts to one —
// the WebGL2-fallback context cap lesson), and crisp DOM labels TRACK each mark
// by projecting its world position to screen each frame (no per-cell alignment
// guesswork, and type never lives inside the render — the W6 advocate lesson).

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import dynamic from 'next/dynamic';
import Lazy3D from '../Lazy3D';
import { MarkPoster } from '../posters';
import { BrandMark } from '@/components/shell/intake/BrandMark3D';
import { ForgeEnvironment, ForgeLights } from './ForgeEnvironment';

const MarketingCanvas = dynamic(() => import('./MarketingCanvas'), { ssr: false });

interface Brand {
  readonly mark: string;
  readonly name: string;
}

// Two rows (5 + 4), a classic logo wall. Every mark is real + brand-coloured.
const BRANDS: readonly Brand[] = [
  { mark: 'github', name: 'GitHub' },
  { mark: 'stripe', name: 'Stripe' },
  { mark: 'supabase', name: 'Supabase' },
  { mark: 'slack', name: 'Slack' },
  { mark: 'openai', name: 'OpenAI' },
  { mark: 'vercel', name: 'Vercel' },
  { mark: 'cloudflare', name: 'Cloudflare' },
  { mark: 'netlify', name: 'Netlify' },
  { mark: 'resend', name: 'Resend' },
];

// Grid positions in world space (5 on top, 4 offset below).
const LAYOUT: readonly [number, number][] = [
  [-4.4, 1.15], [-2.2, 1.15], [0, 1.15], [2.2, 1.15], [4.4, 1.15],
  [-3.3, -1.45], [-1.1, -1.45], [1.1, -1.45], [3.3, -1.45],
];

function MarkNode({
  index,
  hoveredRef,
  reduced,
}: {
  index: number;
  hoveredRef: RefObject<number>;
  reduced: boolean;
}) {
  const g = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const phase = useMemo(() => index * 1.7, [index]);
  const [x, y] = LAYOUT[index];
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const hot = hoveredRef.current === index;
    const ease = 1 - Math.exp(-dt * 9);
    if (g.current) {
      const bob = reduced ? 0 : Math.sin(t * 0.7 + phase) * 0.07;
      g.current.position.y += (y + bob - g.current.position.y) * ease;
      const s = hot ? 1.24 : 1;
      g.current.scale.x += (s - g.current.scale.x) * ease;
      g.current.scale.y = g.current.scale.z = g.current.scale.x;
    }
    if (spin.current) {
      const rate = hot ? 1.4 : reduced ? 0 : 0.28;
      spin.current.rotation.y += dt * rate;
    }
  });
  return (
    <group ref={g} position={[x, y, 0]}>
      <group ref={spin} scale={0.92}>
        <BrandMark mark={BRANDS[index].mark} />
      </group>
    </group>
  );
}

/** Projects each mark to screen space every frame and writes the position onto
 *  the matching DOM label ref — labels track the marks with zero re-renders. */
function LabelTracker({ labelRefs }: { labelRefs: RefObject<(HTMLElement | null)[]> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const els = labelRefs.current;
    if (!els) return;
    for (let i = 0; i < LAYOUT.length; i++) {
      const el = els[i];
      if (!el) continue;
      const [x, y] = LAYOUT[i];
      v.set(x, y - 1.05, 0).project(camera);
      const sx = (v.x * 0.5 + 0.5) * size.width;
      const sy = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate(-50%, 0) translate(${sx}px, ${sy}px)`;
      el.style.opacity = v.z < 1 ? '1' : '0';
    }
  });
  return null;
}

function WallScene({
  hoveredRef,
  labelRefs,
  reduced,
}: {
  hoveredRef: RefObject<number>;
  labelRefs: RefObject<(HTMLElement | null)[]>;
  reduced: boolean;
}) {
  return (
    <>
      <ForgeEnvironment intensity={0.9} />
      <ForgeLights intensity={0.85} />
      {BRANDS.map((_, i) => (
        <MarkNode key={BRANDS[i].mark} index={i} hoveredRef={hoveredRef} reduced={reduced} />
      ))}
      <LabelTracker labelRefs={labelRefs} />
    </>
  );
}

export default function IntegrationsWall({ reduced = false }: { reduced?: boolean }) {
  const hoveredRef = useRef<number>(-1);
  const labelRefs = useRef<(HTMLElement | null)[]>([]);

  return (
    <div className="mk-int-stage" role="group" aria-label="Integrations Prism connects to">
      <div className="mk-int-canvas" aria-hidden="true">
        <Lazy3D poster={<IntegrationsPoster />} heavy rootMargin="500px">
          <MarketingCanvas camera={{ position: [0, 0, 11.5], fov: 34, near: 0.1, far: 40 }}>
            <WallScene hoveredRef={hoveredRef} labelRefs={labelRefs} reduced={reduced} />
          </MarketingCanvas>
        </Lazy3D>
      </div>
      {/* Crisp DOM labels (the accessible brand names) + hover hit-targets,
          projected onto each mark every frame. */}
      <div className="mk-int-labels">
        {BRANDS.map((b, i) => (
          <span
            key={b.mark}
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            className="mk-int-label"
            onPointerEnter={() => {
              hoveredRef.current = i;
            }}
            onPointerLeave={() => {
              hoveredRef.current = -1;
            }}
          >
            {b.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Static poster — a chrome-and-red mote grid until the wall mounts. */
function IntegrationsPoster() {
  return (
    <div className="mk-int-poster" aria-hidden="true">
      {BRANDS.map((b) => (
        <div className="mk-int-poster-cell" key={b.mark}>
          <div className="mk-int-poster-mark">
            <MarkPoster accent="#9aa1ac" />
          </div>
          <span className="mk-int-poster-name">{b.name}</span>
        </div>
      ))}
    </div>
  );
}
