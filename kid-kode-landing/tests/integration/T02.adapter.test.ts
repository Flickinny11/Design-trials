// T02 — Adapter maps PrismGraph -> THREE scene tree.
//
// Spec: §11 (shared/adapter.js: "Now adapts to THREE scene tree") + §8
// (createNode contract). Adapter calls a CreateNodeFn for each node and
// parents the result under its hub group. ScenePosition is applied.
//
// Adapter does NOT mount the hubs on sceneRoot — HubManager does.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  adaptGraphToScene,
  applyScenePosition,
  type CreateNodeFn,
  type NodeContext,
} from '@/lib/prism/runtime/shared/adapter';
import type { GraphSource, PrismHub, PrismNode } from '@/lib/prism-graph/types';

function ctxStub(): NodeContext {
  return {
    textureLoader: {
      loadTexture: () => Promise.resolve(new THREE.Texture()),
      loadGLB: () => Promise.resolve({ scene: new THREE.Group() }),
      has: () => false,
      size: () => 0,
      dispose: () => {},
    } as unknown as NodeContext['textureLoader'],
    glbLoader: {
      loadTexture: () => Promise.resolve(new THREE.Texture()),
      loadGLB: () => Promise.resolve({ scene: new THREE.Group() }),
      has: () => false,
      size: () => 0,
      dispose: () => {},
    } as unknown as NodeContext['glbLoader'],
    fontAtlas: {
      ready: false,
      load: async () => {},
      createText: () => new THREE.Group(),
      dispose: () => {},
    },
    primitives: {} as NodeContext['primitives'],
    emit: () => {},
  };
}

const hubA: PrismHub = {
  hubId: 'home',
  title: 'Home',
  layout: { viewportWidth: 1920, viewportHeight: 1080, contentHeight: 3000, backgroundColor: '#000' },
};

const hubB: PrismHub = {
  hubId: 'features',
  title: 'Features',
  layout: { viewportWidth: 1920, viewportHeight: 1080, contentHeight: 3000, backgroundColor: '#111' },
};

function n(id: string, hub: string, position?: Partial<PrismNode['scenePosition']>): PrismNode {
  return {
    nodeId: id,
    subtype: 'hero',
    parentHubId: hub,
    serviceTag: 'static',
    visual: { transform: { x: 0, y: 0, width: 100, height: 100, z: 0 } },
    intent: {
      caption: '',
      behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: '',
    backendRef: null,
    scenePosition: position
      ? { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1, ...position }
      : undefined,
  };
}

describe('adaptGraphToScene', () => {
  it('creates one Group per hub, keyed by hubId', () => {
    const graph: GraphSource = {
      hubs: [hubA, hubB],
      nodes: [n('hero', 'home'), n('cta', 'features')],
      edges: [],
    };
    const result = adaptGraphToScene(graph, ctxStub());
    expect(result.hubs.size).toBe(2);
    expect(result.hubs.get('home')).toBeInstanceOf(THREE.Group);
    expect(result.hubs.get('features')).toBeInstanceOf(THREE.Group);
    expect(result.hubOrder.map((h) => h.hubId)).toEqual(['home', 'features']);
  });

  it('parents each node Object3D under its hub group', () => {
    const graph: GraphSource = {
      hubs: [hubA],
      nodes: [n('hero', 'home'), n('cta', 'home')],
      edges: [],
    };
    const result = adaptGraphToScene(graph, ctxStub());
    const homeHub = result.hubs.get('home')!;
    expect(homeHub.children.length).toBe(2);
    expect(result.nodes.get('hero')!.parent).toBe(homeHub);
    expect(result.nodes.get('cta')!.parent).toBe(homeHub);
  });

  it('uses a custom CreateNodeFn when provided', () => {
    const graph: GraphSource = {
      hubs: [hubA],
      nodes: [n('hero', 'home')],
      edges: [],
    };
    const seen: PrismNode[] = [];
    const factory: CreateNodeFn = (cfg) => {
      seen.push(cfg);
      const m = new THREE.Mesh();
      m.name = `mock:${cfg.nodeId}`;
      return m;
    };
    const result = adaptGraphToScene(graph, ctxStub(), { createNode: factory });
    expect(seen.map((s) => s.nodeId)).toEqual(['hero']);
    expect(result.nodes.get('hero')!.name).toBe('mock:hero');
  });

  it('applies scenePosition to each node', () => {
    const graph: GraphSource = {
      hubs: [hubA],
      nodes: [n('hero', 'home', { x: 5, y: -2, z: 3, scaleX: 2 })],
      edges: [],
    };
    const result = adaptGraphToScene(graph, ctxStub());
    const obj = result.nodes.get('hero')!;
    expect(obj.position.x).toBe(5);
    expect(obj.position.y).toBe(-2);
    expect(obj.position.z).toBe(3);
    expect(obj.scale.x).toBe(2);
  });

  it('skips nodes whose parentHubId is not registered', () => {
    const graph: GraphSource = {
      hubs: [hubA],
      nodes: [n('orphan', 'unknown-hub')],
      edges: [],
    };
    const result = adaptGraphToScene(graph, ctxStub());
    expect(result.nodes.has('orphan')).toBe(false);
  });

  it('applyScenePosition helper writes pose onto an Object3D', () => {
    const obj = new THREE.Object3D();
    applyScenePosition(obj, {
      x: 1, y: 2, z: 3,
      rotationX: 0.1, rotationY: 0.2, rotationZ: 0.3,
      scaleX: 4, scaleY: 5, scaleZ: 6,
    });
    expect(obj.position.toArray()).toEqual([1, 2, 3]);
    expect(obj.scale.toArray()).toEqual([4, 5, 6]);
    expect(obj.rotation.x).toBeCloseTo(0.1);
  });
});
