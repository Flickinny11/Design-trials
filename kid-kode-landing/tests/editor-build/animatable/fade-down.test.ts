import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { fadeDownPrimitive } from '@/lib/prism/animatable/primitives/fade-down';
import { makeTarget, runConformance } from './_conformance';

describe('fade-down primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fadeDownPrimitive).dispose();
  });

  it('plays: opacity rises while position.y drifts downward into place', () => {
    const target = makeTarget(fadeDownPrimitive);
    const inst = fadeDownPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const y0 = mesh.position.y;
    const op0 = mat.opacity;

    inst.seek(dur);
    const yDur = mesh.position.y;
    const opDur = mat.opacity;

    // starts raised above its settle position, ends lower (drifts down).
    expect(y0).toBeGreaterThan(yDur + 0.3);
    // opacity rises across the eased phase.
    expect(opDur).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger drop means larger initial rise', () => {
    const target = makeTarget(fadeDownPrimitive);
    const inst = fadeDownPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const base = mesh.position.y;

    inst.setControl('drop', 0.2);
    inst.seek(0);
    const small = mesh.position.y - base;

    inst.setControl('drop', 3);
    inst.seek(0);
    const large = mesh.position.y - base;

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
