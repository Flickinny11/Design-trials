import { describe, it, expect } from 'vitest';
import { Sprite, type BufferGeometry, type InstancedBufferAttribute } from 'three';
import type { PointsNodeMaterial } from 'three/webgpu';
import { clickBurstPrimitive } from '@/lib/prism/animatable/primitives/click-burst';
import { makeTarget, runConformance } from './_conformance';

/** Find the built instanced Sprite under the target. */
function burstSprite(target: ReturnType<typeof makeTarget>): Sprite {
  let sprite: Sprite | null = null;
  target.object.traverse((o) => {
    if ((o as Sprite).isSprite) sprite = o as Sprite;
  });
  if (!sprite) throw new Error('no Sprite built');
  return sprite;
}

function instancePositions(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = burstSprite(target).geometry as BufferGeometry;
  return geo.attributes.instancePosition as InstancedBufferAttribute;
}

function instanceColors(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = burstSprite(target).geometry as BufferGeometry;
  return geo.attributes.instanceColor as InstancedBufferAttribute;
}

/** Mean radial distance of the live (drawn) motes from the burst origin. */
function meanRadius(target: ReturnType<typeof makeTarget>, count: number): number {
  const arr = instancePositions(target).array as Float32Array;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const x = arr[i * 3];
    const y = arr[i * 3 + 1];
    const z = arr[i * 3 + 2];
    sum += Math.hypot(x, y, z);
  }
  return sum / Math.max(1, count);
}

/** Total emitted luminance across the live color buffer. */
function totalLuma(target: ReturnType<typeof makeTarget>, count: number): number {
  const col = instanceColors(target).array as Float32Array;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2];
  }
  return sum;
}

/**
 * Replicate the advocate "pinned engaged frame" control sweep: hold
 * userData.state engaged, repeatedly seek the SAME pinned t (dt≈0), then
 * measure. A live control must reshape THIS frozen frame, not merely a
 * transient. Returns the live-mote summary at the pin for the given control
 * value.
 */
function pinnedEngagedSummary(
  controlId: string,
  value: number,
): { radius: number; luma: number; count: number } {
  const target = makeTarget(clickBurstPrimitive);
  const inst = clickBurstPrimitive.create(target);
  target.userData.state = 1; // engaged (held)
  inst.setControl(controlId, value);
  // Repeated seeks at the same pinned t — exactly what the rig does for sweeps.
  inst.seek(1);
  inst.seek(1);
  inst.seek(1);
  const count = Math.round(inst.getParams().count as number);
  const radius = meanRadius(target, count);
  const luma = totalLuma(target, count);
  inst.dispose();
  return { radius, luma, count };
}

