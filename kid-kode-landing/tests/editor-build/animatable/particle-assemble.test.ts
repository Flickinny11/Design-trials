import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { particleAssemblePrimitive } from '@/lib/prism/animatable/primitives/particle-assemble';
import { makeTarget, runConformance } from './_conformance';

/** Pull the position array of the built Points out of the owning object. */
function posArrayOf(object: { children: unknown[] }): Float32Array {
  const points = object.children.find((c) => (c as Points).isPoints) as Points;
  const attr = points.geometry.getAttribute('position') as BufferAttribute;
  return attr.array as Float32Array;
}

describe('particle-assemble primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(particleAssemblePrimitive).dispose();
  });

  it('plays: a particle position converges to its target across the timeline', () => {
    const target = makeTarget(particleAssemblePrimitive);
    const inst = particleAssemblePrimitive.create(target);
    const dur = inst.duration();
    const arr = posArrayOf(target.object as { children: unknown[] });

    // Snapshot particle index 0 at start vs end.
    inst.seek(0);
    const start = [arr[0], arr[1], arr[2]] as const;

    inst.seek(dur);
    const end = [arr[0], arr[1], arr[2]] as const;

    // The particle moved a meaningful distance from scatter -> assembled shape.
    const moved = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    expect(moved).toBeGreaterThan(0.3);

    // At the end it sits on the default ring (radius ~1.05 in XY).
    const endRadius = Math.hypot(end[0], end[1]);
    expect(endRadius).toBeGreaterThan(0.8);
    expect(endRadius).toBeLessThan(1.3);

    // A mid frame differs from both ends (real motion, not a jump).
    inst.seek(dur / 2);
    const mid = [arr[0], arr[1], arr[2]] as const;
    const midFromStart = Math.hypot(mid[0] - start[0], mid[1] - start[1], mid[2] - start[2]);
    const midFromEnd = Math.hypot(mid[0] - end[0], mid[1] - end[1], mid[2] - end[2]);
    expect(midFromStart).toBeGreaterThan(0.01);
    expect(midFromEnd).toBeGreaterThan(0.01);

    inst.dispose();
  });

  it('controls change output: larger scatter means a more distant start position', () => {
    const target = makeTarget(particleAssemblePrimitive);
    const inst = particleAssemblePrimitive.create(target);
    const arr = posArrayOf(target.object as { children: unknown[] });

    inst.setControl('scatter', 1);
    inst.seek(0);
    const small = Math.hypot(arr[0], arr[1], arr[2]);

    inst.setControl('scatter', 6);
    inst.seek(0);
    const large = Math.hypot(arr[0], arr[1], arr[2]);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
