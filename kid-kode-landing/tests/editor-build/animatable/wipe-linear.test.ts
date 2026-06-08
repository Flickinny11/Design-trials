import { describe, it, expect } from 'vitest';
import { wipeLinearPrimitive } from '@/lib/prism/animatable/primitives/wipe-linear';
import { makeTarget, runConformance } from './_conformance';

interface UniformHandle {
  value: number;
}

describe('wipe-linear primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(wipeLinearPrimitive).dispose();
  });

  it('plays: the wipe front (uProgress) advances across the timeline', () => {
    const target = makeTarget(wipeLinearPrimitive);
    const inst = wipeLinearPrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0);
    const start = (target.userData.wipeProgress as UniformHandle).value;

    inst.seek(dur * 0.5);
    const mid = (target.userData.wipeProgress as UniformHandle).value;

    inst.seek(dur);
    const end = (target.userData.wipeProgress as UniformHandle).value;

    // A mid frame differs from t=0 AND from the settled end — a moving front.
    expect(mid).toBeGreaterThan(start + 0.05);
    expect(end).toBeGreaterThan(mid + 0.05);
    inst.dispose();
  });

  it('controls change output: direction control routes through to params', () => {
    const target = makeTarget(wipeLinearPrimitive);
    const inst = wipeLinearPrimitive.create(target);

    inst.setControl('direction', 'ltr');
    inst.seek(0.3);
    const paramsLtr = inst.getParams().direction;

    inst.setControl('direction', 'ttb');
    inst.seek(0.3);
    const paramsTtb = inst.getParams().direction;

    expect(paramsLtr).toBe('ltr');
    expect(paramsTtb).toBe('ttb');
    expect(paramsLtr).not.toBe(paramsTtb);
    inst.dispose();
  });

  it('controls change output: larger softness widens the front padding (later end progress)', () => {
    const target = makeTarget(wipeLinearPrimitive);
    const inst = wipeLinearPrimitive.create(target);
    const dur = inst.duration();

    inst.setControl('softness', 0.0);
    inst.seek(dur);
    const endSharp = (target.userData.wipeProgress as UniformHandle).value;

    inst.setControl('softness', 0.4);
    inst.seek(dur);
    const endSoft = (target.userData.wipeProgress as UniformHandle).value;

    // softness pads uProgress so the soft front fully clears the edge.
    expect(endSoft).toBeGreaterThan(endSharp + 0.1);
    inst.dispose();
  });
});
