'use client';

// use-lenis — buttery momentum scrolling for editor chrome surfaces (UI-WOW P2).
//
// `lenis` is a project dependency that, until now, was imported nowhere in src/ —
// installed but invisible. This hook wires it into any scrollable chrome surface
// (the library grid, the animation catalog, the inspector body, the toolbar dock)
// so scrolling those lists reads with premium lerped momentum instead of the OS
// step-scroll. It is a NOTICEABLE signature interaction (DESIGN-REFERENCES §6:
// Lenis smooth scroll), not a hidden import.
//
// Tasteful + safe:
//   • disabled on coarse pointers (touch already has native momentum) and under
//     prefers-reduced-motion (snaps to native scroll);
//   • scoped to the passed element (`wrapper`/`content`), never the page;
//   • cleans up its rAF + instance on unmount.

import { useEffect, useRef } from 'react';
import Lenis from 'lenis';

export interface UseLenisOptions {
  /** lerp 0..1 — lower = smoother/slower settle. Default 0.12 (premium glide). */
  lerp?: number;
  /** Disable (fall back to native scroll) without unmounting. */
  enabled?: boolean;
}

export function useLenis<T extends HTMLElement = HTMLDivElement>(
  options: UseLenisOptions = {},
) {
  const ref = useRef<T | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const { lerp = 0.12, enabled = true } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (typeof window === 'undefined') return;
    // Touch already has native momentum; reduced-motion users opt out.
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (coarse || reduce) return;

    let lenis: Lenis;
    try {
      lenis = new Lenis({
        wrapper: el,
        content: (el.firstElementChild as HTMLElement) ?? el,
        lerp,
        smoothWheel: true,
        // chrome panels are short; a snappy but smooth settle reads best.
        wheelMultiplier: 1,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
    } catch {
      return; // never break the surface if lenis init fails
    }
    lenisRef.current = lenis;

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [lerp, enabled]);

  return { ref, lenis: lenisRef };
}
