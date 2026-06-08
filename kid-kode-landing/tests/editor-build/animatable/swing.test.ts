import { describe, it, expect } from 'vitest';
import { Object3D } from 'three';
import { swingPrimitive } from '@/lib/prism/animatable/primitives/swing';
import { makeTarget, runConformance } from './_conformance';

describe('swing primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(swingPrimitive).dispose();
  });

  it('plays: rotation.z swings mid-animation and settles toward rest', () => {
    const target = makeTarget(swingPrimitive);
    const inst = swingPrimitive.create(target);
    const subject = target.subject as Object3D;
    const dur = inst.duration();

    inst.seek(0);
    const rotStart = subject.rotation.z;

    // A mid frame: pendulum is mid-swing — must differ from t=0.
    inst.seek(dur * 0.12);
    const rotMid = subject.rotation.z;

    // End: damping has driven the swing toward rest.
    inst.seek(dur);
    const rotEnd = subject.rotation.z;

    // The mid frame is visibly displaced from the t=0 frame.
    expect(Math.abs(rotMid - rotStart)).toBeGreaterThan(0.05);
    // Damping: end displacement is smaller than the mid displacement.
    expect(Math.abs(rotEnd - rotStart)).toBeLessThan(Math.abs(rotMid - rotStart));
    inst.dispose();
  });

  it('controls change output: larger amplitude means larger swing', () => {
    const target = makeTarget(swingPrimitive);
    const inst = swingPrimitive.create(target);
    const subject = target.subject as Object3D;
    const dur = inst.duration();
    const base = subject.rotation.z;

    inst.setControl('amplitudeDeg', 5);
    inst.seek(dur * 0.05);
    const small = Math.abs(subject.rotation.z - base);

    inst.setControl('amplitudeDeg', 90);
    inst.seek(dur * 0.05);
    const large = Math.abs(subject.rotation.z - base);

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });
});
