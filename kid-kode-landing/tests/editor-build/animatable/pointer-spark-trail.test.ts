import { describe, it, expect } from 'vitest';
import { Sprite, type BufferGeometry, type InstancedBufferAttribute } from 'three';
import type { PointsNodeMaterial } from 'three/webgpu';
import { pointerSparkTrailPrimitive } from '@/lib/prism/animatable/primitives/pointer-spark-trail';
import { makeTarget, runConformance } from './_conformance';

type Target = ReturnType<typeof makeTarget>;

/** Find the built instanced Sprite under the target. */
function sparkSprite(target: Target): Sprite {
  let sprite: Sprite | null = null;
  target.object.traverse((o) => {
    if ((o as Sprite).isSprite) sprite = o as Sprite;
  });
  if (!sprite) throw new Error('no Sprite built');
  return sprite;
}

function instancePositions(target: Target): InstancedBufferAttribute {
  const geo = sparkSprite(target).geometry as BufferGeometry;
  return geo.attributes.instancePosition as InstancedBufferAttribute;
}
function instanceColors(target: Target): InstancedBufferAttribute {
  const geo = sparkSprite(target).geometry as BufferGeometry;
  return geo.attributes.instanceColor as InstancedBufferAttribute;
}

/** Set the pointer the rig hands the primitive. */
function setPointer(target: Target, x: number, y: number): void {
  (target.userData as { pointer: { x: number; y: number } }).pointer = { x, y };
}

/**
 * Settle the velocity envelope at a frozen pinned frame: seek the SAME t with
 * the SAME pinned pointer repeatedly (dt≈0), exactly as the advocate capture
 * does, so the moving-cursor velocity term decays to ~0 and the standing idle
 * sputter is what we measure. Returns the converged instanced-position array.
 */
function settledPositions(
  inst: ReturnType<typeof pointerSparkTrailPrimitive.create>,
  target: Target,
  t = 1,
): Float32Array {
  for (let k = 0; k < 8; k++) inst.seek(t);
  return Float32Array.from(instancePositions(target).array as Float32Array);
}

/** Mean abs diff + changed fraction over two equal-length arrays (the advocate's
 *  liveness metric: meanAbsDiff and changedFrac at the frozen pin). Scaled ×100
 *  to mirror the advocate's 0..255-ish pixel space loosely; we assert on raw
 *  scene-unit deltas which are far above the sub-noise floor. */
function delta(a: Float32Array, b: Float32Array): { meanAbs: number; changedFrac: number } {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    if (d > 1e-3) changed++;
  }
  return { meanAbs: sum / n, changedFrac: changed / n };
}

// Pin the brief specifies for THIS primitive's control sweeps.
const PIN_X = 0.62;
const PIN_Y = 0.5;

