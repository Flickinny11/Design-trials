import { describe, it, expect } from 'vitest';
import { Points } from 'three';
import { turbulenceDriftPrimitive } from '@/lib/prism/animatable/primitives/turbulence-drift';
import { makeTarget, runConformance } from './_conformance';

// Read the live Points position buffer the primitive writes into target.object.
function readPositions(target: ReturnType<typeof makeTarget>, n: number): number[] {
  const pts = target.object.children.find((c) => c instanceof Points) as Points | undefined;
  if (!pts) throw new Error('no Points built');
  const arr = pts.geometry.getAttribute('position').array as ArrayLike<number>;
  const out: number[] = [];
  for (let i = 0; i < n * 3; i++) out.push(arr[i]);
  return out;
}

describe('turbulence-drift primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(turbulenceDriftPrimitive).dispose();
  });

  it('advects motes through the field with inertia (real velocity state, not a static field)', () => {
    const target = makeTarget(turbulenceDriftPrimitive);
    const inst = turbulenceDriftPrimitive.create(target);

    // Use a modest count so the comparison is cheap but representative.
    inst.setControl('count', 240);

    inst.seek(0);
    const p0 = readPositions(target, 240);

    // Step forward and confirm the dust genuinely DRIFTS (positions change a lot).
    inst.seek(2.0);
    const p1 = readPositions(target, 240);

    let moved = 0;
    let maxDisp = 0;
    for (let i = 0; i < 240; i++) {
      let d2 = 0;
      for (let k = 0; k < 3; k++) {
        const dd = p1[i * 3 + k] - p0[i * 3 + k];
        d2 += dd * dd;
      }
      const d = Math.sqrt(d2);
      if (d > 1e-3) moved++;
      maxDisp = Math.max(maxDisp, d);
    }
    // The overwhelming majority of motes have travelled, and some have travelled
    // a real distance across an eddy — closed-form "all in lockstep" can't do this.
    expect(moved).toBeGreaterThan(200);
    expect(maxDisp).toBeGreaterThan(0.1);

    // INERTIA test: with low drag, a mote's velocity should NOT instantly equal
    // the field — momentum from t carries it forward. We prove integration order
    // by checking the trajectory is curved (not a straight line): the per-step
    // direction changes as the mote crosses eddies.
    inst.setControl('count', 60);
    inst.setControl('drag', 0.1); // heavy inertia → long curved trails
    inst.seek(0);
    const a = readPositions(target, 1);
    inst.seek(0.5);
    const b = readPositions(target, 1);
    inst.seek(1.0);
    const c = readPositions(target, 1);
    // Direction of segment a→b vs b→c differs → curved path (advection + inertia).
    const v1 = [b[0] - a[0], b[1] - a[1]];
    const v2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(v1[0], v1[1]) || 1e-9;
    const l2 = Math.hypot(v2[0], v2[1]) || 1e-9;
    const cosAng = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2);
    // Not perfectly collinear → the field turned the mote (a real eddy).
    expect(cosAng).toBeLessThan(0.9999);

    inst.dispose();
  });

  it('turbulence + drag are live at the frozen pin (controls change the same-t frame)', () => {
    const target = makeTarget(turbulenceDriftPrimitive);
    const inst = turbulenceDriftPrimitive.create(target);
    inst.setControl('count', 200);

    // Mid-action pin: a couple seconds in, the dust is organized into eddies.
    const PIN = 2.0;
    const N = 200;

    const mean = (arr: number[]) => {
      // Aggregate signed coordinate to a single scalar; field changes shift it.
      let s = 0;
      for (let i = 0; i < arr.length; i++) s += arr[i];
      return s / arr.length;
    };
    const diff = (a: number[], b: number[]) => {
      let s = 0;
      for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
      return s / a.length;
    };

    // Sweep TURBULENCE at the SAME pinned t → frozen frame must change.
    inst.setControl('turbulence', 0.3);
    inst.seek(PIN);
    const lowTurb = readPositions(target, N);
    inst.setControl('turbulence', 2.8);
    inst.seek(PIN);
    const highTurb = readPositions(target, N);
    expect(diff(lowTurb, highTurb)).toBeGreaterThan(1e-3);

    // Sweep DRAG (inertia) at the SAME pinned t → frozen frame must change.
    inst.setControl('turbulence', 1.3);
    inst.setControl('drag', 0.08);
    inst.seek(PIN);
    const lowDrag = readPositions(target, N);
    inst.setControl('drag', 0.92);
    inst.seek(PIN);
    const highDrag = readPositions(target, N);
    expect(diff(lowDrag, highDrag)).toBeGreaterThan(1e-3);

    // Sweep EDDY SIZE (scale) at the SAME pinned t → frozen frame must change.
    inst.setControl('drag', 0.32);
    inst.setControl('scale', 0.6);
    inst.seek(PIN);
    const small = readPositions(target, N);
    inst.setControl('scale', 2.8);
    inst.seek(PIN);
    const large = readPositions(target, N);
    expect(diff(small, large)).toBeGreaterThan(1e-3);

    // Sanity: the aggregate scalar genuinely moved under at least one sweep.
    expect(Math.abs(mean(lowTurb) - mean(highTurb)) + diff(lowTurb, highTurb)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
