import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { glassRefractionPrimitive } from '@/lib/prism/animatable/primitives/glass-refraction';
import { makeTarget, runConformance } from './_conformance';

describe('glass-refraction primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(glassRefractionPrimitive).dispose();
  });

  it('plays: sphere rotates over time', () => {
    const target = makeTarget(glassRefractionPrimitive);
    const inst = glassRefractionPrimitive.create(target);
    const mesh = target.subject as Mesh;
    inst.seek(0);
    const r0 = mesh.rotation.y;
    inst.seek(1);
    const r1 = mesh.rotation.y;
    // Material transmission may render dark without an env map (acceptable);
    // the observable, deterministic behavior is the rotation advancing.
    expect(Math.abs(r1 - r0)).toBeGreaterThan(0.1);
    inst.dispose();
  });

  it('controls change output: rotateSpeed scales the rotation per second', () => {
    const target = makeTarget(glassRefractionPrimitive);
    const inst = glassRefractionPrimitive.create(target);
    const mesh = target.subject as Mesh;
    inst.setControl('rotateSpeed', 2);
    inst.seek(1);
    const fast = mesh.rotation.y;
    inst.setControl('rotateSpeed', 0.5);
    inst.seek(1);
    const slow = mesh.rotation.y;
    expect(fast).toBeGreaterThan(slow);
    inst.dispose();
  });
});
