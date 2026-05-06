// HL09 — codeRef factory dispatch.
//
// Plan ref: §P9 (codeRef factory dispatch).
// Spec refs: PRISM-RENDERER-MIGRATION-SPEC.md §8 (createNode contract — sync,
// returns Object3D), §10 (verifier — codeRef modules must default-export the
// createNode contract).
//
// Acceptance:
//   - src/lib/prism/runtime/factories/coderef-factory.ts exports:
//       resolveCodeRef(url): Promise<CreateNodeFn>
//       buildPerNodeFactory(defaultFactory): CreateNodeFn
//   - resolveCodeRef caches by url (second call → same promise).
//   - buildPerNodeFactory wraps so each createNode invocation:
//       a) if node.codeRef is set, dispatches to the imported module's
//          default export (returns a placeholder Group that grafts the
//          imported module's output once it resolves — sync contract).
//       b) if node.codeRef is null/empty, falls back to defaultRenderModeFactory.
//   - On import failure (resolveCodeRef rejects), the wrapper falls back
//     to defaultRenderModeFactory rather than throwing — keeps the graph
//     mounted with the default visual.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Group, Mesh, PlaneGeometry, Vector3, type Object3D } from 'three';
import {
  buildPerNodeFactory,
  resolveCodeRef,
  __resetCodeRefCache,
} from '@/lib/prism/runtime/factories/coderef-factory';
import type {
  CreateNodeFn,
  NodeContext,
} from '@/lib/prism/runtime/shared/adapter';
import type { PrismNode } from '@/lib/prism-graph/types';

function makeCtx(): NodeContext {
  return {
    textureLoader: { loadTexture: async () => ({} as never) } as unknown as NodeContext['textureLoader'],
    glbLoader: { loadGLB: async () => ({ scene: new Group() } as never) } as unknown as NodeContext['glbLoader'],
    fontAtlas: {
      ready: true,
      load: async () => {},
      createText: () => new Group(),
      dispose: () => {},
    } as unknown as NodeContext['fontAtlas'],
    primitives: new Proxy({}, {
      get: () => () => ({ timeline: { kill: () => {} }, cleanup: () => {} }),
    }) as unknown as NodeContext['primitives'],
    emit: () => {},
  };
}

function makeNode(overrides: Partial<PrismNode>): PrismNode {
  return {
    nodeId: 'n1',
    subtype: 'hero',
    parentHubId: 'home',
    serviceTag: 'static',
    visual: {
      transform: { x: 0, y: 0, z: 0, width: 100, height: 100 },
      sourceAsset: '/img/sprite.avif',
    },
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
    ...overrides,
  };
}

