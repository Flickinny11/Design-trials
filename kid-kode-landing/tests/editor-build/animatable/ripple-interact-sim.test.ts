import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { rippleInteractSimPrimitive } from '@/lib/prism/animatable/primitives/ripple-interact-sim';
import { makeTarget, runConformance } from './_conformance';

// Snapshot the plane's per-vertex z displacement (the water height field written
// into the geometry) so we can assert genuine, evolving wave motion.
function readZ(target: ReturnType<typeof makeTarget>): Float32Array {
  const mesh = target.subject as Mesh;
  const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
  const out = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) out[i] = pos.getZ(i);
  return out;
}

function maxAbs(a: Float32Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  return m;
}

function meanAbsDiff(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return s / n;
}

describe('ripple-interact-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(rippleInteractSimPrimitive).dispose();
  });

  it('pokes a wave-equation surface that propagates and evolves (real sim, not a flat plane)', () => {
    const target = makeTarget(rippleInteractSimPrimitive);
    const inst = rippleInteractSimPrimitive.create(target);

    // t=0 → the surface is pre-seeded with several propagating, interfering
    // ripple systems (advocate-directed: the prior flat-at-t=0 surface read as a
    // dead blue square). So even the first captured frame is genuinely displaced.
    inst.seek(0);
    const z0 = readZ(target);
    expect(maxAbs(z0)).toBeGreaterThan(1e-3);

    // After the running poke schedule fires and the field integrates forward, the
    // surface is still genuinely displaced (a height disturbance, not zero).
    inst.seek(0.5);
    const zMid = readZ(target);
    expect(maxAbs(zMid)).toBeGreaterThan(1e-3);

    // The field keeps EVOLVING — a snapshot at a later time differs from the
    // earlier one (wavefronts travel / reflect / interfere): the t=0 pre-seed
    // frame, the mid frame, and the late frame are all materially different.
    expect(meanAbsDiff(z0, zMid)).toBeGreaterThan(1e-4);
    inst.seek(0.9);
    const zLate = readZ(target);
    expect(meanAbsDiff(zMid, zLate)).toBeGreaterThan(1e-4);

    // Stateful integrator: replaying backward reproduces the exact frame
    // (determinism the harness relies on).
    inst.seek(0.5);
    const zReplay = readZ(target);
    expect(meanAbsDiff(zMid, zReplay)).toBeLessThan(1e-9);

    inst.dispose();
  });

  it('tension changes the frozen frame at a pinned t (control is live — markDirty)', () => {
    const target = makeTarget(rippleInteractSimPrimitive);
    const inst = rippleInteractSimPrimitive.create(target);

    // Mid-action pin: several pokes have fired and are propagating/interfering.
    const PIN = 0.8;

    inst.setControl('tension', 8);
    inst.seek(PIN);
    const slow = readZ(target);

    inst.setControl('tension', 28);
    inst.seek(PIN);
    const fast = readZ(target);

    // Higher tension → faster wavefronts → a materially different surface at the
    // SAME pinned t. Proves the trajectory-only control re-runs the sim.
    expect(meanAbsDiff(slow, fast)).toBeGreaterThan(1e-4);

    // Poke strength is also read live in write(): sweeping it changes the pin too.
    inst.setControl('pokeStrength', 0.3);
    inst.seek(PIN);
    const weak = readZ(target);
    inst.setControl('pokeStrength', 2.2);
    inst.seek(PIN);
    const strong = readZ(target);
    expect(maxAbs(strong)).toBeGreaterThan(maxAbs(weak));

    inst.dispose();
  });
});
