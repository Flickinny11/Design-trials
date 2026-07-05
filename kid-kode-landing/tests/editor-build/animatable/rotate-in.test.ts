import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { rotateInPrimitive } from '@/lib/prism/animatable/primitives/rotate-in';
import { makeTarget, runConformance } from './_conformance';

describe('rotate-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(rotateInPrimitive).dispose();
  });

  it('plays: rotation untilts, scale grows, opacity rises', () => {
    const target = makeTarget(rotateInPrimitive);
    const inst = rotateInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const rot0 = Math.abs(mesh.rotation.z);
    const scale0 = mesh.scale.x;
    const op0 = mat.opacity;

    inst.seek(dur);
    const rotDur = Math.abs(mesh.rotation.z);
    const scaleDur = mesh.scale.x;
    const opDur = mat.opacity;

    // starts tilted (~|angle|), ends upright (~0)
    expect(rot0).toBeGreaterThan(rotDur + 0.3);
    // scale grows from 0.6 toward 1
    expect(scaleDur).toBeGreaterThan(scale0 + 0.1);
    // opacity rises across the eased phase
    expect(opDur).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger |angle| means larger initial tilt', () => {
    const target = makeTarget(rotateInPrimitive);
    const inst = rotateInPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('angleDeg', -10);
    inst.seek(0);
    const small = Math.abs(mesh.rotation.z);

    inst.setControl('angleDeg', -180);
    inst.seek(0);
    const large = Math.abs(mesh.rotation.z);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
