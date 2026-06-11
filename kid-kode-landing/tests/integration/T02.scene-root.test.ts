// T02 — SceneRoot owns scene + camera + lights + render loop.
//
// Spec refs: PRISM-RENDERER-MIGRATION-SPEC.md §11 (Bundle Assembly,
// shared/scene-root.js: "Camera, lights, render loop, post-FX") and §12
// (Hub Manager, hub groups added to sceneRoot).
//
// In node we cannot construct WebGPURenderer (no canvas / no WebGPU); we
// inject a stub renderer via the testing seam so the rest of the SceneRoot
// surface (scene graph, camera, lights, hub mount/unmount, render loop
// scheduling) is exercised.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createSceneRoot,
  type SceneRootHandle,
} from '@/lib/prism/runtime/shared/scene-root';

function makeStubRenderer() {
  const calls: { setPixelRatio: number[]; setSize: Array<[number, number]>; render: number; dispose: number } = {
    setPixelRatio: [],
    setSize: [],
    render: 0,
    dispose: 0,
  };
  const renderer = {
    backend: 'stub' as const,
    domElement: { width: 0, height: 0 } as unknown as HTMLCanvasElement,
    setPixelRatio(ratio: number) {
      calls.setPixelRatio.push(ratio);
    },
    setSize(w: number, h: number) {
      calls.setSize.push([w, h]);
    },
    setAnimationLoop(_cb: (() => void) | null) {
      // capture-only stub
    },
    renderAsync(_scene: THREE.Scene, _camera: THREE.Camera) {
      calls.render += 1;
      return Promise.resolve();
    },
    render(_scene: THREE.Scene, _camera: THREE.Camera) {
      calls.render += 1;
    },
    dispose() {
      calls.dispose += 1;
    },
    init() {
      return Promise.resolve();
    },
    // The lighting rig's IBL warm-up (environment-ibl.ts) constructs a
    // PMREMGenerator over the injected renderer; on the three/webgpu build
    // compileEquirectangularShader() AWAITS renderer.compile(...). The real
    // WebGPURenderer provides compile(); a stub without it makes that
    // warm-up promise reject OUTSIDE buildEnvironmentIBL's try/catch — an
    // unhandled rejection that fails the vitest run even with every
    // assertion green. Mirror the real renderer surface.
    compile() {
      return Promise.resolve();
    },
  };
  return { renderer, calls };
}

describe('createSceneRoot', () => {
  it('returns a Scene + PerspectiveCamera + lights without requiring a real renderer', async () => {
    const handle: SceneRootHandle = await createSceneRoot({ noRenderer: true });
    expect(handle.scene).toBeInstanceOf(THREE.Scene);
    expect(handle.camera).toBeInstanceOf(THREE.PerspectiveCamera);

    // At least one ambient/hemisphere/directional light must be parented under
    // the scene so MSDF text + lit materials render correctly.
    const lights: THREE.Light[] = [];
    handle.scene.traverse((obj) => {
      if ((obj as THREE.Light).isLight) lights.push(obj as THREE.Light);
    });
    expect(lights.length).toBeGreaterThanOrEqual(1);
  });

  it('addHub mounts a Group on the scene; removeHub unmounts it', async () => {
    const handle = await createSceneRoot({ noRenderer: true });
    const group = new THREE.Group();
    group.name = 'hub-A';

    handle.addHub(group);
    expect(group.parent).toBe(handle.scene);

    handle.removeHub(group);
    expect(group.parent).not.toBe(handle.scene);
  });

  it('start() drives a render loop tick that calls renderer.render(scene, camera)', async () => {
    const { renderer, calls } = makeStubRenderer();
    const handle = await createSceneRoot({ rendererFactory: async () => renderer });
    handle.start();
    // Manually advance one tick so we don't depend on rAF in node.
    await handle.tick();
    expect(calls.render).toBeGreaterThanOrEqual(1);
    handle.dispose();
  });

  it('dispose() cleans up the renderer and clears the scene', async () => {
    const { renderer, calls } = makeStubRenderer();
    const handle = await createSceneRoot({ rendererFactory: async () => renderer });
    handle.dispose();
    expect(calls.dispose).toBe(1);
  });

  it('reports a renderer backend (webgpu | webgl2 | stub | null)', async () => {
    const handle = await createSceneRoot({ noRenderer: true });
    const backend = handle.getRendererBackend();
    expect([null, 'webgpu', 'webgl2', 'stub']).toContain(backend);
  });
});
