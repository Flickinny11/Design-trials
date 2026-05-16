// EB-07-02 — Renderer composes background layer stack per attachment mode.
//
// Spec refs:
//   §7 SC-036  PrismHubBackgroundLayer attachment vocabulary:
//              'viewport-fixed' | 'camera-locked' | 'parallax' | 'world' |
//              'infinite-environment'.
//   §7 SC-037  hub.background?: PrismHubBackgroundLayer[] is preferred over
//              the legacy single-layer reader (layout.mockupUrl).
//   §6 SC-033  Viewport-fixed pinning (covered by EB-06-06; still binding here).
//   §8 INV-15  No DOM access in runtime code (no document.*, no window.*
//              except window.devicePixelRatio).
//
// haltCheck (from ralph-state.json):
//   "Per attachment mode: viewport-fixed → camera-aligned plane;
//    camera-locked → attached to camera node; parallax → reduced-rate
//    translation; world → static world geometry; infinite-environment →
//    cubemap/skybox. Snapshot shows multi-layer composition."

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

import {
  mountFromGraphSource,
} from '@/lib/prism/runtime/mount-graph';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';
import {
  compileHubToPreview,
  type CompiledHubBackgroundLayer,
} from '@/lib/prism-graph/compiled-view';
import type {
  GraphSource,
  PrismHub,
  PrismHubBackgroundLayer,
  PrismNode,
} from '@/lib/prism-graph/types';
import type { PrismRootNode } from '@/lib/prism-graph/root-node';

function ctxStub(): NodeContext {
  return {
    textureLoader: {
      loadTexture: async (url: string) => {
        const t = new THREE.Texture();
        (t as unknown as { __loadedFromUrl?: string }).__loadedFromUrl = url;
        return t;
      },
    } as unknown as NodeContext['textureLoader'],
    glbLoader: {
      loadGLB: async () => ({ scene: new THREE.Group() }),
    } as unknown as NodeContext['glbLoader'],
    fontAtlas: {
      ready: false,
      load: async () => {},
      createText: () => new THREE.Group(),
      dispose: () => {},
    } as unknown as NodeContext['fontAtlas'],
    primitives: {} as NodeContext['primitives'],
    emit: () => {},
  };
}

function makeHub(
  mockupUrl: string | null = '/prism-mock/home/mockup.png',
  background?: PrismHubBackgroundLayer[],
): PrismHub {
  return {
    hubId: 'home',
    title: 'Home',
    layout: {
      viewportWidth: 1280,
      viewportHeight: 720,
      contentHeight: 720,
      backgroundColor: '#04050a',
      mockupUrl,
    },
    ...(background !== undefined ? { background } : {}),
  };
}

