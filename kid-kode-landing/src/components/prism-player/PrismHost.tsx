'use client';

import { useEffect, useRef, useState } from 'react';
import { mount, type MountResult } from '@/lib/prism/player';
import {
  diffGraphSource,
  mountFromGraphSource,
  type MountGraphResult,
} from '@/lib/prism/runtime/mount-graph';
import { getSharedNodeContext } from '@/lib/prism/runtime/shared-context';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { GraphSource } from '@/lib/prism-graph/types';
// T-EDIT-05 — expose the bidirectional editor↔preview bridge type to
// editor-side consumers. boot.ts owns the runtime contract; PrismHost is
// the React boundary, so re-exporting keeps the import surface clean.
//   - selectNode(nodeId | null)      — editor → preview (programmatic select)
//   - highlightNode(nodeId | null)   — editor → preview (visual ring only)
//   - onNodeSelected(cb)             — preview → editor (user-driven click)
export type { PrismDebugHandle } from '@/lib/prism/player';

export type ViewportPreset = 'mobile' | 'tablet' | 'desktop' | 'fit';

// Canonical device dimensions for preview framing. iPhone 13, iPad, standard
// desktop. Matches how V0 / Bolt / Lovable present their preview.
const PRESETS: Record<Exclude<ViewportPreset, 'fit'>, { w: number; h: number; label: string }> = {
  mobile:  { w: 390,  h: 844,  label: 'iPhone 13 · 390 × 844' },
  tablet:  { w: 768,  h: 1024, label: 'iPad · 768 × 1024' },
  desktop: { w: 1440, h: 900,  label: 'Desktop · 1440 × 900' },
};

interface Props {
  prismUrl?: string;
  onMounted?: (result: MountResult) => void;
  /** Force the mock app to render at a specific device size. 'fit' = fill container. */
  viewportPreset?: ViewportPreset;
  /** Show the [Mobile|Tablet|Desktop|Fit] segmented buttons above the canvas. */
  showViewportControls?: boolean;
  /** Called when the user clicks a preset button (parent owns the state). */
  onPresetChange?: (preset: ViewportPreset) => void;
  /** HL07 — when true (default), mount from the live `useGraphSourceStore`
   *  and surgically dispatch upsert/remove/transform/setHubMockup on store
   *  changes. When false, fall back to the legacy bundle-loading `mount()`
   *  path that consumes a baked .prism artifact. */
  useLiveGraph?: boolean;
}

