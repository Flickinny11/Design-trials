import { describe, it, expect } from 'vitest';
import { Sprite, type BufferAttribute } from 'three';
import { bubbleRiseSimPrimitive } from '@/lib/prism/animatable/primitives/bubble-rise-sim';
import { makeTarget, runConformance } from './_conformance';

// Pull the live instanced buffers off the mounted sprite so we can inspect the
// actual simulated bubble centers / radii the renderer would draw.
function buffers(target: { object: { children: unknown[] } }) {
  const sprite = target.object.children.find((c) => c instanceof Sprite) as Sprite;
  expect(sprite, 'bubble sprite mounted').toBeTruthy();
  const pos = sprite.geometry.getAttribute('instancePosition') as BufferAttribute;
  const rad = sprite.geometry.getAttribute('instanceRadius') as BufferAttribute;
  return { sprite, pos, rad };
}

// Mean Y of the first `count` active bubbles (parked ones sit at Y=1000).
function meanActiveY(pos: BufferAttribute, count: number): number {
  let sum = 0;
  for (let i = 0; i < count; i++) sum += pos.getY(i);
  return sum / count;
}

describe('bubble-rise-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(bubbleRiseSimPrimitive).dispose();
  });

  it('bubbles rise under buoyancy (real velocity state, not easing)', () => {
    const target = makeTarget(bubbleRiseSimPrimitive);
    const inst = bubbleRiseSimPrimitive.create(target);
    const { pos } = buffers(target as never);
    const count = inst.getParams().count as number;

    // Track an individual mid-column bubble and the field as a whole. A real
    // rising sim means the bubble climbs (Y increases) over a short window
    // BEFORE it pops and recycles to the floor — a genuine upward trajectory.
    inst.seek(0);
    const y0Field = meanActiveY(pos, count);

    let sawRise = false;
    const dt = 1 / 90;
    let prevY = pos.getY(0);
    inst.seek(0);
    prevY = pos.getY(0);
    for (let k = 1; k <= 120; k++) {
      inst.seek(k * dt);
      const cy = pos.getY(0);
      const delta = cy - prevY;
      // Rising = a clear upward step that is NOT the pop/recycle jump to the
      // floor (which would be a large negative delta, never positive here).
      if (delta > 1e-3 && delta < 0.5) sawRise = true;
      prevY = cy;
    }
    expect(sawRise).toBe(true); // a bubble genuinely climbed

    // The field at a later engaged time has visibly evolved from the seed frame.
    inst.seek(0.6);
    const y1Field = meanActiveY(pos, count);
    expect(Math.abs(y1Field - y0Field)).toBeGreaterThan(1e-3);

    // Bubbles also wobble horizontally (currents): X is not frozen.
    inst.seek(0);
    const x0 = pos.getX(0);
    inst.seek(0.4);
    const x1 = pos.getX(0);
    expect(Math.abs(x1 - x0)).toBeGreaterThan(1e-4);

    inst.dispose();
  });

  it('controls are live at a pinned frozen frame (buoyancy + size change the same t)', () => {
    const target = makeTarget(bubbleRiseSimPrimitive);
    const inst = bubbleRiseSimPrimitive.create(target);
    const { pos, rad } = buffers(target as never);
    const count = inst.getParams().count as number;

    // Pin a representative engaged frame mid-rise (≈ frozen phase 0.45 of the
    // tile loop). Sweeping BUOYANCY must change the column height at the SAME t
    // (trajectory control → markDirty replays the sim to the pinned frame).
    const PIN = 1.0;
    inst.setControl('buoyancy', 0.8);
    inst.seek(PIN);
    const lowBuoyY = meanActiveY(pos, count);
    inst.setControl('buoyancy', 3.6);
    inst.seek(PIN);
    const highBuoyY = meanActiveY(pos, count);
    expect(Math.abs(highBuoyY - lowBuoyY)).toBeGreaterThan(1e-3);

    // SIZE is read live in write(): sweeping it changes the bubble radii at the
    // SAME pinned t (proves at least one control is live without markDirty too).
    inst.setControl('size', 0.5);
    inst.seek(PIN);
    let smallR = 0;
    for (let i = 0; i < count; i++) smallR += rad.getX(i);
    inst.setControl('size', 1.5);
    inst.seek(PIN);
    let bigR = 0;
    for (let i = 0; i < count; i++) bigR += rad.getX(i);
    expect(bigR).toBeGreaterThan(smallR + 1e-3);

    inst.dispose();
  });
});
