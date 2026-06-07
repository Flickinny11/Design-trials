import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { slidePrimitive } from '@/lib/prism/animatable/primitives/slide';
import { makeTarget, runConformance } from './_conformance';

describe('slide primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(slidePrimitive).dispose();
  });

  it('plays: position eases to origin while opacity rises', () => {
    const target = makeTarget(slidePrimitive);
    const inst = slidePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const mag0 = Math.hypot(mesh.position.x, mesh.position.y);
    const op0 = mat.opacity;

    inst.seek(dur);
    const magDur = Math.hypot(mesh.position.x, mesh.position.y);
    const opDur = mat.opacity;

    // starts offset by ~distance, ends at ~origin
    expect(mag0).toBeGreaterThan(magDur + 0.3);
    // opacity rises across the eased phase
    expect(opDur).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger distance means larger initial offset', () => {
    const target = makeTarget(slidePrimitive);
    const inst = slidePrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('distance', 0.5);
    inst.seek(0);
    const small = Math.hypot(mesh.position.x, mesh.position.y);

    inst.setControl('distance', 4);
    inst.seek(0);
    const large = Math.hypot(mesh.position.x, mesh.position.y);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
