import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { liquidFillSimPrimitive } from '@/lib/prism/animatable/primitives/liquid-fill-sim';
import { makeTarget, runConformance } from './_conformance';

// Helper: pull the liquid surface mesh's wave-height range (max |z|) at the
// current frame. The surface is a height-field grid; non-trivial |z| spread is
// proof of genuine sloshing (not a flat plane).
function surfaceWaveRange(target: ReturnType<typeof makeTarget>): number {
  let surface: Mesh | null = null;
  target.object.traverse((o) => {
    if (o.name === 'liquid-surface') surface = o as Mesh;
  });
  if (!surface) return 0;
  const pos = (surface as Mesh).geometry.getAttribute('position') as BufferAttribute;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z < lo) lo = z;
    if (z > hi) hi = z;
  }
  return hi - lo;
}

describe('liquid-fill-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(liquidFillSimPrimitive).dispose();
  });

  it('fills the vessel and the surface sloshes with real waves (not a flat fake)', () => {
    const target = makeTarget(liquidFillSimPrimitive);
    const inst = liquidFillSimPrimitive.create(target);

    inst.seek(0);
    const level0 = target.userData.fillLevel as number;

    // March the fill: the level must rise monotonically toward the cap, and the
    // surface must develop genuine wave displacement (sloshing) while filling.
    const dt = 1 / 60;
    let prevLevel = level0;
    let roseEveryStep = true;
    let maxWave = 0;
    for (let k = 1; k <= 180; k++) {
      inst.seek(k * dt);
      const lvl = target.userData.fillLevel as number;
      if (lvl < prevLevel - 1e-6) roseEveryStep = false; // never goes down
      prevLevel = lvl;
      maxWave = Math.max(maxWave, surfaceWaveRange(target));
    }

    expect(level0).toBeLessThan(0.05); // started essentially empty
    expect(prevLevel).toBeGreaterThan(0.4); // it actually filled up
    expect(roseEveryStep).toBe(true); // the level rises, never drains
    expect(maxWave).toBeGreaterThan(1e-3); // the surface genuinely sloshed

    inst.dispose();
  });

  it('wave-tension is live at the frozen pin (sweeping it changes the same-t surface)', () => {
    const target = makeTarget(liquidFillSimPrimitive);
    const inst = liquidFillSimPrimitive.create(target);

    // Pin a mid-fill engaged frame where the surface is actively sloshing.
    const dur = inst.duration();
    const PIN = dur * 0.45;

    // Same pinned t, two different wave tensions: the surface wave field must
    // differ (reset-replay + markDirty → frame is a pure function of params).
    inst.setControl('waveTension', 8);
    inst.seek(PIN);
    const waveLow = surfaceWaveRange(target);

    inst.setControl('waveTension', 32);
    inst.seek(PIN);
    const waveHigh = surfaceWaveRange(target);

    expect(Math.abs(waveHigh - waveLow)).toBeGreaterThan(1e-4);

    // The fill LEVEL control is also live at the pin: a lower cap leaves a
    // visibly lower surface at the same time.
    let surfMesh: Mesh | null = null;
    target.object.traverse((o) => {
      if (o.name === 'liquid-surface') surfMesh = o as Mesh;
    });
    inst.setControl('level', 0.9);
    inst.seek(PIN);
    const yHigh = (surfMesh as unknown as Mesh).position.y;
    inst.setControl('level', 0.35);
    inst.seek(PIN);
    const yLow = (surfMesh as unknown as Mesh).position.y;
    expect(yHigh).toBeGreaterThan(yLow + 1e-3);

    inst.dispose();
  });
});
