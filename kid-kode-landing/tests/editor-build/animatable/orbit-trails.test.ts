import { describe, it, expect } from 'vitest';
import { Sprite, type BufferGeometry, type InstancedBufferAttribute } from 'three';
import type { PointsNodeMaterial } from 'three/webgpu';
import { orbitTrailsPrimitive } from '@/lib/prism/animatable/primitives/orbit-trails';
import { makeTarget, runConformance } from './_conformance';

/** Find the built instanced Sprite under the target. */
function trailsSprite(target: ReturnType<typeof makeTarget>): Sprite {
  let sprite: Sprite | null = null;
  target.object.traverse((o) => {
    if ((o as Sprite).isSprite) sprite = o as Sprite;
  });
  if (!sprite) throw new Error('no Sprite built');
  return sprite;
}

function instancePositions(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = trailsSprite(target).geometry as BufferGeometry;
  return geo.attributes.instancePosition as InstancedBufferAttribute;
}

function instanceColors(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = trailsSprite(target).geometry as BufferGeometry;
  return geo.attributes.instanceColor as InstancedBufferAttribute;
}

/** Mean absolute per-channel color diff + fraction of channels that moved across
 *  the FULL pool, computed at the real frozen engaged pin (repeated dt≈0 seeks).
 *  This is exactly what the advocate measures: it pins the engaged t, sweeps the
 *  control low→high, and pixel-diffs. A live control must move it boldly. */
function pinnedColorDelta(
  control: string,
  lo: number,
  hi: number,
  pinT = 1,
): { meanAbsDiff: number; changedFrac: number } {
  const target = makeTarget(orbitTrailsPrimitive);
  const inst = orbitTrailsPrimitive.create(target);
  // Engage the pinned frame the way the rig does: repeated seeks to the same t.
  inst.setControl(control, lo);
  inst.seek(pinT);
  inst.seek(pinT);
  const a = Float32Array.from(instanceColors(target).array as Float32Array);
  inst.setControl(control, hi);
  inst.seek(pinT);
  inst.seek(pinT);
  const b = Float32Array.from(instanceColors(target).array as Float32Array);
  let sum = 0;
  let changed = 0;
  // Scale 0..1 float color channels to 0..255 so the threshold matches the
  // advocate's 8-bit meanAbsDiff ≥ 6 / changedFrac ≥ 0.12 bar.
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]) * 255;
    sum += d;
    if (d > 2) changed += 1;
  }
  inst.dispose();
  return { meanAbsDiff: sum / a.length, changedFrac: changed / a.length };
}

