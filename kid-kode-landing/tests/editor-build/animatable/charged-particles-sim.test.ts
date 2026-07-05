import { describe, it, expect } from 'vitest';
import { chargedParticlesSimPrimitive } from '@/lib/prism/animatable/primitives/charged-particles-sim';
import { makeTarget, runConformance } from './_conformance';
import { InstancedMesh, Matrix4, Vector3 } from 'three';

// The render layer is an instanced oriented-streak field (one InstancedMesh,
// per-mote matrix). Each streak's HEAD endpoint — its matrix translation — sits
// exactly at the mote position the sim integrates, so we recover the mote
// centers from the instance matrices into the same flat [x0,y0,z0, x1,…] layout
// the old THREE.Points position buffer used.
//
// The tests grab `pos` ONCE, then index `pos[i*3]` after each seek() and expect
// fresh values (the old Points position buffer was mutated in place by write()).
// We preserve that exact access pattern by returning a numeric-index Proxy that
// re-extracts the live instanceMatrix on every read — so `pos[k]` always
// reflects whatever frame the latest seek() pinned, no call-site changes needed.
function getPositions(target: ReturnType<typeof makeTarget>): Float32Array {
  const mesh = target.object.children.find(
    (c) => c instanceof InstancedMesh,
  ) as InstancedMesh | undefined;
  if (!mesh) {
    throw new Error('charged-particles-sim did not add an InstancedMesh object');
  }
  const m = new Matrix4();
  const v = new Vector3();
  const read = (flatIndex: number): number => {
    const i = Math.floor(flatIndex / 3);
    const comp = flatIndex % 3;
    if (i >= mesh.count) return 0;
    mesh.getMatrixAt(i, m);
    v.setFromMatrixPosition(m);
    return comp === 0 ? v.x : comp === 1 ? v.y : v.z;
  };
  // Proxy over a zero-filled Float32Array: numeric reads are live, length/typing
  // come from the backing array so it still satisfies `Float32Array`.
  const backing = new Float32Array(mesh.count * 3);
  return new Proxy(backing, {
    get(t, prop, recv) {
      if (typeof prop === 'string') {
        const n = Number(prop);
        if (Number.isInteger(n) && n >= 0) return read(n);
      }
      return Reflect.get(t, prop, recv);
    },
  }) as Float32Array;
}

