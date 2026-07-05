'use client';

// PRISM EDITOR DESIGN SYSTEM — useTilt (Wave 0).
//
// Pointer-tracked perspective tilt for chrome cards: subtle parallax that
// makes a surface read as a physical plate. rAF-throttled, transform-only
// (composited; no layout/paint), resets on leave with the system ease.
//
// ⛔ HARD RULE: never attach tilt to any ancestor of a <SharedViewport>.
// The shared rig scissors the WebGPU canvas to each viewport's axis-aligned
// getBoundingClientRect — a perspective-rotated quad desyncs from its scissor
// rect. Tiles with live GPU previews get .ds-lift (translate/scale) only.

import { useCallback, useEffect, useRef } from 'react';

export interface TiltOptions {
  /** Max rotation in degrees (default 3 — restraint is the point). */
  max?: number;
  /** Perspective distance in px (default 700). */
  perspective?: number;
  /** Additional scale on hover (default 1.012). */
  scale?: number;
  /** Disable (e.g. from a reduced-motion or tier check). */
  disabled?: boolean;
}

export function useTilt<T extends HTMLElement>(options: TiltOptions = {}) {
  const { max = 3, perspective = 700, scale = 1.012, disabled = false } = options;
  const ref = useRef<T | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(${perspective}px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) scale(${scale})`;
      });
    };
    const onEnter = () => {
      el.style.transition = 'transform 120ms cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.willChange = 'transform';
    };
    const onLeave = () => {
      cancelAnimationFrame(frame.current);
      el.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.transform = '';
      el.style.willChange = '';
    };

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame.current);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.style.transform = '';
      el.style.transition = '';
      el.style.willChange = '';
    };
  }, [max, perspective, scale, disabled]);

  return ref;
}

export const tiltForbiddenNote =
  'useTilt must never wrap a SharedViewport (scissor-rect desync); use .ds-lift there instead.';

export default useTilt;
