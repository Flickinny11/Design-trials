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
  Color,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Texture,
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
  CompiledEnvironmentFog,
  CompiledHubBackgroundLayer,
} from '@/lib/prism-graph/compiled-view';
import type {
  GraphSource,
  PrismHub,
  PrismNode,
  ScenePosition,
} from '@/lib/prism-graph/types';
import {
  hubCameraComposition,
  resolveHubRenderMode,
} from '@/lib/prism-graph/hub-render-mode';
import { applyScrollBindings } from '@/lib/prism-graph/scroll-timeline';

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
   *  'preview-app'. Omitted → camera retains its default unconstrained pose
   *  (used by canvas editor surface that needs free orbiting). */
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

  /** EB-07-03 / §7 SC-038 / INV-23 — install/clear scene-wide linear fog
   *  used to fill blank scene edges as the camera pans within the rail. Pass
   *  `null` to clear. Idempotent: a follow-up call mutates the live `Fog`
   *  object's color/near/far in place rather than allocating a new one, so
   *  callers can re-invoke per hub/preview rebuild without leaking. */
  setEnvironmentFog(fog: CompiledEnvironmentFog | null): void;

  /** EB-07-04 / §7 SC-039 / SC-040 — drive scrollProgress (0..1) into the
   *  per-node scrollBinding consumer. Only nodes that declare a non-empty
   *  `scrollBinding[]` are touched; nodes without a binding never move. The
   *  camera and scene root are never modified by this call (SC-040: scrolling
   *  reads as app UI / per-element response, not whole-scene movement). */
  setScrollProgress(progress: number): void;

  /** W-2D — apply the given hub's `renderMode` composition to the runtime
   *  camera: '3d' restores the mount's base fov/distance; '2d' drops to the
   *  telephoto flat composition with framing-preserving distance (renderer
   *  CONFIG on the SAME PerspectiveCamera — see hub-render-mode.ts). With
   *  `animate` (default) the change tweens over ~650ms so 2d↔3d hub
   *  transitions stay smooth; without it (or with no renderer) it snaps.
   *  Applied automatically for the entry hub at mount and on every
   *  `hubManager.activate()` through this result. No-op when the caller owns
   *  the camera (injected `sceneRoot`) or installed a `cameraRail`. */
  applyHubComposition(hubId: string, animate?: boolean): void;
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
  // W-2D — the fov the geometry was sized for, so a composition fov change
  // (2d flat ↔ 3d) can re-cover the frustum by scaling instead of rebuilding.
  mesh.userData.builtFov = camera.fov;
  // Read `mesh.geometry` at cleanup time so a post-resize geometry swap
  // (see `resize()`) doesn't strand the live PlaneGeometry. The material is
  // not swapped on resize, so closing over `mat` is safe.
  mesh.userData.cleanup = () => {
    mesh.geometry.dispose();
    mat.dispose();
  };
  return mesh;
}

// EB-07-02 / §7 SC-036 — per-attachment-mode mesh builders.
//
// `camera-locked` is parented to the camera (like viewport-fixed) but is sized
// in world units around the layer's z and is intended for HUD-style backdrops
// that follow the camera rigidly. `world` is a fixed-size plane in scene-world
// space at the layer's z. `parallax` is a world-space plane that the per-frame
// driver translates at (1 - parallaxDepth) of camera Y. `infinite-environment`
// is rendered as `scene.background` (Three handles the projection — equirect
// or cubemap depending on the texture's mapping).

const SCENE_PLANE_SIZE = 2048; // World-space plane size for world/parallax
                                // backdrops; large enough to cover the
                                // editor's typical viewport at z=0.

