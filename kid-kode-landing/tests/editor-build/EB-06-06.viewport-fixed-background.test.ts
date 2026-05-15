// EB-06-06 — Viewport-relative background in preview-hub.
//
// Spec refs:
//   §6 SC-033 "Viewport-relative background renders from the hub's compiled
//              background layer stack; the first layer with `attachment:
//              'viewport-fixed'` is fixed to the viewport during scroll."
//   §8 INV-23 "Compiled-preview camera is constrained, damped, and bounded.
//              The scene's edges and any blank background are never visible in
//              preview-hub or preview-app."
//   §3        compileHubToPreview produces CompiledHubView.background[] —
//              the viewport-fixed layer originates there.
//
// haltCheck:
//   "First background layer with attachment 'viewport-fixed' renders fixed to
//    the viewport during scroll in preview-hub; other layers respect their
//    attachment mode; snapshot shows fixed backdrop."

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import {
  mountFromGraphSource,
  type MountGraphResult,
} from '@/lib/prism/runtime/mount-graph';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';
import {
  compileHubToPreview,
  type CompiledHubBackgroundLayer,
} from '@/lib/prism-graph/compiled-view';
import type {
  GraphSource,
  PrismHub,
  PrismNode,
} from '@/lib/prism-graph/types';
import type { PrismRootNode } from '@/lib/prism-graph/root-node';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

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

