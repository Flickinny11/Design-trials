// Stub for the depth-map stage (spec §6 L173-L176). Real implementation
// arrives later in T06; this file exists so the test file compiles.

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

export async function runDepthMapStage(
  _input: DepthMapStageInput,
): Promise<DepthMapStageResult> {
  throw new Error('runDepthMapStage: not implemented');
}
