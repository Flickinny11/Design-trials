import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { refractionWarpPrimitive } from '@/lib/prism/animatable/primitives/refraction-warp';
import { makeTarget, runConformance } from './_conformance';

// Reach into the swapped material's node uniforms for CPU-observable state.
type NodeMat = {
  ior: number;
  thickness: number;
  normalNode: { [k: string]: unknown };
};

describe('refraction-warp primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(refractionWarpPrimitive).dispose();
  });

  it('plays: refraction ior/thickness pulse across the timeline', () => {
    const target = makeTarget(refractionWarpPrimitive);
    const inst = refractionWarpPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as NodeMat;

    // Looping/stateful: duration is Infinity — sample two distinct times.
    inst.seek(0);
    const ior0 = mat.ior;
    const thick0 = mat.thickness;

    inst.seek(1.1);
    const iorMid = mat.ior;
    const thickMid = mat.thickness;

    // The time-driven pulse must move ior and/or thickness off the t=0 values.
    expect(Math.abs(iorMid - ior0) + Math.abs(thickMid - thick0)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: warp extremes drive a different ripple uniform', () => {
    const target = makeTarget(refractionWarpPrimitive);
    const inst = refractionWarpPrimitive.create(target);

    inst.setControl('warp', 0);
    inst.seek(0.5);
    const lowWarp = inst.getParams().warp as number;

    inst.setControl('warp', 1.5);
    inst.seek(0.5);
    const highWarp = inst.getParams().warp as number;

    expect(highWarp).toBeGreaterThan(lowWarp + 0.5);

    // ior knob directly drives the live material ior at the same seek time.
    inst.setControl('ior', 1.0);
    inst.seek(0);
    const lowIor = (target.subject as Mesh).material as unknown as NodeMat;
    const a = lowIor.ior;
    inst.setControl('ior', 2.4);
    inst.seek(0);
    const b = lowIor.ior;
    expect(b).toBeGreaterThan(a + 0.5);
    inst.dispose();
  });
});
