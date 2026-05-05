// Stub for the asset-pipeline orchestrator (spec §6 L173-L181). Runs
// stages 9.5 and 9.6 in parallel; real implementation arrives later in T06.

import type { PrismNode } from '@/lib/prism-graph/types';
import type { PipelineClients, PipelineStageConfig } from './types';
import type { DepthMapStageResult } from './depth-map-stage';
import type { MeshStageResult } from './mesh-stage';

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
  _input: AssetPipelineInput,
): Promise<AssetPipelineResult> {
  throw new Error('runAssetPipeline: not implemented');
}
