import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { hairSwayPrimitive } from '@/lib/prism/animatable/primitives/hair-sway';
import { makeTarget, runConformance } from './_conformance';

// Find a vertex on the top (tip) row and a vertex on the bottom (root) row of
// the plane's position attribute, returning their flat-array x indices.
function tipAndRootIndices(attr: BufferAttribute): { tip: number; root: number } {
  const arr = attr.array as Float32Array;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < arr.length; i += 3) {
    if (arr[i] < minY) minY = arr[i];
    if (arr[i] > maxY) maxY = arr[i];
  }
  let tip = 0;
  let root = 0;
  for (let i = 0; i < arr.length; i += 3) {
    const y = arr[i + 1];
    if (y === maxY) tip = i;
    if (y === minY) root = i;
  }
  return { tip, root };
}

describe('hair-sway primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(hairSwayPrimitive).dispose();
  });

  it('plays: tip vertex x moves over time, root vertex x stays put', () => {
    const target = makeTarget(hairSwayPrimitive);
    const inst = hairSwayPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const attr = mesh.geometry.getAttribute('position') as BufferAttribute;
    const { tip, root } = tipAndRootIndices(attr);
    const arr = attr.array as Float32Array;

    inst.seek(0);
    const tipX0 = arr[tip];
    const rootX0 = arr[root];

    inst.seek(0.9);
    const tipX1 = arr[tip];
    const rootX1 = arr[root];

    // The free tip visibly sways on x between two distinct times.
    expect(Math.abs(tipX1 - tipX0)).toBeGreaterThan(0.01);
    // The root row stays put (quadratic growth → ~0 at v=0).
    expect(Math.abs(rootX1 - rootX0)).toBeLessThan(1e-6);

    inst.dispose();
  });

  it('controls change output: larger amplitude means larger tip sway', () => {
    const target = makeTarget(hairSwayPrimitive);
    const inst = hairSwayPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const attr = mesh.geometry.getAttribute('position') as BufferAttribute;
    const { tip } = tipAndRootIndices(attr);
    const arr = attr.array as Float32Array;

    inst.setControl('amplitude', 0.05);
    inst.seek(0);
    const restX = arr[tip];
    inst.seek(0.9);
    const smallSway = Math.abs(arr[tip] - restX);

    inst.setControl('amplitude', 0.6);
    inst.seek(0);
    const restX2 = arr[tip];
    inst.seek(0.9);
    const largeSway = Math.abs(arr[tip] - restX2);

    expect(largeSway).toBeGreaterThan(smallSway + 0.02);

    inst.dispose();
  });
});
