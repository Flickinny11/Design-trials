import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { motionBlurStreakPrimitive } from '@/lib/prism/animatable/primitives/motion-blur-streak';
import { makeTarget, runConformance } from './_conformance';

describe('motion-blur-streak primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(motionBlurStreakPrimitive).dispose();
  });

  it('plays: streaks (scale.x > 1) while moving, crisp (~1) at settle, and translates', () => {
    const target = makeTarget(motionBlurStreakPrimitive);
    const inst = motionBlurStreakPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    // Seek sequentially so per-seek velocity (closure prevX) is populated.
    inst.seek(0);
    const x0 = mesh.position.x;

    inst.seek(dur * 0.15);
    const scaleMid = mesh.scale.x;
    const xMid = mesh.position.x;

    inst.seek(dur);
    const scaleEnd = mesh.scale.x;
    const xEnd = mesh.position.x;

    // Stretched while moving fast early on...
    expect(scaleMid).toBeGreaterThan(1.05);
    // ...crisp at the settle.
    expect(scaleEnd).toBeCloseTo(1, 2);
    // Translates along X from an offset toward the origin.
    expect(xEnd).toBeGreaterThan(x0 + 0.3);
    expect(xMid).toBeGreaterThan(x0);
    inst.dispose();
  });

  it('controls change output: larger streak means a larger stretch at the same moving frame', () => {
    const probe = (streak: number): number => {
      const target = makeTarget(motionBlurStreakPrimitive);
      const inst = motionBlurStreakPrimitive.create(target);
      const mesh = target.subject as Mesh;
      const dur = inst.duration();
      inst.setControl('streak', streak);
      // Sequential seeks so velocity is computed against a real prior frame.
      inst.seek(0);
      inst.seek(dur * 0.12);
      const s = mesh.scale.x;
      inst.dispose();
      return s;
    };

    const small = probe(1.2);
    const large = probe(4);
    expect(large).toBeGreaterThan(small + 0.2);
  });
});
