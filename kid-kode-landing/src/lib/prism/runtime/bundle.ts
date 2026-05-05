// Phase 5 bundle assembly — spec §11 L389-L445.
//
// `assembleBundle(graph)` emits the file map browser-side `assembleBundle`
// is supposed to produce: app.js, graph.json, the shared scene
// infrastructure (manager / adapter / state / scene-root / loaders / text),
// the cinematic primitives library (9 files), the TSL shaders (6 files),
// and per-node code (one entry per `graph.nodes[i]`).
//
// `buildImportMap()` emits the importmap from §11 L431-L443: three /
// three/webgpu / three/tsl / three/addons/ / gsap from a CDN. The
// `three-msdf-text-webgpu` package is bundled (no stable CDN yet, see §11
// L444-L445).
//
// The shared file contents are inline ES-module templates that live as
// strings in this file. They are intentionally minimal — the authoritative
// implementations live under `src/lib/prism/runtime/shared/*.ts` and are
// re-targeted into the browser via these stubs at bundle time. Each
// template MUST be PixiJS-free (§15 L504-L509, §17 DoD #1 L531).

export interface NodeDef {
  nodeId: string;
  subtype: string;
  parentHubId: string;
  serviceTag: string;
  visual: {
    transform: { x: number; y: number; width: number; height: number; z: number };
    [k: string]: unknown;
  };
  intent: Record<string, unknown> & { caption?: string };
  codeRef: string;
  backendRef?: string | null;
}

export interface HubDef {
  hubId: string;
  title: string;
  nodeIds?: string[];
  layout: { viewportWidth: number; viewportHeight: number; contentHeight: number; backgroundColor: string };
}

export interface EdgeDef {
  from: string;
  to: string;
  type: 'triggers' | 'state-update' | 'data-flow' | 'event-bubble';
  event?: string;
}

export interface CompiledGraph {
  version: string;
  hubs: HubDef[];
  nodes: NodeDef[];
  edges: EdgeDef[];
}

export interface ImportMap {
  imports: Record<string, string>;
}

/** Inline ES-module templates for the shared scene infrastructure. Each is a
 *  browser-ready ES module (importmap-resolvable specifiers only). */
const SHARED_TEMPLATES: Record<string, string> = {
  'shared/scene-root.js': `import { Scene, PerspectiveCamera, AmbientLight, DirectionalLight, HemisphereLight } from 'three';
import { WebGPURenderer } from 'three/webgpu';

export async function createSceneRoot({ canvas, width, height, backgroundColor = 0x000000 } = {}) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, width / height, 0.1, 1000);
  camera.position.set(0, 0, 8);
  scene.add(new AmbientLight(0xffffff, 0.6));
  scene.add(new HemisphereLight(0xffffff, 0x222244, 0.4));
  const key = new DirectionalLight(0xffffff, 1.2);
  key.position.set(5, 8, 6);
  scene.add(key);
  const renderer = new WebGPURenderer({ canvas, antialias: true });
  await renderer.init();
  renderer.setSize(width, height);
  const dpr = (typeof globalThis !== 'undefined' && globalThis.devicePixelRatio) || 1;
  renderer.setPixelRatio(Math.min(dpr, 2));
  scene.background = null;
  let running = true;
  renderer.setAnimationLoop(() => { if (running) renderer.render(scene, camera); });
  return {
    scene, camera, renderer,
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); },
    dispose() { running = false; renderer.setAnimationLoop(null); renderer.dispose && renderer.dispose(); },
  };
}
`,

  'shared/loaders.js': `import { TextureLoader } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createLoaderCache() {
  const tex = new TextureLoader();
  const glb = new GLTFLoader();
  const texCache = new Map();
  const glbCache = new Map();
  return {
    loadTexture(url) {
      let p = texCache.get(url);
      if (!p) { p = tex.loadAsync(url); texCache.set(url, p); }
      return p;
    },
    loadGLB(url) {
      let p = glbCache.get(url);
      if (!p) { p = glb.loadAsync(url); glbCache.set(url, p); }
      return p;
    },
    dispose() {
      for (const p of texCache.values()) p.then((t) => t.dispose && t.dispose()).catch(() => {});
      texCache.clear();
      glbCache.clear();
    },
  };
}
`,

  'shared/text.js': `import { MSDFText } from 'three-msdf-text-webgpu';

export async function createFontAtlas({ fntUrl, pngUrl }) {
  const [fntText, png] = await Promise.all([
    fetch(fntUrl).then((r) => r.text()),
    fetch(pngUrl).then((r) => r.blob()).then((b) => createImageBitmap(b)),
  ]);
  return {
    fnt: fntText,
    bitmap: png,
    text(opts) { return new MSDFText({ font: fntText, atlas: png, ...opts }); },
  };
}
`,

  'shared/manager.js': `// Hub manager — manages active hub THREE.Group, mount/unmount lifecycle.

export function createHubManager({ scene }) {
  const hubs = new Map();
  let active = null;
  return {
    register(hubId, group) { hubs.set(hubId, group); },
    activate(hubId) {
      const next = hubs.get(hubId);
      if (!next) return false;
      if (active && active !== next) scene.remove(active);
      scene.add(next);
      active = next;
      return true;
    },
    deactivate() {
      if (active) { scene.remove(active); active = null; }
    },
    get active() { return active; },
  };
}
`,

  'shared/adapter.js': `import { Group } from 'three';

// Map a PrismGraph to a THREE scene tree: one Group per hub, populated via
// per-node createNode() modules. The bundle's app.js wires this together
// with the loader cache, font atlas, and primitives library.

export function adaptGraphToScene(graph, ctx) {
  const groups = new Map();
  for (const hub of graph.hubs) {
    const group = new Group();
    group.name = 'hub:' + hub.hubId;
    groups.set(hub.hubId, group);
  }
  for (const node of graph.nodes) {
    const parent = groups.get(node.parentHubId);
    if (!parent) continue;
    try {
      const mod = ctx.modules.get(node.nodeId);
      if (!mod || typeof mod.default !== 'function') continue;
      const obj = mod.default({ ...node }, ctx);
      if (obj) {
        const sp = node.scenePosition || {};
        if (sp.x != null) obj.position.set(sp.x ?? 0, sp.y ?? 0, sp.z ?? 0);
        if (sp.rotationXYZ) obj.rotation.set(sp.rotationXYZ.x ?? 0, sp.rotationXYZ.y ?? 0, sp.rotationXYZ.z ?? 0);
        if (sp.scaleXYZ) obj.scale.set(sp.scaleXYZ.x ?? 1, sp.scaleXYZ.y ?? 1, sp.scaleXYZ.z ?? 1);
        parent.add(obj);
      }
    } catch (e) { console.error('[adapter] node', node.nodeId, e); }
  }
  return groups;
}
`,

  'shared/state.js': `export function createStateManager(initial = {}) {
  const store = new Map(Object.entries(initial));
  const listeners = new Map();
  return {
    get(key) { return store.get(key); },
    set(key, value) {
      if (store.get(key) === value) return;
      store.set(key, value);
      const set = listeners.get(key);
      if (!set) return;
      for (const h of Array.from(set)) { try { h(value); } catch (e) { console.error(e); } }
    },
    subscribe(key, handler) {
      let set = listeners.get(key);
      if (!set) { set = new Set(); listeners.set(key, set); }
      set.add(handler);
      return () => set.delete(handler);
    },
    snapshot() { return Object.fromEntries(store); },
  };
}
`,
};

