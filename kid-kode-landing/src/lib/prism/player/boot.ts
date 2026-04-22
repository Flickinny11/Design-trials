// Prism Runtime Player — boot orchestrator.
//
// mount(canvas, prismUrl) →
//   1. fetch+unzip .prism
//   2. init PIXI Application on the canvas
//   3. load atlas + MSDF font
//   4. register backend handlers
//   5. instantiate createScrollViewport
//   6. for each node in graph, dynamically import its module + call createNode(ctx)
//   7. attach SHR watchdog + expose window.__prismBreakNode
//   8. return { app, graph, unmount }

import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { loadPrism, type CompiledGraph, type PrismBundle } from './prism-loader';
import { loadAtlas, type Atlas } from './atlas-loader';
import { loadMsdfFont, type MsdfFont } from './msdf-loader';
import { loadNodeModule, type NodeCtx, type NodeInstance } from './module-registry';
import { createScrollViewport, type ScrollViewport } from './scroll-viewport';
import { createEventBus, type EventBus } from './event-bus';
import { createStateManager } from './state-manager';
import { createHubRouter, type HubRoute, type HubRouter } from './hub-router';
import { createLocalBackend } from '../local-backend';
import { createShr, type Shr } from '../shr';
import {
  classifyBreakpoint,
  resolveTransform,
  isVisibleAtBreakpoint,
  type BreakpointName,
  type ResolvableVisual,
} from './breakpoints.mjs';

export interface MountResult {
  app: PIXI.Application;
  graph: CompiledGraph;
  bundle: PrismBundle;
  viewport: ScrollViewport;
  atlas: Atlas;
  msdfFont: MsdfFont | null;
  shr: Shr;
  router: HubRouter;
  unmount: () => void;
}

export interface PrismDebugHandle {
  router: HubRouter;
  viewport: ScrollViewport;
  events: EventBus;
  graph: CompiledGraph;
  nodes: Map<string, NodeInstance>;
  currentBreakpoint: BreakpointName;
  hiddenNodeIds: string[];
}

declare global {
  // eslint-disable-next-line no-var
  var __prismBreakNode: ((nodeId: string) => void) | undefined;
  // eslint-disable-next-line no-var
  var __prism: PrismDebugHandle | undefined;
}

// Section routing table for the home hub. Each entry says "when node X emits
// `navigate`, scroll to Y and light up navbar link Z". Scroll targets are
// resolved from the graph at boot (hero-section-bg, feature-grid-section-bg,
// settings-section-bg, footer-bg) so they track layout edits.
function buildHomeHubRoutes(graph: CompiledGraph): HubRoute[] {
  const yOf = (nodeId: string, fallback: number) => {
    const node = graph.nodes.find((n) => n.nodeId === nodeId);
    return node?.visual?.transform?.y ?? fallback;
  };
  const heroY     = yOf('hero-section-bg',         160);
  const featuresY = yOf('feature-grid-section-bg', 760);
  const settingsY = yOf('settings-section-bg',    1600);
  const footerY   = yOf('footer-bg',              2200);

  return [
    { sourceNodeId: 'navbar-link-home',    scrollY: 0,         sectionId: 'home',     activeNavLinkId: 'navbar-link-home'    },
    { sourceNodeId: 'navbar-link-editor',  scrollY: heroY,     sectionId: 'hero',     activeNavLinkId: 'navbar-link-editor'  },
    { sourceNodeId: 'navbar-link-docs',    scrollY: featuresY, sectionId: 'features', activeNavLinkId: 'navbar-link-docs'    },
    { sourceNodeId: 'navbar-link-pricing', scrollY: settingsY, sectionId: 'settings', activeNavLinkId: 'navbar-link-pricing' },
    { sourceNodeId: 'navbar-logo',         scrollY: 0,         sectionId: 'home',     activeNavLinkId: 'navbar-link-home'    },
    { sourceNodeId: 'footer-logo',         scrollY: 0,         sectionId: 'home',     activeNavLinkId: 'navbar-link-home'    },
    { sourceNodeId: 'footer-link-privacy', scrollY: footerY,   sectionId: 'footer',   activeNavLinkId: null                  },
    { sourceNodeId: 'footer-link-terms',   scrollY: footerY,   sectionId: 'footer',   activeNavLinkId: null                  },
    { sourceNodeId: 'footer-link-contact', scrollY: footerY,   sectionId: 'footer',   activeNavLinkId: null                  },
  ];
}

