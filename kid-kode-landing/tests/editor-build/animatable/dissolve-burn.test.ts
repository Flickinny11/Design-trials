import { describe, it, expect } from 'vitest';
import { dissolveBurnPrimitive } from '@/lib/prism/animatable/primitives/dissolve-burn';
import { makeTarget, runConformance } from './_conformance';

type UniformLike = { value: number };

describe('dissolve-burn primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dissolveBurnPrimitive).dispose();
  });

  it('plays: burn threshold sweeps 0 -> 1 (burn-out) across the timeline', () => {
    const target = makeTarget(dissolveBurnPrimitive);
    const inst = dissolveBurnPrimitive.create(target);
    const u = target.userData.uThreshold as UniformLike;
    const dur = inst.duration();

    inst.seek(0);
    const start = u.value;

    inst.seek(dur / 2);
    const mid = u.value;

    inst.seek(dur);
    const end = u.value;

    // burn-out default: threshold rises across the burn, eating the card.
    expect(start).toBeLessThan(0.05);
    expect(mid).toBeGreaterThan(start + 0.2);
    expect(end).toBeGreaterThan(mid + 0.2);
    inst.dispose();
  });

  it('controls change output: direction reverses the threshold sweep', () => {
    const target = makeTarget(dissolveBurnPrimitive);
    const inst = dissolveBurnPrimitive.create(target);
    const u = target.userData.uThreshold as UniformLike;
    const dur = inst.duration();

    inst.setControl('direction', 'burn-out');
    inst.seek(0);
    const outStart = u.value;
    inst.seek(dur);
    const outEnd = u.value;

    inst.setControl('direction', 'burn-in');
    inst.seek(0);
    const inStart = u.value;
    inst.seek(dur);
    const inEnd = u.value;

    // burn-out climbs, burn-in descends — opposite signs of travel.
    expect(outEnd - outStart).toBeGreaterThan(0.5);
    expect(inEnd - inStart).toBeLessThan(-0.5);
    inst.dispose();
  });
});
