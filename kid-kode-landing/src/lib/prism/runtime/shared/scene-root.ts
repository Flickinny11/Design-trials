// SceneRoot — Three.js WebGPU scene + camera + lights + render loop, with
// automatic WebGL2 fallback. Owns the canvas DPR/resize lifecycle.
//
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §11 (Bundle Assembly,
// shared/scene-root.js: "Camera, lights, render loop, post-FX") and §12
// (Hub Manager: hub groups added to sceneRoot via Object3D.add()).
//
// The renderer is constructed via importing from `three/webgpu`, which gives
// "zero-config WebGPU initialization with automatic WebGL2 fallback on
// unsupported browsers" (Invariant 11). For test environments, callers can
// pass `noRenderer: true` or supply a `rendererFactory` to inject a stub.

import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  type Object3D,
} from 'three';

export type RendererBackend = 'webgpu' | 'webgl2' | 'stub' | null;

/** Minimal renderer surface SceneRoot needs. Both `WebGPURenderer` (from
 *  `three/webgpu`) and the test stubs satisfy this. */
export interface SceneRootRenderer {
  domElement?: HTMLCanvasElement;
  setPixelRatio?(ratio: number): void;
  setSize?(width: number, height: number): void;
  setAnimationLoop?(cb: (() => void) | null): void;
  renderAsync?(scene: Scene, camera: PerspectiveCamera): Promise<void> | Promise<unknown> | void;
  render?(scene: Scene, camera: PerspectiveCamera): void;
  init?(): Promise<void> | Promise<unknown>;
  dispose?(): void;
  /** Optional self-reported backend, used for diagnostics in editor + tests. */
  backend?: 'webgpu' | 'webgl2' | 'stub';
}

export interface CreateSceneRootOptions {
  /** Pre-existing canvas to render into. Optional in tests. */
  canvas?: HTMLCanvasElement;
  /** Inject a renderer factory (used for editor's R3F async `gl` factory and
   *  for tests). When omitted in a browser, SceneRoot constructs a
   *  `WebGPURenderer` from `three/webgpu`. */
  rendererFactory?: (canvas?: HTMLCanvasElement) => Promise<SceneRootRenderer>;
  /** Skip renderer construction entirely (node tests). The scene/camera/lights
   *  are still built so adapter and hub-manager tests work. */
  noRenderer?: boolean;
  /** Override default DPR clamp. Defaults to `window.devicePixelRatio`,
   *  clamped to 2 for perf, when running in a browser. */
  pixelRatio?: number;
  /** Initial canvas size in CSS pixels. Defaults to 800x600 in tests. */
  size?: { width: number; height: number };
}

export interface SceneRootHandle {
  /** Root THREE.Scene. Hub groups are added/removed here. */
  readonly scene: Scene;
  /** Default PerspectiveCamera positioned for the mock-app pipeline. */
  readonly camera: PerspectiveCamera;
  /** Constructed renderer (or `null` when `noRenderer: true`). */
  readonly renderer: SceneRootRenderer | null;

  /** Mount a hub group under the scene (`scene.add(hubGroup)`). */
  addHub(hubGroup: Object3D): void;
  /** Unmount a hub group (`scene.remove(hubGroup)`). */
  removeHub(hubGroup: Object3D): void;

  /** Begin the render loop (uses `setAnimationLoop` when available). */
  start(): void;
  /** Stop the render loop. */
  stop(): void;
  /** Manually drive one frame. Used by tests to avoid rAF in node. */
  tick(): Promise<void>;

  /** Dispose renderer + clear scene + drop references. */
  dispose(): void;

  /** Register a callback invoked once per frame BEFORE the renderer draws.
   *  Used by the EB-06-05 camera-rail driver (SC-032 / INV-23) to apply
   *  the damped pose to the camera before each render. Pass `null` to
   *  clear. Only one callback at a time — replaces any prior. */
  setBeforeRender(cb: (() => void) | null): void;

  /** 'webgpu' | 'webgl2' | 'stub' | null. Read after construction. */
  getRendererBackend(): RendererBackend;
}

const DEFAULT_SIZE = { width: 800, height: 600 };

function pickPixelRatio(override?: number): number {
  if (typeof override === 'number') return override;
  // window.devicePixelRatio is the single allowed window.* exception.
  if (typeof globalThis !== 'undefined' && typeof (globalThis as { window?: Window }).window !== 'undefined') {
    const dpr = (globalThis as { window?: Window }).window?.devicePixelRatio;
    if (typeof dpr === 'number' && Number.isFinite(dpr)) {
      return Math.min(2, Math.max(1, dpr));
    }
  }
  return 1;
}

/** Construct the default WebGPU renderer from `three/webgpu`. Lazy-imported so
 *  test environments can opt out via `noRenderer: true`. */
async function defaultRendererFactory(canvas?: HTMLCanvasElement): Promise<SceneRootRenderer> {
  const mod = (await import('three/webgpu')) as unknown as {
    WebGPURenderer: new (params: { canvas?: HTMLCanvasElement; antialias?: boolean }) => SceneRootRenderer;
  };
  const renderer = new mod.WebGPURenderer({ canvas, antialias: true });
  if (typeof renderer.init === 'function') {
    await renderer.init();
  }
  return renderer;
}

