import { describe, it, expect } from 'vitest';
import { Points } from 'three';
import { nBodyOrbitPrimitive } from '@/lib/prism/animatable/primitives/n-body-orbit';
import { makeTarget, runConformance } from './_conformance';

// Pull the satellite / sun point clouds the primitive adds to target.object.
function clouds(object: { children: unknown[] }) {
  const pts = object.children.filter((c): c is Points => c instanceof Points);
  const suns = pts.find((p) => p.name === 'n-body-orbit-suns')!;
  const sats = pts.find((p) => p.name === 'n-body-orbit-satellites')!;
  return { suns, sats };
}

function satXYZ(sats: Points, k: number): [number, number, number] {
  const a = sats.geometry.getAttribute('position');
  return [a.getX(k), a.getY(k), a.getZ(k)];
}
function sunXYZ(suns: Points, b: number): [number, number, number] {
  const a = suns.geometry.getAttribute('position');
  return [a.getX(b), a.getY(b), a.getZ(b)];
}

describe('n-body-orbit primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(nBodyOrbitPrimitive).dispose();
  });

  it('integrates real gravity: satellites trace orbits (sweep + radial turning point) and the suns themselves move', () => {
    const target = makeTarget(nBodyOrbitPrimitive);
    const inst = nBodyOrbitPrimitive.create(target);
    const { suns, sats } = clouds(target.object as { children: unknown[] });

    const dt = 1 / 60;
    const STEPS = 360; // ~6s = full duration

    // Track satellite 0: total path length, radius extrema (proves an ellipse,
    // not a circle/static point), and that it actually goes around (angle sweep).
    inst.seek(0);
    let [x0, y0, z0] = satXYZ(sats, 0);
    const r0 = Math.hypot(x0, y0, z0);
    let pathLen = 0;
    let minR = r0;
    let maxR = r0;
    let totalAngle = 0;
    let prevAng = Math.atan2(y0, x0);

    // Track a sun to prove the central system is a true dynamical binary (moves),
    // not a static anchor.
    const [sx0, sy0] = sunXYZ(suns, 0);
    let sunMoved = 0;

    let px = x0,
      py = y0,
      pz = z0;
    for (let k = 1; k <= STEPS; k++) {
      inst.seek(k * dt);
      const [x, y, z] = satXYZ(sats, 0);
      pathLen += Math.hypot(x - px, y - py, z - pz);
      const r = Math.hypot(x, y, z);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      const ang = Math.atan2(y, x);
      let da = ang - prevAng;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      totalAngle += da;
      prevAng = ang;
      px = x;
      py = y;
      pz = z;

      const [sx, sy] = sunXYZ(suns, 0);
      sunMoved = Math.max(sunMoved, Math.hypot(sx - sx0, sy - sy0));
    }

    // It actually travelled a substantial distance (genuine motion, not a freeze).
    expect(pathLen).toBeGreaterThan(0.5);
    // It swept around the centre (an orbit), accumulating real angle.
    expect(Math.abs(totalAngle)).toBeGreaterThan(1.0);
    // Radius oscillates: perihelion ≠ aphelion → an integrated ellipse / slingshot,
    // not a drawn circle and not a static point.
    expect(maxR - minR).toBeGreaterThan(0.05);
    // The suns orbit each other (dynamical central system, not a fixed anchor).
    expect(sunMoved).toBeGreaterThan(0.05);

    inst.dispose();
  });

  it('gravity is live at the frozen pin (sweeping G re-runs the sim to the SAME t and moves the satellites)', () => {
    const target = makeTarget(nBodyOrbitPrimitive);
    const inst = nBodyOrbitPrimitive.create(target);
    const { sats } = clouds(target.object as { children: unknown[] });

    // ~0.45 of the 6s duration → satellites mid-orbit (the rig's frozen phase).
    const PIN = 6 * 0.45;

    inst.setControl('gravity', 0.6);
    inst.seek(PIN);
    const [lx, ly, lz] = satXYZ(sats, 0);

    inst.setControl('gravity', 3.6);
    inst.seek(PIN);
    const [hx, hy, hz] = satXYZ(sats, 0);

    // Different gravity → a different orbit → a different position at the SAME
    // pinned t. Proves onParamChange→markDirty makes the trajectory control live
    // on a frozen frame.
    const moved = Math.hypot(hx - lx, hy - ly, hz - lz);
    expect(moved).toBeGreaterThan(1e-2);

    inst.dispose();
  });

  it('satellite count is live at the frozen pin (hidden units parked, active units present)', () => {
    const target = makeTarget(nBodyOrbitPrimitive);
    const inst = nBodyOrbitPrimitive.create(target);
    const { sats } = clouds(target.object as { children: unknown[] });
    const PIN = 6 * 0.45;

    inst.setControl('satellites', 12);
    inst.seek(PIN);
    // Last satellite (index 11) must be on-screen (active), not parked at 9999.
    const [x11] = satXYZ(sats, 11);
    expect(Math.abs(x11)).toBeLessThan(50);

    inst.setControl('satellites', 4);
    inst.seek(PIN);
    // Now index 11 is inactive → parked far off-screen.
    const [x11b] = satXYZ(sats, 11);
    expect(Math.abs(x11b)).toBeGreaterThan(1000);

    inst.dispose();
  });
});
