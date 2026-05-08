// Live-bind runtime mount — Plan §P7.
//
// `mountFromGraphSource(canvas, source, ctx, opts)` is the editor-driven
// counterpart to `mount(canvas, prismUrl, opts)`: it accepts an in-memory
// `GraphSource` (the shape `useGraphSourceStore` carries), wires up scene
// root + hub manager + adapter, and returns surgical helpers the caller
// can dispatch on store-state changes so authoring edits don't trigger a
// full re-mount.
//
// Spec refs:
//   - PRISM-RENDERER-MIGRATION-SPEC.md §11 (Bundle Assembly).
//   - PRISM-RENDERER-MIGRATION-SPEC.md §12 (Hub Manager).
//   - Amendment 0002 (hub-mockup-background): per-hub backdrop plane at
//     z=-2 derived from `hub.layout.mockupUrl`.
//
// Surgical helpers — each is intentionally narrow so PrismHost's
// subscribe-with-selector diff layer (still in this task) can dispatch
// the minimum work needed:
//   - upsertNode(node)               — add or replace a single node.
//   - removeNode(nodeId)             — unparent + cleanup one node.
//   - updateNodeTransform(id, pos)   — hot-path slider write; identity-
//     stable (no rebuild) so GPU buffers / primitive timelines survive.
//   - setHubMockup(hubId, mockupUrl) — rebuild the backdrop plane.

import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Object3D,
} from 'three';
import {
  adaptGraphToScene,
  applyScenePosition,
  type AdapterResult,
  type CreateNodeFn,
  type NodeContext,
} from './shared/adapter';
import { createHubManager, type HubManagerHandle } from './shared/hub-manager';
import { createSceneRoot, type SceneRootHandle } from './shared/scene-root';
import { defaultRenderModeFactory } from './factories/default-factory';
import { buildPerNodeFactory } from './factories/coderef-factory';
import type {
  GraphSource,
  PrismHub,
  PrismNode,
  ScenePosition,
} from '@/lib/prism-graph/types';

export interface MountGraphOpts {
  width?: number;
  height?: number;
  /** Skip renderer construction (node tests). */
  noRenderer?: boolean;
  /** Inject a renderer factory (used by R3F's async `gl` factory + tests). */
  rendererFactory?: Parameters<typeof createSceneRoot>[0] extends infer P
    ? P extends { rendererFactory?: infer F }
      ? F
      : never
    : never;
  /** Per-node factory. Defaults to the adapter's placeholder Group factory.
   *  HL08/HL09 will plug in defaultRenderModeFactory + codeRef dispatch. */
  createNode?: CreateNodeFn;
  /** Hub to activate first. Defaults to source.hubs[0].hubId. */
  entryHubId?: string;
  /** Pre-existing scene root to mount under (lets PrismHost share the singleton
   *  with editor surfaces via shared-context). When omitted, mountFromGraphSource
   *  constructs a fresh one. */
  sceneRoot?: SceneRootHandle;
}

export interface MountGraphResult {
  sceneRoot: SceneRootHandle;
  hubManager: HubManagerHandle;
  adapterResult: AdapterResult;
  /** Convenience: backdrop mesh per hubId. Same Mesh that lives under the
   *  hub Group (userData.role === 'hub-backdrop'). */
  hubBackdrops: Map<string, Mesh>;

  /** Add or replace a node by nodeId. New nodes are mounted under their
   *  parent hub Group; existing nodes are replaced (old userData.cleanup
   *  fires). Identity-stable for unchanged nodes. */
  upsertNode(node: PrismNode): void;
  /** Remove a node by id: unparent + run userData.cleanup(). */
  removeNode(nodeId: string): void;
  /** Hot-path: update transform on an existing node WITHOUT rebuilding it.
   *  Preserves Object3D identity so GPU resources / primitive timelines
   *  survive the slider drag. */
  updateNodeTransform(nodeId: string, scenePosition: ScenePosition): void;
  /** Replace the hub backdrop. `null` removes any existing backdrop. */
  setHubMockup(hubId: string, mockupUrl: string | null): Promise<void>;

  resize(width: number, height: number): void;
  unmount(): void;
}

const BACKDROP_Z = -2;

function buildBackdropMesh(width: number, height: number): Mesh {
  const geo = new PlaneGeometry(width, height);
  const mat = new MeshBasicMaterial({ transparent: true, opacity: 1 });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(0, 0, BACKDROP_Z);
  mesh.userData.role = 'hub-backdrop';
  // Amendment 0002 §A.2: cleanup disposes geometry and unparents only —
  // texture is owned by the loader cache and outlives this mesh.
  mesh.userData.cleanup = () => {
    geo.dispose();
    mat.dispose();
  };
  return mesh;
}

async function applyMockupTexture(
  mesh: Mesh,
  mockupUrl: string,
  ctx: NodeContext,
): Promise<void> {
  try {
    const tex = await ctx.textureLoader.loadTexture(mockupUrl);
    const mat = mesh.material as MeshBasicMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
  } catch {
    // Best-effort: an unreachable backdrop URL leaves the plane visible
    // with the default material. The backdrop is decorative; failing to
    // load it must not break the hub mount.
  }
}

