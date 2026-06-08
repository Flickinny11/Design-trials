import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { petalFallPrimitive } from '@/lib/prism/animatable/primitives/petal-fall';
import { makeTarget, runConformance } from './_conformance';

/** Find the THREE.Points the primitive built into target.object. */
function findPoints(obj: { children: unknown[] }): Points {
  const pts = (obj.children as unknown[]).find((c) => c instanceof Points);
  if (!pts) throw new Error('petal-fall did not build a Points object');
  return pts as Points;
}

describe('petal-fall primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(petalFallPrimitive).dispose();
  });

  it('plays: a petal falls and sways across two distinct times', () => {
    const target = makeTarget(petalFallPrimitive);
    const inst = petalFallPrimitive.create(target);
    const points = findPoints(target.object as unknown as { children: unknown[] });
    const pos = points.geometry.getAttribute('position') as BufferAttribute;

    // Looping (duration Infinity) → pick two distinct t values.
    inst.seek(0);
    const x0 = pos.getX(0);
    const y0 = pos.getY(0);

    inst.seek(2.0);
    const x1 = pos.getX(0);
    const y1 = pos.getY(0);

    // Vertical fall is observable.
    expect(Math.abs(y1 - y0)).toBeGreaterThan(0.01);
    // Horizontal sway is observable.
    expect(Math.abs(x1 - x0)).toBeGreaterThan(0.001);
    inst.dispose();
  });

  it('controls change output: more sway means a larger horizontal excursion', () => {
    const measureSwayRange = (swayValue: number): number => {
      const target = makeTarget(petalFallPrimitive);
      const inst = petalFallPrimitive.create(target);
      const points = findPoints(target.object as unknown as { children: unknown[] });
      const pos = points.geometry.getAttribute('position') as BufferAttribute;

      inst.setControl('sway', swayValue);
      let minX = Infinity;
      let maxX = -Infinity;
      for (let k = 0; k <= 16; k++) {
        inst.seek(k * 0.25);
        const x = pos.getX(0);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      inst.dispose();
      return maxX - minX;
    };

    const small = measureSwayRange(0);
    const large = measureSwayRange(1);
    expect(large).toBeGreaterThan(small + 0.05);
  });
});
