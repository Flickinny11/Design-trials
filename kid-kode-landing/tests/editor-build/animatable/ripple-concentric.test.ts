import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { rippleConcentricPrimitive } from '@/lib/prism/animatable/primitives/ripple-concentric';
import { makeTarget, runConformance } from './_conformance';

// Find a vertex at mid radius (not the dead-center, not the far corner) so the
// concentric displacement is clearly observable on CPU.
function midRadiusIndex(mesh: Mesh): number {
  const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
  let best = 0;
  let bestErr = Infinity;
  const targetR = 0.5; // plane is 1.8 wide → max radius ~1.27
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    const err = Math.abs(r - targetR);
    if (err < bestErr) {
      bestErr = err;
      best = i;
    }
  }
  return best;
}

describe('ripple-concentric primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(rippleConcentricPrimitive).dispose();
  });

  it('plays: a mid-radius vertex z varies across time', () => {
    const target = makeTarget(rippleConcentricPrimitive);
    const inst = rippleConcentricPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
    const idx = midRadiusIndex(mesh);

    // Sample z at several distinct times along the steady (Infinite) pulse.
    const samples: number[] = [];
    for (const t of [0, 0.35, 0.7, 1.1, 1.6]) {
      inst.seek(t);
      samples.push(pos.getZ(idx));
    }

    // The mid-radius vertex must displace (non-zero) and CHANGE across frames.
    const maxZ = Math.max(...samples);
    const minZ = Math.min(...samples);
    expect(maxZ - minZ).toBeGreaterThan(0.01);
    expect(Math.max(...samples.map(Math.abs))).toBeGreaterThan(0.005);

    inst.dispose();
    // Base restored on dispose.
    expect(Math.abs(pos.getZ(idx))).toBeLessThan(1e-6);
  });

  it('controls change output: larger amplitude means larger displacement', () => {
    const target = makeTarget(rippleConcentricPrimitive);
    const inst = rippleConcentricPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
    const idx = midRadiusIndex(mesh);

    // Sweep z over a window so we capture a crest regardless of phase.
    function peakAbsZ(): number {
      let peak = 0;
      for (let k = 0; k <= 24; k++) {
        inst.seek(k * 0.1);
        peak = Math.max(peak, Math.abs(pos.getZ(idx)));
      }
      return peak;
    }

    inst.setControl('amplitude', 0.02);
    const small = peakAbsZ();

    inst.setControl('amplitude', 0.4);
    const large = peakAbsZ();

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
