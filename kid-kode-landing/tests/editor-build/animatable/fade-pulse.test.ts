import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { fadePulsePrimitive } from '@/lib/prism/animatable/primitives/fade-pulse';
import { makeTarget, runConformance } from './_conformance';

describe('fade-pulse primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fadePulsePrimitive).dispose();
  });

  it('plays: opacity breathes between two distinct loop phases', () => {
    const target = makeTarget(fadePulsePrimitive);
    const inst = fadePulsePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };

    expect(inst.duration()).toBe(Infinity);

    // speed default 1.4 → sin(t*1.4). Trough near t where sin = -1
    // (t*1.4 = 3π/2 → t ≈ 3.366), crest where sin = +1 (t*1.4 = π/2 → t ≈ 1.122).
    inst.seek(1.122); // crest → near full opacity
    const opCrest = mat.opacity;
    inst.seek(3.366); // trough → near minOpacity
    const opTrough = mat.opacity;

    // Opacity is observably different at two distinct t, and crest > trough.
    expect(opCrest).toBeGreaterThan(opTrough + 0.1);
    // Crest reaches near full, trough drops toward the floor.
    expect(opCrest).toBeGreaterThan(0.9);
    expect(opTrough).toBeLessThan(0.6);
    inst.dispose();
  });

  it('controls change output: lower minOpacity deepens the trough', () => {
    const target = makeTarget(fadePulsePrimitive);
    const inst = fadePulsePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };

    // Trough time for default speed 1.4.
    const trough = 3.366;

    inst.setControl('minOpacity', 0.9);
    inst.seek(trough);
    const highFloor = mat.opacity;

    inst.setControl('minOpacity', 0.2);
    inst.seek(trough);
    const lowFloor = mat.opacity;

    expect(highFloor).toBeGreaterThan(lowFloor + 0.3);
    inst.dispose();
  });
});
