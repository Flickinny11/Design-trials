import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { skewInPrimitive } from '@/lib/prism/animatable/primitives/skew-in';
import { makeTarget, runConformance } from './_conformance';

describe('skew-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(skewInPrimitive).dispose();
  });

  it('plays: rotation.z and scale.x shear in and settle while opacity rises', () => {
    const target = makeTarget(skewInPrimitive);
    const inst = skewInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const rot0 = mesh.rotation.z;
    const sx0 = mesh.scale.x;
    const op0 = mat.opacity;

    inst.seek(dur * 0.4);
    const rotMid = mesh.rotation.z;
    const sxMid = mesh.scale.x;

    inst.seek(dur);
    const rotEnd = mesh.rotation.z;
    const sxEnd = mesh.scale.x;
    const opEnd = mat.opacity;

    // mid frame differs from t=0 on both rotation and scale
    expect(Math.abs(rotMid - rot0)).toBeGreaterThan(0.05);
    expect(Math.abs(sxMid - sx0)).toBeGreaterThan(0.05);
    // start is sheared/stretched; settles to ~square at the end
    expect(Math.abs(rot0)).toBeGreaterThan(Math.abs(rotEnd) + 0.05);
    expect(sx0).toBeGreaterThan(sxEnd + 0.05);
    expect(Math.abs(rotEnd)).toBeLessThan(0.01);
    // opacity rises across the eased phase
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger skewDeg means larger initial shear', () => {
    const target = makeTarget(skewInPrimitive);
    const inst = skewInPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('skewDeg', 10);
    inst.seek(0);
    const small = Math.abs(mesh.rotation.z);

    inst.setControl('skewDeg', 60);
    inst.seek(0);
    const large = Math.abs(mesh.rotation.z);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
