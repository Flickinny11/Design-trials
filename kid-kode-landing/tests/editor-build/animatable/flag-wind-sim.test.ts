import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { flagWindSimPrimitive } from '@/lib/prism/animatable/primitives/flag-wind-sim';
import { makeTarget, runConformance } from './_conformance';

// Pull the host plane's position attribute + a helper to read a vertex's z.
function posAttrOf(target: ReturnType<typeof makeTarget>): BufferAttribute {
  const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
  return mesh.geometry.getAttribute('position') as BufferAttribute;
}

// Find the vertex index nearest the given (x,y) on the (cached base) mesh, and
// the index nearest the LEFT/pole edge at the same row, so we can compare the
// pinned pole vs the free trailing edge.
function nearestIndex(attr: BufferAttribute, x: number, y: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < attr.count; i++) {
    const dx = attr.getX(i) - x;
    const dy = attr.getY(i) - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

describe('flag-wind-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(flagWindSimPrimitive).dispose();
  });

  it('flaps in the wind: free edge ripples (non-monotonic z over time) while the pole stays pinned', () => {
    const target = makeTarget(flagWindSimPrimitive);
    const attr = posAttrOf(target);
    // Capture base x/y BEFORE the sim runs (it overwrites positions in place).
    const baseX: number[] = [];
    const baseY: number[] = [];
    for (let i = 0; i < attr.count; i++) { baseX.push(attr.getX(i)); baseY.push(attr.getY(i)); }
    // Pole vertex: left edge mid-height. Free vertex: right edge mid-height.
    const poleI = nearestIndex(attr, -0.9, 0);
    const freeI = nearestIndex(attr, 0.9, 0);
    const poleBaseZ = attr.getZ(poleI);

    const inst = flagWindSimPrimitive.create(target);

    const dt = 1 / 60;
    let minFreeZ = Infinity;
    let maxFreeZ = -Infinity;
    let maxPoleDrift = 0;
    let sawRipple = false;
    let prevDelta = 0;
    let prevFreeZ = 0;
    for (let k = 1; k <= 360; k++) {
      inst.seek(k * dt);
      const fz = attr.getZ(freeI);
      minFreeZ = Math.min(minFreeZ, fz);
      maxFreeZ = Math.max(maxFreeZ, fz);
      // Pole must stay essentially where it started (left edge pinned, invMass=0).
      maxPoleDrift = Math.max(
        maxPoleDrift,
        Math.abs(attr.getX(poleI) - baseX[poleI]) +
          Math.abs(attr.getY(poleI) - baseY[poleI]) +
          Math.abs(attr.getZ(poleI) - poleBaseZ),
      );
      // A real flap = the free edge's per-frame z delta changes sign (rises then
      // falls again), not a one-way settle.
      const delta = fz - prevFreeZ;
      if (k > 3 && prevDelta > 1e-4 && delta < -1e-4) sawRipple = true;
      prevDelta = delta;
      prevFreeZ = fz;
    }

    // The free trailing edge genuinely moves out of plane (wind lifted it).
    expect(maxFreeZ - minFreeZ).toBeGreaterThan(0.05);
    // And it flaps (oscillates), proving emergent cloth motion, not a one-shot drape.
    expect(sawRipple).toBe(true);
    // The pinned pole barely moves — the left edge is anchored.
    expect(maxPoleDrift).toBeLessThan(0.05);
    // The free edge moves far more than the pole (a flag, not a rigid sheet).
    expect(maxFreeZ - minFreeZ).toBeGreaterThan(maxPoleDrift + 0.04);

    inst.dispose();
  });

  it('wind is live at a frozen pin: sweeping wind at the SAME t changes the cloth (markDirty works)', () => {
    const target = makeTarget(flagWindSimPrimitive);
    const attr = posAttrOf(target);
    const inst = flagWindSimPrimitive.create(target);
    const freeI = nearestIndex(attr, 0.9, 0);

    // Mid-flap engaged frame (well past the initial billow-out).
    const PIN = 3.0;

    inst.setControl('wind', 0.5);
    inst.seek(PIN);
    const calmZ = attr.getZ(freeI);

    inst.setControl('wind', 11.5);
    inst.seek(PIN);
    const blownZ = attr.getZ(freeI);

    // Same pinned t, different wind → the frozen frame must differ (reset-replay
    // + onParamChange→markDirty makes the trajectory a standing fn of the pose).
    expect(Math.abs(blownZ - calmZ)).toBeGreaterThan(1e-3);

    // Gravity is also a live trajectory control at the same pin.
    inst.setControl('gravity', 0.2);
    inst.seek(PIN);
    const lightG = attr.getZ(freeI);
    inst.setControl('gravity', 11);
    inst.seek(PIN);
    const heavyG = attr.getZ(freeI);
    expect(Math.abs(heavyG - lightG)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
