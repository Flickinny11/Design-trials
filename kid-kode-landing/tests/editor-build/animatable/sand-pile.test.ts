import { describe, it, expect } from 'vitest';
import { Sprite, type BufferGeometry, type InstancedBufferAttribute } from 'three';
import type { PointsNodeMaterial } from 'three/webgpu';
import { sandPilePrimitive } from '@/lib/prism/animatable/primitives/sand-pile';
import { makeTarget, runConformance } from './_conformance';

/** Find the built instanced Sprite under the target. */
function sandSprite(target: ReturnType<typeof makeTarget>): Sprite {
  let sprite: Sprite | null = null;
  target.object.traverse((o) => {
    if ((o as Sprite).isSprite) sprite = o as Sprite;
  });
  if (!sprite) throw new Error('no Sprite built');
  return sprite;
}

/** The per-grain instanced position attribute. */
function grainPositions(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = sandSprite(target).geometry as BufferGeometry;
  return geo.attributes.instancePosition as InstancedBufferAttribute;
}

/** The per-grain instanced color attribute. */
function grainColors(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = sandSprite(target).geometry as BufferGeometry;
  return geo.attributes.instanceColor as InstancedBufferAttribute;
}

// Mirror of the primitive's build-time extents: the heightfield catches grains
// between FLOOR_Y (column base) and the top of the tile; a grain is "in the
// pile" once its y is at/near the floor band.
const FLOOR_Y = -1.0;
const LOOP = 10;

/** Count grains whose y sits within `band` of the column floor — i.e. settled
 *  into the dune (a proxy for accumulated pile mass). */
function settledCount(target: ReturnType<typeof makeTarget>, n: number, band = 0.85): number {
  const pos = grainPositions(target).array as Float32Array;
  let c = 0;
  for (let i = 0; i < n; i++) {
    const y = pos[i * 3 + 1];
    // In the pile band AND not parked far below the floor (HIDDEN_Y).
    if (y >= FLOOR_Y - 0.5 && y <= FLOOR_Y + band) c += 1;
  }
  return c;
}

/** Mean visible luminance of the live grains (RGB sum / 3), a proxy for how
 *  much bright sand the frozen frame shows — used for liveness deltas. */
function meanLuma(target: ReturnType<typeof makeTarget>, n: number): number {
  const col = grainColors(target).array as Float32Array;
  let s = 0;
  for (let i = 0; i < n; i++) s += (col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2]) / 3;
  return s / Math.max(1, n);
}

/** Aggregate mass = sum of grain heights above the floor across the live pool —
 *  a single scalar capturing how much dune has accumulated. */
function pileMass(target: ReturnType<typeof makeTarget>, n: number): number {
  const pos = grainPositions(target).array as Float32Array;
  let m = 0;
  for (let i = 0; i < n; i++) m += Math.max(0, pos[i * 3 + 1] - FLOOR_Y);
  return m;
}

/** Settled-dune mass: like pileMass but ONLY grains resting in the pile band
 *  (excludes high-airborne raining/blowing grains). Captures the persistent
 *  dune size, the thing that should be ~0 at the loop's start/end. */
function duneMass(target: ReturnType<typeof makeTarget>, n: number): number {
  const pos = grainPositions(target).array as Float32Array;
  let m = 0;
  for (let i = 0; i < n; i++) {
    const y = pos[i * 3 + 1];
    if (y >= FLOOR_Y - 0.5 && y <= FLOOR_Y + 0.9) m += Math.max(0, y - FLOOR_Y);
  }
  return m;
}