describe('coderef-factory (HL09)', () => {
  beforeEach(() => {
    __resetCodeRefCache();
  });

  describe('module surface', () => {
    it('exports resolveCodeRef and buildPerNodeFactory as functions', () => {
      expect(typeof resolveCodeRef).toBe('function');
      expect(typeof buildPerNodeFactory).toBe('function');
    });
  });

  describe('resolveCodeRef caching', () => {
    it('returns the same Promise for the same url across calls', () => {
      const url = '/prism-mock/home/nodes/cta-hero.code.js';
      const a = resolveCodeRef(url);
      const b = resolveCodeRef(url);
      expect(a).toBe(b);
      // Suppress: the URL won't resolve in node test env; we only care
      // about reference equality.
      a.catch(() => {});
    });

    it('returns different promises for different urls', () => {
      const a = resolveCodeRef('/prism-mock/home/nodes/x.code.js');
      const b = resolveCodeRef('/prism-mock/home/nodes/y.code.js');
      expect(a).not.toBe(b);
      a.catch(() => {});
      b.catch(() => {});
    });
  });

  describe('buildPerNodeFactory dispatch', () => {
    it('falls back to the default factory when node.codeRef is empty', () => {
      const sentinelGroup = new Group();
      sentinelGroup.name = 'default-sentinel';
      const defaultFactory = vi.fn<CreateNodeFn>(() => sentinelGroup);

      const wrapper = buildPerNodeFactory(defaultFactory);
      const node = makeNode({ codeRef: '' });
      const ctx = makeCtx();

      const out = wrapper(node, ctx);
      expect(defaultFactory).toHaveBeenCalledTimes(1);
      expect(defaultFactory).toHaveBeenCalledWith(node, ctx);
      expect(out).toBe(sentinelGroup);
    });

    it('falls back to the default factory when node.codeRef is null/undefined', () => {
      const sentinelGroup = new Group();
      const defaultFactory = vi.fn<CreateNodeFn>(() => sentinelGroup);
      const wrapper = buildPerNodeFactory(defaultFactory);

      const node = makeNode({ codeRef: null as unknown as string });
      const ctx = makeCtx();
      wrapper(node, ctx);

      expect(defaultFactory).toHaveBeenCalledTimes(1);
    });

    it('returns a Group synchronously for codeRef nodes (sync createNode contract)', () => {
      const defaultFactory: CreateNodeFn = () => new Group();
      const wrapper = buildPerNodeFactory(defaultFactory);
      const node = makeNode({ nodeId: 'home-cta', codeRef: '/never-resolves.code.js' });
      const out = wrapper(node, makeCtx());
      expect(out).toBeInstanceOf(Group);
      expect(out.name).toContain('home-cta');
    });

    it('grafts the codeRef module output as a child once the import resolves', async () => {
      // Inject a pre-resolved module into the cache via the test escape
      // hatch. The wrapper consumes the cache by calling resolveCodeRef
      // internally so we verify the public path end-to-end.
      const importedFactory: CreateNodeFn = () => {
        const g = new Group();
        g.name = 'imported-default-export';
        const m = new Mesh(new PlaneGeometry(1, 1));
        m.name = 'imported-mesh';
        g.add(m);
        return g;
      };
      __resetCodeRefCache({ '/imported.code.js': importedFactory });

      const defaultFactory: CreateNodeFn = () => new Group();
      const wrapper = buildPerNodeFactory(defaultFactory);
      const node = makeNode({ nodeId: 'home-cta', codeRef: '/imported.code.js' });
      const out = wrapper(node, makeCtx());

      // Yield twice so the resolved cache promise + the grafting microtask
      // have a chance to fire.
      await Promise.resolve();
      await Promise.resolve();

      const grafted = findChildByName(out, 'imported-default-export');
      expect(grafted).toBeDefined();
      expect(grafted?.children.find((c) => c.name === 'imported-mesh')).toBeDefined();
    });

    it('falls back to the default factory when the codeRef import rejects', async () => {
      // Wire a rejecting cache entry so the wrapper has to degrade gracefully.
      __resetCodeRefCache({ '/broken.code.js': '__reject__' });

      const sentinelGroup = new Group();
      sentinelGroup.name = 'default-fallback-sentinel';
      const defaultFactory = vi.fn<CreateNodeFn>(() => sentinelGroup);

      const wrapper = buildPerNodeFactory(defaultFactory);
      const node = makeNode({ nodeId: 'home-broken', codeRef: '/broken.code.js' });
      const out = wrapper(node, makeCtx());

      // The synchronous return is the wrapper's placeholder Group.
      expect(out).toBeInstanceOf(Group);

      // Yield so the rejection handler runs.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // After the rejection, the default factory should have been invoked
      // and its output grafted into the placeholder.
      expect(defaultFactory).toHaveBeenCalledTimes(1);
      const grafted = findChildByName(out, 'default-fallback-sentinel');
      expect(grafted).toBeDefined();
    });

    it('does not compound scenePosition when grafting (world pos === spec, not 2×)', async () => {
      // Regression: both the wrapper placeholder and the codeRef module
      // root apply scenePosition. Without resetting the grafted child to
      // identity, world position would compound (parent.pos + child.pos).
      const importedFactory: CreateNodeFn = (cfg) => {
        const g = new Group();
        g.name = `imported:${cfg.nodeId}`;
        // codeRef modules typically apply scenePosition to the returned
        // root themselves (cta-hero.code.js does exactly this).
        const sp = cfg.scenePosition;
        if (sp) {
          g.position.set(sp.x, sp.y, sp.z);
          g.rotation.set(sp.rotationX, sp.rotationY, sp.rotationZ);
          g.scale.set(sp.scaleX, sp.scaleY, sp.scaleZ);
        }
        return g;
      };
      __resetCodeRefCache({ '/positioned.code.js': importedFactory });

      const defaultFactory: CreateNodeFn = () => new Group();
      const wrapper = buildPerNodeFactory(defaultFactory);

      const node = makeNode({
        nodeId: 'home-cta',
        codeRef: '/positioned.code.js',
        scenePosition: {
          x: 5, y: 0, z: 0,
          rotationX: 0, rotationY: 0, rotationZ: 0,
          scaleX: 1, scaleY: 1, scaleZ: 1,
        },
      });
      const placeholder = wrapper(node, makeCtx());

      await Promise.resolve();
      await Promise.resolve();

      // Spec §8: returned Object3D's world position must match scenePosition.
      placeholder.updateMatrixWorld(true);
      const grafted = findChildByName(placeholder, 'imported:home-cta')!;
      const worldPos = new Vector3();
      grafted.getWorldPosition(worldPos);
      expect(worldPos.x).toBeCloseTo(5, 5);
      expect(worldPos.y).toBeCloseTo(0, 5);
      expect(worldPos.z).toBeCloseTo(0, 5);
    });

    it('copies handlers from grafted codeRef module to placeholder userData', async () => {
      const onClick = vi.fn();
      const importedFactory: CreateNodeFn = () => {
        const g = new Group();
        g.name = 'imported-with-handlers';
        g.userData.handlers = { onClick };
        return g;
      };
      __resetCodeRefCache({ '/handlers.code.js': importedFactory });

      const defaultFactory: CreateNodeFn = () => new Group();
      const wrapper = buildPerNodeFactory(defaultFactory);
      const node = makeNode({ nodeId: 'home-handlers', codeRef: '/handlers.code.js' });
      const placeholder = wrapper(node, makeCtx());

      await Promise.resolve();
      await Promise.resolve();

      const handlers = (placeholder.userData as { handlers?: Record<string, unknown> }).handlers;
      expect(handlers).toBeDefined();
      expect(handlers!.onClick).toBe(onClick);
    });

    it('caches resolved modules across multiple node invocations', async () => {
      let importCount = 0;
      const importedFactory: CreateNodeFn = (cfg) => {
        importCount += 1;
        const g = new Group();
        g.name = `imported:${cfg.nodeId}`;
        return g;
      };
      __resetCodeRefCache({ '/shared.code.js': importedFactory });

      const defaultFactory: CreateNodeFn = () => new Group();
      const wrapper = buildPerNodeFactory(defaultFactory);

      wrapper(makeNode({ nodeId: 'a', codeRef: '/shared.code.js' }), makeCtx());
      wrapper(makeNode({ nodeId: 'b', codeRef: '/shared.code.js' }), makeCtx());

      await Promise.resolve();
      await Promise.resolve();

      // The factory itself was called once per node, but the module fetch
      // (resolveCodeRef) cached after the first call — verifiable via
      // resolveCodeRef returning the same promise.
      const p1 = resolveCodeRef('/shared.code.js');
      const p2 = resolveCodeRef('/shared.code.js');
      expect(p1).toBe(p2);
      expect(importCount).toBe(2);
    });
  });
});

function findChildByName(root: Object3D, name: string): Object3D | undefined {
  if (root.name === name) return root;
  for (const c of root.children) {
    const found = findChildByName(c, name);
    if (found) return found;
  }
  return undefined;
}
