import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { fireworksPrimitive } from '@/lib/prism/animatable/primitives/fireworks';
import { makeTarget, runConformance } from './_conformance';

/** Pull the live position attribute of the built THREE.Points. */
function posAttr(target: ReturnType<typeof makeTarget>): BufferAttribute {
  let pts: Points | null = null;
  target.object.traverse((o) => {
    if ((o as Points).isPoints) pts = o as Points;
  });
  if (!pts) throw new Error('fireworks did not build a Points object');
  return (pts as Points).geometry.getAttribute('position') as BufferAttribute;
}

/** Aggregate radial spread (sum of |position|) — grows as sparks expand out. */
function totalSpread(attr: BufferAttribute): number {
  let sum = 0;
  for (let i = 0; i < attr.count; i++) {
    const x = attr.getX(i);
    const y = attr.getY(i);
    const z = attr.getZ(i);
    // Ignore parked particles far below view.
    if (y < -100) continue;
    sum += Math.hypot(x, y, z);
  }
  return sum;
}

describe('fireworks primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fireworksPrimitive).dispose();
  });

  it('plays: a particle moves between two post-burst frames (deterministic)', () => {
    const target = makeTarget(fireworksPrimitive);
    const inst = fireworksPrimitive.create(target);
    const attr = posAttr(target);

    // Sample one particle's position across two distinct times. Over a CYCLE of
    // 3.2s with staggered shells, the aggregate spread at two well-separated
    // times within the burst window must differ (expansion + fall).
    inst.seek(0.0);
    const spreadA = totalSpread(attr);

    inst.seek(1.6);
    const spreadB = totalSpread(attr);

    // Concrete numeric change in CPU-observable particle positions.
    expect(Math.abs(spreadB - spreadA)).toBeGreaterThan(0.5);

    // And a single tracked particle's coordinates change across two times.
    inst.seek(0.9);
    const ax = attr.getX(10);
    const ay = attr.getY(10);
    inst.seek(1.4);
    const bx = attr.getX(10);
    const by = attr.getY(10);
    expect(Math.hypot(bx - ax, by - ay)).toBeGreaterThan(0.001);

    inst.dispose();
  });

  it('controls change output: larger spread means larger expansion', () => {
    const target = makeTarget(fireworksPrimitive);
    const inst = fireworksPrimitive.create(target);
    const attr = posAttr(target);

    // Mid-burst time. Small spread → compact field; large spread → wide field.
    inst.setControl('spread', 0.4);
    inst.seek(1.3);
    const small = totalSpread(attr);

    inst.setControl('spread', 2.4);
    inst.seek(1.3);
    const large = totalSpread(attr);

    expect(large).toBeGreaterThan(small + 0.5);
    inst.dispose();
  });
});
