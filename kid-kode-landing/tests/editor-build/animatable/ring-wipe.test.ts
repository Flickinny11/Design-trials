import { describe, it, expect } from 'vitest';
import { ringWipePrimitive } from '@/lib/prism/animatable/primitives/ring-wipe';
import { makeTarget, runConformance } from './_conformance';

describe('ring-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(ringWipePrimitive).dispose();
  });

  it('plays: reveal progress grows from center outward across the timeline', () => {
    const target = makeTarget(ringWipePrimitive);
    const inst = ringWipePrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0);
    const p0 = (target.userData.ringProgress as { value: number }).value;

    inst.seek(dur / 2);
    const pMid = (target.userData.ringProgress as { value: number }).value;

    inst.seek(dur);
    const pEnd = (target.userData.ringProgress as { value: number }).value;

    // Starts near 0, advances at the midpoint, settles past 1 (band cleared).
    expect(p0).toBeLessThan(0.05);
    expect(pMid).toBeGreaterThan(p0 + 0.1);
    expect(pEnd).toBeGreaterThan(pMid + 0.1);
    expect(pEnd).toBeGreaterThan(1.0);
    inst.dispose();
  });

  it('controls change output: larger ringGlow means a brighter front ring', () => {
    const target = makeTarget(ringWipePrimitive);
    const inst = ringWipePrimitive.create(target);

    // The glow uniform is updated live in seek from params.ringGlow — assert on
    // the actual uniform .value the shader reads, not just the param echo.
    const glow = target.userData.ringGlow as { value: number };

    inst.setControl('ringGlow', 0);
    inst.seek(0.3);
    const glow0 = glow.value;

    inst.setControl('ringGlow', 3);
    inst.seek(0.3);
    const glow1 = glow.value;

    expect(glow0).toBe(0);
    expect(glow1).toBeGreaterThan(glow0 + 1);
    inst.dispose();
  });
});
