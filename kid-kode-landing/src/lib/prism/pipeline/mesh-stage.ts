// Mesh stage (spec §6 L177-L181, §3 L82-L83, §5 L151-L152).
//
// Stage 9.6 of the renderer-migration pipeline. For every input node with
// renderMode='mesh' that does not yet carry a meshUrl, this stage:
//
//   1. Calls fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d in parallel with a
//      hard timeout (spec §6 L180).
//   2. If Hunyuan3D fails or times out, falls back to fal-ai/trellis-2
//      (spec §3 L83 — "fast alternative … fallback when speed > quality").
//   3. If both mesh services fail, demotes the node to renderMode='parallax-
//      plane' (spec §6 L180) and runs depth-map generation for it.
//   4. If the depth-map fallback also fails, demotes further to
//      renderMode='plane' so the node can still render.
//
// The graceful demotion ladder exists because the spec invariant "Builds
// must never fail" (engine invariant 5) sits above any single asset
// generation. A mesh node that the planner asked for but the providers
// can't deliver still has to render — as a parallax-plane (best) or a
// flat plane (worst).

import type { PrismNode, RenderMode } from '@/lib/prism-graph/types';
import type {
  DepthMapClient,
  MeshClient,
  PipelineStageConfig,
} from './types';
import { MESH_STAGE_TIMEOUT_MS_DEFAULT } from './types';

