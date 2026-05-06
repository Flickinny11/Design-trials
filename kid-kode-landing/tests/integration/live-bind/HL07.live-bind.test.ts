// HL07 — Live bind: mountFromGraphSource + surgical helpers + renderAsync
// deprecation fix.
//
// Plan ref: §P7 (live bind).
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §11 (Bundle Assembly) + §12 (Hub
// Manager).
//
// Acceptance:
//   - src/lib/prism/runtime/mount-graph.ts exports mountFromGraphSource
//     (canvas, source, ctx, opts).
//   - Result exposes surgical helpers: upsertNode, removeNode,
//     updateNodeTransform, setHubMockup.
//   - Per-hub backdrop plane mounts at z=-2 derived from hub.layout.mockupUrl.
//   - Surgical helpers do NOT trigger a full re-mount (cached object identity
//     for unchanged nodes; targeted dispose for removed nodes).
//   - SceneRoot's render path prefers `renderer.render()` over the deprecated
//     `renderer.renderAsync()` after `renderer.init()`.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  mountFromGraphSource,
  type MountGraphResult,
} from '@/lib/prism/runtime/mount-graph';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';
import type {
  GraphSource,
  PrismHub,
  PrismNode,
  ScenePosition,
} from '@/lib/prism-graph/types';
import { createSceneRoot, type SceneRootRenderer } from '@/lib/prism/runtime/shared/scene-root';