export default function PrismHost({
  prismUrl = '/prism-assets/mock-app.prism',
  onMounted,
  viewportPreset = 'fit',
  showViewportControls = false,
  onPresetChange,
  useLiveGraph = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    let bundleResult: MountResult | null = null;
    let liveResult: MountGraphResult | null = null;
    let unsubscribeStore: (() => void) | null = null;
    let cancelled = false;
    let pendingSize: { w: number; h: number } | null = null;

    function applyResize(w: number, h: number): void {
      if (bundleResult) bundleResult.resize(w, h);
      else if (liveResult) liveResult.resize(w, h);
      else pendingSize = { w, h };
    }

    // Observe the container so the renderer tracks whatever the parent gives
    // us — split-pane drag, future iframe embed, future expand-to-full button,
    // mode toggle.
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      applyResize(width, height);
    });
    observer.observe(container);

    function snapshotSource(): GraphSource {
      const s = useGraphSourceStore.getState();
      return { hubs: s.hubs, nodes: s.nodes, edges: s.edges };
    }

    (async () => {
      try {
        const rect = container.getBoundingClientRect();
        const initialW = rect.width > 0 ? rect.width : undefined;
        const initialH = rect.height > 0 ? rect.height : undefined;

        if (useLiveGraph) {
          // HL07 live-bind path. Wait for the store to populate (eager init
          // fetches /prism-mock/home/live-graph.json on module load), then
          // mount via mountFromGraphSource and subscribe with a diff callback.
          const initialState = useGraphSourceStore.getState();
          const ready = await new Promise<boolean>((resolve) => {
            if (initialState.ready) { resolve(true); return; }
            const stop = useGraphSourceStore.subscribe((s) => {
              if (s.ready) { stop(); resolve(true); }
              else if (s.error) { stop(); resolve(false); }
            });
          });
          if (cancelled) return;
          if (!ready) {
            throw new Error(useGraphSourceStore.getState().error ?? 'graph source failed to load');
          }
          const ctx = getSharedNodeContext({ runPrimitives: true });
          try {
            await ctx.fontAtlas.load('/prism-assets/font-inter.msdf.png', '/prism-assets/font-inter.msdf.json');
          } catch (e) {
            console.warn('[PrismHost] MSDF font atlas warmup failed:', (e as Error).message);
          }
          if (cancelled) return;
          let prevSource = snapshotSource();
          liveResult = await mountFromGraphSource(canvas, prevSource, ctx, {
            width: initialW,
            height: initialH,
          });
          if (cancelled) { liveResult.unmount(); return; }
          if (pendingSize) liveResult.resize(pendingSize.w, pendingSize.h);

          // Subscribe to the store. Diff prev→next on each emission and
          // dispatch the surgical helpers; never re-mount.
          unsubscribeStore = useGraphSourceStore.subscribe((s) => {
            if (!liveResult) return;
            const next: GraphSource = { hubs: s.hubs, nodes: s.nodes, edges: s.edges };
            const diff = diffGraphSource(prevSource, next);
            for (const id of diff.removedNodeIds) liveResult.removeNode(id);
            for (const node of diff.upsertedNodes) liveResult.upsertNode(node);
            for (const t of diff.transformOnlyNodes) {
              liveResult.updateNodeTransform(t.nodeId, t.scenePosition);
            }
            for (const change of diff.hubMockupChanges) {
              void liveResult.setHubMockup(change.hubId, change.mockupUrl);
            }
            prevSource = next;
          });

          setStatus('ready');
        } else {
          bundleResult = await mount(canvas, prismUrl, { width: initialW, height: initialH });
          if (cancelled) { bundleResult.unmount(); return; }
          if (pendingSize) bundleResult.resize(pendingSize.w, pendingSize.h);
          setStatus('ready');
          onMounted?.(bundleResult);
        }
      } catch (e) {
        console.error('[PrismHost] mount failed:', e);
        setError((e as Error).message);
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      observer.disconnect();
      unsubscribeStore?.();
      bundleResult?.unmount();
      liveResult?.unmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prismUrl, useLiveGraph]);

  const isFit = viewportPreset === 'fit';
  const preset = isFit ? null : PRESETS[viewportPreset];

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#04050a]">
      {/* Viewport-preset toolbar — segmented buttons at the top of the preview.
          Visible only in modes where the parent opts in (Preview mode, not Visual Editor). */}
      {showViewportControls && (
        <div
          className="absolute top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
          data-component="viewport-preset-toolbar"
        >
          <div
            className="flex items-center gap-0.5 p-1 rounded-full border border-white/10"
            style={{
              background: 'rgba(8,10,26,0.78)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          >
            {(['mobile', 'tablet', 'desktop', 'fit'] as const).map((p) => {
              const active = viewportPreset === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPresetChange?.(p)}
                  className={`px-2.5 h-6 rounded-full text-[10px] font-mono tracking-wide transition-all ${
                    active ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white/85 hover:bg-white/5'
                  }`}
                  data-preset={p}
                >
                  {p === 'fit' ? 'Fit' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Layout frame — conditionally-styled wrappers around a SINGLE canvas
          that never remounts. When a preset is active, the wrapper is
          constrained to the preset's pixel dimensions and centered (with a
          dark bezel and device label). When `fit`, the wrapper fills the
          pane. ResizeObserver on containerRef tracks the actual rendered
          size either way and routes it into result.resize() so PIXI stays
          in sync with whatever the wrapper is now. */}
      <div
        className={isFit
          ? 'absolute inset-0'
          : 'absolute inset-0 flex flex-col items-center justify-center gap-2 pt-24 pb-4 overflow-auto'}
      >
        {preset && (
          <div className="text-[9px] font-mono tracking-widest text-white/40 select-none">{preset.label}</div>
        )}
        <div
          ref={containerRef}
          className={isFit ? 'w-full h-full' : 'relative rounded-xl overflow-hidden'}
          style={isFit ? undefined : {
            width: preset!.w,
            height: preset!.h,
            maxWidth: 'calc(100% - 32px)',
            maxHeight: 'calc(100% - 80px)',
            background: '#04050a',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 8px rgba(0,0,0,0.5)',
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full block focus:outline-none"
            style={{ display: 'block' }}
          />
        </div>
      </div>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-[#5d8bff]/30 border-t-[#5d8bff] animate-spin" />
            </div>
            <div className="text-[10px] font-mono tracking-widest text-white/45">
              LOADING PRISM RUNTIME
            </div>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <div className="text-[12px] font-mono tracking-widest text-[#ff5577] mb-2">PRISM BOOT FAILED</div>
            <div className="text-[11px] font-mono text-white/60 break-words">{error}</div>
            <div className="text-[10px] text-white/40 mt-3">
              Did you run <code className="text-white/70">npm run build:stubs &amp;&amp; npm run build:prism</code>?
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
