import { describe, it, expect } from 'vitest';
import { Object3D } from 'three';
import { scrollSkewPrimitive } from '@/lib/prism/animatable/primitives/scroll-skew';
import { makeTarget, runConformance } from './_conformance';

describe('scroll-skew primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollSkewPrimitive).dispose();
  });

  it('plays: scroll velocity shears (rotation.z), settles square when scroll rests', () => {
    const target = makeTarget(scrollSkewPrimitive);
    const inst = scrollSkewPrimitive.create(target);
    const subject = target.subject as Object3D;

    // Prime prevScroll at a baseline.
    target.userData.scroll = 0;
    inst.seek(0);

    // Fast scroll change -> nonzero shear.
    target.userData.scroll = 0.4;
    inst.seek(1);
    const fastRotZ = subject.rotation.z;
    expect(Math.abs(fastRotZ)).toBeGreaterThan(0.05);

    // Scroll rests (equal consecutive values) -> settles back toward square.
    target.userData.scroll = 0.4;
    inst.seek(2);
    const restRotZ = subject.rotation.z;
    expect(Math.abs(restRotZ)).toBeLessThan(1e-6);

    inst.dispose();
  });

  it('controls change output: larger skewGain means larger shear for same velocity', () => {
    const target = makeTarget(scrollSkewPrimitive);
    const inst = scrollSkewPrimitive.create(target);
    const subject = target.subject as Object3D;

    // Low gain.
    inst.setControl('skewGain', 0.5);
    inst.setControl('maxSkewDeg', 45);
    target.userData.scroll = 0;
    inst.seek(0);
    target.userData.scroll = 0.3;
    inst.seek(1);
    const small = Math.abs(subject.rotation.z);

    // High gain, same velocity step.
    inst.setControl('skewGain', 8);
    target.userData.scroll = 0;
    inst.seek(2);
    target.userData.scroll = 0.3;
    inst.seek(3);
    const large = Math.abs(subject.rotation.z);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
