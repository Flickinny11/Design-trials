import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { textSquashEachPrimitive } from '@/lib/prism/animatable/primitives/text-squash-each';
import { makeTarget, runConformance } from './_conformance';

describe('text-squash-each primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textSquashEachPrimitive).dispose();
  });

  it('plays: glyph squashes flat (scale.x > scale.y) mid-phase, settles to ~base', () => {
    const target = makeTarget(textSquashEachPrimitive);
    const inst = textSquashEachPrimitive.create(target);
    const root = target.subject as Group;
    const glyph = root.children[0];
    const baseX = glyph.scale.x;
    const baseY = glyph.scale.y;
    const dur = inst.duration();

    // At t=0 glyph 0 has just started; capture its (collapsed) state.
    inst.seek(0);
    const x0 = glyph.scale.x;
    const y0 = glyph.scale.y;

    // Flat-squash extreme for glyph 0: local ≈ SQUASH_END (0.3) within WINDOW
    // (0.45) → p ≈ 0.135 → t ≈ 0.135 * dur. Here scale.y dips below scale.x.
    inst.seek(0.135 * dur);
    const xMid = glyph.scale.x;
    const yMid = glyph.scale.y;

    // Settled end: glyph returns to ~base proportions (1:1 of base).
    inst.seek(dur);
    const xEnd = glyph.scale.x;
    const yEnd = glyph.scale.y;

    // Mid frame is wide-and-flat: scale.x clearly exceeds scale.y (inverse).
    expect(xMid).toBeGreaterThan(yMid + 0.3);
    // Mid frame differs from the collapsed start.
    expect(Math.hypot(xMid - x0, yMid - y0)).toBeGreaterThan(0.1);
    // Mid frame differs from the settled end.
    expect(Math.hypot(xMid - xEnd, yMid - yEnd)).toBeGreaterThan(0.1);
    // Settles back to base 1:1 proportions.
    expect(xEnd).toBeCloseTo(baseX, 2);
    expect(yEnd).toBeCloseTo(baseY, 2);

    inst.dispose();
  });

  it('controls change output: smaller squash means a flatter (smaller scale.y) extreme', () => {
    const target = makeTarget(textSquashEachPrimitive);
    const inst = textSquashEachPrimitive.create(target);
    const root = target.subject as Group;
    const glyph = root.children[0];
    const dur = inst.duration();

    // Probe the flat-squash extreme for glyph 0.
    const probeT = 0.135 * dur;

    inst.setControl('squash', 0.3);
    inst.seek(probeT);
    const shallow = glyph.scale.y;

    inst.setControl('squash', 0.7);
    inst.seek(probeT);
    const deep = glyph.scale.y;

    // squash=0.7 leaves scale.y taller at the extreme than squash=0.3.
    expect(deep).toBeGreaterThan(shallow + 0.2);

    inst.dispose();
  });
});
