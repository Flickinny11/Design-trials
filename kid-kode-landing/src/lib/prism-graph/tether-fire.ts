// EB-09-03 — Tether-driven interaction on `'triggers'` edges.
//
// Spec refs:
//   §9 SC-049 (verbatim): "Tether-driven interaction: when an edge of type
//     `'triggers'` fires from source node, the target node's bound animations
//     run."
//
// Two pure surfaces:
//   1. `resolveTetherFireTargets(nodes, edges, fire)` walks the edges and
//      returns the subset of target nodes the source fire propagates to over
//      `'triggers'` edges. Each record carries the target's bound animations
//      (PrismKeyframe[]) and declared cinematic-primitive refs so the
//      runtime (and EB-09-05 physics/shader integration) has a single
//      derived view of "what to run on the target".
//   2. A functional `TetherFireState` for the renderer's tether-fire
//      visualization. `fireTether` schedules a fire with a duration window;
//      `getActiveTetherFires(state, now)` returns the currently visible
//      fires with their normalized progress. Old state values are never
//      mutated.
//
// EB-09-04 layers cross-space transform resolution on top of (1); EB-09-05
// adds physics/shader hooks for targets whose `cinematicPrimitives` declare
// them. EB-09-06 produces the two-runtime snapshot proof.

import type { PrismEdge, PrismKeyframe, PrismNode } from './types';
import type { CinematicPrimitiveRef } from './cinematic-primitives';

const TRIGGERS_EDGE_TYPE = 'triggers' as const;

export interface TetherFireEvent {
  // The id of the firing node. Only edges with `from === sourceNodeId`
  // participate.
  sourceNodeId: string;
  // Optional event-tag filter. When present, only edges whose `event` matches
  // are followed. When absent, all `triggers` edges from the source fire.
  event?: string;
  // Wall-clock millisecond timestamp of the fire. Carried through into the
  // tether-fire visualization state (`startedAt`).
  firedAt: number;
}

export interface TetherFireResolvedTarget {
  // The id of the target node receiving the fire.
  targetNodeId: string;
  // The originating PrismEdge — included so the renderer can color the
  // tether-fire visualization per the existing EDGE_COLORS table (RA-15).
  edge: PrismEdge;
  // The target node's keyframe animations to run on fire. Empty array when
  // the target declares none.
  boundKeyframes: PrismKeyframe[];
  // The target node's declared cinematic-primitive refs. EB-09-05 wires
  // physics/shader integration through these (e.g. `displacement-transition`).
  boundPrimitives: CinematicPrimitiveRef[];
}

export interface TetherFireScheduled {
  edge: PrismEdge;
  startedAt: number;
  durationMs: number;
}

export interface TetherFireState {
  readonly fires: ReadonlyArray<TetherFireScheduled>;
}

export interface ActiveTetherFire {
  edge: PrismEdge;
  startedAt: number;
  durationMs: number;
  // Normalized progress through the fire window: 0 at startedAt, 1 at
  // (startedAt + durationMs). Strictly inside [0, 1].
  progress: number;
}

// Walk the edges once. A target receives the fire iff:
//   - edge.type === 'triggers'                          (SC-049)
//   - edge.from === fire.sourceNodeId
//   - if fire.event is set, edge.event must match
//
// Pure: no input mutation, no clock, no RNG.
export function resolveTetherFireTargets(
  nodes: ReadonlyArray<PrismNode>,
  edges: ReadonlyArray<PrismEdge>,
  fire: TetherFireEvent,
): TetherFireResolvedTarget[] {
  const byId = new Map<string, PrismNode>();
  for (const n of nodes) byId.set(n.nodeId, n);

  const out: TetherFireResolvedTarget[] = [];
  for (const edge of edges) {
    if (edge.type !== TRIGGERS_EDGE_TYPE) continue;
    if (edge.from !== fire.sourceNodeId) continue;
    if (fire.event !== undefined && edge.event !== fire.event) continue;

    const target = byId.get(edge.to);
    if (!target) continue;

    out.push({
      targetNodeId: target.nodeId,
      edge,
      boundKeyframes: Array.isArray(target.keyframes)
        ? [...target.keyframes]
        : [],
      boundPrimitives: Array.isArray(target.cinematicPrimitives)
        ? [...target.cinematicPrimitives]
        : [],
    });
  }
  return out;
}

const EMPTY_STATE: TetherFireState = Object.freeze({ fires: Object.freeze([]) });

export function createTetherFireState(): TetherFireState {
  return EMPTY_STATE;
}

// Returns a NEW state with the additional fire appended. Old state values
// are immutable; readers that captured a previous reference see no change.
export function fireTether(
  state: TetherFireState,
  edge: PrismEdge,
  now: number,
  durationMs: number,
): TetherFireState {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return state;
  }
  const next: TetherFireScheduled = {
    edge,
    startedAt: now,
    durationMs,
  };
  return { fires: [...state.fires, next] };
}

// A fire is active during [startedAt, startedAt + durationMs]. The window is
// inclusive at the boundaries; tests confirm "strictly past duration" is
// inactive (now > startedAt + durationMs). progress is clamped to [0, 1].
export function getActiveTetherFires(
  state: TetherFireState,
  now: number,
): ActiveTetherFire[] {
  const out: ActiveTetherFire[] = [];
  for (const f of state.fires) {
    const elapsed = now - f.startedAt;
    if (elapsed < 0) continue;
    if (elapsed > f.durationMs) continue;
    const progress =
      f.durationMs > 0
        ? Math.max(0, Math.min(1, elapsed / f.durationMs))
        : 1;
    out.push({
      edge: f.edge,
      startedAt: f.startedAt,
      durationMs: f.durationMs,
      progress,
    });
  }
  return out;
}
