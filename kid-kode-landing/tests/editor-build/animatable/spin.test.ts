import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { spinPrimitive } from '@/lib/prism/animatable/primitives/spin';
import { makeTarget, runConformance } from './_conformance';

describe('spin primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(spinPrimitive).dispose();
  });

  it('plays: rotation about the axis differs between t=0 and t=cycle/2', () => {
    const target = makeTarget(spinPrimitive);
    const inst = spinPrimitive.create(target);
    const subject = target.subject as Mesh;
    const dur = inst.duration();

    inst.seek(0);
    const at0 = subject.rotation.y;
    inst.seek(dur / 2);
    const atHalf = subject.rotation.y;

    expect(Math.abs(atHalf - at0)).toBeGreaterThan(0.1);
    inst.dispose();
  });

  it('controls change output: axis selects which axis rotates', () => {
    const target = makeTarget(spinPrimitive);
    const inst = spinPrimitive.create(target);
    const subject = target.subject as Mesh;
    const dur = inst.duration();

    inst.setControl('axis', 'z');
    inst.seek(dur / 2);
    const zRot = subject.rotation.z;
    const yRot = subject.rotation.y;

    expect(Math.abs(zRot)).toBeGreaterThan(0.1);
    expect(Math.abs(yRot)).toBeLessThan(1e-6);
    inst.dispose();
  });
});
