import { describe, it, expect } from 'vitest';
import { Sprite } from 'three';
import { gravityBounceClusterPrimitive } from '@/lib/prism/animatable/primitives/gravity-bounce-cluster';
import { makeTarget, runConformance } from './_conformance';

// Pull the live position buffer the primitive writes into target.object.
//
// RENDER PATH (post fix-round-1): the balls are no longer THREE.Points. They are
// an instanced THREE.Sprite named 'gravity-bounce-cluster' whose per-ball CENTERS
// live in the geometry's 'instancePosition' InstancedBufferAttribute (the basin is
// a SEPARATE decorative sprite named 'gravity-bounce-cluster-basin' — we must pick
// the elements one, not it). 'instancePosition' carries the same flat
// [x0,y0,z0, x1,…] layout and the same .array/.count API the old 'position' attr
// did, so every downstream physics assertion reads unchanged. Parked balls are
// written to HIDDEN = WALL_X + 1000 ≈ 1001.25, far above the y < 50 skip threshold
// the tests already use, so that threshold is unchanged.
function readPoints(target: ReturnType<typeof makeTarget>): {
  count: number;
  pos: Float32Array;
} {
  const sprite = target.object.children.find(
    (c) => c instanceof Sprite && c.name === 'gravity-bounce-cluster',
  ) as Sprite | undefined;
  if (!sprite) throw new Error('no gravity-bounce-cluster element Sprite built');
  const attr = sprite.geometry.getAttribute('instancePosition');
  return { count: attr.count, pos: attr.array as Float32Array };
}

// Lowest on-screen ball Y (ignore parked balls flung far off-screen).
function minActiveY(pos: Float32Array): number {
  let m = Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const y = pos[i + 1];
    if (y < 50 && y < m) m = y; // < 50 → exclude HIDDEN-parked units
  }
  return m;
}

// Mean Y of on-screen balls — a whole-cluster height that still differs while
// some balls are mid-air (so it stays sensitive at a pin where the lowest ball
// has already touched the floor under both settings).
function meanActiveY(pos: Float32Array): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < pos.length; i += 3) {
    const y = pos[i + 1];
    if (y < 50) {
      sum += y;
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

// Horizontal extent (x-spread) of on-screen balls — proves a HEAP, not a stack.
function activeXSpread(pos: Float32Array): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i];
    const y = pos[i + 1];
    if (y < 50) {
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  return hi - lo;
}

describe('gravity-bounce-cluster primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(gravityBounceClusterPrimitive).dispose();
  });

  it('drops under gravity, bounces, and heaps (real velocity state, not easing)', () => {
    const target = makeTarget(gravityBounceClusterPrimitive);
    const inst = gravityBounceClusterPrimitive.create(target);

    inst.seek(0);
    const { pos: pos0 } = readPoints(target);
    const startMinY = minActiveY(pos0);

    // Track the lowest active ball over the timeline: a real drop means the
    // cluster descends substantially; a real bounce means the lowest ball's
    // per-frame delta changes sign (falling → rising) at least once.
    const dt = 1 / 120;
    let prevMinY = startMinY;
    let prevDelta = 0;
    let sawRebound = false;
    let lowestEver = startMinY;
    for (let k = 1; k <= 420; k++) {
      inst.seek(k * dt);
      const { pos } = readPoints(target);
      const m = minActiveY(pos);
      const delta = m - prevMinY;
      lowestEver = Math.min(lowestEver, m);
      if (k > 2 && prevDelta < -1e-4 && delta > 1e-4) sawRebound = true;
      prevDelta = delta;
      prevMinY = m;
    }

    // It actually fell a long way under gravity.
    expect(startMinY).toBeGreaterThan(lowestEver + 0.4);
    // It actually bounced back up at least once (restitution, not a flat land).
    expect(sawRebound).toBe(true);

    // After settling it forms a SPREAD heap (separation pushed balls apart),
    // not a single stacked column — the x-extent is well over one ball wide.
    inst.seek(3.3);
    const { pos: posEnd } = readPoints(target);
    expect(activeXSpread(posEnd)).toBeGreaterThan(0.6);
    // And it has come to rest near the floor, not still raining from the top.
    expect(minActiveY(posEnd)).toBeLessThan(0);

    inst.dispose();
  });

  it('gravity is live at the frozen pin (sweeping a trajectory-only control changes the pinned frame)', () => {
    const target = makeTarget(gravityBounceClusterPrimitive);
    const inst = gravityBounceClusterPrimitive.create(target);

    // Mid-action pin (~0.44 of the 3.4s duration): the cluster is mid-fall /
    // mid-pile here, so gravity strongly determines how far the whole cluster
    // has descended (measured by its mean height, which stays sensitive even
    // once the lowest ball has touched the floor).
    const PIN = 1.5;

    inst.setControl('gravity', 2);
    inst.seek(PIN);
    const lowG = meanActiveY(readPoints(target).pos);

    inst.setControl('gravity', 16);
    inst.seek(PIN); // SAME t — only markDirty makes this recompute
    const highG = meanActiveY(readPoints(target).pos);

    // Stronger gravity → the cluster has fallen markedly further by the same t.
    expect(Math.abs(highG - lowG)).toBeGreaterThan(0.05);
    expect(highG).toBeLessThan(lowG);

    inst.dispose();
  });
});