describe('click-burst primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(clickBurstPrimitive).dispose();
  });

  it('is a state-driven empty particles primitive with Infinity duration', () => {
    expect(clickBurstPrimitive.subject).toBe('empty');
    expect(clickBurstPrimitive.category).toBe('particles');
    expect(clickBurstPrimitive.defaultDriver).toBe('state');
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('look layer is a PointsNodeMaterial with TSL color/position nodes (no map)', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);
    const mat = burstSprite(target).material as PointsNodeMaterial;

    expect(mat.isPointsNodeMaterial, 'material is a PointsNodeMaterial').toBe(true);
    expect(mat.colorNode, 'colorNode carries the radial-falloff look').toBeTruthy();
    expect(mat.positionNode, 'positionNode places instances').toBeTruthy();
    expect(mat.map, 'no texture map — falloff is TSL, not a baked sprite').toBeFalsy();
    expect(mat.sizeAttenuation, 'sizeAttenuation preserved').toBe(true);
    expect(mat.depthWrite, 'depthWrite stays off (translucent additive motes)').toBe(false);

    // positionNode reads the live instanced position buffer the CPU writes.
    const posAttr = instancePositions(target);
    expect(posAttr.isInstancedBufferAttribute, 'positions are instanced').toBe(true);
    const positionNode = mat.positionNode as unknown as { attribute?: unknown };
    expect(positionNode.attribute, 'positionNode reads the instanced position buffer').toBe(posAttr);
    inst.dispose();
  });

  it('idle (disengaged) shows a clean rest state — no live motes lit', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);
    target.userData.state = 0; // disengaged
    inst.seek(0);
    // At rest, nothing has been fired, so the field carries no emitted light.
    expect(totalLuma(target, MAX)).toBeLessThan(1e-4);
    inst.dispose();
  });

  it('engage fires ONE decelerating ring-bloom: motes expand then fade over the burst life', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);
    const count = Math.round(inst.getParams().count as number);

    // Rising edge: state goes 0 -> 1, recording the fire time at t=0.2.
    target.userData.state = 0;
    inst.seek(0.2);
    target.userData.state = 1;
    inst.seek(0.2); // fire here

    // Early in the bloom (natural life past the engaged mid-bloom floor):
    // motes are at the inner part of their decelerating reach.
    inst.seek(2.2);
    const rEarly = meanRadius(target, count);
    const lumaEarly = totalLuma(target, count);

    // Later: the ring has expanded outward (deceleration toward the plateau).
    inst.seek(3.4);
    const rMid = meanRadius(target, count);

    // End of life (disengaged so the burst can fully die): light collapses.
    target.userData.state = 0;
    inst.seek(0.2 + 4.0);
    const lumaEnd = totalLuma(target, count);

    expect(rMid, 'ring expands outward as the bloom decelerates').toBeGreaterThan(rEarly + 0.05);
    expect(lumaEarly, 'the fresh bloom is bright').toBeGreaterThan(1);
    expect(lumaEnd, 'everything fades by life end').toBeLessThan(lumaEarly * 0.1);
    inst.dispose();
  });

  it('cools white-hot -> brass: a fresh mote is whiter than a tail mote', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);
    const count = Math.round(inst.getParams().count as number);

    target.userData.state = 0;
    inst.seek(0);
    target.userData.state = 1;
    inst.seek(0); // fire at t=0
    target.userData.state = 0; // let it run its natural life (no engaged floor)

    // Fresh: chroma spread between channels is small (near white-hot).
    inst.seek(0.18);
    const colA = Float32Array.from(instanceColors(target).array as Float32Array);
    // Tail: cooled to brass — the blue channel has dropped well below red.
    inst.seek(1.4);
    const colB = Float32Array.from(instanceColors(target).array as Float32Array);

    // Normalize a representative mote's hue (divide by its own max so the
    // brightness fade doesn't dominate the comparison).
    const hueGap = (c: Float32Array, i: number): number => {
      const r = c[i * 3];
      const g = c[i * 3 + 1];
      const b = c[i * 3 + 2];
      const m = Math.max(r, g, b, 1e-6);
      return (r - b) / m; // 0 ≈ white, >0 ≈ warm (brass)
    };
    expect(hueGap(colB, 0), 'tail mote reads warm brass (r >> b)').toBeGreaterThan(
      hueGap(colA, 0) + 0.1,
    );
    inst.dispose();
  });

  it('re-engage re-fires: a second rising edge restarts the bloom from the origin', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);
    const count = Math.round(inst.getParams().count as number);

    // First burst, then disengage and let it fully expand its natural life.
    target.userData.state = 0;
    inst.seek(0);
    target.userData.state = 1;
    inst.seek(0);
    target.userData.state = 0;
    inst.seek(2.0);
    const rExpanded = meanRadius(target, count);

    // A fresh rising edge at a later time re-fires; disengage immediately so the
    // genuinely-fresh (small) ring is observable without the engaged floor.
    target.userData.state = 1;
    inst.seek(2.5); // re-fire (rising edge)
    target.userData.state = 0;
    inst.seek(2.55); // just after the new fire — ring is small again
    const rFresh = meanRadius(target, count);

    expect(rFresh, 're-engage restarts the bloom near the origin').toBeLessThan(rExpanded * 0.6);
    inst.dispose();
  });

  // ── Control liveness at the PINNED ENGAGED frame (the W4 #1 failure) ──────
  // The advocate sweeps each control low/mid/high at a single frozen engaged
  // frame (repeated dt≈0 seeks) and pixel-diffs. Every control must reshape
  // THAT frame boldly. We assert each control's low→high delta at the real pin.

  it('control [count] reshapes the pinned engaged frame: more live motes', () => {
    const lo = pinnedEngagedSummary('count', 40);
    const hi = pinnedEngagedSummary('count', 90);
    expect(hi.count, 'high count draws far more motes').toBeGreaterThan(lo.count + 30);
    // More motes => more total emitted light at the frozen frame.
    expect(hi.luma, 'denser burst emits more light at the pin').toBeGreaterThan(lo.luma * 1.4);
  });

  it('control [radius] reshapes the pinned engaged frame: wider ring', () => {
    const lo = pinnedEngagedSummary('radius', 0.5);
    const hi = pinnedEngagedSummary('radius', 1.8);
    expect(hi.radius, 'larger radius pushes the standing ring further out').toBeGreaterThan(
      lo.radius * 1.6,
    );
  });

  it('control [deceleration] reshapes the pinned engaged frame: ring reach differs', () => {
    const lo = pinnedEngagedSummary('deceleration', 1.2);
    const hi = pinnedEngagedSummary('deceleration', 6.0);
    // At a fixed mid-bloom local life, a snappier deceleration has already
    // reached more of its plateau radius than a slow one — a visibly different
    // standing ring at the same frozen frame.
    expect(Math.abs(hi.radius - lo.radius), 'deceleration changes the pinned ring radius').toBeGreaterThan(
      0.12,
    );
  });

  it('control [twinkle] reshapes the pinned engaged frame: emitted light differs', () => {
    const lo = pinnedEngagedSummary('twinkle', 0);
    const hi = pinnedEngagedSummary('twinkle', 1);
    // Twinkle modulates per-mote opacity (premultiplied into RGB) at the
    // standing frame, so total emitted light shifts measurably low→high.
    expect(Math.abs(hi.luma - lo.luma), 'twinkle changes total emitted light at the pin').toBeGreaterThan(
      lo.luma * 0.08 + 1,
    );
  });

  it('determinism: re-seeking the same t (same fire history) reproduces identical buffers', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);

    target.userData.state = 0;
    inst.seek(0);
    target.userData.state = 1;
    inst.seek(0); // fire at t=0

    inst.seek(0.9);
    const posA = Float32Array.from(instancePositions(target).array as Float32Array);
    const colA = Float32Array.from(instanceColors(target).array as Float32Array);

    inst.seek(0.3); // scrub away…
    inst.seek(0.9); // …and back: pure seek reproduces the exact frame
    expect(instancePositions(target).array as Float32Array).toEqual(posA);
    expect(instanceColors(target).array as Float32Array).toEqual(colA);
    inst.dispose();
  });

  it('determinism: two independently-built instances seeked identically match', () => {
    const ta = makeTarget(clickBurstPrimitive);
    const tb = makeTarget(clickBurstPrimitive);
    const ia = clickBurstPrimitive.create(ta);
    const ib = clickBurstPrimitive.create(tb);

    for (const t of [ta, tb]) t.userData.state = 0;
    ia.seek(0.1);
    ib.seek(0.1);
    for (const t of [ta, tb]) t.userData.state = 1;
    ia.seek(0.1);
    ib.seek(0.1);
    ia.seek(0.8);
    ib.seek(0.8);

    expect(instancePositions(ta).array as Float32Array).toEqual(
      instancePositions(tb).array as Float32Array,
    );
    expect(instanceColors(ta).array as Float32Array).toEqual(
      instanceColors(tb).array as Float32Array,
    );
    ia.dispose();
    ib.dispose();
  });

  it('dispose frees the geometry + material it created and detaches the sprite', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);

    const sprite = burstSprite(target);
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

// Mirror of the primitive's build-time max instance allocation.
const MAX = 120;
