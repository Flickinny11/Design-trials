// Three.js-based runtime mount — replaces the PixiJS boot.ts (Phase 5).
//
// Wires the T01-T04 infrastructure:
//   - SceneRoot (camera + lights + render loop, WebGPU with WebGL2 fallback)
//   - LoaderCache (TextureLoader + GLTFLoader, URL-keyed memoization)
//   - FontAtlas (MSDF + three-msdf-text-webgpu) — opt-in via opts.msdf
//   - HubManager (THREE.Group activate/deactivate)
//   - GraphAdapter (PrismGraph -> THREE scene tree)
//
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §11 (Bundle Assembly) + §12 (Hub
// Manager). The bundle authored by `assembleBundle` (runtime/bundle.ts) is
// the browser-side mirror of this same wiring; this module is the
// editor / integration-host entry point. T07-T09 layer in editor sliders,
// mock-app reconstruction, and per-node code resolution.

import { createSceneRoot, type SceneRootHandle } from './shared/scene-root';
import { createLoaderCache, type LoaderCacheHandle } from './shared/loaders';
import { createFontAtlas, type FontAtlasHandle } from './shared/text';
import { createHubManager, type HubManagerHandle } from './shared/hub-manager';
import {
  adaptGraphToScene,
  type AdapterResult,
  type NodeContext,
} from './shared/adapter';
import { makePrimitivesAPI } from './shared/primitives';
import { loadPrism, type CompiledGraph, type PrismBundle } from '../player/prism-loader';
import {
  RENDER_MODE_DEFAULT,
  SCENE_POSITION_DEFAULT,
  type GraphSource,
  type PrismEdge,
  type PrismHub,
  type PrismNode,
  type PrismIntent,
  type PrismVisual,
} from '@/lib/prism-graph/types';

export interface MountOpts {
  /** Preferred renderer width. */
  width?: number;
  /** Preferred renderer height. */
  height?: number;
  /** Skip the renderer (test / SSR fallback). */
  noRenderer?: boolean;
  /** Optional MSDF atlas to load: { atlasUrl, fontJsonUrl }. When omitted,
   *  fontAtlas is constructed but unloaded — createText() will throw until
   *  load() is called. */
  msdf?: { atlasUrl: string; fontJsonUrl: string };
}

export interface MountResult {
  bundle: PrismBundle;
  graph: CompiledGraph;
  sceneRoot: SceneRootHandle;
  loaders: LoaderCacheHandle;
  fontAtlas: FontAtlasHandle;
  hubManager: HubManagerHandle;
  adapterResult: AdapterResult;
  /** Resize the renderer (forwards to renderer.setSize when available). */
  resize: (width: number, height: number) => void;
  unmount: () => void;
}

export interface PrismDebugHandle {
  sceneRoot: SceneRootHandle;
  hubManager: HubManagerHandle;
  graph: CompiledGraph;
  adapterResult: AdapterResult;
}

declare global {
  // eslint-disable-next-line no-var
  var __prismRenderer: PrismDebugHandle | undefined;
}

/** Lift a `CompiledGraph` (PixiJS-era manifest shape) onto the renderer-era
 *  `GraphSource`. Each node gains the 5 additive PrismNode fields with
 *  defaults; intent/visualSpec are passed through structurally. The compiled
 *  graph carries no scene data, so legacy graphs render in `sprite` mode at
 *  identity scenePosition. T07-T09 will source PrismNode directly from the
 *  graph editor (post-bundle reform). */
function compiledToGraphSource(graph: CompiledGraph): GraphSource {
  const hubs: PrismHub[] = graph.hubs.map((h) => ({
    hubId: h.hubId,
    title: h.title,
    layout: {
      viewportWidth: h.layout.viewportWidth,
      viewportHeight: h.layout.viewportHeight,
      contentHeight: h.layout.contentHeight,
      backgroundColor: h.layout.backgroundColor,
      // Spec amendment 0002 — legacy CompiledGraph carries no hub mockup URL.
      mockupUrl: null,
    },
  }));
  const nodes: PrismNode[] = graph.nodes.map((n) => ({
    nodeId: n.nodeId,
    subtype: n.subtype,
    parentHubId: n.parentHubId,
    serviceTag: n.serviceTag,
    visual: n.visual as unknown as PrismVisual,
    intent: n.intent as unknown as PrismIntent,
    codeRef: n.codeRef,
    backendRef: n.backendRef ?? null,
    renderMode: RENDER_MODE_DEFAULT,
    depthMapUrl: null,
    meshUrl: null,
    cinematicPrimitives: [],
    scenePosition: { ...SCENE_POSITION_DEFAULT },
  }));
  const edges: PrismEdge[] = graph.edges.map((e) => ({
    from: e.from,
    to: e.to,
    type: e.type,
    event: e.event,
  }));
  return { hubs, nodes, edges };
}

export async function mount(
  canvas: HTMLCanvasElement,
  prismUrl: string,
  opts: MountOpts = {},
): Promise<MountResult> {
  const bundle = await loadPrism(prismUrl);
  const { graph } = bundle;
  const hub = graph.hubs.find((h) => h.hubId === bundle.manifest.entryHub) ?? graph.hubs[0];
  const initialW = Math.max(1, opts.width ?? hub.layout.viewportWidth);
  const initialH = Math.max(1, opts.height ?? hub.layout.viewportHeight);

  const sceneRoot = await createSceneRoot({
    canvas,
    size: { width: initialW, height: initialH },
    noRenderer: opts.noRenderer,
  });

  const loaders = createLoaderCache();
  const fontAtlas = createFontAtlas();
  if (opts.msdf) {
    try {
      await fontAtlas.load(opts.msdf.atlasUrl, opts.msdf.fontJsonUrl);
    } catch (e) {
      console.warn('[prism/mount] font atlas load failed:', (e as Error).message);
    }
  }

  // Adapter context. T05 wires the minimum surface; per-node createNode
  // factories land in T07-T09 with the codegen-emitted modules.
  const events = new Map<string, ((p: unknown) => void)[]>();
  const ctx: NodeContext = {
    textureLoader: { loadTexture: loaders.loadTexture },
    glbLoader: { loadGLB: loaders.loadGLB },
    fontAtlas,
    primitives: makePrimitivesAPI({
      scene: sceneRoot.scene,
      camera: sceneRoot.camera,
      renderer: sceneRoot.renderer,
    }),
    emit(event, payload) {
      const handlers = events.get(event);
      if (!handlers) return;
      for (const h of handlers) {
        try { h(payload); } catch (err) { console.error('[prism/mount] handler', event, err); }
      }
    },
  };

  const adapterResult = adaptGraphToScene(compiledToGraphSource(graph), ctx);
  const hubManager = createHubManager(sceneRoot);
  for (const [hubId, group] of adapterResult.hubs) {
    hubManager.register(hubId, group);
  }
  if (hub) hubManager.activate(hub.hubId);
  if (!opts.noRenderer) sceneRoot.start();

  if (typeof globalThis !== 'undefined') {
    globalThis.__prismRenderer = { sceneRoot, hubManager, graph, adapterResult };
  }

  return {
    bundle,
    graph,
    sceneRoot,
    loaders,
    fontAtlas,
    hubManager,
    adapterResult,
    resize(w, h) {
      const ww = Math.max(1, w);
      const hh = Math.max(1, h);
      const renderer = sceneRoot.renderer;
      renderer?.setSize?.(ww, hh);
      sceneRoot.camera.aspect = ww / hh;
      sceneRoot.camera.updateProjectionMatrix();
    },
    unmount() {
      try { sceneRoot.stop(); } catch { /* ignore */ }
      hubManager.dispose();
      fontAtlas.dispose();
      loaders.dispose?.();
      sceneRoot.dispose();
      if (typeof globalThis !== 'undefined') delete globalThis.__prismRenderer;
    },
  };
}

export type { CompiledGraph, PrismBundle } from '../player/prism-loader';
