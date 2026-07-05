import { describe, it, expect } from 'vitest';
import { Mesh, Color, type Material } from 'three';
import { textWaveColorPrimitive } from '@/lib/prism/animatable/primitives/text-wave-color';
import { makeTarget, runConformance } from './_conformance';

/** Grab the first glyph child mesh's color/emissive material. */
function firstGlyphMat(target: ReturnType<typeof makeTarget>) {
  const root = target.subject ?? target.object;
  let found: (Material & { color: Color; emissive: Color; emissiveIntensity: number }) | null = null;
  root.traverse((o) => {
    if (found) return;
    const m = (o as Mesh).material;
    if (m && !Array.isArray(m) && 'emissiveIntensity' in (m as object) && 'color' in (m as object)) {
      found = m as Material & { color: Color; emissive: Color; emissiveIntensity: number };
    }
  });
  if (!found) throw new Error('no glyph material found');
  return found;
}

describe('text-wave-color primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textWaveColorPrimitive).dispose();
  });

  it('plays: a glyph hue cycles across two distinct loop times', () => {
    const target = makeTarget(textWaveColorPrimitive);
    const inst = textWaveColorPrimitive.create(target);
    const mat = firstGlyphMat(target);

    // Looping primitive (duration Infinity): pick two distinct t values.
    inst.seek(0.0);
    const hsl0 = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(hsl0);
    const h0 = hsl0.h;
    const r0 = mat.color.r;

    inst.seek(1.7);
    const hsl1 = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(hsl1);
    const h1 = hsl1.h;
    const r1 = mat.color.r;

    // The glyph's hue must differ between the two frames (travelling rainbow).
    expect(Math.abs(h1 - h0)).toBeGreaterThan(0.01);
    // And a concrete color channel must change too.
    expect(Math.abs(r1 - r0)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: faster speed shifts hue further over the same time', () => {
    const target = makeTarget(textWaveColorPrimitive);
    const inst = textWaveColorPrimitive.create(target);
    const mat = firstGlyphMat(target);
    const T = 0.5;

    // Slow speed → small hue advance at time T.
    inst.setControl('speed', 0.1);
    inst.seek(0);
    const slowStart = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(slowStart);
    inst.seek(T);
    const slowEnd = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(slowEnd);
    const slowDelta = Math.abs(slowEnd.h - slowStart.h);

    // Fast speed → larger hue advance at the same time T.
    inst.setControl('speed', 3);
    inst.seek(0);
    const fastStart = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(fastStart);
    inst.seek(T);
    const fastEnd = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(fastEnd);
    const fastDelta = Math.abs(fastEnd.h - fastStart.h);

    expect(fastDelta).toBeGreaterThan(slowDelta + 0.05);
    inst.dispose();
  });
});
