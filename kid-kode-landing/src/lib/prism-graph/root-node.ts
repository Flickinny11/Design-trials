// PrismRootNode — the typed shape of the App_Name_World "center sun" root
// node (RA-07). Co-exists with PrismNode inside GraphSource; not a variant
// of PrismNode.
//
// Spec refs:
//   §2 SC-005 — type exists with the D1 fields as typed graph data.
//   §2 SC-006 — exactly one PrismRootNode instance per valid GraphSource.
//   §8 INV-18 — additive schema growth only.
//   §9 RA-07 — option B: dedicated PrismRootNode interface co-exists with
//              PrismNode in GraphSource.
//
// The 11 D1 fields are real graph data (per RA-01 / D1): the spec, design
// spec, build plan, memory log, hub & node registries, global deps,
// validation rules, AI routing rules, and capability references are stored
// inside the graph itself — not as references to external storage.
//
// Supporting types here are intentionally minimal-but-real placeholders.
// Phase 2 (EB-02-05, EB-02-06) and Phase 9/10 (EB-09-*, EB-10-*) tighten
// them as their own surfaces come online. Each placeholder is a plain
// record with required identity fields; downstream specifics are layered
// in additively without rename/delete.

import type { GraphSource } from './types.ts';

/** App-level product spec (name, summary, goals). Tightened by Phase 2 tasks. */
export interface AppSpec {
  name: string;
  summary?: string;
  goals?: string[];
  [k: string]: unknown;
}

/** Design system + visual constraints. Tightened by Phase 7 tasks. */
export interface DesignSpec {
  themeId?: string;
  palette?: Record<string, string>;
  typography?: Record<string, unknown>;
  [k: string]: unknown;
}

/** Build plan / generation strategy. Tightened by Phase 10 tasks. */
export interface BuildPlan {
  strategy?: string;
  stages?: string[];
  [k: string]: unknown;
}

/** One entry in the App_Name_World memory log. */
export interface MemoryLogEntry {
  ts: number;
  kind: string;
  body: string;
  [k: string]: unknown;
}

/** Index of hubs registered under the world. */
export interface HubRegistryEntry {
  hubId: string;
  role?: string;
  [k: string]: unknown;
}

/** Index of nodes registered under the world. */
export interface NodeRegistryEntry {
  nodeId: string;
  hubId?: string;
  subtype?: string;
  [k: string]: unknown;
}

/** Cross-app dependency declaration. */
export interface GlobalDependency {
  id: string;
  kind: string;
  [k: string]: unknown;
}

/** App-wide validation rule. */
export interface ValidationRule {
  id: string;
  expression: string;
  severity?: 'error' | 'warning' | 'info';
  [k: string]: unknown;
}

/** AI routing rule (which model handles which intent). */
export interface AiRoutingRule {
  id: string;
  match: string;
  route: string;
  [k: string]: unknown;
}

/**
 * Capability reference — opaque pointer the vault resolves at request time.
 * INV-19 / FP-06: never carries a raw secret value. Resolution happens in
 * src/server/secrets/** with audit logging (EB-02-05).
 */
export interface CapabilityRef {
  refId: string;
  scope: string;
  label?: string;
  [k: string]: unknown;
}

/**
 * PrismRootNode — typed shape of App_Name_World as a real graph node
 * (RA-07, D1). All 11 fields are real graph data, not external references.
 */
export interface PrismRootNode {
  appNameWorldId: string;
  spec: AppSpec;
  designSpec: DesignSpec;
  buildPlan: BuildPlan;
  memoryLog: MemoryLogEntry[];
  hubRegistry: HubRegistryEntry[];
  nodeRegistry: NodeRegistryEntry[];
  globalDependencies: GlobalDependency[];
  validationRules: ValidationRule[];
  aiRoutingRules: AiRoutingRule[];
  capabilityRefs: CapabilityRef[];
}

/**
 * Structured result from validateRootNode. Not a discriminated union (the
 * project compiles with strict: false, so discriminant narrowing isn't
 * reliable at every call site) — both `root` and `reason` are always
 * present, with `null` when not applicable. `ok` is the source of truth.
 */
export interface RootNodeValidationResult {
  ok: boolean;
  root: PrismRootNode | null;
  reason: string | null;
}

