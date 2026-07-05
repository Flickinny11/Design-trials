import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { zoomRotateInPrimitive } from '@/lib/prism/animatable/primitives/zoom-rotate-in';
import { makeTarget, runConformance } from './_conformance';

describe('zoom-rotate-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(zoomRotateInPrimitive).dispose();
  });

  it('plays: scale grows and rotation.z decreases while opacity rises', () => {
    const target = makeTarget(zoomRotateInPrimitive);
    const inst = zoomRotateInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const scale0 = mesh.scale.x;
    const rot0 = Math.abs(mesh.rotation.z);
    const op0 = mat.opacity;

    // Mid frame: spin still wound up, scale partway up.
    inst.seek(dur * 0.4);
    const scaleMid = mesh.scale.x;
    const rotMid = Math.abs(mesh.rotation.z);

    inst.seek(dur);
    const scaleEnd = mesh.scale.x;
    const rotEnd = Math.abs(mesh.rotation.z);
    const opEnd = mat.opacity;

    // Scale grows from ~0; mid is well up from start; end settles near 1
    // (backOut + overshoot bump can peak above 1 mid-animation, then resolve).
    expect(scale0).toBeLessThan(0.05);
    expect(scaleMid).toBeGreaterThan(scale0 + 0.1);
    expect(scaleEnd).toBeGreaterThan(0.9);
    expect(scaleEnd).toBeLessThan(1.05);

    // rotation.z decreases (full-turn wind-up resolving to ~0).
    expect(rot0).toBeGreaterThan(rotMid + 0.1);
    expect(rotMid).toBeGreaterThan(rotEnd);
    expect(rotEnd).toBeLessThan(0.05);

    // Opacity rises.
    expect(opEnd).toBeGreaterThan(op0);

    inst.dispose();
  });

  it('controls change output: more turns means a larger initial rotation', () => {
    const target = makeTarget(zoomRotateInPrimitive);
    const inst = zoomRotateInPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('turns', 0.25);
    inst.seek(0);
    const small = Math.abs(mesh.rotation.z);

    inst.setControl('turns', 2);
    inst.seek(0);
    const large = Math.abs(mesh.rotation.z);

    expect(large).toBeGreaterThan(small + 1);
    inst.dispose();
  });
});
