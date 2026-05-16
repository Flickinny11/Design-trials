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
import {
  createCameraRailDriver,
  type CameraRailDriverHandle,
} from './camera-rail-driver';
import type {
  CompiledCameraRail,
  CompiledHubBackgroundLayer,
} from '@/lib/prism-graph/compiled-view';
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
  /** EB-06-05 (SC-032 / INV-23): when provided, install the camera-rail
   *  driver on the scene root so the inner runtime camera is constrained to
   *  the damped cinematic rail every frame. PrismHost passes this from a
   *  fresh `compileHubToPreview` of the active hub when viewMode ===
   *  'preview-hub'. Omitted → camera retains its default unconstrained pose
   *  (used by hub-world / canvas editor surfaces that need free orbiting). */
  cameraRail?: CompiledCameraRail;
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

  /** Hot-swap the cinematic rail (e.g. hub change in preview-hub). Pass
   *  `null` to detach the driver entirely. No-op if a rail was never
   *  installed and `null` is passed. */
  setCameraRail(rail: CompiledCameraRail | null): void;

  /** EB-06-06 / §6 SC-033 — install the compiled background layer stack.
   *  The first layer with `attachment: 'viewport-fixed'` is parented to
   *  `sceneRoot.camera` so it stays fixed to the viewport during scroll.
   *  Non-`viewport-fixed` layers are respected per attachment mode (Phase 7
   *  SC-036 expands the renderer's vocabulary; for now only viewport-fixed
   *  is rendered through this surface). Pass `null` or `[]` to remove. */
  setBackgroundLayers(
    layers: readonly CompiledHubBackgroundLayer[] | null,
  ): void;

  /** EB-07-02 / §7 SC-036 — step the per-frame background drivers (currently
   *  just parallax). The composite beforeRender hook on `sceneRoot` calls
   *  this every frame; tests and editor surfaces that drive their own loop
   *  can invoke it directly. No-op when no drivers are registered. */
  tickBackgroundDrivers(): void;
}

const BACKDROP_Z = -2;

// EB-06-06 / §6 SC-033 — viewport-fixed background sizing.
//
// The plane is parented to `sceneRoot.camera` so it stays glued to the
// viewport during scroll/orbit. We pick a fixed local-z just in front of the
// far plane so it falls behind every node, then size the plane to cover the
// camera's frustum at that depth (`2 * z * tan(fov/2)` for height, scaled by
// aspect for width). When the canvas resizes the camera's aspect updates;
// the plane is resized via the existing `resize()` path below.
//
// `VIEWPORT_FIXED_LOCAL_Z` is negative (in front of the camera in local
// space) and large enough to sit behind every node, well before the camera's
// far plane (5000 in scene-root.ts).
const VIEWPORT_FIXED_LOCAL_Z = -1500;
const VIEWPORT_FIXED_OVERSCAN = 1.05; // small overscan so rotation never
                                       // exposes an edge.

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

// EB-06-06 — size a plane to cover the camera frustum at `localZ`.
function sizeViewportFixedPlane(
  camera: { fov: number; aspect: number },
  localZ: number,
): { width: number; height: number } {
  const halfFovRad = (camera.fov * Math.PI) / 360;
  const dist = Math.abs(localZ);
  const height = 2 * dist * Math.tan(halfFovRad) * VIEWPORT_FIXED_OVERSCAN;
  const width = height * camera.aspect;
  return { width, height };
}