function makeHub(mockupUrl: string | null = '/prism-mock/home/mockup.png'): PrismHub {
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
      behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
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

const baseSource: GraphSource = {
  hubs: [makeHub('/prism-mock/home/mockup.png')],
  nodes: [makeNode('n1')],
  edges: [],
};

describe('EB-06-06 — compiled background contract (SC-033 + SC-028)', () => {
  it('compileHubToPreview emits a viewport-fixed layer from layout.mockupUrl', () => {
    const view = compileHubToPreview(makeHub('/x/y.png'), [makeNode('n1')], makeWorld());
    expect(view.background.length).toBeGreaterThanOrEqual(1);
    expect(view.background[0].attachment).toBe('viewport-fixed');
    expect(view.background[0].sourceUrl).toBe('/x/y.png');
  });

  it('compileHubToPreview emits no layers when layout.mockupUrl is null', () => {
    const view = compileHubToPreview(makeHub(null), [makeNode('n1')], makeWorld());
    expect(view.background.length).toBe(0);
  });
});

describe('EB-06-06 — runtime renders viewport-fixed background fixed to camera', () => {
  it('mountFromGraphSource result exposes setBackgroundLayers(layers | null)', async () => {
    const result = await mountFromGraphSource(undefined, baseSource, ctxStub(), {
      noRenderer: true,
    });
    expect(typeof result.setBackgroundLayers).toBe('function');
    result.unmount();
  });

  it('setBackgroundLayers with a viewport-fixed layer parents a plane to the camera', async () => {
    const result = await mountFromGraphSource(undefined, baseSource, ctxStub(), {
      noRenderer: true,
    });
    const view = compileHubToPreview(makeHub('/p/m.png'), [makeNode('n1')], makeWorld());

    result.setBackgroundLayers(view.background);

    const camera = result.sceneRoot.camera;
    const fixed = camera.children.find(
      (c) => c.userData?.role === 'viewport-fixed-background',
    );
    expect(fixed).toBeDefined();
    expect(fixed!.parent).toBe(camera);
    result.unmount();
  });

  it('viewport-fixed plane stays in front of the camera after the camera moves (scroll)', async () => {
    const result = await mountFromGraphSource(undefined, baseSource, ctxStub(), {
      noRenderer: true,
    });
    const view = compileHubToPreview(makeHub('/p/m.png'), [makeNode('n1')], makeWorld());
    result.setBackgroundLayers(view.background);

    const camera = result.sceneRoot.camera;
    const fixed = camera.children.find(
      (c) => c.userData?.role === 'viewport-fixed-background',
    )! as THREE.Mesh;

    // Update world matrices and record world position at camera pose A.
    camera.updateMatrixWorld(true);
    const posA = new THREE.Vector3();
    fixed.getWorldPosition(posA);

    // Simulate "scroll" — translate the camera.
    camera.position.set(0, -250, 30);
    camera.updateMatrixWorld(true);
    const posB = new THREE.Vector3();
    fixed.getWorldPosition(posB);

    // The plane's offset from the camera must be invariant (camera-attached).
    const offsetA = posA.clone().sub(new THREE.Vector3(0, 0, 10)); // initial cam pos
    const offsetB = posB.clone().sub(new THREE.Vector3(0, -250, 30));
    expect(offsetA.distanceTo(offsetB)).toBeLessThan(1e-3);

    // World position MUST differ between the two poses (proves it followed
    // the camera rather than staying anchored in world space).
    expect(posA.distanceTo(posB)).toBeGreaterThan(1);
    result.unmount();
  });

  it('viewport-fixed plane sits in front of the camera (negative local z)', async () => {
    const result = await mountFromGraphSource(undefined, baseSource, ctxStub(), {
      noRenderer: true,
    });
    const view = compileHubToPreview(makeHub('/p/m.png'), [makeNode('n1')], makeWorld());
    result.setBackgroundLayers(view.background);

    const fixed = result.sceneRoot.camera.children.find(
      (c) => c.userData?.role === 'viewport-fixed-background',
    )! as THREE.Mesh;
    expect(fixed.position.z).toBeLessThan(0);
    result.unmount();
  });

  it('setBackgroundLayers(null) removes the viewport-fixed plane', async () => {
    const result = await mountFromGraphSource(undefined, baseSource, ctxStub(), {
      noRenderer: true,
    });
    const view = compileHubToPreview(makeHub('/p/m.png'), [makeNode('n1')], makeWorld());
    result.setBackgroundLayers(view.background);
    expect(
      result.sceneRoot.camera.children.some(
        (c) => c.userData?.role === 'viewport-fixed-background',
      ),
    ).toBe(true);

    result.setBackgroundLayers(null);
    expect(
      result.sceneRoot.camera.children.some(
        (c) => c.userData?.role === 'viewport-fixed-background',
      ),
    ).toBe(false);
    result.unmount();
  });

  it('setBackgroundLayers([]) leaves no viewport-fixed plane', async () => {
    const result = await mountFromGraphSource(undefined, baseSource, ctxStub(), {
      noRenderer: true,
    });
    result.setBackgroundLayers([]);
    expect(
      result.sceneRoot.camera.children.some(
        (c) => c.userData?.role === 'viewport-fixed-background',
      ),
    ).toBe(false);
    result.unmount();
  });

  it('non-viewport-fixed attachments do not become camera children (SC-033 first-layer semantics)', async () => {
    const result = await mountFromGraphSource(undefined, baseSource, ctxStub(), {
      noRenderer: true,
    });
    const onlyWorldLayers: readonly CompiledHubBackgroundLayer[] = [
      Object.freeze({
        id: 'home/bg-world',
        attachment: 'world' as const,
        sourceUrl: '/p/w.png',
        z: 0,
        opacity: 1,
      }),
      Object.freeze({
        id: 'home/bg-parallax',
        attachment: 'parallax' as const,
        sourceUrl: '/p/par.png',
        z: 1,
        opacity: 1,
      }),
    ];
    result.setBackgroundLayers(onlyWorldLayers);
    expect(
      result.sceneRoot.camera.children.some(
        (c) => c.userData?.role === 'viewport-fixed-background',
      ),
    ).toBe(false);
    result.unmount();
  });

  it('only the FIRST viewport-fixed layer is rendered (subsequent fixed layers ignored at this phase)', async () => {
    const result = await mountFromGraphSource(undefined, baseSource, ctxStub(), {
      noRenderer: true,
    });
    const twoFixed: readonly CompiledHubBackgroundLayer[] = [
      Object.freeze({
        id: 'home/bg-a',
        attachment: 'viewport-fixed' as const,
        sourceUrl: '/p/a.png',
        z: 0,
        opacity: 1,
      }),
      Object.freeze({
        id: 'home/bg-b',
        attachment: 'viewport-fixed' as const,
        sourceUrl: '/p/b.png',
        z: 1,
        opacity: 1,
      }),
    ];
    result.setBackgroundLayers(twoFixed);
    const fixedChildren = result.sceneRoot.camera.children.filter(
      (c) => c.userData?.role === 'viewport-fixed-background',
    );
    expect(fixedChildren.length).toBe(1);
    expect((fixedChildren[0].userData as { layerId?: string }).layerId).toBe(
      'home/bg-a',
    );
    result.unmount();
  });

  it('setBackgroundLayers ensures the camera is part of the scene graph (renderable)', async () => {
    const result = await mountFromGraphSource(undefined, baseSource, ctxStub(), {
      noRenderer: true,
    });
    const view = compileHubToPreview(makeHub('/p/m.png'), [makeNode('n1')], makeWorld());
    result.setBackgroundLayers(view.background);

    // Walk up the parent chain from camera; must reach result.sceneRoot.scene.
    let node: THREE.Object3D | null = result.sceneRoot.camera;
    let reachesScene = false;
    while (node) {
      if (node === result.sceneRoot.scene) {
        reachesScene = true;
        break;
      }
      node = node.parent;
    }
    expect(reachesScene).toBe(true);
    result.unmount();
  });

  it('replacing layers cleans up the previous plane (no leak)', async () => {
    const result = await mountFromGraphSource(undefined, baseSource, ctxStub(), {
      noRenderer: true,
    });
    const v1 = compileHubToPreview(makeHub('/p/a.png'), [makeNode('n1')], makeWorld());
    const v2 = compileHubToPreview(makeHub('/p/b.png'), [makeNode('n1')], makeWorld());

    result.setBackgroundLayers(v1.background);
    const first = result.sceneRoot.camera.children.find(
      (c) => c.userData?.role === 'viewport-fixed-background',
    )!;
    let cleaned = false;
    first.userData.cleanup = () => { cleaned = true; };

    result.setBackgroundLayers(v2.background);
    const second = result.sceneRoot.camera.children.find(
      (c) => c.userData?.role === 'viewport-fixed-background',
    )!;

    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(cleaned).toBe(true);
    expect(first.parent).toBeNull();
    result.unmount();
  });
});

describe('EB-06-06 — PrismHost wires compiled background to preview-hub', () => {
  it('PrismHost source references compiled background and setBackgroundLayers', () => {
    const src = readFileSync(
      resolve(REPO_ROOT, 'src', 'components', 'prism-player', 'PrismHost.tsx'),
      'utf8',
    );
    expect(src).toMatch(/setBackgroundLayers/);
    expect(src).toMatch(/compileHubToPreview|compiledView\.background|cameraRail\.background|\.background/);
    expect(src).toMatch(/preview-hub/);
  });
});
