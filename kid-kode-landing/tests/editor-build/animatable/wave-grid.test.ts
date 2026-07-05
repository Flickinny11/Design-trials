import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { waveGridPrimitive } from '@/lib/prism/animatable/primitives/wave-grid';
import { makeTarget, runConformance } from './_conformance';

/** Read the y of a given lattice point index from the Points geometry. */
function pointY(target: ReturnType<typeof makeTarget>, idx: number): number {
  let pts: Points | null = null;
  target.object.traverse((o) => {
    if ((o as Points).isPoints) pts = o as Points;
  });
  if (!pts) throw new Error('no Points built');
  const attr = (pts as Points).geometry.getAttribute('position') as BufferAttribute;
  return attr.getY(idx);
}

describe('wave-grid primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(waveGridPrimitive).dispose();
  });

  it('plays: a point\'s y changes across two distinct times', () => {
    const target = makeTarget(waveGridPrimitive);
    const inst = waveGridPrimitive.create(target);

    // Sample a non-center point so it sits on the moving wave.
    const idx = 137;
    inst.seek(0);
    const yEarly = pointY(target, idx);
    inst.seek(0.7);
    const yMid = pointY(target, idx);

    // Loop is continuous (duration Infinity); y must move between the frames.
    expect(Math.abs(yMid - yEarly)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: larger amplitude means larger height swing', () => {
    const target = makeTarget(waveGridPrimitive);
    const inst = waveGridPrimitive.create(target);
    const idx = 91;

    // Sweep a few frames and measure the peak |y| at small vs large amplitude.
    const peak = (): number => {
      let m = 0;
      for (let i = 0; i <= 6; i++) {
        inst.seek(i * 0.25);
        m = Math.max(m, Math.abs(pointY(target, idx)));
      }
      return m;
    };

    inst.setControl('ripple', 0); // isolate the crossing-wave amplitude
    inst.setControl('amplitude', 0.05);
    const small = peak();

    inst.setControl('amplitude', 1.2);
    const large = peak();

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
