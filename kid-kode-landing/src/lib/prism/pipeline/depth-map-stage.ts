// Depth-map stage (spec §6 L173-L176, §3 L80, §5 L148).
//
// Stage 9.5 of the renderer-migration pipeline. For every input node with
// renderMode='parallax-plane' that does not yet carry a depthMapUrl, this
// stage calls fal-ai/image-preprocessors/depth-anything/v2 in parallel and
// writes the resulting depthMapUrl back onto the node. Other render modes
// pass through untouched.
//
// The fal client is dependency-injected (see ./types.ts) so tests can stub
// the network call and so production callers can swap providers without
// touching this file.

import type { PrismNode } from '@/lib/prism-graph/types';
import type { DepthMapClient, PipelineStageConfig } from './types';

export interface DepthMapStageInput {
  nodes: PrismNode[];
  client: DepthMapClient;
  config?: Partial<PipelineStageConfig>;
}

export type DepthMapOutcome = 'generated' | 'skipped' | 'preserved' | 'failed';

export interface DepthMapNodeResult {
  nodeId: string;
  outcome: DepthMapOutcome;
  depthMapUrl: string | null;
  error?: string;
  durationMs?: number;
  attempts?: number;
}

export interface DepthMapStageResult {
  nodes: PrismNode[];
  outcomes: DepthMapNodeResult[];
  durationMs: number;
}

const DEPTH_RETRIES_DEFAULT = 1;

type Tagged =
  | {
      kind: 'skip';
      node: PrismNode;
      outcome: 'skipped' | 'preserved' | 'failed';
      error?: string;
    }
  | { kind: 'gen'; node: PrismNode; imageUrl: string };

export async function runDepthMapStage(
  input: DepthMapStageInput,
): Promise<DepthMapStageResult> {
  const start = Date.now();
  const depthRetries = input.config?.depthRetries ?? DEPTH_RETRIES_DEFAULT;

  const tagged: Tagged[] = input.nodes.map((node) => {
    if (node.renderMode !== 'parallax-plane') {
      return { kind: 'skip', node, outcome: 'skipped' };
    }
    if (node.depthMapUrl) {
      return { kind: 'skip', node, outcome: 'preserved' };
    }
    const imageUrl = node.visual?.sourceAsset;
    if (!imageUrl) {
      return {
        kind: 'skip',
        node,
        outcome: 'failed',
        error: 'no imageUrl (visual.sourceAsset) on parallax-plane node',
      };
    }
    return { kind: 'gen', node, imageUrl };
  });

  const settled = await Promise.all(
    tagged.map(async (t): Promise<DepthMapNodeResult> => {
      if (t.kind === 'skip') {
        return {
          nodeId: t.node.nodeId,
          outcome: t.outcome,
          depthMapUrl: t.node.depthMapUrl ?? null,
          error: t.error,
        };
      }
      return runOneDepthCall(t.node, t.imageUrl, input.client, depthRetries);
    }),
  );

  const nodesOut = input.nodes.map((node, i) => {
    const r = settled[i];
    if (r.outcome === 'generated' && r.depthMapUrl) {
      return { ...node, depthMapUrl: r.depthMapUrl };
    }
    return node;
  });

  return {
    nodes: nodesOut,
    outcomes: settled,
    durationMs: Date.now() - start,
  };
}

async function runOneDepthCall(
  node: PrismNode,
  imageUrl: string,
  client: DepthMapClient,
  retries: number,
): Promise<DepthMapNodeResult> {
  const t0 = Date.now();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await client.generate({ imageUrl });
      return {
        nodeId: node.nodeId,
        outcome: 'generated',
        depthMapUrl: r.depthMapUrl,
        durationMs: Date.now() - t0,
        attempts: attempt + 1,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  return {
    nodeId: node.nodeId,
    outcome: 'failed',
    depthMapUrl: null,
    error: lastErr instanceof Error ? lastErr.message : String(lastErr),
    durationMs: Date.now() - t0,
    attempts: retries + 1,
  };
}
