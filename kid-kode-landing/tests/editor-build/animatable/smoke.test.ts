import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { smokePrimitive } from '@/lib/prism/animatable/primitives/smoke';
import { makeTarget, runConformance } from './_conformance';

describe('smoke primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(smokePrimitive).dispose();
  });

  it('plays: pure shader — seek does not throw and material has colorNode/opacityNode', () => {
    const target = makeTarget(smokePrimitive);
    const inst = smokePrimitive.create(target);
    const mat = (target.subject as Mesh).material as unknown as {
      colorNode: unknown;
      opacityNode: unknown;
    };
    expect(mat.colorNode).toBeDefined();
    expect(mat.opacityNode).toBeDefined();
    expect(() => {
      inst.seek(0);
      inst.seek(1.5);
      inst.seek(3);
    }).not.toThrow();
    inst.dispose();
  });

  it('controls: tweaking density updates resolved params without throwing', () => {
    const target = makeTarget(smokePrimitive);
    const inst = smokePrimitive.create(target);
    inst.setControl('density', 1.8);
    expect(inst.getParams().density).toBe(1.8);
    expect(() => inst.seek(2)).not.toThrow();
    inst.dispose();
  });
});
