import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { willOWispPrimitive } from '@/lib/prism/animatable/primitives/will-o-wisp';
import { makeTarget, runConformance } from './_conformance';

type WispUniforms = {
  uTime: { value: number };
  uDrift: { value: number };
  uGlow: { value: number };
  uCount: { value: number };
};

describe('will-o-wisp primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(willOWispPrimitive).dispose();
  });

  it('plays: installs a node material and the time uniform advances across seeks', () => {
    // PURE SHADER (volumetric glow): pixels cannot be read headlessly. The
    // orbs' drift/pulse is driven entirely by the uTime uniform, so a concrete
    // numeric change between an early and a late frame is the uTime value.
    const target = makeTarget(willOWispPrimitive);
    const inst = willOWispPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { colorNode?: unknown; opacityNode?: unknown };
    expect(mat.colorNode).toBeTruthy();
    expect(mat.opacityNode).toBeTruthy();

    const u = target.userData.wispUniforms as WispUniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(2.5);
    const tMid = u.uTime.value;

    inst.seek(5);
    const tLate = u.uTime.value;

    // A mid-animation frame differs from t=0 and from a later frame.
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    // Looping/stateful effect -> infinite duration so it animates across all t.
    expect(inst.duration()).toBe(Infinity);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { colorNode?: unknown }).colorNode).toBeFalsy();
  });

  it('controls: glowSize extremes change the live falloff uniform', () => {
    const target = makeTarget(willOWispPrimitive);
    const inst = willOWispPrimitive.create(target);
    const u = target.userData.wispUniforms as WispUniforms;

    inst.setControl('glowSize', 0.05);
    inst.seek(1);
    const small = u.uGlow.value;

    inst.setControl('glowSize', 0.3);
    inst.seek(1);
    const large = u.uGlow.value;

    expect(large).toBeGreaterThan(small + 0.2);
    expect(inst.getParams().glowSize).toBe(0.3);
    inst.dispose();
  });
});