/**
 * Validate that the GraphSource carries exactly one PrismRootNode (SC-006,
 * RA-07). Returns a non-throwing result; callers decide whether the failure
 * should be fatal at their layer. Loader/serializer paths surface the
 * reason; runtime tooling treats `ok === false` as a hard invariant break.
 */
export function validateRootNode(
  graph: GraphSource & { rootNodes?: PrismRootNode[] },
): RootNodeValidationResult {
  const roots = graph?.rootNodes;
  if (!Array.isArray(roots) || roots.length === 0) {
    return {
      ok: false,
      root: null,
      reason:
        'GraphSource is missing rootNodes — exactly one PrismRootNode is required (SC-006).',
    };
  }
  if (roots.length > 1) {
    return {
      ok: false,
      root: null,
      reason: `GraphSource carries ${roots.length} PrismRootNode instances — exactly one is required (SC-006).`,
    };
  }
  const [root] = roots;
  if (
    !root ||
    typeof root !== 'object' ||
    typeof (root as PrismRootNode).appNameWorldId !== 'string' ||
    (root as PrismRootNode).appNameWorldId.length === 0
  ) {
    return {
      ok: false,
      root: null,
      reason: 'PrismRootNode is missing or has no appNameWorldId.',
    };
  }
  return { ok: true, root: root as PrismRootNode, reason: null };
}

/**
 * Serialize a PrismRootNode to canonical JSON. Field order is fixed so that
 * round-trips through deserializeRootNode → serializeRootNode produce a
 * byte-identical string (test in EB-02-01 asserts this). Stable ordering
 * matters once we hash compiled views (Phase 6) and graph snapshots
 * (Phase 10).
 */
export function serializeRootNode(root: PrismRootNode): string {
  const canonical: PrismRootNode = {
    appNameWorldId: root.appNameWorldId,
    spec: root.spec,
    designSpec: root.designSpec,
    buildPlan: root.buildPlan,
    memoryLog: root.memoryLog,
    hubRegistry: root.hubRegistry,
    nodeRegistry: root.nodeRegistry,
    globalDependencies: root.globalDependencies,
    validationRules: root.validationRules,
    aiRoutingRules: root.aiRoutingRules,
    capabilityRefs: root.capabilityRefs,
  };
  return JSON.stringify(canonical);
}

/**
 * Inverse of serializeRootNode. Throws on malformed JSON or on a payload
 * that doesn't have the 11 D1 fields. The shape check is shallow on
 * purpose — the field-value types are tightened by later Phase 2 tasks.
 */
export function deserializeRootNode(json: string): PrismRootNode {
  const raw = JSON.parse(json) as unknown;
  if (!raw || typeof raw !== 'object') {
    throw new Error('deserializeRootNode: payload is not an object.');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.appNameWorldId !== 'string' || r.appNameWorldId.length === 0) {
    throw new Error('deserializeRootNode: missing appNameWorldId.');
  }
  for (const arrField of [
    'memoryLog',
    'hubRegistry',
    'nodeRegistry',
    'globalDependencies',
    'validationRules',
    'aiRoutingRules',
    'capabilityRefs',
  ] as const) {
    if (!Array.isArray(r[arrField])) {
      throw new Error(`deserializeRootNode: ${arrField} must be an array.`);
    }
  }
  for (const objField of ['spec', 'designSpec', 'buildPlan'] as const) {
    if (!r[objField] || typeof r[objField] !== 'object') {
      throw new Error(`deserializeRootNode: ${objField} must be an object.`);
    }
  }
  return {
    appNameWorldId: r.appNameWorldId,
    spec: r.spec as AppSpec,
    designSpec: r.designSpec as DesignSpec,
    buildPlan: r.buildPlan as BuildPlan,
    memoryLog: r.memoryLog as MemoryLogEntry[],
    hubRegistry: r.hubRegistry as HubRegistryEntry[],
    nodeRegistry: r.nodeRegistry as NodeRegistryEntry[],
    globalDependencies: r.globalDependencies as GlobalDependency[],
    validationRules: r.validationRules as ValidationRule[],
    aiRoutingRules: r.aiRoutingRules as AiRoutingRule[],
    capabilityRefs: r.capabilityRefs as CapabilityRef[],
  };
}
