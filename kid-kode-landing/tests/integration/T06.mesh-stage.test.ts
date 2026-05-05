// T06 — Mesh stage (spec §6 L177-L181; §3 L82-L83; §5 L151-L152).
//
// PRISM-RENDERER-MIGRATION-SPEC.md §6, stage 9.6:
//   "3D mesh generation … For nodes with renderMode='mesh' …
//    Calls fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d in parallel … Stores
//    meshUrl … Has hard timeout — falls back to renderMode='parallax-plane'
//    on failure"
//
// Spec §3 L83 also names `fal-ai/trellis-2` as a "fast alternative … fallback
// when speed > quality." T06.haltCheck wires Trellis-2 between Hunyuan3D and
// the parallax-plane demotion: Hunyuan3D failure → Trellis-2 → parallax-plane.

import { describe, expect, it } from 'vitest';
import {
  HUNYUAN3D_RAPID_MODEL_ID,
  TRELLIS_2_MODEL_ID,
  runMeshStage,
} from '@/lib/prism/pipeline';
import type {
  DepthMapClient,
  MeshClient,
} from '@/lib/prism/pipeline';
import type { PrismNode, PrismVisual } from '@/lib/prism-graph/types';

interface NodeOpts {
  nodeId: string;
  renderMode?: PrismNode['renderMode'];
  meshUrl?: string | null;
  visual?: PrismVisual;
}

function makeNode(opts: NodeOpts): PrismNode {
  const visual: PrismVisual = opts.visual ?? {
    transform: { x: 0, y: 0, width: 100, height: 100, z: 0 },
    sourceAsset: `${opts.nodeId}.avif`,
  };
  return {
    nodeId: opts.nodeId,
    subtype: 'hero',
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
    meshUrl: opts.meshUrl,
  };
}

const okHunyuan: MeshClient = {
  generate: async ({ imageUrl }) => ({ meshUrl: `${imageUrl}.glb` }),
};
const okTrellis: MeshClient = {
  generate: async ({ imageUrl }) => ({ meshUrl: `${imageUrl}.trellis.glb` }),
};
const okDepth: DepthMapClient = {
  generate: async ({ imageUrl }) => ({ depthMapUrl: `${imageUrl}.depth.exr` }),
};
const failing = {
  generate: async () => {
    throw new Error('failed');
  },
};