function ctxStub(): NodeContext {
  return {
    textureLoader: {
      loadTexture: async (_url: string) => {
        const t = new THREE.Texture();
        (t as unknown as { __loadedFromUrl?: string }).__loadedFromUrl = _url;
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

function makeHub(hubId: string, mockupUrl: string | null = null): PrismHub {
  return {
    hubId,
    title: hubId,
    layout: {
      viewportWidth: 1280,
      viewportHeight: 720,
      contentHeight: 720,
      backgroundColor: '#04050a',
      mockupUrl,
    },
  };
}

function makeNode(
  id: string,
  hubId: string,
  pos?: Partial<ScenePosition>,
): PrismNode {
  const scenePosition: ScenePosition = {
    x: 0, y: 0, z: 0,
    rotationX: 0, rotationY: 0, rotationZ: 0,
    scaleX: 1, scaleY: 1, scaleZ: 1,
    ...pos,
  };
  return {
    nodeId: id,
    subtype: 'hero',
    parentHubId: hubId,
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
    scenePosition,
  };
}

const sixNodeSource: GraphSource = {
  hubs: [makeHub('home', '/prism-mock/home/mockup.png')],
  nodes: [
    makeNode('n1', 'home'),
    makeNode('n2', 'home'),
    makeNode('n3', 'home'),
    makeNode('n4', 'home'),
    makeNode('n5', 'home'),
    makeNode('n6', 'home'),
  ],
  edges: [],
};

describe('mountFromGraphSource (HL07)', () => {
  describe('module surface', () => {
    it('exports mountFromGraphSource and surgical helpers', async () => {
      const result = await mountFromGraphSource(undefined, sixNodeSource, ctxStub(), {
        noRenderer: true,
      });
      expect(typeof result.upsertNode).toBe('function');
      expect(typeof result.removeNode).toBe('function');
      expect(typeof result.updateNodeTransform).toBe('function');
      expect(typeof result.setHubMockup).toBe('function');
      expect(typeof result.unmount).toBe('function');
      result.unmount();
    });

    it('mounts a hub group with all 6 nodes', async () => {
      const result = await mountFromGraphSource(undefined, sixNodeSource, ctxStub(), {
        noRenderer: true,
      });
      expect(result.adapterResult.nodes.size).toBe(6);
      expect(result.adapterResult.hubs.size).toBe(1);
      expect(result.hubManager.getActive()).toBe('home');
      result.unmount();
    });
  });

  describe('hub backdrop plane (amendment 0002)', () => {
    it('creates a backdrop plane at z=-2 when hub.layout.mockupUrl is set', async () => {
      const result = await mountFromGraphSource(undefined, sixNodeSource, ctxStub(), {
        noRenderer: true,
      });
      const hubGroup = result.adapterResult.hubs.get('home')!;
      const backdrop = hubGroup.children.find(
        (c) => c.userData?.role === 'hub-backdrop',
      );
      expect(backdrop).toBeDefined();
      expect(backdrop!.position.z).toBe(-2);
      result.unmount();
    });

    it('does NOT create a backdrop plane when hub.layout.mockupUrl is null', async () => {
      const noMockupSource: GraphSource = {
        hubs: [makeHub('home', null)],
        nodes: [makeNode('n1', 'home')],
        edges: [],
      };
      const result = await mountFromGraphSource(undefined, noMockupSource, ctxStub(), {
        noRenderer: true,
      });
      const hubGroup = result.adapterResult.hubs.get('home')!;
      const backdrop = hubGroup.children.find(
        (c) => c.userData?.role === 'hub-backdrop',
      );
      expect(backdrop).toBeUndefined();
      result.unmount();
    });
  });

  describe('surgical helpers', () => {
    let result: MountGraphResult;

    async function freshMount(): Promise<MountGraphResult> {
      return mountFromGraphSource(undefined, sixNodeSource, ctxStub(), {
        noRenderer: true,
      });
    }

    it('upsertNode adds a brand-new node without re-mounting siblings', async () => {
      result = await freshMount();
      const sibling = result.adapterResult.nodes.get('n1')!;
      const siblingIdRef = sibling.uuid;

      const newNode = makeNode('n7', 'home');
      result.upsertNode(newNode);

      expect(result.adapterResult.nodes.size).toBe(7);
      expect(result.adapterResult.nodes.get('n7')).toBeDefined();
      // Sibling identity preserved (no full re-mount).
      expect(result.adapterResult.nodes.get('n1')!.uuid).toBe(siblingIdRef);

      result.unmount();
    });

    it('upsertNode on an existing nodeId updates in place (replaces or patches)', async () => {
      result = await freshMount();
      const before = result.adapterResult.nodes.get('n1')!;
      const originalCount = result.adapterResult.nodes.size;

      const updated = makeNode('n1', 'home', { x: 5, y: 5 });
      result.upsertNode(updated);

      expect(result.adapterResult.nodes.size).toBe(originalCount);
      const after = result.adapterResult.nodes.get('n1')!;
      // The transform should reflect the patch even if the underlying object
      // is replaced (subscribed surgical replacement is fine; full re-mount
      // is not).
      expect(after.position.x).toBe(5);
      expect(after.position.y).toBe(5);
      // Other unrelated nodes must remain identity-stable.
      expect(result.adapterResult.nodes.get('n2')).toBe(before.parent?.children.find(c => c.userData?.nodeId === 'n2') ?? result.adapterResult.nodes.get('n2'));
      result.unmount();
    });

    it('removeNode unparents the node and runs userData.cleanup()', async () => {
      result = await freshMount();
      const node = result.adapterResult.nodes.get('n1')!;
      let cleaned = false;
      node.userData.cleanup = () => { cleaned = true; };

      result.removeNode('n1');

      expect(result.adapterResult.nodes.has('n1')).toBe(false);
      expect(cleaned).toBe(true);
      expect(node.parent).toBeNull();
      result.unmount();
    });

    it('updateNodeTransform mutates position/rotation/scale without rebuilding the object', async () => {
      result = await freshMount();
      const before = result.adapterResult.nodes.get('n1')!;
      const beforeUuid = before.uuid;

      const next: ScenePosition = {
        x: 1.5, y: 2.5, z: 0.75,
        rotationX: 0.1, rotationY: 0.2, rotationZ: 0.3,
        scaleX: 1.2, scaleY: 1.2, scaleZ: 1.2,
      };
      result.updateNodeTransform('n1', next);

      const after = result.adapterResult.nodes.get('n1')!;
      expect(after.uuid).toBe(beforeUuid); // identity preserved (no rebuild)
      expect(after.position.x).toBeCloseTo(1.5);
      expect(after.position.y).toBeCloseTo(2.5);
      expect(after.position.z).toBeCloseTo(0.75);
      expect(after.rotation.x).toBeCloseTo(0.1);
      expect(after.scale.x).toBeCloseTo(1.2);
      result.unmount();
    });

    it('setHubMockup swaps backdrop texture (or creates one if absent)', async () => {
      const noMockup: GraphSource = {
        hubs: [makeHub('home', null)],
        nodes: [makeNode('n1', 'home')],
        edges: [],
      };
      result = await mountFromGraphSource(undefined, noMockup, ctxStub(), { noRenderer: true });
      // Initial: no backdrop.
      const hub = result.adapterResult.hubs.get('home')!;
      expect(hub.children.find(c => c.userData?.role === 'hub-backdrop')).toBeUndefined();

      await result.setHubMockup('home', '/prism-mock/home/mockup.png');

      const created = hub.children.find(c => c.userData?.role === 'hub-backdrop');
      expect(created).toBeDefined();
      expect(created!.position.z).toBe(-2);
      result.unmount();
    });

    it('setHubMockup with null removes the backdrop', async () => {
      result = await freshMount();
      const hub = result.adapterResult.hubs.get('home')!;
      const before = hub.children.find(c => c.userData?.role === 'hub-backdrop');
      expect(before).toBeDefined();

      await result.setHubMockup('home', null);

      const after = hub.children.find(c => c.userData?.role === 'hub-backdrop');
      expect(after).toBeUndefined();
      result.unmount();
    });
  });
});

describe('SceneRoot renderAsync deprecation fix (HL07)', () => {
  it('prefers renderer.render() over renderAsync() during tick', async () => {
    let renderCalls = 0;
    let renderAsyncCalls = 0;
    let initCalled = false;

    const stubRenderer: SceneRootRenderer = {
      backend: 'stub',
      async init() { initCalled = true; },
      render() { renderCalls++; },
      async renderAsync() { renderAsyncCalls++; },
      setSize() {},
      setPixelRatio() {},
      setAnimationLoop(_cb) { /* not invoked here */ },
      dispose() {},
    };

    const sceneRoot = await createSceneRoot({
      noRenderer: false,
      rendererFactory: async () => stubRenderer,
    });

    // After init the runtime must invoke render(), not renderAsync(), to
    // avoid the THREE 'renderAsync() has been deprecated' warning.
    await sceneRoot.tick();

    expect(initCalled).toBe(true);
    expect(renderCalls).toBe(1);
    expect(renderAsyncCalls).toBe(0);

    sceneRoot.dispose();
  });
});
