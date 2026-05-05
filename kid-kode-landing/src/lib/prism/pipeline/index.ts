// Public surface for the renderer-migration asset pipeline (spec §6, stages
// 9.5 and 9.6). Callers should import from here, not from the per-stage
// modules, so the wiring stays a single point of change.

export {
  DEPTH_ANYTHING_V2_MODEL_ID,
  HUNYUAN3D_RAPID_MODEL_ID,
  TRELLIS_2_MODEL_ID,
  MESH_STAGE_TIMEOUT_MS_DEFAULT,
} from './types';
export type {
  DepthMapClient,
  MeshClient,
  PipelineClients,
  PipelineStageConfig,
} from './types';

export { runDepthMapStage } from './depth-map-stage';
export type {
  DepthMapStageInput,
  DepthMapStageResult,
  DepthMapNodeResult,
  DepthMapOutcome,
} from './depth-map-stage';

export { runMeshStage } from './mesh-stage';
export type {
  MeshStageInput,
  MeshStageResult,
  MeshNodeResult,
  MeshOutcome,
} from './mesh-stage';

export { runAssetPipeline } from './orchestrator';
export type {
  AssetPipelineInput,
  AssetPipelineResult,
} from './orchestrator';
