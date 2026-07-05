import { describe, it, expect } from 'vitest';
import { wispySmokePrimitive } from '@/lib/prism/animatable/primitives/wispy-smoke';
import { makeTarget, runConformance } from './_conformance';

interface WispyHandles {
  uTime: { value: number };
  uRise: { value: number };
  uCurl: { value: number };
  uDensity: { value: number };
}

describe('wispy-smoke primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(wispySmokePrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(wispySmokePrimitive);
    const inst = wispySmokePrimitive.create(target);
    const h = target.userData.wispySmoke as WispyHandles;

    inst.seek(0);
    const t0 = h.uTime.value;

    inst.seek(2.5);
    const tMid = h.uTime.value;

    inst.seek(5);
    const tEnd = h.uTime.value;

    // looping/stateful: a mid frame differs from t=0 and from a later frame.
    expect(tMid).toBeGreaterThan(t0 + 0.5);
    expect(tEnd).toBeGreaterThan(tMid + 0.5);
    inst.dispose();
  });

  it('controls change output: density uniform follows setControl extremes', () => {
    const target = makeTarget(wispySmokePrimitive);
    const inst = wispySmokePrimitive.create(target);
    const h = target.userData.wispySmoke as WispyHandles;

    inst.setControl('density', 0);
    inst.seek(1);
    const low = h.uDensity.value;

    inst.setControl('density', 1.5);
    inst.seek(1);
    const high = h.uDensity.value;

    expect(high).toBeGreaterThan(low + 0.5);
    inst.dispose();
  });
});
