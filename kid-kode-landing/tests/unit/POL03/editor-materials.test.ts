// POL03 — Editor artifact rendering must stay WebGL-safe.

import { describe, expect, it } from 'vitest';
import { MeshBasicMaterial } from 'three';
import { defaultRenderModeFactory } from '@/lib/prism/runtime/factories/default-factory';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';
import type { PrismIntent, PrismNode } from '@/lib/prism-graph/types';

function emptyIntent(): PrismIntent {
  return {
    caption: 'test',
    behaviorSpec: {
      interactions: [],
      apiCalls: [],
      dataBindings: [],
      emits: [],
      listens: [],
      triggersDownstream: [],
    },
    stateEffects: [],
    visualSpec: { textContent: [], layers: [] },
    contracts: { inputs: {}, outputs: {} },
  };
}

const ctx = {
  textureLoader: { loadTexture: async () => { throw new Error('unused'); } },
  glbLoader: { loadGLB: async () => null },
  fontAtlas: { createText: () => { throw new Error('unused'); } },
  primitives: {},
  emit: () => {},
} as unknown as NodeContext;

describe('POL03 — editor-safe artifact materials', () => {
  it('can build sprite artifacts without WebGPU NodeMaterials', () => {
    const node: PrismNode = {
      nodeId: 'editor-safe',
      parentHubId: 'home',
      subtype: 'caption',
      serviceTag: 'ui-text',
      visual: {
        sourceAsset: '/asset.png',
        transform: { x: 0, y: 0, z: 0, width: 1, height: 1 },
      },
      intent: emptyIntent(),
      codeRef: '',
      backendRef: null,
      renderMode: 'sprite',
      cinematicPrimitives: [],
      depthMapUrl: null,
      meshUrl: null,
    };

    const object = defaultRenderModeFactory(node, ctx, {
      runPrimitives: false,
      nodeMaterials: false,
    });
    const mesh = object.children[0] as { material?: unknown };

    expect(mesh.material).toBeInstanceOf(MeshBasicMaterial);
  });
});
