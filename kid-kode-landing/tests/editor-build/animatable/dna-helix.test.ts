import { describe, it, expect } from 'vitest';
import { Points } from 'three';
import { dnaHelixPrimitive } from '@/lib/prism/animatable/primitives/dna-helix';
import { makeTarget, runConformance } from './_conformance';

/** Grab the position attribute array of the Points the primitive built. */
function positionArray(object: { children: unknown[] }): Float32Array {
  const pts = object.children.find(
    (c) => c instanceof Points,
  ) as Points | undefined;
  if (!pts) throw new Error('dna-helix did not build a Points object');
  return pts.geometry.getAttribute('position').array as Float32Array;
}

describe('dna-helix primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dnaHelixPrimitive).dispose();
  });

  it('plays: a particle rotates between two distinct times', () => {
    const target = makeTarget(dnaHelixPrimitive);
    const inst = dnaHelixPrimitive.create(target);
    const arr = positionArray(target.object as unknown as { children: unknown[] });

    // Sample the first strand particle's (x,z) at two distinct times — rotation
    // about the vertical axis must move it.
    inst.seek(0);
    const x0 = arr[0];
    const z0 = arr[2];
    const y0 = arr[1];

    inst.seek(1.0);
    const x1 = arr[0];
    const z1 = arr[2];
    const y1 = arr[1];

    // y (height mapping) is invariant under rotation about y; x/z change.
    expect(Math.abs(y1 - y0)).toBeLessThan(1e-6);
    const moved = Math.hypot(x1 - x0, z1 - z0);
    expect(moved).toBeGreaterThan(0.05);

    inst.dispose();
  });

  it('controls change output: larger radius pushes a strand particle farther out', () => {
    const target = makeTarget(dnaHelixPrimitive);
    const inst = dnaHelixPrimitive.create(target);
    const arr = positionArray(target.object as unknown as { children: unknown[] });

    // Pin spin to 0 so the radius is the only driver of (x,z) magnitude.
    inst.setControl('spin', 0);

    inst.setControl('radius', 0.3);
    inst.seek(0.5);
    const small = Math.hypot(arr[0], arr[2]);

    inst.setControl('radius', 2);
    inst.seek(0.5);
    const large = Math.hypot(arr[0], arr[2]);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
