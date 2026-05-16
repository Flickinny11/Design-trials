'use client';

// EB-07-04 — React hook surface for the scroll-timeline system.
//
// Spec ref: §7 SC-039 — `useScrollTimeline()` returns deterministic
// `scrollProgress: 0→1` over the hub's content length.
//
// Reads scroll position from a container element (or `window` when no
// container is provided) and computes a clamped 0..1 progress against the
// hub's contentHeight + viewportHeight via the pure-layer
// `computeScrollProgress` in `lib/prism-graph/scroll-timeline.ts`. The pure
// layer is the single source of the scroll math; the hook is a thin React
// shell on top.
//
// SSR-safe: returns 0 outside a browser. Cleans up listeners on unmount.

import { useEffect, useState } from 'react';
import { computeScrollProgress } from '@/lib/prism-graph/scroll-timeline';

export interface UseScrollTimelineOptions {
  contentHeight: number;
  viewportHeight: number;
  /** Optional scroll container. When omitted, the hook subscribes to
   *  `window.scrollY`. */
  containerRef?: { current: HTMLElement | null } | null;
}

export function useScrollTimeline(opts: UseScrollTimelineOptions): number {
  const { contentHeight, viewportHeight, containerRef } = opts;
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const el = containerRef?.current ?? null;
    const read = (): number => {
      const scrollY = el ? el.scrollTop : window.scrollY;
      return computeScrollProgress(scrollY, contentHeight, viewportHeight);
    };
    const onScroll = (): void => setProgress(read());

    // Seed once so the initial render reflects the current scroll position.
    setProgress(read());

    if (el) {
      el.addEventListener('scroll', onScroll, { passive: true });
      return () => el.removeEventListener('scroll', onScroll);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [contentHeight, viewportHeight, containerRef]);

  return progress;
}
