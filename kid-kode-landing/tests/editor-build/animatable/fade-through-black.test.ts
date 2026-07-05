import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { fadeThroughBlackPrimitive } from '@/lib/prism/animatable/primitives/fade-through-black';
import { makeTarget, runConformance } from './_conformance';

describe('fade-through-black primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fadeThroughBlackPrimitive).dispose();
  });

  it('plays: opacity dips below the start value at the midpoint', () => {
    const target = makeTarget(fadeThroughBlackPrimitive);
    const inst = fadeThroughBlackPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const opStart = mat.opacity;

    inst.seek(dur / 2);
    const opMid = mat.opacity;

    inst.seek(dur);
    const opEnd = mat.opacity;

    // V dip: midpoint is darker than both ends.
    expect(opMid).toBeLessThan(opStart - 0.2);
    expect(opMid).toBeLessThan(opEnd - 0.2);
    // ends sit at full opacity.
    expect(opStart).toBeGreaterThan(0.9);
    expect(opEnd).toBeGreaterThan(0.9);
    inst.dispose();
  });

  it('controls change output: a deeper dip lowers the midpoint opacity', () => {
    const target = makeTarget(fadeThroughBlackPrimitive);
    const inst = fadeThroughBlackPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.setControl('dip', 0.9);
    inst.seek(dur / 2);
    const shallow = mat.opacity;

    inst.setControl('dip', 0);
    inst.seek(dur / 2);
    const deep = mat.opacity;

    // dip=0 fades to near-black at the midpoint; dip=0.9 barely dips.
    expect(shallow).toBeGreaterThan(deep + 0.3);
    inst.dispose();
  });
});
