import { describe, it, expect } from 'vitest';
import { Points } from 'three';
import { snowPrimitive } from '@/lib/prism/animatable/primitives/snow';
import { makeTarget, runConformance } from './_conformance';

function flakeY(points: Points, i: number): number {
  const arr = points.geometry.getAttribute('position').array as Float32Array;
  return arr[i * 3 + 1];
}
function flakeX(points: Points, i: number): number {
  const arr = points.geometry.getAttribute('position').array as Float32Array;
  return arr[i * 3];
}

describe('snow primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(snowPrimitive).dispose();
  });

  it('plays: a flake falls (y changes) across distinct seek times', () => {
    const target = makeTarget(snowPrimitive);
    const inst = snowPrimitive.create(target);
    const points = target.object.children.find((c) => c instanceof Points) as Points;

    inst.seek(0);
    const y0 = flakeY(points, 5);
    const x0 = flakeX(points, 5);

    inst.seek(1.3);
    const y1 = flakeY(points, 5);
    const x1 = flakeX(points, 5);

    // Looping field: position is observably different between two distinct
    // times — y (fall) and x (sway) both move.
    expect(Math.abs(y1 - y0)).toBeGreaterThan(0.05);
    expect(Math.abs(x1 - x0)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: higher fall speed drops a flake further by a fixed time', () => {
    const target = makeTarget(snowPrimitive);
    const inst = snowPrimitive.create(target);
    const points = target.object.children.find((c) => c instanceof Points) as Points;

    // Flake 19 has a small start offset (≈0.069), so within this short time
    // neither speed wraps the column — higher fall speed strictly drops it
    // lower. Slow fall = near the top, fast fall = dropped lower.
    inst.setControl('sway', 0); // isolate the fall axis
    inst.setControl('fallSpeed', 0.2);
    inst.seek(0.5);
    const ySlow = flakeY(points, 19);

    inst.setControl('fallSpeed', 2);
    inst.seek(0.5);
    const yFast = flakeY(points, 19);

    expect(ySlow).toBeGreaterThan(yFast + 0.1);
    inst.dispose();
  });
});
