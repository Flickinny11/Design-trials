import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { accordionYPrimitive } from '@/lib/prism/animatable/primitives/accordion-y';
import { makeTarget, runConformance } from './_conformance';

describe('accordion-y primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(accordionYPrimitive).dispose();
  });

  it('plays: scale.y grows from a thin band and overshoots >1 mid-phase while opacity rises', () => {
    const target = makeTarget(accordionYPrimitive);
    const inst = accordionYPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();
    const base = mesh.scale.y;

    inst.seek(0);
    const sy0 = mesh.scale.y;
    const op0 = mat.opacity;

    // Sample across the back half where backOut overshoots past 1.
    let maxScale = -Infinity;
    for (let i = 1; i <= 12; i++) {
      inst.seek((i / 12) * dur);
      maxScale = Math.max(maxScale, mesh.scale.y);
    }

    inst.seek(dur);
    const opEnd = mat.opacity;

    // starts as a thin band
    expect(sy0).toBeLessThan(base * 0.2);
    // springy overshoot: scale.y exceeds full height at some mid frame
    expect(maxScale).toBeGreaterThan(base * 1.0001);
    // opacity rises
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger wobble means larger rotation.x deflection', () => {
    const target = makeTarget(accordionYPrimitive);
    const inst = accordionYPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const baseRot = mesh.rotation.x;
    // Mid phase where the wobble term is non-zero.
    const tMid = inst.duration() * 0.25;

    inst.setControl('wobble', 0);
    inst.seek(tMid);
    const small = Math.abs(mesh.rotation.x - baseRot);

    inst.setControl('wobble', 0.4);
    inst.seek(tMid);
    const large = Math.abs(mesh.rotation.x - baseRot);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
