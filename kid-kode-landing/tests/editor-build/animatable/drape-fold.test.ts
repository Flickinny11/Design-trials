import { describe, it, expect } from 'vitest';
import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { drapeFoldPrimitive } from '@/lib/prism/animatable/primitives/drape-fold';
import { makeTarget, runConformance } from './_conformance';

function posAttr(mesh: Mesh): BufferAttribute {
  return (mesh.geometry as BufferGeometry).getAttribute('position') as BufferAttribute;
}

/** Sum of |z| displacement vs the cached base, over all vertices. */
function totalAbsZ(attr: BufferAttribute): number {
  let s = 0;
  for (let i = 0; i < attr.count; i++) s += Math.abs(attr.getZ(i));
  return s;
}

describe('drape-fold primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(drapeFoldPrimitive).dispose();
  });

  it('plays: a vertex z varies across time (breathing folds)', () => {
    const target = makeTarget(drapeFoldPrimitive);
    const inst = drapeFoldPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const attr = posAttr(mesh);

    // Looping/stateful → pick two distinct t values and compare a CPU-observable
    // vertex-z. The breathing term differs between them, so total displacement
    // (and at least one vertex) changes.
    inst.seek(0.0);
    const early = totalAbsZ(attr);
    // Snapshot every z at the early frame to prove a concrete vertex changes.
    const earlyZ = new Float32Array(attr.count);
    for (let i = 0; i < attr.count; i++) earlyZ[i] = attr.getZ(i);

    inst.seek(1.6);
    const mid = totalAbsZ(attr);
    let maxDelta = 0;
    for (let i = 0; i < attr.count; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(attr.getZ(i) - earlyZ[i]));
    }

    // Folds exist (non-zero displacement) and the breathing changes them.
    expect(early).toBeGreaterThan(0.5);
    expect(maxDelta).toBeGreaterThan(0.01);
    expect(Math.abs(mid - early)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: larger foldDepth means deeper folds', () => {
    const target = makeTarget(drapeFoldPrimitive);
    const inst = drapeFoldPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const attr = posAttr(mesh);

    inst.setControl('foldDepth', 0.1);
    inst.seek(0.5);
    const shallow = totalAbsZ(attr);

    inst.setControl('foldDepth', 1);
    inst.seek(0.5);
    const deep = totalAbsZ(attr);

    expect(deep).toBeGreaterThan(shallow + 0.5);
    inst.dispose();
  });
});
