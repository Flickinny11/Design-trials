import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { blurSpinPrimitive } from '@/lib/prism/animatable/primitives/blur-spin';
import { makeTarget, runConformance } from './_conformance';

describe('blur-spin primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(blurSpinPrimitive).dispose();
  });

  it('plays: rotation.z and scale ease toward the settled state', () => {
    const target = makeTarget(blurSpinPrimitive);
    const inst = blurSpinPrimitive.create(target);
    const subject = target.subject as Mesh;
    const mat = subject.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const rot0 = subject.rotation.z;
    const scale0 = subject.scale.x;
    const op0 = mat.opacity;

    inst.seek(dur);
    const rotEnd = subject.rotation.z;
    const scaleEnd = subject.scale.x;
    const opEnd = mat.opacity;

    // Starts spun (large |rotation.z|), ends settled near 0.
    expect(Math.abs(rot0)).toBeGreaterThan(Math.abs(rotEnd) + 1.0);
    // Scale grows 0.6 -> 1 across the eased phase.
    expect(scaleEnd).toBeGreaterThan(scale0 + 0.2);
    // Main opacity rises 0 -> 1.
    expect(opEnd).toBeGreaterThan(op0 + 0.5);

    inst.dispose();
  });

  it('controls change output: more turns means a larger initial rotation', () => {
    const target = makeTarget(blurSpinPrimitive);
    const inst = blurSpinPrimitive.create(target);
    const subject = target.subject as Mesh;

    inst.setControl('turns', 0.5);
    inst.seek(0);
    const small = Math.abs(subject.rotation.z);

    inst.setControl('turns', 3);
    inst.seek(0);
    const large = Math.abs(subject.rotation.z);

    expect(large).toBeGreaterThan(small + 1.0);

    inst.dispose();
  });
});
