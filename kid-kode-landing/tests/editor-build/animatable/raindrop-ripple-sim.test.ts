import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { raindropRippleSimPrimitive } from '@/lib/prism/animatable/primitives/raindrop-ripple-sim';
import { makeTarget, runConformance } from './_conformance';

/** Max abs vertex-z displacement of the plane subject from its rest plane. */
function maxAbsZ(subject: Mesh): number {
  const attr = (subject.geometry.getAttribute('position') as BufferAttribute);
  let m = 0;
  for (let i = 0; i < attr.count; i++) {
    const z = Math.abs(attr.getZ(i));
    if (z > m) m = z;
  }
  return m;
}

/** Snapshot of all vertex z values. */
function snapshotZ(subject: Mesh): Float32Array {
  const attr = subject.geometry.getAttribute('position') as BufferAttribute;
  const out = new Float32Array(attr.count);
  for (let i = 0; i < attr.count; i++) out[i] = attr.getZ(i);
  return out;
}

describe('raindrop-ripple-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(raindropRippleSimPrimitive).dispose();
  });

  it('drops impact and propagate real ripples into the height field (a living surface, not a flat plane)', () => {
    const target = makeTarget(raindropRippleSimPrimitive);
    const subject = target.subject as Mesh;
    const inst = raindropRippleSimPrimitive.create(target);

    // At t=0 the pool is flat (no impacts have landed yet).
    inst.seek(0);
    expect(maxAbsZ(subject)).toBeLessThan(1e-4);

    // Run a few seconds: drops land, each splats a ripple, the wave equation
    // propagates them. The surface must develop genuine displacement.
    let peak = 0;
    for (let k = 1; k <= 240; k++) {
      inst.seek(k * (1 / 60));
      peak = Math.max(peak, maxAbsZ(subject));
    }
    expect(peak).toBeGreaterThan(0.02); // the surface really moved

    // Propagation check: the surface keeps EVOLVING frame-to-frame (a static
    // sine sheet at fixed phase would not — here rings travel outward and
    // interfere). Compare two nearby frames mid-simulation.
    inst.seek(3.0);
    const a = snapshotZ(subject);
    inst.seek(3.0 + 1 / 30);
    const b = snapshotZ(subject);
    let moved = 0;
    for (let i = 0; i < a.length; i++) moved += Math.abs(b[i] - a[i]);
    expect(moved).toBeGreaterThan(1e-3); // waves are alive, not frozen

    inst.dispose();
  });

  it('surface tension changes the frozen frame (control is live at a pinned t)', () => {
    const target = makeTarget(raindropRippleSimPrimitive);
    const subject = target.subject as Mesh;
    const inst = raindropRippleSimPrimitive.create(target);

    // A mid-action engaged pin: several drops have landed and rings are spreading.
    const PIN = 2.4;

    // Low tension → slow, tight ripples; high tension → faster, wider rings. At
    // the SAME pinned t the surface must differ (reset-replay + markDirty).
    inst.setControl('tension', 8);
    inst.seek(PIN);
    const lowT = snapshotZ(subject);

    inst.setControl('tension', 28);
    inst.seek(PIN);
    const highT = snapshotZ(subject);

    let diff = 0;
    for (let i = 0; i < lowT.length; i++) diff += Math.abs(highT[i] - lowT[i]);
    expect(diff).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
