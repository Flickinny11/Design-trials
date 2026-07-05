import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { fadeRotatePrimitive } from '@/lib/prism/animatable/primitives/fade-rotate';
import { makeTarget, runConformance } from './_conformance';

describe('fade-rotate primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fadeRotatePrimitive).dispose();
  });

  it('plays: opacity rises and rotation.z settles toward 0', () => {
    const target = makeTarget(fadeRotatePrimitive);
    const inst = fadeRotatePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const op0 = mat.opacity;
    const rot0 = Math.abs(mesh.rotation.z);

    inst.seek(dur);
    const opDur = mat.opacity;
    const rotDur = Math.abs(mesh.rotation.z);

    // opacity rises from near-0 to ~1 across the eased phase
    expect(opDur).toBeGreaterThan(op0 + 0.3);
    // rotation starts tilted and settles to ~0
    expect(rot0).toBeGreaterThan(rotDur + 0.05);
    expect(rotDur).toBeLessThan(1e-4);
    inst.dispose();
  });

  it('controls change output: larger start tilt means larger initial rotation', () => {
    const target = makeTarget(fadeRotatePrimitive);
    const inst = fadeRotatePrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('startAngleDeg', 3);
    inst.seek(0);
    const small = Math.abs(mesh.rotation.z);

    inst.setControl('startAngleDeg', 30);
    inst.seek(0);
    const large = Math.abs(mesh.rotation.z);

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });
});
