import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { snowGlobePrimitive } from '@/lib/prism/animatable/primitives/snow-globe';
import { makeTarget, runConformance } from './_conformance';

/** Find the THREE.Points the primitive builds into target.object. */
function findPoints(object: { children: unknown[] }): Points {
  const pts = (object.children as unknown[]).find(
    (c) => (c as Points).isPoints,
  ) as Points;
  expect(pts, 'primitive built a THREE.Points').toBeTruthy();
  return pts;
}

describe('snow-globe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(snowGlobePrimitive).dispose();
  });

  it('plays: a flake swirls + settles to a new position across two times', () => {
    const target = makeTarget(snowGlobePrimitive);
    const inst = snowGlobePrimitive.create(target);
    const points = findPoints(target.object);
    const pos = points.geometry.getAttribute('position') as BufferAttribute;

    // A flake well inside the live count so it is always active.
    const i = 10;

    inst.seek(0);
    const x0 = pos.getX(i);
    const y0 = pos.getY(i);
    const z0 = pos.getZ(i);

    // A distinct later time: the swirl (x,z) and settle (y) both advance.
    inst.seek(1.7);
    const x1 = pos.getX(i);
    const y1 = pos.getY(i);
    const z1 = pos.getZ(i);

    // Horizontal swirl moved the flake (x and/or z changed measurably).
    const horizMove = Math.hypot(x1 - x0, z1 - z0);
    expect(horizMove).toBeGreaterThan(0.05);
    // Settling drift moved it vertically too.
    expect(Math.abs(y1 - y0)).toBeGreaterThan(0.01);

    // Stays inside the dome (radius 1.4) — nothing escapes the glass.
    const dist1 = Math.hypot(x1, y1, z1);
    expect(dist1).toBeLessThan(1.4 + 1e-3);

    inst.dispose();
  });

  it('controls change output: higher swirl rotates a flake further by the same time', () => {
    const target = makeTarget(snowGlobePrimitive);
    const inst = snowGlobePrimitive.create(target);
    const points = findPoints(target.object);
    const pos = points.geometry.getAttribute('position') as BufferAttribute;
    const i = 10;

    // Baseline azimuth at t=0 (swirl has no effect yet).
    inst.seek(0);
    const ax0 = Math.atan2(pos.getZ(i), pos.getX(i));

    // Low swirl → small angular advance by t=1.
    inst.setControl('swirl', 0.1);
    inst.seek(1);
    const aLow = Math.atan2(pos.getZ(i), pos.getX(i));
    const dLow = Math.abs(aLow - ax0);

    // High swirl → larger angular advance by the same t=1.
    inst.setControl('swirl', 3);
    inst.seek(1);
    const aHigh = Math.atan2(pos.getZ(i), pos.getX(i));
    const dHigh = Math.abs(aHigh - ax0);

    expect(dHigh).toBeGreaterThan(dLow + 0.05);
    inst.dispose();
  });
});
