import { describe, it, expect } from 'vitest';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { neonFlickerTextPrimitive } from '@/lib/prism/animatable/primitives/neon-flicker-text';
import { makeTarget, runConformance } from './_conformance';

/** Pull every glyph's emissiveIntensity off the text subject. */
function intensities(subject: Group): number[] {
  const out: number[] = [];
  subject.traverse((o) => {
    const m = (o as Mesh).material;
    if (m instanceof MeshStandardMaterial) out.push(m.emissiveIntensity);
  });
  return out;
}

describe('neon-flicker-text primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(neonFlickerTextPrimitive).dispose();
  });

  it('plays: emissiveIntensity flickers (varies across early frames)', () => {
    const target = makeTarget(neonFlickerTextPrimitive);
    const inst = neonFlickerTextPrimitive.create(target);
    const subject = target.subject as Group;

    // Two distinct early times — looping/erratic phase. The summed glow must
    // differ between them (deterministic flicker, not a static value).
    inst.seek(0.05);
    const early = intensities(subject);
    const sumEarly = early.reduce((a, b) => a + b, 0);

    inst.seek(0.5);
    const mid = intensities(subject);
    const sumMid = mid.reduce((a, b) => a + b, 0);

    expect(early.length).toBeGreaterThan(0);
    expect(Math.abs(sumMid - sumEarly)).toBeGreaterThan(0.05);

    // Settled bright: late in the timeline the flicker damps to a near-steady
    // bright value, so the per-frame variance drops vs the early erratic phase.
    const spread = (vals: number[]) => Math.max(...vals) - Math.min(...vals);
    inst.seek(0.05);
    const spreadEarly = spread(intensities(subject));
    inst.seek(20);
    const spreadLate = spread(intensities(subject));
    expect(spreadLate).toBeLessThan(spreadEarly + 1e-6);

    inst.dispose();
    // Dispose restores the base emissiveIntensity.
    const restored = intensities(subject);
    expect(restored.every((v) => v > 0)).toBe(true);
  });

  it('controls change output: larger flickerDepth widens the swing', () => {
    const target = makeTarget(neonFlickerTextPrimitive);
    const inst = neonFlickerTextPrimitive.create(target);
    const subject = target.subject as Group;
    const spread = (vals: number[]) => Math.max(...vals) - Math.min(...vals);

    inst.setControl('flickerDepth', 0);
    inst.seek(0.05);
    const flat = spread(intensities(subject));

    inst.setControl('flickerDepth', 3);
    inst.seek(0.05);
    const wide = spread(intensities(subject));

    expect(wide).toBeGreaterThan(flat + 0.1);
    inst.dispose();
  });
});
