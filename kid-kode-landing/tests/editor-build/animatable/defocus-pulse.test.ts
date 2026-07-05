import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { defocusPulsePrimitive } from '@/lib/prism/animatable/primitives/defocus-pulse';
import { makeTarget, runConformance } from './_conformance';

describe('defocus-pulse primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(defocusPulsePrimitive).dispose();
  });

  it('plays: scale and opacity differ across two distinct loop frames', () => {
    const target = makeTarget(defocusPulsePrimitive);
    const inst = defocusPulsePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };

    expect(inst.duration()).toBe(Infinity);

    // speed default 2 → period 2*PI/2 = PI s. t=0 is a focused midpoint
    // (f=0.5); t at peak defocus (sin=-1) gives a distinct scale/opacity.
    inst.seek(0);
    const scale0 = mesh.scale.x;
    const op0 = mat.opacity;

    // t where sin(t*speed) = -1  →  t*2 = 3*PI/2  →  t = 3*PI/4
    inst.seek((3 * Math.PI) / 4);
    const scaleDefocus = mesh.scale.x;
    const opDefocus = mat.opacity;

    // defocused frame is larger (overscale) and dimmer (opacity pulse).
    expect(Math.abs(scaleDefocus - scale0)).toBeGreaterThan(0.01);
    expect(op0 - opDefocus).toBeGreaterThan(0.05);
    inst.dispose();
  });

  it('controls change output: larger overscale means larger defocus scale', () => {
    const target = makeTarget(defocusPulsePrimitive);
    const inst = defocusPulsePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const tDefocus = (3 * Math.PI) / 4; // peak defocus at default speed

    inst.setControl('overscale', 0);
    inst.seek(tDefocus);
    const small = mesh.scale.x;

    inst.setControl('overscale', 0.3);
    inst.seek(tDefocus);
    const large = mesh.scale.x;

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
