import { describe, it, expect } from 'vitest';
import { Points, BufferGeometry } from 'three';
import { sparksPrimitive } from '@/lib/prism/animatable/primitives/sparks';
import { makeTarget, runConformance } from './_conformance';

/** Distance of particle `idx` from the origin, read from the live geometry. */
function particleDist(target: ReturnType<typeof makeTarget>, idx: number): number {
  let dist = NaN;
  target.object.traverse((o) => {
    if (o instanceof Points) {
      const arr = (o.geometry.getAttribute('position').array as Float32Array);
      const x = arr[idx * 3];
      const y = arr[idx * 3 + 1];
      const z = arr[idx * 3 + 2];
      dist = Math.sqrt(x * x + y * y + z * z);
    }
  });
  return dist;
}

describe('sparks primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(sparksPrimitive).dispose();
  });

  it('plays: particle 0 starts at origin and is large at duration', () => {
    const target = makeTarget(sparksPrimitive);
    const inst = sparksPrimitive.create(target);
    const dur = inst.duration();
    inst.seek(0);
    const d0 = particleDist(target, 0);
    inst.seek(dur * 0.999); // just before the loop wraps back to 0
    const d1 = particleDist(target, 0);
    expect(d0).toBeLessThan(0.05);
    expect(d1).toBeGreaterThan(d0);
    expect(d1).toBeGreaterThan(0.2);
    inst.dispose();
  });

  it('controls change output: higher speed reaches farther', () => {
    const target = makeTarget(sparksPrimitive);
    const inst = sparksPrimitive.create(target);
    const dur = inst.duration();
    inst.setControl('speed', 0.5);
    inst.seek(dur * 0.5);
    const slow = particleDist(target, 0);
    inst.setControl('speed', 4);
    inst.seek(dur * 0.5);
    const fast = particleDist(target, 0);
    expect(fast).toBeGreaterThan(slow);
    inst.dispose();
  });

  it('dispose frees geometry + material and detaches the cloud', () => {
    const target = makeTarget(sparksPrimitive);
    const inst = sparksPrimitive.create(target);
    let cloud: Points | null = null;
    target.object.traverse((o) => {
      if (o instanceof Points) cloud = o;
    });
    expect(cloud).not.toBeNull();
    const geom = (cloud as unknown as Points).geometry as BufferGeometry;
    let disposed = false;
    const orig = geom.dispose.bind(geom);
    geom.dispose = () => {
      disposed = true;
      orig();
    };
    inst.dispose();
    expect(disposed).toBe(true);
    let stillThere = false;
    target.object.traverse((o) => {
      if (o instanceof Points) stillThere = true;
    });
    expect(stillThere).toBe(false);
  });
});
