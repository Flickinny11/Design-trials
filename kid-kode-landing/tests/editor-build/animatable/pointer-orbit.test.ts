import { describe, it, expect } from 'vitest';
import { Object3D } from 'three';
import { pointerOrbitPrimitive } from '@/lib/prism/animatable/primitives/pointer-orbit';
import { makeTarget, runConformance } from './_conformance';

describe('pointer-orbit primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerOrbitPrimitive).dispose();
  });

  it('plays: rotation.z swings toward the pointer angle as it tracks', () => {
    const target = makeTarget(pointerOrbitPrimitive);
    const subject = target.subject as Object3D;
    const inst = pointerOrbitPrimitive.create(target);

    // Slow smoothing so the swing is gradual and observable across frames.
    inst.setControl('smoothing', 0.05);
    // Pointer above-right of center → atan2(+,+) ~ +0.785 rad target.
    target.userData.pointer = { x: 1.0, y: 1.0 };

    inst.seek(0);
    const early = subject.rotation.z;

    // Advance the smoothing clock; the card should swing further toward target.
    inst.seek(0.05);
    const mid = subject.rotation.z;
    inst.seek(0.2);
    const late = subject.rotation.z;

    // Tracking toward a positive angle: rotation.z grows over elapsed time.
    expect(mid).toBeGreaterThan(early + 0.05);
    expect(late).toBeGreaterThan(mid + 0.01);
    // Settles toward ang*gain (~0.785) but does not exceed it.
    expect(late).toBeLessThanOrEqual(0.79);

    inst.dispose();
    // dispose restores the base rotation.
    expect(subject.rotation.z).toBeCloseTo(0, 5);
  });

  it('controls change output: larger gain means larger settled rotation.z', () => {
    const target = makeTarget(pointerOrbitPrimitive);
    const subject = target.subject as Object3D;
    const inst = pointerOrbitPrimitive.create(target);

    // Fixed pointer up-right → fixed angle (~0.785 rad); gain scales it.
    target.userData.pointer = { x: 1.0, y: 1.0 };

    inst.setControl('gain', 0.2);
    inst.seek(0);
    inst.seek(3.0);
    const small = subject.rotation.z;

    inst.setControl('gain', 1.5);
    inst.seek(0);
    inst.seek(3.0);
    const large = subject.rotation.z;

    expect(large).toBeGreaterThan(small + 0.3);

    inst.dispose();
  });
});