export async function mountFromGraphSource(
  canvas: HTMLCanvasElement | undefined,
  source: GraphSource,
  ctx: NodeContext,
  opts: MountGraphOpts = {},
): Promise<MountGraphResult> {
  const sceneRoot = opts.sceneRoot ?? await createSceneRoot({
    canvas,
    noRenderer: opts.noRenderer,
    rendererFactory: opts.rendererFactory,
    size:
      opts.width != null && opts.height != null
        ? { width: opts.width, height: opts.height }
        : undefined,
  });

  // §P9 — codeRef dispatch wraps the default render-mode factory. Caller
  // overrides (tests, editor previews) are honored as-is.
  const factory: CreateNodeFn =
    opts.createNode ?? buildPerNodeFactory(
      (node, factoryCtx) => defaultRenderModeFactory(node, factoryCtx, { runPrimitives: true }),
    );

  const adapterResult = adaptGraphToScene(source, ctx, {
    createNode: factory,
  });

  // Tag every node Object3D with its nodeId so backdrop / surgical-helper
  // diffs can identify nodes vs ornamentation.
  for (const [nodeId, obj] of adapterResult.nodes) {
    obj.userData.nodeId = nodeId;
  }

  // Per-hub backdrop plane (Amendment 0002).
  const hubBackdrops = new Map<string, Mesh>();
  for (const hub of source.hubs) {
    const hubGroup = adapterResult.hubs.get(hub.hubId);
    if (!hubGroup) continue;
    const mockupUrl = hub.layout.mockupUrl ?? null;
    if (!mockupUrl) continue;
    const backdrop = buildBackdropMesh(
      hub.layout.viewportWidth,
      hub.layout.viewportHeight,
    );
    hubGroup.add(backdrop);
    hubBackdrops.set(hub.hubId, backdrop);
    void applyMockupTexture(backdrop, mockupUrl, ctx);
  }

  const hubManager = createHubManager(sceneRoot);
  for (const [hubId, group] of adapterResult.hubs) {
    hubManager.register(hubId, group);
  }
  const entryHubId = opts.entryHubId ?? source.hubs[0]?.hubId;
  if (entryHubId && adapterResult.hubs.has(entryHubId)) {
    hubManager.activate(entryHubId);
  }

  if (!opts.noRenderer && opts.sceneRoot == null) {
    sceneRoot.start();
  }

  if (typeof globalThis !== 'undefined') {
    (globalThis as { __prismRenderer?: unknown; __prismBreakNode?: unknown }).__prismRenderer = {
      sceneRoot,
      hubManager,
      adapterResult,
    };
    (globalThis as { __prismBreakNode?: unknown }).__prismBreakNode = (nodeId: string) => {
      const obj = adapterResult.nodes.get(nodeId);
      if (!obj) return;
      obj.userData.prismBroken = true;
      const handlers = (obj.userData.handlers ?? {}) as Record<string, unknown>;
      handlers.onClick = () => {};
      obj.userData.handlers = handlers;
    };
  }

  function getDefaultFactory(): CreateNodeFn {
    return factory;
  }

  function disposeNode(obj: Object3D): void {
    if (obj.parent) obj.parent.remove(obj);
    const cleanup = (obj.userData as { cleanup?: () => void }).cleanup;
    if (typeof cleanup === 'function') {
      try { cleanup(); } catch { /* ignore */ }
    }
  }

  function upsertNode(node: PrismNode): void {
    const factory = getDefaultFactory();
    const hubGroup = adapterResult.hubs.get(node.parentHubId);
    if (!hubGroup) return;
    const existing = adapterResult.nodes.get(node.nodeId);
    if (existing) {
      // Replace path: dispose the old, mount the new. Sibling identity is
      // unaffected because we touch only this nodeId.
      disposeNode(existing);
    }
    const obj = factory(node, ctx);
    obj.userData.nodeId = node.nodeId;
    applyScenePosition(obj, node.scenePosition);
    hubGroup.add(obj);
    adapterResult.nodes.set(node.nodeId, obj);
  }

  function removeNode(nodeId: string): void {
    const existing = adapterResult.nodes.get(nodeId);
    if (!existing) return;
    disposeNode(existing);
    adapterResult.nodes.delete(nodeId);
  }

  function updateNodeTransform(nodeId: string, pos: ScenePosition): void {
    const obj = adapterResult.nodes.get(nodeId);
    if (!obj) return;
    applyScenePosition(obj, pos);
  }

  async function setHubMockup(hubId: string, mockupUrl: string | null): Promise<void> {
    const hubGroup = adapterResult.hubs.get(hubId);
    if (!hubGroup) return;
    const hub = source.hubs.find((h) => h.hubId === hubId);
    const existing = hubBackdrops.get(hubId);
    if (existing) {
      disposeNode(existing);
      hubBackdrops.delete(hubId);
    }
    if (mockupUrl && hub) {
      const backdrop = buildBackdropMesh(
        hub.layout.viewportWidth,
        hub.layout.viewportHeight,
      );
      hubGroup.add(backdrop);
      hubBackdrops.set(hubId, backdrop);
      await applyMockupTexture(backdrop, mockupUrl, ctx);
    }
  }

  function resize(w: number, h: number): void {
    const ww = Math.max(1, w);
    const hh = Math.max(1, h);
    const renderer = sceneRoot.renderer;
    renderer?.setSize?.(ww, hh);
    sceneRoot.camera.aspect = ww / hh;
    sceneRoot.camera.updateProjectionMatrix();
  }

  function unmount(): void {
    try { sceneRoot.stop(); } catch { /* ignore */ }
    for (const backdrop of hubBackdrops.values()) {
      disposeNode(backdrop);
    }
    hubBackdrops.clear();
    hubManager.dispose();
    if (opts.sceneRoot == null) {
      sceneRoot.dispose();
    }
    if (typeof globalThis !== 'undefined') {
      delete (globalThis as { __prismRenderer?: unknown }).__prismRenderer;
      delete (globalThis as { __prismBreakNode?: unknown }).__prismBreakNode;
    }
  }

  return {
    sceneRoot,
    hubManager,
    adapterResult,
    hubBackdrops,
    upsertNode,
    removeNode,
    updateNodeTransform,
    setHubMockup,
    resize,
    unmount,
  };
}

