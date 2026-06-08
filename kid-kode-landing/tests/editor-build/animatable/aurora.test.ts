import { describe, it, expect } from 'vitest';
import { auroraPrimitive } from '@/lib/prism/animatable/primitives/aurora';
import { makeTarget, runConformance } from './_conformance';

// Aurora is a TSL/node-material primitive: its visible state lives in shader
// uniforms (uTime, uWidth, ...) driven by seek()/setControl(). Headless has no
// real GPU, so the primitive publishes its uniform handles on target.userData
// and we assert on their `.value` — CPU-observable state, no rendered pixels.
type AuroraUniforms = {
  uTime: { value: number };
  uSpeed: { value: number };
  uWidth: { value: number };
  uBright: { value: number };
};

describe('aurora primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(auroraPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline (loops forever)', () => {
    const target = makeTarget(auroraPrimitive);
    const inst = auroraPrimitive.create(target);
    const u = target.userData.auroraUniforms as AuroraUniforms;

    // Looping curtain — never settles.
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const tEarly = u.uTime.value;

    inst.seek(2.5);
    const tMid = u.uTime.value;

    inst.seek(5.0);
    const tLate = u.uTime.value;

    // The shader clock advances monotonically, so the curtains visibly shimmer.
    expect(tMid).toBeGreaterThan(tEarly);
    expect(tLate).toBeGreaterThan(tMid);
    expect(tMid).not.toBe(tEarly);

    inst.dispose();
  });

  it('controls change output: width knob changes the live width uniform', () => {
    const target = makeTarget(auroraPrimitive);
    const inst = auroraPrimitive.create(target);
    const u = target.userData.auroraUniforms as AuroraUniforms;

    inst.setControl('width', 0.02);
    inst.seek(0.5);
    const narrow = u.uWidth.value;

    inst.setControl('width', 0.4);
    inst.seek(0.5);
    const wide = u.uWidth.value;

    expect(wide).toBeGreaterThan(narrow + 0.3);

    // brightness also routes through the live uniform.
    inst.setControl('brightness', 0);
    inst.seek(0.5);
    const dark = u.uBright.value;
    inst.setControl('brightness', 3);
    inst.seek(0.5);
    const bright = u.uBright.value;
    expect(bright).toBeGreaterThan(dark + 2);

    inst.dispose();
  });
});
