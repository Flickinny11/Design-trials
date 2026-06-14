// PRISM NODE-EDITOR V2 — Prompt-to-Edit CONTRACT (criteria A).
//
// This is the load-bearing seam between the UI and the (later) live AI service.
// The orchestrator — whether the offline STUB or the live Opus-backed service —
// takes a PromptEditRequest and returns a structured, VALIDATED PromptEditPlan.
// `applyPlan` (apply-plan.ts) is the ONLY thing that mutates the graph, and it
// writes ONLY known additive schema fields. The model NEVER returns code that is
// executed in the runtime (INV-NEV2-3). Swapping the stub for the live service
// is a config change behind `getOrchestrator()` — no UI or contract rework (A6).
//
// Boundary (base spec §5.3): DESIGN + ANIMATION steps route to the canvas
// additive fields; FUNCTION / INTEGRATION / SCHEMA / BEHAVIOR / BACKEND steps
// route to the node-editor tabs. The SAME contract serves the canvas "Prompt
// Edit" action and the node editor's own scoped prompt-edit (A5).

import type {
  PrismNode,
  FunctionTile,
  IntegrationRef,
} from '../prism-graph/types.ts';

/** Where the prompt-edit was invoked from / what it is scoped to (A5). */
export type PromptEditScope =
  | 'canvas' // full design + animation + function (the canvas toolbar action, A1/A2)
  | 'node-function' // node editor Functions tab
  | 'node-integration' // node editor Integrations tab
  | 'node-schema' // node editor Schema tab
  | 'node-behavior' // node editor Behavior tab
  | 'node-backend'; // node editor Backend tab

/** The current selection the prompt acts on (multi-select aware, A1). */
export interface PromptEditSelection {
  /** One or more selected node ids (A1: 1+ elements). */
  nodeIds: string[];
  /** The active hub, when the edit is hub-scoped. */
  hubId?: string;
}

/**
 * Context injected so the PREMIUM library is considered FIRST (A3). The route
 * fills these from the on-disk catalogs; the orchestrator receives compact
 * summaries (ids + tags + one-line intent), never the full source, to keep the
 * prompt budget sane. `atTags` carries any optional @tag the user typed.
 */
export interface PromptEditCatalogContext {
  /** DESIGN-REFERENCES toolkit summary (premium look vocabulary). */
  designReferences: string;
  /** ~406-primitive catalog summary (id + tags). */
  primitiveCatalog: CatalogEntrySummary[];
  /** 36-element library summary (id + tags). */
  elementLibrary: CatalogEntrySummary[];
  /** Optional explicit @tags the user named (honored but not required, A3). */
  atTags?: string[];
}

export interface CatalogEntrySummary {
  id: string;
  /** Plain-language label. */
  label: string;
  /** Search tags / category. */
  tags: string[];
}

/** The request handed to an orchestrator. */
export interface PromptEditRequest {
  /** Natural-language design + animation + function description (A2). */
  prompt: string;
  scope: PromptEditScope;
  selection: PromptEditSelection;
  /** Injected catalogs (A3). The route assembles this; UI never sends secrets. */
  context: PromptEditCatalogContext;
  /** Snapshot of the selected nodes (read-only) so the planner can diff intent. */
  nodes: Array<Pick<PrismNode, 'id' | 'caption' | 'renderMode' | 'subtype'> & Record<string, unknown>>;
}

// ── Plan steps — a discriminated union; each maps to ADDITIVE schema only ─────

/** Visual/design change → canvas additive fields (materialSpec, imageSpec, …). */
export interface DesignPlanStep {
  kind: 'design';
  nodeId: string;
  /** A partial of ONLY additive visual fields. Validated field-by-field on apply. */
  nodePatch: Partial<PrismNode>;
  rationale: string;
}

/** Animation change → animationBindings / keyframes (canvas). */
export interface AnimationPlanStep {
  kind: 'animation';
  nodeId: string;
  nodePatch: Partial<PrismNode>;
  /** Catalog primitive ids the planner chose (proves library was considered, A3). */
  primitiveIds: string[];
  rationale: string;
}

