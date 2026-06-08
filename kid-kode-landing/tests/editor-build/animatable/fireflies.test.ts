import { describe, it, expect } from 'vitest';
import { Points, BufferAttribute } from 'three';
import { firefliesPrimitive } from '@/lib/prism/animatable/primitives/fireflies';
import { makeTarget, runConformance } from './_conformance';

function pointsOf(target: ReturnType<typeof makeTarget>): Points {
  let found: Points | null = null;
  target.object.traverse((o) => {
    if ((o as Points).isPoints) found = o as Points;
  });
  if (!found) throw new Error('no Points built into target.object');
  return found;
}

describe('fireflies primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(firefliesPrimitive).dispose();
  });

  it('plays: a particle wanders to a different position over time', () => {
    const target = makeTarget(firefliesPrimitive);
    const inst = firefliesPrimitive.create(target);
    const points = pointsOf(target);
    const pos = points.geometry.getAttribute('position') as BufferAttribute;

    inst.seek(0);
    const x0 = pos.getX(3);
    const y0 = pos.getY(3);

    inst.seek(2.3);
    const xMid = pos.getX(3);
    const yMid = pos.getY(3);

    // The same particle has demonstrably moved along its wander path.
    const moved = Math.hypot(xMid - x0, yMid - y0);
    expect(moved).toBeGreaterThan(0.05);

    // And the looping pulse changes per-point brightness across distinct times.
    const col = points.geometry.getAttribute('color') as BufferAttribute;
    inst.seek(0);
    const bA = col.getX(5) + col.getY(5) + col.getZ(5);
    inst.seek(1.1);
    const bB = col.getX(5) + col.getY(5) + col.getZ(5);
    expect(Math.abs(bB - bA)).toBeGreaterThan(0.01);

    inst.dispose();
  });

  it('controls change output: more wander means a larger displacement', () => {
    const target = makeTarget(firefliesPrimitive);
    const inst = firefliesPrimitive.create(target);
    const points = pointsOf(target);
    const pos = points.geometry.getAttribute('position') as BufferAttribute;

    inst.setControl('wander', 0);
    inst.seek(1.7);
    const small = Math.hypot(pos.getX(2), pos.getY(2), pos.getZ(2));

    inst.setControl('wander', 1.2);
    inst.seek(1.7);
    const large = Math.hypot(pos.getX(2), pos.getY(2), pos.getZ(2));

    // wander=0 leaves the particle at its base; wander=1.2 displaces it.
    expect(large).toBeGreaterThan(small + 0.05);

    inst.dispose();
  });
});
