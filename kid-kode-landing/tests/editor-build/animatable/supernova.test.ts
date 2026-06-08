import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { supernovaPrimitive } from '@/lib/prism/animatable/primitives/supernova';
import { makeTarget, runConformance } from './_conformance';

type SupernovaUniforms = {
  uTime: { value: number };
  uRate: { value: number };
  uMaxR: { value: number };
  uRays: { value: number };
};

describe('supernova primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(supernovaPrimitive).dispose();
  });

  it('plays: swaps a node material and advances its time uniform across the loop', () => {
    const target = makeTarget(supernovaPrimitive);
    const mesh = target.subject as Mesh;
    const baseMat = mesh.material;

    const inst = supernovaPrimitive.create(target);

    // Material was swapped to a node material.
    expect(mesh.material).not.toBe(baseMat);
    expect(mesh.material).toBeInstanceOf(MeshBasicNodeMaterial);

    const u = target.userData.supernova as SupernovaUniforms;

    // Loop is stateful: duration is Infinity and seek drives uTime continuously.
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const t0 = u.uTime.value;

    // A mid-loop frame differs from t=0.
    inst.seek(1.37);
    const tMid = u.uTime.value;

    expect(t0).toBe(0);
    expect(tMid).toBeCloseTo(1.37, 5);
    expect(tMid).not.toBe(t0);

    inst.dispose();
    // Material restored on dispose.
    expect(mesh.material).toBe(baseMat);
  });

  it('controls change output: novaRate extremes set distinct tracked uniform values', () => {
    const target = makeTarget(supernovaPrimitive);
    const inst = supernovaPrimitive.create(target);
    const u = target.userData.supernova as SupernovaUniforms;

    inst.setControl('novaRate', 0.05);
    inst.seek(0.5);
    const low = u.uRate.value;

    inst.setControl('novaRate', 1.5);
    inst.seek(0.5);
    const high = u.uRate.value;

    expect(low).toBeCloseTo(0.05, 5);
    expect(high).toBeCloseTo(1.5, 5);
    expect(high).toBeGreaterThan(low + 0.5);

    inst.dispose();
  });
});
