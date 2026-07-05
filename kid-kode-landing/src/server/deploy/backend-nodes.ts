// PRISM SHELL — BACKEND / GPU NODES → ADAPTERS (SHELL W5B / E19, 2026-07-05)
//
// "Our node system is very powerful for more than just frontend." E19 makes
// backend/GPU node classes (custom open-source models, workflows) flow through
// the E15 DeployTarget adapters: a backend node is DETECTED in the graph, MAPPED
// to its eligible GPU/serverless targets, given a GENERATED host config, and —
// once deployed — VERIFIED by the §11.2 latch's real inference round-trip.
//
// ── THE NODE → TARGET MAPPING CONTRACT ────────────────────────────────────────
// A node is a BACKEND node when ANY of:
//   • its `backendRef` is set (a server workload reference), OR
//   • its `subtype` starts with `backend-` / `model-`, OR
//   • it carries a capabilityRef/integrationRef whose scope is `model:*`.
// Each backend node declares a NODE CLASS (text-classifier | text-embedder |
// text-generator | image-model | workflow). The class maps to:
//   • the eligible DeployTargets (all backend/GPU hosts: modal, runpod, vast),
//   • a recommended default target, and
//   • an inference contract class the endpoint honors (E15 buildInferenceContract).
// A frontend node maps to no backend target. This module is the single source
// of that mapping; E15 deploy + E18 recommendations both read it.

import 'server-only';
import type { GraphSource, PrismNode } from '../../lib/prism-graph/types';
import type {
  DeployTargetKind,
  InferenceContract,
} from '../../../packages/shared-interfaces/src/prism-conductor';
import { buildInferenceContract, buildHostRequirements } from './deploy-targets';
import type { HostRequirements } from '../../../packages/shared-interfaces/src/prism-conductor';

/** The backend node classes the adapter layer serves. */
export type BackendNodeClass =
  | 'text-classifier'
  | 'text-embedder'
  | 'text-generator'
  | 'image-model'
  | 'workflow';

export const BACKEND_SUBTYPE_PREFIXES = ['backend-', 'model-'] as const;

interface BackendClassSpec {
  nodeClass: BackendNodeClass;
  label: string;
  /** Eligible GPU/serverless targets (E15 backend category). */
  eligibleTargets: DeployTargetKind[];
  defaultTarget: DeployTargetKind;
}

/** The node-class → target mapping. All backend classes are eligible for every
 *  GPU/serverless host; the default is the recommended one for that workload. */
const BACKEND_CLASSES: readonly BackendClassSpec[] = [
  { nodeClass: 'text-classifier', label: 'Text classifier', eligibleTargets: ['modal', 'runpod', 'vast'], defaultTarget: 'modal' },
  { nodeClass: 'text-embedder', label: 'Text embedder', eligibleTargets: ['modal', 'runpod', 'vast'], defaultTarget: 'modal' },
  { nodeClass: 'text-generator', label: 'Text generator', eligibleTargets: ['modal', 'runpod', 'vast'], defaultTarget: 'runpod' },
  { nodeClass: 'image-model', label: 'Image model', eligibleTargets: ['runpod', 'vast'], defaultTarget: 'runpod' },
  { nodeClass: 'workflow', label: 'Workflow', eligibleTargets: ['modal', 'runpod', 'vast'], defaultTarget: 'modal' },
];

const BY_CLASS = new Map(BACKEND_CLASSES.map((c) => [c.nodeClass, c]));

function scopesOf(n: PrismNode): string[] {
  const out: string[] = [];
  for (const r of n.capabilityRefs ?? []) {
    if (typeof r.scope === 'string') out.push(r.scope);
  }
  for (const ir of n.integrationRefs ?? []) {
    if (ir.capabilityRef?.scope) out.push(ir.capabilityRef.scope);
  }
  return out;
}

/** Read a node's declared backend class (from backendRef / subtype / scope).
 *  Returns null for a frontend node. */
export function backendClassOf(n: PrismNode): BackendNodeClass | null {
  const isBackend =
    (typeof n.backendRef === 'string' && n.backendRef.length > 0) ||
    BACKEND_SUBTYPE_PREFIXES.some((p) => n.subtype.startsWith(p)) ||
    scopesOf(n).some((s) => s.startsWith('model:'));
  if (!isBackend) return null;

  // Class from an explicit `model:<class>` scope, else subtype suffix, else a
  // sensible default (text-classifier — the smallest OSS head).
  const modelScope = scopesOf(n).find((s) => s.startsWith('model:'));
  if (modelScope) {
    const cls = modelScope.slice('model:'.length) as BackendNodeClass;
    if (BY_CLASS.has(cls)) return cls;
  }
  for (const p of BACKEND_SUBTYPE_PREFIXES) {
    if (n.subtype.startsWith(p)) {
      const cls = n.subtype.slice(p.length) as BackendNodeClass;
      if (BY_CLASS.has(cls)) return cls;
    }
  }
  return 'text-classifier';
}

export interface BackendNodeMapping {
  nodeId: string;
  nodeClass: BackendNodeClass;
  eligibleTargets: DeployTargetKind[];
  defaultTarget: DeployTargetKind;
  inferenceContract: InferenceContract | null;
  /** The generated host config for the default target (E15 requirements). */
  requirements: HostRequirements | null;
}

/** Detect every backend node in a graph and map each to its eligible targets +
 *  generated config (E19). Empty when the app is frontend-only. */
export function mapBackendNodes(graph: GraphSource, appName = 'app'): BackendNodeMapping[] {
  const out: BackendNodeMapping[] = [];
  for (const n of graph.nodes) {
    const nodeClass = backendClassOf(n);
    if (!nodeClass) continue;
    const spec = BY_CLASS.get(nodeClass)!;
    out.push({
      nodeId: n.nodeId,
      nodeClass,
      eligibleTargets: [...spec.eligibleTargets],
      defaultTarget: spec.defaultTarget,
      inferenceContract: buildInferenceContract(spec.defaultTarget, nodeClass),
      requirements: buildHostRequirements(spec.defaultTarget, appName, `/preview`),
    });
  }
  return out;
}

/** Does this graph have any backend/GPU node? (E18 recommendations gate.) */
export function hasBackendNodes(graph: GraphSource): boolean {
  return graph.nodes.some((n) => backendClassOf(n) !== null);
}

export function backendClassLabel(nodeClass: BackendNodeClass): string {
  return BY_CLASS.get(nodeClass)?.label ?? nodeClass;
}