function buildSceneSpaceMesh(
  layer: CompiledHubBackgroundLayer,
  role: 'world-background' | 'parallax-background',
): Mesh {
  const geo = new PlaneGeometry(SCENE_PLANE_SIZE, SCENE_PLANE_SIZE);
  const mat = new MeshBasicMaterial({
    transparent: layer.opacity < 1,
    opacity: layer.opacity,
    depthWrite: false,
  });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(0, 0, layer.z);
  // Render before nodes so node geometry composites on top.
  mesh.renderOrder = -1000 + layer.z * 0.001;
  mesh.userData.role = role;
  mesh.userData.layerId = layer.id;
  if (role === 'parallax-background') {
    mesh.userData.parallaxDepth = typeof layer.parallaxDepth === 'number'
      ? layer.parallaxDepth
      : 0.5;
  }
  mesh.userData.cleanup = () => {
    mesh.geometry.dispose();
    mat.dispose();
  };
  return mesh;
}

const CAMERA_LOCKED_LOCAL_Z = -800;
// EB-07-03 — overscan multiplier for camera-locked planes; matches the
// viewport-fixed overscan so a small camera roll never reveals an edge.
const CAMERA_LOCKED_OVERSCAN = 1.05;

// EB-07-03 / §7 SC-038 — size a camera-locked plane to cover the camera
// frustum at its local-z. Same math as `sizeViewportFixedPlane` but parametric
// over the layer's z so HUDs that sit closer or farther than the
// viewport-fixed slot still scale-to-cover.
function sizeCameraLockedPlane(
  camera: { fov: number; aspect: number },
  localZ: number,
): { width: number; height: number } {
  const halfFovRad = (camera.fov * Math.PI) / 360;
  const dist = Math.max(1, Math.abs(localZ));
  const height = 2 * dist * Math.tan(halfFovRad) * CAMERA_LOCKED_OVERSCAN;
  const width = height * camera.aspect;
  return { width, height };
}

