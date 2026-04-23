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

export interface MountOpts {
  /** Preferred renderer width. If omitted, falls back to hub.layout.viewportWidth. */
  width?: number;
  /** Preferred renderer height. If omitted, falls back to hub.layout.viewportHeight. */
  height?: number;
}

export interface MountResult {
  app: PIXI.Application;
  graph: CompiledGraph;
  bundle: PrismBundle;
  viewport: ScrollViewport;
  atlas: Atlas;
  msdfFont: MsdfFont | null;
  shr: Shr;
  router: HubRouter;
  /** Resize the renderer + rescale the 1920-design to fit the new container. */
  resize: (width: number, height: number) => void;
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
  shr: Shr;
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

export async function mount(canvas: HTMLCanvasElement, prismUrl: string, opts: MountOpts = {}): Promise<MountResult> {
  const bundle = await loadPrism(prismUrl);
  const { graph } = bundle;
  const hub = graph.hubs.find((h) => h.hubId === bundle.manifest.entryHub) ?? graph.hubs[0];

  // Container-aware sizing. The mock app is authored at hub.layout.viewportWidth
  // (1920) but is rendered into whatever pane PrismHost gives us. We scale the
  // content uniformly to fit the container width, then let scroll handle the
  // vertical overflow. Falls back to design size if no opts are provided.
  const designW = hub.layout.viewportWidth;
  const designContentH = hub.layout.contentHeight;
  const initialW = Math.max(1, opts.width ?? designW);
  const initialH = Math.max(1, opts.height ?? hub.layout.viewportHeight);
  let currentScale = initialW / designW;

  const app = new PIXI.Application();
  await app.init({
    canvas,
    width:  initialW,
    height: initialH,
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
    viewportWidth:  initialW,
    viewportHeight: initialH,
    contentHeight:  designContentH * currentScale,
  });
  // Uniform scale so the 1920-wide authored design fits into the container.
  viewport.content.scale.set(currentScale);
  app.stage.addChild(viewport.root);

  // §10.15 — classify breakpoint from the CONTAINER width, not the window.
  // When the preview pane is 691px inside a 1920px window, the mock app is
  // effectively at a narrow breakpoint and its layout should reflect that.
  let currentBreakpoint: BreakpointName = classifyBreakpoint(initialW);

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

  // shr is forward-declared so rebuildNode's closure can consult
  // shr.brokenNodeIds when deciding whether to install the broken
  // pointertap shim. Assigned immediately below by createShr().
  let shr: Shr;

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
      // §10.20 — if SHR has this node marked broken, swap the pointertap
      // handler for a no-op that records failures. The visual layers and
      // non-tap handlers (hover, press) are preserved so the sprite still
      // looks alive — only the intended downstream event fails to fire.
      if (shr && shr.brokenNodeIds.has(nodeId)) {
        const c = instance.container as unknown as { removeAllListeners?: (event: string) => void; on: (event: string, h: () => void) => void };
        c.removeAllListeners?.('pointertap');
        c.on('pointertap', () => { void shr.recordFailure(nodeId); });
      }
      instancesByNode.set(nodeId, instance);
      viewport.content.addChild(instance.container);
      return instance;
    } catch (e) {
      console.error(`[prism/boot] rebuild ${nodeId} failed:`, e);
      return null;
    }
  }

  shr = createShr({
    events, graph, originalSources, rebuildNode,
    instances: instancesByNode,
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
      shr,
    };
  }

  // Resize handler — keeps the renderer, scroll mask, and uniform content
  // scale in sync with the container. `currentBreakpoint` is updated so future
  // calls to `resolveTransform` (and anything that reads __prism.currentBreakpoint)
  // see the new band, though already-mounted nodes keep their materialized
  // positions unless explicitly rebuilt. For the prototype-in-preview-pane case
  // this is sufficient: the layout scales uniformly and reads correctly.
  const resize = (w: number, h: number) => {
    const nextW = Math.max(1, w);
    const nextH = Math.max(1, h);
    currentScale = nextW / designW;
    app.renderer.resize(nextW, nextH);
    viewport.resize(nextW, nextH, designContentH * currentScale);
    viewport.content.scale.set(currentScale);
    const nextBreakpoint = classifyBreakpoint(nextW);
    if (nextBreakpoint !== currentBreakpoint) {
      currentBreakpoint = nextBreakpoint;
      if (typeof window !== 'undefined' && globalThis.__prism) {
        globalThis.__prism.currentBreakpoint = nextBreakpoint;
      }
    }
  };

  return {
    app,
    graph,
    bundle,
    viewport,
    atlas,
    msdfFont,
    shr,
    router,
    resize,
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
