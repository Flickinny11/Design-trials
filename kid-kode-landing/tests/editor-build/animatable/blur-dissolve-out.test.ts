import { describe, it, expect } from 'vitest';
import { Mesh, MeshStandardMaterial, type Material } from 'three';
import { blurDissolveOutPrimitive } from '@/lib/prism/animatable/primitives/blur-dissolve-out';
import { makeTarget, runConformance } from './_conformance';

describe('blur-dissolve-out primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(blurDissolveOutPrimitive).dispose();
  });

  it('plays: subject swells while opacity drops across phase', () => {
    const target = makeTarget(blurDissolveOutPrimitive);
    const inst = blurDissolveOutPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const scale0 = mesh.scale.x;
    const op0 = mat.opacity;

    inst.seek(dur * 0.9);
    const scaleLate = mesh.scale.x;
    const opLate = mat.opacity;

    // scale swells outward across the timeline
    expect(scaleLate).toBeGreaterThan(scale0 + 0.05);
    // opacity drops toward zero as it dissolves
    expect(opLate).toBeLessThan(op0 - 0.3);
    inst.dispose();
  });

  it('controls change output: larger blurGrow means larger late-phase swell', () => {
    const target = makeTarget(blurDissolveOutPrimitive);
    const inst = blurDissolveOutPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    inst.setControl('blurGrow', 0);
    inst.seek(dur * 0.9);
    const small = mesh.scale.x;

    inst.setControl('blurGrow', 0.6);
    inst.seek(dur * 0.9);
    const large = mesh.scale.x;

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });

  it('bloom control raises emissive intensity mid-animation', () => {
    const target = makeTarget(blurDissolveOutPrimitive);
    const inst = blurDissolveOutPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as MeshStandardMaterial;
    const dur = inst.duration();

    inst.setControl('bloom', 0);
    inst.seek(dur * 0.5);
    const noBloom = mat.emissiveIntensity;

    inst.setControl('bloom', 2);
    inst.seek(dur * 0.5);
    const withBloom = mat.emissiveIntensity;

    expect(withBloom).toBeGreaterThan(noBloom + 0.5);
    inst.dispose();
  });
});
