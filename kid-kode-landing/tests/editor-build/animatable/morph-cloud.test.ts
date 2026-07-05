import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { morphCloudPrimitive } from '@/lib/prism/animatable/primitives/morph-cloud';
import { makeTarget, runConformance } from './_conformance';

function pointsOf(object: { children: unknown[] }): Points {
  const p = (object.children as Points[]).find((c) => (c as Points).isPoints);
  if (!p) throw new Error('no Points built');
  return p;
}

describe('morph-cloud primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(morphCloudPrimitive).dispose();
  });

  it('plays: a particle position element changes as shapes blend', () => {
    const target = makeTarget(morphCloudPrimitive);
    const inst = morphCloudPrimitive.create(target);
    const points = pointsOf(target.object as unknown as { children: unknown[] });
    const attr = points.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;

    // Early frame (blend ~0) vs a mid frame where the morph has progressed.
    inst.seek(0);
    const early = arr[30]; // particle 10, x

    inst.seek(Math.PI / 0.5); // blend cycles by default speed 0.5
    const mid = arr[30];

    expect(Math.abs(mid - early)).toBeGreaterThan(0.05);
    inst.dispose();
  });

  it('controls change output: larger jitter perturbs positions more', () => {
    const target = makeTarget(morphCloudPrimitive);
    const inst = morphCloudPrimitive.create(target);
    const points = pointsOf(target.object as unknown as { children: unknown[] });
    const attr = points.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;

    // Sample at a time where jitter is non-zero; compare two jitter extremes
    // against the no-jitter baseline so the displacement is observable.
    const t = 0.9;

    inst.setControl('jitter', 0);
    inst.seek(t);
    const base = Float32Array.from(arr);

    inst.setControl('jitter', 0.4);
    inst.seek(t);

    let maxDelta = 0;
    for (let i = 0; i < base.length; i++) {
      const d = Math.abs(arr[i] - base[i]);
      if (d > maxDelta) maxDelta = d;
    }
    expect(maxDelta).toBeGreaterThan(0.05);
    inst.dispose();
  });
});
