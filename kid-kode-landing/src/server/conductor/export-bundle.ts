// PRISM SHELL — E7 EXPORT BUNDLE (SHELL W5, 2026-07-04)
//
// The deployable runtime bundle manifest (E7): the .prism graph + assets + a
// hosting manifest. Honest positioning — this is ownership of the RUNNING app
// (the three/webgpu runtime IS the product), not React source. The bytes (the
// graph JSON + manifest, zipped) ride a guarded download route; this module
// produces the manifest + the download URL.

import 'server-only';
import type {
  ExportManifest,
  ExportOutput,
} from '../../../packages/shared-interfaces/src/prism-conductor';
import { PRISM_CONDUCTOR_CONTRACT_VERSION } from '../../../packages/shared-interfaces/src/prism-conductor';
import * as store from '../tenancy/tenant-store';

/** Build the E7 export manifest + guarded download URL for a built project. */
export async function buildExport(opts: {
  tenantId: string;
  projectId: string;
  appOrigin: string;
  nowIso: string;
}): Promise<ExportOutput | null> {
  const project = await store.getProject(opts.tenantId, opts.projectId);
  if (!project) return null;
  const graph = await store.getGraph(opts.tenantId, opts.projectId);
  if (!graph) return null;

  const hubs = Array.isArray((graph as { hubs?: unknown[] }).hubs)
    ? (graph as { hubs: unknown[] }).hubs.length
    : 0;
  const nodes = Array.isArray((graph as { nodes?: unknown[] }).nodes)
    ? (graph as { nodes: unknown[] }).nodes.length
    : 0;
  const edges = Array.isArray((graph as { edges?: unknown[] }).edges)
    ? (graph as { edges: unknown[] }).edges.length
    : 0;
  const hasRootNode = Array.isArray((graph as { rootNodes?: unknown[] }).rootNodes)
    ? (graph as { rootNodes: unknown[] }).rootNodes.length === 1
    : false;

  const manifest: ExportManifest = {
    v: PRISM_CONDUCTOR_CONTRACT_VERSION,
    projectId: opts.projectId,
    appName: project.name,
    artifact: 'prism-runtime-bundle',
    generatedAt: opts.nowIso,
    graphSummary: { hubs, nodes, edges, hasRootNode },
    // W5 graphs render from real MSDF text + tinted PBR primitives — no baked
    // diffusion assets (W5-D2), so the bundle carries no external image assets.
    // The MSDF font atlas is a runtime dependency shipped with the player.
    assets: [],
    hosting: {
      runtime: 'three-webgpu',
      entry: `/preview/${opts.projectId}`,
      target: 'prism-cloud',
      requiredEnv: [],
    },
  };

  return {
    v: PRISM_CONDUCTOR_CONTRACT_VERSION,
    manifest,
    downloadUrl: `${opts.appOrigin}/api/tenant/export/${opts.projectId}`,
  };
}
