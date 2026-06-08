import { describe, it, expect } from 'vitest';
import { lavaCausticsPrimitive } from '@/lib/prism/animatable/primitives/lava-caustics';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };
type LavaScratch = { uTime: Uniform; uSpeed: Uniform; uScale: Uniform; uHeat: Uniform };

describe('lava-caustics primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(lavaCausticsPrimitive).dispose();
  });

  it('plays: seek advances the time uniform across the timeline', () => {
    const target = makeTarget(lavaCausticsPrimitive);
    const inst = lavaCausticsPrimitive.create(target);
    const lava = target.userData.lavaCaustics as LavaScratch;

    inst.seek(0);
    const t0 = lava.uTime.value;

    inst.seek(1.5);
    const tMid = lava.uTime.value;

    inst.seek(3.0);
    const tLate = lava.uTime.value;

    // Looping/stateful: the driven time uniform advances monotonically and the
    // mid frame differs from both the start and the late frame.
    expect(tMid).toBeGreaterThan(t0 + 0.5);
    expect(tLate).toBeGreaterThan(tMid + 0.5);
    inst.dispose();
  });

  it('controls change output: heat extremes drive a different uniform value', () => {
    const target = makeTarget(lavaCausticsPrimitive);
    const inst = lavaCausticsPrimitive.create(target);
    const lava = target.userData.lavaCaustics as LavaScratch;

    inst.setControl('heat', 0.3);
    inst.seek(1.0);
    const low = lava.uHeat.value;

    inst.setControl('heat', 2.5);
    inst.seek(1.0);
    const high = lava.uHeat.value;

    expect(high).toBeGreaterThan(low + 0.5);

    // scale knob is also live-read into its uniform on seek.
    inst.setControl('scale', 3);
    inst.seek(1.0);
    const scaleLo = lava.uScale.value;
    inst.setControl('scale', 14);
    inst.seek(1.0);
    const scaleHi = lava.uScale.value;
    expect(scaleHi).toBeGreaterThan(scaleLo + 1);

    inst.dispose();
  });
});
