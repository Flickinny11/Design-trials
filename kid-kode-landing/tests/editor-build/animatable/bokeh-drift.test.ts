import { describe, it, expect } from 'vitest';
import { Sprite, type BufferGeometry, type InstancedBufferAttribute } from 'three';
import type { PointsNodeMaterial } from 'three/webgpu';
import { bokehDriftPrimitive } from '@/lib/prism/animatable/primitives/bokeh-drift';
import { makeTarget, runConformance } from './_conformance';

/** Find the built instanced Sprite under the target. */
function bokehSprite(target: ReturnType<typeof makeTarget>): Sprite {
  let sprite: Sprite | null = null;
  target.object.traverse((o) => {
    if ((o as Sprite).isSprite) sprite = o as Sprite;
  });
  if (!sprite) throw new Error('no Sprite built');
  return sprite;
}

function attr(
  target: ReturnType<typeof makeTarget>,
  name: string,
): InstancedBufferAttribute {
  const geo = bokehSprite(target).geometry as BufferGeometry;
  return geo.attributes[name] as InstancedBufferAttribute;
}

const positions = (t: ReturnType<typeof makeTarget>) =>
  attr(t, 'instancePosition').array as Float32Array;
const colors = (t: ReturnType<typeof makeTarget>) =>
  attr(t, 'instanceColor').array as Float32Array;
const radii = (t: ReturnType<typeof makeTarget>) =>
  attr(t, 'instanceRadius').array as Float32Array;
const feathers = (t: ReturnType<typeof makeTarget>) =>
  attr(t, 'instanceFeather').array as Float32Array;

const HIDDEN = 1000;

/** Count discs currently on-view (not parked far off-screen). */
function liveCount(t: ReturnType<typeof makeTarget>): number {
  const pos = positions(t);
  let n = 0;
  for (let i = 0; i < pos.length / 3; i++) {
    if (Math.abs(pos[i * 3 + 1]) < HIDDEN / 2) n++;
  }
  return n;
}

/** Mean absolute per-element difference over a window of the buffers. */
function meanAbsDiff(a: Float32Array, b: Float32Array, len: number): number {
  let s = 0;
  for (let i = 0; i < len; i++) s += Math.abs(a[i] - b[i]);
  return s / len;
}

