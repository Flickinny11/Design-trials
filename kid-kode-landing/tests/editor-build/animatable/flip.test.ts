import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { flipPrimitive } from '@/lib/prism/animatable/primitives/flip';
import { makeTarget, runConformance } from './_conformance';

describe('flip primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(flipPrimitive).dispose();
  });

  it('plays: rotation eases to facing while opacity rises', () => {
    const target = makeTarget(flipPrimitive);
    const inst = flipPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const rot0 = Math.abs(mesh.rotation.y);
    const op0 = mat.opacity;

    inst.seek(dur);
    const rotDur = Math.abs(mesh.rotation.y);
    const opDur = mat.opacity;

    // starts ~3/4 turn edge-on, ends ~facing the viewer (rotation -> ~0)
    expect(rot0).toBeGreaterThan(rotDur + 0.5);
    // opacity rises across the eased phase
    expect(opDur).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: axis dropdown picks rotation.x vs rotation.y', () => {
    const target = makeTarget(flipPrimitive);
    const inst = flipPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('axis', 'y');
    inst.seek(0);
    const yAxis = Math.abs(mesh.rotation.y);
    const xWhenY = Math.abs(mesh.rotation.x);

    inst.setControl('axis', 'x');
    inst.seek(0);
    const xAxis = Math.abs(mesh.rotation.x);
    const yWhenX = Math.abs(mesh.rotation.y);

    // Y axis drives rotation.y (x stays at base ~0); X axis drives rotation.x.
    expect(yAxis).toBeGreaterThan(xWhenY + 0.5);
    expect(xAxis).toBeGreaterThan(yWhenX + 0.5);
    inst.dispose();
  });
});
