import { describe, it, expect } from 'vitest';
import { smokedGlassPrimitive } from '@/lib/prism/animatable/primitives/smoked-glass';
import { makeTarget, runConformance } from './_conformance';

describe('smoked-glass primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(smokedGlassPrimitive).dispose();
  });

  it('plays: the time uniform drifts the internal cloudiness across the timeline', () => {
    const target = makeTarget(smokedGlassPrimitive);
    const inst = smokedGlassPrimitive.create(target);
    const uTime = target.userData.uTime as { value: number };

    inst.seek(0);
    const t0 = uTime.value;

    inst.seek(1.7);
    const tMid = uTime.value;

    inst.seek(3.4);
    const tLate = uTime.value;

    // A mid frame differs from t=0 and from a later frame: the drift advances.
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    inst.dispose();
  });

  it('controls change output: cloudiness extremes change the cloud uniform', () => {
    const target = makeTarget(smokedGlassPrimitive);
    const inst = smokedGlassPrimitive.create(target);
    const uCloud = target.userData.uCloud as { value: number };

    inst.setControl('cloudiness', 0);
    inst.seek(0.5);
    const low = uCloud.value;

    inst.setControl('cloudiness', 0.4);
    inst.seek(0.5);
    const high = uCloud.value;

    expect(high).toBeGreaterThan(low + 0.3);
    inst.dispose();
  });
});
