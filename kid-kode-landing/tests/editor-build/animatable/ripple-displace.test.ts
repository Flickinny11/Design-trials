import { describe, it, expect } from 'vitest';
import { rippleDisplacePrimitive } from '@/lib/prism/animatable/primitives/ripple-displace';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };

describe('ripple-displace primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(rippleDisplacePrimitive).dispose();
  });

  it('plays: progress advances 0 -> mid -> 1 across the timeline', () => {
    const target = makeTarget(rippleDisplacePrimitive);
    const inst = rippleDisplacePrimitive.create(target);
    const dur = inst.duration();
    const uProgress = target.userData.uProgress as Uniform;

    inst.seek(0);
    const p0 = uProgress.value;

    inst.seek(dur * 0.5);
    const pMid = uProgress.value;

    inst.seek(dur);
    const pEnd = uProgress.value;

    // a mid frame differs from t=0 AND from the settled end
    expect(pMid).toBeGreaterThan(p0 + 0.1);
    expect(pEnd).toBeGreaterThan(pMid + 0.1);
    expect(p0).toBeCloseTo(0, 5);
    expect(pEnd).toBeCloseTo(1, 5);
    inst.dispose();
  });

  it('controls change output: amplitude knob drives the warp amplitude uniform', () => {
    const target = makeTarget(rippleDisplacePrimitive);
    const inst = rippleDisplacePrimitive.create(target);
    const uAmp = target.userData.uAmp as Uniform;

    inst.setControl('amplitude', 0);
    inst.seek(0.5);
    const low = uAmp.value;

    inst.setControl('amplitude', 0.3);
    inst.seek(0.5);
    const high = uAmp.value;

    expect(high).toBeGreaterThan(low + 0.2);
    inst.dispose();
  });
});
