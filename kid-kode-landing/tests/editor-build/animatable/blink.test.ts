import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { blinkPrimitive } from '@/lib/prism/animatable/primitives/blink';
import { makeTarget, runConformance } from './_conformance';

describe('blink primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(blinkPrimitive).dispose();
  });

  it('plays: opacity differs across seek times in the loop', () => {
    const target = makeTarget(blinkPrimitive);
    const inst = blinkPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };

    // Make the wave deterministic and easy to sample.
    inst.setControl('speed', Math.PI); // period = 2s
    inst.setControl('minOpacity', 0.2);
    inst.setControl('smooth', true);

    // t=0.5 -> sin(PI*0.5)=1 -> wave=1 -> opacity ~= 1 (peak)
    inst.seek(0.5);
    const opPeak = mat.opacity;

    // t=1.5 -> sin(PI*1.5)=-1 -> wave=0 -> opacity ~= minOpacity (trough)
    inst.seek(1.5);
    const opTrough = mat.opacity;

    expect(opPeak).toBeGreaterThan(opTrough + 0.3);
    expect(opTrough).toBeLessThan(0.5);
    inst.dispose();
  });

  it('controls change output: higher minOpacity raises the trough', () => {
    const target = makeTarget(blinkPrimitive);
    const inst = blinkPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };

    inst.setControl('speed', Math.PI);
    inst.setControl('smooth', true);

    // Sample the trough (t=1.5 -> wave=0 -> opacity == minOpacity).
    inst.setControl('minOpacity', 0);
    inst.seek(1.5);
    const lowTrough = mat.opacity;

    inst.setControl('minOpacity', 0.8);
    inst.seek(1.5);
    const highTrough = mat.opacity;

    expect(highTrough).toBeGreaterThan(lowTrough + 0.3);
    inst.dispose();
  });
});
