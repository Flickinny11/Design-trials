'use client';

/**
 * useEditorLayoutObserver — measure the editor's CONTAINER box and publish it
 * to useEditorLayoutStore (UI-WOW-2 P0). Call ONCE, on the <main> ref.
 *
 * Uses ResizeObserver (the element's own box) rather than `window.innerWidth`
 * so the density is correct when the editor is embedded in a narrow preview-
 * pane inside a wide browser. Also re-measures on viewport resize as a belt-
 * and-braces for browsers that coalesce RO callbacks during a drag-resize.
 *
 * Editor-shell module (not runtime) — `window`/ResizeObserver are legal here
 * (FP-05 scopes only to src/lib/prism/runtime/** and node modules).
 */

import { useLayoutEffect } from 'react';
import { useEditorLayoutStore } from '@/stores/useEditorLayoutStore';

export function useEditorLayoutObserver(ref: React.RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (typeof window === 'undefined' || !el) return;
    const setSize = useEditorLayoutStore.getState().setSize;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize(Math.round(r.width), Math.round(r.height));
    };
    measure();
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref]);
}
