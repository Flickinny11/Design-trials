import { describe, it, expect } from 'vitest';
import { lightningBoltPrimitive } from '@/lib/prism/animatable/primitives/lightning-bolt';
import { makeTarget, runConformance } from './_conformance';

describe('lightning-bolt primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(lightningBoltPrimitive).dispose();
  });

  it('plays: the flash gate strikes (1) and goes dark (0) across the timeline', () => {
    const target = makeTarget(lightningBoltPrimitive);
    const inst = lightningBoltPrimitive.create(target);

    // Looping/stateful: duration is Infinity.
    expect(inst.duration()).toBe(Infinity);

    let sawStrike = false;
    let sawDark = false;
    // Sweep a few seconds of the timeline; deterministic (no Math.random).
    for (let i = 0; i <= 200; i++) {
      const t = i * 0.02; // 0 .. 4s
      inst.seek(t);
      const fl = target.userData.flash as number;
      if (fl === 1) sawStrike = true;
      if (fl === 0) sawDark = true;
    }
    // The bolt both lights up (sudden flash) and is dark most of the time.
    expect(sawStrike).toBe(true);
    expect(sawDark).toBe(true);

    // A concrete change between two specific frames: find an early dark frame
    // and a later strike frame so a mid-animation frame differs from t=0.
    inst.seek(0);
    const f0 = target.userData.flash as number;
    expect(f0).toBe(0); // settles dark at t=0 (default strikeRate=2)

    // Find a t where it strikes.
    let strikeFlash = 0;
    for (let i = 1; i <= 200; i++) {
      inst.seek(i * 0.02);
      if ((target.userData.flash as number) === 1) {
        strikeFlash = 1;
        break;
      }
    }
    expect(strikeFlash).toBe(1);
    expect(strikeFlash).not.toBe(f0);

    inst.dispose();
  });

  it('controls change output: strikeRate alters the flash timing', () => {
    const target = makeTarget(lightningBoltPrimitive);
    const inst = lightningBoltPrimitive.create(target);

    // Count strikes over a fixed window for two strikeRate extremes. Higher
    // strike rate => more flashes in the same window. Deterministic.
    const countStrikes = (rate: number): number => {
      inst.setControl('strikeRate', rate);
      let n = 0;
      for (let i = 0; i <= 200; i++) {
        inst.seek(i * 0.02); // 0..4s
        if ((target.userData.flash as number) === 1) n++;
      }
      return n;
    };

    const slow = countStrikes(0.2);
    const fast = countStrikes(6);

    expect(fast).toBeGreaterThan(slow);
    inst.dispose();
  });
});
