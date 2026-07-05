// EB-09-03 — Tether-driven interaction on `'triggers'` edges (SC-049).
//
// Spec refs:
//   §9 SC-049 (verbatim): "Tether-driven interaction: when an edge of type
//     `'triggers'` fires from source node, the target node's bound animations
//     run."
//   §9 (cross-ref) — Phase 9 mechanism rides on `PrismEdgeType === 'triggers'`
//     (types.ts:502). Cross-space resolution is EB-09-04, physics/shader
//     coupling is EB-09-05, full snapshot is EB-09-06. This task is the core
//     propagation mechanism: source fire → resolved target list + their bound
//     animations, plus a firing-visualization state for the renderer.
//
// haltCheck (from ralph-state.json EB-09-03):
//   "When an edge of type 'triggers' fires from source node, target node's
//    bound animations run; tether-fire visualization renders during firing;
//    snapshot proves propagation across at least one pair."
//
// Strategy: pin the public contract of the new `tether-fire` module.
//   - `resolveTetherFireTargets` follows `'triggers'` edges ONLY (not
//     `state-update` / `data-flow` / `event-bubble`).
//   - For each resolved target, the returned record carries the target node's
//     bound animations derived from its `keyframes` and `cinematicPrimitives`.
//   - A firing-state machine tracks active fires by edge for the tether-fire
//     visualization (durations decay, fires expire deterministically).
//
// This test MUST FAIL on commit (no implementation yet); EB-09-03's
// implementation step makes it pass.

import { describe, it, expect } from 'vitest';
import type {
  PrismEdge,
  PrismKeyframe,
  PrismNode,
} from '@/lib/prism-graph/types';
import type { CinematicPrimitiveRef } from '@/lib/prism-graph/cinematic-primitives';
import {
  createTetherFireState,
  fireTether,
  getActiveTetherFires,
  resolveTetherFireTargets,
  type TetherFireEvent,
} from '@/lib/prism-graph/tether-fire';

// ----- fixtures ---------------------------------------------------------

function mkNode(
  nodeId: string,
  overrides: Partial<PrismNode> = {},
): PrismNode {
  // Minimal PrismNode shell; only the fields the tether-fire resolver reads
  // need to be meaningful. Cast through unknown to skip the full shape.
  return {
    nodeId,
    parentHubId: 'hub-a',
    subtype: 'generic',
    ...(overrides as object),
  } as unknown as PrismNode;
}

const SOURCE_LOAD_KF: PrismKeyframe = {
  coordinateSpace: 'hub-scene',
  t: 0,
  params: { opacity: 0 },
  trigger: 'load',
};

const TARGET_HOVER_KFS: PrismKeyframe[] = [
  {
    coordinateSpace: 'hub-scene',
    t: 0,
    params: { translateZ: 0, scale: 1 },
    trigger: 'hover',
  },
  {
    coordinateSpace: 'hub-scene',
    t: 1,
    params: { translateZ: 0.15, scale: 1.04 },
  },
];

const TARGET_PRIMITIVE_REF: CinematicPrimitiveRef = {
  name: 'displacement-transition',
  params: { intensity: 0.3 },
  trigger: 'click',
};

// ----- resolveTetherFireTargets ----------------------------------------

