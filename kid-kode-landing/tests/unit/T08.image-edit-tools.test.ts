// T08 unit — Editor image-edit tools.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L483 — "Image-edit mode —
// masking and crop tools become essential. The user-flagged 'swap code for
// image' → 'swap mesh for image' preserves all behavior code; the renderer
// just falls back to a flat texture from the FLUX.2 image."
//
// halt-check (ralph-state.json T08): "Image swap-in preserves behavior. Mask
// refinement works."

import { describe, expect, it } from 'vitest';
import {
  applyCrop,
  applyMaskRefinement,
  swapMeshForImage,
} from '@/lib/prism-graph/image-edit-tools';
import type { PrismNode } from '@/lib/prism-graph/types';

function meshNode(): PrismNode {
  return {
    nodeId: 'product-hero',
    subtype: 'product',
    parentHubId: 'home',
    serviceTag: 'demo',
    visual: {
      sourceAsset: 'product.png',
      transform: { x: 0, y: 0, width: 400, height: 300, z: 0 },
      shape: 'rounded',
      shapeRadius: 12,
      alpha: 1,
    },
    intent: {
      caption: 'Product hero',
      behaviorSpec: {
        interactions: [{ event: 'click', effect: 'navigate-detail' }],
        apiCalls: [{ endpoint: '/api/product/1', method: 'GET' }],
        dataBindings: [{ source: 'product.name', target: 'title' }],
        emits: ['product-clicked'],
        listens: ['cart-updated'],
        triggersDownstream: [],
      },
      stateEffects: ['cart-add'],
      visualSpec: { textContent: [], layers: [{ id: 'l1', type: 'sprite' }] },
      contracts: { inputs: { id: 'string' }, outputs: { added: 'boolean' } },
    },
    codeRef: 'nodes/product-hero.js',
    backendRef: 'backends/cart',
    renderMode: 'mesh',
    depthMapUrl: null,
    meshUrl: 'meshes/product-hero.glb',
    cinematicPrimitives: [
      { name: 'orbit', params: { speed: 0.5 }, trigger: 'load' },
      { name: 'magnetic-cursor', params: { radius: 80 }, trigger: 'hover' },
    ],
    scenePosition: {
      x: 0, y: 0, z: 0,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      scaleX: 1, scaleY: 1, scaleZ: 1,
    },
  };
}

describe('T08 swapMeshForImage (§13 L483 — preserves all behavior code)', () => {
  it('changes renderMode from mesh to sprite', () => {
    const node = meshNode();
    const out = swapMeshForImage(node);
    expect(node.renderMode).toBe('mesh'); // source unchanged
    expect(out.renderMode).toBe('sprite');
  });

  it('clears meshUrl on the result (the mesh is no longer used)', () => {
    const out = swapMeshForImage(meshNode());
    expect(out.meshUrl).toBeNull();
  });

  it('preserves the entire behaviorSpec (interactions, apiCalls, dataBindings, emits, listens, triggersDownstream)', () => {
    const before = meshNode();
    const after = swapMeshForImage(before);
    expect(after.intent.behaviorSpec).toEqual(before.intent.behaviorSpec);
  });

  it('preserves stateEffects and contracts', () => {
    const before = meshNode();
    const after = swapMeshForImage(before);
    expect(after.intent.stateEffects).toEqual(before.intent.stateEffects);
    expect(after.intent.contracts).toEqual(before.intent.contracts);
  });

  it('preserves cinematicPrimitives (behavior survives the renderer fallback)', () => {
    const before = meshNode();
    const after = swapMeshForImage(before);
    expect(after.cinematicPrimitives).toEqual(before.cinematicPrimitives);
  });

  it('preserves the codeRef and backendRef', () => {
    const before = meshNode();
    const after = swapMeshForImage(before);
    expect(after.codeRef).toBe(before.codeRef);
    expect(after.backendRef).toBe(before.backendRef);
  });

  it('does not mutate the source node', () => {
    const before = meshNode();
    const beforeJson = JSON.stringify(before);
    swapMeshForImage(before);
    expect(JSON.stringify(before)).toBe(beforeJson);
  });

  it('is idempotent on a non-mesh node (returns sprite-mode equivalent)', () => {
    const node = meshNode();
    node.renderMode = 'sprite';
    node.meshUrl = null;
    const out = swapMeshForImage(node);
    expect(out.renderMode).toBe('sprite');
    expect(out.meshUrl).toBeNull();
  });

  it('honours an optional explicit fallback render mode (sprite | plane)', () => {
    const node = meshNode();
    const out = swapMeshForImage(node, { fallbackRenderMode: 'plane' });
    expect(out.renderMode).toBe('plane');
  });
});

