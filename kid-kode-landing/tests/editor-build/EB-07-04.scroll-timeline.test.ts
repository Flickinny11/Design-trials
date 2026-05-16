// EB-07-04 — useScrollTimeline + scrollBinding consumer.
//
// Spec refs:
//   §7  SC-039  Scroll-timeline system: `useScrollTimeline()` returns a
//               deterministic `scrollProgress: 0→1` over the hub's scroll
//               length; nodes with `scrollBinding?` consume it.
//   §7  SC-040  Scrolling in `preview-hub` mode reads as app UI (per-element
//               response), not whole-scene movement.
//   §4         `scroll-timeline` coordinate space: `scrollProgress: 0→1`;
//              bound transforms drive per-element scroll response.
//
// haltCheck:
//   "useScrollTimeline returns deterministic scrollProgress over the hub's
//    content length; nodes with scrollBinding consume it; scrolling in
//    preview-hub reads as app UI, not whole-scene movement."
//
// This file covers the pure layer:
//   - `computeScrollProgress(scrollY, contentHeight, viewportHeight)` —
//      deterministic, clamped, degenerate-content-safe.
//   - `applyScrollBindings(obj, bindings, progress)` — writes translate /
//      rotate / scale / opacity onto a THREE Object3D per the binding spec.
//   - Schema: `PrismNode.scrollBinding?` is additive (INV-18); a `ScrollBinding`
//      declares `property`, `from`, `to`, optional `ease`.
//
// Runtime integration (setScrollProgress on mountFromGraphSource, camera-
// independence for SC-040) is covered by `EB-07-04.scroll-runtime.test.ts`.

import { describe, it, expect } from 'vitest';
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three';

import {
  computeScrollProgress,
  applyScrollBindings,
} from '@/lib/prism-graph/scroll-timeline';
import type { ScrollBinding } from '@/lib/prism-graph/types';
import type { PrismNode } from '@/lib/prism-graph/types';

// ---------------------------------------------------------------------------
// 1. computeScrollProgress — pure, deterministic, clamped.
// ---------------------------------------------------------------------------

