import { describe, it, expect } from 'vitest';
import { Mesh, type Material, type Object3D } from 'three';
import { textSpotlightPrimitive } from '@/lib/prism/animatable/primitives/text-spotlight';
import { makeTarget, runConformance } from './_conformance';

type EmissiveMat = Material & { emissiveIntensity: number };

/** Ordered list of glyph emissive materials (matches primitive traversal). */
function glyphMats(root: Object3D): EmissiveMat[] {
  const out: EmissiveMat[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m && !Array.isArray(m) && 'emissiveIntensity' in (m as object)) {
      out.push(m as EmissiveMat);
    }
  });
  return out;
}

describe('text-spotlight primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textSpotlightPrimitive).dispose();
  });

  it('plays: a mid-row glyph peaks emissive as the band crosses it', () => {
    const target = makeTarget(textSpotlightPrimitive);
    const inst = textSpotlightPrimitive.create(target);
    const mats = glyphMats(target.subject as Object3D);
    expect(mats.length).toBeGreaterThan(2);

    // Middle glyph (normalized x ~0.5) — brightest near the middle of the sweep.
    const mid = mats[Math.floor(mats.length / 2)];
    const dur = inst.duration();

    inst.seek(0);
    const atStart = mid.emissiveIntensity;

    inst.seek(dur * 0.5);
    const atMid = mid.emissiveIntensity;

    inst.seek(dur);
    const atEnd = mid.emissiveIntensity;

    // The band is over the mid glyph at half the sweep -> brighter than start
    // and brighter than the settled end glow.
    expect(atMid).toBeGreaterThan(atStart + 0.5);
    expect(atMid).toBeGreaterThan(atEnd + 0.5);
    inst.dispose();
  });

  it('controls change output: larger peak means a brighter crossing', () => {
    const target = makeTarget(textSpotlightPrimitive);
    const inst = textSpotlightPrimitive.create(target);
    const mats = glyphMats(target.subject as Object3D);
    const mid = mats[Math.floor(mats.length / 2)];
    const dur = inst.duration();

    inst.setControl('peak', 0.5);
    inst.seek(dur * 0.5);
    const lowPeak = mid.emissiveIntensity;

    inst.setControl('peak', 4);
    inst.seek(dur * 0.5);
    const highPeak = mid.emissiveIntensity;

    expect(highPeak).toBeGreaterThan(lowPeak + 0.5);
    inst.dispose();
  });
});
