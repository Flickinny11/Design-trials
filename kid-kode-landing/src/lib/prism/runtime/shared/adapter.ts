// Graph-to-Tree adapter — maps a `PrismGraph` (hubs + nodes + edges) into a
// THREE.js scene tree: one `THREE.Group` per hub, with each node's returned
// `Object3D` parented underneath it.
//
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §11 (Bundle Assembly,
// shared/adapter.js: "Now adapts to THREE scene tree") and §8 (createNode
// contract — synchronous, returns Object3D, manager mounts).
//
// The adapter does NOT mount anything on the SceneRoot — it returns hub
// groups and a node lookup. The HubManager activates/deactivates hubs.

import { Group, Object3D } from 'three';
import type {
  GraphSource,
  PrismHub,
  PrismNode,
  ScenePosition,
} from '@/lib/prism-graph/types';
import type { LoaderCacheHandle } from './loaders';
import type { FontAtlasHandle } from './text';
import type { CinematicPrimitivesAPI } from './primitives/types';
import type { NodeDrivers } from './driver-dispatch';

/** Per-node creation context passed to user-supplied `createNode` functions.
 *  Mirrors the spec §8 NodeContext interface; concrete instances are built
 *  by SceneRoot.bootstrap and assembled in T03+.
 *
 *  Spec §8 names these as `THREE.TextureLoader` and `GLTFLoader`; we narrow
 *  to the operations the createNode contract actually exercises (`loadTexture`
 *  / `loadGLB`) so a single underlying `LoaderCacheHandle` instance can back
 *  both fields without leaking the cache surface into nodes. */
export type NodeTextureLoader = Pick<LoaderCacheHandle, 'loadTexture'>;
export type NodeGLBLoader = Pick<LoaderCacheHandle, 'loadGLB'>;
// FIDELITY-2 W3 (audit item 3) — narrowed video lane. The same single
// LoaderCacheHandle backs this field; nodes only see `loadVideo`.
export type NodeVideoLoader = Pick<LoaderCacheHandle, 'loadVideo'>;

export interface NodeContext {
  /** The single, bundled `three` module namespace (RT-SC-02 / INV-R1).
   *  codeRef modules MUST read THREE classes from here (e.g.
   *  `const { Group, Vector3 } = ctx.THREE`) instead of `import … from 'three'`
   *  / `'three/webgpu'`. A native `import(url)` of a codeRef module would
   *  otherwise resolve its bare `three` specifier through the browser
   *  import-map → a SECOND `three` instance from a CDN, which is the
   *  multiple-instances crash this field exists to prevent. */
  THREE: typeof import('three');
  /** Texture loader keyed by URL. Same URL yields the same `Promise<Texture>`. */
  textureLoader: NodeTextureLoader;
  /** GLB loader keyed by URL. Same URL yields the same `Promise<GLTF>`. */
  glbLoader: NodeGLBLoader;
  /** FIDELITY-2 W3 (INV-18 additive) — video-texture loader keyed by URL.
   *  Same URL yields the same `Promise<VideoTexture>`. OPTIONAL: legacy /
   *  test contexts omit it and `videoUrl` nodes simply keep their still-image
   *  texture (graceful degradation, no behavior change for existing graphs). */
  videoLoader?: NodeVideoLoader;
  /** MSDF font atlas. Throws on createText() until ready. */
  fontAtlas: FontAtlasHandle;
  /** Cinematic primitives library, curried with the runtime
   *  `PrimitiveContext`. Node code calls
   *  `ctx.primitives[name](target, params)`; the runtime supplies the
   *  third `PrimitiveContext` argument behind the scenes. See
   *  `./primitives/index.ts::makePrimitivesAPI`. */
  primitives: CinematicPrimitivesAPI;
  /** Event bus for navigation / state transitions. */
  emit: (event: string, payload: unknown) => void;
  /** STEP7 — driver wiring surface. Present only when the context runs
   *  primitives (the built-state surface). The factory calls
   *  `drivers.attach(result, ref.trigger, { nodeId })` per cinematic primitive
   *  so each node-declared animation plays under its declared driver
   *  (ScrollDriver / PointerDriver / StateDriver / EventDriver). Absent on the
   *  no-op editor context (runPrimitives:false) and the legacy bundle path. */
  drivers?: NodeDrivers;
}

/** A `createNode` factory satisfying the spec §8 contract. The adapter
 *  invokes one of these per `PrismNode`. T01 stubs may pass a placeholder
 *  factory; T03+ wires up the codegen-emitted modules. */
export type CreateNodeFn = (
  config: PrismNode,
  ctx: NodeContext,
) => Object3D;

export interface AdapterResult {
  /** One `THREE.Group` per hub, keyed by `hubId`. Not yet parented under
   *  any scene — the HubManager handles mounting. */
  hubs: Map<string, Group>;
  /** Every node's returned `Object3D`, keyed by `nodeId`. */
  nodes: Map<string, Object3D>;
  /** Convenience: hubs in graph-declaration order. */
  hubOrder: PrismHub[];
}

export interface AdapterOptions {
  /** Custom factory for creating each node. Defaults to a placeholder Group
   *  with the node's scenePosition applied — useful for tests and for
   *  bootstrapping before T03 lands the real codegen-emitted modules. */
  createNode?: CreateNodeFn;
}

/** Apply a `ScenePosition` to an `Object3D`. Exported for direct use. */
export function applyScenePosition(
  obj: Object3D,
  pos: ScenePosition | undefined,
): void {
  if (!pos) return;
  obj.position.set(pos.x, pos.y, pos.z);
  obj.rotation.set(pos.rotationX, pos.rotationY, pos.rotationZ);
  obj.scale.set(pos.scaleX, pos.scaleY, pos.scaleZ);
}

/** Default factory: returns a labelled empty Group. Useful for tests and as
 *  the bootstrap path before codegen-emitted modules land in T03+. The
 *  returned object satisfies the spec §8 cleanup contract surface (no-op
 *  cleanup) so anything that walks `userData.cleanup()` (HubManager,
 *  disposeHubGroup) sees a callable, not undefined. */
const defaultCreateNode: CreateNodeFn = (config) => {
  const g = new Group();
  g.name = `node:${config.nodeId}`;
  g.userData.cleanup = () => {};
  g.userData.handlers = {};
  return g;
};

export function adaptGraphToScene(
  graph: GraphSource,
  ctx: NodeContext,
  options: AdapterOptions = {},
): AdapterResult {
  const factory = options.createNode ?? defaultCreateNode;

  const hubs = new Map<string, Group>();
  const nodes = new Map<string, Object3D>();

  for (const hub of graph.hubs) {
    const g = new Group();
    g.name = `hub:${hub.hubId}`;
    hubs.set(hub.hubId, g);
  }

  for (const node of graph.nodes) {
    const hubGroup = hubs.get(node.parentHubId);
    if (!hubGroup) {
      // Spec §11 maps nodes via parent hub; orphans are skipped (an upstream
      // verifier flags this as a graph-validity issue).
      continue;
    }
    const obj = factory(node, ctx);
    applyScenePosition(obj, node.scenePosition);
    hubGroup.add(obj);
    nodes.set(node.nodeId, obj);
  }

  return { hubs, nodes, hubOrder: [...graph.hubs] };
}
