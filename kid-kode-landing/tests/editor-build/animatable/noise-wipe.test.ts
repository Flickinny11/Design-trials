import { describe, it, expect } from 'vitest';
import { noiseWipePrimitive } from '@/lib/prism/animatable/primitives/noise-wipe';
import { makeTarget, runConformance } from './_conformance';

describe('noise-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(noiseWipePrimitive).dispose();
  });

  it('plays: the reveal-front progress uniform advances across the timeline', () => {
    const target = makeTarget(noiseWipePrimitive);
    const inst = noiseWipePrimitive.create(target);
    const progress = target.userData.noiseWipeProgress as { value: number };
    const dur = inst.duration();

    inst.seek(0);
    const p0 = progress.value;

    inst.seek(dur * 0.5);
    const pMid = progress.value;

    inst.seek(dur);
    const pEnd = progress.value;

    // progress sweeps 0 -> ~0.5 -> ~1: a mid frame differs from t=0 and the end.
    expect(pMid).toBeGreaterThan(p0 + 0.2);
    expect(pEnd).toBeGreaterThan(pMid + 0.2);
    expect(p0).toBeLessThan(0.001);
    inst.dispose();
  });

  it('controls change output: raggedness scale drives the noise-field uniform', () => {
    const target = makeTarget(noiseWipePrimitive);
    const inst = noiseWipePrimitive.create(target);
    const scale = target.userData.noiseWipeScale as { value: number };

    inst.setControl('scale', 2);
    inst.seek(0);
    const small = scale.value;

    inst.setControl('scale', 12);
    inst.seek(0);
    const large = scale.value;

    expect(large).toBeGreaterThan(small + 5);
    inst.dispose();
  });
});
