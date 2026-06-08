import { describe, it, expect } from 'vitest';
import { tearRevealPrimitive } from '@/lib/prism/animatable/primitives/tear-reveal';
import { makeTarget, runConformance } from './_conformance';

type U = { value: number };

describe('tear-reveal primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(tearRevealPrimitive).dispose();
  });

  it('plays: tear progress advances from t=0 to mid/end', () => {
    const target = makeTarget(tearRevealPrimitive);
    const inst = tearRevealPrimitive.create(target);
    const uProgress = target.userData.tearRevealProgress as U;
    const dur = inst.duration();

    inst.seek(0);
    const p0 = uProgress.value;

    inst.seek(dur * 0.5);
    const pMid = uProgress.value;

    inst.seek(dur);
    const pEnd = uProgress.value;

    // progress rises monotonically across the sweep and overshoots ~1.1 at end
    expect(p0).toBeCloseTo(0, 5);
    expect(pMid).toBeGreaterThan(p0 + 0.2);
    expect(pEnd).toBeGreaterThan(pMid + 0.2);
    expect(pEnd).toBeGreaterThan(1.0);
    inst.dispose();
  });

  it('controls change output: raggedness extremes update the live uniform', () => {
    const target = makeTarget(tearRevealPrimitive);
    const inst = tearRevealPrimitive.create(target);
    const uRagged = target.userData.tearRevealRagged as U;

    inst.setControl('raggedness', 0);
    inst.seek(0.1);
    const low = uRagged.value;

    inst.setControl('raggedness', 0.3);
    inst.seek(0.1);
    const high = uRagged.value;

    expect(high).toBeGreaterThan(low + 0.2);
    inst.dispose();
  });
});