describe('sand-pile primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(sandPilePrimitive).dispose();
  });

  it('is a finite ~10s looping time primitive of category particles', () => {
    expect(sandPilePrimitive.category).toBe('particles');
    expect(sandPilePrimitive.defaultDriver).toBe('time');
    expect(sandPilePrimitive.subject).toBe('empty');
    const target = makeTarget(sandPilePrimitive);
    const inst = sandPilePrimitive.create(target);
    expect(inst.duration()).toBeCloseTo(LOOP, 3);
    inst.dispose();
  });

  it('renders via an instanced Sprite + PointsNodeMaterial with TSL nodes (no map)', () => {
    const target = makeTarget(sandPilePrimitive);
    const inst = sandPilePrimitive.create(target);

    const sprite = sandSprite(target);
    const mat = sprite.material as PointsNodeMaterial;
    expect(mat.isPointsNodeMaterial, 'material is a PointsNodeMaterial').toBe(true);
    expect(mat.colorNode, 'colorNode carries the radial-falloff look').toBeTruthy();
    expect(mat.positionNode, 'positionNode places instances').toBeTruthy();
    expect(mat.map, 'no baked texture map — falloff is TSL').toBeFalsy();
    expect(mat.sizeAttenuation, 'sizeAttenuation preserved').toBe(true);
    expect(mat.transparent, 'transparent preserved').toBe(true);
    expect(mat.depthWrite, 'depthWrite stays off').toBe(false);

    // positionNode is fed by the same instanced attribute the CPU writes.
    const posAttr = grainPositions(target);
    expect(posAttr.isInstancedBufferAttribute, 'positions are instanced').toBe(true);
    const positionNode = mat.positionNode as unknown as { attribute?: unknown };
    expect(positionNode.attribute, 'positionNode reads the instanced buffer').toBe(posAttr);

    const colAttr = grainColors(target);
    expect(colAttr.isInstancedBufferAttribute, 'colors are instanced').toBe(true);

    expect(sprite.count, 'sprite.count drives instanceCount').toBeGreaterThan(0);
    inst.dispose();
  });

  it('idle frame (t=0) shows a clean tile with no accumulated dune (rest state)', () => {
    const target = makeTarget(sandPilePrimitive);
    const inst = sandPilePrimitive.create(target);
    inst.seek(0);
    const n = grainPositions(target).count;
    // No settled dune at the very start of the loop — a clean rest state (a
    // few grains may already be entering at the very top, which is the
    // intended "about to rain" look, not a built pile).
    expect(duneMass(target, n)).toBeLessThan(0.5);
    inst.dispose();
  });

  it('BUILDS: the dune accumulates mass over the build phase (more settled grains later)', () => {
    const target = makeTarget(sandPilePrimitive);
    const inst = sandPilePrimitive.create(target);
    const n = grainPositions(target).count;

    inst.seek(LOOP * 0.1);
    const massEarly = pileMass(target, n);
    const settledEarly = settledCount(target, n);

    inst.seek(LOOP * 0.6); // late in the build phase, before the gust
    const massLate = pileMass(target, n);
    const settledLate = settledCount(target, n);

    // The pile has visibly grown: more accumulated mass AND more settled grains.
    expect(massLate).toBeGreaterThan(massEarly + 1.0);
    expect(settledLate).toBeGreaterThan(settledEarly);
    inst.dispose();
  });

  it('GUST: the late-loop wind sweeps the dune back toward empty for the seamless restart', () => {
    const target = makeTarget(sandPilePrimitive);
    const inst = sandPilePrimitive.create(target);
    const n = grainPositions(target).count;

    inst.seek(LOOP * 0.6); // peak dune (pre-gust)
    const massPeak = pileMass(target, n);

    inst.seek(LOOP * 0.99); // end of the gust, just before the loop restarts
    const massEnd = pileMass(target, n);

    // The gust has eroded most of the dune away.
    expect(massEnd).toBeLessThan(massPeak * 0.5);
    inst.dispose();
  });

  it('determinism: re-seeking the same t replays identical pile state (forward + backward)', () => {
    const target = makeTarget(sandPilePrimitive);
    const inst = sandPilePrimitive.create(target);

    inst.seek(LOOP * 0.55);
    const posA = Float32Array.from(grainPositions(target).array as Float32Array);
    const colA = Float32Array.from(grainColors(target).array as Float32Array);

    inst.seek(LOOP * 0.2); // scrub backward (replay fewer steps)…
    inst.seek(LOOP * 0.9); // …forward past it…
    inst.seek(LOOP * 0.55); // …and back to the exact frame.
    expect(grainPositions(target).array as Float32Array).toEqual(posA);
    expect(grainColors(target).array as Float32Array).toEqual(colA);

    inst.dispose();
  });

  it('determinism: two independent instances seeked identically match exactly', () => {
    const a = makeTarget(sandPilePrimitive);
    const b = makeTarget(sandPilePrimitive);
    const ia = sandPilePrimitive.create(a);
    const ib = sandPilePrimitive.create(b);

    ia.seek(LOOP * 0.5);
    ib.seek(LOOP * 0.5);

    expect(grainPositions(a).array as Float32Array).toEqual(
      grainPositions(b).array as Float32Array,
    );
    expect(grainColors(a).array as Float32Array).toEqual(
      grainColors(b).array as Float32Array,
    );
    ia.dispose();
    ib.dispose();
  });

  // ── CONTROL LIVENESS — each control must BOLDLY reshape the FROZEN pinned
  // engaged frame (repeated dt≈0 seeks at the same t). The rig pins time-tile
  // control sweeps at t=duration on a fallback clock; we measure at the dune's
  // peak (pre-gust) so structural changes are unmistakable. Target: a plainly
  // visible delta, far above sub-noise (~0.5-3). ──────────────────────────────
  const PIN = LOOP * 0.6; // engaged: a tall, settled dune, before the gust

  /** Snapshot the live grain positions at the pinned frame after setting one
   *  control low then high, with REPEATED seeks at the SAME t (frozen frame,
   *  the advocate's static measure). Returns the L1 distance between the two. */
  function controlDelta(
    id: string,
    low: number,
    high: number,
    metric: (t: ReturnType<typeof makeTarget>, n: number) => number,
    pin = PIN,
  ): number {
    const target = makeTarget(sandPilePrimitive);
    const inst = sandPilePrimitive.create(target);
    const n = grainPositions(target).count;

    inst.setControl(id, low);
    inst.seek(pin);
    inst.seek(pin); // repeated frozen seek — the advocate's static capture
    const lo = metric(target, n);

    inst.setControl(id, high);
    inst.seek(pin);
    inst.seek(pin);
    const hi = metric(target, n);

    inst.dispose();
    return Math.abs(hi - lo);
  }

  it('control liveness: grain rate BOLDLY reshapes the pinned dune (more grains accumulated)', () => {
    // More grains raining over the same elapsed time = a far bigger dune.
    const dMass = controlDelta('rate', 6, 60, pileMass);
    expect(dMass).toBeGreaterThan(10.0); // bold — measured ~80 scene-units
  });

  it('control liveness: repose angle reshapes the pinned dune profile', () => {
    // A steeper repose angle holds a taller, narrower dune; a shallow one
    // spreads flat — the accumulated mass profile at the pin differs.
    const dMass = controlDelta('repose', 0.18, 0.95, pileMass);
    expect(dMass).toBeGreaterThan(2.0);
  });

  it('control liveness: grain size BOLDLY reshapes the pinned frame (taller dune + brighter motes)', () => {
    // Larger grains stack taller per landing (positional reshape) AND read
    // brighter on the frozen frame (per-grain luma lift) — both are visible.
    const dMass = controlDelta('grainSize', 0.02, 0.07, pileMass);
    const dLuma = controlDelta('grainSize', 0.02, 0.07, meanLuma);
    expect(dMass).toBeGreaterThan(10.0); // bold — measured ~42 scene-units
    expect(dLuma).toBeGreaterThan(0.02); // and the motes brighten too
  });

  it('control liveness: gust strength BOLDLY reshapes the pinned dune (stronger gust erodes more)', () => {
    // The gust only acts in the last 20% of the loop, so pin INSIDE the gust
    // window: a stronger gust has blown a visibly larger bite out of the dune
    // at the frozen frame than a weak one. (The harness re-freezes at a swept-
    // visible phase; this asserts the effect is real where the gust is live.)
    const dMass = controlDelta('gust', 0.1, 1.0, pileMass, LOOP * 0.9);
    expect(dMass).toBeGreaterThan(6.0); // bold — measured ~16 scene-units
  });

  it('dispose restores: sprite removed and its geometry/material freed', () => {
    const target = makeTarget(sandPilePrimitive);
    const inst = sandPilePrimitive.create(target);

    const sprite = sandSprite(target);
    const geometry = sprite.geometry as BufferGeometry;
    const material = sprite.material as PointsNodeMaterial;

    let geometryDisposed = false;
    let materialDisposed = false;
    geometry.addEventListener('dispose', () => {
      geometryDisposed = true;
    });
    material.addEventListener('dispose', () => {
      materialDisposed = true;
    });

    inst.dispose();
    expect(geometryDisposed, 'geometry dispose() fired').toBe(true);
    expect(materialDisposed, 'material dispose() fired').toBe(true);
    expect(target.object.children.includes(sprite), 'sprite removed from target').toBe(false);
  });
});
