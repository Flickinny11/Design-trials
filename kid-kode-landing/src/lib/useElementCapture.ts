'use client';

import { useEffect, useRef } from 'react';
import { useElementImageStore } from '@/stores/useElementImageStore';

// Captures snapshots of every [data-node-id] element in LivePreview.
// Called once after mount + can be triggered again via captureSignal.
export function useElementCapture(
  rootRef: React.RefObject<HTMLElement | null>,
  captureSignal: number = 0
) {
  const setImages = useElementImageStore((s) => s.setImages);
  const ran = useRef(-1);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!rootRef.current) return;
    if (ran.current === captureSignal) return;
    ran.current = captureSignal;

    let cancelled = false;

    // Wait for layout to settle (fonts, gradients, svgs).
    const start = setTimeout(async () => {
      if (cancelled || !rootRef.current) return;

      try {
        const { toPng } = await import('html-to-image');

        const elements = Array.from(
          rootRef.current.querySelectorAll<HTMLElement>('[data-node-id]')
        );

        if (elements.length === 0) return;

        const batch: Record<string, string> = {};
        const BATCH_SIZE = 3;

        for (let i = 0; i < elements.length; i += BATCH_SIZE) {
          if (cancelled) return;
          const slice = elements.slice(i, i + BATCH_SIZE);
          await Promise.all(
            slice.map(async (el) => {
              const nodeId = el.dataset.nodeId!;
              try {
                // Snapshot with a 2× pixel ratio for crisp sphere textures.
                const dataUrl = await toPng(el, {
                  pixelRatio: 2,
                  cacheBust: false,
                  backgroundColor: undefined,
                  skipFonts: false,
                  style: {
                    // Prevent transform affecting the snapshot
                    transform: 'none',
                  },
                });
                batch[nodeId] = dataUrl;
              } catch (err) {
                // Element that failed (e.g., tainted canvas) — skip silently.
              }
            })
          );
          // Yield to the main thread between batches
          await new Promise<void>((res) =>
            ('requestIdleCallback' in window
              ? (window as any).requestIdleCallback(res, { timeout: 200 })
              : setTimeout(res, 16))
          );
        }

        if (!cancelled && Object.keys(batch).length > 0) {
          setImages(batch);
        }
      } catch (err) {
        console.warn('[ElementCapture] failed', err);
      }
    }, 650);

    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [rootRef, captureSignal, setImages]);
}
