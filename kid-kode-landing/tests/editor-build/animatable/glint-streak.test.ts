import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { glintStreakPrimitive } from '@/lib/prism/animatable/primitives/glint-streak';
import { makeTarget, runConformance } from './_conformance';

type GlintUniforms = {
  uTime: { value: number };
  uHotX: { value: number };
  uHotY: { value: number };
};

describe('glint-streak primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(glintStreakPrimitive).dispose();
  });

  it('plays: seeking advances uTime and slides the hotspot, and installs an emissiveNode', () => {
    // PURE SHADER: pixels cannot be read headlessly. Assert on the uniform
    // handles the primitive publishes (CPU-observable) + the swapped node material.
    const target = makeTarget(glintStreakPrimitive);
    const inst = glintStreakPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { emissiveNode?: unknown };
    expect(mat.emissiveNode).toBeTruthy();

    const u = target.userData.glintStreak as GlintUniforms;

    inst.seek(0);
    const time0 = u.uTime.value;
    const hot0 = u.uHotY.value;

    inst.seek(1.3);
    const timeMid = u.uTime.value;
    const hotMid = u.uHotY.value;

    // uTime advances with the clock.
    expect(timeMid).toBeGreaterThan(time0 + 0.5);
    // the hotspot travels (vertical position differs from the start frame).
    expect(Math.abs(hotMid - hot0)).toBeGreaterThan(0.01);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { emissiveNode?: unknown }).emissiveNode).toBeFalsy();
  });

  it('controls: speed changes how far the hotspot travels by a fixed time', () => {
    const target = makeTarget(glintStreakPrimitive);
    const inst = glintStreakPrimitive.create(target);
    const u = target.userData.glintStreak as GlintUniforms;

    inst.setControl('speed', 0.1);
    inst.seek(0);
    const slowStart = u.uHotY.value;
    inst.seek(1.0);
    const slowTravel = Math.abs(u.uHotY.value - slowStart);

    inst.setControl('speed', 4);
    inst.seek(0);
    const fastStart = u.uHotY.value;
    inst.seek(1.0);
    const fastTravel = Math.abs(u.uHotY.value - fastStart);

    // Faster speed moves the hotspot a different (larger over this window) amount.
    expect(fastTravel).not.toBeCloseTo(slowTravel, 2);
    inst.dispose();
  });
});