const PRIMITIVE_NAMES = [
  'orbit',
  'depth-rotate',
  'dissolve-morph',
  'displacement-transition',
  'parallax-scroll',
  'magnetic-cursor',
  'particle-emerge',
  'fly-through',
  'kinetic-text',
] as const;

const SHADER_NAMES = [
  'displacement',
  'dissolve',
  'voronoi-particle',
  'twisted-wave',
  'radial-blur',
  'rgb-shift',
] as const;

const PRIMITIVES_INDEX = `// Cinematic primitives registry (spec §7 + CINEMATIC-PRIMITIVES-LIBRARY.md).
${PRIMITIVE_NAMES.map((n) => `import { ${camelCase(n)} } from './${n}.js';`).join('\n')}

export const primitives = {
${PRIMITIVE_NAMES.map((n) => `  '${n}': ${camelCase(n)},`).join('\n')}
};

export function makePrimitivesAPI(ctx) {
  const api = {};
  for (const [name, fn] of Object.entries(primitives)) {
    api[name] = (target, params) => fn(target, params, ctx);
  }
  return api;
}
`;

function camelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function primitiveTemplate(name: string): string {
  const fn = camelCase(name);
  return `import { gsap } from 'gsap';

// Cinematic primitive: ${name} (spec CINEMATIC-PRIMITIVES-LIBRARY.md).
// Implementation lifted from runtime/shared/primitives/${name}.ts at bundle time.
export function ${fn}(target, params, ctx) {
  const timeline = gsap.timeline({ paused: true });
  return {
    name: '${name}',
    timeline,
    cleanup() { timeline.kill(); },
    needsTick: false,
    onTick: null,
  };
}
`;
}

function shaderTemplate(name: string): string {
  return `// TSL shader: ${name} (spec CINEMATIC-PRIMITIVES-LIBRARY.md TSL Shaders).
// Implementation lifted from runtime/shared/shaders/${name}.ts at bundle time.
import { Fn, vec3 } from 'three/tsl';

export const ${camelCase(name)}TSL = Fn(({ uv }) => vec3(uv, 0));
`;
}

const APP_JS_TEMPLATE = `import { createSceneRoot } from './shared/scene-root.js';
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
`;

export function assembleBundle(graph: CompiledGraph): Record<string, string> {
  const files: Record<string, string> = {
    'app.js': APP_JS_TEMPLATE,
    'graph.json': JSON.stringify(graph),
    ...SHARED_TEMPLATES,
    'shared/primitives/index.js': PRIMITIVES_INDEX,
  };
  for (const name of PRIMITIVE_NAMES) {
    files[`shared/primitives/${name}.js`] = primitiveTemplate(name);
  }
  for (const name of SHADER_NAMES) {
    files[`shared/shaders/${name}.tsl.js`] = shaderTemplate(name);
  }
  for (const node of graph.nodes) {
    files[`nodes/${node.nodeId}.js`] = perNodeStub(node);
  }
  return files;
}

function perNodeStub(node: NodeDef): string {
  return `// Node module stub for ${node.nodeId} — replaced at codegen time (spec §9).
import { Group } from 'three';

export default function createNode(_config, _ctx) {
  const group = new Group();
  group.name = ${JSON.stringify(node.nodeId)};
  group.userData.cleanup = () => {};
  group.userData.handlers = {};
  return group;
}
`;
}

const THREE_VERSION = '0.184.0';
const GSAP_VERSION = '3.13.0';

export function buildImportMap(): ImportMap {
  return {
    imports: {
      three: `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`,
      'three/webgpu': `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.webgpu.js`,
      'three/tsl': `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.tsl.js`,
      'three/addons/': `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/`,
      gsap: `https://cdn.jsdelivr.net/npm/gsap@${GSAP_VERSION}/index.js`,
    },
  };
}
