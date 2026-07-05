'use client';

// PRISM MARKETING — SECTION SCROLL PROGRESS (SHELL W9)
//
// The marketing surface owns its own scroll (`.mk` is the scroll container —
// the root document is locked by the editor's global CSS). This hook reports a
// section's scroll progress 0..1 through that container without re-rendering
// React per frame: consumers read `ref.current` inside useFrame / GSAP ticks.
//
// progress = how far the section has travelled through the viewport:
//   0   → section top at viewport bottom (just entering)
//   1   → section bottom at viewport top (just left)

import { useEffect, useRef, type RefObject } from 'react';

export function useMkScrollProgress(sectionRef: RefObject<HTMLElement | null>) {
  const progress = useRef(0);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const scroller = (el.closest('.mk') as HTMLElement | null) ?? null;
    if (!scroller) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = scroller.clientHeight || window.innerHeight;
      const total = r.height + vh;
      const travelled = vh - r.top;
      progress.current = Math.min(1, Math.max(0, travelled / total));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sectionRef]);
  return progress;
}
