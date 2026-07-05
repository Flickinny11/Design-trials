import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { fadePrimitive } from '@/lib/prism/animatable/primitives/fade';
import { makeTarget, runConformance } from './_conformance';

describe('fade primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fadePrimitive).dispose();
  });

  it('plays: opacity rises from start to end across the timeline', () => {
    const target = makeTarget(fadePrimitive);
    const inst = fadePrimitive.create(target);
    const mat = (target.subject as Mesh).material as Material & { opacity: number };
    const dur = inst.duration();
    inst.seek(0);
    const a = mat.opacity;
    inst.seek(dur);
    const b = mat.opacity;
    expect(a).toBeLessThan(0.05);
    expect(b).toBeGreaterThan(0.95);
    inst.dispose();
  });

  it('controls change output: endOpacity caps the final value', () => {
    const target = makeTarget(fadePrimitive);
    const inst = fadePrimitive.create(target);
    const mat = (target.subject as Mesh).material as Material & { opacity: number };
    inst.setControl('endOpacity', 0.4);
    inst.seek(inst.duration());
    expect(mat.opacity).toBeLessThan(0.5);
    inst.dispose();
  });
});
