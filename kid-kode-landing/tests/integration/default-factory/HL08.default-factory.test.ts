// HL08 — Default render-mode factory.
//
// Plan ref: §P8 (default render-mode factory).
// Spec refs: PRISM-RENDERER-MIGRATION-SPEC.md §4 (RenderMode), §6 (Asset
// pipeline), §7 (Cinematic primitives), §8 (createNode contract).
//
// Acceptance:
//   - src/lib/prism/runtime/factories/default-factory.ts exports
//     defaultRenderModeFactory(node, ctx, opts?: { runPrimitives }): Object3D.
//   - Dispatch by node.renderMode: sprite, plane, parallax-plane, mesh.
//   - applyScenePosition is invoked.
//   - node.intent.visualSpec.textContent → fontAtlas.createText per entry.
//   - opts.runPrimitives gates the primitives loop.
//   - userData.cleanup walks primitive cleanups + GSAP timelines and disposes
//     geometry/material — but does NOT dispose loader-cache textures
//     (Amendment 0002 §A.2 ownership rule).
//   - userData.handlers empty by default.

import { describe, expect, it, vi } from 'vitest';
import {
  Group,
  Mesh,
  PlaneGeometry,
  Texture,
  type Object3D,
} from 'three';
import * as THREE_NS from 'three';
import {
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
} from 'three/webgpu';
import { defaultRenderModeFactory } from '@/lib/prism/runtime/factories/default-factory';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';
import type {
  CinematicPrimitiveRef,
  PrismNode,
  PrismTextContent,
  ScenePosition,
} from '@/lib/prism-graph/types';

interface PrimitiveCleanupSpy {
  killed: boolean;
  cleaned: boolean;
}

function makePrimitive(name: CinematicPrimitiveRef['name']): {
  ref: CinematicPrimitiveRef;
  spy: PrimitiveCleanupSpy;
} {
  const ref: CinematicPrimitiveRef = { name, params: {}, trigger: 'load' };
  const spy: PrimitiveCleanupSpy = { killed: false, cleaned: false };
  return { ref, spy };
}

function makeCtx(overrides: Partial<NodeContext> = {}): {
  ctx: NodeContext;
  textureLoadCalls: string[];
  glbLoadCalls: string[];
  fontAtlasCalls: Array<{ content: string; opts: unknown }>;
  primitiveCalls: Array<{ name: string; target: Object3D; params: unknown }>;
  primitiveSpies: Map<string, PrimitiveCleanupSpy>;
} {
  const textureLoadCalls: string[] = [];
  const glbLoadCalls: string[] = [];
  const fontAtlasCalls: Array<{ content: string; opts: unknown }> = [];
  const primitiveCalls: Array<{ name: string; target: Object3D; params: unknown }> = [];
  const primitiveSpies = new Map<string, PrimitiveCleanupSpy>();

  const dummyTimeline = {
    kill: vi.fn(),
    play: () => {},
    pause: () => {},
  };

  const ctx: NodeContext = {
    THREE: THREE_NS,
    textureLoader: {
      loadTexture: async (url: string) => {
        textureLoadCalls.push(url);
        const t = new Texture();
        (t as unknown as { __url?: string }).__url = url;
        return t;
      },
    } as unknown as NodeContext['textureLoader'],
    glbLoader: {
      loadGLB: async (url: string) => {
        glbLoadCalls.push(url);
        const inner = new Group();
        inner.name = `glb:${url}`;
        const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicNodeMaterial());
        m.name = 'glb-inner-mesh';
        inner.add(m);
        return { scene: inner };
      },
    } as unknown as NodeContext['glbLoader'],
    fontAtlas: {
      ready: true,
      load: async () => {},
      createText: (content: string, opts?: unknown) => {
        fontAtlasCalls.push({ content, opts });
        const placeholder = new Group();
        placeholder.name = `text:${content}`;
        return placeholder;
      },
      dispose: () => {},
    } as unknown as NodeContext['fontAtlas'],
    primitives: new Proxy({}, {
      get(_target, prop) {
        const name = String(prop);
        return (target: Object3D, params: unknown) => {
          primitiveCalls.push({ name, target, params });
          const spy: PrimitiveCleanupSpy = primitiveSpies.get(name) ?? { killed: false, cleaned: false };
          primitiveSpies.set(name, spy);
          return {
            timeline: { ...dummyTimeline, kill: () => { spy.killed = true; } },
            cleanup: () => { spy.cleaned = true; },
          };
        };
      },
    }) as unknown as NodeContext['primitives'],
    emit: () => {},
    ...overrides,
  };

  return { ctx, textureLoadCalls, glbLoadCalls, fontAtlasCalls, primitiveCalls, primitiveSpies };
}

