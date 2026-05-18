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
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { deriveCompiledCameraRail } from '@/lib/prism-graph/camera-rail';
import { deriveHubTransitRail } from '@/lib/prism-graph/hub-transit';
import {
  deriveCompiledEnvironmentFog,
  type CompiledHubBackgroundLayer,
  type CompiledHubView,
} from '@/lib/prism-graph/compiled-view';
import type { CompiledCameraRail } from '@/lib/prism-graph/compiled-view';
import { resolveAnchorToScenePosition } from '@/lib/prism-graph/compile-anchors';
import type { GraphSource, ScenePosition } from '@/lib/prism-graph/types';
import { SCENE_POSITION_DEFAULT } from '@/lib/prism-graph/types';
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
  /** EBR2-B-02 / §R2-B SC-066 — active hub's CompiledHubView (computed
   *  once per render in page.tsx via a memoized app-level compile →
   *  pick by activeHubId). When supplied, PrismHost reads cameraRail,
   *  background, and environmentFog directly from this prop instead of
   *  deriving them internally — keeping the pure-data prop boundary the
   *  spec mandates (§3 "Preview is compile, not render-of-source").
   *  Optional + `null`-tolerant so legacy callers (useLiveGraph=false,
   *  pre-EBR2-B-02 callsites) keep working without churn. */
  compiledHubView?: CompiledHubView | null;
}

