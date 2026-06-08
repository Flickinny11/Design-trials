import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { fadeScalePrimitive } from '@/lib/prism/animatable/primitives/fade-scale';
import { makeTarget, runConformance } from './_conformance';

describe('fade-scale primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fadeScalePrimitive).dispose();
  });

  it('plays: opacity rises and scale settles from startScale toward 1', () => {
    const target = makeTarget(fadeScalePrimitive);
    const inst = fadeScalePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const op0 = mat.opacity;
    const scale0 = mesh.scale.x;

    inst.seek(dur);
    const opDur = mat.opacity;
    const scaleDur = mesh.scale.x;

    // opacity rises 0 -> 1 across the eased phase
    expect(opDur).toBeGreaterThan(op0 + 0.3);
    // scale starts shrunken (< 1) and settles up to ~1
    expect(scale0).toBeLessThan(scaleDur - 0.05);
    expect(scaleDur).toBeGreaterThan(0.98);
    inst.dispose();
  });

  it('controls change output: larger startScale means a less-shrunken initial scale', () => {
    const target = makeTarget(fadeScalePrimitive);
    const inst = fadeScalePrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('startScale', 0.5);
    inst.seek(0);
    const small = mesh.scale.x;

    inst.setControl('startScale', 0.98);
    inst.seek(0);
    const large = mesh.scale.x;

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
