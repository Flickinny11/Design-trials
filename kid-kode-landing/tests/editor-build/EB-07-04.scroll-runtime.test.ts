// EB-07-04 — Runtime integration: setScrollProgress + per-node consumer.
//
// Spec refs:
//   §7  SC-039  Nodes with `scrollBinding?` consume scrollProgress.
//   §7  SC-040  Scrolling in `preview-hub` mode reads as app UI (per-element
//               response), not whole-scene movement.
//
// This file covers the runtime surface only — the pure layer (computeScroll
// Progress, applyScrollBindings, schema additivity) lives in
// `EB-07-04.scroll-timeline.test.ts`.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

import { mountFromGraphSource } from '@/lib/prism/runtime/mount-graph';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';
import type {
  GraphSource,
  PrismHub,
  PrismNode,
  ScrollBinding,
} from '@/lib/prism-graph/types';

function ctxStub(): NodeContext {
  return {
    textureLoader: {
      loadTexture: async () => new THREE.Texture(),
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

function makeHub(): PrismHub {
  return {
    hubId: 'home',
    title: 'Home',
    layout: {
      viewportWidth: 1280,
      viewportHeight: 720,
      contentHeight: 2400,
      backgroundColor: '#04050a',
      mockupUrl: null,
    },
  };
}

function makeNode(id: string, scrollBinding?: ScrollBinding[]): PrismNode {
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
    scrollBinding,
  };
}

function makeSource(nodes: PrismNode[]): GraphSource {
  return { hubs: [makeHub()], nodes, edges: [] };
}

// ---------------------------------------------------------------------------
// 1. mountFromGraphSource exposes setScrollProgress.
// ---------------------------------------------------------------------------

describe('EB-07-04 — mountFromGraphSource.setScrollProgress (SC-039)', () => {
  it('exposes a setScrollProgress(progress: number) helper', async () => {
    const result = await mountFromGraphSource(
      undefined,
      makeSource([makeNode('n1')]),
      ctxStub(),
      { noRenderer: true },
    );
    expect(typeof result.setScrollProgress).toBe('function');
    result.unmount();
  });

  it('moves nodes with scrollBinding when scrollProgress changes', async () => {
    const bound = makeNode('bound', [
      { property: 'translateY', from: 0, to: -200 },
    ]);
    const result = await mountFromGraphSource(
      undefined,
      makeSource([bound]),
      ctxStub(),
      { noRenderer: true },
    );

    const obj = result.adapterResult.nodes.get('bound')!;
    expect(obj.position.y).toBe(0);

    result.setScrollProgress(0.5);
    expect(obj.position.y).toBeCloseTo(-100, 6);

    result.setScrollProgress(1);
    expect(obj.position.y).toBeCloseTo(-200, 6);

    result.unmount();
  });

  it('does NOT move nodes without scrollBinding when progress changes', async () => {
    const free = makeNode('free'); // no scrollBinding
    const result = await mountFromGraphSource(
      undefined,
      makeSource([free]),
      ctxStub(),
      { noRenderer: true },
    );

    const obj = result.adapterResult.nodes.get('free')!;
    const before = { x: obj.position.x, y: obj.position.y, z: obj.position.z };

    result.setScrollProgress(0.5);
    result.setScrollProgress(1);

    expect(obj.position.x).toBe(before.x);
    expect(obj.position.y).toBe(before.y);
    expect(obj.position.z).toBe(before.z);

    result.unmount();
  });

  it('SC-040: camera position is unchanged across scrollProgress 0→1 (no whole-scene movement)', async () => {
    const bound = makeNode('bound', [
      { property: 'translateY', from: 0, to: -200 },
    ]);
    const result = await mountFromGraphSource(
      undefined,
      makeSource([bound]),
      ctxStub(),
      { noRenderer: true },
    );

    const cam = result.sceneRoot.camera;
    const beforePos = cam.position.clone();
    const beforeRot = cam.rotation.clone();

    result.setScrollProgress(0);
    result.setScrollProgress(0.5);
    result.setScrollProgress(1);

    expect(cam.position.x).toBeCloseTo(beforePos.x, 6);
    expect(cam.position.y).toBeCloseTo(beforePos.y, 6);
    expect(cam.position.z).toBeCloseTo(beforePos.z, 6);
    expect(cam.rotation.x).toBeCloseTo(beforeRot.x, 6);
    expect(cam.rotation.y).toBeCloseTo(beforeRot.y, 6);
    expect(cam.rotation.z).toBeCloseTo(beforeRot.z, 6);

    result.unmount();
  });

  it('SC-040: sceneRoot.scene position/rotation is unchanged across scrollProgress 0→1', async () => {
    const bound = makeNode('bound', [
      { property: 'translateY', from: 0, to: -200 },
    ]);
    const result = await mountFromGraphSource(
      undefined,
      makeSource([bound]),
      ctxStub(),
      { noRenderer: true },
    );

    const scene = result.sceneRoot.scene;
    const sx = scene.position.x, sy = scene.position.y, sz = scene.position.z;
    const rx = scene.rotation.x, ry = scene.rotation.y, rz = scene.rotation.z;

    result.setScrollProgress(0.25);
    result.setScrollProgress(0.75);
    result.setScrollProgress(1);

    expect(scene.position.x).toBe(sx);
    expect(scene.position.y).toBe(sy);
    expect(scene.position.z).toBe(sz);
    expect(scene.rotation.x).toBe(rx);
    expect(scene.rotation.y).toBe(ry);
    expect(scene.rotation.z).toBe(rz);

    result.unmount();
  });

  it('upsertNode picks up a fresh scrollBinding without remount', async () => {
    const free = makeNode('n', []);
    const result = await mountFromGraphSource(
      undefined,
      makeSource([free]),
      ctxStub(),
      { noRenderer: true },
    );
    result.setScrollProgress(1);
    const obj1 = result.adapterResult.nodes.get('n')!;
    const yBefore = obj1.position.y;

    result.upsertNode(makeNode('n', [{ property: 'translateY', from: 0, to: 100 }]));
    result.setScrollProgress(1);
    const obj2 = result.adapterResult.nodes.get('n')!;
    expect(obj2.position.y).toBeCloseTo(100, 6);
    expect(obj2.position.y).not.toBe(yBefore);

    result.unmount();
  });

  it('unmount() does not throw even with scrollBindings installed', async () => {
    const bound = makeNode('bound', [
      { property: 'opacity', from: 0, to: 1 },
    ]);
    const result = await mountFromGraphSource(
      undefined,
      makeSource([bound]),
      ctxStub(),
      { noRenderer: true },
    );
    result.setScrollProgress(0.5);
    expect(() => result.unmount()).not.toThrow();
  });
});
