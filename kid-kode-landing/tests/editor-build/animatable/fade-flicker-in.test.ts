import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { fadeFlickerInPrimitive } from '@/lib/prism/animatable/primitives/fade-flicker-in';
import { makeTarget, runConformance } from './_conformance';

describe('fade-flicker-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fadeFlickerInPrimitive).dispose();
  });

  it('plays: opacity flickers (non-monotonic early) then settles steady at 1', () => {
    const target = makeTarget(fadeFlickerInPrimitive);
    const inst = fadeFlickerInPrimitive.create(target);
    const mat = (target.subject as Mesh).material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const op0 = mat.opacity;

    // Sample many early/mid frames; with deterministic stutters opacity is
    // NOT monotonically increasing — at least one frame dips below a prior one.
    const samples: number[] = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      inst.seek((i / N) * dur);
      samples.push(mat.opacity);
    }

    let dipped = false;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i] < samples[i - 1] - 1e-4) dipped = true;
    }
    expect(dipped, 'opacity dips somewhere — flicker, not a clean ramp').toBe(true);

    // Mid frame visibly differs from t=0 (motion).
    inst.seek(dur * 0.5);
    const opMid = mat.opacity;
    expect(Math.abs(opMid - op0)).toBeGreaterThan(0.05);

    // End settles to a steady, fully-opaque card.
    inst.seek(dur);
    expect(mat.opacity).toBeCloseTo(1, 4);
    // ...and stays put just before the end (no stutter at the lock point).
    inst.seek(dur * 0.999);
    expect(mat.opacity).toBeGreaterThan(0.95);

    inst.dispose();
    expect(mat.opacity).toBeCloseTo(1, 4); // restored to base
  });

  it('controls change output: higher intensity deepens the flicker dip', () => {
    const target = makeTarget(fadeFlickerInPrimitive);
    const inst = fadeFlickerInPrimitive.create(target);
    const mat = (target.subject as Mesh).material as Material & { opacity: number };
    const dur = inst.duration();

    // Total opacity deficit relative to a clean ramp, accumulated over the
    // mid timeline (where the (1-phase) factor still lets stutters bite).
    // At intensity 0 there is NO flicker subtraction, so deficit is ~0; at
    // intensity 1 every nonzero-stutter step pulls opacity below the ramp.
    const N = 80;
    const sampleSum = (): number => {
      let sum = 0;
      for (let i = 1; i < N; i++) {
        inst.seek((i / N) * dur);
        sum += mat.opacity;
      }
      return sum;
    };

    inst.setControl('intensity', 0);
    const calmSum = sampleSum();

    inst.setControl('intensity', 1);
    const wildSum = sampleSum();

    // The wild (flickering) run accumulates strictly less opacity than the calm
    // (clean ramp) run — the dips are real, observable, and control-driven.
    expect(calmSum).toBeGreaterThan(wildSum + 0.5);

    inst.dispose();
  });
});
