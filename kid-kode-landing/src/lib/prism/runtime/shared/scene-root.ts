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

import type { Scene, PerspectiveCamera, Object3D } from 'three';

export type RendererBackend = 'webgpu' | 'webgl2' | 'stub' | null;

/** Minimal renderer surface SceneRoot needs. Both `WebGPURenderer` (from
 *  `three/webgpu`) and the test stubs satisfy this. */
export interface SceneRootRenderer {
  domElement?: HTMLCanvasElement;
  setPixelRatio?(ratio: number): void;
  setSize?(width: number, height: number): void;
  setAnimationLoop?(cb: (() => void) | null): void;
  renderAsync?(scene: Scene, camera: PerspectiveCamera): Promise<void>;
  render?(scene: Scene, camera: PerspectiveCamera): void;
  init?(): Promise<void>;
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

  /** 'webgpu' | 'webgl2' | 'stub' | null. Read after construction. */
  getRendererBackend(): RendererBackend;
}

/** Construct the SceneRoot. Async because WebGPU init is async. */
export function createSceneRoot(
  _options?: CreateSceneRootOptions,
): Promise<SceneRootHandle> {
  throw new Error('createSceneRoot: not implemented (T02)');
}
