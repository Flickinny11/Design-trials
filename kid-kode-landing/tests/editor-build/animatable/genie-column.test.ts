import { describe, it, expect } from 'vitest';
import { genieColumnPrimitive } from '@/lib/prism/animatable/primitives/genie-column';
import { makeTarget, runConformance } from './_conformance';

type Uniforms = {
  uTime: { value: number };
  uRise: { value: number };
  uCoil: { value: number };
  uTwist: { value: number };
};

describe('genie-column primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(genieColumnPrimitive).dispose();
  });

  it('plays: time uniform advances across the timeline', () => {
    const target = makeTarget(genieColumnPrimitive);
    const inst = genieColumnPrimitive.create(target);
    const u = target.userData.genieColumn as Uniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(2.5);
    const tMid = u.uTime.value;

    // Looping/stateful primitive: two distinct seek times yield distinct,
    // increasing clock values that drive the coil/rise shader animation.
    expect(t0).toBe(0);
    expect(tMid).toBeGreaterThan(t0 + 1);
    inst.dispose();
  });

  it('controls change output: coil extremes drive distinct braid frequencies', () => {
    const target = makeTarget(genieColumnPrimitive);
    const inst = genieColumnPrimitive.create(target);
    const u = target.userData.genieColumn as Uniforms;

    inst.setControl('coil', 2);
    inst.seek(1);
    const lowCoil = u.uCoil.value;

    inst.setControl('coil', 10);
    inst.seek(1);
    const highCoil = u.uCoil.value;

    expect(highCoil).toBeGreaterThan(lowCoil + 4);

    // twist control likewise drives an observable uniform change.
    inst.setControl('twist', 0);
    inst.seek(1);
    const lowTwist = u.uTwist.value;

    inst.setControl('twist', 0.4);
    inst.seek(1);
    const highTwist = u.uTwist.value;

    expect(highTwist).toBeGreaterThan(lowTwist + 0.3);
    inst.dispose();
  });
});
