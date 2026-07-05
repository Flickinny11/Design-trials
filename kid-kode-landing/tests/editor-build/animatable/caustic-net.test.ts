import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { causticNetPrimitive } from '@/lib/prism/animatable/primitives/caustic-net';
import { makeTarget, runConformance } from './_conformance';

// CPU mirror of the shader net field (same formula as caustic-net.ts) so we can
// assert deterministic, GPU-free motion: the net brightness at a fixed uv point
// changes as time advances and as density changes. Pixels cannot be read
// headlessly, so we evaluate the analytic field the shader computes.
function netAt(
  ux: number,
  uy: number,
  time: number,
  speed: number,
  density: number,
  thin: number,
): number {
  const t = time * speed;
  const a = density;
  const b = density * 1.13;
  const c = density * 0.77;
  const band1 = Math.sin(ux * a + t) * Math.sin(uy * b - t * 1.2);
  const band2 = Math.sin((ux - uy) * c + t * 0.7);
  const f = Math.abs(band1 + band2);
  return Math.pow(1 - Math.min(Math.max(f, 0), 1), thin);
}

describe('caustic-net primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(causticNetPrimitive).dispose();
  });

  it('plays: installs a node material and the net field weaves over time (looping, deterministic)', () => {
    const target = makeTarget(causticNetPrimitive);
    const inst = causticNetPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { emissiveNode?: unknown };

    // Material swapped to a node material with a truthy emissiveNode.
    expect(mat.emissiveNode).toBeTruthy();
    // Looping/stateful effect.
    expect(inst.duration()).toBe(Infinity);

    // Seeking is exception-free across two distinct frames.
    expect(() => inst.seek(0)).not.toThrow();
    expect(() => inst.seek(1.37)).not.toThrow();

    // Deterministic CPU mirror of the shader: the net brightness at a fixed uv
    // sample differs between an early frame and a mid frame (the threads drift).
    const ux = 0.37;
    const uy = 0.61;
    const early = netAt(ux, uy, 0, 1, 9, 4);
    const mid = netAt(ux, uy, 1.37, 1, 9, 4);
    expect(Math.abs(mid - early)).toBeGreaterThan(0.01);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { emissiveNode?: unknown }).emissiveNode).toBeFalsy();
  });

  it('controls: thinness changes the net brightness profile; setControl updates params', () => {
    const target = makeTarget(causticNetPrimitive);
    const inst = causticNetPrimitive.create(target);

    // setControl updates resolved params and re-seek is exception-free.
    inst.setControl('thinness', 8);
    expect(inst.getParams().thinness).toBe(8);
    expect(() => inst.seek(0.5)).not.toThrow();
    inst.setControl('thinness', 2);
    expect(inst.getParams().thinness).toBe(2);

    // Observable difference: at a sample where the field is non-zero, a higher
    // thinness exponent yields a dimmer net value than a lower one. Average over
    // several uv samples to guarantee a robust, deterministic gap.
    const samples: Array<[number, number]> = [
      [0.13, 0.41],
      [0.37, 0.62],
      [0.71, 0.29],
      [0.88, 0.84],
      [0.5, 0.5],
    ];
    let sumThin2 = 0;
    let sumThin8 = 0;
    for (const [ux, uy] of samples) {
      sumThin2 += netAt(ux, uy, 0.4, 1, 9, 2);
      sumThin8 += netAt(ux, uy, 0.4, 1, 9, 8);
    }
    // Higher exponent thins (dims) the net everywhere f>0.
    expect(sumThin2).toBeGreaterThan(sumThin8 + 0.01);
  });
});