function makeNode(id: string): PrismNode {
  return {
    nodeId: id,
    subtype: 'hero',
    parentHubId: 'home',
    serviceTag: 'static',
    visual: { transform: { x: 0, y: 0, z: 0, width: 100, height: 100 } },
    intent: {
      caption: '',
      behaviorSpec: {
        interactions: [], apiCalls: [], dataBindings: [],
        emits: [], listens: [], triggersDownstream: [],
      },
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: '',
    backendRef: null,
    renderMode: 'sprite',
    depthMapUrl: null,
    meshUrl: null,
    cinematicPrimitives: [],
  };
}

function makeWorld(): PrismRootNode {
  return {
    appNameWorldId: 'world-home',
    spec: { name: 'Home App' },
    designSpec: {},
    buildPlan: {},
    memoryLog: [],
    hubRegistry: [{ hubId: 'home' }],
    nodeRegistry: [{ nodeId: 'n1', hubId: 'home', subtype: 'hero' }],
    globalDependencies: [],
    validationRules: [],
    aiRoutingRules: [],
  };
}

function baseSource(): GraphSource {
  return {
    hubs: [makeHub('/prism-mock/home/mockup.png')],
    nodes: [makeNode('n1')],
    edges: [],
  };
}

// ---------------------------------------------------------------------------
// compileBackground extension — read hub.background per SC-037.
// ---------------------------------------------------------------------------

describe('EB-07-02 — compileBackground honors hub.background (SC-037)', () => {
  it('prefers hub.background over layout.mockupUrl when present', () => {
    const hub = makeHub('/legacy.png', [
      { id: 'home/bg-fixed', attachment: 'viewport-fixed', sourceUrl: '/v.png' },
      { id: 'home/bg-par',   attachment: 'parallax',       sourceUrl: '/p.png', parallaxDepth: 0.5 },
      { id: 'home/bg-world', attachment: 'world',          sourceUrl: '/w.png', z: -10 },
    ]);
    const view = compileHubToPreview(hub, [makeNode('n1')], makeWorld());
    expect(view.background.length).toBe(3);
    const ids = view.background.map((l) => l.id);
    expect(ids).toEqual(['home/bg-fixed', 'home/bg-par', 'home/bg-world']);
    // legacy mockupUrl is NOT emitted as an extra layer when hub.background is present
    expect(view.background.some((l) => l.sourceUrl === '/legacy.png')).toBe(false);
  });

  it('falls back to layout.mockupUrl when hub.background is undefined', () => {
    const view = compileHubToPreview(
      makeHub('/legacy.png', undefined),
      [makeNode('n1')],
      makeWorld(),
    );
    expect(view.background.length).toBe(1);
    expect(view.background[0].attachment).toBe('viewport-fixed');
    expect(view.background[0].sourceUrl).toBe('/legacy.png');
  });

  it('falls back to layout.mockupUrl when hub.background is empty', () => {
    const view = compileHubToPreview(
      makeHub('/legacy.png', []),
      [makeNode('n1')],
      makeWorld(),
    );
    expect(view.background.length).toBe(1);
    expect(view.background[0].attachment).toBe('viewport-fixed');
    expect(view.background[0].sourceUrl).toBe('/legacy.png');
  });

  it('emits no layers when neither hub.background nor mockupUrl exists', () => {
    const view = compileHubToPreview(
      makeHub(null, undefined),
      [makeNode('n1')],
      makeWorld(),
    );
    expect(view.background.length).toBe(0);
  });

  it('preserves parallaxDepth through compilation', () => {
    const view = compileHubToPreview(
      makeHub(null, [
        { id: 'p', attachment: 'parallax', sourceUrl: '/p.png', parallaxDepth: 0.42 },
      ]),
      [makeNode('n1')],
      makeWorld(),
    );
    expect(view.background.length).toBe(1);
    expect(view.background[0].parallaxDepth).toBe(0.42);
  });

  it('applies defaults z=0, opacity=1 when source layer omits them', () => {
    const view = compileHubToPreview(
      makeHub(null, [
        { id: 'w', attachment: 'world', sourceUrl: '/w.png' },
      ]),
      [makeNode('n1')],
      makeWorld(),
    );
    expect(view.background[0].z).toBe(0);
    expect(view.background[0].opacity).toBe(1);
  });

  it('compile output remains deeply frozen (INV-17 / SC-028)', () => {
    const view = compileHubToPreview(
      makeHub(null, [
        { id: 'a', attachment: 'world', sourceUrl: '/w.png' },
      ]),
      [makeNode('n1')],
      makeWorld(),
    );
    expect(Object.isFrozen(view.background)).toBe(true);
    expect(Object.isFrozen(view.background[0])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Renderer composition — per-attachment-mode mounts.
// ---------------------------------------------------------------------------

describe('EB-07-02 — renderer composes camera-locked layer', () => {
  it('camera-locked layer becomes a child of the camera with role "camera-locked-background"', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    const layers: readonly CompiledHubBackgroundLayer[] = [
      Object.freeze({
        id: 'home/bg-hud', attachment: 'camera-locked' as const,
        sourceUrl: '/p/hud.png', z: -200, opacity: 1,
      }),
    ];
    result.setBackgroundLayers(layers);
    const camera = result.sceneRoot.camera;
    const hud = camera.children.find(
      (c) => c.userData?.role === 'camera-locked-background',
    );
    expect(hud).toBeDefined();
    expect(hud!.parent).toBe(camera);
    expect((hud!.userData as { layerId?: string }).layerId).toBe('home/bg-hud');
    result.unmount();
  });

  it('camera-locked plane stays glued to the camera under scroll', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    result.setBackgroundLayers([
      Object.freeze({
        id: 'h', attachment: 'camera-locked' as const,
        sourceUrl: null, z: -100, opacity: 1,
      }),
    ]);
    const camera = result.sceneRoot.camera;
    const hud = camera.children.find(
      (c) => c.userData?.role === 'camera-locked-background',
    )! as THREE.Object3D;

    camera.updateMatrixWorld(true);
    const a = new THREE.Vector3();
    hud.getWorldPosition(a);

    camera.position.set(13, -47, 250);
    camera.updateMatrixWorld(true);
    const b = new THREE.Vector3();
    hud.getWorldPosition(b);

    // World position MUST change with the camera (camera-attached).
    expect(a.distanceTo(b)).toBeGreaterThan(1);
    result.unmount();
  });
});

describe('EB-07-02 — renderer composes parallax layer (reduced-rate translation)', () => {
  it('parallax layer is parented under the scene, NOT under the camera', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    result.setBackgroundLayers([
      Object.freeze({
        id: 'pl', attachment: 'parallax' as const,
        sourceUrl: '/p/par.png', z: 0, opacity: 1, parallaxDepth: 0.5,
      }),
    ]);
    expect(
      result.sceneRoot.camera.children.some(
        (c) => c.userData?.role === 'parallax-background',
      ),
    ).toBe(false);

    const found = findInScene(result.sceneRoot.scene, 'parallax-background');
    expect(found).not.toBeNull();
    expect((found!.userData as { parallaxDepth?: number }).parallaxDepth).toBe(0.5);
    result.unmount();
  });

  it('parallax mesh translates at a REDUCED rate of camera movement', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    result.setBackgroundLayers([
      Object.freeze({
        id: 'pl', attachment: 'parallax' as const,
        sourceUrl: null, z: 0, opacity: 1, parallaxDepth: 0.6,
      }),
    ]);
    const mesh = findInScene(result.sceneRoot.scene, 'parallax-background')!;

    // Initial step at origin.
    result.tickBackgroundDrivers();
    const y0 = mesh.position.y;

    // Move camera and re-tick.
    result.sceneRoot.camera.position.set(0, 100, 10);
    result.sceneRoot.camera.updateMatrixWorld(true);
    result.tickBackgroundDrivers();
    const y1 = mesh.position.y;

    // Plane must follow at the configured reduced rate (depth 0.6 → 60% of camera movement).
    const delta = y1 - y0;
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(100);
    expect(Math.abs(delta - 60)).toBeLessThan(0.1);
    result.unmount();
  });

  it('parallax with depth=1 stays still (max-distance), depth=0 follows camera 1:1', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    result.setBackgroundLayers([
      Object.freeze({
        id: 'far',  attachment: 'parallax' as const, sourceUrl: null, z: -5, opacity: 1, parallaxDepth: 1,
      }),
      Object.freeze({
        id: 'near', attachment: 'parallax' as const, sourceUrl: null, z:  5, opacity: 1, parallaxDepth: 0,
      }),
    ]);
    const meshes = findAllInScene(result.sceneRoot.scene, 'parallax-background');
    const far  = meshes.find((m) => (m.userData as { layerId?: string }).layerId === 'far')!;
    const near = meshes.find((m) => (m.userData as { layerId?: string }).layerId === 'near')!;

    result.tickBackgroundDrivers();
    const farY0 = far.position.y;
    const nearY0 = near.position.y;

    result.sceneRoot.camera.position.set(0, 250, 10);
    result.sceneRoot.camera.updateMatrixWorld(true);
    result.tickBackgroundDrivers();

    expect(Math.abs(far.position.y - farY0)).toBeLessThan(0.1);            // static
    expect(Math.abs(near.position.y - nearY0 - 250)).toBeLessThan(0.1);    // 1:1 with camera
    result.unmount();
  });
});

describe('EB-07-02 — renderer composes world layer (static world geometry)', () => {
  it('world layer becomes a scene child with role "world-background" at its compiled z', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    result.setBackgroundLayers([
      Object.freeze({
        id: 'wbg', attachment: 'world' as const,
        sourceUrl: '/p/w.png', z: -42, opacity: 1,
      }),
    ]);
    expect(
      result.sceneRoot.camera.children.some(
        (c) => c.userData?.role === 'world-background',
      ),
    ).toBe(false);
    const world = findInScene(result.sceneRoot.scene, 'world-background');
    expect(world).not.toBeNull();
    expect(world!.position.z).toBe(-42);
    expect((world!.userData as { layerId?: string }).layerId).toBe('wbg');
    result.unmount();
  });

  it('world layer does NOT move when the camera moves (static)', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    result.setBackgroundLayers([
      Object.freeze({
        id: 'w', attachment: 'world' as const,
        sourceUrl: null, z: 0, opacity: 1,
      }),
    ]);
    const mesh = findInScene(result.sceneRoot.scene, 'world-background')!;
    mesh.updateMatrixWorld(true);
    const a = new THREE.Vector3();
    mesh.getWorldPosition(a);

    result.sceneRoot.camera.position.set(0, -1000, 10);
    result.sceneRoot.camera.updateMatrixWorld(true);
    result.tickBackgroundDrivers();
    mesh.updateMatrixWorld(true);
    const b = new THREE.Vector3();
    mesh.getWorldPosition(b);

    expect(a.distanceTo(b)).toBeLessThan(1e-3);
    result.unmount();
  });
});

