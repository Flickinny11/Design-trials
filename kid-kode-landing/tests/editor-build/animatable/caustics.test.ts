import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { causticsPrimitive } from '@/lib/prism/animatable/primitives/caustics';
import { makeTarget, runConformance } from './_conformance';

describe('caustics primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(causticsPrimitive).dispose();
  });

  it('plays: seeking across the timeline installs a node material with a truthy colorNode and does not throw', () => {
    // PURE SHADER: pixels cannot be read headlessly. Assert the plane gained a
    // node material whose colorNode is truthy and that seeking is exception-free.
    const target = makeTarget(causticsPrimitive);
    const inst = causticsPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { colorNode?: unknown };
    expect(mat.colorNode).toBeTruthy();
    const dur = inst.duration();
    for (let i = 0; i <= 8; i++) {
      expect(() => inst.seek((i / 8) * dur)).not.toThrow();
    }
    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { colorNode?: unknown }).colorNode).toBeFalsy();
  });

  it('controls: changing intensity updates the resolved params', () => {
    const target = makeTarget(causticsPrimitive);
    const inst = causticsPrimitive.create(target);
    inst.setControl('intensity', 1.75);
    expect(inst.getParams().intensity).toBe(1.75);
    expect(() => inst.seek(inst.duration() / 2)).not.toThrow();
    inst.dispose();
  });
});
