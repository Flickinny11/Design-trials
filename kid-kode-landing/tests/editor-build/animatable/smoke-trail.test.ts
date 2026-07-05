import { describe, it, expect } from 'vitest';
import { smokeTrailPrimitive } from '@/lib/prism/animatable/primitives/smoke-trail';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };
type TrailState = { uTime: Uniform; uSpeed: Uniform; uWidth: Uniform; uDispersion: Uniform };

describe('smoke-trail primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(smokeTrailPrimitive).dispose();
  });

  it('plays: seek advances the time uniform so the trail snakes', () => {
    const target = makeTarget(smokeTrailPrimitive);
    const inst = smokeTrailPrimitive.create(target);
    const st = target.userData.smokeTrail as TrailState;

    inst.seek(0);
    const t0 = st.uTime.value;

    inst.seek(1.7);
    const tMid = st.uTime.value;

    inst.seek(3.4);
    const tLate = st.uTime.value;

    // The time uniform drives the parametric path; distinct seeks → distinct
    // phase, so the ribbon is at a different place each frame.
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    expect(tLate - t0).toBeGreaterThan(1);
    inst.dispose();
  });

  it('controls change output: width control drives the trail-width uniform', () => {
    const target = makeTarget(smokeTrailPrimitive);
    const inst = smokeTrailPrimitive.create(target);
    const st = target.userData.smokeTrail as TrailState;

    inst.setControl('width', 0.01);
    inst.seek(0.5);
    const narrow = st.uWidth.value;

    inst.setControl('width', 0.1);
    inst.seek(0.5);
    const wide = st.uWidth.value;

    expect(wide).toBeGreaterThan(narrow + 0.05);
    inst.dispose();
  });
});
