import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { textFlipEachPrimitive } from '@/lib/prism/animatable/primitives/text-flip-each';
import { makeTarget, runConformance } from './_conformance';

describe('text-flip-each primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textFlipEachPrimitive).dispose();
  });

  it('plays: each glyph rotation.x sweeps toward 0 in sequence', () => {
    const target = makeTarget(textFlipEachPrimitive);
    const inst = textFlipEachPrimitive.create(target);
    const glyphs = (target.subject as Group).children;
    const dur = inst.duration();

    // First glyph: edge-on near t=0, flat (~0) near the end.
    inst.seek(0);
    const g0Start = glyphs[0].rotation.x;
    inst.seek(dur);
    const g0End = glyphs[0].rotation.x;

    expect(Math.abs(g0Start)).toBeGreaterThan(Math.abs(g0End) + 0.3);
    expect(Math.abs(g0End)).toBeLessThan(0.05);

    // Sequencing: at a mid frame, a later glyph is still more edge-on than an
    // earlier one (the flip propagates left-to-right via stagger).
    inst.seek(dur * 0.35);
    const early = Math.abs(glyphs[1].rotation.x);
    const later = Math.abs(glyphs[glyphs.length - 1].rotation.x);
    expect(later).toBeGreaterThan(early);

    inst.dispose();
  });

  it('controls change output: larger start angle means larger initial rotation', () => {
    const target = makeTarget(textFlipEachPrimitive);
    const inst = textFlipEachPrimitive.create(target);
    const glyphs = (target.subject as Group).children;
    const dur = inst.duration();

    inst.setControl('startAngleDeg', 60);
    inst.seek(dur * 0.1);
    const small = Math.abs(glyphs[0].rotation.x);

    inst.setControl('startAngleDeg', 160);
    inst.seek(dur * 0.1);
    const large = Math.abs(glyphs[0].rotation.x);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
