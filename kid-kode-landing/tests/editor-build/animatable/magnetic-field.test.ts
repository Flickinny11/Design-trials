import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { magneticFieldPrimitive } from '@/lib/prism/animatable/primitives/magnetic-field';
import { makeTarget, runConformance } from './_conformance';

/** Grab the THREE.Points the primitive builds into target.object. */
function pointsOf(object: { children: unknown[] }): Points {
  const p = (object.children as unknown[]).find((c) => c instanceof Points);
  if (!p) throw new Error('no Points found');
  return p as Points;
}

describe('magnetic-field primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(magneticFieldPrimitive).dispose();
  });

  it('plays: particles flow along the field lines (position changes over time)', () => {
    const target = makeTarget(magneticFieldPrimitive);
    const inst = magneticFieldPrimitive.create(target);
    const pts = pointsOf(target.object as unknown as { children: unknown[] });
    const attr = pts.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;

    inst.seek(0);
    const a = Float32Array.from(arr.subarray(0, 300)); // first 100 particles

    inst.seek(1.7); // flow advances along the loop
    const b = Float32Array.from(arr.subarray(0, 300));

    // At least one coordinate must move meaningfully (flow along the line).
    let maxDelta = 0;
    for (let i = 0; i < a.length; i++) {
      const d = Math.abs(a[i] - b[i]);
      if (d > maxDelta) maxDelta = d;
    }
    expect(maxDelta).toBeGreaterThan(0.05);

    inst.dispose();
  });

  it('controls change output: larger field size means larger radial extent', () => {
    const target = makeTarget(magneticFieldPrimitive);
    const inst = magneticFieldPrimitive.create(target);
    const pts = pointsOf(target.object as unknown as { children: unknown[] });
    const attr = pts.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    const count = 8 * 80; // lines(default 8) * PER_LINE

    const maxRadius = () => {
      let m = 0;
      for (let i = 0; i < count; i++) {
        const x = arr[i * 3];
        const y = arr[i * 3 + 1];
        const r = Math.hypot(x, y);
        if (r > m) m = r;
      }
      return m;
    };

    inst.setControl('spread', 0.4);
    inst.seek(0.6);
    const small = maxRadius();

    inst.setControl('spread', 2.4);
    inst.seek(0.6);
    const large = maxRadius();

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
