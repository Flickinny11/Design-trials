// Pipeline asset-generation types — surface for stages 9.5 (depth-map) and
// 9.6 (mesh) per spec §6 L173-L181 and the fal-ai service identifiers
// listed in §3 L80-L83.
//
// The functions are dependency-injected with client interfaces rather than
// hard-coded fal-ai SDK calls so that:
//   - tests can stub them without network access
//   - production wiring can swap fal-ai for a different provider
//   - the Modal-side worker decides retry / queueing semantics, not us
//
// The model id constants are exported so callers can pass them directly to
// fal.subscribe() and so spec deviations are caught by string equality in
// tests.

/** Spec §3 L80 — `fal-ai/image-preprocessors/depth-anything/v2`. */
export const DEPTH_ANYTHING_V2_MODEL_ID =
  'fal-ai/image-preprocessors/depth-anything/v2';

/** Spec §3 L82 — `fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d`. */
export const HUNYUAN3D_RAPID_MODEL_ID =
  'fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d';

/** Spec §3 L83 — `fal-ai/trellis-2`. */
export const TRELLIS_2_MODEL_ID = 'fal-ai/trellis-2';

/** Spec §6 L180 — "has hard timeout"; numeric value unspecified. We default
 *  to 3 minutes which matches the Hunyuan3D Rapid p95 documented in §3 L82. */
export const MESH_STAGE_TIMEOUT_MS_DEFAULT = 180_000;

export interface DepthMapClient {
  generate(input: { imageUrl: string }): Promise<{ depthMapUrl: string }>;
}

export interface MeshClient {
  generate(input: { imageUrl: string }): Promise<{ meshUrl: string }>;
}

export interface PipelineClients {
  depthMap: DepthMapClient;
  hunyuan3d: MeshClient;
  trellis2: MeshClient;
}

export interface PipelineStageConfig {
  /** Per-call hard timeout for both Hunyuan3D and Trellis-2 (spec §6 L180). */
  meshTimeoutMs: number;
  /** When Hunyuan3D fails or times out, attempt Trellis-2 before demoting to
   *  parallax-plane. Defaults to true; disable for tests that want to drive
   *  the demotion path directly without a Trellis stub. */
  trellisOnFailure: boolean;
  /** Number of additional attempts for the depth-map call after a failure. */
  depthRetries: number;
}
