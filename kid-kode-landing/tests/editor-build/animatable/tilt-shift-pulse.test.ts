import { describe, it, expect } from 'vitest';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { tiltShiftPulsePrimitive } from '@/lib/prism/animatable/primitives/tilt-shift-pulse';
import { makeTarget, runConformance } from './_conformance';

type Uni = { value: number };
type TiltScratch = {
  uTime: Uni;
  uBreath: Uni;
  uFocusHalf: Uni;
  uFalloff: Uni;
  uSpeed: Uni;
};

describe('tilt-shift-pulse primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(tiltShiftPulsePrimitive).dispose();
  });

  it('plays: the defocus band breathes between two timeline frames', () => {
    const target = makeTarget(tiltShiftPulsePrimitive);
    const inst = tiltShiftPulsePrimitive.create(target);
    const scratch = target.userData.tiltShift as TiltScratch;

    // Looping/stateful primitive — pick two distinct t with the breathing
    // sin at different phases (speed default ~1.2 → quarter period ~1.31s).
    inst.seek(0);
    const breathEarly = scratch.uBreath.value;
    const timeEarly = scratch.uTime.value;

    inst.seek(1.3);
    const breathMid = scratch.uBreath.value;
    const timeMid = scratch.uTime.value;

    // uTime advanced and the band's breathing strength changed (concrete numeric).
    expect(timeMid).toBeGreaterThan(timeEarly);
    expect(Math.abs(breathMid - breathEarly)).toBeGreaterThan(0.2);
    inst.dispose();
  });

  it('swaps in a node material and restores it on dispose', () => {
    const target = makeTarget(tiltShiftPulsePrimitive);
    const mesh = target.subject as unknown as { material: unknown };
    const before = mesh.material;
    const inst = tiltShiftPulsePrimitive.create(target);
    expect(mesh.material).toBeInstanceOf(MeshStandardNodeMaterial);
    inst.dispose();
    expect(mesh.material).toBe(before);
  });

  it('controls change output: focusHeight extremes set distinct band geometry', () => {
    const target = makeTarget(tiltShiftPulsePrimitive);
    const inst = tiltShiftPulsePrimitive.create(target);
    const scratch = target.userData.tiltShift as TiltScratch;

    inst.setControl('focusHeight', 0.05);
    inst.seek(0.4);
    const thin = scratch.uFocusHalf.value;

    inst.setControl('focusHeight', 0.5);
    inst.seek(0.4);
    const wide = scratch.uFocusHalf.value;

    expect(wide).toBeGreaterThan(thin + 0.2);
    inst.dispose();
  });
});