function buildCameraLockedMesh(
  layer: CompiledHubBackgroundLayer,
  camera: { fov: number; aspect: number },
): Mesh {
  // `layer.z` is the compiled value (defaults to 0 when the source omits it).
  // A user-set z=0 is a legitimate camera-local position; only treat a
  // missing default-z as "unspecified". The compile path normalizes the
  // distinction by leaving `z` strictly numeric, so we accept any finite
  // value here — including 0. `sizeCameraLockedPlane()` guards the
  // dist=|z|=0 degenerate case via `Math.max(1, ...)` so the plane still
  // gets a finite size.
  const localZ = Number.isFinite(layer.z) ? layer.z : CAMERA_LOCKED_LOCAL_Z;
  const { width, height } = sizeCameraLockedPlane(camera, localZ);
  const geo = new PlaneGeometry(width, height);
  const mat = new MeshBasicMaterial({
    transparent: layer.opacity < 1,
    opacity: layer.opacity,
    depthWrite: false,
  });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(0, 0, localZ);
  mesh.renderOrder = -900;
  mesh.userData.role = 'camera-locked-background';
  mesh.userData.layerId = layer.id;
  // W-2D — sizing fov stamp (see buildViewportFixedMesh).
  mesh.userData.builtFov = camera.fov;
  // EB-07-03: read `mesh.geometry` at cleanup time so a post-resize geometry
  // swap doesn't strand the live PlaneGeometry.
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
  // diffs can identify nodes vs ornamentation. EB-07-04: also attach the
  // node's scrollBinding[] (if any) onto userData so setScrollProgress can
  // walk adapterResult.nodes without re-resolving against the source map.
  const sourceById = new Map<string, PrismNode>();
  for (const node of source.nodes) sourceById.set(node.nodeId, node);
  for (const [nodeId, obj] of adapterResult.nodes) {
    obj.userData.nodeId = nodeId;
    const node = sourceById.get(nodeId);
    if (node?.scrollBinding && node.scrollBinding.length > 0) {
      obj.userData.scrollBinding = node.scrollBinding;
    }
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

  // W-2D — composition-driver state, declared BEFORE the camera-rail install
  // below because composeBeforeRender() (called there) reads it. The driver
  // functions themselves live after the background-layer section; see the
  // "per-hub 2d/3d composition driver" block.
  const baseComposition = {
    fov: sceneRoot.camera.fov,
    distance: sceneRoot.camera.position.z,
  };
  const ownsComposition = opts.sceneRoot == null && opts.cameraRail == null;
  let compositionTween: {
    fromFov: number;
    toFov: number;
    fromZ: number;
    toZ: number;
    start: number | null;
    durMs: number;
  } | null = null;

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
    // beforeRender hook is composed by composeBeforeRender() so the
    // camera rail and background drivers (parallax) coexist on the single
    // hook slot SceneRoot exposes.
    composeBeforeRender();
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
    // EB-07-04 — propagate the new node's scrollBinding[] onto userData so
    // setScrollProgress picks up the latest binding immediately. An empty /
    // missing binding clears the slot.
    if (node.scrollBinding && node.scrollBinding.length > 0) {
      obj.userData.scrollBinding = node.scrollBinding;
    } else {
      delete obj.userData.scrollBinding;
    }
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
      // W-2D — geometry now matches the live fov; reset the scale-refit.
      viewportFixedMesh.userData.builtFov = sceneRoot.camera.fov;
      viewportFixedMesh.scale.set(1, 1, 1);
    }
    // EB-07-03 — same scale-to-cover treatment for camera-locked HUD planes.
    if (cameraLockedMesh) {
      const localZ = cameraLockedMesh.position.z;
      const { width, height } = sizeCameraLockedPlane(
        { fov: sceneRoot.camera.fov, aspect: sceneRoot.camera.aspect },
        localZ,
      );
      const oldGeo = cameraLockedMesh.geometry;
      cameraLockedMesh.geometry = new PlaneGeometry(width, height);
      oldGeo.dispose();
      // W-2D — geometry now matches the live fov; reset the scale-refit.
      cameraLockedMesh.userData.builtFov = sceneRoot.camera.fov;
      cameraLockedMesh.scale.set(1, 1, 1);
    }
  }

  // EB-06-06 / EB-07-02 (§6 SC-033 + §7 SC-036) — install the compiled
  // background layer stack on the live mount. Each attachment mode mounts
  // to a different host:
  //   - viewport-fixed       → camera child, sized to the camera frustum
  //   - camera-locked        → camera child, fixed local-z (HUD)
  //   - parallax             → scene child, ticked per-frame at reduced rate
  //   - world                → scene child, static
  //   - infinite-environment → scene.background texture (Three projects it)
  // Multiple non-fixed layers are all rendered; only the FIRST viewport-fixed
  // layer is honored (SC-033 first-layer semantics).
  let viewportFixedMesh: Mesh | null = null;
  let cameraLockedMesh: Mesh | null = null;
  const parallaxMeshes: Mesh[] = [];
  const worldMeshes: Mesh[] = [];
  let environmentApplied = false;
  // EB-07-02: bumped on every setBackgroundLayers() and on unmount() so a
  // stale `infinite-environment` texture load can't overwrite a newer stack.
  let backgroundGeneration = 0;

  function disposeBackgroundMesh(mesh: Mesh): void {
    if (mesh.parent) mesh.parent.remove(mesh);
    const cleanup = (mesh.userData as { cleanup?: () => void }).cleanup;
    if (typeof cleanup === 'function') {
      try { cleanup(); } catch { /* ignore */ }
    }
  }

  function clearViewportFixedMesh(): void {
    if (!viewportFixedMesh) return;
    const mesh = viewportFixedMesh;
    viewportFixedMesh = null;
    disposeBackgroundMesh(mesh);
  }

  function clearCameraLockedMesh(): void {
    if (!cameraLockedMesh) return;
    const mesh = cameraLockedMesh;
    cameraLockedMesh = null;
    disposeBackgroundMesh(mesh);
  }

  function clearParallaxMeshes(): void {
    while (parallaxMeshes.length > 0) {
      const m = parallaxMeshes.pop()!;
      disposeBackgroundMesh(m);
    }
  }

  function clearWorldMeshes(): void {
    while (worldMeshes.length > 0) {
      const m = worldMeshes.pop()!;
      disposeBackgroundMesh(m);
    }
  }

  function clearEnvironment(): void {
    if (!environmentApplied) return;
    // The texture is loader-cached; only drop the scene's reference. The
    // loader owns disposal.
    sceneRoot.scene.background = null;
    environmentApplied = false;
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
    clearCameraLockedMesh();
    clearParallaxMeshes();
    clearWorldMeshes();
    clearEnvironment();
    backgroundGeneration += 1;
    const gen = backgroundGeneration;
    if (!layers || layers.length === 0) {
      composeBeforeRender();
      return;
    }
    ensureCameraInScene();

    // Per-mode multiplicity convention (not pinned by SC-036, derived here):
    //   viewport-fixed       — FIRST layer wins (SC-033 explicit).
    //   camera-locked        — FIRST layer wins (HUD-style; only one HUD slot).
    //   parallax             — ALL layers mount (each at its own depth).
    //   world                — ALL layers mount (each at its own z).
    //   infinite-environment — LAST layer wins (scene.background is a single
    //                          slot; later layers logically composite over).
    // Subsequent fixed/camera-locked layers are intentionally dropped at this
    // phase; future SC-036 extensions can lift the cap by stacking planes.

    // viewport-fixed — first-layer semantics per SC-033.
    const fixed = layers.find((l) => l.attachment === 'viewport-fixed');
    if (fixed) {
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

    // camera-locked — first-layer semantics; HUD-style backdrop.
    const cameraLocked = layers.find((l) => l.attachment === 'camera-locked');
    if (cameraLocked) {
      const mesh = buildCameraLockedMesh(cameraLocked, {
        fov: sceneRoot.camera.fov,
        aspect: sceneRoot.camera.aspect,
      });
      sceneRoot.camera.add(mesh);
      cameraLockedMesh = mesh;
      if (cameraLocked.sourceUrl) {
        void applyMockupTexture(mesh, cameraLocked.sourceUrl, ctx);
      }
    }

    // parallax / world — all layers mount; each gets its own scene child.
    for (const layer of layers) {
      if (layer.attachment === 'parallax') {
        const mesh = buildSceneSpaceMesh(layer, 'parallax-background');
        sceneRoot.scene.add(mesh);
        parallaxMeshes.push(mesh);
        if (layer.sourceUrl) {
          void applyMockupTexture(mesh, layer.sourceUrl, ctx);
        }
      } else if (layer.attachment === 'world') {
        const mesh = buildSceneSpaceMesh(layer, 'world-background');
        sceneRoot.scene.add(mesh);
        worldMeshes.push(mesh);
        if (layer.sourceUrl) {
          void applyMockupTexture(mesh, layer.sourceUrl, ctx);
        }
      }
    }

    // infinite-environment — last one wins; installs scene.background.
    // The generation token gates the async assignment so a stale load can't
    // overwrite a newer setBackgroundLayers() / unmount().
    const env = [...layers].reverse().find((l) => l.attachment === 'infinite-environment');
    if (env && env.sourceUrl) {
      const url = env.sourceUrl;
      void (async () => {
        try {
          const tex = await ctx.textureLoader.loadTexture(url);
          if (gen !== backgroundGeneration) return;
          sceneRoot.scene.background = tex as Texture;
          environmentApplied = true;
        } catch { /* best-effort; leave background null */ }
      })();
    }

    composeBeforeRender();
  }

  function tickBackgroundDrivers(): void {
    if (parallaxMeshes.length === 0) return;
    const cam = sceneRoot.camera;
    // World-space delta. Parallax mirrors the camera's Y at `(1 - depth)`:
    // depth=0 follows camera 1:1 (foreground), depth=1 stays still (infinite).
    for (const mesh of parallaxMeshes) {
      const depth = typeof (mesh.userData as { parallaxDepth?: number }).parallaxDepth === 'number'
        ? (mesh.userData as { parallaxDepth: number }).parallaxDepth
        : 0.5;
      const baseZ = mesh.position.z; // built-in z preserved
      const rate = 1 - depth;
      mesh.position.set(cam.position.x * rate, cam.position.y * rate, baseZ);
    }
  }

  // Compose the cameraRail driver tick + tickBackgroundDrivers + the W-2D
  // composition tween into a single beforeRender callback. SceneRoot's
  // setBeforeRender takes one callback; we replace it whenever a driver set
  // changes.
  function composeBeforeRender(): void {
    const hasRail = cameraRailDriver != null;
    const hasParallax = parallaxMeshes.length > 0;
    const hasCompositionTween = compositionTween != null;
    if (!hasRail && !hasParallax && !hasCompositionTween) {
      sceneRoot.setBeforeRender(null);
      return;
    }
    sceneRoot.setBeforeRender(() => {
      if (cameraRailDriver) cameraRailDriver.tick();
      if (parallaxMeshes.length > 0) tickBackgroundDrivers();
      if (compositionTween) tickCompositionTween();
    });
  }

  function setCameraRail(rail: CompiledCameraRail | null): void {
    if (rail == null) {
      if (cameraRailDriver) {
        cameraRailDriver.dispose();
        cameraRailDriver = null;
      }
      composeBeforeRender();
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
    composeBeforeRender();
  }

  function unmount(): void {
    try { sceneRoot.stop(); } catch { /* ignore */ }
    if (cameraRailDriver) {
      cameraRailDriver.dispose();
      cameraRailDriver = null;
    }
    // W-2D — drop any in-flight composition tween with the mount.
    compositionTween = null;
    sceneRoot.setBeforeRender(null);
    // EB-07-02: tear down every background-layer mount type, not just the
    // viewport-fixed slot. When PrismHost owns the SceneRoot we never call
    // sceneRoot.dispose() (line below), so leaks here cross remounts. Bump
    // generation so a still-in-flight env texture load can't overwrite the
    // scene background after we're gone.
    backgroundGeneration += 1;
    clearViewportFixedMesh();
    clearCameraLockedMesh();
    clearParallaxMeshes();
    clearWorldMeshes();
    clearEnvironment();
    // EB-07-03 — drop scene.fog so a remount doesn't inherit a stale band.
    sceneRoot.scene.fog = null;
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

  // EB-07-03 / §7 SC-038 / INV-23 — install/clear scene-wide linear fog.
  // Mutates an existing Fog object in place when present so a per-hub re-
  // wire doesn't allocate every frame; `null` clears `scene.fog`.
  function setEnvironmentFog(fog: CompiledEnvironmentFog | null): void {
    if (fog == null) {
      sceneRoot.scene.fog = null;
      return;
    }
    const existing = sceneRoot.scene.fog;
    if (existing && (existing as Fog).isFog) {
      const f = existing as Fog;
      f.color.setHex(fog.color);
      f.near = fog.near;
      f.far = fog.far;
      return;
    }
    sceneRoot.scene.fog = new Fog(new Color(fog.color), fog.near, fog.far);
  }

  // EB-07-04 / §7 SC-039 / SC-040 — per-node scrollBinding consumer.
  //
  // Walks adapterResult.nodes, picks out those with a `scrollBinding[]`
  // attached at mount/upsert time, and applies the binding via the pure
  // `applyScrollBindings(obj, bindings, progress)`. Never touches
  // sceneRoot.camera or sceneRoot.scene (SC-040 — scrolling is per-element
  // app UI, not whole-scene movement).
  function setScrollProgress(progress: number): void {
    for (const obj of adapterResult.nodes.values()) {
      const bindings = (obj.userData as { scrollBinding?: PrismNode['scrollBinding'] })
        .scrollBinding;
      if (!bindings || bindings.length === 0) continue;
      applyScrollBindings(obj, bindings, progress);
    }
  }

  // ── W-2D — per-hub 2d/3d composition driver ────────────────────────────────
  //
  // Renderer CONFIG, not an engine rewrite (I-ENGINE): the SAME
  // PerspectiveCamera drops to the telephoto flat composition for a '2d' hub
  // (framing-preserving distance; hub-render-mode.ts) and restores the base
  // for '3d'. Camera-attached background planes are re-covered by scale (the
  // builtFov stamp) so a fov change never exposes an edge. Fov + distance
  // tween over ~650ms so 2d↔3d hub transitions stay smooth in preview.
  //
  // Ownership: skipped entirely when the caller injected its own sceneRoot
  // (the editor's shared scene owns its camera via SceneControlsBridge) or
  // installed a cameraRail (the rail is the sole camera authority, SC-032).
  // State (baseComposition / ownsComposition / compositionTween) is declared
  // above the camera-rail install.
  function refitCameraPlaneScales(): void {
    const fov = sceneRoot.camera.fov;
    for (const mesh of [viewportFixedMesh, cameraLockedMesh]) {
      if (!mesh) continue;
      const built = (mesh.userData as { builtFov?: number }).builtFov;
      if (typeof built !== 'number' || built <= 0) continue;
      const k = Math.tan((fov * Math.PI) / 360) / Math.tan((built * Math.PI) / 360);
      mesh.scale.set(k, k, 1);
    }
  }

  function applyCompositionNow(fov: number, z: number): void {
    const cam = sceneRoot.camera;
    cam.fov = fov;
    cam.position.z = z;
    cam.updateProjectionMatrix();
    refitCameraPlaneScales();
  }

  function tickCompositionTween(): void {
    const tween = compositionTween;
    if (!tween) return;
    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : null;
    if (now == null) {
      // No monotonic clock (bare test env) — snap to the target.
      applyCompositionNow(tween.toFov, tween.toZ);
      compositionTween = null;
      composeBeforeRender();
      return;
    }
    if (tween.start == null) tween.start = now;
    const t = Math.min(1, (now - tween.start) / tween.durMs);
    const e = 1 - Math.pow(1 - t, 3); // cubic ease-out
    applyCompositionNow(
      tween.fromFov + (tween.toFov - tween.fromFov) * e,
      tween.fromZ + (tween.toZ - tween.fromZ) * e,
    );
    if (t >= 1) {
      compositionTween = null;
      composeBeforeRender();
    }
  }

  function applyHubComposition(hubId: string, animate = true): void {
    if (!ownsComposition) return;
    const hub = source.hubs.find((h) => h.hubId === hubId);
    const target = hubCameraComposition(resolveHubRenderMode(hub), baseComposition);
    const cam = sceneRoot.camera;
    const already =
      Math.abs(cam.fov - target.fov) < 0.01 &&
      Math.abs(cam.position.z - target.distance) < 0.01 &&
      compositionTween == null;
    if (already) return;
    if (!animate || !sceneRoot.renderer) {
      compositionTween = null;
      applyCompositionNow(target.fov, target.distance);
      composeBeforeRender();
      return;
    }
    compositionTween = {
      fromFov: cam.fov,
      toFov: target.fov,
      fromZ: cam.position.z,
      toZ: target.distance,
      start: null,
      durMs: 650,
    };
    composeBeforeRender();
  }

  // Land the entry hub in its declared composition (no tween — this is the
  // configured landing view, same idiom as the P1 preview entry snap).
  if (entryHubId) {
    applyHubComposition(entryHubId, false);
  }

  // Route every later activation through the composition driver so a hub
  // navigation between a 3d and a 2d hub tweens the flat/deep composition
  // along with the reparent. The raw manager is untouched (same handle shape).
  const hubManagerWithComposition: HubManagerHandle = {
    ...hubManager,
    activate(hubId: string) {
      hubManager.activate(hubId);
      applyHubComposition(hubId, true);
    },
  };

  return {
    sceneRoot,
    hubManager: hubManagerWithComposition,
    adapterResult,
    hubBackdrops,
    upsertNode,
    removeNode,
    updateNodeTransform,
    setHubMockup,
    setCameraRail,
    setBackgroundLayers,
    tickBackgroundDrivers,
    setEnvironmentFog,
    setScrollProgress,
    applyHubComposition,
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
    JSON.stringify(a.scrollBinding ?? []) === JSON.stringify(b.scrollBinding ?? []) &&
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