describe('charged-particles-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(chargedParticlesSimPrimitive).dispose();
  });

  it('integrates Lorentz motion: a mote follows a CURVED path (velocity vector rotates), not a straight line', () => {
    const target = makeTarget(chargedParticlesSimPrimitive);
    const inst = chargedParticlesSimPrimitive.create(target);
    // Strong field, slow injection → tight cyclotron arc within the tile.
    inst.setControl('field', 8);
    inst.setControl('speed', 0.8);
    inst.setControl('charge', 0.2); // keep |q| near 1 so mote 0 doesn't recycle early
    const pos = getPositions(target);

    // Track mote 0 (a positive/brass charge) across many small steps and record
    // its per-frame heading. Genuine v×B integration rotates the heading
    // continuously (the path curls); a closed-form/straight fake would keep a
    // constant heading. We accumulate the signed turning of the velocity vector.
    const dt = 1 / 90;
    let prevX = NaN;
    let prevY = NaN;
    let prevHx = NaN;
    let prevHy = NaN;
    let totalTurn = 0; // accumulated |Δheading| in radians
    let netCross = 0; // signed turning → consistent handedness (a real arc)
    let maxStepLen = 0;

    inst.seek(0);
    for (let k = 1; k <= 60; k++) {
      inst.seek(k * dt);
      const x = pos[0];
      const y = pos[1];
      if (!Number.isNaN(prevX)) {
        const dx = x - prevX;
        const dy = y - prevY;
        const len = Math.hypot(dx, dy);
        maxStepLen = Math.max(maxStepLen, len);
        if (len > 1e-5) {
          const hx = dx / len;
          const hy = dy / len;
          if (!Number.isNaN(prevHx)) {
            // Signed angle between successive heading vectors.
            const cross = prevHx * hy - prevHy * hx;
            const dot = clampCos(prevHx * hx + prevHy * hy);
            const turn = Math.atan2(cross, dot);
            // Ignore the discontinuity if the mote recycled (a huge jump).
            if (len < 0.5) {
              totalTurn += Math.abs(turn);
              netCross += turn;
            }
          }
          prevHx = hx;
          prevHy = hy;
        }
      }
      prevX = x;
      prevY = y;
    }

    // The mote actually moved (real velocity advection, not a static frame).
    expect(maxStepLen).toBeGreaterThan(1e-4);
    // The heading rotated substantially — a curved Lorentz arc, not a straight
    // line. (A straight closed-form path would accumulate ~0 turning.)
    expect(totalTurn).toBeGreaterThan(0.5);
    // Turning is consistently one-handed (a cyclotron circle), so the signed
    // sum is a large fraction of the total — proving a coherent arc, not jitter.
    expect(Math.abs(netCross)).toBeGreaterThan(totalTurn * 0.4);

    inst.dispose();
  });

  it('positive and negative species curl in OPPOSITE directions (charge sign flips handedness)', () => {
    const target = makeTarget(chargedParticlesSimPrimitive);
    const inst = chargedParticlesSimPrimitive.create(target);
    inst.setControl('field', 8);
    inst.setControl('speed', 0.8);
    inst.setControl('charge', 0.2);
    const pos = getPositions(target);

    // Mote 0 is positive (even index), mote 1 is negative (odd index). Measure
    // each one's net signed turning over the same window; opposite charge ⇒
    // opposite-sign cyclotron rotation under the same B.
    const dt = 1 / 90;
    const turnOf = (idx: number): number => {
      // Re-run from t=0 each time so both samples see the identical sim.
      inst.seek(0);
      let pX = NaN;
      let pY = NaN;
      let pHx = NaN;
      let pHy = NaN;
      let net = 0;
      for (let k = 1; k <= 50; k++) {
        inst.seek(k * dt);
        const x = pos[idx * 3];
        const y = pos[idx * 3 + 1];
        if (!Number.isNaN(pX)) {
          const dx = x - pX;
          const dy = y - pY;
          const len = Math.hypot(dx, dy);
          if (len > 1e-5 && len < 0.5) {
            const hx = dx / len;
            const hy = dy / len;
            if (!Number.isNaN(pHx)) {
              const cross = pHx * hy - pHy * hx;
              const dot = clampCos(pHx * hx + pHy * hy);
              net += Math.atan2(cross, dot);
            }
            pHx = hx;
            pHy = hy;
          }
        }
        pX = x;
        pY = y;
      }
      return net;
    };

    const turnPos = turnOf(0);
    const turnNeg = turnOf(1);
    // Both species genuinely curved...
    expect(Math.abs(turnPos)).toBeGreaterThan(0.3);
    expect(Math.abs(turnNeg)).toBeGreaterThan(0.3);
    // ...and in opposite rotational senses (product of signed turns < 0).
    expect(turnPos * turnNeg).toBeLessThan(0);

    inst.dispose();
  });

  it('Field (B) is live at the frozen pin: sweeping it re-shapes the same paused frame', () => {
    const target = makeTarget(chargedParticlesSimPrimitive);
    const inst = chargedParticlesSimPrimitive.create(target);
    inst.setControl('speed', 1.2);
    inst.setControl('charge', 0.4);
    const pos = getPositions(target);

    const PIN = 0.65; // mid-flight (streams have curved into the braid)
    const snapshot = (): number[] => {
      // Compare the first 40 motes' x/y — a robust aggregate of the field shape.
      const out: number[] = [];
      for (let i = 0; i < 40; i++) {
        out.push(pos[i * 3], pos[i * 3 + 1]);
      }
      return out;
    };

    inst.setControl('field', 1.5);
    inst.seek(PIN);
    const low = snapshot();

    inst.setControl('field', 9);
    inst.seek(PIN);
    const high = snapshot();

    // markDirty re-runs the sim to the SAME pinned t with the new B → the frozen
    // frame must visibly differ (trajectory control is live at a paused pin).
    let maxDelta = 0;
    for (let i = 0; i < low.length; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(high[i] - low[i]));
    }
    expect(maxDelta).toBeGreaterThan(1e-2);

    inst.dispose();
  });
});

/** Clamp a cos value into [-1,1] to keep atan2's companion term well-formed. */
function clampCos(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
