import { describe, it, expect } from 'vitest';
import { fadeVignettePrimitive } from '@/lib/prism/animatable/primitives/fade-vignette';
import { makeTarget, runConformance } from './_conformance';

// The primitive publishes its live uniform handles into target.userData
// (contract: userData is scratch space shared with the host). We read .value
// off those handles for CPU-observable assertions — never rendered pixels.
type Uniforms = {
  uProgress: { value: number };
  uSoft: { value: number };
  uInvert: { value: number };
};
const uniforms = (target: ReturnType<typeof makeTarget>): Uniforms =>
  target.userData.fadeVignette as Uniforms;

describe('fade-vignette primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fadeVignettePrimitive).dispose();
  });

  it('plays: vignette progress advances across the timeline', () => {
    const target = makeTarget(fadeVignettePrimitive);
    const inst = fadeVignettePrimitive.create(target);
    const u = uniforms(target);
    const dur = inst.duration();

    inst.seek(0);
    const p0 = u.uProgress.value;

    inst.seek(dur * 0.5);
    const pMid = u.uProgress.value;

    inst.seek(dur);
    const pEnd = u.uProgress.value;

    // progress sweeps center -> edges, growing monotonically with t
    expect(pMid).toBeGreaterThan(p0);
    expect(pEnd).toBeGreaterThan(pMid);
    // sweeps past 1 so the edges fully clear
    expect(pEnd).toBeGreaterThan(1);
    inst.dispose();
  });

  it('controls change output: softness knob widens the falloff band', () => {
    const target = makeTarget(fadeVignettePrimitive);
    const inst = fadeVignettePrimitive.create(target);
    const u = uniforms(target);

    inst.setControl('softness', 0.1);
    inst.seek(inst.duration() * 0.5);
    const soft0 = u.uSoft.value;

    inst.setControl('softness', 0.6);
    inst.seek(inst.duration() * 0.5);
    const soft1 = u.uSoft.value;

    expect(soft1).toBeGreaterThan(soft0 + 0.3);
    inst.dispose();
  });
});