/** "make these two collide" — a multi-node physics/collision animation setup. */
export interface CollisionPlanStep {
  kind: 'collision';
  nodeIds: string[];
  /** Per-node additive animation patches that realize the collision. */
  patches: Record<string, Partial<PrismNode>>;
  primitiveIds: string[];
  rationale: string;
}

/** Function capability → functionTiles (node editor Functions tab). */
export interface FunctionPlanStep {
  kind: 'function';
  nodeId: string;
  /** Tiles to attach (ids minted on apply if absent). */
  functionTiles: Array<Omit<FunctionTile, 'id' | 'order'> & Partial<Pick<FunctionTile, 'id' | 'order'>>>;
  rationale: string;
}

/** Integration hookup → integrationRefs (node editor Integrations tab). */
export interface IntegrationPlanStep {
  kind: 'integration';
  nodeId: string;
  /** The platform to suggest connecting (auth happens in the Integrations tab). */
  platformId: string;
  platform: string;
  rationale: string;
  /** Pre-built refs when the planner already has a capability handle (rare). */
  integrationRefs?: IntegrationRef[];
}

/** Schema / data shape change (node editor Schema tab). */
export interface SchemaPlanStep {
  kind: 'schema';
  nodeId: string;
  /** Field descriptors (name + type + bind), applied to the node's schema doc. */
  fields: Array<{ name: string; type: string; bind?: string }>;
  rationale: string;
}

/** Behavior wiring (node editor Behavior tab) — functionBinding lives here. */
export interface BehaviorPlanStep {
  kind: 'behavior';
  nodeId: string;
  nodePatch: Partial<PrismNode>;
  rationale: string;
}

/** Backend capability (node editor Backend tab). */
export interface BackendPlanStep {
  kind: 'backend';
  nodeId: string;
  /** Backend descriptor text the Backend tab renders. */
  capability: string;
  rationale: string;
}

/** A brand-new artifact the user asked for ("add a hero banner"). The harness
 *  records intent + a caption; actual artifact generation is future-source. */
export interface NewArtifactPlanStep {
  kind: 'new-artifact';
  /** The hub the new node would attach to (topology stays frozen until built). */
  hubId?: string;
  caption: string;
  /** Suggested render mode + library refs for the future builder. */
  renderModeHint?: string;
  primitiveIds?: string[];
  rationale: string;
}

export type PlanStep =
  | DesignPlanStep
  | AnimationPlanStep
  | CollisionPlanStep
  | FunctionPlanStep
  | IntegrationPlanStep
  | SchemaPlanStep
  | BehaviorPlanStep
  | BackendPlanStep
  | NewArtifactPlanStep;

/** What the orchestrator returns. Structured + validated; never raw code. */
export interface PromptEditPlan {
  /** Stable id (`plan-<base36>`). */
  id: string;
  /** One-line human summary of the whole plan. */
  summary: string;
  steps: PlanStep[];
  /** Which library entries the planner CONSIDERED (proves premium-first, A3/A7). */
  libraryConsidered: {
    designReferences: boolean;
    primitiveIds: string[];
    elementIds: string[];
    /** True when premium entries outranked any non-premium option. */
    premiumFirst: boolean;
  };
  /** Non-fatal warnings (e.g. "1 step skipped: unknown field"). */
  warnings?: string[];
  /** Honest provenance: did the live model or the stub produce this? */
  origin: 'stub' | 'live';
}

/** The interface both the stub and the live service implement (A6 swap seam). */
export interface PromptEditOrchestrator {
  readonly origin: 'stub' | 'live';
  plan(req: PromptEditRequest): Promise<PromptEditPlan>;
}

/** The set of additive PrismNode fields applyPlan is allowed to write. Any
 *  field outside this allowlist in a nodePatch is dropped + warned (INV-NEV2-3:
 *  the plan can only touch additive schema, never topology or arbitrary code). */
export const APPLYABLE_NODE_FIELDS: ReadonlyArray<keyof PrismNode> = [
  'materialSpec',
  'imageSpec',
  'textSpec',
  'lightingSpec',
  'receivesLighting',
  'animationBindings',
  'keyframes',
  'scrollBinding',
  'meshPrimitive',
  'functionTiles',
  'integrationRefs',
  'functionBinding',
  'overlaySpec',
  'caption',
] as const;
