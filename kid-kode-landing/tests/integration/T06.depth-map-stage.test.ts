// T06 — Depth map stage (spec §6 L173-L176; §3 L80; §5 L148).
//
// PRISM-RENDERER-MIGRATION-SPEC.md §6, stage 9.5:
//   "Depth map generation … For nodes with renderMode='parallax-plane' …
//    Calls fal-ai/image-preprocessors/depth-anything/v2 in parallel … Stores
//    depthMapUrl"
//
// Acceptance:
//   - Iterates input nodes; calls the depth-map client only for the
//     parallax-plane subset that does not yet have a depthMapUrl.
//   - Returned node array carries the populated depthMapUrl.
//   - Calls run in parallel (multiple concurrent invocations observable).
//   - Transient failures retry up to `depthRetries` times.
//   - Persistent failures are reported per-node without throwing.

import { describe, expect, it } from 'vitest';
import {
  DEPTH_ANYTHING_V2_MODEL_ID,
  runDepthMapStage,
} from '@/lib/prism/pipeline';
import type { PrismNode, PrismVisual } from '@/lib/prism-graph/types';

interface NodeOpts {
  nodeId: string;
  renderMode?: PrismNode['renderMode'];
  depthMapUrl?: string | null;
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
    depthMapUrl: opts.depthMapUrl,
  };
}

describe('T06 — depth-map stage (spec §6 L173-L176)', () => {
  it('exports the canonical Depth Anything v2 model id (spec §3 L80)', () => {
    expect(DEPTH_ANYTHING_V2_MODEL_ID).toBe(
      'fal-ai/image-preprocessors/depth-anything/v2',
    );
  });

  it('generates depth maps only for parallax-plane nodes', async () => {
    const calls: string[] = [];
    const client = {
      generate: async ({ imageUrl }: { imageUrl: string }) => {
        calls.push(imageUrl);
        return { depthMapUrl: `${imageUrl}.depth.exr` };
      },
    };

    const result = await runDepthMapStage({
      nodes: [
        makeNode({ nodeId: 'a', renderMode: 'sprite' }),
        makeNode({ nodeId: 'b', renderMode: 'parallax-plane' }),
        makeNode({ nodeId: 'c', renderMode: 'mesh' }),
      ],
      client,
    });

    expect(calls).toEqual(['b.avif']);
    const bResult = result.nodes.find((n) => n.nodeId === 'b')!;
    expect(bResult.depthMapUrl).toBe('b.avif.depth.exr');

    expect(result.outcomes.find((o) => o.nodeId === 'b')!.outcome).toBe(
      'generated',
    );
    expect(result.outcomes.find((o) => o.nodeId === 'a')!.outcome).toBe(
      'skipped',
    );
    expect(result.outcomes.find((o) => o.nodeId === 'c')!.outcome).toBe(
      'skipped',
    );
  });

  it('preserves an existing depthMapUrl without re-calling the client', async () => {
    const calls: string[] = [];
    const client = {
      generate: async ({ imageUrl }: { imageUrl: string }) => {
        calls.push(imageUrl);
        return { depthMapUrl: 'never' };
      },
    };

    const result = await runDepthMapStage({
      nodes: [
        makeNode({
          nodeId: 'p',
          renderMode: 'parallax-plane',
          depthMapUrl: 'preexisting.exr',
        }),
      ],
      client,
    });

    expect(calls).toHaveLength(0);
    expect(result.nodes[0].depthMapUrl).toBe('preexisting.exr');
    expect(result.outcomes[0].outcome).toBe('preserved');
  });

  it('runs candidates in parallel (multiple concurrent invocations)', async () => {
    let active = 0;
    let maxActive = 0;
    const client = {
      generate: async ({ imageUrl }: { imageUrl: string }) => {
        active++;
        if (active > maxActive) maxActive = active;
        await new Promise((r) => setTimeout(r, 40));
        active--;
        return { depthMapUrl: `${imageUrl}.exr` };
      },
    };

    const nodes = ['a', 'b', 'c', 'd'].map((id) =>
      makeNode({ nodeId: id, renderMode: 'parallax-plane' }),
    );

    const t0 = Date.now();
    await runDepthMapStage({ nodes, client });
    const elapsed = Date.now() - t0;

    expect(maxActive).toBeGreaterThanOrEqual(2);
    // Sequential would be ~160ms (4 × 40); parallel ~40ms.
    expect(elapsed).toBeLessThan(120);
  });

  it('retries transient failures up to depthRetries', async () => {
    let callCount = 0;
    const client = {
      generate: async () => {
        callCount++;
        if (callCount === 1) throw new Error('transient');
        return { depthMapUrl: 'ok.exr' };
      },
    };

    const result = await runDepthMapStage({
      nodes: [makeNode({ nodeId: 'x', renderMode: 'parallax-plane' })],
      client,
      config: { depthRetries: 1 },
    });

    expect(result.outcomes[0].outcome).toBe('generated');
    expect(result.outcomes[0].depthMapUrl).toBe('ok.exr');
    expect(result.outcomes[0].attempts).toBe(2);
    expect(callCount).toBe(2);
  });

  it('marks node failed after exhausting retries', async () => {
    const client = {
      generate: async () => {
        throw new Error('persistent');
      },
    };
    const result = await runDepthMapStage({
      nodes: [makeNode({ nodeId: 'x', renderMode: 'parallax-plane' })],
      client,
      config: { depthRetries: 1 },
    });
    expect(result.outcomes[0].outcome).toBe('failed');
    expect(result.outcomes[0].depthMapUrl).toBeNull();
    expect(result.outcomes[0].error).toContain('persistent');
    expect(result.nodes[0].depthMapUrl ?? null).toBeNull();
  });

  it('reports failed when parallax-plane node has no source image', async () => {
    const client = {
      generate: async () => ({ depthMapUrl: 'never' }),
    };
    const node = makeNode({
      nodeId: 'no-img',
      renderMode: 'parallax-plane',
      visual: { transform: { x: 0, y: 0, width: 1, height: 1, z: 0 } },
    });

    const result = await runDepthMapStage({ nodes: [node], client });
    expect(result.outcomes[0].outcome).toBe('failed');
    expect(result.outcomes[0].error).toMatch(/imageUrl|sourceAsset/i);
  });
});
