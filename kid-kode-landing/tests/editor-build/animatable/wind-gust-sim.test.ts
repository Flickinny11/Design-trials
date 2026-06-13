import { describe, it, expect } from 'vitest';
import { Sprite, type BufferAttribute } from 'three';
import { windGustSimPrimitive } from '@/lib/prism/animatable/primitives/wind-gust-sim';
import { makeTarget, runConformance } from './_conformance';

// Pull the live instanced buffers off the mounted sprite so we can inspect the
// actual simulated mote centers / radii / brightness the renderer would draw.
function buffers(target: { object: { children: unknown[] } }) {
  const sprite = target.object.children.find((c) => c instanceof Sprite) as Sprite;
  expect(sprite, 'wind sprite mounted').toBeTruthy();
  const pos = sprite.geometry.getAttribute('instancePosition') as BufferAttribute;
  const rad = sprite.geometry.getAttribute('instanceRadius') as BufferAttribute;
  const col = sprite.geometry.getAttribute('instanceColor') as BufferAttribute;
  return { sprite, pos, rad, col };
}

// Wrap-aware X step: the field is a torus of half-width ~1.55, so a single dt
// can never legitimately move a mote more than a fraction of a unit. Treat any
// jump larger than half the torus as a wrap and unfold it.
const FIELD_SPAN_X = 1.55 * 2;
function unwrapDeltaX(curr: number, prev: number): number {
  let dx = curr - prev;
  if (dx > FIELD_SPAN_X / 2) dx -= FIELD_SPAN_X;
  if (dx < -FIELD_SPAN_X / 2) dx += FIELD_SPAN_X;
  return dx;
}

// Mean total brightness of the first `count` active motes (a proxy for the
// field's instantaneous speed, since brightness is derived live from speed).
function meanLum(col: BufferAttribute, count: number): number {
  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += col.getX(i) + col.getY(i) + col.getZ(i);
  }
  return sum / count;
}

describe('wind-gust-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(windGustSimPrimitive).dispose();
  });

  it('motes are advected by a real wind field with inertia (integrated, not closed-form)', () => {
    const target = makeTarget(windGustSimPrimitive);
    const inst = windGustSimPrimitive.create(target);
    const { pos } = buffers(target as never);
    const count = inst.getParams().count as number;

    // Track a single mote and the net field transport. A real advected field
    // means the mote is carried DOWNWIND (net positive X transport over many
    // steps, after unwrapping the torus) — a genuine integrated trajectory.
    const dt = 1 / 90;
    inst.seek(0);
    let prevX = pos.getX(0);
    let netX = 0; // unwrapped cumulative downwind transport of mote 0
    let sawSwirl = false; // a step where the mote moved UP-wind or sideways (eddy)
    let prevDx = unwrapDeltaX(pos.getX(0), prevX);
    for (let k = 1; k <= 200; k++) {
      inst.seek(k * dt);
      const cx = pos.getX(0);
      const dx = unwrapDeltaX(cx, prevX);
      netX += dx;
      // Inertia/curl: per-step velocity is NOT constant (a closed-form drift
      // would step by a fixed amount each frame). Detect a real change in the
      // per-step displacement — the mote accelerates in gusts and eddies.
      if (k > 2 && Math.abs(dx - prevDx) > 1e-4) sawSwirl = true;
      prevDx = dx;
      prevX = cx;
    }
    expect(netX).toBeGreaterThan(0.3); // genuinely blown downwind
    expect(sawSwirl).toBe(true); // velocity varied → integrated, not constant drift

    // The field as a whole has visibly evolved between two engaged times: the
    // mean mote position is not frozen.
    inst.seek(0);
    let sumY0 = 0;
    for (let i = 0; i < count; i++) sumY0 += pos.getY(i);
    inst.seek(0.7);
    let sumY1 = 0;
    for (let i = 0; i < count; i++) sumY1 += pos.getY(i);
    let sumX0 = 0;
    inst.seek(0);
    for (let i = 0; i < count; i++) sumX0 += pos.getX(i);
    inst.seek(0.7);
    let sumX1 = 0;
    for (let i = 0; i < count; i++) sumX1 += pos.getX(i);
    expect(Math.abs(sumX1 - sumX0) + Math.abs(sumY1 - sumY0)).toBeGreaterThan(1e-2);

    inst.dispose();
  });

  it('a gust front sweeps through: field brightness (live speed) varies over time', () => {
    const target = makeTarget(windGustSimPrimitive);
    const inst = windGustSimPrimitive.create(target);
    const { col } = buffers(target as never);
    const count = inst.getParams().count as number;

    // Brightness is derived LIVE from each mote's instantaneous speed, so as the
    // moving gust ridge sweeps across the field the mean brightness rises and
    // falls. Sample the field's brightness across a window and assert it is not
    // constant — a traveling gust, not a steady uniform flow.
    const dt = 1 / 90;
    let minL = Infinity;
    let maxL = -Infinity;
    for (let k = 0; k <= 240; k++) {
      inst.seek(k * dt);
      const L = meanLum(col, count);
      minL = Math.min(minL, L);
      maxL = Math.max(maxL, L);
    }
    expect(maxL - minL).toBeGreaterThan(1e-2); // the gust front modulates the field

    inst.dispose();
  });

  it('controls are live at a pinned frozen frame (gust + turbulence change the same t)', () => {
    const target = makeTarget(windGustSimPrimitive);
    const inst = windGustSimPrimitive.create(target);
    const { pos, col } = buffers(target as never);
    const count = inst.getParams().count as number;

    // Pin a representative engaged frame mid-action (≈ frozen phase 0.45 of the
    // tile loop). Sweeping GUST must change where the motes have been carried at
    // the SAME t (trajectory control → markDirty replays the sim to the pin).
    const PIN = 1.0;
    inst.setControl('gust', 0.0);
    inst.seek(PIN);
    let lowGustX = 0;
    for (let i = 0; i < count; i++) lowGustX += pos.getX(i);
    inst.setControl('gust', 6.0);
    inst.seek(PIN);
    let highGustX = 0;
    for (let i = 0; i < count; i++) highGustX += pos.getX(i);
    expect(Math.abs(highGustX - lowGustX)).toBeGreaterThan(1e-2);

    // TURBULENCE also changes the pinned frame: sweeping it scatters the motes
    // differently at the SAME t (another trajectory control via markDirty).
    inst.setControl('turbulence', 0.0);
    inst.seek(PIN);
    let lowTurbY = 0;
    for (let i = 0; i < count; i++) lowTurbY += pos.getY(i);
    inst.setControl('turbulence', 3.0);
    inst.seek(PIN);
    let highTurbY = 0;
    for (let i = 0; i < count; i++) highTurbY += pos.getY(i);
    expect(Math.abs(highTurbY - lowTurbY)).toBeGreaterThan(1e-2);

    // And brightness (live speed proxy) responds to gust around the engaged
    // window: the gust front raises the field's mean speed (= brightness) versus
    // a calm field. Sample a few frames around the pin so the moving ridge is
    // sure to be on-frame, and compare peak brightness with/without gust.
    let calmPeak = 0;
    let gustyPeak = 0;
    const dt = 1 / 90;
    for (let k = -8; k <= 8; k++) {
      const tt = PIN + k * dt;
      inst.setControl('gust', 0.0);
      inst.seek(tt);
      calmPeak = Math.max(calmPeak, meanLum(col, count));
      inst.setControl('gust', 6.0);
      inst.seek(tt);
      gustyPeak = Math.max(gustyPeak, meanLum(col, count));
    }
    expect(gustyPeak - calmPeak).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
