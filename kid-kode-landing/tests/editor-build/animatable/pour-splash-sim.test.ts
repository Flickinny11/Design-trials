import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { pourSplashSimPrimitive } from '@/lib/prism/animatable/primitives/pour-splash-sim';
import { makeTarget, runConformance } from './_conformance';

// The pool floor in the primitive (kept in sync with FLOOR_Y there).
const FLOOR_Y = -1.05;
const HIDDEN_MIN = 100; // parked particles sit at BASIN_HALF + 1000

function bodyPoints(target: ReturnType<typeof makeTarget>): Points {
  const p = target.object.children.find(
    (c) => (c as Points).name === 'pour-splash-body',
  );
  if (!p) throw new Error('body Points not found');
  return p as Points;
}

/** Collect live (non-parked) particle [x,y] from the body buffer. */
function liveParticles(pts: Points): Array<[number, number]> {
  const attr = pts.geometry.getAttribute('position') as BufferAttribute;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < attr.count; i++) {
    const x = attr.getX(i);
    const y = attr.getY(i);
    if (Math.abs(x) < HIDDEN_MIN && Math.abs(y) < HIDDEN_MIN) out.push([x, y]);
  }
  return out;
}

describe('pour-splash-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pourSplashSimPrimitive).dispose();
  });

  it('pours a stream that lands and throws a splash crown (real SPH-lite, not analytic)', () => {
    const target = makeTarget(pourSplashSimPrimitive);
    const inst = pourSplashSimPrimitive.create(target);
    const pts = bodyPoints(target);

    // Early: a few particles have just left the spout near the top.
    inst.seek(0.25);
    const early = liveParticles(pts);
    expect(early.length).toBeGreaterThan(0); // the pour has started
    const topY = Math.max(...early.map(([, y]) => y));
    expect(topY).toBeGreaterThan(0.6); // stream emerging from the top spout

    // Run the sim well past first impact; track the lowest point reached (pool
    // forming on the floor) and whether any particle that had been below the
    // floor band later rises back ABOVE it — that rebound is the splash crown,
    // which an analytic rain-splash with no collision state cannot produce.
    const dt = 1 / 60;
    let reachedFloorBand = false;
    let sawCrownRebound = false;
    let lowestY = Infinity;
    // Per-index "was it down in the pool then came back up" tracking.
    const attr = pts.geometry.getAttribute('position') as BufferAttribute;
    const wasLow = new Uint8Array(attr.count);

    for (let k = 1; k <= 220; k++) {
      inst.seek(k * dt);
      for (let i = 0; i < attr.count; i++) {
        const x = attr.getX(i);
        const y = attr.getY(i);
        if (Math.abs(x) >= HIDDEN_MIN) continue; // parked
        lowestY = Math.min(lowestY, y);
        if (y <= FLOOR_Y + 0.12) {
          reachedFloorBand = true;
          wasLow[i] = 1;
        }
        // A particle that pooled near the floor is now well above it again.
        if (wasLow[i] === 1 && y > FLOOR_Y + 0.45) sawCrownRebound = true;
      }
    }

    expect(reachedFloorBand).toBe(true); // the stream actually reached the pool
    expect(lowestY).toBeLessThan(FLOOR_Y + 0.2); // a pool sits on the floor
    expect(sawCrownRebound).toBe(true); // droplets flew back UP — a splash crown

    inst.dispose();
  });

  it('splash control is live at the frozen pin (markDirty proves trajectory controls move the frame)', () => {
    const target = makeTarget(pourSplashSimPrimitive);
    const inst = pourSplashSimPrimitive.create(target);
    const pts = bodyPoints(target);
    const attr = pts.geometry.getAttribute('position') as BufferAttribute;

    // Mid-action pin (rig freezes ~0.45 of duration; for an Infinite-duration
    // continuous pour the rig pins an absolute seconds value — pick one where the
    // stream is hitting and the crown is up).
    const PIN = 1.6;

    // Highest live particle at the pin is a good crown-height proxy.
    const maxLiveY = () => {
      let m = -Infinity;
      for (let i = 0; i < attr.count; i++) {
        const x = attr.getX(i);
        const y = attr.getY(i);
        if (Math.abs(x) < HIDDEN_MIN && Math.abs(y) < HIDDEN_MIN) m = Math.max(m, y);
      }
      return m;
    };

    // Sum of y over live particles — a robust whole-frame fingerprint that must
    // change when a trajectory-only control is swept at the SAME t.
    const liveYSignature = () => {
      let s = 0;
      let n = 0;
      for (let i = 0; i < attr.count; i++) {
        const x = attr.getX(i);
        const y = attr.getY(i);
        if (Math.abs(x) < HIDDEN_MIN && Math.abs(y) < HIDDEN_MIN) {
          s += y;
          n++;
        }
      }
      return { s, n };
    };

    inst.setControl('splash', 0.0);
    inst.seek(PIN);
    const lowSig = liveYSignature();
    void maxLiveY();

    inst.setControl('splash', 1.0);
    inst.seek(PIN);
    const highSig = liveYSignature();

    // The frozen frame must genuinely differ — proves onParamChange→markDirty
    // re-runs the sim to the pinned t (otherwise the control would read DEAD).
    expect(Math.abs(highSig.s - lowSig.s)).toBeGreaterThan(1e-3);

    // Gravity (a different trajectory-only control) must also move the frame.
    inst.setControl('gravity', 1.5);
    inst.seek(PIN);
    const gLow = liveYSignature();
    inst.setControl('gravity', 9.0);
    inst.seek(PIN);
    const gHigh = liveYSignature();
    expect(Math.abs(gHigh.s - gLow.s)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
