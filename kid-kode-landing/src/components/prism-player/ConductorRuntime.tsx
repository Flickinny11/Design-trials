'use client';

// PRISM SHELL — CONDUCTOR RUNTIME HOST (SHELL W5, 2026-07-04)
//
// Mounts a Conductor-authored GraphSource in the Prism runtime — the SAME
// three/webgpu scene + synchronous createNode contract PrismHost uses, via the
// `mountFromGraphSource` primitive. This is how "the built graph runs in the
// Prism runtime" (W5 gate) is proven both in the builder preview (the authored
// tenant app) and on the shareable E14 preview URL.
//
// I0 (Prime Boundary): this is a DOM host wrapping a WebGPU canvas interior —
// no shell chrome leaks inside, no engine-interior file at `/` is touched
// (W5-D3). It renders EITHER here OR the certified engine-frame, never both at
// once, so there is one visible scene (FP-R1/FP-R6).

import { useEffect, useRef, useState } from 'react';
import { getSharedNodeContext } from '@/lib/prism/runtime/shared-context';
import { mountFromGraphSource, type MountGraphResult } from '@/lib/prism/runtime/mount-graph';
import type { GraphSource } from '@/lib/prism-graph/types';

export default function ConductorRuntime({ graph }: { graph: GraphSource }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    let result: MountGraphResult | null = null;
    let cancelled = false;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) result?.resize(width, height);
    });
    observer.observe(container);

    (async () => {
      try {
        const rect = container.getBoundingClientRect();
        const ctx = getSharedNodeContext({ runPrimitives: true });
        try {
          await ctx.fontAtlas.load(
            '/prism-assets/font-inter.msdf.png',
            '/prism-assets/font-inter.msdf.json',
          );
        } catch {
          // Atlas warm is best-effort; text nodes soft-fail like a missing asset.
        }
        if (cancelled) return;
        result = await mountFromGraphSource(canvas, graph, ctx, {
          width: rect.width > 0 ? rect.width : 1280,
          height: rect.height > 0 ? rect.height : 720,
        });
        if (cancelled) {
          result.unmount();
          return;
        }
        setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'runtime mount failed');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      observer.disconnect();
      try {
        result?.unmount();
      } catch {
        /* ignore */
      }
    };
  }, [graph]);

  return (
    <div ref={containerRef} className="cr-runtime" data-status={status}>
      <canvas ref={canvasRef} className="cr-canvas" />
      {status === 'loading' ? (
        <div className="cr-overlay" role="status">
          <span className="cr-bead" aria-hidden />
          Booting the Prism runtime…
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="cr-overlay cr-overlay--error" role="alert">
          Preview could not render{error ? `: ${error}` : ''}.
        </div>
      ) : null}
    </div>
  );
}
