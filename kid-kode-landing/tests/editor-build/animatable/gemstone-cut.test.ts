import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { gemstoneCutPrimitive } from '@/lib/prism/animatable/primitives/gemstone-cut';
import { makeTarget, runConformance } from './_conformance';

describe('gemstone-cut primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(gemstoneCutPrimitive).dispose();
  });

  it('plays: the facet-rotation clock uniform advances between two frames', () => {
    const target = makeTarget(gemstoneCutPrimitive);
    const inst = gemstoneCutPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as MeshPhysicalNodeMaterial;
    // The card panel material was swapped for the transmissive gem material.
    expect(mat).toBeInstanceOf(MeshPhysicalNodeMaterial);

    // The primitive publishes its rotating-facet clock uniform into scratch.
    const uTime = target.userData.gemstoneTime as { value: number };

    inst.seek(0);
    const early = uTime.value;
    inst.seek(3);
    const late = uTime.value;

    // The pattern-rotation clock advanced => the facets visibly travel.
    expect(Math.abs(late - early)).toBeGreaterThan(1e-6);
    expect(late).toBeCloseTo(3, 5);
    inst.dispose();
  });

  it('controls change output: ior fader at two extremes differs on the material', () => {
    const target = makeTarget(gemstoneCutPrimitive);
    const inst = gemstoneCutPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as MeshPhysicalNodeMaterial;

    inst.setControl('ior', 1.5);
    inst.seek(0);
    const low = mat.ior;

    inst.setControl('ior', 2.4);
    inst.seek(0);
    const high = mat.ior;

    expect(high).toBeGreaterThan(low + 0.5);
    inst.dispose();
  });
});
