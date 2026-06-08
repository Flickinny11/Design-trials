import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { candleFlamePrimitive } from '@/lib/prism/animatable/primitives/candle-flame';
import { makeTarget, runConformance } from './_conformance';

type Uniforms = {
  uTime: { value: number };
  uFlicker: { value: number };
  uSize: { value: number };
  uWarmth: { value: number };
};

describe('candle-flame primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(candleFlamePrimitive).dispose();
  });

  it('plays: seeking advances the time uniform and installs a node material', () => {
    // PURE SHADER: pixels cannot be read headlessly. Observe the time uniform's
    // .value advancing across the timeline + the node material being installed.
    const target = makeTarget(candleFlamePrimitive);
    const inst = candleFlamePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { colorNode?: unknown; opacityNode?: unknown };
    const u = target.userData.candleFlame as Uniforms;

    expect(mat.colorNode).toBeTruthy();
    expect(mat.opacityNode).toBeTruthy();
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const tEarly = u.uTime.value;
    inst.seek(1.5);
    const tMid = u.uTime.value;
    inst.seek(3.2);
    const tLate = u.uTime.value;

    // The flicker clock advances with seek — a mid frame differs from t=0 and
    // from a later frame (looping/continuous primitive).
    expect(tEarly).toBe(0);
    expect(tMid).toBeGreaterThan(tEarly);
    expect(tLate).toBeGreaterThan(tMid);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { colorNode?: unknown }).colorNode).toBeFalsy();
  });

  it('controls: warmth extremes change the resolved uniform output', () => {
    const target = makeTarget(candleFlamePrimitive);
    const inst = candleFlamePrimitive.create(target);
    const u = target.userData.candleFlame as Uniforms;

    inst.setControl('warmth', 0);
    inst.seek(0.5);
    const cold = u.uWarmth.value;

    inst.setControl('warmth', 1);
    inst.seek(0.5);
    const hot = u.uWarmth.value;

    expect(cold).toBe(0);
    expect(hot).toBe(1);
    expect(hot).toBeGreaterThan(cold + 0.5);

    // size knob also flows through to its live uniform.
    inst.setControl('size', 0.3);
    inst.seek(0.5);
    const small = u.uSize.value;
    inst.setControl('size', 1.6);
    inst.seek(0.5);
    const large = u.uSize.value;
    expect(large).toBeGreaterThan(small + 0.5);

    inst.dispose();
  });
});
