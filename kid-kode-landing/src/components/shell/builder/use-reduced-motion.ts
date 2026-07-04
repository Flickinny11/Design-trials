'use client';

// PRISM SHELL — prefers-reduced-motion hook (SHELL W1). Islands pause their
// idle choreography for reduced-motion users (Global checklist: WCAG 2.2 AA
// incl. reduced-motion); state cues remain via pose/scale, not animation.

import { useEffect, useState } from 'react';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