describe('EB-07-04 — computeScrollProgress (SC-039)', () => {
  it('returns 0 at the top of the hub (scrollY = 0)', () => {
    expect(computeScrollProgress(0, 2000, 800)).toBe(0);
  });

  it('returns 1 at the bottom of the hub (scrollY = contentHeight - viewportHeight)', () => {
    expect(computeScrollProgress(1200, 2000, 800)).toBe(1);
  });

  it('returns 0.5 at the midpoint', () => {
    expect(computeScrollProgress(600, 2000, 800)).toBeCloseTo(0.5, 6);
  });

  it('clamps below 0', () => {
    expect(computeScrollProgress(-100, 2000, 800)).toBe(0);
  });

  it('clamps above 1', () => {
    expect(computeScrollProgress(5000, 2000, 800)).toBe(1);
  });

  it('returns 0 when contentHeight <= viewportHeight (no scrollable range)', () => {
    expect(computeScrollProgress(0, 600, 800)).toBe(0);
    expect(computeScrollProgress(123, 600, 800)).toBe(0);
    expect(computeScrollProgress(0, 800, 800)).toBe(0);
  });

  it('is deterministic over equal inputs', () => {
    const a = computeScrollProgress(450, 2000, 800);
    const b = computeScrollProgress(450, 2000, 800);
    expect(a).toBe(b);
  });

  it('handles non-finite inputs by returning 0 (defensive)', () => {
    expect(computeScrollProgress(Number.NaN, 2000, 800)).toBe(0);
    expect(computeScrollProgress(100, Number.POSITIVE_INFINITY, 800)).toBe(0);
    expect(computeScrollProgress(100, 2000, Number.NaN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. applyScrollBindings — transforms a THREE Object3D per progress.
// ---------------------------------------------------------------------------

function makeMeshTarget(): Mesh {
  return new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial());
}

describe('EB-07-04 — applyScrollBindings (SC-039)', () => {
  it('translateY moves the node Y from `from` to `to` linearly with progress', () => {
    const obj = new Group();
    const bindings: ScrollBinding[] = [{ property: 'translateY', from: 0, to: 100 }];

    applyScrollBindings(obj, bindings, 0);
    expect(obj.position.y).toBeCloseTo(0, 6);

    applyScrollBindings(obj, bindings, 0.5);
    expect(obj.position.y).toBeCloseTo(50, 6);

    applyScrollBindings(obj, bindings, 1);
    expect(obj.position.y).toBeCloseTo(100, 6);
  });

  it('translateX and translateZ map to position.x and position.z', () => {
    const obj = new Group();
    applyScrollBindings(
      obj,
      [
        { property: 'translateX', from: -10, to: 10 },
        { property: 'translateZ', from: 0, to: 50 },
      ],
      0.5,
    );
    expect(obj.position.x).toBeCloseTo(0, 6);
    expect(obj.position.z).toBeCloseTo(25, 6);
  });

  it('rotateX/Y/Z map to euler rotation (radians)', () => {
    const obj = new Group();
    applyScrollBindings(
      obj,
      [
        { property: 'rotateX', from: 0, to: 1 },
        { property: 'rotateY', from: 0, to: 2 },
        { property: 'rotateZ', from: 0, to: 3 },
      ],
      1,
    );
    expect(obj.rotation.x).toBeCloseTo(1, 6);
    expect(obj.rotation.y).toBeCloseTo(2, 6);
    expect(obj.rotation.z).toBeCloseTo(3, 6);
  });

  it('scale writes uniformly to scale.x/y/z', () => {
    const obj = new Group();
    applyScrollBindings(obj, [{ property: 'scale', from: 1, to: 2 }], 0.5);
    expect(obj.scale.x).toBeCloseTo(1.5, 6);
    expect(obj.scale.y).toBeCloseTo(1.5, 6);
    expect(obj.scale.z).toBeCloseTo(1.5, 6);
  });

  it('opacity writes material.opacity (and toggles transparent=true) on Mesh material', () => {
    const mesh = makeMeshTarget();
    applyScrollBindings(mesh, [{ property: 'opacity', from: 0, to: 1 }], 0.25);
    const mat = mesh.material as MeshBasicMaterial;
    expect(mat.opacity).toBeCloseTo(0.25, 6);
    expect(mat.transparent).toBe(true);
  });

  it('opacity on a Group walks descendants and writes mesh materials', () => {
    const group = new Group();
    const child = makeMeshTarget();
    group.add(child);
    applyScrollBindings(group, [{ property: 'opacity', from: 0, to: 1 }], 0.7);
    const mat = child.material as MeshBasicMaterial;
    expect(mat.opacity).toBeCloseTo(0.7, 6);
    expect(mat.transparent).toBe(true);
  });

  it('multiple bindings on one node apply independently', () => {
    const obj = new Group();
    applyScrollBindings(
      obj,
      [
        { property: 'translateY', from: 0, to: 100 },
        { property: 'scale', from: 1, to: 2 },
      ],
      0.5,
    );
    expect(obj.position.y).toBeCloseTo(50, 6);
    expect(obj.scale.x).toBeCloseTo(1.5, 6);
  });

  it('progress clamps below 0 and above 1 inside applyScrollBindings (defensive)', () => {
    const obj = new Group();
    const bindings: ScrollBinding[] = [{ property: 'translateY', from: 0, to: 100 }];
    applyScrollBindings(obj, bindings, -2);
    expect(obj.position.y).toBeCloseTo(0, 6);
    applyScrollBindings(obj, bindings, 5);
    expect(obj.position.y).toBeCloseTo(100, 6);
  });

  it('empty bindings array is a no-op (no transform changes)', () => {
    const obj = new Group();
    obj.position.set(7, 8, 9);
    applyScrollBindings(obj, [], 0.5);
    expect(obj.position.x).toBe(7);
    expect(obj.position.y).toBe(8);
    expect(obj.position.z).toBe(9);
  });

  it('ease=easeInOut bends the interpolation (not linear)', () => {
    const obj = new Group();
    const bindings: ScrollBinding[] = [
      { property: 'translateY', from: 0, to: 100, ease: 'easeInOut' },
    ];
    applyScrollBindings(obj, bindings, 0.5);
    // easeInOut at t=0.5 is exactly 0.5; differs from linear only off-center.
    expect(obj.position.y).toBeCloseTo(50, 6);
    applyScrollBindings(obj, bindings, 0.25);
    // easeInOut(0.25) ≈ 0.125; linear would have been 25.
    expect(obj.position.y).toBeLessThan(25);
    expect(obj.position.y).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Schema — PrismNode.scrollBinding? is additive (INV-18).
// ---------------------------------------------------------------------------

describe('EB-07-04 — schema (INV-18 additive)', () => {
  it('PrismNode tolerates a `scrollBinding` array property', () => {
    const node: PrismNode = {
      nodeId: 'n1',
      subtype: 'hero',
      parentHubId: 'home',
      serviceTag: 'static',
      visual: { transform: { x: 0, y: 0, z: 0, width: 100, height: 100 } },
      intent: {
        caption: '',
        behaviorSpec: {
          interactions: [], apiCalls: [], dataBindings: [],
          emits: [], listens: [], triggersDownstream: [],
        },
        stateEffects: [],
        visualSpec: { textContent: [], layers: [] },
        contracts: { inputs: {}, outputs: {} },
      },
      codeRef: '',
      backendRef: null,
      scrollBinding: [{ property: 'translateY', from: 0, to: -200 }],
    };
    expect(node.scrollBinding?.[0].property).toBe('translateY');
    expect(node.scrollBinding?.[0].from).toBe(0);
    expect(node.scrollBinding?.[0].to).toBe(-200);
  });

  it('legacy nodes (no scrollBinding) parse without error', () => {
    const node: PrismNode = {
      nodeId: 'n2',
      subtype: 'hero',
      parentHubId: 'home',
      serviceTag: 'static',
      visual: { transform: { x: 0, y: 0, z: 0, width: 100, height: 100 } },
      intent: {
        caption: '',
        behaviorSpec: {
          interactions: [], apiCalls: [], dataBindings: [],
          emits: [], listens: [], triggersDownstream: [],
        },
        stateEffects: [],
        visualSpec: { textContent: [], layers: [] },
        contracts: { inputs: {}, outputs: {} },
      },
      codeRef: '',
      backendRef: null,
    };
    expect(node.scrollBinding).toBeUndefined();
  });
});