const POSITION_AT_5_5_5: ScenePosition = {
  x: 5, y: 5, z: 5,
  rotationX: 0.1, rotationY: 0.2, rotationZ: 0.3,
  scaleX: 2, scaleY: 2, scaleZ: 2,
};

function makeNode(overrides: Partial<PrismNode>): PrismNode {
  const text: PrismTextContent[] = [];
  return {
    nodeId: 'n1',
    subtype: 'hero',
    parentHubId: 'home',
    serviceTag: 'static',
    visual: {
      transform: { x: 0, y: 0, z: 0, width: 100, height: 100 },
      sourceAsset: '/img/hero.avif',
    },
    intent: {
      caption: '',
      behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
      stateEffects: [],
      visualSpec: { textContent: text, layers: [] },
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

describe('defaultRenderModeFactory (HL08)', () => {
  describe('module surface', () => {
    it('exports defaultRenderModeFactory as a function', () => {
      expect(typeof defaultRenderModeFactory).toBe('function');
    });

    it('returns a THREE.Group with userData.cleanup and userData.handlers', () => {
      const { ctx } = makeCtx();
      const obj = defaultRenderModeFactory(makeNode({}), ctx);
      expect(obj).toBeInstanceOf(Group);
      expect(typeof (obj.userData as { cleanup?: unknown }).cleanup).toBe('function');
      expect((obj.userData as { handlers?: unknown }).handlers).toBeDefined();
    });

    it('tags the group name with the node id', () => {
      const { ctx } = makeCtx();
      const obj = defaultRenderModeFactory(makeNode({ nodeId: 'home-cta' }), ctx);
      expect(obj.name).toContain('home-cta');
    });
  });

  describe('renderMode: sprite', () => {
    it('builds a PlaneGeometry mesh with MeshBasicNodeMaterial', () => {
      const { ctx, textureLoadCalls } = makeCtx();
      const node = makeNode({ renderMode: 'sprite', visual: { transform: { x: 0, y: 0, z: 0, width: 100, height: 100 }, sourceAsset: '/img/sprite.avif' } });
      const obj = defaultRenderModeFactory(node, ctx);
      const mesh = obj.children.find((c) => c instanceof Mesh) as Mesh | undefined;
      expect(mesh).toBeDefined();
      expect(mesh!.geometry).toBeInstanceOf(PlaneGeometry);
      expect(mesh!.material).toBeInstanceOf(MeshBasicNodeMaterial);
      expect(textureLoadCalls).toContain('/img/sprite.avif');
    });

    it('omits the texture load when sourceAsset is missing', () => {
      const { ctx, textureLoadCalls } = makeCtx();
      const node = makeNode({ renderMode: 'sprite', visual: { transform: { x: 0, y: 0, z: 0, width: 100, height: 100 } } });
      defaultRenderModeFactory(node, ctx);
      expect(textureLoadCalls).toEqual([]);
    });
  });

  describe('renderMode: plane', () => {
    it('builds a PlaneGeometry mesh with MeshBasicNodeMaterial and loads sourceAsset', () => {
      const { ctx, textureLoadCalls } = makeCtx();
      const node = makeNode({ renderMode: 'plane', visual: { transform: { x: 0, y: 0, z: 0, width: 100, height: 100 }, sourceAsset: '/img/plane.avif' } });
      const obj = defaultRenderModeFactory(node, ctx);
      const mesh = obj.children.find((c) => c instanceof Mesh) as Mesh | undefined;
      expect(mesh).toBeDefined();
      expect(mesh!.material).toBeInstanceOf(MeshBasicNodeMaterial);
      expect(textureLoadCalls).toContain('/img/plane.avif');
    });
  });

  describe('renderMode: parallax-plane', () => {
    it('defaults UNLIT — MeshBasicNodeMaterial (§10 decision 7 / criterion 17) — and loads both base + depth textures', () => {
      // §10 of PRISM-CANVAS-EDITOR-SPEC (decision 7, criterion 17): an image
      // plane is UNLIT by default so the diffusion-baked texture renders
      // verbatim (pixel-identical at T0/T1). The migration-era
      // MeshStandardNodeMaterial default is superseded; a revert to a LIT
      // default for image planes fails here.
      const { ctx, textureLoadCalls } = makeCtx();
      const node = makeNode({
        renderMode: 'parallax-plane',
        visual: { transform: { x: 0, y: 0, z: 0, width: 100, height: 100 }, sourceAsset: '/img/base.avif' },
        depthMapUrl: '/img/depth.avif',
      });
      const obj = defaultRenderModeFactory(node, ctx);
      const mesh = obj.children.find((c) => c instanceof Mesh) as Mesh | undefined;
      expect(mesh).toBeDefined();
      expect(mesh!.geometry).toBeInstanceOf(PlaneGeometry);
      expect(mesh!.material).toBeInstanceOf(MeshBasicNodeMaterial);
      expect(mesh!.material).not.toBeInstanceOf(MeshStandardNodeMaterial);
      // Unlit materials keep their color exact — never tone-mapped.
      expect((mesh!.material as { toneMapped?: boolean }).toneMapped).toBe(false);
      expect(textureLoadCalls).toContain('/img/base.avif');
      expect(textureLoadCalls).toContain('/img/depth.avif');
    });

    it('opts INTO lighting with receivesLighting: true → MeshStandardNodeMaterial (§10 lit lane)', () => {
      // The lit lane survives as an explicit opt-in: a node that sets
      // receivesLighting=true catches scene light via the standard node
      // material. This pins both halves of criterion 17.
      const { ctx } = makeCtx();
      const node = makeNode({
        renderMode: 'parallax-plane',
        receivesLighting: true,
        visual: { transform: { x: 0, y: 0, z: 0, width: 100, height: 100 }, sourceAsset: '/img/base.avif' },
        depthMapUrl: '/img/depth.avif',
      });
      const obj = defaultRenderModeFactory(node, ctx);
      const mesh = obj.children.find((c) => c instanceof Mesh) as Mesh | undefined;
      expect(mesh).toBeDefined();
      expect(mesh!.material).toBeInstanceOf(MeshStandardNodeMaterial);
    });
  });

  describe('renderMode: mesh', () => {
    it('calls glbLoader.loadGLB with node.meshUrl', () => {
      const { ctx, glbLoadCalls } = makeCtx();
      const node = makeNode({ renderMode: 'mesh', meshUrl: '/glb/hero.glb' });
      defaultRenderModeFactory(node, ctx);
      expect(glbLoadCalls).toContain('/glb/hero.glb');
    });

    it('returns a Group even before the GLB resolves (sync contract)', () => {
      const { ctx } = makeCtx();
      const node = makeNode({ renderMode: 'mesh', meshUrl: '/glb/hero.glb' });
      const obj = defaultRenderModeFactory(node, ctx);
      expect(obj).toBeInstanceOf(Group);
    });

    it('does not crash when meshUrl is missing', () => {
      const { ctx, glbLoadCalls } = makeCtx();
      const node = makeNode({ renderMode: 'mesh', meshUrl: null });
      const obj = defaultRenderModeFactory(node, ctx);
      expect(obj).toBeInstanceOf(Group);
      expect(glbLoadCalls).toEqual([]);
    });

    it('clones the cached GLB scene per node (loader cache hands out the same Object3D)', async () => {
      // Loader cache returns the same scene reference to every caller; without
      // a per-node clone, Group A's .add(scene) unparents it from Group B
      // (Three.js silently re-parents).
      const sharedScene = new Group();
      sharedScene.name = 'shared-glb-scene';
      const innerMesh = new Mesh(new PlaneGeometry(1, 1), new MeshBasicNodeMaterial());
      sharedScene.add(innerMesh);

      const aliasingCtx: NodeContext = {
        textureLoader: { loadTexture: async () => new Texture() } as unknown as NodeContext['textureLoader'],
        glbLoader: {
          loadGLB: async () => ({ scene: sharedScene }),
        } as unknown as NodeContext['glbLoader'],
        fontAtlas: {
          ready: true,
          load: async () => {},
          createText: () => new Group(),
          dispose: () => {},
        } as unknown as NodeContext['fontAtlas'],
        primitives: {} as NodeContext['primitives'],
        emit: () => {},
      };

      const a = defaultRenderModeFactory(makeNode({ nodeId: 'a', renderMode: 'mesh', meshUrl: '/glb/x.glb' }), aliasingCtx);
      const b = defaultRenderModeFactory(makeNode({ nodeId: 'b', renderMode: 'mesh', meshUrl: '/glb/x.glb' }), aliasingCtx);

      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      // Both groups must end up with their own GLB-derived child.
      expect(a.children.length).toBeGreaterThan(0);
      expect(b.children.length).toBeGreaterThan(0);
      // The cached scene itself must not have been re-parented (each node
      // got a clone, not the original).
      expect(a.children[0]).not.toBe(sharedScene);
      expect(b.children[0]).not.toBe(sharedScene);
      expect(a.children[0]).not.toBe(b.children[0]);
    });
  });

  describe('scenePosition', () => {
    it('applies position/rotation/scale from node.scenePosition', () => {
      const { ctx } = makeCtx();
      const obj = defaultRenderModeFactory(
        makeNode({ scenePosition: POSITION_AT_5_5_5 }),
        ctx,
      );
      expect(obj.position.x).toBeCloseTo(5);
      expect(obj.position.y).toBeCloseTo(5);
      expect(obj.position.z).toBeCloseTo(5);
      expect(obj.rotation.x).toBeCloseTo(0.1);
      expect(obj.scale.x).toBeCloseTo(2);
    });
  });

  describe('textContent → fontAtlas', () => {
    it('calls ctx.fontAtlas.createText for each entry under node.intent.visualSpec.textContent', () => {
      const { ctx, fontAtlasCalls } = makeCtx();
      const node = makeNode({
        intent: {
          caption: '',
          behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
          stateEffects: [],
          visualSpec: {
            textContent: [
              { text: 'Headline', role: 'headline', renderMethod: 'msdf' },
              { text: 'Body', role: 'body', renderMethod: 'msdf' },
            ],
            layers: [],
          },
          contracts: { inputs: {}, outputs: {} },
        },
      });
      const obj = defaultRenderModeFactory(node, ctx);
      const texts = fontAtlasCalls.map((c) => c.content);
      expect(texts).toContain('Headline');
      expect(texts).toContain('Body');
      // The text objects are added as children of the returned group.
      const textChildren = obj.children.filter((c) => /^text:/.test(c.name));
      expect(textChildren.length).toBe(2);
    });

    it('skips textContent entries with empty text', () => {
      const { ctx, fontAtlasCalls } = makeCtx();
      const node = makeNode({
        intent: {
          caption: '',
          behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
          stateEffects: [],
          visualSpec: {
            textContent: [
              { text: '', role: 'headline', renderMethod: 'msdf' },
            ],
            layers: [],
          },
          contracts: { inputs: {}, outputs: {} },
        },
      });
      defaultRenderModeFactory(node, ctx);
      expect(fontAtlasCalls).toEqual([]);
    });
  });

  describe('cinematic primitives gating', () => {
    it('does NOT invoke primitives when opts.runPrimitives is false (default)', () => {
      const { ctx, primitiveCalls } = makeCtx();
      const { ref: orbit } = makePrimitive('orbit');
      const node = makeNode({ cinematicPrimitives: [orbit] });
      defaultRenderModeFactory(node, ctx);
      expect(primitiveCalls).toEqual([]);
    });

    it('invokes ctx.primitives[name](target, params) for each entry when opts.runPrimitives is true', () => {
      const { ctx, primitiveCalls } = makeCtx();
      const { ref: orbit } = makePrimitive('orbit');
      const { ref: depth } = makePrimitive('depth-rotate');
      const node = makeNode({ cinematicPrimitives: [orbit, depth] });
      const obj = defaultRenderModeFactory(node, ctx, { runPrimitives: true });
      const names = primitiveCalls.map((c) => c.name);
      expect(names).toEqual(['orbit', 'depth-rotate']);
      // Each call's target is the returned Group itself.
      for (const call of primitiveCalls) {
        expect(call.target).toBe(obj);
      }
    });
  });

  describe('cleanup contract', () => {
    it('walks primitive.cleanup and timeline.kill when userData.cleanup runs', () => {
      const { ctx, primitiveSpies } = makeCtx();
      const { ref: orbit } = makePrimitive('orbit');
      const node = makeNode({ cinematicPrimitives: [orbit] });
      const obj = defaultRenderModeFactory(node, ctx, { runPrimitives: true });
      const cleanup = (obj.userData as { cleanup: () => void }).cleanup;
      cleanup();
      const spy = primitiveSpies.get('orbit');
      expect(spy?.cleaned).toBe(true);
      expect(spy?.killed).toBe(true);
    });

    it('disposes the geometry and the material but does NOT dispose loader-cache textures', async () => {
      let texDisposed = false;
      const { ctx } = makeCtx({
        textureLoader: {
          loadTexture: async () => {
            const t = new Texture();
            t.dispose = () => { texDisposed = true; };
            return t;
          },
        } as unknown as NodeContext['textureLoader'],
      });
      const node = makeNode({ renderMode: 'sprite', visual: { transform: { x: 0, y: 0, z: 0, width: 100, height: 100 }, sourceAsset: '/img/sprite.avif' } });
      const obj = defaultRenderModeFactory(node, ctx);
      const mesh = obj.children.find((c) => c instanceof Mesh) as Mesh;
      const geoDisposeSpy = vi.spyOn(mesh.geometry, 'dispose');
      const matDisposeSpy = vi.spyOn(mesh.material as MeshBasicNodeMaterial, 'dispose');

      // Allow texture promise to resolve before cleanup
      await new Promise((r) => setImmediate(r));

      const cleanup = (obj.userData as { cleanup: () => void }).cleanup;
      cleanup();

      expect(geoDisposeSpy).toHaveBeenCalled();
      expect(matDisposeSpy).toHaveBeenCalled();
      // Loader cache owns the texture lifetime — Amendment 0002 §A.2.
      expect(texDisposed).toBe(false);
    });
  });
});
