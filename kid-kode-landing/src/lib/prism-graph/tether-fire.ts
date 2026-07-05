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
import {
  EXERCISED_TRANSFORM_PIPELINE,
  getTransformBridge,
  type CoordinateSpace,
  type TransformBridge,
  type TransformContext,
} from './transforms';

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

// ---------------------------------------------------------------------------
// EB-09-04 — Cross-space tether resolution (SC-050, INV-22). Stub: real
// implementation arrives after the failing test commit. Carries the same
// public surface as the eventual implementation so the test compiles.
// ---------------------------------------------------------------------------

export interface CrossSpaceTetherFireResolvedTarget
  extends TetherFireResolvedTarget {
  // The coordinate space of the target's first declared keyframe, or
  // 'hub-scene' when the target has no keyframes (the documented default
  // for nodes that animate against their hub).
  readonly targetKeyframeSpace: CoordinateSpace;
  // The transform-pipeline bridge from `sourceSpace` to the target's
  // keyframe space. `null` when the hop is unregistered (INV-22: callers
  // surface the gap rather than collapse silently).
  readonly crossSpaceBridge: TransformBridge | null;
  // Audit token from `transforms.ts`. Presence proves the documented
  // pipeline was the path that produced this resolution.
  readonly exercisedPipeline: typeof EXERCISED_TRANSFORM_PIPELINE;
}

// Default target keyframe space when a target has no keyframes. Documented
// in resolveCrossSpaceTetherFire's comment; matches the spec's §4 'hub-scene'
// being the default authoring space for nodes inside a hub.
const DEFAULT_TARGET_SPACE: CoordinateSpace = 'hub-scene';

// SC-050: walks the SC-049 propagation and decorates each resolved target
// with the cross-space bridge required to project the source's animation
// space onto the target's keyframe space. The `transforms.ts` registry is
// the only path that produces a bridge — `_ctx` is taken so callers that
// later need numeric projection use the same descriptor.
//
// `_ctx` is currently consumed only by `transformVector`; tether-fire does
// not project numeric values today (the renderer applies the bridge at
// draw time). Keeping the parameter pins the call signature and lets the
// renderer-side EB-09-05 / EB-09-06 work share a single TransformContext.
export function resolveCrossSpaceTetherFire(
  nodes: ReadonlyArray<PrismNode>,
  edges: ReadonlyArray<PrismEdge>,
  fire: TetherFireEvent,
  sourceSpace: CoordinateSpace,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx: TransformContext,
): CrossSpaceTetherFireResolvedTarget[] {
  const baseTargets = resolveTetherFireTargets(nodes, edges, fire);
  const out: CrossSpaceTetherFireResolvedTarget[] = [];

  for (const base of baseTargets) {
    const targetKeyframeSpace: CoordinateSpace =
      base.boundKeyframes.length > 0
        ? base.boundKeyframes[0].coordinateSpace
        : DEFAULT_TARGET_SPACE;

    const crossSpaceBridge: TransformBridge | null = getTransformBridge(
      sourceSpace,
      targetKeyframeSpace,
    );

    out.push({
      ...base,
      targetKeyframeSpace,
      crossSpaceBridge,
      exercisedPipeline: EXERCISED_TRANSFORM_PIPELINE,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// EB-09-05 — Physics/shader integration on tether fire (SC-051, INV-12).
//
// `SHADER_PRIMITIVES` is the subset of the 9 fixed cinematic primitives
// (INV-12) that carry shader / physics integration at runtime. SC-051's
// worked example — `displacement-transition` — anchors the list; the other
// entries are the primitives whose runtime modules under
// `src/lib/prism/runtime/shared/primitives/` apply a TSL shader, GPU
// displacement, or visual GPU effect to their target object. Scene-graph-only
// primitives (orbit, depth-rotate, fly-through, parallax-scroll,
// magnetic-cursor, kinetic-text) are intentionally absent: they animate
// transforms but do not change the target's surface shader, and SC-051
// scopes the surface to "physics/shader integration".
//
// The set is frozen so a caller cannot widen the shader-fire set at runtime
// (a fresh primitive belongs in INV-12 first, then here).
//
// `resolveTetherFirePrimitiveActivations` is pure: given a SC-049 resolved
// target and the originating fire, it returns one activation per
// shader-capable primitive declared on that target. The activation carries
// the originating edge + `firedAt` timestamp so downstream renderers can
// sequence multiple simultaneous fires deterministically.
//
// `applyTetherFirePrimitives` is the runtime adapter: it resolves each
// activation's `targetNodeId` to a `THREE.Object3D` via the supplied lookup
// and invokes the corresponding primitive on the runtime API. Activations
// whose target is not currently mounted (lookup returns null) are silently
// skipped — the source node may have fired before the target's hub becomes
// active; the renderer recovers by re-issuing the fire on hub activation.
// ---------------------------------------------------------------------------

import type { Object3D } from 'three';
import type { CinematicPrimitiveName } from './cinematic-primitives';

export interface TetherFirePrimitiveActivation {
  readonly targetNodeId: string;
  readonly edge: PrismEdge;
  readonly primitive: CinematicPrimitiveRef;
  readonly firedAt: number;
}

export interface TetherFirePrimitiveResult {
  readonly timeline: unknown;
  readonly cleanup: () => void;
}

export type TetherFirePrimitivesAPI = Record<
  CinematicPrimitiveName,
  (target: Object3D, params: unknown) => TetherFirePrimitiveResult
>;

export const SHADER_PRIMITIVES: ReadonlyArray<CinematicPrimitiveName> =
  Object.freeze([
    'displacement-transition',
    'dissolve-morph',
    'particle-emerge',
  ] as CinematicPrimitiveName[]);

const SHADER_PRIMITIVE_SET: ReadonlySet<CinematicPrimitiveName> = new Set(
  SHADER_PRIMITIVES,
);

export function resolveTetherFirePrimitiveActivations(
  resolved: TetherFireResolvedTarget,
  fire: TetherFireEvent,
): TetherFirePrimitiveActivation[] {
  const out: TetherFirePrimitiveActivation[] = [];
  for (const primitive of resolved.boundPrimitives) {
    if (!SHADER_PRIMITIVE_SET.has(primitive.name)) continue;
    out.push({
      targetNodeId: resolved.targetNodeId,
      edge: resolved.edge,
      primitive,
      firedAt: fire.firedAt,
    });
  }
  return out;
}

export function applyTetherFirePrimitives(
  activations: ReadonlyArray<TetherFirePrimitiveActivation>,
  primitivesAPI: TetherFirePrimitivesAPI,
  lookupObject3D: (nodeId: string) => Object3D | null,
): TetherFirePrimitiveResult[] {
  const out: TetherFirePrimitiveResult[] = [];
  for (const activation of activations) {
    const target = lookupObject3D(activation.targetNodeId);
    if (!target) continue;
    const fn = primitivesAPI[activation.primitive.name];
    if (typeof fn !== 'function') continue;
    out.push(fn(target, activation.primitive.params));
  }
  return out;
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
