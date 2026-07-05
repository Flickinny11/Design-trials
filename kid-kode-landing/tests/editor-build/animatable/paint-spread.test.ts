import { describe, it, expect } from 'vitest';
import { paintSpreadPrimitive } from '@/lib/prism/animatable/primitives/paint-spread';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };
type PaintSpreadUniforms = {
  uProgress: Uniform;
  uNoiseScale: Uniform;
  uWobble: Uniform;
};

describe('paint-spread primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(paintSpreadPrimitive).dispose();
  });

  it('plays: the blot radius (uProgress) grows from the start to mid/late', () => {
    const target = makeTarget(paintSpreadPrimitive);
    const inst = paintSpreadPrimitive.create(target);
    const u = target.userData.paintSpread as PaintSpreadUniforms;
    const dur = inst.duration();

    inst.seek(0);
    const p0 = u.uProgress.value;

    inst.seek(dur * 0.5);
    const pMid = u.uProgress.value;

    inst.seek(dur);
    const pEnd = u.uProgress.value;

    // The growing reveal: progress is ~0 at the start and strictly larger by
    // mid-animation and at the settled end.
    expect(pMid).toBeGreaterThan(p0 + 0.1);
    expect(pEnd).toBeGreaterThan(pMid + 0.1);
    inst.dispose();
  });

  it('controls change output: wobble extremes drive a different edge uniform', () => {
    const target = makeTarget(paintSpreadPrimitive);
    const inst = paintSpreadPrimitive.create(target);
    const u = target.userData.paintSpread as PaintSpreadUniforms;

    inst.setControl('wobble', 0);
    inst.seek(0.5);
    const low = u.uWobble.value;

    inst.setControl('wobble', 0.4);
    inst.seek(0.5);
    const high = u.uWobble.value;

    expect(high).toBeGreaterThan(low + 0.3);

    // noiseScale is also a live numeric control feeding the shader.
    inst.setControl('noiseScale', 2);
    inst.seek(0.5);
    const nLow = u.uNoiseScale.value;

    inst.setControl('noiseScale', 12);
    inst.seek(0.5);
    const nHigh = u.uNoiseScale.value;

    expect(nHigh).toBeGreaterThan(nLow + 5);
    inst.dispose();
  });
});
