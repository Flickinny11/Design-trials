import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { crystalBallPrimitive } from '@/lib/prism/animatable/primitives/crystal-ball';
import { makeTarget, runConformance } from './_conformance';

describe('crystal-ball primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(crystalBallPrimitive).dispose();
  });

  it('plays: internal light-play uniform advances over the timeline', () => {
    const target = makeTarget(crystalBallPrimitive);
    const inst = crystalBallPrimitive.create(target);
    const u = target.userData.crystalBall as { uTime: { value: number } };

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(1.5);
    const tMid = u.uTime.value;

    inst.seek(3.0);
    const tLate = u.uTime.value;

    // The driven time uniform must advance (drives the internal sparkle drift).
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    inst.dispose();
  });

  it('controls change output: larger thickness means stronger magnification', () => {
    const target = makeTarget(crystalBallPrimitive);
    const inst = crystalBallPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { thickness: number };

    inst.setControl('thickness', 1);
    inst.seek(0.5);
    const thin = mat.thickness;

    inst.setControl('thickness', 5);
    inst.seek(0.5);
    const thick = mat.thickness;

    expect(thick).toBeGreaterThan(thin + 1);
    inst.dispose();
  });
});
