import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { textCounterRollPrimitive } from '@/lib/prism/animatable/primitives/text-counter-roll';
import { makeTarget, runConformance } from './_conformance';

describe('text-counter-roll primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textCounterRollPrimitive).dispose();
  });

  it('plays: glyphs cycle in position.y mid-roll and settle to base by the end', () => {
    const target = makeTarget(textCounterRollPrimitive);
    const inst = textCounterRollPrimitive.create(target);
    const group = target.subject as Group;
    const glyphs = group.children;
    expect(glyphs.length).toBeGreaterThan(1);

    // Capture base Y for the first glyph (which settles first).
    const g0 = glyphs[0];
    const base0 = g0.position.y;

    // Mid-roll: sample several early frames; the first glyph's position.y must
    // visibly move away from base at least once (the reel cycling).
    let maxDevEarly = 0;
    for (let i = 1; i <= 12; i++) {
      inst.seek((i / 40) * inst.duration());
      maxDevEarly = Math.max(maxDevEarly, Math.abs(g0.position.y - base0));
    }
    expect(maxDevEarly).toBeGreaterThan(0.05);

    // End: the first glyph (start=0, full window) has settled exactly to base —
    // proving the per-glyph snap-to-base. (Later glyphs settle in sequence; with
    // a stagger the trailing ones may still be rolling at p=1, by design.)
    inst.seek(inst.duration());
    expect(Math.abs(g0.position.y - base0)).toBeLessThan(1e-6);
    expect(Math.abs(g0.scale.y - 1)).toBeLessThan(1e-6);

    inst.dispose();
  });

  it('controls change output: more spins means more position.y direction changes mid-roll', () => {
    const target = makeTarget(textCounterRollPrimitive);
    const inst = textCounterRollPrimitive.create(target);
    const group = target.subject as Group;
    const g0 = group.children[0];

    // Count sign-change "reversals" in position.y across a dense sweep of the
    // first glyph's roll window. More spins => more cycles => more reversals.
    const countReversals = () => {
      const samples: number[] = [];
      const N = 120;
      for (let i = 0; i <= N; i++) {
        inst.seek((i / N) * inst.duration() * 0.5); // first half = g0 still rolling-ish
        samples.push(g0.position.y);
      }
      let reversals = 0;
      for (let i = 2; i < samples.length; i++) {
        const d1 = samples[i - 1] - samples[i - 2];
        const d2 = samples[i] - samples[i - 1];
        if (d1 !== 0 && d2 !== 0 && Math.sign(d1) !== Math.sign(d2)) reversals++;
      }
      return reversals;
    };

    inst.setControl('spins', 1);
    const few = countReversals();

    inst.setControl('spins', 6);
    const many = countReversals();

    expect(many).toBeGreaterThan(few);

    inst.dispose();
  });
});
