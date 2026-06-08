import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { spiralInPrimitive } from '@/lib/prism/animatable/primitives/spiral-in';
import { makeTarget, runConformance } from './_conformance';

describe('spiral-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(spiralInPrimitive).dispose();
  });

  it('plays: spirals inward while scale grows and opacity rises', () => {
    const target = makeTarget(spiralInPrimitive);
    const inst = spiralInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const radius0 = Math.hypot(mesh.position.x, mesh.position.y);
    const scale0 = mesh.scale.x;
    const op0 = mat.opacity;

    inst.seek(dur);
    const radiusEnd = Math.hypot(mesh.position.x, mesh.position.y);
    const scaleEnd = mesh.scale.x;
    const opEnd = mat.opacity;

    // spirals inward: initial radius large, settles near origin
    expect(radius0).toBeGreaterThan(radiusEnd + 0.5);
    // scale grows from ~0.2 toward 1
    expect(scaleEnd).toBeGreaterThan(scale0 + 0.3);
    // opacity rises
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger startRadius means larger initial offset', () => {
    const target = makeTarget(spiralInPrimitive);
    const inst = spiralInPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('startRadius', 2);
    inst.seek(0);
    const small = Math.hypot(mesh.position.x, mesh.position.y);

    inst.setControl('startRadius', 8);
    inst.seek(0);
    const large = Math.hypot(mesh.position.x, mesh.position.y);

    expect(large).toBeGreaterThan(small + 0.5);
    inst.dispose();
  });
});