describe('EB-09-03 — resolveTetherFireTargets (SC-049 core propagation)', () => {
  it('follows ONLY edges of type "triggers"', () => {
    const source = mkNode('src');
    const targetTrig = mkNode('tgt-trig', { keyframes: TARGET_HOVER_KFS });
    const targetDataFlow = mkNode('tgt-data', { keyframes: TARGET_HOVER_KFS });
    const targetStateUpdate = mkNode('tgt-state', {
      keyframes: TARGET_HOVER_KFS,
    });
    const targetEventBubble = mkNode('tgt-event', {
      keyframes: TARGET_HOVER_KFS,
    });
    const nodes = [
      source,
      targetTrig,
      targetDataFlow,
      targetStateUpdate,
      targetEventBubble,
    ];
    const edges: PrismEdge[] = [
      { from: 'src', to: 'tgt-trig', type: 'triggers' },
      { from: 'src', to: 'tgt-data', type: 'data-flow' },
      { from: 'src', to: 'tgt-state', type: 'state-update' },
      { from: 'src', to: 'tgt-event', type: 'event-bubble' },
    ];
    const fire: TetherFireEvent = { sourceNodeId: 'src', firedAt: 1000 };

    const targets = resolveTetherFireTargets(nodes, edges, fire);
    const ids = targets.map((t) => t.targetNodeId).sort();

    expect(ids).toEqual(['tgt-trig']);
  });

  it('ignores edges whose `from` is not the firing source node', () => {
    const a = mkNode('a', { keyframes: TARGET_HOVER_KFS });
    const b = mkNode('b', { keyframes: TARGET_HOVER_KFS });
    const c = mkNode('c', { keyframes: TARGET_HOVER_KFS });
    const edges: PrismEdge[] = [
      { from: 'a', to: 'b', type: 'triggers' },
      { from: 'b', to: 'c', type: 'triggers' }, // not from 'a'
    ];
    const fire: TetherFireEvent = { sourceNodeId: 'a', firedAt: 1 };

    const targets = resolveTetherFireTargets([a, b, c], edges, fire);
    expect(targets.map((t) => t.targetNodeId)).toEqual(['b']);
  });

  it('returns the target node\'s keyframes as bound animations', () => {
    const source = mkNode('src', { keyframes: [SOURCE_LOAD_KF] });
    const target = mkNode('tgt', { keyframes: TARGET_HOVER_KFS });
    const edges: PrismEdge[] = [
      { from: 'src', to: 'tgt', type: 'triggers' },
    ];
    const fire: TetherFireEvent = { sourceNodeId: 'src', firedAt: 1 };

    const [resolved] = resolveTetherFireTargets([source, target], edges, fire);
    expect(resolved).toBeDefined();
    expect(resolved.targetNodeId).toBe('tgt');
    expect(resolved.boundKeyframes).toEqual(TARGET_HOVER_KFS);
    // The SOURCE's keyframes MUST NOT leak into the target's bound animations.
    expect(resolved.boundKeyframes).not.toContain(SOURCE_LOAD_KF);
  });

  it('surfaces the target\'s declared cinematicPrimitives (SC-051 hookpoint)', () => {
    const source = mkNode('src');
    const target = mkNode('tgt', {
      keyframes: TARGET_HOVER_KFS,
      cinematicPrimitives: [TARGET_PRIMITIVE_REF],
    });
    const edges: PrismEdge[] = [
      { from: 'src', to: 'tgt', type: 'triggers' },
    ];

    const [resolved] = resolveTetherFireTargets(
      [source, target],
      edges,
      { sourceNodeId: 'src', firedAt: 0 },
    );
    expect(resolved.boundPrimitives).toEqual([TARGET_PRIMITIVE_REF]);
  });

  it('handles a target node missing keyframes/primitives without throwing', () => {
    const source = mkNode('src');
    const bareTarget = mkNode('bare');
    const edges: PrismEdge[] = [
      { from: 'src', to: 'bare', type: 'triggers' },
    ];

    const [resolved] = resolveTetherFireTargets(
      [source, bareTarget],
      edges,
      { sourceNodeId: 'src', firedAt: 0 },
    );
    expect(resolved.targetNodeId).toBe('bare');
    expect(resolved.boundKeyframes).toEqual([]);
    expect(resolved.boundPrimitives).toEqual([]);
  });

  it('attaches the originating PrismEdge for renderer visualization', () => {
    const source = mkNode('src');
    const target = mkNode('tgt', { keyframes: TARGET_HOVER_KFS });
    const edge: PrismEdge = {
      from: 'src',
      to: 'tgt',
      type: 'triggers',
      event: 'click',
    };
    const [resolved] = resolveTetherFireTargets(
      [source, target],
      [edge],
      { sourceNodeId: 'src', event: 'click', firedAt: 7 },
    );
    expect(resolved.edge).toEqual(edge);
  });

  it('matches the optional `event` filter when present on the fire event', () => {
    const source = mkNode('src');
    const target = mkNode('tgt', { keyframes: TARGET_HOVER_KFS });
    const edges: PrismEdge[] = [
      { from: 'src', to: 'tgt', type: 'triggers', event: 'click' },
      { from: 'src', to: 'tgt', type: 'triggers', event: 'hover' },
    ];
    // Fire event names 'click' — only the 'click'-tagged edge participates.
    const targets = resolveTetherFireTargets(
      [source, target],
      edges,
      { sourceNodeId: 'src', event: 'click', firedAt: 0 },
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].edge.event).toBe('click');
  });

  it('returns ALL `triggers` edges from source when fire event omits `event`', () => {
    const source = mkNode('src');
    const target = mkNode('tgt', { keyframes: TARGET_HOVER_KFS });
    const edges: PrismEdge[] = [
      { from: 'src', to: 'tgt', type: 'triggers', event: 'click' },
      { from: 'src', to: 'tgt', type: 'triggers', event: 'hover' },
    ];
    const targets = resolveTetherFireTargets(
      [source, target],
      edges,
      { sourceNodeId: 'src', firedAt: 0 },
    );
    // Both edges fire (no event filter). Same target → 2 records.
    expect(targets).toHaveLength(2);
  });

  it('is a pure function: same input → identical output, no input mutation', () => {
    const source = mkNode('src');
    const target = mkNode('tgt', { keyframes: TARGET_HOVER_KFS });
    const edges: PrismEdge[] = [
      { from: 'src', to: 'tgt', type: 'triggers' },
    ];
    const edgesSnapshot = JSON.parse(JSON.stringify(edges));
    const fire: TetherFireEvent = { sourceNodeId: 'src', firedAt: 1 };

    const r1 = resolveTetherFireTargets([source, target], edges, fire);
    const r2 = resolveTetherFireTargets([source, target], edges, fire);
    expect(r2).toEqual(r1);
    expect(edges).toEqual(edgesSnapshot);
  });
});