export async function mount(canvas: HTMLCanvasElement, prismUrl: string): Promise<MountResult> {
  const bundle = await loadPrism(prismUrl);
  const { graph } = bundle;
  const hub = graph.hubs.find((h) => h.hubId === bundle.manifest.entryHub) ?? graph.hubs[0];

  const app = new PIXI.Application();
  await app.init({
    canvas,
    width:  hub.layout.viewportWidth,
    height: hub.layout.viewportHeight,
    backgroundColor: hub.layout.backgroundColor,
    antialias: true,
    resolution: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2),
    autoDensity: true,
  });

  const atlas = await loadAtlas(bundle.atlasAvif, bundle.atlasRegions);
  const msdfFont = bundle.msdfFnt && bundle.msdfPng ? await loadMsdfFont(bundle.msdfFnt, bundle.msdfPng) : null;

  const events = createEventBus();
  const state = createStateManager({ heroCtaClicks: 0, 'notifications-enabled': false, theme: 'dark' });
  const backend = createLocalBackend({ state });

  for (const [name, source] of bundle.backendModules) {
    await backend.registerFromSource(name, source);
  }

  const viewport = createScrollViewport({
    canvas,
    viewportWidth:  hub.layout.viewportWidth,
    viewportHeight: hub.layout.viewportHeight,
    contentHeight:  hub.layout.contentHeight,
  });
  app.stage.addChild(viewport.root);

  // §10.15 — pick the active breakpoint from window.innerWidth (falling back
  // to the hub's design width). Applied once at mount; live resize is out of
  // scope for this iteration.
  const viewportWidth =
    typeof window !== 'undefined' && Number.isFinite(window.innerWidth)
      ? window.innerWidth
      : hub.layout.viewportWidth;
  const currentBreakpoint: BreakpointName = classifyBreakpoint(viewportWidth);

  // Materialize each node, sorted by intent.visual.transform.z so draw order
  // matches author intent. Scoped backend per-node when backendRef is set.
  const instancesByNode = new Map<string, NodeInstance>();
  const hiddenNodeIds: string[] = [];
  const nodesSorted = [...graph.nodes].sort((a, b) => a.visual.transform.z - b.visual.transform.z);

  for (const node of nodesSorted) {
    if (!isVisibleAtBreakpoint(node.visual as ResolvableVisual, currentBreakpoint)) {
      hiddenNodeIds.push(node.nodeId);
      continue;
    }
    try {
      const source = bundle.nodeModules.get(node.codeRef.replace(/^nodes\//, ''));
      if (!source) throw new Error(`missing node module: ${node.codeRef}`);
      const { createNode } = await loadNodeModule(source);
      const effectiveTransform = resolveTransform(node.visual as ResolvableVisual, currentBreakpoint);
      const ctx: NodeCtx = {
        PIXI, gsap,
        atlas,
        region: node.visual.region,
        regions: node.visual.regions,
        overlayRegions: node.visual.overlayRegions,
        frameRegions: node.visual.frameRegions,
        transform: effectiveTransform,
        events,
        state,
        backend: { call: backend.call },
        intent: { ...node.intent, nodeId: node.nodeId },
        msdfFont,
      };
      const instance = createNode(ctx);
      instancesByNode.set(node.nodeId, instance);
      viewport.content.addChild(instance.container);
    } catch (e) {
      console.error(`[prism/boot] node ${node.nodeId} failed:`, e);
    }
  }

  // SHR: capture original sources, wire rebuildNode callback.
  const originalSources = new Map<string, string>();
  for (const node of graph.nodes) {
    const src = bundle.nodeModules.get(node.codeRef.replace(/^nodes\//, ''));
    if (src) originalSources.set(node.nodeId, src);
  }

  async function rebuildNode(nodeId: string): Promise<NodeInstance | null> {
    const node = graph.nodes.find((n) => n.nodeId === nodeId);
    if (!node) return null;
    if (!isVisibleAtBreakpoint(node.visual as ResolvableVisual, currentBreakpoint)) return null;
    const existing = instancesByNode.get(nodeId);
    if (existing) {
      existing.teardown();
      instancesByNode.delete(nodeId);
    }
    const src = originalSources.get(nodeId);
    if (!src) return null;
    try {
      const { createNode } = await loadNodeModule(src);
      const effectiveTransform = resolveTransform(node.visual as ResolvableVisual, currentBreakpoint);
      const ctx: NodeCtx = {
        PIXI, gsap, atlas,
        region: node.visual.region,
        regions: node.visual.regions,
        overlayRegions: node.visual.overlayRegions,
        frameRegions: node.visual.frameRegions,
        transform: effectiveTransform,
        events, state, backend: { call: backend.call },
        intent: { ...node.intent, nodeId: node.nodeId },
        msdfFont,
      };
      const instance = createNode(ctx);
      instancesByNode.set(nodeId, instance);
      viewport.content.addChild(instance.container);
      return instance;
    } catch (e) {
      console.error(`[prism/boot] rebuild ${nodeId} failed:`, e);
      return null;
    }
  }

  const shr = createShr({
    events, graph, originalSources, rebuildNode,
    onRepairIndicator: (nodeId, phase) => {
      console.log(`[prism/shr] ${nodeId}: repair ${phase}`);
    },
  });
  shr.attach();

  // Hub-router — resolves navbar/footer `navigate` events into GSAP scrolls
  // and broadcasts `active-section-changed` for navbar-link nodes to latch
  // their 'active' overlay. Created AFTER node materialization so each
  // navbar-link has already registered its `active-section-changed` listener
  // by the time the router emits its initial state.
  const router = createHubRouter({
    events,
    viewport,
    routes: buildHomeHubRoutes(graph),
    initialSectionId: 'home',
    initialNavLinkId: 'navbar-link-home',
  });

  if (typeof window !== 'undefined') {
    globalThis.__prismBreakNode = (nodeId: string) => shr.breakNode(nodeId);
    globalThis.__prism = {
      router,
      viewport,
      events,
      graph,
      nodes: instancesByNode,
      currentBreakpoint,
      hiddenNodeIds,
    };
  }

  return {
    app,
    graph,
    bundle,
    viewport,
    atlas,
    msdfFont,
    shr,
    router,
    unmount() {
      router.destroy();
      shr.detach();
      for (const i of instancesByNode.values()) i.teardown();
      viewport.destroy();
      atlas.destroy();
      app.destroy(true, { children: true });
      if (typeof window !== 'undefined') {
        delete globalThis.__prismBreakNode;
        delete globalThis.__prism;
      }
    },
  };
}
