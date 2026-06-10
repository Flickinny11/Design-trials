'use client';

// P2 TOOLBAR WIRING (Task B) — magnetic / elastic hover, implemented natively
// with GSAP per the raised-bar directive (DESIGN-REFERENCES.md: the
// magnetic-elements / mouse-follower TECHNIQUE — pointer-proximity transforms;
// no new dependency, no second renderer).
//
// Attach to a tile root: while the pointer roams the element, it leans toward
// the cursor (translate capped at `maxShift` px, slight scale); on leave it
// springs back with an elastic release. Transforms are axis-aligned
// translate/scale ONLY — tilt/rotation is forbidden on SharedViewport
// ancestors (the shared rig scissors axis-aligned rects, re-read per frame,
// so translate/scale track perfectly).

import { gsap } from 'gsap';

export interface MagneticOptions {
  /** Max translation toward the cursor, px (default 6 — raised-bar cap). */
  maxShift?: number;
  /** Hover scale (default 1.035). */
  scale?: number;
}

/** Wire pointer-proximity magnetism onto `el`. Returns a detach function that
 *  removes listeners, kills tweens, and resets the transform. */
export function attachMagnetic(el: HTMLElement, opts: MagneticOptions = {}): () => void {
  const maxShift = opts.maxShift ?? 6;
  const hoverScale = opts.scale ?? 1.035;

  const xTo = gsap.quickTo(el, 'x', { duration: 0.32, ease: 'power3.out' });
  const yTo = gsap.quickTo(el, 'y', { duration: 0.32, ease: 'power3.out' });

  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    // Subtract the current translation so the lean is measured from the
    // element's resting center (avoids self-chasing feedback).
    const curX = Number(gsap.getProperty(el, 'x')) || 0;
    const curY = Number(gsap.getProperty(el, 'y')) || 0;
    const cx = r.left + r.width / 2 - curX;
    const cy = r.top + r.height / 2 - curY;
    const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width / 2)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height / 2)));
    xTo(nx * maxShift);
    yTo(ny * maxShift);
    gsap.to(el, { scale: hoverScale, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
  };

  const onLeave = () => {
    // Springy elastic release back to rest.
    gsap.to(el, {
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.7,
      ease: 'elastic.out(1, 0.42)',
      overwrite: 'auto',
    });
  };

  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  return () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    gsap.killTweensOf(el);
    gsap.set(el, { x: 0, y: 0, scale: 1, clearProps: 'transform' });
  };
}
