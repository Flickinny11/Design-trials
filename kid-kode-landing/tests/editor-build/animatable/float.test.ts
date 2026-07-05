import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { floatPrimitive } from '@/lib/prism/animatable/primitives/float';
import { makeTarget, runConformance } from './_conformance';

describe('float primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(floatPrimitive).dispose();
  });

  it('plays: position.y bobs and rotation.z tilts across the loop', () => {
    const target = makeTarget(floatPrimitive);
    const inst = floatPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Pick two distinct phases of the sine loop. With default speed 1.2,
    // t=0 → y offset 0; t at sine quarter-period → max y offset.
    inst.seek(0);
    const y0 = mesh.position.y;
    const rz0 = mesh.position.z; // rotation.z separate below

    inst.seek(Math.PI / 2 / 1.2); // sin(t*speed) = sin(PI/2) = 1 → peak bob
    const yMid = mesh.position.y;
    const rzMid = mesh.rotation.z;

    // position.y must differ across seek times (visible vertical motion).
    expect(Math.abs(yMid - y0)).toBeGreaterThan(0.05);
    // rotation.z must also have moved off its base.
    expect(Math.abs(rzMid)).toBeGreaterThan(0.001);
    void rz0;
    inst.dispose();
  });

  it('controls change output: larger amplitude means larger bob', () => {
    const target = makeTarget(floatPrimitive);
    const inst = floatPrimitive.create(target);
    const mesh = target.subject as Mesh;

    const tPeak = Math.PI / 2 / 1.2; // peak of sin(t*speed) at default speed

    inst.setControl('amplitude', 0.05);
    inst.seek(tPeak);
    const small = Math.abs(mesh.position.y);

    inst.setControl('amplitude', 0.8);
    inst.seek(tPeak);
    const large = Math.abs(mesh.position.y);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