describe('orbit-trails primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(orbitTrailsPrimitive).dispose();
  });

  it('is a time-driven empty-subject particles primitive, duration Infinity', () => {
    expect(orbitTrailsPrimitive.category).toBe('particles');
    expect(orbitTrailsPrimitive.subject).toBe('empty');
    expect(orbitTrailsPrimitive.defaultDriver).toBe('time');
    const target = makeTarget(orbitTrailsPrimitive);
    const inst = orbitTrailsPrimitive.create(target);
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('renders via the embers P0-fixed mechanism (instanced Sprite + TSL PointsNodeMaterial, no map)', () => {
    const target = makeTarget(orbitTrailsPrimitive);
    const inst = orbitTrailsPrimitive.create(target);

    const sprite = trailsSprite(target);
    const mat = sprite.material as PointsNodeMaterial;

    expect(mat.isPointsNodeMaterial, 'material is a PointsNodeMaterial').toBe(true);
    expect(mat.colorNode, 'colorNode carries the radial-falloff look').toBeTruthy();
    expect(mat.positionNode, 'positionNode places instances').toBeTruthy();
    expect(mat.map, 'no texture map — falloff is TSL, not a baked sprite').toBeFalsy();
    expect(mat.sizeAttenuation, 'sizeAttenuation on').toBe(true);
    expect(mat.transparent, 'transparent on').toBe(true);
    expect(mat.depthWrite, 'depthWrite off for translucent motes').toBe(false);

    // positionNode is fed by the SAME instanced buffer the CPU loop writes.
    const posAttr = instancePositions(target);
    expect(posAttr.isInstancedBufferAttribute, 'positions are instanced').toBe(true);
    const positionNode = mat.positionNode as unknown as { attribute?: unknown };
    expect(positionNode.attribute, 'positionNode reads the live instanced position buffer').toBe(
      posAttr,
    );
    const colAttr = instanceColors(target);
    expect(colAttr.isInstancedBufferAttribute, 'colors are instanced').toBe(true);
    expect(sprite.count, 'sprite.count drives instanceCount').toBeGreaterThan(0);

    inst.dispose();
  });

  // ── BEHAVIOR: bodies sweep their ellipses, dragging fading trails ──────────
  it('plays: a body sweeps to a different orbital position across distinct seeks', () => {
    const target = makeTarget(orbitTrailsPrimitive);
    const inst = orbitTrailsPrimitive.create(target);

    // Body head slots sit at the front of the pool (slot 0 of each body group).
    inst.seek(0.2);
    const pos = instancePositions(target).array as Float32Array;
    const x0 = pos[0];
    const y0 = pos[1];

    inst.seek(2.6);
    const x1 = pos[0];
    const y1 = pos[1];

    // The body has swept along its ellipse → its head position must move.
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(0.05);
    inst.dispose();
  });

  it('trail tapers: the breadcrumb behind a body is dimmer than the body head', () => {
    const target = makeTarget(orbitTrailsPrimitive);
    const inst = orbitTrailsPrimitive.create(target);
    inst.seek(1.3);

    const col = instanceColors(target).array as Float32Array;
    // Pool layout: per body a head slot followed by TRAIL_MAX breadcrumb slots.
    // The head (slot 0) is the brightest; an early breadcrumb (slot 2) is dimmer.
    const lum = (i: number) => col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2];
    const head = lum(0);
    const breadcrumb = lum(2);
    expect(head, 'body head is luminous').toBeGreaterThan(0.05);
    expect(head, 'head brighter than its trailing breadcrumb').toBeGreaterThan(breadcrumb);
    inst.dispose();
  });

  it('bodies use a varied jewelry palette (brass / bone / ice — not one flat color)', () => {
    const target = makeTarget(orbitTrailsPrimitive);
    const inst = orbitTrailsPrimitive.create(target);
    inst.seek(0.5);
    const col = instanceColors(target).array as Float32Array;
    const bodies = inst.getParams().bodies as number;
    // Head slot index of body b. Compare hue ratios (R:B) across bodies; a
    // single-color orrery would have identical ratios — the brief demands per-body color.
    const STRIDE = 41; // 1 head + 40 trail slots (mirror of TRAIL_MAX + 1)
    const ratios: number[] = [];
    for (let b = 0; b < bodies; b++) {
      const i = b * STRIDE;
      const r = col[i * 3];
      const g = col[i * 3 + 1];
      const bl = col[i * 3 + 2];
      const tot = r + g + bl;
      if (tot > 0.01) ratios.push(r / tot - bl / tot); // warm(+) vs cool(−) signature
    }
    expect(ratios.length, 'multiple bodies live').toBeGreaterThan(1);
    const spread = Math.max(...ratios) - Math.min(...ratios);
    expect(spread, 'bodies span warm→cool (varied palette)').toBeGreaterThan(0.1);
    inst.dispose();
  });

  // ── FROZEN-FRAME CONTROL LIVENESS — the #1 W4 failure mode ─────────────────
  // Every control must boldly reshape the standing engaged frame (the advocate
  // pixel-diffs low-vs-high at a single pinned t). Bar: meanAbsDiff ≥ 6 (8-bit),
  // changedFrac ≥ 0.12.
  it('control liveness: bodies (count) visibly changes the pinned engaged frame', () => {
    const { meanAbsDiff, changedFrac } = pinnedColorDelta('bodies', 3, 5);
    expect(meanAbsDiff, 'bodies meanAbsDiff bold').toBeGreaterThanOrEqual(6);
    expect(changedFrac, 'bodies changedFrac bold').toBeGreaterThanOrEqual(0.12);
  });

  it('control liveness: speed has swept the system to a different pinned state', () => {
    const { meanAbsDiff, changedFrac } = pinnedColorDelta('speed', 0.2, 3);
    expect(meanAbsDiff, 'speed meanAbsDiff bold').toBeGreaterThanOrEqual(6);
    expect(changedFrac, 'speed changedFrac bold').toBeGreaterThanOrEqual(0.12);
  });

  it('control liveness: trailLength changes the visible breadcrumb population at the pin', () => {
    const { meanAbsDiff, changedFrac } = pinnedColorDelta('trailLength', 8, 40);
    expect(meanAbsDiff, 'trailLength meanAbsDiff bold').toBeGreaterThanOrEqual(6);
    expect(changedFrac, 'trailLength changedFrac bold').toBeGreaterThanOrEqual(0.12);
  });

  it('control liveness: eccentricity reshapes the orbits at the pin', () => {
    const { meanAbsDiff, changedFrac } = pinnedColorDelta('eccentricity', 0, 0.7);
    expect(meanAbsDiff, 'eccentricity meanAbsDiff bold').toBeGreaterThanOrEqual(6);
    expect(changedFrac, 'eccentricity changedFrac bold').toBeGreaterThanOrEqual(0.12);
  });

  it('idle rest state (t=0) is a sensible non-empty frame (bodies + trails present)', () => {
    const target = makeTarget(orbitTrailsPrimitive);
    const inst = orbitTrailsPrimitive.create(target);
    inst.seek(0);
    const col = instanceColors(target).array as Float32Array;
    let litChannels = 0;
    for (let i = 0; i < col.length; i++) if (col[i] > 0.02) litChannels += 1;
    // The orrery is visible at rest — not a black tile.
    expect(litChannels, 'rest frame has luminous motes').toBeGreaterThan(20);
    inst.dispose();
  });

  it('determinism: re-seeking the same t reproduces identical positions and colors', () => {
    const target = makeTarget(orbitTrailsPrimitive);
    const inst = orbitTrailsPrimitive.create(target);

    inst.seek(1.7);
    const posA = Float32Array.from(instancePositions(target).array as Float32Array);
    const colA = Float32Array.from(instanceColors(target).array as Float32Array);

    inst.seek(0.3); // scrub away…
    inst.seek(1.7); // …and back: pure seek reproduces the exact frame
    expect(instancePositions(target).array as Float32Array).toEqual(posA);
    expect(instanceColors(target).array as Float32Array).toEqual(colA);

    inst.dispose();
  });

  it('determinism: two independent instances seeked identically match byte-for-byte', () => {
    const tA = makeTarget(orbitTrailsPrimitive);
    const iA = orbitTrailsPrimitive.create(tA);
    const tB = makeTarget(orbitTrailsPrimitive);
    const iB = orbitTrailsPrimitive.create(tB);

    iA.seek(2.15);
    iB.seek(2.15);
    expect(instancePositions(tA).array as Float32Array).toEqual(
      instancePositions(tB).array as Float32Array,
    );
    expect(instanceColors(tA).array as Float32Array).toEqual(
      instanceColors(tB).array as Float32Array,
    );
    iA.dispose();
    iB.dispose();
  });

  it('stays inside the tile frame at default params', () => {
    const target = makeTarget(orbitTrailsPrimitive);
    const inst = orbitTrailsPrimitive.create(target);
    const sprite = trailsSprite(target);
    let maxExtent = 0;
    for (let k = 0; k <= 6; k++) {
      inst.seek(k * 0.7);
      const pos = instancePositions(target).array as Float32Array;
      // Only inspect live (drawn) slots; parked slots are pushed far away.
      for (let i = 0; i < sprite.count * 3; i++) {
        const v = Math.abs(pos[i]);
        if (v < 50 && v > maxExtent) maxExtent = v; // skip parked HIDDEN coords
      }
    }
    expect(maxExtent, 'orrery fits a tasteful tile span').toBeLessThan(2.4);
    inst.dispose();
  });

  it('dispose frees the geometry (instanced buffers) and material it created', () => {
    const target = makeTarget(orbitTrailsPrimitive);
    const inst = orbitTrailsPrimitive.create(target);

    const sprite = trailsSprite(target);
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
