import { describe, it, expect } from 'vitest';
import type { Object3D } from 'three';
import { scrollTiltPrimitive } from '@/lib/prism/animatable/primitives/scroll-tilt';
import { makeTarget, runConformance } from './_conformance';

describe('scroll-tilt primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollTiltPrimitive).dispose();
  });

  it('plays: rotation.x tracks scroll from start tilt to end tilt', () => {
    const target = makeTarget(scrollTiltPrimitive);
    const inst = scrollTiltPrimitive.create(target);
    const subject = target.subject as Object3D;
    const baseRotX = subject.rotation.x;
    const baseZ = subject.position.z;

    // scroll = 0 -> at start tilt (default startTiltDeg = 0)
    target.userData.scroll = 0;
    inst.seek(0);
    const rotStart = subject.rotation.x;
    const zStart = subject.position.z;

    // mid scroll -> partway through the tilt
    target.userData.scroll = 0.5;
    inst.seek(0);
    const rotMid = subject.rotation.x;

    // scroll = 1 -> at end tilt (default endTiltDeg = -29 -> negative rotation)
    target.userData.scroll = 1;
    inst.seek(0);
    const rotEnd = subject.rotation.x;
    const zEnd = subject.position.z;

    // rotation.x leans back (more negative) as scroll advances
    expect(rotStart).toBeCloseTo(baseRotX, 5);
    expect(rotEnd).toBeLessThan(rotStart - 0.3);
    // mid frame is strictly between start and end (linear lerp)
    expect(rotMid).toBeLessThan(rotStart);
    expect(rotMid).toBeGreaterThan(rotEnd);
    // recede (default on) pushes z back as scroll advances
    expect(zStart).toBeCloseTo(baseZ, 5);
    expect(zEnd).toBeLessThan(zStart - 0.3);

    inst.dispose();
  });

  it('controls change output: larger end-tilt magnitude means larger rotation at full scroll', () => {
    const target = makeTarget(scrollTiltPrimitive);
    const inst = scrollTiltPrimitive.create(target);
    const subject = target.subject as Object3D;
    const baseRotX = subject.rotation.x;
    target.userData.scroll = 1;

    inst.setControl('endTiltDeg', -5);
    inst.seek(0);
    const small = Math.abs(subject.rotation.x - baseRotX);

    inst.setControl('endTiltDeg', -45);
    inst.seek(0);
    const large = Math.abs(subject.rotation.x - baseRotX);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
