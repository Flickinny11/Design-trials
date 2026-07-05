// EB-09-04 — Cross-space tether resolution via documented transform pipeline.
//
// Spec refs:
//   §6 SC-050 (verbatim): "Tether-interaction respects coordinate space; one
//     node animating in `hub-scene` can trigger a `viewport-composition`
//     animation on a tethered node via the documented transform pipeline."
//   §7 INV-22 (verbatim): "Coordinate systems are never collapsed into one
//     matrix without passing through the documented transform pipeline in
//     `kid-kode-landing/src/lib/prism-graph/transforms.ts` (or equivalent)."
//   §4 Coordinate systems — five canonical spaces (RA-03, fixed by the
//     camera + composition systems): `universe | hub-scene |
//     viewport-composition | scroll-timeline | camera`. Pipeline is
//     compile-time for preview-hub/preview-app and runtime for
//     galaxy ↔ hub-world.
//
// haltCheck (ralph-state.json EB-09-04):
//   "Tether between source in hub-scene and target in viewport-composition
//    resolves correctly; transform pipeline (src/lib/prism-graph/transforms.ts)
//    is the only path used; coordinate systems remain uncollapsed."
//
// Strategy: pin the public contract of the new `transforms` module AND the
// cross-space-aware wrapper around tether-fire propagation.
//   1. `transforms.ts` exports the canonical 5-space set, a registry of
//      hops, a typed `transformVector` that refuses unregistered hops (no
//      silent identity fallback — that would be a coordinate-system collapse,
//      INV-22), and a `getTransformBridge` lookup.
//   2. `resolveCrossSpaceTetherFire` (new export from `tether-fire.ts`)
//      consumes the existing SC-049 propagation and adds a per-target
//      `crossSpaceBridge` descriptor when the source space differs from the
//      target's keyframe space. The descriptor is the same value returned
//      by `getTransformBridge` — proving the transform pipeline is the only
//      path used (haltCheck).
//   3. `EXERCISED_TRANSFORM_PIPELINE` Symbol exported from transforms.ts is
//      the audit token; resolved targets carry it so a reader can verify the
//      pipeline was actually invoked (no shadow path).
//
// This test MUST FAIL on commit (transforms.ts does not yet exist; tether-fire
// exposes no cross-space surface). The implementation step makes it pass.

import { describe, it, expect } from 'vitest';
import type {
  PrismEdge,
  PrismKeyframe,
  PrismNode,
} from '@/lib/prism-graph/types';
import { KEYFRAME_COORDINATE_SPACES } from '@/lib/prism-graph/types';
import {
  EXERCISED_TRANSFORM_PIPELINE,
  TRANSFORM_REGISTRY,
  type CoordinateSpace,
  type TransformBridge,
  type TransformContext,
  getTransformBridge,
  transformVector,
} from '@/lib/prism-graph/transforms';
import {
  resolveCrossSpaceTetherFire,
  type CrossSpaceTetherFireResolvedTarget,
  type TetherFireEvent,
} from '@/lib/prism-graph/tether-fire';

// ----- fixtures ---------------------------------------------------------

function mkNode(
  nodeId: string,
  overrides: Partial<PrismNode> = {},
): PrismNode {
  return {
    nodeId,
    parentHubId: 'hub-a',
    subtype: 'generic',
    ...(overrides as object),
  } as unknown as PrismNode;
}

const HUB_SCENE_HOVER_KF: PrismKeyframe = {
  coordinateSpace: 'hub-scene',
  t: 0,
  params: { translateZ: 0, scale: 1 },
  trigger: 'hover',
};

const VIEWPORT_COMPOSITION_SLIDE_KF: PrismKeyframe[] = [
  {
    coordinateSpace: 'viewport-composition',
    t: 0,
    params: { translateY: 0.5, opacity: 0 },
    trigger: 'in-view',
  },
  {
    coordinateSpace: 'viewport-composition',
    t: 1,
    params: { translateY: 0, opacity: 1 },
  },
];

const SCROLL_TIMELINE_FADE_KF: PrismKeyframe[] = [
  {
    coordinateSpace: 'scroll-timeline',
    t: 0,
    params: { opacity: 0 },
  },
  {
    coordinateSpace: 'scroll-timeline',
    t: 1,
    params: { opacity: 1 },
  },
];

const CTX: TransformContext = Object.freeze({
  viewportWidth: 1280,
  viewportHeight: 720,
  cameraFov: 60,
  cameraDistance: 12,
  scrollProgress: 0.25,
  hubWorldPosition: { x: 0, y: 0, z: 0 },
});

// ----- transforms registry ---------------------------------------------

