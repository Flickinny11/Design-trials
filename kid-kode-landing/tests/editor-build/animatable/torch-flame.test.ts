import { describe, it, expect } from 'vitest';
import { torchFlamePrimitive } from '@/lib/prism/animatable/primitives/torch-flame';
import { makeTarget, runConformance } from './_conformance';

interface TorchHandles {
  uTime: { value: number };
  uRise: { value: number };
  uSway: { value: number };
  uHeight: { value: number };
}

describe('torch-flame primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(torchFlamePrimitive).dispose();
  });

  it('plays: seek advances the time uniform across the loop', () => {
    const target = makeTarget(torchFlamePrimitive);
    const inst = torchFlamePrimitive.create(target);
    const h = target.userData.torchFlame as TorchHandles;

    inst.seek(0);
    const t0 = h.uTime.value;

    inst.seek(1.3);
    const tMid = h.uTime.value;

    inst.seek(3.7);
    const tLate = h.uTime.value;

    // uTime advances with the driver clock (drives the upward-licking flame).
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    inst.dispose();
  });

  it('controls change output: sway extremes change the live uniform', () => {
    const target = makeTarget(torchFlamePrimitive);
    const inst = torchFlamePrimitive.create(target);
    const h = target.userData.torchFlame as TorchHandles;

    inst.setControl('sway', 0);
    inst.seek(0.5);
    const swayLo = h.uSway.value;

    inst.setControl('sway', 0.4);
    inst.seek(0.5);
    const swayHi = h.uSway.value;

    expect(swayHi).toBeGreaterThan(swayLo + 0.3);

    // Rise also feeds through live with no rebuild.
    inst.setControl('rise', 0.3);
    inst.seek(0.5);
    const riseLo = h.uRise.value;

    inst.setControl('rise', 4);
    inst.seek(0.5);
    const riseHi = h.uRise.value;

    expect(riseHi).toBeGreaterThan(riseLo + 1);
    inst.dispose();
  });
});
