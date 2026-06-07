import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { maskWipePrimitive } from '@/lib/prism/animatable/primitives/mask-wipe';
import { makeTarget, runConformance } from './_conformance';

describe('mask-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(maskWipePrimitive).dispose();
  });

  it('plays: swaps a node material with an opacityNode mask and seeks without throwing', () => {
    const target = makeTarget(maskWipePrimitive);
    const inst = maskWipePrimitive.create(target);
    const mat = (target.subject as Mesh).material as unknown as Record<string, unknown> & {
      transparent: boolean;
    };
    // The card material is replaced by a transparent node material whose
    // opacity is driven by a TSL opacityNode mask.
    expect(mat.transparent).toBe(true);
    expect(mat.opacityNode).toBeDefined();

    const dur = inst.duration();
    expect(() => {
      inst.seek(0);
      inst.seek(dur / 2);
      inst.seek(dur);
    }).not.toThrow();
    inst.dispose();
  });

  it('controls: angle + softness are tweakable and restore on dispose', () => {
    const target = makeTarget(maskWipePrimitive);
    const original = (target.subject as Mesh).material; // capture before swap
    const inst = maskWipePrimitive.create(target);

    inst.setControl('angleDeg', 90);
    inst.setControl('softness', 0.4);
    expect(inst.getParams().angleDeg).toBe(90);
    expect(inst.getParams().softness).toBe(0.4);
    expect(() => inst.seek(inst.duration() / 2)).not.toThrow();

    // dispose restores the host card's original material.
    inst.dispose();
    expect((target.subject as Mesh).material).toBe(original);
  });
});
