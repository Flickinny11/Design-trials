'use client';

// CustomCursorLayer (W8 E9) — a config-driven custom cursor for a BUILT Prism
// app. Generalizes the editor's MagneticCursor (Cuberto-style magnetic ring +
// lerped follow, native rAF, no dep) into a per-app layer selectable in the
// canvas and authored on `PrismHub.cursor`.
//
// Four presets: 'ring' (magnetic brass ring + hot dot — the M1 idiom), 'halo'
// (soft radial glow trail), 'dot' (minimal precise dot), 'beam' (velocity-
// stretched streak). Augments the OS cursor by default (a11y-safe); `hideNative`
// hides it. Inert on coarse pointers + prefers-reduced-motion.
//
// Editor/marketing-shell scope (NOT runtime/), so window listeners are allowed
// (same as MagneticCursor). Look lives in custom-cursor.css; JS only ever sets
// transform / opacity / classList (chrome discipline — no imperative
// background/border/boxShadow).

import { useEffect, useRef } from 'react';
import type { CursorLayerConfig } from '@/lib/prism-graph/types';
import './custom-cursor.css';

const INTERACTIVE =
  'button, a, input, select, textarea, [role="button"], [data-magnetic], [data-cursor-target]';

export interface CustomCursorLayerProps {
  config: CursorLayerConfig;
}

export default function CustomCursorLayer({ config }: CustomCursorLayerProps) {
  const ringRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const beamRef = useRef<HTMLDivElement | null>(null);

  const style = config.style;
  const accent = config.accent ?? '#d8a24a';
  const magnetic = config.magnetic ?? style === 'ring';
  const hideNative = config.hideNative ?? false;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (coarse || reduce) return;

    const ring = ringRef.current;
    const dot = dotRef.current;
    const beam = beamRef.current;
    if (!dot) return;

    if (hideNative) document.body.classList.add('pcx-hide-native');

    let mx = window.innerWidth / 2,
      my = window.innerHeight / 2;
    let rx = mx,
      ry = my,
      dx = mx,
      dy = my,
      pdx = dx,
      pdy = dy;
    let scale = 1,
      targetScale = 1;
    let snapX: number | null = null,
      snapY: number | null = null;
    let visible = false,
      warm = false;

    const show = () => {
      if (visible) return;
      visible = true;
      if (ring) ring.style.opacity = '1';
      dot.style.opacity = '1';
      if (beam) beam.style.opacity = '1';
    };

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      show();
      if (!magnetic || !ring) return;
      const el = (e.target as HTMLElement | null)?.closest?.(INTERACTIVE) as
        | HTMLElement
        | null;
      if (el) {
        const r = el.getBoundingClientRect();
        snapX = r.left + r.width / 2;
        snapY = r.top + r.height / 2;
        targetScale = Math.min(2.6, Math.max(1.5, r.height / 26));
        if (!warm) {
          warm = true;
          ring.classList.add('is-warm');
        }
      } else {
        snapX = snapY = null;
        targetScale = 1;
        if (warm) {
          warm = false;
          ring.classList.remove('is-warm');
        }
      }
    };
    const onLeave = () => {
      visible = false;
      if (ring) ring.style.opacity = '0';
      dot.style.opacity = '0';
      if (beam) beam.style.opacity = '0';
    };
    const onDown = () => {
      targetScale *= 0.8;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    let raf = 0;
    const loop = () => {
      const tx = snapX != null ? mx + (snapX - mx) * 0.34 : mx;
      const ty = snapY != null ? my + (snapY - my) * 0.34 : my;
      rx += (tx - rx) * 0.18;
      ry += (ty - ry) * 0.18;
      pdx = dx;
      pdy = dy;
      dx += (mx - dx) * 0.4;
      dy += (my - dy) * 0.4;
      scale += (targetScale - scale) * 0.16;
      if (ring)
        ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) scale(${scale})`;
      dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;
      if (beam) {
        const vx = dx - pdx,
          vy = dy - pdy;
        const speed = Math.min(60, Math.hypot(vx, vy));
        const ang = (Math.atan2(vy, vx) * 180) / Math.PI;
        beam.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%) rotate(${ang}deg) scaleX(${1 + speed / 10})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('mouseleave', onLeave);
      document.body.classList.remove('pcx-hide-native');
    };
  }, [style, accent, magnetic, hideNative]);

  return (
    <div
      aria-hidden
      className="pcx-layer"
      data-component="custom-cursor-layer"
      data-cursor-style={style}
      style={{ ['--pcx-accent' as string]: accent }}
    >
      {style === 'ring' && <div ref={ringRef} className="pcx-node pcx-ring" />}
      {style === 'halo' && <div ref={ringRef} className="pcx-node pcx-halo" />}
      {style === 'beam' && <div ref={beamRef} className="pcx-node pcx-beam" />}
      <div
        ref={dotRef}
        className={`pcx-node pcx-dot${style === 'dot' ? ' pcx-dot--lg' : ''}`}
      />
    </div>
  );
}