// ----- tether-fire visualization state machine -------------------------

describe('EB-09-03 — tether-fire visualization state (haltCheck)', () => {
  const EDGE_A: PrismEdge = { from: 'src', to: 'a', type: 'triggers' };
  const EDGE_B: PrismEdge = { from: 'src', to: 'b', type: 'triggers' };

  it('createTetherFireState() yields an empty active-fire set', () => {
    const s = createTetherFireState();
    expect(getActiveTetherFires(s, 0)).toEqual([]);
    expect(getActiveTetherFires(s, 999_999)).toEqual([]);
  });

  it('fireTether() registers a fire whose visualization is active during its window', () => {
    const t0 = 1_000;
    const dur = 500;
    const s = fireTether(createTetherFireState(), EDGE_A, t0, dur);

    expect(getActiveTetherFires(s, t0)).toHaveLength(1);
    expect(getActiveTetherFires(s, t0 + dur - 1)).toHaveLength(1);
    // Strictly past the duration window: no longer active.
    expect(getActiveTetherFires(s, t0 + dur + 1)).toEqual([]);
  });

  it('active fire carries (edge, startedAt, durationMs, progress)', () => {
    const t0 = 100;
    const dur = 1_000;
    const s = fireTether(createTetherFireState(), EDGE_A, t0, dur);
    const [fire] = getActiveTetherFires(s, t0 + 250);
    expect(fire.edge).toEqual(EDGE_A);
    expect(fire.startedAt).toBe(t0);
    expect(fire.durationMs).toBe(dur);
    expect(fire.progress).toBeCloseTo(0.25, 5);
  });

  it('multiple simultaneous fires render in parallel; each expires independently', () => {
    let s = createTetherFireState();
    s = fireTether(s, EDGE_A, 0, 100);
    s = fireTether(s, EDGE_B, 50, 100);

    expect(getActiveTetherFires(s, 75)).toHaveLength(2);
    // EDGE_A finished at 100; EDGE_B still active at 125.
    const at125 = getActiveTetherFires(s, 125);
    expect(at125).toHaveLength(1);
    expect(at125[0].edge).toEqual(EDGE_B);
  });

  it('does NOT mutate the previous state value (functional-update contract)', () => {
    const s0 = createTetherFireState();
    const s1 = fireTether(s0, EDGE_A, 0, 100);
    expect(getActiveTetherFires(s0, 50)).toEqual([]);
    expect(getActiveTetherFires(s1, 50)).toHaveLength(1);
  });
});
