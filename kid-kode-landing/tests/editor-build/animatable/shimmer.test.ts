import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { shimmerPrimitive } from '@/lib/prism/animatable/primitives/shimmer';
import { makeTarget, runConformance } from './_conformance';

describe('shimmer primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(shimmerPrimitive).dispose();
  });

  it('renders: swaps in a node material on the subject', () => {
    const target = makeTarget(shimmerPrimitive);
    const inst = shimmerPrimitive.create(target);
    const mat = (target.subject as Mesh).material as { isNodeMaterial?: boolean; colorNode?: unknown };
    // MeshBasicNodeMaterial carries a colorNode and the node-material flag.
    expect(mat.colorNode).toBeTruthy();
    inst.dispose();
  });

  it('plays: seek advances the time uniform without throwing', () => {
    const target = makeTarget(shimmerPrimitive);
    const inst = shimmerPrimitive.create(target);
    expect(() => {
      for (let i = 0; i <= 10; i++) inst.seek(i * 0.2);
    }).not.toThrow();
    inst.dispose();
  });
});
