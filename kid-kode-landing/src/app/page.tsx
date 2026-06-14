'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { usePreviewStateStore } from '@/stores/usePreviewStateStore';
import { resolveTetherFireTargets } from '@/lib/prism-graph/tether-fire';
import {
  compileAppToPreview,
  type CompiledWorldContext,
} from '@/lib/prism-graph/compile-app';
import type { CompiledHubView } from '@/lib/prism-graph/compiled-view';
import {
  getCrossHubTethersArrivingAt,
  getCrossHubTethersDepartingFrom,
  type CompiledCrossHubTether,
} from '@/lib/prism-graph/cross-hub-tethers';
import {
  getNextHubId,
  getPrevHubId,
  resolveActiveHubId,
  serializePreviewAppHash,
} from '@/lib/prism-graph/preview-app-routing';
import type { PrismRootNode } from '@/lib/prism-graph/root-node';
import TopBar from '@/components/editor/overlays/TopBar';
import HubNav from '@/components/editor/overlays/HubNav';
import DetailCard from '@/components/editor/overlays/DetailCard';
import RightPane from '@/components/editor/panels/RightPane';
import SearchPalette from '@/components/editor/overlays/SearchPalette';
import Minimap from '@/components/editor/overlays/Minimap';
import CanvasToolbar from '@/components/editor/overlays/CanvasToolbar';
import CanvasCameraHud from '@/components/editor/overlays/CanvasCameraHud';
import PreviewJourneyReplay from '@/components/editor/overlays/PreviewJourneyReplay';
import PreviewDeviceFrame from '@/components/editor/overlays/PreviewDeviceFrame';
import PreviewHubNav from '@/components/editor/overlays/PreviewHubNav';
import HubMorphTransition from '@/components/editor/overlays/HubMorphTransition';
import AddNodeDialog from '@/components/editor/overlays/AddNodeDialog';
import ChangeArtifactWizard from '@/components/editor/change-artifact/ChangeArtifactWizard';
import ElementLibraryBrowser from '@/components/editor/elements/ElementLibraryBrowser';
import GalaxyFilterOverlay from '@/components/editor/overlays/GalaxyFilterOverlay';
import MagneticCursor from '@/components/editor/overlays/MagneticCursor';
import { Icon } from '@/components/editor/icons/Icon';
import { populateElementImages } from '@/lib/editor/populate-element-images';
import { DS, dsAlpha, RefractionDefs } from '@/components/editor/design-system';
import { ModeTransitionConductor } from '@/components/editor/chrome-layer';
import { useChromeSlab } from '@/components/editor/chrome-layer';
import { useEditorLayoutStore } from '@/stores/useEditorLayoutStore';
import { useEditorLayoutObserver } from '@/components/editor/layout/useEditorLayoutObserver';

