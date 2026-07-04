// PRISM SHELL — MODEL CONFIG SOURCE (SHELL W0, spec §7.4, 2026-07-04)
//
// THE single source of model identity/availability for every shell surface.
// Spec 7.4: "The shell must not hardcode model strings in components; model
// identity/availability comes from a single config source (so 'whichever is
// newest' is a data change, not a code change)."
//
// Consequences:
//   - Model id literals appear in THIS file only. A component that needs a
//     model renders from getModelRegistry() / getDefaultModel(); a grep for
//     model-id literals outside this module is a DESIGN-LAW sweep failure.
//   - Enabling a future model (or gating one when access lapses) is an edit
//     to MODEL_REGISTRY below — no UI rework (spec 7.2).
//   - Build-time subagent routing (CONSTELLATION) is a harness concern and is
//     deliberately NOT represented here (spec 7.3).
//
// Current data (spec §7.1 reality note, 2026-07-04): Fable 5 access resumed —
// claude-fable-5 is the active default; claude-opus-4-8 remains active.

/** Availability of a model in the user-facing selector.
 *  - active: selectable now.
 *  - gated:  visible but disabled, with a clear state label (never presented
 *            as available when it isn't — spec 7.1).
 *  - hidden: not rendered at all. */
export type PrismModelStatus = 'active' | 'gated' | 'hidden';

export interface PrismModelConfig {
  /** Provider model id — the only place these strings exist in the shell. */
  readonly id: string;
  /** Human label for the selector. */
  readonly label: string;
  readonly status: PrismModelStatus;
  /** Exactly one registry entry carries default: true. */
  readonly default: boolean;
  /** Shown alongside gated entries (e.g. "available when access resumes"). */
  readonly statusNote?: string;
}

const MODEL_REGISTRY: readonly PrismModelConfig[] = [
  {
    id: 'claude-fable-5',
    label: 'Claude Fable 5',
    status: 'active',
    default: true,
  },
  {
    id: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    status: 'active',
    default: false,
  },
] as const;

/** All models a selector may render (active + gated). `hidden` never leaves
 *  this module. */
export function getModelRegistry(): readonly PrismModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.status !== 'hidden');
}

/** Models the user can actually pick right now. */
export function getActiveModels(): readonly PrismModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.status === 'active');
}

/** The configured default. Throws at module-consumption time if the registry
 *  is misconfigured (no active default) rather than silently picking one. */
export function getDefaultModel(): PrismModelConfig {
  const def = MODEL_REGISTRY.find((m) => m.default && m.status === 'active');
  if (!def) {
    throw new Error(
      'model-config: registry has no active default — fix MODEL_REGISTRY (spec 7.4)',
    );
  }
  return def;
}

/** Lookup by id (for round-tripping a persisted per-project override —
 *  spec 7.2). Returns undefined for unknown/hidden ids so callers fall back
 *  to the default instead of trusting stale persisted strings. */
export function getModelById(id: string): PrismModelConfig | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id && m.status !== 'hidden');
}
