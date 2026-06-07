import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { fresnelGlowPrimitive } from '@/lib/prism/animatable/primitives/fresnel-glow';
import { makeTarget, runConformance } from './_conformance';

describe('fresnel-glow primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fresnelGlowPrimitive).dispose();
  });

  it('plays: the sphere rotates measurably across the timeline', () => {
    const target = makeTarget(fresnelGlowPrimitive);
    const inst = fresnelGlowPrimitive.create(target);
    const subject = target.subject as Mesh;
    inst.seek(0);
    const at0 = subject.rotation.y;
    inst.seek(1);
    const at1 = subject.rotation.y;
    expect(Math.abs(at1 - at0)).toBeGreaterThan(0.1);
    inst.dispose();
  });

  it('controls: power knob updates the resolved param', () => {
    const target = makeTarget(fresnelGlowPrimitive);
    const inst = fresnelGlowPrimitive.create(target);
    inst.setControl('power', 5);
    expect(inst.getParams().power).toBe(5);
    inst.seek(0.5);
    inst.dispose();
  });

  it('dispose: restores the host rotation', () => {
    const target = makeTarget(fresnelGlowPrimitive);
    const inst = fresnelGlowPrimitive.create(target);
    const subject = target.subject as Mesh;
    const base = subject.rotation.y;
    inst.seek(2);
    expect(subject.rotation.y).not.toBe(base);
    inst.dispose();
    expect(subject.rotation.y).toBe(base);
  });
});
