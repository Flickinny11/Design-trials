import { describe, it, expect } from 'vitest';
import { Points, type BufferGeometry } from 'three';
import { embersPrimitive } from '@/lib/prism/animatable/primitives/embers';
import { makeTarget, runConformance } from './_conformance';

/** Pull the first ember's y from the built Points geometry. */
function emberY(target: ReturnType<typeof makeTarget>, index = 0): number {
  let pts: Points | null = null;
  target.object.traverse((o) => {
    if ((o as Points).isPoints) pts = o as Points;
  });
  if (!pts) throw new Error('no Points built');
  const geo = (pts as Points).geometry as BufferGeometry;
  const arr = geo.attributes.position.array as Float32Array;
  return arr[index * 3 + 1];
}

describe('embers primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(embersPrimitive).dispose();
  });

  it('plays: an ember y changes across distinct seek times (looping rise)', () => {
    const target = makeTarget(embersPrimitive);
    const inst = embersPrimitive.create(target);

    // Looping primitive (duration Infinity): pick two distinct t values where
    // the per-particle phase differs, so the y position must change.
    inst.seek(0.1);
    const yEarly = emberY(target, 0);

    inst.seek(1.7);
    const yLate = emberY(target, 0);

    expect(Math.abs(yLate - yEarly)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: faster rise reaches a different height at the same t', () => {
    const target = makeTarget(embersPrimitive);
    const inst = embersPrimitive.create(target);

    inst.setControl('rise', 0.05);
    inst.seek(2.3);
    const ySlow = emberY(target, 0);

    inst.setControl('rise', 1.2);
    inst.seek(2.3);
    const yFast = emberY(target, 0);

    // Different rise speeds put the ember at a different phase (height) at the
    // same clock time.
    expect(Math.abs(yFast - ySlow)).toBeGreaterThan(0.05);
    inst.dispose();
  });
});
