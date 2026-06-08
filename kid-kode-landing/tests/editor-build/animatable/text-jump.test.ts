import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { textJumpPrimitive } from '@/lib/prism/animatable/primitives/text-jump';
import { makeTarget, runConformance } from './_conformance';

describe('text-jump primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textJumpPrimitive).dispose();
  });

  it('plays: glyphs hop — y differs across time and between glyphs at fixed t', () => {
    const target = makeTarget(textJumpPrimitive);
    const inst = textJumpPrimitive.create(target);
    const glyphs = (target.subject as Group).children;
    expect(glyphs.length).toBeGreaterThan(2);

    // Same glyph at two distinct times in the loop must move.
    const g0 = glyphs[0];
    inst.seek(0);
    const yA = g0.position.y;
    inst.seek(0.4);
    const yB = g0.position.y;
    expect(Math.abs(yB - yA)).toBeGreaterThan(0.01);

    // At a fixed time, the staggered wave puts glyphs at different heights.
    inst.seek(0.25);
    const heights = glyphs.map((g) => g.position.y);
    const spread = Math.max(...heights) - Math.min(...heights);
    expect(spread).toBeGreaterThan(0.01);

    inst.dispose();
  });

  it('controls change output: larger jumpHeight means a taller hop', () => {
    const target = makeTarget(textJumpPrimitive);
    const inst = textJumpPrimitive.create(target);
    const glyphs = (target.subject as Group).children;

    // Pick a time where the lead glyph is near its apex.
    const peakAt = (h: number): number => {
      inst.setControl('jumpHeight', h);
      let maxY = -Infinity;
      for (let s = 0; s <= 1; s += 0.02) {
        inst.seek(s);
        maxY = Math.max(maxY, glyphs[0].position.y);
      }
      return maxY;
    };

    const small = peakAt(0.2);
    const large = peakAt(2);
    expect(large).toBeGreaterThan(small + 0.3);

    inst.dispose();
  });
});
