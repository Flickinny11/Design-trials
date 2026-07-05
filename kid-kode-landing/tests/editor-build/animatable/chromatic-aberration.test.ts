import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { chromaticAberrationPrimitive } from '@/lib/prism/animatable/primitives/chromatic-aberration';
import { makeTarget, runConformance } from './_conformance';

// CPU-observable state for this transmissive-glass primitive is the live
// MeshPhysicalNodeMaterial's `ior`/`thickness` fields (driven from uniforms in
// seek). Transmission/refraction itself is GPU-only, so we assert on those
// physical fields — never on rendered pixels (flagRealGpu=true).
function physMat(target: ReturnType<typeof makeTarget>) {
  const mesh = target.subject as Mesh;
  return mesh.material as unknown as { ior: number; thickness: number };
}

describe('chromatic-aberration primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(chromaticAberrationPrimitive).dispose();
  });

  it('plays: ior breathes — an early frame differs from a mid frame', () => {
    const target = makeTarget(chromaticAberrationPrimitive);
    const inst = chromaticAberrationPrimitive.create(target);
    const mat = physMat(target);

    // Looping/stateful (duration === Infinity): pick two distinct t values.
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const iorEarly = mat.ior;

    inst.seek(1.2); // sin(1.3*1.2) ≈ sin(1.56) ≈ 1 → near-peak breathing
    const iorMid = mat.ior;

    // A concrete numeric change between an early frame and a mid frame.
    expect(Math.abs(iorMid - iorEarly)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: larger IOR fader raises the material ior', () => {
    const target = makeTarget(chromaticAberrationPrimitive);
    const inst = chromaticAberrationPrimitive.create(target);
    const mat = physMat(target);

    inst.setControl('ior', 1.1);
    inst.seek(0);
    const low = mat.ior;

    inst.setControl('ior', 2.0);
    inst.seek(0);
    const high = mat.ior;

    expect(high).toBeGreaterThan(low + 0.5);
    inst.dispose();
  });

  it('dispose restores the original material', () => {
    const target = makeTarget(chromaticAberrationPrimitive);
    const mesh = target.subject as Mesh;
    const before = mesh.material;
    const inst = chromaticAberrationPrimitive.create(target);
    expect(mesh.material).not.toBe(before);
    inst.dispose();
    expect(mesh.material).toBe(before);
  });
});
