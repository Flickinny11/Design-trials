import { describe, it, expect } from 'vitest';
import { textDrawOnPrimitive } from '@/lib/prism/animatable/primitives/text-draw-on';
import { makeTarget, runConformance } from './_conformance';

describe('text-draw-on primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textDrawOnPrimitive).dispose();
  });

  it('plays: per-glyph reveal climbs from hidden to inked across the timeline', () => {
    const target = makeTarget(textDrawOnPrimitive);
    const inst = textDrawOnPrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0);
    const reveals0 = [...(target.userData.textDrawOnReveals as number[])];
    // At t=0 every glyph is still hidden (reveal edge at the left of its width).
    const max0 = Math.max(...reveals0);

    inst.seek(dur);
    const revealsEnd = [...(target.userData.textDrawOnReveals as number[])];
    // At the end every glyph is fully inked (reveal >= 1).
    const min1 = Math.min(...revealsEnd);

    expect(reveals0.length).toBeGreaterThan(1);
    expect(max0).toBeLessThan(0.05); // nothing drawn yet
    expect(min1).toBeGreaterThanOrEqual(1); // everything inked

    // A mid frame differs from both ends, and the wipe is staggered: the first
    // glyph leads the last glyph (its reveal is greater partway through).
    inst.seek(dur * 0.5);
    const revealsMid = [...(target.userData.textDrawOnReveals as number[])];
    expect(revealsMid[0]).toBeGreaterThan(revealsMid[revealsMid.length - 1]);
    expect(revealsMid[0]).toBeGreaterThan(max0);
    expect(revealsMid[0]).toBeLessThan(min1 + 0.0001);

    inst.dispose();
  });

  it('controls change output: more stagger spreads the per-glyph reveal further apart', () => {
    const target = makeTarget(textDrawOnPrimitive);
    const inst = textDrawOnPrimitive.create(target);
    const dur = inst.duration();

    // With no stagger every glyph reveals together → first/last gap ~0 at mid.
    inst.setControl('stagger', 0);
    inst.seek(dur * 0.5);
    let r = target.userData.textDrawOnReveals as number[];
    const gapTight = r[0] - r[r.length - 1];

    // With full stagger the first glyph leads the last by a wide margin.
    inst.setControl('stagger', 1);
    inst.seek(dur * 0.5);
    r = target.userData.textDrawOnReveals as number[];
    const gapWide = r[0] - r[r.length - 1];

    expect(gapWide).toBeGreaterThan(gapTight + 0.2);

    inst.dispose();
  });
});
