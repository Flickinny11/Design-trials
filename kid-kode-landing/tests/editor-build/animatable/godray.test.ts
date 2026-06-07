import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { godrayPrimitive } from '@/lib/prism/animatable/primitives/godray';
import { makeTarget, runConformance } from './_conformance';

describe('godray primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(godrayPrimitive).dispose();
  });

  it('plays: pure shader — seek does not throw and material has a colorNode', () => {
    const target = makeTarget(godrayPrimitive);
    const inst = godrayPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { colorNode?: unknown };
    expect(mat.colorNode).toBeDefined();
    expect(() => {
      inst.seek(0);
      inst.seek(inst.duration() / 2);
      inst.seek(inst.duration());
    }).not.toThrow();
    inst.dispose();
  });

  it('controls: tweaking a numeric control updates params and re-seek is safe', () => {
    const target = makeTarget(godrayPrimitive);
    const inst = godrayPrimitive.create(target);
    inst.setControl('intensity', 2.5);
    expect(inst.getParams().intensity).toBe(2.5);
    expect(() => inst.seek(inst.duration() / 2)).not.toThrow();
    inst.dispose();
  });
});