describe('EB-09-04 — transforms.ts registry (§4 + INV-22)', () => {
  it('registers every identity hop for the canonical 5 spaces', () => {
    for (const space of KEYFRAME_COORDINATE_SPACES) {
      const bridge = getTransformBridge(space, space);
      expect(bridge).not.toBeNull();
      expect(bridge?.from).toBe(space);
      expect(bridge?.to).toBe(space);
      expect(bridge?.kind).toBe('identity');
    }
  });

  it('registers the SC-050 cross-space hop hub-scene → viewport-composition as compile-time projection', () => {
    const bridge = getTransformBridge('hub-scene', 'viewport-composition');
    expect(bridge).not.toBeNull();
    expect(bridge?.phase).toBe('compile-time');
    expect(bridge?.kind).toBe('projection');
  });

  it('registers the inverse hop viewport-composition → hub-scene as compile-time unprojection', () => {
    const bridge = getTransformBridge('viewport-composition', 'hub-scene');
    expect(bridge).not.toBeNull();
    expect(bridge?.phase).toBe('compile-time');
    expect(bridge?.kind).toBe('unprojection');
  });

  it('marks galaxy ↔ hub-world hops (universe ↔ hub-scene) as runtime (per §4)', () => {
    const out = getTransformBridge('universe', 'hub-scene');
    const back = getTransformBridge('hub-scene', 'universe');
    expect(out?.phase).toBe('runtime');
    expect(back?.phase).toBe('runtime');
    expect(out?.kind).toBe('runtime-bridge');
    expect(back?.kind).toBe('runtime-bridge');
  });

  it('every registered entry has from/to drawn from the canonical 5 (RA-03)', () => {
    const canonical = new Set<string>(KEYFRAME_COORDINATE_SPACES);
    for (const entry of TRANSFORM_REGISTRY) {
      expect(canonical.has(entry.from)).toBe(true);
      expect(canonical.has(entry.to)).toBe(true);
    }
  });

  it('returns null for unregistered hops — no silent identity fallback (INV-22)', () => {
    // The registry must not include a hop the spec hasn't documented.
    // `scroll-timeline → camera` is not in §4's documented set; the registry
    // returns null (callers must surface, not collapse).
    expect(getTransformBridge('scroll-timeline', 'camera')).toBeNull();
  });
});

// ----- transformVector --------------------------------------------------

describe('EB-09-04 — transformVector (pure hop application)', () => {
  it('is the identity on same-space hops', () => {
    const v = { x: 1, y: -2, z: 3 };
    const out = transformVector(v, 'hub-scene', 'hub-scene', CTX);
    expect(out).toEqual(v);
  });

  it('projects hub-scene → viewport-composition deterministically (same input → same output)', () => {
    const v = { x: 0.5, y: -0.25, z: -2 };
    const a = transformVector(v, 'hub-scene', 'viewport-composition', CTX);
    const b = transformVector(v, 'hub-scene', 'viewport-composition', CTX);
    expect(a).toEqual(b);
    // viewport-composition coords are viewport-relative (~ unit-ish); the
    // projection must not just echo the input (that would be a coordinate
    // collapse).
    expect(a).not.toEqual(v);
  });

  it('round-trips hub-scene → viewport-composition → hub-scene approximately', () => {
    const v = { x: 0.3, y: 0.1, z: -5 };
    const projected = transformVector(v, 'hub-scene', 'viewport-composition', CTX);
    const back = transformVector(projected, 'viewport-composition', 'hub-scene', CTX);
    // Round-trip tolerance: 1e-6 per axis. If you cannot meet this the
    // pipeline has lost precision somewhere and the round-trip claim
    // (INV-22's "uncollapsed") is broken.
    expect(Math.abs(back.x - v.x)).toBeLessThan(1e-6);
    expect(Math.abs(back.y - v.y)).toBeLessThan(1e-6);
    expect(Math.abs(back.z - v.z)).toBeLessThan(1e-6);
  });

  it('throws on unregistered hops rather than collapsing silently (INV-22)', () => {
    expect(() =>
      transformVector({ x: 0, y: 0, z: 0 }, 'scroll-timeline', 'camera', CTX),
    ).toThrow();
  });

  it('does not mutate the input vector', () => {
    const v = { x: 2, y: 4, z: 6 };
    const snapshot = { ...v };
    transformVector(v, 'hub-scene', 'viewport-composition', CTX);
    expect(v).toEqual(snapshot);
  });
});

// ----- resolveCrossSpaceTetherFire (the haltCheck surface) --------------

