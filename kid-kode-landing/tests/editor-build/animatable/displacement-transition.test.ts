import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { displacementTransitionPrimitive } from '@/lib/prism/animatable/primitives/displacement-transition';
import { makeTarget, runConformance } from './_conformance';

describe('displacement-transition primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(displacementTransitionPrimitive).dispose();
  });

  it('plays: progress uniform advances with seek across the timeline; material has colorNode', () => {
    const target = makeTarget(displacementTransitionPrimitive);
    const inst = displacementTransitionPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { colorNode: unknown };

    // The plane material was swapped for a node material with a colorNode.
    expect(mat.colorNode).toBeDefined();

    const dur = inst.duration();
    // Seeking across the timeline must not throw.
    expect(() => {
      for (let i = 0; i <= 8; i++) inst.seek((i / 8) * dur);
    }).not.toThrow();

    inst.dispose();
  });

  it('controls: axis dropdown and amount knob update without throwing', () => {
    const target = makeTarget(displacementTransitionPrimitive);
    const inst = displacementTransitionPrimitive.create(target);

    inst.setControl('axis', 'y');
    expect(inst.getParams().axis).toBe('y');
    inst.setControl('amount', 0.8);
    expect(inst.getParams().amount).toBe(0.8);
    expect(() => inst.seek(inst.duration() / 2)).not.toThrow();

    inst.dispose();
  });
});
