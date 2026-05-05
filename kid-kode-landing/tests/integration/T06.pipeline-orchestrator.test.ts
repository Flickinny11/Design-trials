// T06 — Asset pipeline orchestrator (spec §6 L173-L181; §14 L498).
//
// Stages 9.5 (depth-map) and 9.6 (mesh) follow stage 9 (knowledge graph
// construction) and feed into stage 11 (parallel code generation). Both
// stages run in parallel — the spec lists them as siblings under stage 9,
// not as a serial chain. Spec §14 L498 also caps total pipeline time at
// "+7-10s over current" which only holds if 9.5 and 9.6 overlap.

import { describe, expect, it } from 'vitest';
import { runAssetPipeline } from '@/lib/prism/pipeline';
import type {
  DepthMapClient,
  MeshClient,
} from '@/lib/prism/pipeline';
import type { PrismNode, PrismVisual } from '@/lib/prism-graph/types';

interface NodeOpts {
  nodeId: string;
  renderMode?: PrismNode['renderMode'];
  visual?: PrismVisual;
}

function makeNode(opts: NodeOpts): PrismNode {
  const visual: PrismVisual = opts.visual ?? {
    transform: { x: 0, y: 0, width: 100, height: 100, z: 0 },
    sourceAsset: `${opts.nodeId}.avif`,
  };
  return {
    nodeId: opts.nodeId,
    subtype: 'card',
    parentHubId: 'home',
    serviceTag: 'visual',
    visual,
    intent: {
      caption: 'x',
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
    },
    codeRef: `nodes/${opts.nodeId}.js`,
    backendRef: null,
    renderMode: opts.renderMode,
  };
}

describe('T06 — asset pipeline orchestrator (spec §6 L173-L181)', () => {
  it('runs depth-map and mesh stages in parallel', async () => {
    let depthActive = false;
    let meshActive = false;
    let bothActive = false;
    const depth: DepthMapClient = {
      generate: async ({ imageUrl }) => {
        depthActive = true;
        if (depthActive && meshActive) bothActive = true;
        await new Promise((r) => setTimeout(r, 50));
        depthActive = false;
        return { depthMapUrl: `${imageUrl}.exr` };
      },
    };
    const mesh: MeshClient = {
      generate: async ({ imageUrl }) => {
        meshActive = true;
        if (depthActive && meshActive) bothActive = true;
        await new Promise((r) => setTimeout(r, 50));
        meshActive = false;
        return { meshUrl: `${imageUrl}.glb` };
      },
    };

    const result = await runAssetPipeline({
      nodes: [
        makeNode({ nodeId: 'parallax', renderMode: 'parallax-plane' }),
        makeNode({ nodeId: 'meshie', renderMode: 'mesh' }),
      ],
      clients: { depthMap: depth, hunyuan3d: mesh, trellis2: mesh },
    });

    expect(bothActive).toBe(true);
    expect(
      result.nodes.find((n) => n.nodeId === 'parallax')!.depthMapUrl,
    ).toBe('parallax.avif.exr');
    expect(result.nodes.find((n) => n.nodeId === 'meshie')!.meshUrl).toBe(
      'meshie.avif.glb',
    );
  });

  it('fits inside +7-10s budget for a typical hub (spec §14 L498)', async () => {
    // Mock fal calls at 100ms each to simulate non-trivial generation.
    // With parallel execution across stages and within stages, total time
    // should be ~100ms; sequential would be ~300ms.
    const depth: DepthMapClient = {
      generate: async ({ imageUrl }) => {
        await new Promise((r) => setTimeout(r, 100));
        return { depthMapUrl: `${imageUrl}.exr` };
      },
    };
    const mesh: MeshClient = {
      generate: async ({ imageUrl }) => {
        await new Promise((r) => setTimeout(r, 100));
        return { meshUrl: `${imageUrl}.glb` };
      },
    };

    const t0 = Date.now();
    await runAssetPipeline({
      nodes: [
        makeNode({ nodeId: 'p1', renderMode: 'parallax-plane' }),
        makeNode({ nodeId: 'p2', renderMode: 'parallax-plane' }),
        makeNode({ nodeId: 'm1', renderMode: 'mesh' }),
      ],
      clients: { depthMap: depth, hunyuan3d: mesh, trellis2: mesh },
    });
    const elapsed = Date.now() - t0;

    // Sequential would be ~300ms; parallel should be ~100ms. Allow generous
    // bound for vitest jitter.
    expect(elapsed).toBeLessThan(220);
  });

  it('produces an output node array preserving original order', async () => {
    const depth: DepthMapClient = {
      generate: async ({ imageUrl }) => ({ depthMapUrl: `${imageUrl}.exr` }),
    };
    const mesh: MeshClient = {
      generate: async ({ imageUrl }) => ({ meshUrl: `${imageUrl}.glb` }),
    };
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const result = await runAssetPipeline({
      nodes: [
        makeNode({ nodeId: 'a', renderMode: 'sprite' }),
        makeNode({ nodeId: 'b', renderMode: 'parallax-plane' }),
        makeNode({ nodeId: 'c', renderMode: 'plane' }),
        makeNode({ nodeId: 'd', renderMode: 'mesh' }),
        makeNode({ nodeId: 'e', renderMode: 'sprite' }),
      ],
      clients: { depthMap: depth, hunyuan3d: mesh, trellis2: mesh },
    });
    expect(result.nodes.map((n) => n.nodeId)).toEqual(ids);
  });
});
