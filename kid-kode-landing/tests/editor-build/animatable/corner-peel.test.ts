import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { cornerPeelPrimitive } from '@/lib/prism/animatable/primitives/corner-peel';
import { makeTarget, runConformance } from './_conformance';

describe('corner-peel primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(cornerPeelPrimitive).dispose();
  });

  it('plays: scale grows and rotation.z settles toward 0 while opacity rises', () => {
    const target = makeTarget(cornerPeelPrimitive);
    const inst = cornerPeelPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const scale0 = mesh.scale.x;
    const rot0 = Math.abs(mesh.rotation.z);
    const op0 = mat.opacity;

    inst.seek(dur);
    const scaleEnd = mesh.scale.x;
    const rotEnd = Math.abs(mesh.rotation.z);
    const opEnd = mat.opacity;

    // scale grows 0 -> 1
    expect(scaleEnd).toBeGreaterThan(scale0 + 0.3);
    // rotation.z curls from a start angle and settles to ~0
    expect(rot0).toBeGreaterThan(rotEnd + 0.3);
    expect(rotEnd).toBeLessThan(0.05);
    // opacity rises
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger curl means a larger start angle', () => {
    const target = makeTarget(cornerPeelPrimitive);
    const inst = cornerPeelPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('curl', 0.4);
    inst.seek(0);
    const small = Math.abs(mesh.rotation.z);

    inst.setControl('curl', 1.4);
    inst.seek(0);
    const large = Math.abs(mesh.rotation.z);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
