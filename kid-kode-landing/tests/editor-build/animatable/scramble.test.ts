import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { scramblePrimitive } from '@/lib/prism/animatable/primitives/scramble';
import { makeTarget, runConformance } from './_conformance';

describe('scramble primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scramblePrimitive).dispose();
  });

  it('plays: glyph offset from base is large at t=0 and ~0 at t=duration', () => {
    const target = makeTarget(scramblePrimitive);
    const glyphs = (target.subject as Group).children;
    const base = glyphs[1].position.clone();
    const inst = scramblePrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0);
    const offStart = glyphs[1].position.distanceTo(base);

    inst.seek(dur);
    const offEnd = glyphs[1].position.distanceTo(base);

    expect(offStart).toBeGreaterThan(0);
    expect(offEnd).toBeLessThan(1e-6);
    expect(offEnd).toBeLessThan(offStart);
    inst.dispose();
  });

  it('controls: intensity scales the t=0 jitter magnitude', () => {
    const target = makeTarget(scramblePrimitive);
    const glyphs = (target.subject as Group).children;
    const base = glyphs[1].position.clone();
    const inst = scramblePrimitive.create(target);

    inst.setControl('intensity', 1);
    inst.seek(0);
    const hi = glyphs[1].position.distanceTo(base);

    inst.setControl('intensity', 0.25);
    inst.seek(0);
    const lo = glyphs[1].position.distanceTo(base);

    expect(hi).toBeGreaterThan(lo);
    inst.dispose();
  });
});
