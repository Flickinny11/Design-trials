import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { overshootPrimitive } from '@/lib/prism/animatable/primitives/overshoot';
import { makeTarget, runConformance } from './_conformance';

describe('overshoot primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(overshootPrimitive).dispose();
  });

  it('plays: slides in from -distance, overshoots past target, opacity rises', () => {
    const target = makeTarget(overshootPrimitive);
    const inst = overshootPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    // angle 0 keeps motion on the +/- x axis for clean observation.
    inst.setControl('angleDeg', 0);

    inst.seek(0);
    const x0 = mesh.position.x;
    const op0 = mat.opacity;

    // late mid-phase: backOut has overshot past the target (x > 0).
    inst.seek(dur * 0.7);
    const xMid = mesh.position.x;

    inst.seek(dur);
    const xEnd = mesh.position.x;
    const opEnd = mat.opacity;

    // starts offset negative (slides in from -distance)
    expect(x0).toBeLessThan(-0.5);
    // overshoots: mid-phase position travels PAST the settled target
    expect(xMid).toBeGreaterThan(xEnd + 0.05);
    // settles back at ~origin
    expect(Math.abs(xEnd)).toBeLessThan(0.01);
    // opacity rises across the phase
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger distance means larger initial offset', () => {
    const target = makeTarget(overshootPrimitive);
    const inst = overshootPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('angleDeg', 0);

    inst.setControl('distance', 0.5);
    inst.seek(0);
    const small = Math.abs(mesh.position.x);

    inst.setControl('distance', 4);
    inst.seek(0);
    const large = Math.abs(mesh.position.x);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
