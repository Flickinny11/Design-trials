import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { fadeInOutPrimitive } from '@/lib/prism/animatable/primitives/fade-in-out';
import { makeTarget, runConformance } from './_conformance';

describe('fade-in-out primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fadeInOutPrimitive).dispose();
  });

  it('plays: opacity peaks at mid and is ~0 at start and end', () => {
    const target = makeTarget(fadeInOutPrimitive);
    const inst = fadeInOutPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const op0 = mat.opacity;

    inst.seek(dur / 2);
    const opMid = mat.opacity;

    inst.seek(dur);
    const opEnd = mat.opacity;

    // appear-and-vanish: ~0 at both ends, peaks in the middle
    expect(op0).toBeLessThan(0.05);
    expect(opEnd).toBeLessThan(0.05);
    expect(opMid).toBeGreaterThan(op0 + 0.5);
    expect(opMid).toBeGreaterThan(opEnd + 0.5);
    inst.dispose();
  });

  it('controls change output: larger hold means a wider fully-opaque plateau', () => {
    const target = makeTarget(fadeInOutPrimitive);
    const inst = fadeInOutPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    // Sample an off-center point that sits inside the plateau only when hold is wide.
    const tProbe = dur * 0.35;

    inst.setControl('hold', 0);
    inst.seek(tProbe);
    const small = mat.opacity;

    inst.setControl('hold', 0.6);
    inst.seek(tProbe);
    const large = mat.opacity;

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });
});
