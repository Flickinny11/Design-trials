import { describe, it, expect } from 'vitest';
import { Group, Mesh } from 'three';
import { textScaleWavePrimitive } from '@/lib/prism/animatable/primitives/text-scale-wave';
import { makeTarget, runConformance } from './_conformance';

describe('text-scale-wave primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textScaleWavePrimitive).dispose();
  });

  it('plays: a glyph swells across time and glyphs differ at one instant', () => {
    const target = makeTarget(textScaleWavePrimitive);
    const inst = textScaleWavePrimitive.create(target);
    const glyphs = (target.subject as Group).children as Mesh[];
    expect(glyphs.length).toBeGreaterThan(1);

    // Looping: pick two distinct t values. Glyph 0's wave = sin(t*speed); with
    // default speed 3 the crest (max scale) is near t = (pi/2)/3 ~= 0.524, and a
    // trough (min scale) near t = (3*pi/2)/3 ~= 1.571.
    inst.seek(0.524);
    const crest = glyphs[0].scale.x;
    inst.seek(1.571);
    const trough = glyphs[0].scale.x;
    expect(crest).toBeGreaterThan(trough + 0.05);

    // At a single instant, two glyphs see the wave at different phases, so their
    // scales differ (the swell has traveled along the row).
    inst.seek(0.524);
    const g0 = glyphs[0].scale.x;
    const g3 = glyphs[3].scale.x;
    expect(Math.abs(g0 - g3)).toBeGreaterThan(0.02);

    inst.dispose();
    // dispose restores the resting scale.
    expect(glyphs[0].scale.x).toBeCloseTo(1, 5);
  });

  it('controls change output: larger amplitude means a bigger crest swell', () => {
    const target = makeTarget(textScaleWavePrimitive);
    const inst = textScaleWavePrimitive.create(target);
    const glyph0 = (target.subject as Group).children[0] as Mesh;

    // t chosen so glyph 0 sits at its wave crest (sin(t*speed)=1, speed=3).
    const tCrest = (Math.PI / 2) / 3;

    inst.setControl('amplitude', 0.1);
    inst.seek(tCrest);
    const small = glyph0.scale.x;

    inst.setControl('amplitude', 0.8);
    inst.seek(tCrest);
    const large = glyph0.scale.x;

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
