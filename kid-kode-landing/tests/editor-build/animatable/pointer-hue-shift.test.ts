import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { pointerHueShiftPrimitive } from '@/lib/prism/animatable/primitives/pointer-hue-shift';
import { makeTarget, runConformance } from './_conformance';

type MatLike = Material & {
  color: { getHSL: (o: { h: number; s: number; l: number }) => { h: number } };
  emissiveIntensity: number;
};

describe('pointer-hue-shift primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerHueShiftPrimitive).dispose();
  });

  it('plays: pointer.x changes hue and pointer.y changes emissive intensity', () => {
    const target = makeTarget(pointerHueShiftPrimitive);
    const inst = pointerHueShiftPrimitive.create(target);
    const mat = (target.subject as Mesh).material as MatLike;

    // Low pointer: left edge, dim.
    target.userData.pointer = { x: 0.0, y: 0.0 };
    inst.seek(0);
    const hsl0 = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(hsl0);
    const hue0 = hsl0.h;
    const emissive0 = mat.emissiveIntensity;

    // High pointer: right edge, bright.
    target.userData.pointer = { x: 1.0, y: 1.0 };
    inst.seek(0);
    const hsl1 = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(hsl1);
    const hue1 = hsl1.h;
    const emissive1 = mat.emissiveIntensity;

    // pointer.x moved the hue
    expect(Math.abs(hue1 - hue0)).toBeGreaterThan(0.05);
    // pointer.y raised the emissive intensity
    expect(emissive1).toBeGreaterThan(emissive0 + 0.1);

    inst.dispose();
  });

  it('controls change output: larger glow means larger emissive intensity', () => {
    const target = makeTarget(pointerHueShiftPrimitive);
    const inst = pointerHueShiftPrimitive.create(target);
    const mat = (target.subject as Mesh).material as MatLike;

    target.userData.pointer = { x: 0.5, y: 1.0 };

    inst.setControl('glow', 0.5);
    inst.seek(0);
    const lowGlow = mat.emissiveIntensity;

    inst.setControl('glow', 3);
    inst.seek(0);
    const highGlow = mat.emissiveIntensity;

    expect(highGlow).toBeGreaterThan(lowGlow + 0.5);

    inst.dispose();
  });
});
