import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { liquidGlassPrimitive } from '@/lib/prism/animatable/primitives/liquid-glass';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };
type LiquidGlassScratch = { uTime: Uniform; uFlow: Uniform; uViscosity: Uniform };

describe('liquid-glass primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(liquidGlassPrimitive).dispose();
  });

  it('plays: the driven time uniform advances across the timeline', () => {
    const target = makeTarget(liquidGlassPrimitive);
    const inst = liquidGlassPrimitive.create(target);
    const scratch = target.userData.liquidGlass as LiquidGlassScratch;

    // Looping primitive (duration === Infinity): pick two distinct t values and
    // assert the driven uTime uniform tracks seek time — a concrete, CPU-
    // observable numeric change between an early frame and a later frame.
    inst.seek(0);
    const tEarly = scratch.uTime.value;

    inst.seek(2.75);
    const tLate = scratch.uTime.value;

    expect(tEarly).toBeCloseTo(0, 5);
    expect(tLate).toBeCloseTo(2.75, 5);
    expect(tLate).toBeGreaterThan(tEarly + 1);

    // It is a continuous/stateful effect.
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('controls change output: viscosity knob extremes change the lobe-scale uniform', () => {
    const target = makeTarget(liquidGlassPrimitive);
    const inst = liquidGlassPrimitive.create(target);
    const scratch = target.userData.liquidGlass as LiquidGlassScratch;

    inst.setControl('viscosity', 0.5);
    inst.seek(0);
    const low = scratch.uViscosity.value;

    inst.setControl('viscosity', 8);
    inst.seek(0);
    const high = scratch.uViscosity.value;

    expect(high).toBeGreaterThan(low + 1);
    inst.dispose();
  });

  it('controls change output: ior knob extremes alter the material ior', () => {
    const target = makeTarget(liquidGlassPrimitive);
    const inst = liquidGlassPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { ior: number };

    inst.setControl('ior', 1.0);
    inst.seek(0);
    const low = mat.ior;

    inst.setControl('ior', 2.4);
    inst.seek(0);
    const high = mat.ior;

    expect(high).toBeGreaterThan(low + 0.5);
    inst.dispose();
  });
});
