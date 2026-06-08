import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { sparkShowerPrimitive } from '@/lib/prism/animatable/primitives/spark-shower';
import { makeTarget, runConformance } from './_conformance';

/** Pull the THREE.Points the primitive built into target.object. */
function pointsOf(object: { children: unknown[] }): Points {
  const pts = (object.children as unknown[]).find(
    (c) => c instanceof Points,
  ) as Points | undefined;
  if (!pts) throw new Error('spark-shower did not build a Points object');
  return pts;
}

describe('spark-shower primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(sparkShowerPrimitive).dispose();
  });

  it('plays: a spark traces a bouncing arc — position changes between two times', () => {
    const target = makeTarget(sparkShowerPrimitive);
    const inst = sparkShowerPrimitive.create(target);
    const pts = pointsOf(target.object);
    const pos = pts.geometry.getAttribute('position') as BufferAttribute;
    const arr = pos.array as Float32Array;

    // Track spark index 3 (well within the default active rate).
    const i = 3;

    // Early frame.
    inst.seek(0.05);
    const x0 = arr[i * 3];
    const y0 = arr[i * 3 + 1];

    // Mid frame: same spark, later in its life (arc + likely bounce).
    inst.seek(0.55);
    const x1 = arr[i * 3];
    const y1 = arr[i * 3 + 1];

    // The spark visibly moved (arc + bounce): a concrete numeric delta.
    const delta = Math.hypot(x1 - x0, y1 - y0);
    expect(delta).toBeGreaterThan(0.1);

    // Deterministic: re-seeking the same t reproduces the position exactly.
    inst.seek(0.05);
    expect(arr[i * 3]).toBeCloseTo(x0, 6);
    expect(arr[i * 3 + 1]).toBeCloseTo(y0, 6);

    inst.dispose();
  });

  it('controls change output: higher gravity pulls a spark lower at the same age', () => {
    const target = makeTarget(sparkShowerPrimitive);
    const inst = sparkShowerPrimitive.create(target);
    const pts = pointsOf(target.object);
    const pos = pts.geometry.getAttribute('position') as BufferAttribute;
    const arr = pos.array as Float32Array;
    const i = 7;
    const t = 0.4;

    // Low gravity: the spark stays higher at this age.
    inst.setControl('gravity', 0.2);
    inst.seek(t);
    const yLow = arr[i * 3 + 1];

    // High gravity: same age, but pulled much lower.
    inst.setControl('gravity', 3);
    inst.seek(t);
    const yHigh = arr[i * 3 + 1];

    expect(yLow).toBeGreaterThan(yHigh + 0.05);
    inst.dispose();
  });
});
