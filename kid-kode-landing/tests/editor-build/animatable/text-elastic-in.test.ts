import { describe, it, expect } from 'vitest';
import { Group, Mesh, type Material } from 'three';
import { textElasticInPrimitive } from '@/lib/prism/animatable/primitives/text-elastic-in';
import { makeTarget, runConformance } from './_conformance';

function glyphsOf(target: ReturnType<typeof makeTarget>) {
  const root = (target.subject ?? target.object) as Group;
  return root.children as Mesh[];
}

describe('text-elastic-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textElasticInPrimitive).dispose();
  });

  it('plays: a glyph overshoots scale >1 mid local-phase then settles to 1', () => {
    const target = makeTarget(textElasticInPrimitive);
    const inst = textElasticInPrimitive.create(target);
    const glyphs = glyphsOf(target);
    expect(glyphs.length).toBeGreaterThan(1);
    const dur = inst.duration();

    // Scan the timeline; the first glyph (i=0) is the earliest to animate, so
    // its elastic wobble peaks early. Record its max observed scale + opacity.
    let maxScale = 0;
    let sawOpacityRise = false;
    inst.seek(0);
    const op0 = (glyphs[0].material as Material & { opacity: number }).opacity;
    for (let k = 0; k <= 40; k++) {
      inst.seek((k / 40) * dur);
      maxScale = Math.max(maxScale, glyphs[0].scale.x);
      const op = (glyphs[0].material as Material & { opacity: number }).opacity;
      if (op > op0 + 0.1) sawOpacityRise = true;
    }
    // elastic overshoot: scale exceeds settled value of 1 at some mid frame.
    expect(maxScale).toBeGreaterThan(1.05);
    expect(sawOpacityRise).toBe(true);

    // Settles to 1 at the end.
    inst.seek(dur);
    expect(glyphs[0].scale.x).toBeCloseTo(1, 2);

    // Left-to-right sequence: at a mid frame, the first glyph is further along
    // (its local phase higher) than the last glyph.
    inst.seek(dur * 0.45);
    const first = glyphs[0].scale.x;
    const last = glyphs[glyphs.length - 1].scale.x;
    expect(first).not.toBeCloseTo(last, 2);
    inst.dispose();
  });

  it('controls change output: larger stagger delays later glyphs at a mid frame', () => {
    const target = makeTarget(textElasticInPrimitive);
    const inst = textElasticInPrimitive.create(target);
    const glyphs = glyphsOf(target);
    const dur = inst.duration();
    const lastIdx = glyphs.length - 1;

    // No stagger: all glyphs share the same local phase -> last glyph advances.
    inst.setControl('stagger', 0);
    inst.seek(dur * 0.4);
    const lastNoStagger = glyphs[lastIdx].scale.x;

    // Max stagger: last glyph is pushed far later -> still near 0 at same frame.
    inst.setControl('stagger', 0.25);
    inst.seek(dur * 0.4);
    const lastMaxStagger = glyphs[lastIdx].scale.x;

    expect(lastNoStagger).toBeGreaterThan(lastMaxStagger + 0.1);
    inst.dispose();
  });
});
