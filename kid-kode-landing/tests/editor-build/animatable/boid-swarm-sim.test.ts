import { describe, it, expect } from 'vitest';
import { boidSwarmSimPrimitive } from '@/lib/prism/animatable/primitives/boid-swarm-sim';
import { Points } from 'three';
import { makeTarget, runConformance } from './_conformance';

/** Pull the live position buffer out of the THREE.Points the primitive builds. */
function positionsOf(object: { children: unknown[] }): Float32Array {
  const pts = (object.children as unknown[]).find((c) => c instanceof Points) as Points;
  return pts.geometry.getAttribute('position').array as Float32Array;
}

/** Centre of mass of the first `count` active motes. */
function centreOfMass(pos: Float32Array, count: number): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < count; i++) {
    sx += pos[i * 3];
    sy += pos[i * 3 + 1];
  }
  return { x: sx / count, y: sy / count };
}

describe('boid-swarm-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(boidSwarmSimPrimitive).dispose();
  });

  it('integrates real velocity state and the flock herds toward the pointer (not a closed-form field)', () => {
    const target = makeTarget(boidSwarmSimPrimitive);
    // Pointer to the upper-right corner; the flock should migrate toward it.
    target.userData.pointer = { x: 0.85, y: 0.15 };
    const inst = boidSwarmSimPrimitive.create(target);
    const count = inst.getParams().count as number;

    inst.seek(0);
    const pos0 = positionsOf(target.object);
    const com0 = centreOfMass(pos0, count);
    // Snapshot a single mote's path to prove genuine, non-trivial motion.
    const startX = pos0[0];
    const startY = pos0[1];

    // Run the sim forward; sample the flock centre over time.
    let maxStep = 0;
    let prevX = pos0[0];
    let prevY = pos0[1];
    for (let k = 1; k <= 180; k++) {
      inst.seek(k * (1 / 60));
      const pos = positionsOf(target.object);
      const stepDist = Math.hypot(pos[0] - prevX, pos[1] - prevY);
      maxStep = Math.max(maxStep, stepDist);
      prevX = pos[0];
      prevY = pos[1];
    }
    const posEnd = positionsOf(target.object);
    const comEnd = centreOfMass(posEnd, count);

    // The pointer target maps to roughly upper-right of centre.
    // Flock centre of mass must have migrated toward it (+x, +y).
    expect(comEnd.x).toBeGreaterThan(com0.x + 0.1);
    expect(comEnd.y).toBeGreaterThan(com0.y + 0.1);

    // Genuine per-frame motion (velocity state advecting positions), and a mote
    // travelled a real distance — not a frozen field.
    expect(maxStep).toBeGreaterThan(1e-3);
    const moteTravel = Math.hypot(posEnd[0] - startX, posEnd[1] - startY);
    expect(moteTravel).toBeGreaterThan(0.1);

    inst.dispose();
  });

  it('cohesion changes the frozen frame at a pinned t (control is live via markDirty)', () => {
    const target = makeTarget(boidSwarmSimPrimitive);
    target.userData.pointer = { x: 0.5, y: 0.5 };
    const inst = boidSwarmSimPrimitive.create(target);
    const count = inst.getParams().count as number;

    // Spread of the flock = mean distance from its own centre of mass. High
    // cohesion → tighter cloud (smaller spread); low cohesion → looser. Both
    // measured at the SAME pinned mid-action t, proving reset-replay + markDirty.
    const spreadAt = (cohesion: number): number => {
      inst.setControl('cohesion', cohesion);
      const PIN = 2.0; // mid-action: flock well into banking
      inst.seek(PIN);
      const pos = positionsOf(target.object);
      const com = centreOfMass(pos, count);
      let s = 0;
      for (let i = 0; i < count; i++) {
        s += Math.hypot(pos[i * 3] - com.x, pos[i * 3 + 1] - com.y);
      }
      return s / count;
    };

    const looseSpread = spreadAt(0.0); // no cohesion → flock disperses
    const tightSpread = spreadAt(1.5); // max cohesion → flock clumps

    // The frozen frame must visibly differ when cohesion is swept.
    expect(Math.abs(looseSpread - tightSpread)).toBeGreaterThan(1e-3);
    // Physically, more cohesion should not produce a looser cloud.
    expect(tightSpread).toBeLessThan(looseSpread);

    inst.dispose();
  });
});
