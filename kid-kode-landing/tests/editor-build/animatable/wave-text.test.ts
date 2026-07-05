import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { waveTextPrimitive } from '@/lib/prism/animatable/primitives/wave-text';
import { makeTarget, runConformance } from './_conformance';

describe('wave-text primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(waveTextPrimitive).dispose();
  });

  it('plays: glyph y-positions vary by index and over time (looping)', () => {
    const target = makeTarget(waveTextPrimitive);
    const inst = waveTextPrimitive.create(target);
    const glyphs = (target.subject as Group).children;
    expect(glyphs.length).toBeGreaterThan(1);

    // Two distinct times on the continuous loop (Infinity duration).
    inst.seek(0.4);
    const early = glyphs.map((g) => g.position.y);

    inst.seek(1.7);
    const mid = glyphs.map((g) => g.position.y);

    // Motion over time: at least one glyph moved between the two frames.
    const movedOverTime = early.some((y, i) => Math.abs(y - mid[i]) > 1e-3);
    expect(movedOverTime).toBe(true);

    // Travelling wave: at a single instant, glyphs differ by index (not a
    // uniform bob). Compare spread of the early frame.
    const minY = Math.min(...early);
    const maxY = Math.max(...early);
    expect(maxY - minY).toBeGreaterThan(1e-3);

    inst.dispose();
    // Restored to base (resting y = 0 for the text subject's glyph row).
    for (const g of glyphs) expect(Math.abs(g.position.y)).toBeLessThan(1e-6);
  });

  it('controls change output: larger amplitude means larger vertical excursion', () => {
    const target = makeTarget(waveTextPrimitive);
    const inst = waveTextPrimitive.create(target);
    const glyphs = (target.subject as Group).children;

    const excursion = () => {
      let peak = 0;
      // Sample across a full loop to capture the sine peak regardless of phase.
      for (let k = 0; k <= 32; k++) {
        inst.seek(k * 0.1);
        for (const g of glyphs) peak = Math.max(peak, Math.abs(g.position.y));
      }
      return peak;
    };

    inst.setControl('amplitude', 0.04);
    const small = excursion();

    inst.setControl('amplitude', 0.5);
    const large = excursion();

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });
});