describe('T08 applyCrop (§13 L483 — crop tools)', () => {
  it('updates the visual.transform width/height to match the crop rect', () => {
    const node = meshNode();
    const out = applyCrop(node, { x: 10, y: 20, width: 200, height: 150 });
    expect(out.visual.transform.width).toBe(200);
    expect(out.visual.transform.height).toBe(150);
  });

  it('writes the crop rect into visual.transform.x / .y (top-left of the cropped region)', () => {
    const out = applyCrop(meshNode(), { x: 10, y: 20, width: 200, height: 150 });
    expect(out.visual.transform.x).toBe(10);
    expect(out.visual.transform.y).toBe(20);
  });

  it('preserves the z-coordinate', () => {
    const node = meshNode();
    node.visual.transform.z = 7;
    const out = applyCrop(node, { x: 0, y: 0, width: 50, height: 50 });
    expect(out.visual.transform.z).toBe(7);
  });

  it('rejects negative width or height (returns the source node unchanged)', () => {
    const node = meshNode();
    const a = applyCrop(node, { x: 0, y: 0, width: -1, height: 50 });
    const b = applyCrop(node, { x: 0, y: 0, width: 50, height: -1 });
    expect(a.visual.transform).toEqual(node.visual.transform);
    expect(b.visual.transform).toEqual(node.visual.transform);
  });

  it('does not mutate the source node', () => {
    const before = meshNode();
    const beforeJson = JSON.stringify(before);
    applyCrop(before, { x: 1, y: 2, width: 30, height: 40 });
    expect(JSON.stringify(before)).toBe(beforeJson);
  });
});

describe('T08 applyMaskRefinement (§13 L483 — masking tools)', () => {
  it('writes a mask onto the targeted layer', () => {
    const node = meshNode();
    const out = applyMaskRefinement(node, 'l1', { shape: 'circle', radius: 64 });
    const layer = out.intent.visualSpec.layers.find((l) => l.id === 'l1');
    expect(layer).toBeDefined();
    expect(layer!.mask).toEqual({ shape: 'circle', radius: 64 });
  });

  it('replaces a previously-applied mask on the same layer', () => {
    let node = meshNode();
    node = applyMaskRefinement(node, 'l1', { shape: 'rounded', radius: 8 });
    const out = applyMaskRefinement(node, 'l1', { shape: 'circle', radius: 100 });
    const layer = out.intent.visualSpec.layers.find((l) => l.id === 'l1');
    expect(layer!.mask).toEqual({ shape: 'circle', radius: 100 });
  });

  it('returns the source node unchanged when the layerId does not exist', () => {
    const node = meshNode();
    const out = applyMaskRefinement(node, 'unknown-layer', { shape: 'circle', radius: 8 });
    expect(out.intent.visualSpec.layers).toEqual(node.intent.visualSpec.layers);
  });

  it('does not mutate the source node', () => {
    const before = meshNode();
    const beforeJson = JSON.stringify(before);
    applyMaskRefinement(before, 'l1', { shape: 'circle', radius: 16 });
    expect(JSON.stringify(before)).toBe(beforeJson);
  });
});
