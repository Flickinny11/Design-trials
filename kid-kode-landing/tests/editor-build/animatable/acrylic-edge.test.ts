import { describe, it, expect } from 'vitest';
import { acrylicEdgePrimitive } from '@/lib/prism/animatable/primitives/acrylic-edge';
import { makeTarget, runConformance } from './_conformance';

type EdgeUniforms = {
  uTime: { value: number };
  uGlowWidth: { value: number };
  uIntensity: { value: number };
  uPulse: { value: number };
};

describe('acrylic-edge primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(acrylicEdgePrimitive).dispose();
  });

  it('plays: the edge-glow intensity breathes with the clock', () => {
    const target = makeTarget(acrylicEdgePrimitive);
    const inst = acrylicEdgePrimitive.create(target);
    const u = target.userData.acrylicEdge as EdgeUniforms;

    // pulse = 0.8 + 0.2*sin(t): minimum near t=3π/2, maximum near t=π/2.
    inst.seek(Math.PI * 1.5); // sin = -1 -> 0.6
    const low = u.uPulse.value;

    inst.seek(Math.PI * 0.5); // sin = +1 -> 1.0
    const high = u.uPulse.value;

    expect(u.uTime.value).toBeCloseTo(Math.PI * 0.5, 5);
    expect(high).toBeGreaterThan(low + 0.3);
    inst.dispose();
  });

  it('controls change output: intensity + glow width drive the uniforms', () => {
    const target = makeTarget(acrylicEdgePrimitive);
    const inst = acrylicEdgePrimitive.create(target);
    const u = target.userData.acrylicEdge as EdgeUniforms;

    inst.setControl('intensity', 0);
    inst.seek(1);
    const dim = u.uIntensity.value;

    inst.setControl('intensity', 4);
    inst.seek(1);
    const bright = u.uIntensity.value;

    expect(bright).toBeGreaterThan(dim + 0.5);

    inst.setControl('glowWidth', 0.03);
    inst.seek(1);
    const narrow = u.uGlowWidth.value;

    inst.setControl('glowWidth', 0.3);
    inst.seek(1);
    const wide = u.uGlowWidth.value;

    expect(wide).toBeGreaterThan(narrow + 0.1);
    inst.dispose();
  });
});
