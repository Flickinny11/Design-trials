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

import type { Group, Object3D } from 'three';
import type {
  GraphSource,
  PrismHub,
  PrismNode,
  ScenePosition,
} from '@/lib/prism-graph/types';
import type { CinematicPrimitiveRef } from '@/lib/prism-graph/cinematic-primitives';

/** Per-node creation context passed to user-supplied `createNode` functions.
 *  Mirrors the spec §8 NodeContext interface; concrete instances are built
 *  by SceneRoot.bootstrap and assembled in T03+. */
export interface NodeContext {
  textureLoader: import('./loaders').LoaderCacheHandle['loadTexture'] extends (
    url: string,
  ) => Promise<infer _T>
    ? import('./loaders').LoaderCacheHandle
    : import('./loaders').LoaderCacheHandle;
  glbLoader: import('./loaders').LoaderCacheHandle;
  fontAtlas: import('./text').FontAtlasHandle;
  /** Cinematic primitives library lookup. Filled in T03; placeholder
   *  shape here keeps the adapter independent of T03 progress. */
  primitives: Record<
    CinematicPrimitiveRef['name'],
    (target: Object3D, params: CinematicPrimitiveRef['params']) => unknown
  >;
  /** Event bus for navigation / state transitions. */
  emit: (event: string, payload: unknown) => void;
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

export function adaptGraphToScene(
  _graph: GraphSource,
  _ctx: NodeContext,
  _options?: AdapterOptions,
): AdapterResult {
  throw new Error('adaptGraphToScene: not implemented (T02)');
}
