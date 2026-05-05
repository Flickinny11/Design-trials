// Stub for the mesh stage (spec §6 L177-L181). Real implementation arrives
// later in T06; this file exists so the test file compiles.

import type { PrismNode, RenderMode } from '@/lib/prism-graph/types';
import type {
  DepthMapClient,
  MeshClient,
  PipelineStageConfig,
} from './types';

export interface MeshStageInput {
  nodes: PrismNode[];
  hunyuan3d: MeshClient;
  trellis2: MeshClient;
  depthMap: DepthMapClient;
  config?: Partial<PipelineStageConfig>;
}

export type MeshOutcome =
  | 'mesh-generated'
  | 'mesh-fallback-trellis2'
  | 'demoted-to-parallax'
  | 'demoted-to-plane'
  | 'preserved'
  | 'skipped';

export interface MeshNodeResult {
  nodeId: string;
  outcome: MeshOutcome;
  meshUrl: string | null;
  depthMapUrl: string | null;
  finalRenderMode: RenderMode;
  durationMs?: number;
  error?: string;
}

export interface MeshStageResult {
  nodes: PrismNode[];
  outcomes: MeshNodeResult[];
  durationMs: number;
}

export async function runMeshStage(
  _input: MeshStageInput,
): Promise<MeshStageResult> {
  throw new Error('runMeshStage: not implemented');
}
