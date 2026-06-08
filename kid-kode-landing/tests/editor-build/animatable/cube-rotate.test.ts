import { describe, it, expect } from 'vitest';
import { cubeRotatePrimitive } from '@/lib/prism/animatable/primitives/cube-rotate';
import { makeTarget, runConformance } from './_conformance';

describe('cube-rotate primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(cubeRotatePrimitive).dispose();
  });

  it('plays: rotation.y and position.z both arc from a cube-face side to front', () => {
    const target = makeTarget(cubeRotatePrimitive);
    const inst = cubeRotatePrimitive.create(target);
    const obj = target.object;
    const dur = inst.duration();

    inst.seek(0);
    const rot0 = obj.rotation.y;
    const z0 = obj.position.z;
    const x0 = obj.position.x;

    inst.seek(dur);
    const rotEnd = obj.rotation.y;
    const zEnd = obj.position.z;
    const xEnd = obj.position.x;

    // At t=0 the face is swung to the side: rotation.y ~ -PI/2, pushed back -depth.
    expect(rot0).toBeLessThan(-1.0);
    expect(z0).toBeLessThan(zEnd - 0.5);
    expect(x0).toBeLessThan(xEnd - 0.5);

    // At the end it is front-facing at the origin (settled).
    expect(Math.abs(rotEnd)).toBeLessThan(1e-6);
    expect(Math.abs(zEnd)).toBeLessThan(1e-6);

    // Simultaneous arc: rotation AND depth both moved across the phase.
    expect(rotEnd).toBeGreaterThan(rot0 + 1.0);
    expect(zEnd).toBeGreaterThan(z0 + 0.5);
    inst.dispose();
  });

  it('controls change output: larger depth means a larger initial positional offset', () => {
    const target = makeTarget(cubeRotatePrimitive);
    const inst = cubeRotatePrimitive.create(target);
    const obj = target.object;

    inst.setControl('depth', 0.5);
    inst.seek(0);
    const small = Math.hypot(obj.position.x, obj.position.z);

    inst.setControl('depth', 3);
    inst.seek(0);
    const large = Math.hypot(obj.position.x, obj.position.z);

    expect(large).toBeGreaterThan(small + 0.5);
    inst.dispose();
  });
});