function detectBackend(renderer: SceneRootRenderer | null): RendererBackend {
  if (!renderer) return null;
  if (renderer.backend === 'webgpu' || renderer.backend === 'webgl2' || renderer.backend === 'stub') {
    return renderer.backend;
  }
  // Three's WebGPURenderer exposes `.backend.isWebGPUBackend` after init.
  const back = (renderer as unknown as { backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean } }).backend;
  if (back?.isWebGPUBackend) return 'webgpu';
  if (back?.isWebGLBackend) return 'webgl2';
  return null;
}

export async function createSceneRoot(
  options: CreateSceneRootOptions = {},
): Promise<SceneRootHandle> {
  const scene = new Scene();
  const size = options.size ?? DEFAULT_SIZE;

  const camera = new PerspectiveCamera(50, size.width / size.height, 0.1, 5000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  // Default lighting — hemisphere fill + directional key + ambient floor.
  const hemi = new HemisphereLight(0xffffff, 0x111122, 0.6);
  hemi.position.set(0, 50, 0);
  scene.add(hemi);

  const dir = new DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 7.5);
  scene.add(dir);

  const ambient = new AmbientLight(0xffffff, 0.15);
  scene.add(ambient);

  let renderer: SceneRootRenderer | null = null;
  if (!options.noRenderer) {
    const factory = options.rendererFactory ?? defaultRendererFactory;
    renderer = await factory(options.canvas);
    // Always await init() if the renderer exposes it. The default factory
    // already does this; awaiting it again here is idempotent for Three's
    // WebGPURenderer and keeps injected factories (R3F's async `gl`,
    // tests) on the same lifecycle. Calling render() before init() is what
    // historically forced renderAsync() — once init() has resolved we can
    // use the (non-deprecated) synchronous render() path in tick().
    if (typeof renderer.init === 'function') {
      await renderer.init();
    }
    if (renderer.setPixelRatio) renderer.setPixelRatio(pickPixelRatio(options.pixelRatio));
    if (renderer.setSize) renderer.setSize(size.width, size.height);
  }

  let running = false;
  let rafId: number | null = null;
  let beforeRender: (() => void) | null = null;

  async function tick(): Promise<void> {
    if (!renderer) return;
    // Run the per-frame hook (EB-06-05 camera-rail driver lives here).
    // Errors are swallowed so a broken driver can't bring down the render
    // loop; the driver itself logs.
    if (beforeRender) {
      try { beforeRender(); } catch { /* ignore */ }
    }
    // After `renderer.init()` the WebGPURenderer has been awaited at
    // construction (see `defaultRendererFactory`). Three deprecates
    // `renderAsync()` in favor of `render()` once init has resolved —
    // calling `renderAsync()` emits a console warning ("renderAsync() has
    // been deprecated") which the harness asserts against.
    if (renderer.render) {
      renderer.render(scene, camera);
    } else if (renderer.renderAsync) {
      await renderer.renderAsync(scene, camera);
    }
  }

  function setBeforeRender(cb: (() => void) | null): void {
    beforeRender = cb;
  }

  /** Best-effort `requestAnimationFrame` shim. Used when the injected
   *  renderer does not expose `setAnimationLoop` (e.g. test stubs in
   *  non-browser environments where `globalThis.requestAnimationFrame`
   *  may also be missing — falls back to `setTimeout(16ms)`). */
  function rafLoop(): void {
    if (!running) return;
    void tick();
    const w = (globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame;
    if (typeof w === 'function') {
      rafId = w(rafLoop);
    } else {
      rafId = setTimeout(rafLoop, 16) as unknown as number;
    }
  }

  function start(): void {
    if (running) return;
    running = true;
    if (renderer?.setAnimationLoop) {
      renderer.setAnimationLoop(() => {
        // Fire-and-forget; renderAsync errors propagate to the caller via
        // unhandled-rejection, matching three/webgpu's documented behavior.
        void tick();
      });
    } else {
      rafLoop();
    }
  }

  function stop(): void {
    running = false;
    if (renderer?.setAnimationLoop) renderer.setAnimationLoop(null);
    if (rafId !== null) {
      const cancel = (globalThis as { cancelAnimationFrame?: (id: number) => void }).cancelAnimationFrame;
      if (typeof cancel === 'function') cancel(rafId);
      else clearTimeout(rafId as unknown as ReturnType<typeof setTimeout>);
      rafId = null;
    }
  }

  function addHub(hubGroup: Object3D): void {
    scene.add(hubGroup);
  }

  function removeHub(hubGroup: Object3D): void {
    scene.remove(hubGroup);
  }

  function dispose(): void {
    stop();
    // Detach every direct child of the scene so userData.cleanup() (handled
    // by HubManager) is the disposal path, not silent garbage collection.
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
    if (renderer?.dispose) renderer.dispose();
    renderer = null;
  }

  function getRendererBackend(): RendererBackend {
    return detectBackend(renderer);
  }

  return {
    get scene() {
      return scene;
    },
    get camera() {
      return camera;
    },
    get renderer() {
      return renderer;
    },
    addHub,
    removeHub,
    start,
    stop,
    tick,
    dispose,
    setBeforeRender,
    getRendererBackend,
  };
}
