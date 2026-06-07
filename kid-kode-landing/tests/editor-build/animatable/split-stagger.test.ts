import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { splitStaggerPrimitive } from '@/lib/prism/animatable/primitives/split-stagger';
import { makeTarget, runConformance } from './_conformance';

describe('split-stagger primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(splitStaggerPrimitive).dispose();
  });

  it('plays: the last glyph rises and fades in across the timeline', () => {
    const target = makeTarget(splitStaggerPrimitive);
    const inst = splitStaggerPrimitive.create(target);
    const subject = target.subject!;
    const last = subject.children[subject.children.length - 1] as Mesh;
    const mat = last.material as Material & { opacity: number };

    inst.seek(0);
    const a = mat.opacity;
    const yA = last.position.y;

    inst.seek(inst.duration());
    const b = mat.opacity;
    const yB = last.position.y;

    // At t=0 the late glyph is invisible and dropped below baseline.
    expect(a).toBeLessThan(0.05);
    expect(yA).toBeLessThan(0);
    // At t=duration it has fully arrived: opaque and back at baseline.
    expect(b).toBeGreaterThan(0.95);
    expect(yB).toBeCloseTo(0, 2);
    // Opacity change is clearly observable.
    expect(b - a).toBeGreaterThan(0.5);

    inst.dispose();
  });

  it('controls change output: zero rise keeps glyphs at baseline throughout', () => {
    const target = makeTarget(splitStaggerPrimitive);
    const inst = splitStaggerPrimitive.create(target);
    const subject = target.subject!;
    const last = subject.children[subject.children.length - 1] as Mesh;

    inst.setControl('rise', 0);
    inst.seek(0);
    expect(last.position.y).toBeCloseTo(0, 5);
    inst.seek(inst.duration());
    expect(last.position.y).toBeCloseTo(0, 5);

    inst.dispose();
  });
});
