import { describe, it, expect } from 'vitest';
import { gemCausticsPrimitive } from '@/lib/prism/animatable/primitives/gem-caustics';
import { makeTarget, runConformance } from './_conformance';

describe('gem-caustics primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(gemCausticsPrimitive).dispose();
  });

  it('plays: time uniform advances across the timeline', () => {
    const target = makeTarget(gemCausticsPrimitive);
    const inst = gemCausticsPrimitive.create(target);
    const uTime = target.userData.uTime as { value: number };

    inst.seek(0);
    const t0 = uTime.value;

    inst.seek(1.5);
    const tMid = uTime.value;

    // looping (Infinity duration): two distinct seek points drive distinct time.
    expect(tMid).toBeGreaterThan(t0 + 0.5);
    inst.dispose();
  });

  it('controls change output: spread knob drives the spread uniform', () => {
    const target = makeTarget(gemCausticsPrimitive);
    const inst = gemCausticsPrimitive.create(target);
    const uSpread = target.userData.uSpread as { value: number };

    inst.setControl('spread', 0.1);
    inst.seek(0.5);
    const small = uSpread.value;

    inst.setControl('spread', 0.5);
    inst.seek(0.5);
    const large = uSpread.value;

    expect(large).toBeGreaterThan(small + 0.2);
    inst.dispose();
  });
});
