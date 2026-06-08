import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { blindsWipePrimitive } from '@/lib/prism/animatable/primitives/blinds-wipe';
import { makeTarget, runConformance } from './_conformance';

interface UniformHandle {
  value: number;
}

describe('blinds-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(blindsWipePrimitive).dispose();
  });

  it('plays: the slat-open progress (uProgress) advances 0 -> 1 across the timeline', () => {
    const target = makeTarget(blindsWipePrimitive);
    const inst = blindsWipePrimitive.create(target);
    const mat = (target.subject as Mesh).material as unknown as Record<string, unknown> & {
      transparent: boolean;
    };
    // The card material is swapped for a transparent node material whose alpha
    // is a TSL step() mask over fract-striped uv.
    expect(mat.transparent).toBe(true);
    expect(mat.opacityNode).toBeDefined();

    const dur = inst.duration();

    inst.seek(0);
    const start = (target.userData.blindsProgress as UniformHandle).value;

    inst.seek(dur * 0.5);
    const mid = (target.userData.blindsProgress as UniformHandle).value;

    inst.seek(dur);
    const end = (target.userData.blindsProgress as UniformHandle).value;

    // A mid frame differs from t=0 AND from the settled end — the slats open.
    expect(mid).toBeGreaterThan(start + 0.05);
    expect(end).toBeGreaterThan(mid + 0.05);
    expect(end).toBeCloseTo(1, 5);
    inst.dispose();
  });

  it('controls change output: slat count routes through to the stripe uniform', () => {
    const target = makeTarget(blindsWipePrimitive);
    const inst = blindsWipePrimitive.create(target);

    inst.setControl('slats', 3);
    inst.seek(0.3);
    const few = (target.userData.blindsSlats as UniformHandle).value;

    inst.setControl('slats', 24);
    inst.seek(0.3);
    const many = (target.userData.blindsSlats as UniformHandle).value;

    expect(few).toBe(3);
    expect(many).toBe(24);
    expect(many).toBeGreaterThan(few + 1);
    inst.dispose();
  });

  it('controls: dispose restores the original card material', () => {
    const target = makeTarget(blindsWipePrimitive);
    const original = (target.subject as Mesh).material; // capture before swap
    const inst = blindsWipePrimitive.create(target);
    inst.dispose();
    expect((target.subject as Mesh).material).toBe(original);
  });
});
