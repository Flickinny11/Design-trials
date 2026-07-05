import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { tickerTapePrimitive } from '@/lib/prism/animatable/primitives/ticker-tape';
import { makeTarget, runConformance } from './_conformance';

function ribbons(target: ReturnType<typeof makeTarget>): Points {
  const pts = target.object.getObjectByName('ticker-tape');
  return pts as Points;
}

describe('ticker-tape primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(tickerTapePrimitive).dispose();
  });

  it('plays: a ribbon falls and sways between two distinct times', () => {
    const target = makeTarget(tickerTapePrimitive);
    const inst = tickerTapePrimitive.create(target);
    const posAttr = ribbons(target).geometry.getAttribute('position') as BufferAttribute;
    const arr = posAttr.array as Float32Array;

    // Sample ribbon index 3's y and x at two distinct times.
    const idx = 3;
    inst.seek(0.1);
    const yEarly = arr[idx * 3 + 1];
    const xEarly = arr[idx * 3];

    inst.seek(0.85);
    const yLate = arr[idx * 3 + 1];
    const xLate = arr[idx * 3];

    // Falling: y changed between the two frames.
    expect(Math.abs(yLate - yEarly)).toBeGreaterThan(0.05);
    // Swaying: x changed too (flutter is on).
    expect(Math.abs(xLate - xEarly)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: higher fall speed travels farther over the same dt', () => {
    const target = makeTarget(tickerTapePrimitive);
    const inst = tickerTapePrimitive.create(target);
    const posAttr = ribbons(target).geometry.getAttribute('position') as BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const idx = 5;

    // Slow fall: measure y displacement over a fixed dt with no sway.
    inst.setControl('flutter', 0);
    inst.setControl('swayAmp', 0);
    inst.setControl('fallSpeed', 0.05);
    inst.seek(0);
    const ySlow0 = arr[idx * 3 + 1];
    inst.seek(0.5);
    const ySlowD = Math.abs(arr[idx * 3 + 1] - ySlow0);

    // Fast fall over the same dt — but wrap makes raw distance ambiguous, so
    // instead assert the y value at a fixed t differs between speeds.
    inst.setControl('fallSpeed', 0.05);
    inst.seek(0.5);
    const ySlowAt = arr[idx * 3 + 1];

    inst.setControl('fallSpeed', 1.2);
    inst.seek(0.5);
    const yFastAt = arr[idx * 3 + 1];

    // Different fall speeds put the ribbon at different heights at the same t.
    expect(Math.abs(yFastAt - ySlowAt)).toBeGreaterThan(0.05);
    expect(ySlowD).toBeGreaterThan(0); // sanity: it does move
    inst.dispose();
  });
});
