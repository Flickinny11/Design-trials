import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { bouncePrimitive } from '@/lib/prism/animatable/primitives/bounce';
import { makeTarget, runConformance } from './_conformance';

describe('bounce primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(bouncePrimitive).dispose();
  });

  it('plays: card drops from above and settles to base while opacity rises', () => {
    const target = makeTarget(bouncePrimitive);
    const inst = bouncePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();
    const baseY = mesh.position.y;

    inst.seek(0);
    const y0 = mesh.position.y;
    const op0 = mat.opacity;

    inst.seek(dur);
    const yEnd = mesh.position.y;
    const opEnd = mat.opacity;

    // starts well above base, ends at base
    expect(y0).toBeGreaterThan(yEnd + 0.5);
    expect(Math.abs(yEnd - baseY)).toBeLessThan(0.001);
    // opacity rises across the phase
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger drop height means larger initial offset', () => {
    const target = makeTarget(bouncePrimitive);
    const inst = bouncePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const baseY = mesh.position.y;

    inst.setControl('height', 1);
    inst.seek(0);
    const small = mesh.position.y - baseY;

    inst.setControl('height', 5);
    inst.seek(0);
    const large = mesh.position.y - baseY;

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
