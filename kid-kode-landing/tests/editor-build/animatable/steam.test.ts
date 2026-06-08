import { describe, it, expect } from 'vitest';
import { steamPrimitive } from '@/lib/prism/animatable/primitives/steam';
import { makeTarget, runConformance } from './_conformance';

type Uni = { value: number };
type SteamUniforms = {
  uTime: Uni;
  uRise: Uni;
  uSpread: Uni;
  uDensity: Uni;
};

describe('steam primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(steamPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(steamPrimitive);
    const inst = steamPrimitive.create(target);
    const u = target.userData.steamUniforms as SteamUniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(2.5);
    const tMid = u.uTime.value;

    inst.seek(5);
    const tEnd = u.uTime.value;

    // Looping/stateful: time advances monotonically and two distinct times
    // produce distinct uniform state (the field is advected upward by uTime).
    expect(tMid).toBeGreaterThan(t0 + 0.5);
    expect(tEnd).toBeGreaterThan(tMid + 0.5);
    inst.dispose();
  });

  it('controls change output: rise extremes drive different uniform values', () => {
    const target = makeTarget(steamPrimitive);
    const inst = steamPrimitive.create(target);
    const u = target.userData.steamUniforms as SteamUniforms;

    inst.setControl('rise', 0.1);
    inst.seek(1);
    const low = u.uRise.value;

    inst.setControl('rise', 3);
    inst.seek(1);
    const high = u.uRise.value;

    expect(high).toBeGreaterThan(low + 1);
    inst.dispose();
  });
});
