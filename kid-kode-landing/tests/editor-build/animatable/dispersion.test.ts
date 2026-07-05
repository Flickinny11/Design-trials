import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { dispersionPrimitive } from '@/lib/prism/animatable/primitives/dispersion';
import { makeTarget, runConformance } from './_conformance';

describe('dispersion primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dispersionPrimitive).dispose();
  });

  it('plays: the chromatic spread pulses over time', () => {
    const target = makeTarget(dispersionPrimitive);
    const inst = dispersionPrimitive.create(target);
    const mat = (target.subject as Mesh).material as unknown as { userData: { uSpread: number } };

    // t=0 -> sin(0)=0 -> spread at its trough (0.4 of configured).
    inst.seek(0);
    const trough = mat.userData.uSpread;

    // speed default 1.2 -> sin peaks near t = (PI/2)/1.2 ~= 1.31 -> spread crest.
    inst.seek(1.31);
    const crest = mat.userData.uSpread;

    // looping/stateful: a mid-animation frame differs from the t=0 trough.
    expect(crest).toBeGreaterThan(trough + 0.2);
    inst.dispose();
  });

  it('controls change output: larger spread means a larger live uSpread', () => {
    const target = makeTarget(dispersionPrimitive);
    const inst = dispersionPrimitive.create(target);
    const mat = (target.subject as Mesh).material as unknown as { userData: { uSpread: number } };

    inst.setControl('spread', 0);
    inst.seek(0.5);
    const small = mat.userData.uSpread;

    inst.setControl('spread', 4);
    inst.seek(0.5);
    const large = mat.userData.uSpread;

    expect(large).toBeGreaterThan(small + 0.5);
    inst.dispose();
  });
});