const GraphScene = dynamic(() => import('@/components/editor/graph/GraphScene'), {
  ssr: false,
  loading: () => (
    // Observatory Brass boot sequence — ambient gradient backdrop (never a
    // flat fill), machined graphite track ring with brass sweep arc, a
    // calibrated brass progress rail riding a graphite well, and an
    // ice-telemetry readout on a smoked strip. DS tokens only;
    // transform/opacity motion only (rotation + translateX).
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-ds-void">
      {/* Transform-only keyframes for the indeterminate boot rail (scoped to
          this boot shell; honors prefers-reduced-motion). */}
      <style>{`
        @keyframes ds-boot-rail {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(420%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-boot-rail] { animation: none; }
        }
      `}</style>
      {/* Ambient observatory backdrop — warm brass starlight TL, cold ice BR. */}
      <div
        className="absolute inset-0 pointer-events-none opacity-75"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 18% 20%, rgba(var(--ds-brass-400-rgb), 0.08) 0%, transparent 58%), radial-gradient(ellipse 70% 60% at 82% 82%, rgba(var(--ds-ice-400-rgb), 0.07) 0%, transparent 58%)',
        }}
      />
      <div className="ds-reveal relative flex flex-col items-center gap-5">
        <div className="relative w-16 h-16">
          {/* Machined graphite track */}
          <div
            className="absolute inset-0 rounded-full border-2 border-ds-slate"
            style={{
              boxShadow:
                'inset 0 1px 0 var(--ds-edge-specular), inset 0 -1px 0 rgba(0,0,0,0.45), 0 4px 14px rgba(0,0,0,0.4)',
            }}
          />
          {/* Brass sweep arc */}
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-ds-brass-400 border-r-ds-brass-600 animate-spin"
            style={{ animationDuration: '1.1s', filter: `drop-shadow(0 0 6px ${dsAlpha(DS.brass400, 0.45)})` }}
          />
          {/* Inner ice telemetry arc, counter-rotating */}
          <div
            className="absolute inset-[7px] rounded-full border border-transparent border-b-ds-ice-400 animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.6s', opacity: 0.7 }}
          />
          {/* Brass hub cap */}
          <div
            className="absolute inset-[26px] rounded-full"
            style={{
              background: `radial-gradient(circle at 32% 28%, ${DS.brass100} 0%, ${DS.brass300} 38%, ${DS.brass500} 72%, ${DS.brass700} 100%)`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.6), var(--ds-glow-brass), inset 0 -1px 1px rgba(0,0,0,0.4)',
            }}
          />
        </div>
        {/* Calibrated boot rail — brass indicator sweeping a graphite well. */}
        <div
          className="ds-well relative w-44 h-2 overflow-hidden"
          style={{ borderRadius: 'var(--ds-r-pill)' }}
        >
          <div
            data-boot-rail
            className="absolute top-0 bottom-0 w-1/4 rounded-full"
            style={{
              background: 'var(--ds-grad-brass)',
              boxShadow:
                'var(--ds-glow-brass), inset 0 1px 0 var(--ds-edge-specular), inset 0 -1px 0 rgba(0,0,0,0.35)',
              animation: 'ds-boot-rail 1.3s var(--ds-ease-inout) infinite',
            }}
          />
        </div>
        {/* Ice-telemetry readout on a smoked strip. */}
        <div
          className="ds-smoked ds-edge flex items-center gap-2 px-3.5 py-1.5"
          style={{ borderRadius: 'var(--ds-r-pill)' }}
        >
          <Icon name="sparkle" size={10} color={DS.brass400} glow />
          <span
            className="ds-kicker"
            style={{
              color: 'var(--ds-ice-300)',
              textShadow: `0 1px 0 rgba(0,0,0,0.7), 0 0 10px ${dsAlpha(DS.ice400, 0.35)}`,
            }}
          >
            INITIALIZING PRISM RUNTIME
          </span>
        </div>
      </div>
    </div>
  ),
});
export default function Page() {
  // UI-WOW-2 P0 — CONTAINER-aware density. The editor is the preview pane of an
  // app-builder, so responsiveness must key off the editor's own box, not the
  // viewport (a narrow pane in a wide browser is invisible to innerWidth). A
  // single ResizeObserver on <main> (below) publishes the measured box to
  // useEditorLayoutStore; `density` drives the layout tree + every overlay.
  const mainRef = useRef<HTMLElement>(null);
  useEditorLayoutObserver(mainRef);
  const density = useEditorLayoutStore((s) => s.density);
  const isCompact = density === 'compact';
  // viewMode lives on useGraphEditorStore (HL12 / Plan §P12) so Inspector's
  // "Preview in App UI" button can swap panes without prop-drilling.
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const setViewMode = useGraphEditorStore((s) => s.setViewMode);
  // EB-10-02 / §10 SC-054 — preview-app routing reads the active hub from
  // the store and writes back via setState (no dedicated action needed).
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);

  // EBR2-B-02 / §R2-B SC-066 — reactive selectors over the source-graph
  // store slices that feed compileAppToPreview. Subscribing here (rather
  // than reading inside an effect with getState()) makes the page-level
  // compile reactive to graph edits: a slider drag, a node upsert, or a
  // mockup swap re-runs the useMemo below and PrismHost receives a fresh
  // CompiledHubView prop without remounting. INV-17 is satisfied trivially
  // because compileAppToPreview is pure (SC-029) and never writes back.
  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  const sourceRootNodes = useGraphSourceStore((s) => s.rootNodes);

  // EBR2-B-02 / §R2-B SC-066 — resolve a PrismRootNode for the live source
  // graph. The fake-root fallback mirrors the one used by the preview-app
  // routing effect below for legacy fixtures that ship with no PrismRootNode
  // seeded. Memoized so the root identity is stable when the source slices
  // are stable, keeping the downstream compile memo from invalidating.
  const liveRoot = useMemo<PrismRootNode>(
    () =>
      sourceRootNodes[0] ??
      ({
        appNameWorldId: 'app-name-world-default',
        spec: {},
        designSpec: {},
        buildPlan: {},
        memoryLog: [],
        hubRegistry: sourceHubs.map((h) => ({ hubId: h.hubId })),
        nodeRegistry: [],
        globalDependencies: [],
        validationRules: [],
        aiRoutingRules: [],
      } as unknown as PrismRootNode),
    [sourceRootNodes, sourceHubs],
  );

  // EBR2-B-02 / §R2-B SC-066 — compute CompiledAppView once per render
  // (memoized). The compile is pure + deterministic (SC-029), so identical
  // (root, hubs, nodes, edges) → identical hash → React skips the prop
  // diff for PrismHost.
  const compiledAppView = useMemo(
    () => compileAppToPreview(liveRoot, sourceHubs, sourceNodes, sourceEdges),
    [liveRoot, sourceHubs, sourceNodes, sourceEdges],
  );

  // EBR2-B-02 / §R2-B SC-066 — derive the active hub's CompiledHubView
  // by picking from CompiledAppView.hubs. Falling back to hubs[0] mirrors
  // PrismHost's existing "first hub when activeHubId is unset" semantics
  // so the boot frame still gets a valid CompiledHubView before the
  // routing effect resolves the URL hash.
  const activeCompiledHubView: CompiledHubView | null = useMemo(() => {
    if (compiledAppView.hubs.length === 0) return null;
    if (activeHubId) {
      const found = compiledAppView.hubs.find((h) => h.hubId === activeHubId);
      if (found) return found;
    }
    return compiledAppView.hubs[0] ?? null;
  }, [compiledAppView, activeHubId]);

  useEffect(() => {
    populateElementImages().catch(() => {
      // Best-effort: GlassNode falls back to its procedural texture if the
      // atlas can't be read. Don't surface — boot continues regardless.
    });
  }, []);

  // EB-06-07 / EBR2-A-02 — Expose a typed dev hook the verify-editor-runtimes
  // script uses to programmatically switch view mode for the inner-runtime
  // snapshot. Without this hook the script falls back to "no-hook" and
  // captures whatever mode the editor happened to be in. Lives on `window`
  // (editor-shell code; not subject to INV-13 which scopes to runtime /
  // node modules). Only the canonical 3 modes (RA-06b) are accepted.
  useEffect(() => {
    (window as unknown as {
      __PRISM_EDITOR_SET_VIEW_MODE__?: (m: string) => void;
    }).__PRISM_EDITOR_SET_VIEW_MODE__ = (m) => {
      if (m === 'galaxy' || m === 'canvas' || m === 'preview-app') {
        setViewMode(m);
      }
    };
    return () => {
      delete (window as unknown as {
        __PRISM_EDITOR_SET_VIEW_MODE__?: (m: string) => void;
      }).__PRISM_EDITOR_SET_VIEW_MODE__;
    };
  }, [setViewMode]);

  // EB-09-06 / §9 SC-052 — Expose a typed dev hook the verify-editor-runtimes
  // script uses to fire a tether from a known source against the live graph
  // store and read back the resolved targets. The hook reads nodes+edges
  // from useGraphSourceStore (the same store PrismHost mounts from) and
  // invokes the pure resolveTetherFireTargets from tether-fire.ts, so what
  // is recorded mirrors exactly what the inner runtime would propagate
  // through SC-049. The result is also pushed into a small ring buffer on
  // window so the snapshot script can read recent fires deterministically.
  // Editor-shell code (not subject to INV-15 / FP-05, which scope to runtime
  // and node modules).
  useEffect(() => {
    type TetherFireRecord = {
      sourceNodeId: string;
      event: string | null;
      firedAt: number;
      targets: Array<{
        targetNodeId: string;
        edge: { from: string; to: string; type: string; event?: string };
        boundPrimitiveNames: string[];
        boundKeyframeCount: number;
      }>;
    };
    const fires: TetherFireRecord[] = [];
    (window as unknown as {
      __PRISM_EDITOR_FIRE_TETHER__?: (sourceNodeId: string, event?: string) => TetherFireRecord;
      __PRISM_EDITOR_TETHER_FIRES__?: ReadonlyArray<TetherFireRecord>;
    }).__PRISM_EDITOR_FIRE_TETHER__ = (sourceNodeId, event) => {
      const { nodes, edges } = useGraphSourceStore.getState();
      const firedAt = Date.now();
      const resolved = resolveTetherFireTargets(nodes, edges, {
        sourceNodeId,
        event,
        firedAt,
      });
      const record: TetherFireRecord = {
        sourceNodeId,
        event: event ?? null,
        firedAt,
        targets: resolved.map((r) => ({
          targetNodeId: r.targetNodeId,
          edge: {
            from: r.edge.from,
            to: r.edge.to,
            type: r.edge.type,
            event: r.edge.event,
          },
          boundPrimitiveNames: r.boundPrimitives.map((p) => p.name),
          boundKeyframeCount: r.boundKeyframes.length,
        })),
      };
      fires.push(record);
      (window as unknown as {
        __PRISM_EDITOR_TETHER_FIRES__?: ReadonlyArray<TetherFireRecord>;
      }).__PRISM_EDITOR_TETHER_FIRES__ = [...fires];
      return record;
    };
    (window as unknown as {
      __PRISM_EDITOR_TETHER_FIRES__?: ReadonlyArray<TetherFireRecord>;
    }).__PRISM_EDITOR_TETHER_FIRES__ = [];
    return () => {
      const w = window as unknown as {
        __PRISM_EDITOR_FIRE_TETHER__?: unknown;
        __PRISM_EDITOR_TETHER_FIRES__?: unknown;
      };
      delete w.__PRISM_EDITOR_FIRE_TETHER__;
      delete w.__PRISM_EDITOR_TETHER_FIRES__;
    };
  }, []);

  // EB-10-02 / EBR2-A-03 — debug-only handle to the live zustand stores so
  // verify scripts can seed test fixtures (graphSource) and read snapshot
  // state (graphEditor, for SC-064's boot-default viewMode capture). EBR2-E-02
  // adds `previewState` so the Inspector preview-overlay path is observable
  // from `verify-editor-runtimes.mjs` (notes/ralph-interactions/EBR2-E-02.json).
  // Editor-shell code; not subject to INV-13.
  useEffect(() => {
    (window as unknown as {
      __PRISM_DEBUG_STORES__?: {
        graphSource: typeof useGraphSourceStore;
        graphEditor: typeof useGraphEditorStore;
        previewState: typeof usePreviewStateStore;
      };
    }).__PRISM_DEBUG_STORES__ = {
      graphSource: useGraphSourceStore,
      graphEditor: useGraphEditorStore,
      previewState: usePreviewStateStore,
    };
    return () => {
      delete (window as unknown as {
        __PRISM_DEBUG_STORES__?: unknown;
      }).__PRISM_DEBUG_STORES__;
    };
  }, []);

  // EBR2-B-04 / §R2-B SC-066 — debug getter for the active CompiledHubView so
  // verify-editor-runtimes can record `compiledNodeCount` (the assembly
  // proof) in state.json without re-implementing compileAppToPreview in the
  // script. Returns a structural read-only snapshot of the in-scope memo
  // (`activeCompiledHubView`); never mutates the source graph (INV-17).
  useEffect(() => {
    (window as unknown as {
      __PRISM_EDITOR_COMPILED_HUB_VIEW__?: () => {
        hubId: string;
        nodeCount: number;
        visibleNodeCount: number;
        backgroundLayerCount: number;
      } | null;
    }).__PRISM_EDITOR_COMPILED_HUB_VIEW__ = () => {
      const v = activeCompiledHubView;
      if (!v) return null;
      return {
        hubId: v.hubId,
        nodeCount: v.nodes.length,
        visibleNodeCount: v.nodes.filter((n) => n.visible !== false).length,
        backgroundLayerCount: v.background.length,
      };
    };
    return () => {
      delete (window as unknown as {
        __PRISM_EDITOR_COMPILED_HUB_VIEW__?: unknown;
      }).__PRISM_EDITOR_COMPILED_HUB_VIEW__;
    };
  }, [activeCompiledHubView]);

  // EB-10-02 / §10 SC-054 — preview-app route-like navigation. While the
  // user is in `preview-app`, the URL hash (`#hub=<hubId>`) is the source of
  // truth for which compiled hub is active. Three wires:
  //   1. Entering preview-app (or popstate while there): parse location.hash,
  //      resolve through the live CompiledAppView, write activeHubId.
  //   2. Hub switch in the store: push a new history entry so browser
  //      back/forward steps through hub history.
  //   3. Dev hook `__PRISM_EDITOR_PREVIEW_APP_NAV__` exposes a programmatic
  //      next/prev/go-to-hub API for the verify-editor-runtimes snapshot.
  // INV-17: the compile is read-only; no source-graph fields are written.
  // INV-20: only `activeHubId` is mutated — selection survives the transition.
  useEffect(() => {
    if (viewMode !== 'preview-app') return;
    if (typeof window === 'undefined') return;

    function compileLiveApp() {
      const source = useGraphSourceStore.getState();
      // The legacy fixture has no rootNodes seeded; synthesize a minimal
      // PrismRootNode whose appNameWorldId derives from the active world id
      // (falls back to a stable literal so the compile remains deterministic).
      const root: PrismRootNode =
        source.rootNodes[0] ??
        ({
          appNameWorldId: 'app-name-world-default',
          spec: {},
          designSpec: {},
          buildPlan: {},
          memoryLog: [],
          hubRegistry: source.hubs.map((h) => ({ hubId: h.hubId })),
          nodeRegistry: [],
          globalDependencies: [],
          validationRules: [],
          aiRoutingRules: [],
        } as unknown as PrismRootNode);
      // EB-10-04 / SC-056. Pass `edges` so the compiled view carries the
      // cross-hub tether surface preview-app reads on every hub change.
      return compileAppToPreview(root, source.hubs, source.nodes, source.edges);
    }

    function applyHash(): void {
      const compiled = compileLiveApp();
      const nextHubId = resolveActiveHubId(window.location.hash, compiled);
      if (nextHubId && nextHubId !== useGraphEditorStore.getState().activeHubId) {
        useGraphEditorStore.setState({ activeHubId: nextHubId });
      }
    }

    // Entry: resolve current hash against the compiled view. If the hash is
    // missing or invalid, replace (not push) so back-navigation lands the
    // user wherever they came from, not at a phantom hash.
    const compiledAtEntry = compileLiveApp();
    const resolvedAtEntry = resolveActiveHubId(window.location.hash, compiledAtEntry);
    if (resolvedAtEntry) {
      const desiredHash = serializePreviewAppHash(resolvedAtEntry);
      if (window.location.hash !== desiredHash) {
        window.history.replaceState(null, '', desiredHash);
      }
      if (resolvedAtEntry !== useGraphEditorStore.getState().activeHubId) {
        useGraphEditorStore.setState({ activeHubId: resolvedAtEntry });
      }
    }

    const onPopState = () => { applyHash(); };
    window.addEventListener('popstate', onPopState);

    // EB-10-04 / SC-056. The PreviewAppNav surface gains two cross-hub
    // tether helpers. `crossHubTethers` is the deterministic full set; the
    // arriving/departing methods are the runtime's "render during transition"
    // (departing — sweeps along the EB-10-03 camera transit) and "resolve on
    // arrival" (arriving — feeds the SC-049 animation-library invocation)
    // accessors. All three are getters/methods so they read the live compile
    // — never a stale snapshot — even after a graph edit during preview-app.
    type PreviewAppNav = {
      activeHubId: string | null;
      hubIds: readonly string[];
      next(): string | null;
      prev(): string | null;
      goTo(hubId: string): string | null;
      readonly crossHubTethers: readonly CompiledCrossHubTether[];
      arrivingAt(hubId: string): readonly CompiledCrossHubTether[];
      departingFrom(hubId: string): readonly CompiledCrossHubTether[];
      // EB-10-05 / SC-057. Live read of the CompiledAppView.world surface
      // (App_Name_World context) so the verify-editor-runtimes snapshot can
      // capture the world-context binding alongside the rendered preview-app.
      readonly world: CompiledWorldContext;
    };
    (window as unknown as {
      __PRISM_EDITOR_PREVIEW_APP_NAV__?: PreviewAppNav;
    }).__PRISM_EDITOR_PREVIEW_APP_NAV__ = {
      get activeHubId() {
        return useGraphEditorStore.getState().activeHubId;
      },
      get hubIds() {
        return compileLiveApp().hubs.map((h) => h.hubId);
      },
      next() {
        const compiled = compileLiveApp();
        const current = useGraphEditorStore.getState().activeHubId
          ?? resolveActiveHubId(window.location.hash, compiled);
        if (!current) return null;
        const target = getNextHubId(compiled, current);
        if (!target) return null;
        window.history.pushState(null, '', serializePreviewAppHash(target));
        useGraphEditorStore.setState({ activeHubId: target });
        return target;
      },
      prev() {
        const compiled = compileLiveApp();
        const current = useGraphEditorStore.getState().activeHubId
          ?? resolveActiveHubId(window.location.hash, compiled);
        if (!current) return null;
        const target = getPrevHubId(compiled, current);
        if (!target) return null;
        window.history.pushState(null, '', serializePreviewAppHash(target));
        useGraphEditorStore.setState({ activeHubId: target });
        return target;
      },
      goTo(hubId: string) {
        const compiled = compileLiveApp();
        const exists = compiled.hubs.some((h) => h.hubId === hubId);
        if (!exists) return null;
        window.history.pushState(null, '', serializePreviewAppHash(hubId));
        useGraphEditorStore.setState({ activeHubId: hubId });
        return hubId;
      },
      get crossHubTethers() {
        return compileLiveApp().crossHubTethers;
      },
      arrivingAt(hubId: string) {
        return getCrossHubTethersArrivingAt(compileLiveApp(), hubId);
      },
      departingFrom(hubId: string) {
        return getCrossHubTethersDepartingFrom(compileLiveApp(), hubId);
      },
      get world() {
        return compileLiveApp().world;
      },
    };

    return () => {
      window.removeEventListener('popstate', onPopState);
      delete (window as unknown as {
        __PRISM_EDITOR_PREVIEW_APP_NAV__?: PreviewAppNav;
      }).__PRISM_EDITOR_PREVIEW_APP_NAV__;
    };
    // sourceHubs.length: the live graph loads async — at first mount the
    // compile sees 0 hubs and entry resolution no-ops; re-run once hubs land
    // so boot always resolves the entry hub (UI-FIDELITY-2 W3 boot-null fix).
  }, [viewMode, sourceHubs.length]);

  // EB-10-02 — when the store's activeHubId changes while in preview-app
  // (e.g. via the Prev/Next buttons below or programmatic setState), keep
  // the URL hash in sync. Push a history entry so browser back/forward
  // walks the user's navigation trail. Skip when the hash already matches
  // (avoids a redundant pushState during the entry-resolve effect above).
  useEffect(() => {
    if (viewMode !== 'preview-app') return;
    if (typeof window === 'undefined') return;
    if (!activeHubId) return;
    const desired = serializePreviewAppHash(activeHubId);
    if (window.location.hash === desired) return;
    window.history.pushState(null, '', desired);
  }, [viewMode, activeHubId]);

  // EB-10-04 / §10 SC-056. On every hub arrival in preview-app, fire the
  // receiving hub's animation library for each cross-hub tether ending at
  // the new active hub. Drives the SC-049 tether-fire path on the same
  // (nodes, edges) the renderer mounted from, so the resolved targets are
  // identical to what an in-hub fire from the source node would have
  // propagated — the "receiving hub's animation library invokes correctly
  // on arrival" haltCheck.
  //
  // INV-17: read-only against the source store. INV-20: only the existing
  // tether-fire surfaces are touched; selection state is not mutated.
  useEffect(() => {
    if (viewMode !== 'preview-app') return;
    if (typeof window === 'undefined') return;
    if (!activeHubId) return;

    const source = useGraphSourceStore.getState();
    const root: PrismRootNode =
      source.rootNodes[0] ??
      ({
        appNameWorldId: 'app-name-world-default',
        spec: {},
        designSpec: {},
        buildPlan: {},
        memoryLog: [],
        hubRegistry: source.hubs.map((h) => ({ hubId: h.hubId })),
        nodeRegistry: [],
        globalDependencies: [],
        validationRules: [],
        aiRoutingRules: [],
      } as unknown as PrismRootNode);
    const view = compileAppToPreview(
      root,
      source.hubs,
      source.nodes,
      source.edges,
    );
    const arriving = getCrossHubTethersArrivingAt(view, activeHubId);
    if (arriving.length === 0) return;

    type ArrivalRecord = {
      arrivedHubId: string;
      arrivedAt: number;
      tethers: Array<{
        from: { hubId: string; nodeId: string };
        to: { hubId: string; nodeId: string };
        type: string;
        event?: string;
        boundKeyframeCount: number;
        boundPrimitiveNames: string[];
      }>;
    };

    const arrivedAt = Date.now();
    // SC-049 contract: the tether-fire surface only propagates `'triggers'`
    // edges. Non-`triggers` cross-hub tethers (`data-flow`, `event-bubble`,
    // `state-update`, …) carry render-only semantics for SC-056 — they exist
    // on the data surface (so the transit-side `departingFrom` accessor can
    // draw them) but they do not invoke the receiving hub's animation
    // library on arrival. Filtering here avoids silently recording empty
    // arrival records for those — the absence is the truthful signal.
    const arrivingTriggers = arriving.filter((t) => t.type === 'triggers');
    const records = arrivingTriggers.map((t) => {
      // Run the SC-049 propagation against the live (nodes, edges) using the
      // arriving edge's source node as the firing source. The receiving hub's
      // bound animations + cinematic primitives surface as the resolved
      // targets — that is the "animation library invocation" surface.
      const resolved = resolveTetherFireTargets(source.nodes, source.edges, {
        sourceNodeId: t.from.nodeId,
        event: t.event,
        firedAt: arrivedAt,
      });
      const target = resolved.find((r) => r.targetNodeId === t.to.nodeId);
      return {
        from: { hubId: t.from.hubId, nodeId: t.from.nodeId },
        to: { hubId: t.to.hubId, nodeId: t.to.nodeId },
        type: t.type,
        ...(t.event !== undefined ? { event: t.event } : {}),
        boundKeyframeCount: target?.boundKeyframes.length ?? 0,
        boundPrimitiveNames:
          target?.boundPrimitives.map((p) => p.name) ?? [],
      };
    });
    if (records.length === 0) return;

    const arrivalsKey = '__PRISM_EDITOR_CROSS_HUB_ARRIVALS__';
    const w = window as unknown as {
      __PRISM_EDITOR_CROSS_HUB_ARRIVALS__?: ArrivalRecord[];
    };
    const prior = Array.isArray(w[arrivalsKey]) ? w[arrivalsKey]! : [];
    const record: ArrivalRecord = {
      arrivedHubId: activeHubId,
      arrivedAt,
      tethers: records,
    };
    w[arrivalsKey] = [...prior, record];
  }, [viewMode, activeHubId]);

  // UI-FIDELITY-2 — page-level chrome slabs. At t2 the view-mode toggle
  // housing renders as real brushed metal and the preview-app nav pill as
  // real frosted glass in the unified canvas (below t2 the v1 CSS stands —
  // INV-9). The toggle's sliding brass thumb stays CSS: it animates via
  // transform on every mode switch and a slab rect (sampled from layout
  // once per frame) would lag the spring; the 3 mode buttons stay CSS text
  // riding the slab.
  const modeToggleSlab = useChromeSlab({ material: 'metal', radius: 999, brushAxis: 'x' });
  const previewNavSlab = useChromeSlab({ material: 'glass', radius: 999, frost: 0.4 });

  // RT-SC-03 / INV-R3 — ONE unified scene (GraphScene) for all three modes.
  // The mode is a STATE of that scene, not a choice of which mount to render.
  // preview-app hides editor chrome so the same built scene reads as the running
  // app (it is NOT a separate PrismHost/compiled mount — FP-R5).
  const isPreviewApp = viewMode === 'preview-app';

  return (
    <main
      ref={mainRef}
      data-density={density}
      className="relative w-full h-full overflow-hidden bg-ds-void"
    >
      {/* SVG displacement defs for .ds-glass--refract overlays (mounted once). */}
      <RefractionDefs />
      {/* UI-FIDELITY-2 — mode-morph choreography: travelling refractive sweep
          pane + staggered chrome reveal + boot light pass (t2 only). */}
      <ModeTransitionConductor />
      {/* Ambient observatory backdrop — warm brass starlight TL, cold ice BR. */}
      <div
        className="absolute inset-0 pointer-events-none opacity-75"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 18% 20%, rgba(var(--ds-brass-400-rgb), 0.08) 0%, transparent 58%), radial-gradient(ellipse 70% 60% at 82% 82%, rgba(var(--ds-ice-400-rgb), 0.07) 0%, transparent 58%)',
        }}
      />

      {!isCompact ? (
        <>
          {/* View-mode toggle — canonical 3 modes (RA-06b / SC-065).
              galaxy:      free-camera view of every hub in the universe.
              canvas:      single-canvas authoring surface for the active hub
                           (the legacy intra-hub authoring mode folds in here).
              preview-app: the running app; default on boot (RA-17).
              Chrome: machined brass-and-graphite segmented control — equal-width
              slots so the brass thumb slides with a pure translateX (transform-
              only motion per the DS contract). Segments are 36px tall with an
              invisible ::after extension for a ≥44px effective touch target. */}
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
            data-component="view-mode-toggle"
          >
            <div
              ref={modeToggleSlab.ref}
              className="ds-metal ds-grain ds-edge relative flex items-center p-1"
              style={{ borderRadius: 'var(--ds-r-pill)' }}
            >
              {/* Sliding brass thumb — translateX only, spring-eased. */}
              <span
                aria-hidden
                className="ds-edge--brass absolute top-1 bottom-1 left-1 w-24 rounded-full pointer-events-none"
                style={{
                  transform: `translateX(${Math.max(
                    0,
                    (['galaxy', 'canvas', 'preview-app'] as const).indexOf(viewMode),
                  ) * 96}px)`,
                  transition: 'transform var(--ds-t-slow) var(--ds-ease-spring)',
                  background: 'var(--ds-grad-brass-soft)',
                  boxShadow: 'var(--ds-chamfer-soft), var(--ds-glow-brass)',
                }}
              />
              {([
                { id: 'galaxy',      label: 'Galaxy' },
                { id: 'canvas',      label: 'Canvas' },
                { id: 'preview-app', label: 'Preview App' },
              ] as const).map((m) => {
                const active = viewMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setViewMode(m.id)}
                    className={`ds-press relative z-10 w-24 h-9 rounded-full text-[12px] font-ui font-semibold tracking-normal transition-colors after:content-[''] after:absolute after:-inset-y-1 after:inset-x-0 after:rounded-full ${
                      active
                        ? 'text-ds-brass-200'
                        : 'text-ds-text-mid hover:text-ds-text hover:bg-white/5'
                    }`}
                    style={
                      active
                        ? { textShadow: `0 0 10px ${dsAlpha(DS.brass400, 0.4)}` }
                        : undefined
                    }
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>


          {/* EB-10-02 / §10 SC-054 — minimal hub-to-hub navigation affordance,
              visible only in `preview-app`. Each click pushes a history entry
              via the dev hook so browser back/forward walks the hub trail.
              The hash route (`#hub=<hubId>`) drives the active hub regardless
              of how the user navigates (button, popstate, direct URL). */}
          {/* EB-10-05 / §6 SC-057 — App_Name_World context binding rendered
              in preview-app. Reads CompiledAppView.world via the dev hook
              installed by the routing effect above so the displayed name
              tracks the live compile (no stale snapshot). Visible chrome so
              the verify-editor-runtimes inner.png captures the binding. */}
          {isPreviewApp && <PreviewAppWorldBadge />}

          {isPreviewApp && (
            <div
              ref={previewNavSlab.ref}
              data-component="preview-app-nav"
              className="ds-glass ds-edge absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center gap-2 px-2.5 py-1.5"
              /* position:absolute inline — .ds-glass sets position:relative and
                 materials.css loads after the Tailwind utilities. */
              style={{ borderRadius: 'var(--ds-r-pill)', position: 'absolute' }}
            >
              <button
                type="button"
                data-component="preview-app-prev"
                aria-label="Previous hub"
                onClick={() => {
                  const nav = (window as unknown as {
                    __PRISM_EDITOR_PREVIEW_APP_NAV__?: { prev(): string | null };
                  }).__PRISM_EDITOR_PREVIEW_APP_NAV__;
                  nav?.prev();
                }}
                className="ds-press relative h-9 px-3 rounded-full text-[12px] font-ui font-medium tracking-normal text-ds-text-mid hover:text-ds-brass-200 hover:bg-white/5 transition-colors after:content-[''] after:absolute after:-inset-y-1 after:inset-x-0 after:rounded-full"
              >
                ‹ Prev
              </button>
              {/* HUD hub readout — ice-telemetry type on a smoked strip. */}
              <span
                className="ds-smoked ds-edge flex items-center gap-2 h-7 px-3 select-none"
                style={{ borderRadius: 'var(--ds-r-pill)' }}
              >
                <span className="ds-kicker" style={{ color: 'var(--ds-ice-500)' }}>
                  Hub
                </span>
                <span
                  className="text-[10px] font-mono tracking-widest tabular-nums"
                  style={{
                    color: 'var(--ds-ice-300)',
                    textShadow: `0 1px 0 rgba(0,0,0,0.6), 0 0 9px ${dsAlpha(DS.ice400, 0.35)}`,
                  }}
                >
                  {activeHubId ?? '—'}
                </span>
              </span>
              <button
                type="button"
                data-component="preview-app-next"
                aria-label="Next hub"
                onClick={() => {
                  const nav = (window as unknown as {
                    __PRISM_EDITOR_PREVIEW_APP_NAV__?: { next(): string | null };
                  }).__PRISM_EDITOR_PREVIEW_APP_NAV__;
                  nav?.next();
                }}
                className="ds-press relative h-9 px-3 rounded-full text-[12px] font-ui font-medium tracking-normal text-ds-text-mid hover:text-ds-brass-200 hover:bg-white/5 transition-colors after:content-[''] after:absolute after:-inset-y-1 after:inset-x-0 after:rounded-full"
              >
                Next ›
              </button>
            </div>
          )}

          {/* RT-SC-03 / INV-R3 / FP-R5 — ONE unified scene for all three
              modes. preview-app is a STATE of this same scene (built artifacts
              from the cache, handles hidden, drivers running), NOT a separate
              compiled PrismHost mount. GraphScene always mounts; the mode drives
              what renders inside it (galaxy=spheres, canvas/preview-app=built).
              Editor chrome is hidden in preview-app so it reads as the running
              app rather than an editor. */}
          <div data-pane="graph" className="absolute inset-0">
            <GraphScene />
            {!isPreviewApp && (
              <>
                <TopBar />
                <HubNav />
                <Minimap />
                <DetailCard />
                <RightPane />
                <GalaxyFilterOverlay />
                {/* STEP8 — Canvas authoring suite. Self-gates to viewMode==='canvas'. */}
                <CanvasToolbar />
                {/* APP-REALITY P1 — canvas camera instrument (angle read-out +
                    reset-to-zero + haptic pulse). Self-gates to canvas. */}
                <CanvasCameraHud />
              </>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Mobile: same single-scene discipline as desktop. */}
          <div data-pane="graph" className="absolute inset-0">
            <GraphScene />
            {!isPreviewApp && (
              <>
                <TopBar />
                <HubNav />
                <DetailCard />
                <RightPane />
                <GalaxyFilterOverlay />
                <CanvasToolbar />
                <CanvasCameraHud />
              </>
            )}
          </div>
          {/* P2 Task C (Logan addendum, 2026-06-10) — mobile mode toggle.
              Phones previously rendered NO Galaxy|Canvas|Preview-App switch,
              so they were stuck in the preview-app boot default (RA-17).
              Rendered UNCONDITIONALLY in the mobile branch (it must stay
              reachable from preview-app, exactly like the desktop toggle).
              Same store wiring (setViewMode), canonical 3 literals only
              (FP-12/FP-14). */}
          <MobileModeToggle />
        </>
      )}

      <SearchPalette />
      <AddNodeDialog />
      <ChangeArtifactWizard />
      <ElementLibraryBrowser />
      {/* APP-REALITY P2 — preview-side "replay intro" (self-gates to preview-app
          + a hub that has an authored camera journey). */}
      <PreviewJourneyReplay />
      {/* APP-REALITY P5 — preview device modes + device bezel (self-gates to preview-app). */}
      <PreviewDeviceFrame />
      {/* APP-REALITY P6 — preview hub nav rail + premium morph transition. */}
      <PreviewHubNav />
      <HubMorphTransition />
      {/* UI-WOW P2 — signature magnetic pointer (augments the OS cursor; inert on
          touch / reduced-motion). DESIGN-REFERENCES §7. */}
      <MagneticCursor />
    </main>
  );
}

// P2 Task C (Logan addendum, 2026-06-10) — compact MOBILE mode switch.
// A bottom-center floating Observatory Brass pill carrying the same canonical
// 3 view modes as the desktop toggle (RA-06b / SC-065): galaxy | canvas |
// preview-app — the ONLY legal literals (FP-12/FP-14). Reuses the exact store
// wiring (useGraphEditorStore.setViewMode). 44px touch targets (h-11),
// thumb-reachable bottom placement, safe-area-inset aware. The sliding brass
// thumb is GSAP-driven (transform-only x slide, spring ease; gsap.set under
// prefers-reduced-motion). Materials: ds-metal housing + ds-grain tooth +
// specular ds-edge ring, brass-soft gradient thumb with chamfer + brass glow
// — never flat. Mounted ONLY in the mobile branch; the desktop branch is
// untouched.
const MOBILE_MODE_SLOT_W = 88; // px — 3 slots = 264px + housing, fits 320px.

function MobileModeToggle() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const setViewMode = useGraphEditorStore((s) => s.setViewMode);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  // UI-FIDELITY-2 — housing slab. The hook is tier-gated, so phones (t1)
  // keep the v1 CSS metal untouched while tablet-class t2 devices get the
  // real brushed housing. The GSAP brass thumb stays CSS (transform-driven
  // slide — a slab rect sampled from layout would lag the spring).
  const housingSlab = useChromeSlab({ material: 'metal', radius: 999, brushAxis: 'x' });

  const idx = Math.max(
    0,
    (['galaxy', 'canvas', 'preview-app'] as const).indexOf(viewMode),
  );

  // GSAP slide indicator — translateX only (DS motion contract).
  useEffect(() => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const x = idx * MOBILE_MODE_SLOT_W;
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      gsap.set(thumb, { x });
      return;
    }
    gsap.to(thumb, { x, duration: 0.5, ease: 'back.out(1.5)', overwrite: 'auto' });
  }, [idx]);

  return (
    <div
      data-component="mobile-mode-toggle"
      // UI-WOW-2 P0 — `absolute` (not `fixed`) so it centers in the editor's
      // CONTAINER, not the browser viewport. Fixed positioning parked this pill
      // in the dead gutter when the editor is embedded in a narrow preview-pane.
      className="absolute left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
      style={{ bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        ref={housingSlab.ref}
        className="ds-metal ds-grain ds-edge relative flex items-center p-1"
        style={{ borderRadius: 'var(--ds-r-pill)' }}
      >
        {/* Sliding brass thumb — GSAP x-slide, spring-eased. */}
        <span
          ref={thumbRef}
          aria-hidden
          className="ds-edge--brass absolute top-1 bottom-1 left-1 rounded-full pointer-events-none"
          style={{
            width: MOBILE_MODE_SLOT_W,
            transform: `translateX(${idx * MOBILE_MODE_SLOT_W}px)`,
            background: 'var(--ds-grad-brass-soft)',
            boxShadow: 'var(--ds-chamfer-soft), var(--ds-glow-brass)',
          }}
        />
        {([
          { id: 'galaxy',      label: 'Galaxy' },
          { id: 'canvas',      label: 'Canvas' },
          { id: 'preview-app', label: 'Preview' },
        ] as const).map((m) => {
          const active = viewMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              data-mode={m.id}
              onClick={() => setViewMode(m.id)}
              className={`ds-press relative z-10 h-11 rounded-full text-[12px] font-ui font-semibold tracking-normal transition-colors ${
                active
                  ? 'text-ds-brass-200'
                  : 'text-ds-text-mid active:text-ds-text'
              }`}
              style={{
                width: MOBILE_MODE_SLOT_W,
                ...(active
                  ? { textShadow: `0 0 10px ${dsAlpha(DS.brass400, 0.4)}` }
                  : {}),
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// EB-10-05 / §6 SC-057. Visible preview-app chrome that renders the
// App_Name_World context from the live CompiledAppView surface. Polls the
// `__PRISM_EDITOR_PREVIEW_APP_NAV__.world` getter installed by the routing
// effect — pull-based so a graph edit (which re-runs compileAppToPreview
// inside the getter) is reflected without an explicit subscription. The
// badge mounts only inside preview-app (parent gate is `isPreviewApp`).
function PreviewAppWorldBadge() {
  const [worldLabel, setWorldLabel] = useState<{
    appNameWorldId: string;
    name: string | null;
  } | null>(null);

  // UI-FIDELITY-2 — at t2 the nameplate housing renders as real brushed
  // metal and its inset value strip as real smoked glass in the unified
  // canvas (CSS stands below t2). Hooks live ABOVE the `!worldLabel` early
  // return (hooks rule); the ref callbacks simply never attach while the
  // badge renders null.
  const plateSlab = useChromeSlab({ material: 'metal', radius: 13, brushAxis: 'x' });
  const stripSlab = useChromeSlab({ material: 'glass', radius: 9, frost: 0.3 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    function read() {
      const nav = (window as unknown as {
        __PRISM_EDITOR_PREVIEW_APP_NAV__?: {
          world?: CompiledWorldContext;
        };
      }).__PRISM_EDITOR_PREVIEW_APP_NAV__;
      const w = nav?.world;
      if (!w) {
        setWorldLabel(null);
        return;
      }
      const specName =
        typeof w.spec?.name === 'string' ? (w.spec.name as string) : null;
      setWorldLabel({ appNameWorldId: w.appNameWorldId, name: specName });
    }
    read();
    const handle = window.setInterval(read, 500);
    return () => window.clearInterval(handle);
  }, []);

  if (!worldLabel) return null;

  return (
    // Machined brass-fitted nameplate — metal housing, engraved brass kicker,
    // ice-telemetry value on an inset smoked strip (HUD readout).
    <div
      ref={plateSlab.ref}
      data-component="preview-app-world-badge"
      data-app-name-world-id={worldLabel.appNameWorldId}
      className="ds-metal ds-grain ds-edge absolute top-2 right-3 z-40 pointer-events-none flex items-center gap-2 pl-3 pr-1.5 py-1"
      /* position:absolute inline — .ds-metal sets position:relative and
         materials.css loads after the Tailwind utilities. */
      style={{ borderRadius: 'var(--ds-r-pill)', position: 'absolute' }}
    >
      <span
        className="ds-kicker"
        style={{ color: 'var(--ds-brass-300)', textShadow: '0 1px 0 rgba(0,0,0,0.7)' }}
      >
        World
      </span>
      <span
        ref={stripSlab.ref}
        className="ds-smoked flex items-center px-2.5 py-0.5 text-[12px] font-ui font-medium"
        style={{
          borderRadius: 'var(--ds-r-pill)',
          color: 'var(--ds-ice-200)',
          textShadow: `0 1px 0 rgba(0,0,0,0.6), 0 0 9px ${dsAlpha(DS.ice400, 0.3)}`,
        }}
      >
        {worldLabel.name ?? worldLabel.appNameWorldId}
      </span>
    </div>
  );
}