export default function PrismHost({
  prismUrl = '/prism-assets/mock-app.prism',
  onMounted,
  viewportPreset = 'fit',
  showViewportControls = false,
  onPresetChange,
  useLiveGraph = true,
  compiledHubView = null,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  // EB-06-05 (SC-032 / INV-23): read the canonical viewMode so the live-mount
  // path can install the camera-rail driver only in `preview-hub`. Reading the
  // mode (and the active hub id) outside the mount effect keeps the mount
  // identity stable across mode toggles — the rail is hot-swapped via
  // setCameraRail rather than triggering a remount.
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);

  // EB-06-05: keep the latest live mount reachable from the rail effect
  // below without re-running the mount effect when viewMode flips. The mount
  // effect writes into this ref; the rail effect reads from it.
  const liveResultRef = useRef<MountGraphResult | null>(null);

  // EB-10-03 / §10 SC-055 — remember the per-hub rail of the previously
  // active hub in `preview-app` so the next hub change composes an explicit
  // damped-cinematic transit rail (anchor → anchor) via deriveHubTransitRail.
  // The runtime camera-rail driver's setRail() keeps the current eased pose,
  // so installing a transit rail produces a smooth, deterministic transit
  // between hub-rail anchors. Reset to null whenever preview-app is exited
  // so re-entering does not stitch a stale prior anchor into the first
  // transit.
  const previousHubRailRef = useRef<CompiledCameraRail | null>(null);

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
          liveResultRef.current = liveResult;

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
      liveResultRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prismUrl, useLiveGraph]);

  // EB-06-05 (SC-032 / INV-23) + EB-10-02 (SC-054): in `preview-hub` AND
  // `preview-app` modes, compile the active hub to a CompiledHubView and
  // install the bounded damped-cinematic cameraRail on the live mount.
  // `preview-app` reuses the per-hub rail because hub-to-hub navigation is
  // realized as activeHubId swaps (driven by the URL-hash router in page.tsx);
  // INV-23 still binds — every hub gets a constrained, damped camera. In
  // every authoring mode (galaxy / hub-world / canvas), detach the driver so
  // the camera is unconstrained for free orbit/topology authoring. This
  // effect never remounts the runtime — setCameraRail hot-swaps inside the
  // existing scene, which is also what makes preview-app hub transitions
  // smooth (only the rail target changes, not the renderer identity).
  useEffect(() => {
    if (status !== 'ready') return;
    const live = liveResultRef.current;
    if (!live) return;

    const isPreviewMode = viewMode === 'preview-app';
    if (!isPreviewMode) {
      live.setCameraRail(null);
      live.setBackgroundLayers(null);
      live.setEnvironmentFog(null);
      // EB-10-03 — leaving preview-app/preview-hub drops the stitched
      // transit chain. Re-entering recomputes the per-hub rail from
      // scratch so the camera does not jump from a stale prior anchor.
      previousHubRailRef.current = null;
      return;
    }

    // EBR2-B-02 / §R2-B SC-066 + §3 "Preview is compile, not render-of-source"
    // — when the page-level memoized CompiledHubView is supplied, read the
    // rail/background/fog straight off it; the compile happened upstream in
    // page.tsx. Falling back to the in-host derive only when the prop is
    // absent keeps legacy callers (useLiveGraph=false, pre-EBR2-B-02
    // callsites) working.
    const source = useGraphSourceStore.getState();
    const hub =
      (activeHubId && source.hubs.find((h) => h.hubId === activeHubId)) ||
      source.hubs[0];
    if (!hub) {
      live.setCameraRail(null);
      live.setBackgroundLayers(null);
      live.setEnvironmentFog(null);
      previousHubRailRef.current = null;
      return;
    }
    const hubNodes = source.nodes.filter((n) => n.parentHubId === hub.hubId);

    // INV-23: bounded damped-cinematic cameraRail. Prop-supplied when the
    // page-level compile is available; otherwise derive in-host so the
    // legacy mount paths still get a constrained, damped camera.
    const cameraRail: CompiledCameraRail =
      compiledHubView?.cameraRail ??
      deriveCompiledCameraRail({
        viewportWidth: hub.layout.viewportWidth,
        viewportHeight: hub.layout.viewportHeight,
        nodes: hubNodes,
      });
    // EB-10-03 / §10 SC-055 / INV-23 — in `preview-app`, when a previous
    // hub rail exists in this mount lifetime, install a transit rail
    // (fromAnchor → toAnchor) so the damped step in the runtime driver
    // produces a deterministic cinematic transit between hub-rail anchors.
    // `preview-hub` is single-hub by construction (no inter-hub navigation)
    // so it always installs `cameraRail` directly.
    const prevRail = previousHubRailRef.current;
    const railToInstall: CompiledCameraRail =
      viewMode === 'preview-app' && prevRail !== null && prevRail !== cameraRail
        ? deriveHubTransitRail(prevRail, cameraRail)
        : cameraRail;
    live.setCameraRail(railToInstall);
    // The "previous" we remember for the NEXT transit is always the
    // destination hub's rest rail — that is the anchor a subsequent
    // hub-change starts from, regardless of whether this install was a
    // transit or a direct rail. This keeps the anchor chain explicit and
    // matches the runtime driver's convergence target (rail.end ===
    // toAnchor).
    previousHubRailRef.current = cameraRail;

    // EB-07-03 / §7 SC-038 — env-fog edge fill. Prefer the prop-supplied
    // value (computed upstream in page.tsx) when present; fall back to the
    // in-host derive for legacy fixtures lacking a CompiledHubView prop.
    const environmentFog =
      compiledHubView?.environmentFog ??
      deriveCompiledEnvironmentFog(hub, cameraRail);
    live.setEnvironmentFog(environmentFog);

    // EB-06-06 / §6 SC-033 — compiled background layer stack. When the
    // page-level CompiledHubView prop is supplied, use its `background`
    // directly (a deeply-readonly normalized stack produced by
    // `compileBackground` in compiled-view.ts that already handles both
    // PrismHubBackgroundLayer[] and the legacy `layout.mockupUrl`).
    // Otherwise replicate `compileBackground`'s legacy single-layer fallback
    // in-host so non-prop callsites still get the viewport-fixed mockup.
    let background: readonly CompiledHubBackgroundLayer[];
    if (compiledHubView) {
      background = compiledHubView.background;
    } else {
      const mockupUrl = hub.layout?.mockupUrl ?? null;
      background = mockupUrl
        ? [
            {
              id: `${hub.hubId}/background-0`,
              attachment: 'viewport-fixed',
              sourceUrl: mockupUrl,
              z: 0,
              opacity: 1,
            },
          ]
        : [];
    }
    live.setBackgroundLayers(background);
  }, [viewMode, activeHubId, status, compiledHubView]);

  // EBR2-B-03 / §R2-B SC-066 — node-layout effect. Walks the active
  // CompiledHubView's per-node entries and dispatches the resolved
  // anchor-position through the surgical liveResult.updateNodeTransform
  // helper. Mirrors the camera-rail effect's shape: gated on `preview-app`,
  // re-runs when compiledHubView swaps (e.g., the page-level compile
  // re-memoizes on store change or breakpoint change), and never remounts
  // the runtime. INV-17 — this loop is read-only over the source graph;
  // resolveAnchorToScenePosition is pure, and updateNodeTransform writes
  // only to the mounted THREE.Object3D, not to PrismNode.scenePosition.
  useEffect(() => {
    if (status !== 'ready') return;
    if (viewMode !== 'preview-app') return;
    if (!compiledHubView) return;
    const live = liveResultRef.current;
    if (!live) return;

    const source = useGraphSourceStore.getState();
    const hub =
      (compiledHubView.hubId &&
        source.hubs.find((h) => h.hubId === compiledHubView.hubId)) ||
      (activeHubId && source.hubs.find((h) => h.hubId === activeHubId)) ||
      source.hubs[0];
    if (!hub) return;

    // Index source nodes by id so the loop can preserve rotation/scale from
    // PrismNode.scenePosition while only overriding x/y/z with the compiled
    // anchor's resolved scene position. Reading is non-mutating (INV-17).
    const sourceById = new Map(source.nodes.map((n) => [n.nodeId, n]));

    for (const entry of compiledHubView.nodes) {
      // SC-066: hidden compiled entries are skipped — the runtime keeps the
      // node mounted at its source scenePosition (no anchor write). A
      // follow-up task may add explicit Object3D.visible toggling; for now,
      // "skipped" satisfies the haltCheck's "hidden nodes skipped or
      // unmounted" clause.
      if (entry.visible === false) continue;

      const resolved = resolveAnchorToScenePosition(entry.anchor, hub);
      const src = sourceById.get(entry.nodeId)?.scenePosition;
      const next: ScenePosition = {
        x: resolved.x,
        y: resolved.y,
        z: resolved.z,
        rotationX: src?.rotationX ?? SCENE_POSITION_DEFAULT.rotationX,
        rotationY: src?.rotationY ?? SCENE_POSITION_DEFAULT.rotationY,
        rotationZ: src?.rotationZ ?? SCENE_POSITION_DEFAULT.rotationZ,
        scaleX: src?.scaleX ?? SCENE_POSITION_DEFAULT.scaleX,
        scaleY: src?.scaleY ?? SCENE_POSITION_DEFAULT.scaleY,
        scaleZ: src?.scaleZ ?? SCENE_POSITION_DEFAULT.scaleZ,
      };
      live.updateNodeTransform(entry.nodeId, next);
    }
  }, [viewMode, activeHubId, status, compiledHubView]);

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
