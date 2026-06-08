import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { causticSpotsPrimitive } from '@/lib/prism/animatable/primitives/caustic-spots';
import { makeTarget, runConformance } from './_conformance';

type Uniforms = {
  uTime: { value: number };
  uSpeed: { value: number };
  uRadius: { value: number };
  uSharp: { value: number };
};

const uniformsOf = (mesh: Mesh): Uniforms =>
  ((mesh.material as { userData: Record<string, unknown> }).userData.uniforms as Uniforms);

describe('caustic-spots primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(causticSpotsPrimitive).dispose();
  });

  it('plays: seeking advances the time uniform across the timeline', () => {
    // PURE SHADER: pixels cannot be read headlessly. The spot centers wander
    // as a function of uTime, so an advancing uTime is the CPU-observable proof
    // that mid-animation differs from the start. Looping (duration === Infinity)
    // so we pick two distinct t values.
    const target = makeTarget(causticSpotsPrimitive);
    const inst = causticSpotsPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { colorNode?: unknown; emissiveNode?: unknown };
    expect(mat.colorNode).toBeTruthy();
    expect(mat.emissiveNode).toBeTruthy();
    expect(inst.duration()).toBe(Infinity);

    const u = uniformsOf(mesh);
    inst.seek(0);
    const t0 = u.uTime.value;
    inst.seek(1.7);
    const tMid = u.uTime.value;
    inst.seek(3.4);
    const tLate = u.uTime.value;

    // a mid-animation frame differs from t=0 and from a later frame.
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    expect(tMid - t0).toBeCloseTo(1.7, 5);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { colorNode?: unknown }).colorNode).toBeFalsy();
  });

  it('controls change output: radius extremes drive distinct uniform values', () => {
    const target = makeTarget(causticSpotsPrimitive);
    const inst = causticSpotsPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const u = uniformsOf(mesh);

    inst.setControl('radius', 0.05);
    inst.seek(0.5);
    const small = u.uRadius.value;

    inst.setControl('radius', 0.3);
    inst.seek(0.5);
    const large = u.uRadius.value;

    expect(small).toBeCloseTo(0.05, 5);
    expect(large).toBeCloseTo(0.3, 5);
    expect(large).toBeGreaterThan(small + 0.2);
    expect(inst.getParams().radius).toBe(0.3);

    inst.dispose();
  });
});
