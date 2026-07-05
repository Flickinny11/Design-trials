import { describe, it, expect } from 'vitest';
import { flutedGlassPrimitive } from '@/lib/prism/animatable/primitives/fluted-glass';
import { makeTarget, runConformance } from './_conformance';

type FlutedUniforms = {
  uTime: { value: number };
  uFlutes: { value: number };
  uFluteDepth: { value: number };
};

describe('fluted-glass primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(flutedGlassPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(flutedGlassPrimitive);
    const inst = flutedGlassPrimitive.create(target);
    const u = target.userData.flutedGlass as FlutedUniforms;

    inst.seek(0);
    const early = u.uTime.value;

    inst.seek(1.5);
    const mid = u.uTime.value;

    inst.seek(3.2);
    const late = u.uTime.value;

    // looping/stateful effect: time uniform drives continuous motion, distinct
    // at distinct t values.
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(mid);
    inst.dispose();
  });

  it('controls change output: flute count extremes differ', () => {
    const target = makeTarget(flutedGlassPrimitive);
    const inst = flutedGlassPrimitive.create(target);
    const u = target.userData.flutedGlass as FlutedUniforms;

    inst.setControl('flutes', 6);
    inst.seek(0.5);
    const few = u.uFlutes.value;

    inst.setControl('flutes', 40);
    inst.seek(0.5);
    const many = u.uFlutes.value;

    expect(many).toBeGreaterThan(few + 1);
    inst.dispose();
  });
});