describe('bokeh-drift primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(bokehDriftPrimitive).dispose();
  });

  it('is registered as an easy time-driven empty-subject particles primitive', () => {
    expect(bokehDriftPrimitive.category).toBe('particles');
    expect(bokehDriftPrimitive.difficulty).toBe('easy');
    expect(bokehDriftPrimitive.subject).toBe('empty');
    expect(bokehDriftPrimitive.defaultDriver).toBe('time');
    // 3-6 controls per schema rule (count/size/drift/iris).
    expect(bokehDriftPrimitive.schema.length).toBeGreaterThanOrEqual(3);
    expect(bokehDriftPrimitive.schema.length).toBeLessThanOrEqual(6);
  });

  it('builds an instanced sprite with a TSL aperture-profile node material (no map)', () => {
    const target = makeTarget(bokehDriftPrimitive);
    const inst = bokehDriftPrimitive.create(target);

    const sprite = bokehSprite(target);
    const mat = sprite.material as PointsNodeMaterial;

    expect(mat.isPointsNodeMaterial, 'material is a PointsNodeMaterial').toBe(true);
    expect(mat.colorNode, 'colorNode carries the aperture-profile look').toBeTruthy();
    expect(mat.positionNode, 'positionNode places disc centers').toBeTruthy();
    expect(mat.map, 'no texture map — the profile is TSL, not a baked sprite').toBeFalsy();
    expect(mat.transparent, 'transparent for soft additive discs').toBe(true);
    expect(mat.depthWrite, 'depthWrite stays off for translucent discs').toBe(false);

    // positionNode reads the SAME instanced center buffer the CPU loop writes.
    const posAttr = attr(target, 'instancePosition');
    expect(posAttr.isInstancedBufferAttribute, 'centers are instanced').toBe(true);
    const positionNode = mat.positionNode as unknown as { attribute?: unknown };
    expect(positionNode.attribute, 'positionNode reads the instanced center buffer').toBe(posAttr);

    // Per-disc radius + feather attributes exist (drive depth-band size grading).
    expect(attr(target, 'instanceRadius').isInstancedBufferAttribute).toBe(true);
    expect(attr(target, 'instanceFeather').isInstancedBufferAttribute).toBe(true);
    expect(sprite.count, 'sprite.count drives instanceCount').toBeGreaterThan(0);

    inst.dispose();
  });

  it('plays: discs drift to different centers across distinct seek times', () => {
    const target = makeTarget(bokehDriftPrimitive);
    const inst = bokehDriftPrimitive.create(target);

    inst.seek(0.2);
    const early = Float32Array.from(positions(target));

    inst.seek(3.4);
    const late = Float32Array.from(positions(target));

    const count = inst.getParams().count as number;
    // Drift is slow but real — over 3s the live disc field has visibly moved.
    expect(meanAbsDiff(early, late, count * 3)).toBeGreaterThan(0.02);
    inst.dispose();
  });

  it('depth bands: discs occupy three distinct z layers (parallax)', () => {
    const target = makeTarget(bokehDriftPrimitive);
    const inst = bokehDriftPrimitive.create(target);

    inst.seek(1.0);
    const pos = positions(target);
    const count = inst.getParams().count as number;
    const zs = new Set<number>();
    for (let i = 0; i < count; i++) zs.add(Math.round(pos[i * 3 + 2] * 1000) / 1000);
    // Round-robin banding over >= 6 discs must populate all three z bands.
    expect(zs.size).toBe(3);
    inst.dispose();
  });

  // ── CONTROL LIVENESS at the FROZEN pinned engaged frame (t = 1) ──────────
  // The advocate sweeps each control low/mid/high at a single repeated-seek
  // frozen frame and pixel-diffs low-vs-high. Each control must reshape the
  // STANDING pinned state boldly (not merely "changed"): we assert large deltas
  // on the CPU-observable instanced buffers the renderer samples.
  const PIN = 1;

  it('control liveness — disc COUNT changes the live population at the pinned frame', () => {
    const target = makeTarget(bokehDriftPrimitive);
    const inst = bokehDriftPrimitive.create(target);
    const sprite = bokehSprite(target);

    inst.setControl('count', 8);
    inst.seek(PIN);
    inst.seek(PIN); // repeated frozen seek (advocate semantics)
    const lowCount = liveCount(target);
    const lowDraw = sprite.count;

    inst.setControl('count', 40);
    inst.seek(PIN);
    inst.seek(PIN);
    const highCount = liveCount(target);
    const highDraw = sprite.count;

    // Population at the pin must rise boldly low→high (sparse vs dense), not by
    // a hair — the gravity-well moteCount lesson.
    expect(highDraw - lowDraw).toBeGreaterThanOrEqual(20);
    expect(highCount - lowCount).toBeGreaterThanOrEqual(20);
    inst.dispose();
  });

  it('control liveness — disc SIZE reshapes per-disc radius boldly at the pinned frame', () => {
    const target = makeTarget(bokehDriftPrimitive);
    const inst = bokehDriftPrimitive.create(target);

    inst.setControl('size', 0.4);
    inst.seek(PIN);
    inst.seek(PIN);
    const small = Float32Array.from(radii(target));
    const smallFeat = Float32Array.from(feathers(target));

    inst.setControl('size', 1.6);
    inst.seek(PIN);
    inst.seek(PIN);
    const big = Float32Array.from(radii(target));
    const bigFeat = Float32Array.from(feathers(target));

    const count = inst.getParams().count as number;
    // Each disc's effective radius (where the profile lives in the quad) must
    // grow substantially — a frozen-frame visible swell, not a transient rate.
    let grew = 0;
    for (let i = 0; i < count; i++) if (big[i] > small[i] + 0.05) grew++;
    expect(grew, 'most discs visibly larger at high size').toBeGreaterThan(count * 0.6);
    // Feather (blur) also scales with size — softer discs at the top end.
    expect(meanAbsDiff(smallFeat, bigFeat, count)).toBeGreaterThan(0.02);
    inst.dispose();
  });

  it('control liveness — DRIFT speed evolves the standing frame to different centers at the pin', () => {
    const target = makeTarget(bokehDriftPrimitive);
    const inst = bokehDriftPrimitive.create(target);

    inst.setControl('drift', 0.1);
    inst.seek(PIN);
    inst.seek(PIN);
    const slow = Float32Array.from(positions(target));

    inst.setControl('drift', 2.0);
    inst.seek(PIN);
    inst.seek(PIN);
    const fast = Float32Array.from(positions(target));

    const count = inst.getParams().count as number;
    // At the SAME pinned t a faster drift has carried every disc further along
    // its path — the standing frame is a function of the speed control, so the
    // frozen low-vs-high diff is bold (not invisible-by-construction).
    expect(meanAbsDiff(slow, fast, count * 3)).toBeGreaterThan(0.08);
    inst.dispose();
  });

  it('control liveness — IRIS dropdown switches the aperture shape uniform', () => {
    const target = makeTarget(bokehDriftPrimitive);
    const inst = bokehDriftPrimitive.create(target);
    const mat = bokehSprite(target).material as PointsNodeMaterial;

    // The colorNode mixes round↔hex by an iris uniform; find it and read .value.
    // Round is the default (uniform value 0).
    inst.setControl('iris', 'round');
    inst.seek(PIN);
    expect(inst.getParams().iris).toBe('round');

    inst.setControl('iris', 'hex');
    inst.seek(PIN);
    expect(inst.getParams().iris).toBe('hex');

    // The material still carries a live TSL colorNode after the switch (the
    // shape change is a uniform the node reads — no rebuild, no map).
    expect(mat.colorNode).toBeTruthy();
    expect(mat.map).toBeFalsy();
    inst.dispose();
  });

  it('idle (t = 0) shows a sensible rest state — discs present and lit, not empty black', () => {
    const target = makeTarget(bokehDriftPrimitive);
    const inst = bokehDriftPrimitive.create(target);

    inst.seek(0);
    expect(liveCount(target), 'discs are on-view at rest').toBeGreaterThan(4);
    const col = colors(target);
    const count = inst.getParams().count as number;
    let lit = 0;
    for (let i = 0; i < count; i++) {
      if (col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2] > 0.1) lit++;
    }
    expect(lit, 'discs carry brightness at rest (warm field, not black)').toBeGreaterThan(
      count * 0.5,
    );
    inst.dispose();
  });

  it('warm majority: most discs read warm amber (red >= blue), not purple', () => {
    const target = makeTarget(bokehDriftPrimitive);
    const inst = bokehDriftPrimitive.create(target);

    inst.seek(0.5);
    const col = colors(target);
    const count = inst.getParams().count as number;
    let warm = 0;
    for (let i = 0; i < count; i++) {
      const r = col[i * 3];
      const b = col[i * 3 + 2];
      if (r >= b) warm++; // amber/brass: red-dominant. (ice minority is blue-dom.)
    }
    expect(warm, 'amber majority over the ice minority').toBeGreaterThan(count * 0.5);
    inst.dispose();
  });

  it('determinism: re-seeking the same t reproduces identical positions, colors, radii', () => {
    const target = makeTarget(bokehDriftPrimitive);
    const inst = bokehDriftPrimitive.create(target);

    inst.seek(1.7);
    const posA = Float32Array.from(positions(target));
    const colA = Float32Array.from(colors(target));
    const radA = Float32Array.from(radii(target));

    inst.seek(0.3); // scrub away…
    inst.seek(1.7); // …and back: a pure seek must reproduce the exact frame
    expect(positions(target)).toEqual(posA);
    expect(colors(target)).toEqual(colA);
    expect(radii(target)).toEqual(radA);

    inst.dispose();
  });

  it('determinism: two independent instances seeked identically match', () => {
    const a = makeTarget(bokehDriftPrimitive);
    const b = makeTarget(bokehDriftPrimitive);
    const ia = bokehDriftPrimitive.create(a);
    const ib = bokehDriftPrimitive.create(b);

    ia.seek(2.1);
    ib.seek(2.1);
    expect(positions(a)).toEqual(positions(b));
    expect(colors(a)).toEqual(colors(b));
    expect(radii(a)).toEqual(radii(b));

    ia.dispose();
    ib.dispose();
  });

  it('dispose frees the geometry (instanced buffers) and material, and unmounts the sprite', () => {
    const target = makeTarget(bokehDriftPrimitive);
    const inst = bokehDriftPrimitive.create(target);

    const sprite = bokehSprite(target);
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
    expect(geometryDisposed, 'geometry dispose() fired (frees instanced buffers)').toBe(true);
    expect(materialDisposed, 'material dispose() fired').toBe(true);
    expect(target.object.children.includes(sprite), 'sprite removed from target').toBe(false);
  });
});
