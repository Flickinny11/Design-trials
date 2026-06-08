import { describe, it, expect } from 'vitest';
import { Points } from 'three';
import { murmurationPrimitive } from '@/lib/prism/animatable/primitives/murmuration';
import { makeTarget, runConformance } from './_conformance';

function firstPoints(object: { children: unknown[] }): Points {
  return object.children.find((c) => c instanceof Points) as Points;
}

describe('murmuration primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(murmurationPrimitive).dispose();
  });

  it('plays: a bird moves across the timeline and the flock stays coherent', () => {
    const target = makeTarget(murmurationPrimitive);
    const inst = murmurationPrimitive.create(target);
    const points = firstPoints(target.object as unknown as { children: unknown[] });
    const pos = points.geometry.getAttribute('position');

    inst.seek(0);
    const x0 = pos.getX(10);
    const y0 = pos.getY(10);
    const z0 = pos.getZ(10);

    inst.seek(1.7);
    const x1 = pos.getX(10);
    const y1 = pos.getY(10);
    const z1 = pos.getZ(10);

    // The bird's position changed between two distinct t.
    const moved = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    expect(moved).toBeGreaterThan(0.1);

    // The flock stays coherent: the cloud's centroid stays bounded (it drifts on
    // a Lissajous path, it does not fly off to infinity).
    let sx = 0;
    let sy = 0;
    let sz = 0;
    const n = pos.count;
    for (let i = 0; i < n; i++) {
      sx += pos.getX(i);
      sy += pos.getY(i);
      sz += pos.getZ(i);
    }
    const centroid = Math.hypot(sx / n, sy / n, sz / n);
    expect(centroid).toBeLessThan(4);

    inst.dispose();
  });

  it('controls change output: higher breath changes the flock shape', () => {
    const target = makeTarget(murmurationPrimitive);
    const inst = murmurationPrimitive.create(target);
    const points = firstPoints(target.object as unknown as { children: unknown[] });
    const pos = points.geometry.getAttribute('position');

    // Measure the flock radius (spread of birds about their centroid) at a fixed
    // t for two breath extremes. The breathing scale differs, so the radius does.
    const radiusAt = (): number => {
      const n = pos.count;
      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (let i = 0; i < n; i++) {
        sx += pos.getX(i);
        sy += pos.getY(i);
        sz += pos.getZ(i);
      }
      const mx = sx / n;
      const my = sy / n;
      const mz = sz / n;
      let acc = 0;
      for (let i = 0; i < n; i++) {
        acc += Math.hypot(pos.getX(i) - mx, pos.getY(i) - my, pos.getZ(i) - mz);
      }
      return acc / n;
    };

    // At t where sin differs strongly between the two breath rates.
    const T = 1.0;
    inst.setControl('breath', 0.1);
    inst.seek(T);
    const rLow = radiusAt();

    inst.setControl('breath', 4);
    inst.seek(T);
    const rHigh = radiusAt();

    expect(Math.abs(rHigh - rLow)).toBeGreaterThan(0.05);

    inst.dispose();
  });
});
