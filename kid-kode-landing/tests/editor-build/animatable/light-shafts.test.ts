import { describe, it, expect } from 'vitest';
import { lightShaftsPrimitive } from '@/lib/prism/animatable/primitives/light-shafts';
import { makeTarget, runConformance } from './_conformance';

type ShaftUniforms = {
  uTime: { value: number };
  uRays: { value: number };
  uSpeed: { value: number };
  uSpread: { value: number };
  uSharp: { value: number };
};

describe('light-shafts primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(lightShaftsPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(lightShaftsPrimitive);
    const inst = lightShaftsPrimitive.create(target);
    const u = target.userData.lightShafts as ShaftUniforms;

    inst.seek(0);
    const early = u.uTime.value;

    inst.seek(1.5);
    const mid = u.uTime.value;

    inst.seek(3.0);
    const late = u.uTime.value;

    // The driver clock visibly advances the shimmer uniform.
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(mid);
    // Looping primitive: never settles.
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('controls change output: ray frequency uniform tracks the control', () => {
    const target = makeTarget(lightShaftsPrimitive);
    const inst = lightShaftsPrimitive.create(target);
    const u = target.userData.lightShafts as ShaftUniforms;

    inst.setControl('rays', 4);
    inst.seek(0.5);
    const few = u.uRays.value;

    inst.setControl('rays', 40);
    inst.seek(0.5);
    const many = u.uRays.value;

    expect(many).toBeGreaterThan(few + 1);
    expect(few).toBe(4);
    expect(many).toBe(40);
    inst.dispose();
  });
});
