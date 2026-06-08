import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { textWave3dPrimitive } from '@/lib/prism/animatable/primitives/text-wave-3d';
import { makeTarget, runConformance } from './_conformance';

describe('text-wave-3d primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textWave3dPrimitive).dispose();
  });

  it('plays: glyphs vary in Y, Z and rotation.x across the timeline', () => {
    const target = makeTarget(textWave3dPrimitive);
    const inst = textWave3dPrimitive.create(target);
    const glyphs = (target.subject as Group).children;
    expect(glyphs.length).toBeGreaterThan(1);

    // Looping primitive — pick two distinct times that land at different wave
    // phases. With speed=3 the wave moves fast, so t=0 vs t=0.3 differ clearly.
    inst.seek(0);
    const y0 = glyphs.map((g) => g.position.y);
    const z0 = glyphs.map((g) => g.position.z);
    const rx0 = glyphs.map((g) => g.rotation.x);

    inst.seek(0.3);
    const yMid = glyphs.map((g) => g.position.y);
    const zMid = glyphs.map((g) => g.position.z);
    const rxMid = glyphs.map((g) => g.rotation.x);

    // At least one glyph moved in each observable channel.
    const yChanged = y0.some((v, i) => Math.abs(v - yMid[i]) > 1e-4);
    const zChanged = z0.some((v, i) => Math.abs(v - zMid[i]) > 1e-4);
    const rxChanged = rx0.some((v, i) => Math.abs(v - rxMid[i]) > 1e-4);
    expect(yChanged).toBe(true);
    expect(zChanged).toBe(true);
    expect(rxChanged).toBe(true);

    // The wave is per-index: at a fixed time, two different glyphs occupy
    // different phases (distinct Y), proving it's a travelling wave not a
    // uniform bob.
    const distinctByIndex = yMid.some((v) => Math.abs(v - yMid[0]) > 1e-4);
    expect(distinctByIndex).toBe(true);

    inst.dispose();
  });

  it('controls change output: larger amplitude means larger Y excursion', () => {
    const target = makeTarget(textWave3dPrimitive);
    const inst = textWave3dPrimitive.create(target);
    const glyphs = (target.subject as Group).children;

    // Phase-step 0 so every glyph shares phase; seek to the sine peak (ph=PI/2).
    inst.setControl('phaseStep', 0);
    inst.setControl('speed', Math.PI / 2); // ph = t*speed at t=1 -> PI/2
    const baseY = glyphs[0].position.y;

    inst.setControl('amplitude', 0.05);
    inst.seek(1);
    const small = Math.abs(glyphs[0].position.y - baseY);

    inst.setControl('amplitude', 0.5);
    inst.seek(1);
    const large = Math.abs(glyphs[0].position.y - baseY);

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });
});
