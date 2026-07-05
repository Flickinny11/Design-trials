import { describe, it, expect } from 'vitest';
import { Mesh, type MeshStandardMaterial } from 'three';
import { scrollColorShiftPrimitive } from '@/lib/prism/animatable/primitives/scroll-color-shift';
import { makeTarget, runConformance } from './_conformance';

describe('scroll-color-shift primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollColorShiftPrimitive).dispose();
  });

  it('plays: scroll drives emissiveIntensity and shifts the material hue', () => {
    const target = makeTarget(scrollColorShiftPrimitive);
    const inst = scrollColorShiftPrimitive.create(target);
    const mat = (target.subject as Mesh).material as MeshStandardMaterial;

    target.userData.scroll = 0;
    inst.seek(0);
    const glowLo = mat.emissiveIntensity;
    const hueLo = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(hueLo);

    target.userData.scroll = 1;
    inst.seek(0);
    const glowHi = mat.emissiveIntensity;
    const hueHi = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(hueHi);

    // emissiveIntensity rises with scroll, and observable tracks it on userData.
    expect(glowHi).toBeGreaterThan(glowLo + 0.3);
    expect(target.userData.emissiveIntensity).toBeCloseTo(glowHi, 5);
    // hue is swept around the wheel by scroll.
    expect(Math.abs(hueHi.h - hueLo.h)).toBeGreaterThan(0.05);
    inst.dispose();
  });

  it('controls change output: larger hiGlow yields larger glow at full scroll', () => {
    const target = makeTarget(scrollColorShiftPrimitive);
    const inst = scrollColorShiftPrimitive.create(target);
    const mat = (target.subject as Mesh).material as MeshStandardMaterial;

    target.userData.scroll = 1;

    inst.setControl('hiGlow', 0.5);
    inst.seek(0);
    const low = mat.emissiveIntensity;

    inst.setControl('hiGlow', 3);
    inst.seek(0);
    const high = mat.emissiveIntensity;

    expect(high).toBeGreaterThan(low + 0.5);
    inst.dispose();
  });
});
