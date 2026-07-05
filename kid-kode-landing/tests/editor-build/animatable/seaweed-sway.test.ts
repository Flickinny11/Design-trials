import { describe, it, expect } from 'vitest';
import { Mesh, BufferAttribute, type BufferGeometry } from 'three';
import { seaweedSwayPrimitive } from '@/lib/prism/animatable/primitives/seaweed-sway';
import { makeTarget, runConformance } from './_conformance';

/** Find the index (vertex stride*3) of the highest (tip) and lowest (root)
 *  vertex from the base position attribute. */
function tipAndRoot(arr: Float32Array): { tip: number; root: number } {
  let tip = 0;
  let root = 0;
  let maxY = -Infinity;
  let minY = Infinity;
  for (let i = 0; i < arr.length; i += 3) {
    const y = arr[i + 1];
    if (y > maxY) {
      maxY = y;
      tip = i;
    }
    if (y < minY) {
      minY = y;
      root = i;
    }
  }
  return { tip, root };
}

describe('seaweed-sway primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(seaweedSwayPrimitive).dispose();
  });

  it('plays: a tip vertex drifts across time while the root stays pinned', () => {
    const target = makeTarget(seaweedSwayPrimitive);
    const mesh = target.subject as Mesh;
    const posAttr = (mesh.geometry as BufferGeometry).getAttribute(
      'position',
    ) as BufferAttribute;
    const baseSnapshot = new Float32Array(posAttr.array as Float32Array);
    const { tip, root } = tipAndRoot(baseSnapshot);
    const rootBaseX = baseSnapshot[root];

    const inst = seaweedSwayPrimitive.create(target);

    inst.seek(0);
    const arr0 = posAttr.array as Float32Array;
    const tipX0 = arr0[tip];
    const rootX0 = arr0[root];

    // Looping primitive (duration Infinity): pick a distinct mid-cycle t.
    inst.seek(2.4);
    const arrMid = posAttr.array as Float32Array;
    const tipXMid = arrMid[tip];
    const rootXMid = arrMid[root];

    // Tip vertex x visibly drifts between the two frames.
    expect(Math.abs(tipXMid - tipX0)).toBeGreaterThan(0.02);
    // Root stays pinned (within float noise) to its base x at both frames.
    expect(Math.abs(rootX0 - rootBaseX)).toBeLessThan(1e-4);
    expect(Math.abs(rootXMid - rootBaseX)).toBeLessThan(1e-4);

    inst.dispose();
    // dispose restores base positions exactly.
    const arrR = posAttr.array as Float32Array;
    expect(Math.abs(arrR[tip] - baseSnapshot[tip])).toBeLessThan(1e-6);
  });

  it('controls change output: larger amplitude means larger tip drift', () => {
    const target = makeTarget(seaweedSwayPrimitive);
    const mesh = target.subject as Mesh;
    const posAttr = (mesh.geometry as BufferGeometry).getAttribute(
      'position',
    ) as BufferAttribute;
    const baseSnapshot = new Float32Array(posAttr.array as Float32Array);
    const { tip } = tipAndRoot(baseSnapshot);
    const tipBaseX = baseSnapshot[tip];

    const inst = seaweedSwayPrimitive.create(target);

    inst.setControl('amplitude', 0.05);
    inst.seek(1.7);
    const small = Math.abs((posAttr.array as Float32Array)[tip] - tipBaseX);

    inst.setControl('amplitude', 0.6);
    inst.seek(1.7);
    const large = Math.abs((posAttr.array as Float32Array)[tip] - tipBaseX);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