describe('T06 — mesh stage (spec §6 L177-L181)', () => {
  it('exports canonical mesh-service model ids (spec §3 L82-L83)', () => {
    expect(HUNYUAN3D_RAPID_MODEL_ID).toBe(
      'fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d',
    );
    expect(TRELLIS_2_MODEL_ID).toBe('fal-ai/trellis-2');
  });

  it('generates mesh via Hunyuan3D for mesh nodes', async () => {
    const result = await runMeshStage({
      nodes: [makeNode({ nodeId: 'hero', renderMode: 'mesh' })],
      hunyuan3d: okHunyuan,
      trellis2: okTrellis,
      depthMap: okDepth,
    });
    expect(result.outcomes[0].outcome).toBe('mesh-generated');
    expect(result.outcomes[0].meshUrl).toBe('hero.avif.glb');
    expect(result.nodes[0].meshUrl).toBe('hero.avif.glb');
    expect(result.nodes[0].renderMode).toBe('mesh');
    expect(result.outcomes[0].finalRenderMode).toBe('mesh');
  });

  it('falls back to Trellis-2 when Hunyuan3D fails (spec §3 L83 fast alternative)', async () => {
    const result = await runMeshStage({
      nodes: [makeNode({ nodeId: 'hero', renderMode: 'mesh' })],
      hunyuan3d: failing,
      trellis2: okTrellis,
      depthMap: okDepth,
    });
    expect(result.outcomes[0].outcome).toBe('mesh-fallback-trellis2');
    expect(result.outcomes[0].meshUrl).toBe('hero.avif.trellis.glb');
    expect(result.nodes[0].meshUrl).toBe('hero.avif.trellis.glb');
    expect(result.nodes[0].renderMode).toBe('mesh');
  });

  it('demotes to parallax-plane when both mesh services fail (spec §6 L180)', async () => {
    const result = await runMeshStage({
      nodes: [makeNode({ nodeId: 'hero', renderMode: 'mesh' })],
      hunyuan3d: failing,
      trellis2: failing,
      depthMap: okDepth,
    });
    expect(result.outcomes[0].outcome).toBe('demoted-to-parallax');
    expect(result.outcomes[0].finalRenderMode).toBe('parallax-plane');
    expect(result.nodes[0].renderMode).toBe('parallax-plane');
    expect(result.nodes[0].meshUrl).toBeNull();
    expect(result.nodes[0].depthMapUrl).toBe('hero.avif.depth.exr');
  });

  it('demotes to plane when Hunyuan3D, Trellis-2, and depth-map all fail', async () => {
    const result = await runMeshStage({
      nodes: [makeNode({ nodeId: 'hero', renderMode: 'mesh' })],
      hunyuan3d: failing,
      trellis2: failing,
      depthMap: failing,
    });
    expect(result.outcomes[0].outcome).toBe('demoted-to-plane');
    expect(result.outcomes[0].finalRenderMode).toBe('plane');
    expect(result.nodes[0].renderMode).toBe('plane');
    expect(result.nodes[0].meshUrl).toBeNull();
    expect(result.nodes[0].depthMapUrl ?? null).toBeNull();
  });

  it('hard-timeout on Hunyuan3D triggers Trellis-2 fallback (spec §6 L180)', async () => {
    const slowHunyuan: MeshClient = {
      generate: () =>
        new Promise<{ meshUrl: string }>(() => {
          /* never resolve */
        }),
    };
    const result = await runMeshStage({
      nodes: [makeNode({ nodeId: 'hero', renderMode: 'mesh' })],
      hunyuan3d: slowHunyuan,
      trellis2: okTrellis,
      depthMap: okDepth,
      config: { meshTimeoutMs: 30 },
    });
    expect(result.outcomes[0].outcome).toBe('mesh-fallback-trellis2');
  });

  it('skips non-mesh nodes', async () => {
    const result = await runMeshStage({
      nodes: [
        makeNode({ nodeId: 'a', renderMode: 'sprite' }),
        makeNode({ nodeId: 'b', renderMode: 'parallax-plane' }),
      ],
      hunyuan3d: okHunyuan,
      trellis2: okTrellis,
      depthMap: okDepth,
    });
    expect(result.outcomes.every((o) => o.outcome === 'skipped')).toBe(true);
    expect(result.nodes[0].meshUrl ?? null).toBeNull();
  });

  it('preserves an existing meshUrl without re-calling generators', async () => {
    let calls = 0;
    const counting: MeshClient = {
      generate: async () => {
        calls++;
        return { meshUrl: 'never' };
      },
    };
    const result = await runMeshStage({
      nodes: [
        makeNode({ nodeId: 'hero', renderMode: 'mesh', meshUrl: 'existing.glb' }),
      ],
      hunyuan3d: counting,
      trellis2: counting,
      depthMap: okDepth,
    });
    expect(calls).toBe(0);
    expect(result.outcomes[0].outcome).toBe('preserved');
    expect(result.nodes[0].meshUrl).toBe('existing.glb');
  });

  it('runs hunyuan3d candidates in parallel', async () => {
    let active = 0;
    let maxActive = 0;
    const slow: MeshClient = {
      generate: async () => {
        active++;
        if (active > maxActive) maxActive = active;
        await new Promise((r) => setTimeout(r, 30));
        active--;
        return { meshUrl: 'ok.glb' };
      },
    };
    await runMeshStage({
      nodes: ['a', 'b', 'c', 'd'].map((id) =>
        makeNode({ nodeId: id, renderMode: 'mesh' }),
      ),
      hunyuan3d: slow,
      trellis2: slow,
      depthMap: okDepth,
    });
    expect(maxActive).toBeGreaterThanOrEqual(2);
  });
});
