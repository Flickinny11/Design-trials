import { describe, it, expect } from 'vitest';
import { Mesh, type Group, type Material } from 'three';
import { textPopEachPrimitive } from '@/lib/prism/animatable/primitives/text-pop-each';
import { makeTarget, runConformance } from './_conformance';

describe('text-pop-each primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textPopEachPrimitive).dispose();
  });

  it('plays: glyph scale pops in sequence and overshoots >1 mid local phase', () => {
    const target = makeTarget(textPopEachPrimitive);
    const inst = textPopEachPrimitive.create(target);
    const glyphs = (target.subject as Group).children as Mesh[];
    const dur = inst.duration();

    // At t=0 the first glyph has not popped yet: scale ~0.
    inst.seek(0);
    const firstAtStart = glyphs[0].scale.x;

    // The first glyph reaches its local mid-phase early; scan for an overshoot.
    let maxFirst = 0;
    for (let i = 1; i <= 30; i++) {
      inst.seek((i / 30) * dur);
      maxFirst = Math.max(maxFirst, glyphs[0].scale.x);
    }

    // Settled: at the end every glyph is at base scale (1).
    inst.seek(dur);
    const firstAtEnd = glyphs[0].scale.x;
    const lastAtEnd = glyphs[glyphs.length - 1].scale.x;

    expect(firstAtStart).toBeLessThan(0.01); // started near zero
    expect(maxFirst).toBeGreaterThan(1.05); // overshot above 1 mid local phase
    expect(firstAtEnd).toBeCloseTo(1, 2); // settled to base
    expect(lastAtEnd).toBeCloseTo(1, 2); // last glyph also settled

    inst.dispose();
  });

  it('sequence: earlier glyphs lead later glyphs (left-to-right stagger)', () => {
    const target = makeTarget(textPopEachPrimitive);
    const inst = textPopEachPrimitive.create(target);
    const glyphs = (target.subject as Group).children as Mesh[];

    // Mid-timeline snapshot: the leading glyph should have a larger opacity
    // (further along its local phase) than a trailing glyph.
    inst.setControl('stagger', 0.3);
    inst.seek(inst.duration() * 0.25);
    const opFirst = (glyphs[0].material as Material & { opacity: number }).opacity;
    const opLast = (glyphs[glyphs.length - 1].material as Material & { opacity: number }).opacity;

    expect(opFirst).toBeGreaterThan(opLast);
    inst.dispose();
  });

  it('controls change output: larger overshoot means a larger peak scale', () => {
    const target = makeTarget(textPopEachPrimitive);
    const inst = textPopEachPrimitive.create(target);
    const glyphs = (target.subject as Group).children as Mesh[];
    const dur = inst.duration();

    const peakFor = (over: number): number => {
      inst.setControl('overshoot', over);
      let mx = 0;
      for (let i = 0; i <= 30; i++) {
        inst.seek((i / 30) * dur);
        mx = Math.max(mx, glyphs[0].scale.x);
      }
      return mx;
    };

    const small = peakFor(1.0); // overshoot disabled -> peak ~1
    const large = peakFor(1.8); // strong overshoot -> peak well above 1

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });
});
