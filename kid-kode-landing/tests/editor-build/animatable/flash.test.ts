import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { flashPrimitive } from '@/lib/prism/animatable/primitives/flash';
import { makeTarget, runConformance } from './_conformance';

type EmissiveMat = Material & { opacity: number; emissiveIntensity: number };

describe('flash primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(flashPrimitive).dispose();
  });

  it('plays: opacity rises and emissive spikes mid-flash above the settled end', () => {
    const target = makeTarget(flashPrimitive);
    const inst = flashPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as EmissiveMat;
    const dur = inst.duration();

    inst.seek(0);
    const op0 = mat.opacity;

    // Mid-flash near the emissive hump peak (~30% of the phase).
    inst.seek(dur * 0.3);
    const opMid = mat.opacity;
    const emisMid = mat.emissiveIntensity;

    inst.seek(dur);
    const opEnd = mat.opacity;
    const emisEnd = mat.emissiveIntensity;

    // opacity races up across the flash
    expect(opMid).toBeGreaterThan(op0 + 0.1);
    expect(opEnd).toBeGreaterThan(opMid);
    // emissive spikes mid-animation and settles lower by the end
    expect(emisMid).toBeGreaterThan(emisEnd + 0.3);
    inst.dispose();
  });

  it('controls change output: larger peak means a brighter emissive spike', () => {
    const target = makeTarget(flashPrimitive);
    const inst = flashPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as EmissiveMat;
    const dur = inst.duration();

    inst.setControl('peak', 0.5);
    inst.seek(dur * 0.3);
    const small = mat.emissiveIntensity;

    inst.setControl('peak', 6);
    inst.seek(dur * 0.3);
    const large = mat.emissiveIntensity;

    expect(large).toBeGreaterThan(small + 1);
    inst.dispose();
  });
});
