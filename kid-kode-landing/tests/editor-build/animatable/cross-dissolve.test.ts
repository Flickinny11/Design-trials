import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { crossDissolvePrimitive } from '@/lib/prism/animatable/primitives/cross-dissolve';
import { makeTarget, runConformance } from './_conformance';

type EmissiveMat = Material & { opacity: number; emissiveIntensity?: number };

describe('cross-dissolve primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(crossDissolvePrimitive).dispose();
  });

  it('plays: opacity dips at mid below the start/end frames', () => {
    const target = makeTarget(crossDissolvePrimitive);
    const inst = crossDissolvePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as EmissiveMat;
    const dur = inst.duration();

    inst.seek(0);
    const opStart = mat.opacity;
    const emStart = mat.emissiveIntensity as number;

    inst.seek(dur / 2);
    const opMid = mat.opacity;
    const emMid = mat.emissiveIntensity as number;

    inst.seek(dur);
    const opEnd = mat.opacity;

    // opacity is full at the ends and clearly lower at the midpoint
    expect(opMid).toBeLessThan(opStart - 0.1);
    expect(opMid).toBeLessThan(opEnd - 0.1);
    // emissive tint dips toward the neutral mid (lower) at the midpoint
    expect(emMid).toBeLessThan(emStart - 0.01);
    inst.dispose();
  });

  it('controls change output: larger dipDepth means a deeper mid-dip', () => {
    const target = makeTarget(crossDissolvePrimitive);
    const inst = crossDissolvePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as EmissiveMat;
    const dur = inst.duration();

    inst.setControl('dipDepth', 0.2);
    inst.seek(dur / 2);
    const shallow = mat.opacity;

    inst.setControl('dipDepth', 0.9);
    inst.seek(dur / 2);
    const deep = mat.opacity;

    // deeper dipDepth pulls the mid-frame opacity lower
    expect(deep).toBeLessThan(shallow - 0.1);
    inst.dispose();
  });
});
