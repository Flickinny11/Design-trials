import { describe, it, expect } from 'vitest';
import { Sprite, type BufferGeometry, type InstancedBufferAttribute } from 'three';
import { smokePlumeSimPrimitive } from '@/lib/prism/animatable/primitives/smoke-plume-sim';
import { makeTarget, runConformance } from './_conformance';

/** Find the built instanced Sprite under the target. */
function plumeSprite(target: ReturnType<typeof makeTarget>): Sprite {
  let sprite: Sprite | null = null;
  target.object.traverse((o) => {
    if ((o as Sprite).isSprite) sprite = o as Sprite;
  });
  if (!sprite) throw new Error('no Sprite built');
  return sprite;
}

function instancePositions(target: ReturnType<typeof makeTarget>): Float32Array {
  const geo = plumeSprite(target).geometry as BufferGeometry;
  return (geo.attributes.instancePosition as InstancedBufferAttribute).array as Float32Array;
}
function instanceRadii(target: ReturnType<typeof makeTarget>): Float32Array {
  const geo = plumeSprite(target).geometry as BufferGeometry;
  return (geo.attributes.instanceRadius as InstancedBufferAttribute).array as Float32Array;
}

/** Mean Y over the currently-drawn parcels (sprite.count). */
function meanY(target: ReturnType<typeof makeTarget>): number {
  const n = plumeSprite(target).count;
  const arr = instancePositions(target);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += arr[i * 3 + 1];
  return sum / n;
}

/** Horizontal spread (std-dev of X) over the drawn parcels. */
function spreadX(target: ReturnType<typeof makeTarget>): number {
  const n = plumeSprite(target).count;
  const arr = instancePositions(target);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += arr[i * 3];
  mean /= n;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const dx = arr[i * 3] - mean;
    v += dx * dx;
  }
  return Math.sqrt(v / n);
}

const Y_BASE = -1.25; // mirror of the primitive's emission height

describe('smoke-plume-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(smokePlumeSimPrimitive).dispose();
  });

  it('plays: parcels rise above the emitter and the column spreads (advected plume)', () => {
    const target = makeTarget(smokePlumeSimPrimitive);
    const inst = smokePlumeSimPrimitive.create(target);

    // Drive the plume from the throat. The mean parcel height must climb well
    // above the emission base, and the curl-noise turbulence must widen the
    // column horizontally — a real rising, spreading plume, not a static field.
    inst.seek(0.0);
    inst.seek(2.0);
    const yMid = meanY(target);
    const spreadMid = spreadX(target);

    // The mean parcel sits comfortably above the emitter throat (it rose).
    expect(yMid).toBeGreaterThan(Y_BASE + 0.3);
    // The column is wider than the narrow emitter throat (BASE_SPREAD/2 ≈ 0.08).
    expect(spreadMid).toBeGreaterThan(0.12);

    inst.dispose();
  });

  it('ages: per-parcel radius grows (puffs expand as they entrain air)', () => {
    const target = makeTarget(smokePlumeSimPrimitive);
    const inst = smokePlumeSimPrimitive.create(target);
    inst.seek(2.4);
    const radii = instanceRadii(target);
    const n = plumeSprite(target).count;
    let small = Infinity;
    let big = 0;
    for (let i = 0; i < n; i++) {
      small = Math.min(small, radii[i]);
      big = Math.max(big, radii[i]);
    }
    // Young throat parcels are markedly smaller than old, risen ones.
    expect(big).toBeGreaterThan(small * 1.6);
    inst.dispose();
  });

  it('control live at frozen pin: buoyancy changes the column height at the SAME t', () => {
    const target = makeTarget(smokePlumeSimPrimitive);
    const inst = smokePlumeSimPrimitive.create(target);

    // Pin a representative engaged frame mid-rise. A high-buoyancy plume has
    // climbed higher by this t than a low-buoyancy one. Reset-replay + markDirty
    // make the frozen frame a pure function of params, so the SAME pinned t
    // re-seeked with two buoyancy values must differ.
    const PIN = 1.5;
    inst.setControl('buoyancy', 0.5);
    inst.seek(PIN);
    const yLow = meanY(target);

    inst.setControl('buoyancy', 4.0);
    inst.seek(PIN);
    const yHigh = meanY(target);

    expect(yHigh).toBeGreaterThan(yLow + 0.05);
    inst.dispose();
  });
});
