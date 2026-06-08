import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { hingeFallPrimitive } from '@/lib/prism/animatable/primitives/hinge-fall';
import { makeTarget, runConformance } from './_conformance';

describe('hinge-fall primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(hingeFallPrimitive).dispose();
  });

  it('plays: tips (rotation.z swings) then falls (position.y drops + opacity fades)', () => {
    const target = makeTarget(hingeFallPrimitive);
    const inst = hingeFallPrimitive.create(target);
    const subject = target.subject as Mesh;
    const mat = subject.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const rot0 = subject.rotation.z;
    const y0 = target.object.position.y;
    const op0 = mat.opacity;

    // Mid of the tip window (~0.3 of timeline) — rotation should have swung.
    inst.seek(dur * 0.3);
    const rotMid = subject.rotation.z;

    // End of the timeline — the object has fallen and faded.
    inst.seek(dur);
    const yEnd = target.object.position.y;
    const opEnd = mat.opacity;

    // rotation.z increases (tips over) — absolute swing grows.
    expect(Math.abs(rotMid - rot0)).toBeGreaterThan(0.3);
    // the whole object drops below its resting y in the fall phase.
    expect(yEnd).toBeLessThan(y0 - 0.3);
    // opacity falls off as it leaves.
    expect(opEnd).toBeLessThan(op0 - 0.5);

    inst.dispose();
    // dispose restores the resting transform + opacity.
    expect(subject.rotation.z).toBeCloseTo(rot0, 5);
    expect(mat.opacity).toBeCloseTo(1, 5);
  });

  it('controls change output: larger gravity means a deeper fall', () => {
    const target = makeTarget(hingeFallPrimitive);
    const inst = hingeFallPrimitive.create(target);
    const dur = inst.duration();

    inst.setControl('gravity', 4);
    inst.seek(dur);
    const shallow = target.object.position.y;

    inst.setControl('gravity', 16);
    inst.seek(dur);
    const deep = target.object.position.y;

    // higher gravity falls farther (more negative y).
    expect(deep).toBeLessThan(shallow - 0.3);
    inst.dispose();
  });
});