describe('EB-09-04 — resolveCrossSpaceTetherFire (SC-050 haltCheck)', () => {
  function fixture() {
    const source = mkNode('src', {
      keyframes: [HUB_SCENE_HOVER_KF],
    });
    const targetViewport = mkNode('tgt-vp', {
      keyframes: VIEWPORT_COMPOSITION_SLIDE_KF,
    });
    const targetHub = mkNode('tgt-hub', {
      keyframes: [HUB_SCENE_HOVER_KF],
    });
    const targetScroll = mkNode('tgt-scroll', {
      keyframes: SCROLL_TIMELINE_FADE_KF,
    });

    const edges: PrismEdge[] = [
      { from: 'src', to: 'tgt-vp', type: 'triggers', event: 'fire' },
      { from: 'src', to: 'tgt-hub', type: 'triggers', event: 'fire' },
      { from: 'src', to: 'tgt-scroll', type: 'triggers', event: 'fire' },
    ];
    return {
      nodes: [source, targetViewport, targetHub, targetScroll],
      edges,
    };
  }

  const FIRE: TetherFireEvent = {
    sourceNodeId: 'src',
    event: 'fire',
    firedAt: 1000,
  };

  it('returns a cross-space bridge for a hub-scene source firing into a viewport-composition target (SC-050)', () => {
    const { nodes, edges } = fixture();
    const resolved: CrossSpaceTetherFireResolvedTarget[] =
      resolveCrossSpaceTetherFire(nodes, edges, FIRE, 'hub-scene', CTX);

    const viewportTarget = resolved.find((r) => r.targetNodeId === 'tgt-vp');
    expect(viewportTarget).toBeDefined();
    expect(viewportTarget?.crossSpaceBridge).not.toBeNull();
    const bridge = viewportTarget?.crossSpaceBridge as TransformBridge;
    expect(bridge.from).toBe('hub-scene');
    expect(bridge.to).toBe('viewport-composition');
    expect(bridge.kind).toBe('projection');
  });

  it('returns an identity bridge when source and target keyframes share a space', () => {
    const { nodes, edges } = fixture();
    const resolved = resolveCrossSpaceTetherFire(
      nodes,
      edges,
      FIRE,
      'hub-scene',
      CTX,
    );
    const hubTarget = resolved.find((r) => r.targetNodeId === 'tgt-hub');
    expect(hubTarget).toBeDefined();
    expect(hubTarget?.crossSpaceBridge?.kind).toBe('identity');
  });

  it('uses the transform pipeline as the ONLY path (audit token present on every resolved target)', () => {
    // INV-22 enforcement: every cross-space resolution carries the pipeline's
    // audit token, proving no shadow path was used.
    const { nodes, edges } = fixture();
    const resolved = resolveCrossSpaceTetherFire(
      nodes,
      edges,
      FIRE,
      'hub-scene',
      CTX,
    );
    for (const r of resolved) {
      expect(r.exercisedPipeline).toBe(EXERCISED_TRANSFORM_PIPELINE);
    }
  });

  it('preserves the SC-049 contract: still only follows triggers edges', () => {
    const source = mkNode('src', { keyframes: [HUB_SCENE_HOVER_KF] });
    const tgtVp = mkNode('tgt-vp', { keyframes: VIEWPORT_COMPOSITION_SLIDE_KF });
    const tgtVpNon = mkNode('tgt-vp-noprop', {
      keyframes: VIEWPORT_COMPOSITION_SLIDE_KF,
    });
    const edges: PrismEdge[] = [
      { from: 'src', to: 'tgt-vp', type: 'triggers' },
      { from: 'src', to: 'tgt-vp-noprop', type: 'state-update' },
    ];
    const resolved = resolveCrossSpaceTetherFire(
      [source, tgtVp, tgtVpNon],
      edges,
      { sourceNodeId: 'src', firedAt: 0 },
      'hub-scene',
      CTX,
    );
    expect(resolved.map((r) => r.targetNodeId)).toEqual(['tgt-vp']);
  });

  it('records the target keyframe space on each resolved target', () => {
    const { nodes, edges } = fixture();
    const resolved = resolveCrossSpaceTetherFire(
      nodes,
      edges,
      FIRE,
      'hub-scene',
      CTX,
    );
    const byId = new Map(resolved.map((r) => [r.targetNodeId, r]));
    expect(byId.get('tgt-vp')?.targetKeyframeSpace).toBe(
      'viewport-composition',
    );
    expect(byId.get('tgt-hub')?.targetKeyframeSpace).toBe('hub-scene');
    expect(byId.get('tgt-scroll')?.targetKeyframeSpace).toBe('scroll-timeline');
  });

  it('returns a bridge of null (not an identity fallback) when the hop is unregistered, so callers surface the gap', () => {
    // Source declared in 'scroll-timeline'; target keyframes in 'camera'.
    // The §4 hop scroll-timeline → camera is undocumented → bridge MUST be
    // null. A silent identity here would violate INV-22.
    const source = mkNode('src');
    const target = mkNode('tgt', {
      keyframes: [
        {
          coordinateSpace: 'camera',
          t: 0,
          params: { x: 0 },
        },
      ],
    });
    const edges: PrismEdge[] = [
      { from: 'src', to: 'tgt', type: 'triggers' },
    ];
    const resolved = resolveCrossSpaceTetherFire(
      [source, target],
      edges,
      { sourceNodeId: 'src', firedAt: 0 },
      'scroll-timeline',
      CTX,
    );
    expect(resolved[0].crossSpaceBridge).toBeNull();
    expect(resolved[0].targetKeyframeSpace).toBe('camera');
  });
});

// ----- type-level guards (compile-time confidence) ----------------------

describe('EB-09-04 — CoordinateSpace type matches the canonical 5', () => {
  it('CoordinateSpace is structurally identical to KEYFRAME_COORDINATE_SPACES', () => {
    // Drive each canonical literal through the CoordinateSpace alias;
    // tsc would block this test from compiling if the alias drifted.
    const acceptAny: CoordinateSpace[] = [
      'universe',
      'hub-scene',
      'viewport-composition',
      'scroll-timeline',
      'camera',
    ];
    expect(acceptAny.length).toBe(KEYFRAME_COORDINATE_SPACES.length);
  });
});
