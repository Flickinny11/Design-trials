import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { shockwaveScatterPrimitive } from '@/lib/prism/animatable/primitives/shockwave-scatter';
import { makeTarget, runConformance } from './_conformance';

// Pull the live position buffer for the generated Points (subject:'empty').
function posAttr(target: ReturnType<typeof makeTarget>): BufferAttribute {
  let pts: Points | null = null;
  target.object.traverse((o) => {
    if ((o as Points).isPoints) pts = o as Points;
  });
  if (!pts) throw new Error('shockwave-scatter did not add a Points object');
  return (pts as Points).geometry.getAttribute('position') as BufferAttribute;
}

// Sum of squared radial distance of every active element from the grid centre —
// a single scalar that rises as the wave scatters the grid and falls as it
// springs back. Inactive (parked) elements sit at HIDDEN (≈1001), so restrict to
// the on-screen band to measure only the live grid.
function spread(attr: BufferAttribute): number {
  let s = 0;
  for (let i = 0; i < attr.count; i++) {
    const x = attr.getX(i);
    const y = attr.getY(i);
    if (Math.abs(x) > 8 || Math.abs(y) > 8) continue; // skip parked elements
    s += x * x + y * y;
  }
  return s;
}

describe('shockwave-scatter primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(shockwaveScatterPrimitive).dispose();
  });

  it('a shockwave ring sweeps the grid: elements scatter outward then spring back (integrated, not easing)', () => {
    const target = makeTarget(shockwaveScatterPrimitive);
    const inst = shockwaveScatterPrimitive.create(target);
    const attr = posAttr(target);

    inst.seek(0);
    const restSpread = spread(attr);

    // Walk the cycle: the propagating wave must push the grid's net spread above
    // its resting value (real outward displacement), then the spring must pull it
    // back down toward rest after the ring has passed and recharge begins.
    const dur = inst.duration();
    const dt = 1 / 120;
    let maxSpread = restSpread;
    let lateSpread = restSpread;
    const steps = Math.round(dur / dt);
    for (let k = 1; k <= steps; k++) {
      inst.seek(k * dt);
      const sp = spread(attr);
      maxSpread = Math.max(maxSpread, sp);
      if (k > steps * 0.85) lateSpread = sp; // near end of cycle (recharge)
    }

    // It genuinely scattered: peak spread is well above rest.
    expect(maxSpread).toBeGreaterThan(restSpread * 1.15);
    // It genuinely sprang back: by the recharge window the grid has healed far
    // below the peak (spring-return, not a one-way push).
    expect(lateSpread).toBeLessThan(restSpread + (maxSpread - restSpread) * 0.6);

    inst.dispose();
  });

  it('the wave is a propagating ring, not a synchronized stamp (inner elements move before outer)', () => {
    const target = makeTarget(shockwaveScatterPrimitive);
    const inst = shockwaveScatterPrimitive.create(target);
    const attr = posAttr(target);

    // Identify an inner element (near centre) and an outer element (near a
    // corner) of the active grid from their resting positions.
    inst.seek(0);
    let inner = -1;
    let outer = -1;
    let innerR = Infinity;
    let outerR = -Infinity;
    for (let i = 0; i < attr.count; i++) {
      const x = attr.getX(i);
      const y = attr.getY(i);
      if (Math.abs(x) > 8 || Math.abs(y) > 8) continue;
      const r = Math.hypot(x, y);
      if (r < innerR && r > 0.05) {
        innerR = r;
        inner = i;
      }
      if (r > outerR) {
        outerR = r;
        outer = i;
      }
    }
    expect(inner).toBeGreaterThanOrEqual(0);
    expect(outer).toBeGreaterThanOrEqual(0);

    const homeInner = { x: attr.getX(inner), y: attr.getY(inner) };
    const homeOuter = { x: attr.getX(outer), y: attr.getY(outer) };
    const offset = (i: number, home: { x: number; y: number }) =>
      Math.hypot(attr.getX(i) - home.x, attr.getY(i) - home.y);

    // Sample early in the expansion: the inner ring should have been displaced
    // appreciably while the outer ring (which the wave has not reached yet) is
    // still essentially at home — the signature of a sweeping ring.
    const dt = 1 / 120;
    let sawLead = false;
    for (let k = 1; k <= 60; k++) {
      inst.seek(k * dt);
      const dIn = offset(inner, homeInner);
      const dOut = offset(outer, homeOuter);
      if (dIn > 0.08 && dOut < dIn * 0.5) {
        sawLead = true;
        break;
      }
    }
    expect(sawLead).toBe(true);

    inst.dispose();
  });

  it('power is live at the frozen pin (control changes the frozen frame → markDirty works)', () => {
    const target = makeTarget(shockwaveScatterPrimitive);
    const inst = shockwaveScatterPrimitive.create(target);
    const attr = posAttr(target);

    // Frozen preview phase ≈0.45 of duration → mid-expansion, where shock power
    // visibly changes how far the grid has scattered. Re-seek the SAME t after a
    // control sweep; the reset-replay (markDirty) must recompute a different frame.
    const PIN = inst.duration() * 0.45;

    inst.setControl('power', 0.5);
    inst.seek(PIN);
    const weak = spread(attr);

    inst.setControl('power', 6);
    inst.seek(PIN);
    const strong = spread(attr);

    // Stronger shock → measurably more scatter at the identical pinned time.
    expect(Math.abs(strong - weak)).toBeGreaterThan(1e-3);
    expect(strong).toBeGreaterThan(weak);

    inst.dispose();
  });
});
