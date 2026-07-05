import { describe, it, expect } from 'vitest';
import { Mesh, Color, type Material } from 'three';
import { textGradientSweepPrimitive } from '@/lib/prism/animatable/primitives/text-gradient-sweep';
import { makeTarget, runConformance } from './_conformance';

type GlyphMat = Material & { color: Color; emissive: Color; emissiveIntensity: number };

/** Collect glyph materials of the text subject in row order. */
function glyphMats(subjectRoot: import('three').Object3D): GlyphMat[] {
  const out: GlyphMat[] = [];
  subjectRoot.traverse((o) => {
    const m = (o as Mesh).material;
    if (m && !Array.isArray(m) && 'emissiveIntensity' in (m as object) && 'color' in (m as object)) {
      out.push(m as GlyphMat);
    }
  });
  return out;
}

describe('text-gradient-sweep primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textGradientSweepPrimitive).dispose();
  });

  it('plays: a mid glyph recolors and peaks emissive as the band crosses it', () => {
    const target = makeTarget(textGradientSweepPrimitive);
    const inst = textGradientSweepPrimitive.create(target);
    const mats = glyphMats(target.subject!);
    const mid = mats[Math.floor(mats.length / 2)];
    const dur = inst.duration();

    // t=0: band has not reached the middle glyph yet — emissive at/near base.
    inst.seek(0);
    const emiStart = mid.emissiveIntensity;
    const greenStart = mid.emissive.g;

    // Mid-timeline: the band crosses the middle glyph → emissive peaks well above base.
    inst.seek(dur * 0.5);
    const emiMid = mid.emissiveIntensity;
    const greenMid = mid.emissive.g;

    // The band drives a concrete numeric rise in emissive intensity at the crossing.
    expect(emiMid).toBeGreaterThan(emiStart + 0.5);
    // And a concrete recolor: the sweep color (#ffd24a, high green) raises the
    // emissive green channel relative to the cool base tint.
    expect(greenMid).toBeGreaterThan(greenStart + 0.05);

    inst.dispose();
    // dispose restores the original glyph material.
    expect(mid.emissiveIntensity).not.toBe(emiMid);
  });

  it('controls change output: a wider band lights the mid glyph more at a probe time', () => {
    const target = makeTarget(textGradientSweepPrimitive);
    const inst = textGradientSweepPrimitive.create(target);
    const mats = glyphMats(target.subject!);
    const mid = mats[Math.floor(mats.length / 2)];
    const dur = inst.duration();
    // Probe slightly off the exact crossing so band width visibly matters.
    const probe = dur * 0.4;

    inst.setControl('width', 0.05);
    inst.seek(probe);
    const narrow = mid.emissiveIntensity;

    inst.setControl('width', 0.5);
    inst.seek(probe);
    const wide = mid.emissiveIntensity;

    // A wider band reaches/covers the mid glyph more strongly off-center → brighter.
    expect(wide).toBeGreaterThan(narrow + 0.1);
    inst.dispose();
  });
});
