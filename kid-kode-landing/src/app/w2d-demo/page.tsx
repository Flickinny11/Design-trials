'use client';

// W-2D DEMO — the mixed-app fixture (3d landing + 2d data hub) running in the
// REAL Prism runtime via `mountFromGraphSource`. This lab route exists so the
// per-hub composition path can be driven and verified end-to-end: the two hub
// pills call the runtime's own `hubManager.activate`, whose W-2D wrapper
// tweens the SAME PerspectiveCamera between the 3d perspective composition
// and the 2d telephoto flat composition (~650ms, framing-preserving). The
// FOV/Z readout is a live verification surface (also exposed on
// window.__W2D_DEMO__ for scripted evidence). Lab-route idiom (/splat-lab):
// DOM chrome around a WebGPU canvas interior; no engine files touched.

import { useEffect, useRef, useState } from 'react';
import { getSharedNodeContext } from '@/lib/prism/runtime/shared-context';
import { mountFromGraphSource, type MountGraphResult } from '@/lib/prism/runtime/mount-graph';
import { resolveTextOutlines } from '@/lib/prism/runtime/shared/text-atlas';
import { ledgerMixedGraph } from '@/lib/templates/graphs/ledger-mixed';
import { resolveHubRenderMode } from '@/lib/prism-graph/hub-render-mode';
import type { GraphSource } from '@/lib/prism-graph/types';

/** Warm the extruded-text outline cache (the ConductorRuntime idiom) so the
 *  factory's 3D-text path resolves synchronously — no flat-MSDF fallback. */
async function warmOutlines(graph: GraphSource): Promise<void> {
  const byKey = new Map<string, { family: string; weight: number; chars: Set<string> }>();
  for (const node of graph.nodes) {
    if (node.renderMode !== 'text') continue;
    const content = node.textSpec?.content;
    if (typeof content !== 'string' || content.length === 0) continue;
    const family = node.textSpec?.fontFamily ?? 'Playfair Display';
    const weight = node.textSpec?.fontWeight ?? 600;
    const key = `${family}|${weight}`;
    let e = byKey.get(key);
    if (!e) {
      e = { family, weight, chars: new Set() };
      byKey.set(key, e);
    }
    for (const ch of content) e.chars.add(ch);
  }
  await Promise.all(
    [...byKey.values()].map((e) => resolveTextOutlines(e.family, e.weight, [...e.chars].join(''))),
  );
}

export default function W2dDemoPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<MountGraphResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [activeHub, setActiveHub] = useState('landing');
  const [cam, setCam] = useState<{ fov: number; z: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    let cancelled = false;
    let raf = 0;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) resultRef.current?.resize(width, height);
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
          /* best-effort */
        }
        try {
          await warmOutlines(ledgerMixedGraph);
        } catch {
          /* best-effort */
        }
        if (cancelled) return;
        const result = await mountFromGraphSource(canvas, ledgerMixedGraph, ctx, {
          width: rect.width > 0 ? rect.width : 1280,
          height: rect.height > 0 ? rect.height : 720,
          entryHubId: 'landing',
        });
        if (cancelled) {
          result.unmount();
          return;
        }
        resultRef.current = result;
        (window as unknown as { __W2D_DEMO__?: unknown }).__W2D_DEMO__ = {
          activate: (hubId: string) => {
            result.hubManager.activate(hubId);
            setActiveHub(hubId);
          },
          camera: () => ({
            fov: result.sceneRoot.camera.fov,
            z: result.sceneRoot.camera.position.z,
          }),
          activeHub: () => result.hubManager.getActive(),
        };
        // Live camera readout for the verification frames.
        const tick = () => {
          raf = requestAnimationFrame(tick);
          const c = result.sceneRoot.camera;
          setCam((prev) =>
            prev && Math.abs(prev.fov - c.fov) < 0.05 && Math.abs(prev.z - c.position.z) < 0.05
              ? prev
              : { fov: c.fov, z: c.position.z },
          );
        };
        raf = requestAnimationFrame(tick);
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
      cancelAnimationFrame(raf);
      delete (window as unknown as { __W2D_DEMO__?: unknown }).__W2D_DEMO__;
      try {
        resultRef.current?.unmount();
      } catch {
        /* ignore */
      }
      resultRef.current = null;
    };
  }, []);

  const switchHub = (hubId: string) => {
    const result = resultRef.current;
    if (!result || activeHub === hubId) return;
    result.hubManager.activate(hubId);
    setActiveHub(hubId);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05070c' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      <div
        style={{
          position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 8, alignItems: 'center',
          fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#aab3c5',
        }}
      >
        {ledgerMixedGraph.hubs.map((hub) => {
          const mode = resolveHubRenderMode(hub);
          const active = activeHub === hub.hubId;
          return (
            <button
              key={hub.hubId}
              type="button"
              data-testid={`w2d-hub-${hub.hubId}`}
              onClick={() => switchHub(hub.hubId)}
              style={{
                padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${active ? '#d8a24a' : 'rgba(170,179,197,0.35)'}`,
                background: active ? 'rgba(216,162,74,0.16)' : 'rgba(10,13,18,0.7)',
                color: active ? '#e8e4da' : '#aab3c5',
                fontFamily: 'inherit', fontSize: 11,
              }}
            >
              {hub.title.split(' — ')[1] ?? hub.hubId} · {mode.toUpperCase()}
            </button>
          );
        })}
        {cam && (
          <span
            data-testid="w2d-cam-readout"
            style={{
              padding: '6px 10px', borderRadius: 999,
              border: '1px solid rgba(170,179,197,0.25)', background: 'rgba(10,13,18,0.7)',
            }}
          >
            FOV {cam.fov.toFixed(1)} · Z {cam.z.toFixed(1)}
          </span>
        )}
      </div>

      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#aab3c5', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
          Booting the Prism runtime…
        </div>
      )}
      {status === 'error' && (
        <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#e08b8b', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
          Demo could not render{error ? `: ${error}` : ''}.
        </div>
      )}
    </div>
  );
}
