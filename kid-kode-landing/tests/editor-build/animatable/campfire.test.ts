import { describe, it, expect } from 'vitest';
import { campfirePrimitive } from '@/lib/prism/animatable/primitives/campfire';
import { makeTarget, runConformance } from './_conformance';

type Uniforms = {
  uTime: { value: number };
  uSpeed: { value: number };
  uHeight: { value: number };
  uIntensity: { value: number };
};

describe('campfire primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(campfirePrimitive).dispose();
  });

  it('plays: the time uniform advances with seek (flicker drives the flame)', () => {
    const target = makeTarget(campfirePrimitive);
    const inst = campfirePrimitive.create(target);
    const u = target.userData.campfire as Uniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(1.37);
    const tMid = u.uTime.value;

    inst.seek(3.5);
    const tEnd = u.uTime.value;

    // Looping primitive: a mid-frame differs from t=0 and from a later frame.
    expect(tMid).toBeGreaterThan(t0);
    expect(tEnd).toBeGreaterThan(tMid);
    expect(tMid).not.toBe(t0);
    inst.dispose();
  });

  it('controls change output: intensity extremes drive distinct uniform values', () => {
    const target = makeTarget(campfirePrimitive);
    const inst = campfirePrimitive.create(target);
    const u = target.userData.campfire as Uniforms;

    inst.setControl('intensity', 0.2);
    inst.seek(0.5);
    const low = u.uIntensity.value;

    inst.setControl('intensity', 2.5);
    inst.seek(0.5);
    const high = u.uIntensity.value;

    expect(high).toBeGreaterThan(low + 1);

    // Height knob is also live-read on seek.
    inst.setControl('height', 0.3);
    inst.seek(0.5);
    const hLow = u.uHeight.value;
    inst.setControl('height', 1.8);
    inst.seek(0.5);
    const hHigh = u.uHeight.value;
    expect(hHigh).toBeGreaterThan(hLow);

    inst.dispose();
  });
});
