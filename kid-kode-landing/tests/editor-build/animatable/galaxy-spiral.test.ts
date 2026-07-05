import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { galaxySpiralPrimitive } from '@/lib/prism/animatable/primitives/galaxy-spiral';
import { makeTarget, runConformance } from './_conformance';

// The primitive exposes its driven uniform handles on target.userData so the
// animation's CPU-observable state (uniform .value) is readable headlessly.
type GalaxyUniforms = {
  uTime: { value: number };
  uSpin: { value: number };
  uArms: { value: number };
  uWinding: { value: number };
};

describe('galaxy-spiral primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(galaxySpiralPrimitive).dispose();
  });

  it('plays: seeking advances the driven time uniform across the timeline', () => {
    const target = makeTarget(galaxySpiralPrimitive);
    const mesh = target.subject as Mesh;
    const baseMat = mesh.material;
    const inst = galaxySpiralPrimitive.create(target);

    // Material swapped to the node material.
    expect(mesh.material).not.toBe(baseMat);
    // Looping primitive.
    expect(inst.duration()).toBe(Infinity);

    const u = target.userData.galaxySpiral as GalaxyUniforms;

    inst.seek(0);
    const early = u.uTime.value;

    inst.seek(1.5);
    const mid = u.uTime.value;

    inst.seek(3.0);
    const late = u.uTime.value;

    // The time uniform that drives the rotating spiral advances with seek(t):
    // an early frame differs from a mid frame and a late frame.
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(mid);
    expect(early).toBe(0);
    expect(late).toBe(3.0);

    inst.dispose();
    // dispose restores the original material.
    expect(mesh.material).toBe(baseMat);
  });

  it('controls change output: arms knob drives the arms uniform to its extremes', () => {
    const target = makeTarget(galaxySpiralPrimitive);
    const inst = galaxySpiralPrimitive.create(target);
    const u = target.userData.galaxySpiral as GalaxyUniforms;

    inst.setControl('arms', 2);
    inst.seek(0.5);
    const low = u.uArms.value;

    inst.setControl('arms', 6);
    inst.seek(0.5);
    const high = u.uArms.value;

    expect(low).toBe(2);
    expect(high).toBe(6);
    expect(high).toBeGreaterThan(low + 1);
    inst.dispose();
  });
});
