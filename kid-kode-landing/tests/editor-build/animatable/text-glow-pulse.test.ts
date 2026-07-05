import { describe, it, expect } from 'vitest';
import { Mesh, type MeshStandardMaterial } from 'three';
import { textGlowPulsePrimitive } from '@/lib/prism/animatable/primitives/text-glow-pulse';
import { makeTarget, runConformance } from './_conformance';

/** First glyph material's emissiveIntensity (stable child order). */
function firstGlyphIntensity(object: { traverse: (cb: (o: object) => void) => void }): number {
  let found: number | null = null;
  object.traverse((o: object) => {
    if (found !== null) return;
    const m = (o as Mesh).material;
    if (!m) return;
    const mat = (Array.isArray(m) ? m[0] : m) as MeshStandardMaterial;
    if (typeof mat.emissiveIntensity === 'number') found = mat.emissiveIntensity;
  });
  return found ?? 0;
}

describe('text-glow-pulse primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textGlowPulsePrimitive).dispose();
  });

  it('plays: emissiveIntensity pulses between two distinct frames', () => {
    const target = makeTarget(textGlowPulsePrimitive);
    const inst = textGlowPulsePrimitive.create(target);

    // Pin controls so the pulse extremes are deterministic & far apart.
    inst.setControl('loGlow', 0);
    inst.setControl('hiGlow', 3);
    inst.setControl('speed', 1);
    inst.setControl('phaseStep', 0); // uniform pulse across glyphs

    // sin trough near t where t*speed = -pi/2 → 3pi/2; pick clean phase values.
    inst.seek(Math.PI * 1.5); // wave = 0.5 + 0.5*sin(3pi/2) = 0  → ~lo
    const low = firstGlyphIntensity(target.object);

    inst.seek(Math.PI * 0.5); // wave = 0.5 + 0.5*sin(pi/2) = 1   → ~hi
    const high = firstGlyphIntensity(target.object);

    expect(high).toBeGreaterThan(low + 1.0);
    inst.dispose();
  });

  it('controls change output: higher hiGlow yields a brighter peak', () => {
    const target = makeTarget(textGlowPulsePrimitive);
    const inst = textGlowPulsePrimitive.create(target);
    inst.setControl('loGlow', 0);
    inst.setControl('speed', 1);
    inst.setControl('phaseStep', 0);

    const peakT = Math.PI * 0.5; // wave = 1

    inst.setControl('hiGlow', 0.5);
    inst.seek(peakT);
    const dim = firstGlyphIntensity(target.object);

    inst.setControl('hiGlow', 3);
    inst.seek(peakT);
    const bright = firstGlyphIntensity(target.object);

    expect(bright).toBeGreaterThan(dim + 1.0);
    inst.dispose();
  });
});
