'use client';

// MagneticCursor — the editor's signature pointer (UI-WOW P2, DESIGN-REFERENCES §7
// "Cursor & Interaction Libraries": magnetic snap + lerped follow, the Cuberto /
// mouse-follower technique, implemented natively on a plain rAF loop — no dep).
//
// A soft ring + a hot dot lerp toward the pointer. Over any interactive control
// (button / link / slider / toggle / library tile / [data-magnetic]) the ring
// GROWS, warms to brass (.is-warm), and MAGNETICALLY snaps its centre toward the
// element's centre — controls feel like they "pull" the cursor. The native OS
// cursor stays visible (this augments, never hides it — accessibility-safe).
//
// Inert on coarse pointers (touch) and under prefers-reduced-motion. pointer-
// events:none so it never intercepts a click. One global mount (src/app/page.tsx).
// Per the chrome rule (no imperative .style.background/border/boxShadow), this
// sets ONLY transform + opacity imperatively; the warm/press visual is the CSS
// `.ds-cursor-ring.is-warm` class (design-system/materials.css).

import { useEffect, useRef } from 'react';

const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [data-magnetic], .ds-btn, .ds-toggle, .ds-slider, [data-cluster-tile], [data-role="library-category"]';

export default function MagneticCursor() {
  const ringRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (coarse || reduce) return;

    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my, dx = mx, dy = my;
    let scale = 1, targetScale = 1;
    let snapX: number | null = null, snapY: number | null = null;
    let visible = false, warm = false;

    const onMove = (e: PointerEvent) => {
      mx = e.clientX; my = e.clientY;
      if (!visible) { visible = true; ring.style.opacity = '1'; dot.style.opacity = '1'; }
      const el = (e.target as HTMLElement | null)?.closest?.(INTERACTIVE) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        snapX = r.left + r.width / 2;
        snapY = r.top + r.height / 2;
        targetScale = Math.min(2.6, Math.max(1.5, r.height / 26));
        if (!warm) { warm = true; ring.classList.add('is-warm'); }
      } else {
        snapX = snapY = null;
        targetScale = 1;
        if (warm) { warm = false; ring.classList.remove('is-warm'); }
      }
    };
    const onLeave = () => { visible = false; ring.style.opacity = '0'; dot.style.opacity = '0'; };
    const onDown = () => { targetScale *= 0.8; };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    let raf = 0;
    const loop = () => {
      const tx = snapX != null ? mx + (snapX - mx) * 0.34 : mx;
      const ty = snapY != null ? my + (snapY - my) * 0.34 : my;
      rx += (tx - rx) * 0.18; ry += (ty - ry) * 0.18;
      dx += (mx - dx) * 0.4;  dy += (my - dy) * 0.4;
      scale += (targetScale - scale) * 0.16;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) scale(${scale})`;
      dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]" data-component="magnetic-cursor">
      <div ref={ringRef} className="ds-cursor-ring" />
      <div ref={dotRef} className="ds-cursor-dot" />
    </div>
  );
}
