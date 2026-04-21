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
import { createEventBus } from './event-bus';
import { createStateManager } from './state-manager';
import { createLocalBackend } from '../local-backend';
import { createShr, type Shr } from '../shr';

export interface MountResult {
  app: PIXI.Application;
  graph: CompiledGraph;
  bundle: PrismBundle;
  viewport: ScrollViewport;
  atlas: Atlas;
  msdfFont: MsdfFont | null;
  shr: Shr;
  unmount: () => void;
}

declare global {
  // eslint-disable-next-line no-var
  var __prismBreakNode: ((nodeId: string) => void) | undefined;
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

  // Materialize each node, sorted by intent.visual.transform.z so draw order
  // matches author intent. Scoped backend per-node when backendRef is set.
  const instancesByNode = new Map<string, NodeInstance>();
  const nodesSorted = [...graph.nodes].sort((a, b) => a.visual.transform.z - b.visual.transform.z);

  for (const node of nodesSorted) {
    try {
      const source = bundle.nodeModules.get(node.codeRef.replace(/^nodes\//, ''));
      if (!source) throw new Error(`missing node module: ${node.codeRef}`);
      const { createNode } = await loadNodeModule(source);
      const ctx: NodeCtx = {
        PIXI, gsap,
        atlas,
        region: node.visual.region,
        regions: node.visual.regions,
        overlayRegions: node.visual.overlayRegions,
        frameRegions: node.visual.frameRegions,
        transform: node.visual.transform,
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
    const existing = instancesByNode.get(nodeId);
    if (existing) {
      existing.teardown();
      instancesByNode.delete(nodeId);
    }
    const src = originalSources.get(nodeId);
    if (!src) return null;
    try {
      const { createNode } = await loadNodeModule(src);
      const ctx: NodeCtx = {
        PIXI, gsap, atlas,
        region: node.visual.region,
        regions: node.visual.regions,
        overlayRegions: node.visual.overlayRegions,
        frameRegions: node.visual.frameRegions,
        transform: node.visual.transform,
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

  if (typeof window !== 'undefined') {
    globalThis.__prismBreakNode = (nodeId: string) => shr.breakNode(nodeId);
  }

  return {
    app,
    graph,
    bundle,
    viewport,
    atlas,
    msdfFont,
    shr,
    unmount() {
      shr.detach();
      for (const i of instancesByNode.values()) i.teardown();
      viewport.destroy();
      atlas.destroy();
      app.destroy(true, { children: true });
      if (typeof window !== 'undefined') delete globalThis.__prismBreakNode;
    },
  };
}