export interface MeshStageInput {
  nodes: PrismNode[];
  hunyuan3d: MeshClient;
  trellis2: MeshClient;
  /** depth-map client used when demoting failed mesh nodes to parallax-plane */
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

type Candidate = { index: number; node: PrismNode; imageUrl: string };

export async function runMeshStage(
  input: MeshStageInput,
): Promise<MeshStageResult> {
  const start = Date.now();
  const meshTimeoutMs =
    input.config?.meshTimeoutMs ?? MESH_STAGE_TIMEOUT_MS_DEFAULT;
  const trellisOnFailure = input.config?.trellisOnFailure ?? true;

  // Step 1 — partition input
  const skipResults = new Map<number, MeshNodeResult>();
  const candidates: Candidate[] = [];
  input.nodes.forEach((node, index) => {
    if (node.renderMode !== 'mesh') {
      skipResults.set(index, {
        nodeId: node.nodeId,
        outcome: 'skipped',
        meshUrl: node.meshUrl ?? null,
        depthMapUrl: node.depthMapUrl ?? null,
        finalRenderMode: node.renderMode ?? 'sprite',
      });
      return;
    }
    if (node.meshUrl) {
      skipResults.set(index, {
        nodeId: node.nodeId,
        outcome: 'preserved',
        meshUrl: node.meshUrl,
        depthMapUrl: node.depthMapUrl ?? null,
        finalRenderMode: 'mesh',
      });
      return;
    }
    const imageUrl = node.visual?.sourceAsset;
    if (!imageUrl) {
      // Parity with depth-map-stage: skip up front so we don't burn a fal-ai
      // call on an empty URL. The node still demotes to 'plane' below since
      // we have no image to feed Hunyuan3D / Trellis-2 / Depth Anything.
      skipResults.set(index, {
        nodeId: node.nodeId,
        outcome: 'demoted-to-plane',
        meshUrl: null,
        depthMapUrl: null,
        finalRenderMode: 'plane',
        error: 'no imageUrl (visual.sourceAsset) on mesh node',
      });
      return;
    }
    candidates.push({ index, node, imageUrl });
  });

  // Step 2 — Hunyuan3D in parallel with hard timeout
  const hunyuan = await Promise.allSettled(
    candidates.map((c) =>
      withTimeout(
        input.hunyuan3d.generate({ imageUrl: c.imageUrl }),
        meshTimeoutMs,
        `hunyuan3d timeout ${meshTimeoutMs}ms`,
      ),
    ),
  );

  const successes = new Map<
    number,
    { meshUrl: string; source: 'hunyuan3d' | 'trellis2' }
  >();
  const trellisQueue: Array<{ candidate: Candidate; reason: string }> = [];
  hunyuan.forEach((s, i) => {
    const c = candidates[i];
    if (s.status === 'fulfilled') {
      successes.set(c.index, { meshUrl: s.value.meshUrl, source: 'hunyuan3d' });
    } else {
      trellisQueue.push({ candidate: c, reason: errorMessage(s.reason) });
    }
  });

  // Step 3 — Trellis-2 in parallel for remaining candidates
  if (trellisOnFailure && trellisQueue.length > 0) {
    const trellisOutcomes = await Promise.allSettled(
      trellisQueue.map((q) =>
        withTimeout(
          input.trellis2.generate({ imageUrl: q.candidate.imageUrl }),
          meshTimeoutMs,
          `trellis2 timeout ${meshTimeoutMs}ms`,
        ),
      ),
    );
    trellisOutcomes.forEach((s, i) => {
      if (s.status === 'fulfilled') {
        successes.set(trellisQueue[i].candidate.index, {
          meshUrl: s.value.meshUrl,
          source: 'trellis2',
        });
      }
    });
  }

  // Step 4 — demote remaining failures to parallax-plane via depth-map
  const demoteQueue: Array<{ candidate: Candidate; reason: string }> = [];
  candidates.forEach((c) => {
    if (!successes.has(c.index)) {
      const reason = trellisQueue.find((q) => q.candidate.index === c.index)
        ?.reason ?? 'mesh generation unavailable';
      demoteQueue.push({ candidate: c, reason });
    }
  });

  const demoteResults = new Map<
    number,
    { renderMode: RenderMode; depthMapUrl: string | null }
  >();
  if (demoteQueue.length > 0) {
    const depth = await Promise.allSettled(
      demoteQueue.map((d) => {
        if (!d.candidate.imageUrl) {
          return Promise.reject(
            new Error('no imageUrl (visual.sourceAsset) on mesh node'),
          );
        }
        return input.depthMap.generate({ imageUrl: d.candidate.imageUrl });
      }),
    );
    depth.forEach((s, i) => {
      const d = demoteQueue[i];
      if (s.status === 'fulfilled') {
        demoteResults.set(d.candidate.index, {
          renderMode: 'parallax-plane',
          depthMapUrl: s.value.depthMapUrl,
        });
      } else {
        demoteResults.set(d.candidate.index, {
          renderMode: 'plane',
          depthMapUrl: null,
        });
      }
    });
  }

  // Step 5 — assemble outputs in input order
  const nodesOut: PrismNode[] = [];
  const outcomes: MeshNodeResult[] = [];
  input.nodes.forEach((node, index) => {
    const skip = skipResults.get(index);
    if (skip) {
      // Most skip cases pass the node through untouched. The up-front
      // "missing imageUrl" demotion is the exception: the outcome already
      // says renderMode='plane', so we mirror that on the node itself.
      if (skip.outcome === 'demoted-to-plane') {
        nodesOut.push({
          ...node,
          renderMode: skip.finalRenderMode,
          meshUrl: null,
          depthMapUrl: null,
        });
      } else {
        nodesOut.push(node);
      }
      outcomes.push(skip);
      return;
    }
    const success = successes.get(index);
    if (success) {
      nodesOut.push({ ...node, meshUrl: success.meshUrl });
      outcomes.push({
        nodeId: node.nodeId,
        outcome:
          success.source === 'hunyuan3d'
            ? 'mesh-generated'
            : 'mesh-fallback-trellis2',
        meshUrl: success.meshUrl,
        depthMapUrl: node.depthMapUrl ?? null,
        finalRenderMode: 'mesh',
      });
      return;
    }
    const dem = demoteResults.get(index);
    const reason = demoteQueue.find((d) => d.candidate.index === index)?.reason;
    if (dem) {
      nodesOut.push({
        ...node,
        renderMode: dem.renderMode,
        meshUrl: null,
        depthMapUrl: dem.depthMapUrl,
      });
      outcomes.push({
        nodeId: node.nodeId,
        outcome:
          dem.renderMode === 'parallax-plane'
            ? 'demoted-to-parallax'
            : 'demoted-to-plane',
        meshUrl: null,
        depthMapUrl: dem.depthMapUrl,
        finalRenderMode: dem.renderMode,
        error: reason,
      });
      return;
    }
    // Unreachable: every candidate is in skipResults, successes, or
    // demoteResults by construction. If we hit this path the partition
    // logic above is broken.
    throw new Error(
      `mesh-stage internal: candidate ${node.nodeId} fell through partition`,
    );
  });

  return {
    nodes: nodesOut,
    outcomes,
    durationMs: Date.now() - start,
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return String(reason);
}