function buildViewportFixedMesh(
  layer: CompiledHubBackgroundLayer,
  camera: { fov: number; aspect: number },
): Mesh {
  const { width, height } = sizeViewportFixedPlane(camera, VIEWPORT_FIXED_LOCAL_Z);
  const geo = new PlaneGeometry(width, height);
  const mat = new MeshBasicMaterial({
    transparent: layer.opacity < 1,
    opacity: layer.opacity,
    depthWrite: false,
  });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(0, 0, VIEWPORT_FIXED_LOCAL_Z);
  // Render before everything else so node geometry composites on top.
  mesh.renderOrder = -1000;
  mesh.userData.role = 'viewport-fixed-background';
  mesh.userData.layerId = layer.id;
  // Read `mesh.geometry` at cleanup time so a post-resize geometry swap
  // (see `resize()`) doesn't strand the live PlaneGeometry. The material is
  // not swapped on resize, so closing over `mat` is safe.
  mesh.userData.cleanup = () => {
    mesh.geometry.dispose();
    mat.dispose();
  };
  return mesh;
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
      (node, factoryCtx) => defaultRenderModeFactory(node, factoryCtx, { runPrimitives: true, nodeMaterials: false }),
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

  // EB-06-05 (SC-032 / INV-23): install the cinematic camera-rail driver on
  // the scene root's beforeRender hook when the caller has compiled a rail.
  // The driver writes a damped pose onto sceneRoot.camera every frame; no
  // orbit/drag controls are wired in this path so the rail is the sole
  // camera authority.
  let cameraRailDriver: CameraRailDriverHandle | null = null;
  if (opts.cameraRail) {
    cameraRailDriver = createCameraRailDriver({
      camera: sceneRoot.camera,
      rail: opts.cameraRail,
    });
    sceneRoot.setBeforeRender(() => cameraRailDriver?.tick());
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
    // EB-06-06 — rebuild viewport-fixed plane geometry against the new
    // aspect so it continues to cover the full viewport.
    if (viewportFixedMesh) {
      const { width, height } = sizeViewportFixedPlane(
        { fov: sceneRoot.camera.fov, aspect: sceneRoot.camera.aspect },
        VIEWPORT_FIXED_LOCAL_Z,
      );
      const oldGeo = viewportFixedMesh.geometry;
      viewportFixedMesh.geometry = new PlaneGeometry(width, height);
      oldGeo.dispose();
    }
  }

  // EB-06-06 (SC-033) — install the compiled background layer stack on the
  // live mount. The first `viewport-fixed` layer is parented to
  // sceneRoot.camera so it stays fixed to the viewport while the camera
  // moves (scroll, rail damping, mode switches). Camera is added to the
  // scene graph so the renderer traverses through it and draws the plane.
  // Non-viewport-fixed layers are no-ops at this phase; Phase 7 (SC-036)
  // expands the renderer's attachment vocabulary.
  let viewportFixedMesh: Mesh | null = null;

  function clearViewportFixedMesh(): void {
    if (!viewportFixedMesh) return;
    const mesh = viewportFixedMesh;
    viewportFixedMesh = null;
    if (mesh.parent) mesh.parent.remove(mesh);
    const cleanup = (mesh.userData as { cleanup?: () => void }).cleanup;
    if (typeof cleanup === 'function') {
      try { cleanup(); } catch { /* ignore */ }
    }
  }

  function ensureCameraInScene(): void {
    let node: Object3D | null = sceneRoot.camera;
    while (node) {
      if (node === sceneRoot.scene) return;
      node = node.parent;
    }
    sceneRoot.scene.add(sceneRoot.camera);
  }

  function setBackgroundLayers(
    layers: readonly CompiledHubBackgroundLayer[] | null,
  ): void {
    clearViewportFixedMesh();
    if (!layers || layers.length === 0) return;
    const fixed = layers.find((l) => l.attachment === 'viewport-fixed');
    if (!fixed) return;

    ensureCameraInScene();
    const mesh = buildViewportFixedMesh(fixed, {
      fov: sceneRoot.camera.fov,
      aspect: sceneRoot.camera.aspect,
    });
    sceneRoot.camera.add(mesh);
    viewportFixedMesh = mesh;
    if (fixed.sourceUrl) {
      void applyMockupTexture(mesh, fixed.sourceUrl, ctx);
    }
  }

  // EB-07-02 stub — real per-frame parallax drivers land in the
  // implementation step. Wiring is in place so MountGraphResult fulfills
  // the interface at the type level.
  function tickBackgroundDrivers(): void {
    // no-op stub; replaced in EB-07-02 implementation
  }

  function setCameraRail(rail: CompiledCameraRail | null): void {
    if (rail == null) {
      if (cameraRailDriver) {
        cameraRailDriver.dispose();
        cameraRailDriver = null;
        sceneRoot.setBeforeRender(null);
      }
      return;
    }
    if (cameraRailDriver) {
      cameraRailDriver.setRail(rail);
      return;
    }
    cameraRailDriver = createCameraRailDriver({
      camera: sceneRoot.camera,
      rail,
    });
    sceneRoot.setBeforeRender(() => cameraRailDriver?.tick());
  }

  function unmount(): void {
    try { sceneRoot.stop(); } catch { /* ignore */ }
    if (cameraRailDriver) {
      sceneRoot.setBeforeRender(null);
      cameraRailDriver.dispose();
      cameraRailDriver = null;
    }
    clearViewportFixedMesh();
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
    setCameraRail,
    setBackgroundLayers,
    tickBackgroundDrivers,
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
