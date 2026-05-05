import { createSceneRoot } from './shared/scene-root.js';
import { createLoaderCache } from './shared/loaders.js';
import { createFontAtlas } from './shared/text.js';
import { createHubManager } from './shared/manager.js';
import { adaptGraphToScene } from './shared/adapter.js';
import { createStateManager } from './shared/state.js';
import { makePrimitivesAPI } from './shared/primitives/index.js';
import graph from './graph.json' with { type: 'json' };

export async function boot({ canvas, width, height, fontAtlas, modules } = {}) {
  const root = await createSceneRoot({ canvas, width, height });
  const loaders = createLoaderCache();
  const state = createStateManager();
  const ctx = {
    scene: root.scene,
    camera: root.camera,
    textureLoader: { loadTexture: loaders.loadTexture },
    glbLoader: { loadGLB: loaders.loadGLB },
    fontAtlas,
    state,
    primitives: null,
    modules,
  };
  ctx.primitives = makePrimitivesAPI(ctx);
  const groups = adaptGraphToScene(graph, ctx);
  const hubManager = createHubManager({ scene: root.scene });
  for (const [hubId, group] of groups) hubManager.register(hubId, group);
  hubManager.activate(graph.hubs[0]?.hubId);
  return {
    sceneRoot: root,
    hubManager,
    loaders,
    resize(w, h) { root.resize(w, h); },
    dispose() { hubManager.deactivate(); loaders.dispose(); root.dispose(); },
  };
}
