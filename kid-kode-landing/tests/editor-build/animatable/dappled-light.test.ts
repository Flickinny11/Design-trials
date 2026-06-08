import { describe, it, expect } from 'vitest';
import { dappledLightPrimitive } from '@/lib/prism/animatable/primitives/dappled-light';
import { makeTarget, runConformance } from './_conformance';

describe('dappled-light primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dappledLightPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline (drives canopy drift)', () => {
    const target = makeTarget(dappledLightPrimitive);
    const inst = dappledLightPrimitive.create(target);
    const uTime = target.userData.uTime as { value: number };

    inst.seek(0);
    const t0 = uTime.value;

    inst.seek(2.5);
    const tMid = uTime.value;

    // Looping/stateful effect (duration === Infinity): the drift uniform must
    // advance between two distinct seek times, so a mid frame differs from t=0.
    expect(inst.duration()).toBe(Infinity);
    expect(tMid).toBeGreaterThan(t0 + 1);
    inst.dispose();
  });

  it('controls change output: contrast widens the smoothstep lo..hi gap', () => {
    const target = makeTarget(dappledLightPrimitive);
    const inst = dappledLightPrimitive.create(target);
    const uLo = target.userData.uLo as { value: number };
    const uHi = target.userData.uHi as { value: number };

    inst.setControl('contrast', 0.1);
    inst.seek(0);
    const gapSmall = uHi.value - uLo.value;

    inst.setControl('contrast', 1.0);
    inst.seek(0);
    const gapLarge = uHi.value - uLo.value;

    expect(gapLarge).toBeGreaterThan(gapSmall + 0.3);
    inst.dispose();
  });
});