describe('pointer-spark-trail primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerSparkTrailPrimitive).dispose();
  });

  it('static metadata: medium / particles / empty / pointer-driven, Infinity duration', () => {
    expect(pointerSparkTrailPrimitive.category).toBe('particles');
    expect(pointerSparkTrailPrimitive.subject).toBe('empty');
    expect(pointerSparkTrailPrimitive.defaultDriver).toBe('pointer');
    expect(pointerSparkTrailPrimitive.difficulty).toBe('medium');
    expect(pointerSparkTrailPrimitive.schema.length).toBeGreaterThanOrEqual(3);
    expect(pointerSparkTrailPrimitive.schema.length).toBeLessThanOrEqual(6);
    const ids = pointerSparkTrailPrimitive.schema.map((c) => c.id);
    for (const id of ['emissionRate', 'gravity', 'sparkLife', 'coneSpread']) {
      expect(ids, `has ${id} control`).toContain(id);
    }
    const inst = pointerSparkTrailPrimitive.create(makeTarget(pointerSparkTrailPrimitive));
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  // ── Render mechanism: embers P0-fixed instanced Sprite + TSL falloff ──────
  it('renders as an instanced Sprite with a PointsNodeMaterial (no map, additive, TSL nodes)', () => {
    const target = makeTarget(pointerSparkTrailPrimitive);
    const inst = pointerSparkTrailPrimitive.create(target);

    const sprite = sparkSprite(target);
    const mat = sprite.material as PointsNodeMaterial;
    expect(mat.isPointsNodeMaterial, 'PointsNodeMaterial').toBe(true);
    expect(mat.colorNode, 'colorNode carries the radial-falloff look').toBeTruthy();
    expect(mat.positionNode, 'positionNode places instances').toBeTruthy();
    expect(mat.map, 'no baked texture map — falloff is TSL').toBeFalsy();
    expect(mat.sizeAttenuation).toBe(true);
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite, 'depthWrite off for translucent motes').toBe(false);

    // positionNode reads the SAME instanced buffer the CPU loop writes.
    const posAttr = instancePositions(target);
    expect(posAttr.isInstancedBufferAttribute).toBe(true);
    const positionNode = mat.positionNode as unknown as { attribute?: unknown };
    expect(positionNode.attribute, 'positionNode reads the live instanced position buffer').toBe(
      posAttr,
    );
    expect(instanceColors(target).isInstancedBufferAttribute).toBe(true);
    expect(sprite.count, 'instanceCount engaged').toBeGreaterThan(0);

    inst.dispose();
  });

  // ── Behavior: sparks shear off the pointer, arc DOWN under gravity ────────
  it('plays: at the pinned point sparks occupy a live ballistic fan that evolves over time', () => {
    const target = makeTarget(pointerSparkTrailPrimitive);
    setPointer(target, PIN_X, PIN_Y);
    const inst = pointerSparkTrailPrimitive.create(target);

    // Frame A and a distinct later frame B at the same pinned point: the shed
    // fan must be a non-trivial live system that changes as the clock advances.
    const a = settledPositions(inst, target, 0.2);
    const b = settledPositions(inst, target, 0.9);

    // The standing fan is populated (not all parked) at frame A.
    const emission = inst.getParams().emissionRate as number;
    let liveCount = 0;
    for (let i = 0; i < emission; i++) {
      if (a[i * 3 + 1] > -900) liveCount++; // not parked at HIDDEN_Y
    }
    expect(liveCount, 'idle sputter populates the fan at the pin').toBeGreaterThan(emission * 0.5);

    // The fan evolves over time (looping shed) — A vs B differ boldly.
    expect(delta(a, b).meanAbs, 'fan evolves over time').toBeGreaterThan(0.02);

    inst.dispose();
  });

  it('behavior: a freshly-sheared spark is hotter (brighter) than a near-dead one (white→brass→ash cooling)', () => {
    const target = makeTarget(pointerSparkTrailPrimitive);
    setPointer(target, PIN_X, PIN_Y);
    const inst = pointerSparkTrailPrimitive.create(target);
    settledPositions(inst, target, 1.0);

    const pos = instancePositions(target).array as Float32Array;
    const col = instanceColors(target).array as Float32Array;
    const emission = inst.getParams().emissionRate as number;

    // Recover each spark's life-phase: a spark high & near the strike streak is
    // young; one that has arced well below the strike is old. Use brightness
    // (premultiplied lum) directly — young sparks are far brighter than dying.
    let maxLum = 0;
    let minLumLive = Infinity;
    for (let i = 0; i < emission; i++) {
      if (pos[i * 3 + 1] < -900) continue; // parked
      const lum = col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2];
      if (lum > maxLum) maxLum = lum;
      if (lum > 1e-4 && lum < minLumLive) minLumLive = lum;
    }
    expect(maxLum, 'a hot spark exists').toBeGreaterThan(0.2);
    // The hottest spark is markedly brighter than the dimmest live one (cooling
    // fade premultiplied into RGB under additive blending).
    expect(maxLum, 'hot strike far brighter than a cooling spark').toBeGreaterThan(minLumLive * 1.5);

    inst.dispose();
  });

  // ══ CONTROL LIVENESS at the FROZEN pinned frame (the #1 W4 failure) ═══════
  // Each control's low→high delta is measured at the SAME settled pinned frame
  // (repeated dt≈0 seeks), exactly as the advocate captures it. Deltas must be
  // BOLD (well above the sub-noise floor) on a static repeated-seek measure.

  it('control liveness: emissionRate reshapes the standing population at the pin', () => {
    const target = makeTarget(pointerSparkTrailPrimitive);
    setPointer(target, PIN_X, PIN_Y);
    const inst = pointerSparkTrailPrimitive.create(target);

    inst.setControl('emissionRate', 12);
    settledPositions(inst, target, 1);
    let lowLive = 0;
    const lowArr = instancePositions(target).array as Float32Array;
    for (let i = 0; i < 120; i++) if (lowArr[i * 3 + 1] > -900) lowLive++;

    inst.setControl('emissionRate', 120);
    settledPositions(inst, target, 1);
    let highLive = 0;
    const highArr = instancePositions(target).array as Float32Array;
    for (let i = 0; i < 120; i++) if (highArr[i * 3 + 1] > -900) highLive++;

    // Population swing is large and unmistakable (3-sparse vs dense fan).
    expect(highLive - lowLive, 'more sparks live at high emission').toBeGreaterThan(50);
    expect(sparkSprite(target).count, 'instanceCount tracks emission').toBe(120);

    inst.dispose();
  });

  it('control liveness: gravity drags the standing fan visibly lower at the pin', () => {
    const target = makeTarget(pointerSparkTrailPrimitive);
    setPointer(target, PIN_X, PIN_Y);
    const inst = pointerSparkTrailPrimitive.create(target);

    inst.setControl('gravity', 0.3);
    const low = settledPositions(inst, target, 1);
    inst.setControl('gravity', 2.6);
    const high = settledPositions(inst, target, 1);

    const dd = delta(low, high);
    expect(dd.meanAbs, 'gravity reshapes the frozen fan boldly').toBeGreaterThan(0.05);
    expect(dd.changedFrac, 'a large fraction of sparks moved').toBeGreaterThan(0.12);

    // Direction check: higher gravity pulls the population's mean y DOWN.
    const meanY = (arr: Float32Array) => {
      let s = 0;
      let n = 0;
      for (let i = 0; i < 120; i++) {
        if (arr[i * 3 + 1] > -900) {
          s += arr[i * 3 + 1];
          n++;
        }
      }
      return n ? s / n : 0;
    };
    expect(meanY(high), 'strong gravity sits lower').toBeLessThan(meanY(low));

    inst.dispose();
  });

  it('control liveness: sparkLife changes the standing fan at the pin', () => {
    const target = makeTarget(pointerSparkTrailPrimitive);
    setPointer(target, PIN_X, PIN_Y);
    const inst = pointerSparkTrailPrimitive.create(target);

    inst.setControl('sparkLife', 0.6);
    const low = settledPositions(inst, target, 1);
    inst.setControl('sparkLife', 1.2);
    const high = settledPositions(inst, target, 1);

    const dd = delta(low, high);
    expect(dd.meanAbs, 'sparkLife reshapes the frozen fan boldly').toBeGreaterThan(0.05);
    expect(dd.changedFrac, 'a large fraction of sparks shifted').toBeGreaterThan(0.12);

    inst.dispose();
  });

  it('control liveness: coneSpread widens/narrows the standing fan at the pin', () => {
    const target = makeTarget(pointerSparkTrailPrimitive);
    setPointer(target, PIN_X, PIN_Y);
    const inst = pointerSparkTrailPrimitive.create(target);

    inst.setControl('coneSpread', 0.1);
    const narrow = settledPositions(inst, target, 1);
    inst.setControl('coneSpread', 1.4);
    const wide = settledPositions(inst, target, 1);

    const dd = delta(narrow, wide);
    expect(dd.meanAbs, 'coneSpread reshapes the frozen fan boldly').toBeGreaterThan(0.05);
    expect(dd.changedFrac).toBeGreaterThan(0.12);

    // Direction: wider cone spreads the lateral (x/z) extent farther from the
    // strike axis than a narrow one.
    const lateralSpan = (arr: Float32Array) => {
      let maxR = 0;
      for (let i = 0; i < 120; i++) {
        if (arr[i * 3 + 1] < -900) continue;
        const dx = arr[i * 3] - (PIN_X - 0.5) * 1.7;
        const dz = arr[i * 3 + 2];
        maxR = Math.max(maxR, Math.hypot(dx, dz));
      }
      return maxR;
    };
    expect(lateralSpan(wide), 'wide cone spreads farther laterally').toBeGreaterThan(
      lateralSpan(narrow),
    );

    inst.dispose();
  });

  // ── Determinism: two instances seeked through an identical sequence match ─
  it('determinism: two instances driven through the identical seek sequence match byte-for-byte', () => {
    const ta = makeTarget(pointerSparkTrailPrimitive);
    const tb = makeTarget(pointerSparkTrailPrimitive);
    const ia = pointerSparkTrailPrimitive.create(ta);
    const ib = pointerSparkTrailPrimitive.create(tb);

    // Identical driver history (including pointer motion → identical velocity
    // envelope evolution → identical shed energy).
    const seq: Array<[number, number, number]> = [
      [0.0, 0.5, 0.5],
      [0.1, 0.55, 0.48],
      [0.25, 0.62, 0.5],
      [0.5, 0.62, 0.5],
      [0.8, 0.62, 0.5],
    ];
    for (const [t, x, y] of seq) {
      setPointer(ta, x, y);
      setPointer(tb, x, y);
      ia.seek(t);
      ib.seek(t);
    }

    expect(instancePositions(ta).array as Float32Array).toEqual(
      instancePositions(tb).array as Float32Array,
    );
    expect(instanceColors(ta).array as Float32Array).toEqual(
      instanceColors(tb).array as Float32Array,
    );

    ia.dispose();
    ib.dispose();
  });

  it('determinism: uses no Math.random (settled frozen frame is reproducible)', () => {
    const target = makeTarget(pointerSparkTrailPrimitive);
    setPointer(target, PIN_X, PIN_Y);
    const inst = pointerSparkTrailPrimitive.create(target);

    // Settle the velocity envelope at the pin, snapshot, then settle again from
    // scratch on a fresh instance with the SAME pinned history — must match.
    const a = settledPositions(inst, target, 1);

    const t2 = makeTarget(pointerSparkTrailPrimitive);
    setPointer(t2, PIN_X, PIN_Y);
    const i2 = pointerSparkTrailPrimitive.create(t2);
    const b = settledPositions(i2, t2, 1);

    expect(a).toEqual(b);

    inst.dispose();
    i2.dispose();
  });

  // ── dispose restores + frees only what the primitive created ──────────────
  it('dispose: removes the sprite and frees its geometry + material', () => {
    const target = makeTarget(pointerSparkTrailPrimitive);
    const inst = pointerSparkTrailPrimitive.create(target);

    const sprite = sparkSprite(target);
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
    expect(target.object.children.includes(sprite), 'sprite removed').toBe(false);
  });
});
