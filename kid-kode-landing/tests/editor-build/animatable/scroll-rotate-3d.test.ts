import { describe, it, expect } from 'vitest';
import { type Object3D } from 'three';
import { scrollRotate3dPrimitive } from '@/lib/prism/animatable/primitives/scroll-rotate-3d';
import { makeTarget, runConformance } from './_conformance';

describe('scroll-rotate-3d primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollRotate3dPrimitive).dispose();
  });

  it('plays: rotation tracks scroll and z parallaxes', () => {
    const target = makeTarget(scrollRotate3dPrimitive);
    const inst = scrollRotate3dPrimitive.create(target);
    const subject = target.subject as Object3D;

    // scroll=0 → +maxTilt
    target.userData.scroll = 0;
    inst.seek(0);
    const rotStart = subject.rotation.x;
    const zStart = subject.position.z;

    // scroll=0.5 → tilt ~0, z at closest (peak parallax)
    target.userData.scroll = 0.5;
    inst.seek(0);
    const zMid = subject.position.z;

    // scroll=1 → -maxTilt
    target.userData.scroll = 1;
    inst.seek(0);
    const rotEnd = subject.rotation.x;

    // rotation tracks scroll: start and end tilt differ and have opposite sign
    expect(Math.abs(rotStart - rotEnd)).toBeGreaterThan(0.3);
    expect(rotStart).toBeGreaterThan(rotEnd);
    // z parallax: mid-pass is nearer (larger z) than the edge
    expect(zMid).toBeGreaterThan(zStart + 0.1);

    inst.dispose();
  });

  it('controls change output: larger maxTilt means larger rotation swing', () => {
    const target = makeTarget(scrollRotate3dPrimitive);
    const inst = scrollRotate3dPrimitive.create(target);
    const subject = target.subject as Object3D;

    const swing = (): number => {
      target.userData.scroll = 0;
      inst.seek(0);
      const a = subject.rotation.x;
      target.userData.scroll = 1;
      inst.seek(0);
      const b = subject.rotation.x;
      return Math.abs(a - b);
    };

    inst.setControl('maxTiltDeg', 5);
    const small = swing();

    inst.setControl('maxTiltDeg', 90);
    const large = swing();

    expect(large).toBeGreaterThan(small + 0.3);

    inst.dispose();
  });
});
