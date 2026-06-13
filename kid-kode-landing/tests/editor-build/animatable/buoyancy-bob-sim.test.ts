import { describe, it, expect } from 'vitest';
import { Mesh, type Group, type BufferAttribute } from 'three';
import { buoyancyBobSimPrimitive } from '@/lib/prism/animatable/primitives/buoyancy-bob-sim';
import { makeTarget, runConformance } from './_conformance';

/** Find the buoy group the primitive adds under target.object. */
function findBuoy(object: { getObjectByName: (n: string) => Group | undefined }): Group {
  const buoy = object.getObjectByName('buoyancy-buoy');
  if (!buoy) throw new Error('buoy not found');
  return buoy as Group;
}

/** Peak-to-peak Z displacement of the water height-field plane. */
function waterAmplitude(object: { getObjectByName: (n: string) => Mesh | undefined }): number {
  const water = object.getObjectByName('buoyancy-water') as Mesh | undefined;
  if (!water) throw new Error('water not found');
  const pos = water.geometry.getAttribute('position') as BufferAttribute;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    lo = Math.min(lo, z);
    hi = Math.max(hi, z);
  }
  return hi - lo;
}

describe('buoyancy-bob-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(buoyancyBobSimPrimitive).dispose();
  });

  it('runs a real wave-equation water surface that develops traveling swells', () => {
    const target = makeTarget(buoyancyBobSimPrimitive);
    const inst = buoyancyBobSimPrimitive.create(target);

    // Early frame: barely any surface relief yet.
    inst.seek(0.05);
    const early = waterAmplitude(target.object as never);

    // Later: swells have been injected and propagated → much more relief.
    let maxAmp = early;
    for (let k = 1; k <= 40; k++) {
      inst.seek(k * 0.1);
      maxAmp = Math.max(maxAmp, waterAmplitude(target.object as never));
    }
    expect(maxAmp).toBeGreaterThan(0.05); // genuine surface waves
    expect(maxAmp).toBeGreaterThan(early + 0.02); // they grew/propagated

    inst.dispose();
  });

  it('floats a buoy that BOBS up and down on the passing swells (real momentum, not a flat ride)', () => {
    const target = makeTarget(buoyancyBobSimPrimitive);
    const inst = buoyancyBobSimPrimitive.create(target);
    const buoy = findBuoy(target.object as never);

    // Sample the buoy height over time; a real float on swells rises, falls, and
    // reverses (a sign change in per-frame vertical delta = bobbing momentum).
    const dt = 1 / 60;
    inst.seek(0);
    let prevY = buoy.position.y;
    let prevDelta = 0;
    let minY = prevY;
    let maxY = prevY;
    let sawReversal = false;
    for (let k = 1; k <= 360; k++) {
      inst.seek(k * dt);
      const cy = buoy.position.y;
      const delta = cy - prevY;
      minY = Math.min(minY, cy);
      maxY = Math.max(maxY, cy);
      if (k > 4 && prevDelta > 1e-5 && delta < -1e-5) sawReversal = true; // crest → fall
      if (Math.abs(delta) > 1e-9) prevDelta = delta;
      prevY = cy;
    }
    expect(maxY - minY).toBeGreaterThan(0.02); // it actually bobs vertically
    expect(sawReversal).toBe(true); // it rides crests and troughs (momentum)

    inst.dispose();
  });

  it('tilts the hull to the surface slope as swells pass', () => {
    const target = makeTarget(buoyancyBobSimPrimitive);
    const inst = buoyancyBobSimPrimitive.create(target);
    const buoy = findBuoy(target.object as never);

    let maxTilt = 0;
    for (let k = 0; k <= 360; k++) {
      inst.seek(k / 60);
      maxTilt = Math.max(maxTilt, Math.abs(buoy.rotation.x), Math.abs(buoy.rotation.z));
    }
    expect(maxTilt).toBeGreaterThan(0.02); // it leans into the water, not rigid

    inst.dispose();
  });

  it('buoyancy control is LIVE at a frozen mid-action pin (markDirty re-runs the sim)', () => {
    const target = makeTarget(buoyancyBobSimPrimitive);
    const inst = buoyancyBobSimPrimitive.create(target);
    const buoy = findBuoy(target.object as never);

    // Pin a mid-action frame (~0.45 phase of duration 6).
    const PIN = 2.7;

    inst.setControl('buoyancy', 6);
    inst.seek(PIN);
    const softY = buoy.position.y;

    inst.setControl('buoyancy', 38);
    inst.seek(PIN);
    const stiffY = buoy.position.y;

    // Different buoyancy → different bob trajectory to the SAME pinned t.
    expect(Math.abs(stiffY - softY)).toBeGreaterThan(1e-3);

    // And a surface control (waveAmp) also changes the frozen water relief.
    inst.setControl('waveAmp', 0.06);
    inst.seek(PIN);
    const calmWater = waterAmplitude(target.object as never);
    inst.setControl('waveAmp', 0.55);
    inst.seek(PIN);
    const roughWater = waterAmplitude(target.object as never);
    expect(roughWater).toBeGreaterThan(calmWater + 1e-3);

    inst.dispose();
  });
});
