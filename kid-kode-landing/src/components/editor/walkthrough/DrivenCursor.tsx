'use client';

// GUIDED-TIPS — the Prism-driven synthetic cursor (C3 / D2).
//
// A brass ring + dot + comet trail that TRAVELS (lerped, velocity-skewed — the
// Cuberto/mouse-follower feel, DESIGN-REFERENCES §7) between step targets and
// fires a click pulse on arrival. Not a teleporting tooltip. Driven entirely by
// Prism: the host sets `target` (viewport px) per step and bumps `clickKey` to
// trigger the click ripple. Under reduced motion it snaps (no fly) — the host
// also suppresses the click pulse there. Writes its live position to
// window.__PRISM_TIPS_CURSOR__ so the numeric harness can measure path length.

import { useEffect, useRef } from 'react';

interface Props {
  target: { x: number; y: number } | null;
  /** Increment to play a click pulse at the current position. */
  clickKey: number;
  reducedMotion: boolean;
}

export default function DrivenCursor({ target, clickKey, reducedMotion }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef<{ x: number; y: number }>({
    x: typeof window !== 'undefined' ? window.innerWidth * 0.5 : 400,
    y: typeof window !== 'undefined' ? window.innerHeight * 0.5 : 300,
  });
  const targetRef = useRef(target);
  const reduceRef = useRef(reducedMotion);
  targetRef.current = target;
  reduceRef.current = reducedMotion;

  // Click pulse: toggle the class when clickKey changes.
  useEffect(() => {
    if (clickKey <= 0) return;
    const el = elRef.current;
    if (!el || reduceRef.current) return;
    el.classList.remove('is-clicking');
    // reflow to restart the animation
    void el.offsetWidth;
    el.classList.add('is-clicking');
    const t = window.setTimeout(() => el.classList.remove('is-clicking'), 560);
    return () => window.clearTimeout(t);
  }, [clickKey]);

  useEffect(() => {
    let raf = 0;
    let prevX = posRef.current.x;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = elRef.current;
      const ring = ringRef.current;
      if (!el) return;
      const tgt = targetRef.current;
      const p = posRef.current;
      let traveling = false;
      if (tgt) {
        if (reduceRef.current) {
          p.x = tgt.x;
          p.y = tgt.y;
        } else {
          p.x += (tgt.x - p.x) * 0.12;
          p.y += (tgt.y - p.y) * 0.12;
        }
        const dist = Math.hypot(tgt.x - p.x, tgt.y - p.y);
        traveling = dist > 1.2;
      }
      const vx = p.x - prevX;
      prevX = p.x;
      // subtle velocity skew (capped) for the premium "driven" feel
      const skew = Math.max(-10, Math.min(10, vx * 0.5));
      el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      if (ring) ring.style.transform = `skewX(${-skew}deg) scale(${traveling ? 0.92 : 1})`;
      el.classList.toggle('is-traveling', traveling);
      (window as unknown as { __PRISM_TIPS_CURSOR__?: { x: number; y: number; traveling: boolean } }).__PRISM_TIPS_CURSOR__ = {
        x: Math.round(p.x),
        y: Math.round(p.y),
        traveling,
      };
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={elRef} className="tip-cursor" data-component="tip-cursor" aria-hidden>
      <div className="tip-cursor__trail" />
      <div ref={ringRef} className="tip-cursor__ring" />
      <div className="tip-cursor__ripple" />
      <div className="tip-cursor__dot" />
    </div>
  );
}