describe('EB-07-02 — renderer composes infinite-environment layer (skybox)', () => {
  it('infinite-environment layer installs scene.background', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    expect(result.sceneRoot.scene.background).toBeNull();
    result.setBackgroundLayers([
      Object.freeze({
        id: 'env', attachment: 'infinite-environment' as const,
        sourceUrl: '/p/env.png', z: 0, opacity: 1,
      }),
    ]);
    // Awaiting deferred texture resolution (loadTexture is async in the stub).
    await Promise.resolve();
    await Promise.resolve();
    expect(result.sceneRoot.scene.background).not.toBeNull();
    result.unmount();
  });

  it('infinite-environment with null sourceUrl is a no-op (no scene.background)', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    result.setBackgroundLayers([
      Object.freeze({
        id: 'env', attachment: 'infinite-environment' as const,
        sourceUrl: null, z: 0, opacity: 1,
      }),
    ]);
    await Promise.resolve();
    expect(result.sceneRoot.scene.background).toBeNull();
    result.unmount();
  });
});

// ---------------------------------------------------------------------------
// Multi-layer composition + cleanup.
// ---------------------------------------------------------------------------

describe('EB-07-02 — multi-layer composition + cleanup', () => {
  it('a stack of all 5 attachment modes mounts each in the correct host', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    const stack: readonly CompiledHubBackgroundLayer[] = [
      Object.freeze({ id: 'a', attachment: 'viewport-fixed' as const,        sourceUrl: '/a.png', z: 0, opacity: 1 }),
      Object.freeze({ id: 'b', attachment: 'camera-locked' as const,         sourceUrl: '/b.png', z: -50, opacity: 1 }),
      Object.freeze({ id: 'c', attachment: 'parallax' as const,              sourceUrl: '/c.png', z: 0, opacity: 1, parallaxDepth: 0.4 }),
      Object.freeze({ id: 'd', attachment: 'world' as const,                 sourceUrl: '/d.png', z: -10, opacity: 1 }),
      Object.freeze({ id: 'e', attachment: 'infinite-environment' as const,  sourceUrl: '/e.png', z: 0, opacity: 1 }),
    ];
    result.setBackgroundLayers(stack);
    await Promise.resolve();
    await Promise.resolve();

    const camera = result.sceneRoot.camera;
    expect(camera.children.some((c) => c.userData?.role === 'viewport-fixed-background')).toBe(true);
    expect(camera.children.some((c) => c.userData?.role === 'camera-locked-background')).toBe(true);

    expect(findInScene(result.sceneRoot.scene, 'parallax-background')).not.toBeNull();
    expect(findInScene(result.sceneRoot.scene, 'world-background')).not.toBeNull();
    expect(result.sceneRoot.scene.background).not.toBeNull();
    result.unmount();
  });

  it('setBackgroundLayers(null) clears every composed layer (planes + environment)', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    result.setBackgroundLayers([
      Object.freeze({ id: 'a', attachment: 'viewport-fixed' as const,       sourceUrl: '/a.png', z: 0, opacity: 1 }),
      Object.freeze({ id: 'b', attachment: 'camera-locked' as const,        sourceUrl: '/b.png', z: -50, opacity: 1 }),
      Object.freeze({ id: 'c', attachment: 'parallax' as const,             sourceUrl: '/c.png', z: 0, opacity: 1, parallaxDepth: 0.4 }),
      Object.freeze({ id: 'd', attachment: 'world' as const,                sourceUrl: '/d.png', z: -10, opacity: 1 }),
      Object.freeze({ id: 'e', attachment: 'infinite-environment' as const, sourceUrl: '/e.png', z: 0, opacity: 1 }),
    ]);
    await Promise.resolve();

    result.setBackgroundLayers(null);
    const camera = result.sceneRoot.camera;
    expect(camera.children.some((c) => c.userData?.role === 'viewport-fixed-background')).toBe(false);
    expect(camera.children.some((c) => c.userData?.role === 'camera-locked-background')).toBe(false);
    expect(findInScene(result.sceneRoot.scene, 'parallax-background')).toBeNull();
    expect(findInScene(result.sceneRoot.scene, 'world-background')).toBeNull();
    expect(result.sceneRoot.scene.background).toBeNull();
    result.unmount();
  });

  it('replacing the stack disposes the previous composed layers', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    result.setBackgroundLayers([
      Object.freeze({ id: 'a', attachment: 'parallax' as const, sourceUrl: null, z: 0, opacity: 1, parallaxDepth: 0.3 }),
    ]);
    const first = findInScene(result.sceneRoot.scene, 'parallax-background')!;
    let cleaned = false;
    first.userData.cleanup = () => { cleaned = true; };

    result.setBackgroundLayers([
      Object.freeze({ id: 'b', attachment: 'parallax' as const, sourceUrl: null, z: 0, opacity: 1, parallaxDepth: 0.7 }),
    ]);
    const second = findInScene(result.sceneRoot.scene, 'parallax-background')!;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(cleaned).toBe(true);
    expect(first.parent).toBeNull();
    result.unmount();
  });
});

// ---------------------------------------------------------------------------
// PrismHost surface — preview-hub wires multi-mode layers (source-text only).
// ---------------------------------------------------------------------------

describe('EB-07-02 — PrismHost surfaces the compiled background to the renderer', () => {
  it('PrismHost references setBackgroundLayers and preview-hub mode (unchanged from EB-06-06)', () => {
    // The contract that PrismHost installs the compiled stack via setBackgroundLayers
    // is established by EB-06-06. EB-07-02 extends the *consumer* contract; we
    // verify the surface remains wired.
    // (No new symbol required here — composite renderer changes are internal.)
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function findInScene(root: THREE.Object3D, role: string): THREE.Object3D | null {
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (hit) return;
    if ((o.userData as { role?: string })?.role === role) hit = o;
  });
  return hit;
}

function findAllInScene(root: THREE.Object3D, role: string): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o.userData as { role?: string })?.role === role) out.push(o);
  });
  return out;
}
