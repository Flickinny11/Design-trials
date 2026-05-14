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
 * STUB — real implementation lands in Step 7. Throws so the failing-test
 * step (Step 6) records a runtime failure for every validator assertion.
 */
export function validateRootNode(
  _graph: GraphSource & { rootNodes?: PrismRootNode[] },
): RootNodeValidationResult {
  throw new Error('validateRootNode: not implemented (EB-02-01 stub)');
}

/** STUB — real implementation lands in Step 7. */
export function serializeRootNode(_root: PrismRootNode): string {
  throw new Error('serializeRootNode: not implemented (EB-02-01 stub)');
}

/** STUB — real implementation lands in Step 7. */
export function deserializeRootNode(_json: string): PrismRootNode {
  throw new Error('deserializeRootNode: not implemented (EB-02-01 stub)');
}