/** Diff a previous and next `GraphSource` and return the surgical operations
 *  needed to bring the previous mount in line with the next. Pure — does
 *  not touch the scene. PrismHost's store subscription dispatches these. */
export interface GraphDiff {
  upsertedNodes: PrismNode[];
  removedNodeIds: string[];
  transformOnlyNodes: { nodeId: string; scenePosition: ScenePosition }[];
  hubMockupChanges: { hubId: string; mockupUrl: string | null }[];
}

function transformsEqual(
  a: ScenePosition | undefined,
  b: ScenePosition | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.x === b.x && a.y === b.y && a.z === b.z &&
    a.rotationX === b.rotationX && a.rotationY === b.rotationY && a.rotationZ === b.rotationZ &&
    a.scaleX === b.scaleX && a.scaleY === b.scaleY && a.scaleZ === b.scaleZ
  );
}

function nodesEqualExceptTransform(a: PrismNode, b: PrismNode): boolean {
  return (
    a.subtype === b.subtype &&
    a.parentHubId === b.parentHubId &&
    a.serviceTag === b.serviceTag &&
    a.codeRef === b.codeRef &&
    a.backendRef === b.backendRef &&
    a.renderMode === b.renderMode &&
    a.depthMapUrl === b.depthMapUrl &&
    a.meshUrl === b.meshUrl &&
    JSON.stringify(a.cinematicPrimitives ?? []) === JSON.stringify(b.cinematicPrimitives ?? []) &&
    JSON.stringify(a.visual ?? null) === JSON.stringify(b.visual ?? null) &&
    JSON.stringify(a.intent ?? null) === JSON.stringify(b.intent ?? null)
  );
}

export function diffGraphSource(prev: GraphSource, next: GraphSource): GraphDiff {
  const prevById = new Map(prev.nodes.map((n) => [n.nodeId, n]));
  const nextById = new Map(next.nodes.map((n) => [n.nodeId, n]));

  const upsertedNodes: PrismNode[] = [];
  const removedNodeIds: string[] = [];
  const transformOnlyNodes: { nodeId: string; scenePosition: ScenePosition }[] = [];

  for (const [nodeId, nextNode] of nextById) {
    const prevNode = prevById.get(nodeId);
    if (!prevNode) {
      upsertedNodes.push(nextNode);
      continue;
    }
    const transformChanged = !transformsEqual(prevNode.scenePosition, nextNode.scenePosition);
    const otherChanged = !nodesEqualExceptTransform(prevNode, nextNode);
    if (otherChanged) {
      upsertedNodes.push(nextNode);
    } else if (transformChanged && nextNode.scenePosition) {
      transformOnlyNodes.push({ nodeId, scenePosition: nextNode.scenePosition });
    }
  }

  for (const [nodeId] of prevById) {
    if (!nextById.has(nodeId)) removedNodeIds.push(nodeId);
  }

  const hubMockupChanges: { hubId: string; mockupUrl: string | null }[] = [];
  const prevHubsById = new Map(prev.hubs.map((h: PrismHub) => [h.hubId, h]));
  for (const hub of next.hubs) {
    const prior = prevHubsById.get(hub.hubId);
    if (!prior || (prior.layout.mockupUrl ?? null) !== (hub.layout.mockupUrl ?? null)) {
      hubMockupChanges.push({ hubId: hub.hubId, mockupUrl: hub.layout.mockupUrl ?? null });
    }
  }

  return { upsertedNodes, removedNodeIds, transformOnlyNodes, hubMockupChanges };
}
