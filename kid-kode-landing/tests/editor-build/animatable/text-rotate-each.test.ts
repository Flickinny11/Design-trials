import { describe, it, expect } from 'vitest';
import { textRotateEachPrimitive } from '@/lib/prism/animatable/primitives/text-rotate-each';
import { makeTarget, runConformance } from './_conformance';

describe('text-rotate-each primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textRotateEachPrimitive).dispose();
  });

  it('plays: per-glyph rotation.z decreases and scale grows across the timeline', () => {
    const target = makeTarget(textRotateEachPrimitive);
    const inst = textRotateEachPrimitive.create(target);
    const glyphs = (target.subject ?? target.object).children;
    expect(glyphs.length).toBeGreaterThan(1);

    // Sample the first glyph, which begins spinning earliest.
    const g0 = glyphs[0];

    inst.seek(0);
    const rotEarly = Math.abs(g0.rotation.z);
    const scaleEarly = g0.scale.x;

    inst.seek(inst.duration());
    const rotEnd = Math.abs(g0.rotation.z);
    const scaleEnd = g0.scale.x;

    // rotation spins down toward upright (decreases) and scale grows.
    expect(rotEarly).toBeGreaterThan(rotEnd + 0.5);
    expect(scaleEnd).toBeGreaterThan(scaleEarly + 0.3);
    inst.dispose();
  });

  it('controls change output: more turns means larger initial rotation', () => {
    const target = makeTarget(textRotateEachPrimitive);
    const inst = textRotateEachPrimitive.create(target);
    const g0 = (target.subject ?? target.object).children[0];

    inst.setControl('turns', 0.25);
    inst.seek(0);
    const small = Math.abs(g0.rotation.z);

    inst.setControl('turns', 2);
    inst.seek(0);
    const large = Math.abs(g0.rotation.z);

    expect(large).toBeGreaterThan(small + 1);
    inst.dispose();
  });
});
