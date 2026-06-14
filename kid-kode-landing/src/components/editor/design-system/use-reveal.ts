'use client';

// use-reveal — GSAP-choreographed entrance for chrome panels/flyouts (UI-WOW P2).
//
// DESIGN-REFERENCES §5/§15 call for GSAP to drive signature panel reveals. Until
// now the same `gsap.fromTo(...)` block was copy-pasted across ~8 flyouts. This
// is the one shared hook: attach its ref to a panel's CONTENT wrapper and its
// direct children cascade in (stagger) with a springy settle — a NOTICEABLE
// "ooh" entrance the user sees every time a flyout/panel opens.
//
// Safe: respects prefers-reduced-motion (snaps visible, no motion); transform +
// opacity only; auto-reverts on unmount via gsap.context. Never throws.

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export interface UseRevealOptions {
  /** Stagger the element's direct children in (the cascade). Default true. */
  stagger?: boolean;
  /** Seconds before the cascade begins. Default 0.06. */
  delay?: number;
  /** Re-run the entrance when this key changes (e.g. active flyout id). */
  resetKey?: string | number;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseRevealOptions = {},
) {
  const ref = useRef<T | null>(null);
  const { stagger = true, delay = 0.06, resetKey } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { clearProps: 'all' });
      if (stagger) gsap.set(el.children, { clearProps: 'all' });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.34, ease: 'expo.out' },
      );
      if (stagger && el.children.length) {
        gsap.fromTo(
          el.children,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', stagger: 0.04, delay },
        );
      }
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return ref;
}
