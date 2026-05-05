// Asset pipeline orchestrator (spec §6 L173-L181, §14 L498).
//
// Stages 9.5 (depth-map) and 9.6 (mesh) follow stage 9 (knowledge graph
// construction) and feed into stage 11 (parallel code generation). The
// spec lists them as siblings under stage 9, so this orchestrator runs
// them concurrently — that overlap is what keeps the per-build timing
// budget within "+7-10s over current" (§14 L498).

import type { PrismNode } from '@/lib/prism-graph/types';
import type { PipelineClients, PipelineStageConfig } from './types';
import {
  runDepthMapStage,
  type DepthMapStageResult,
} from './depth-map-stage';
import { runMeshStage, type MeshStageResult } from './mesh-stage';

export interface AssetPipelineInput {
  nodes: PrismNode[];
  clients: PipelineClients;
  config?: Partial<PipelineStageConfig>;
}

export interface AssetPipelineResult {
  nodes: PrismNode[];
  depthMapStage: DepthMapStageResult;
  meshStage: MeshStageResult;
  durationMs: number;
}

export async function runAssetPipeline(
  input: AssetPipelineInput,
): Promise<AssetPipelineResult> {
  const start = Date.now();
  const [depthMapStage, meshStage] = await Promise.all([
    runDepthMapStage({
      nodes: input.nodes,
      client: input.clients.depthMap,
      config: input.config,
    }),
    runMeshStage({
      nodes: input.nodes,
      hunyuan3d: input.clients.hunyuan3d,
      trellis2: input.clients.trellis2,
      depthMap: input.clients.depthMap,
      config: input.config,
    }),
  ]);

  // Merge: depth-map stage only writes the parallax-plane subset; mesh
  // stage only writes the mesh subset (and may demote to parallax-plane
  // or plane). Take from each by original input renderMode so neither
  // stage's pass-through copy of unrelated nodes overwrites the other.
  const nodes = input.nodes.map((origNode, i) => {
    if (origNode.renderMode === 'mesh') {
      return meshStage.nodes[i];
    }
    if (origNode.renderMode === 'parallax-plane') {
      return depthMapStage.nodes[i];
    }
    return origNode;
  });

  return {
    nodes,
    depthMapStage,
    meshStage,
    durationMs: Date.now() - start,
  };
}
