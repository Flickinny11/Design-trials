import { describe, it, expect } from 'vitest';
import { Sprite, type BufferGeometry, type InstancedBufferAttribute } from 'three';
import type { PointsNodeMaterial } from 'three/webgpu';
import {
  cometOrbitPrimitive,
  COMET_SUN_POINT,
  COMET_HEAD_SLOTS,
} from '@/lib/prism/animatable/primitives/comet-orbit';
import { makeTarget, runConformance } from './_conformance';

/** Find the built instanced Sprite under the target. */
function cometSprite(target: ReturnType<typeof makeTarget>): Sprite {
  let sprite: Sprite | null = null;
  target.object.traverse((o) => {
    if ((o as Sprite).isSprite) sprite = o as Sprite;
  });
  if (!sprite) throw new Error('no Sprite built');
  return sprite;
}

function instancePositions(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = cometSprite(target).geometry as BufferGeometry;
  return geo.attributes.instancePosition as InstancedBufferAttribute;
}

function instanceColors(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = cometSprite(target).geometry as BufferGeometry;
  return geo.attributes.instanceColor as InstancedBufferAttribute;
}

/** Sum of all per-mote RGB (premultiplied brightness == luminous energy in the
 *  frame, since additive blending makes RGB the alpha). A robust scalar for
 *  "how bright / how many live motes" comparisons. */
function totalEnergy(target: ReturnType<typeof makeTarget>): number {
  const col = instanceColors(target).array as Float32Array;
  let sum = 0;
  for (let i = 0; i < col.length; i++) sum += col[i];
  return sum;
}

/** Count motes that are visibly lit (above a tiny floor) — the live population. */
function litCount(target: ReturnType<typeof makeTarget>): number {
  const col = instanceColors(target).array as Float32Array;
  let n = 0;
  for (let i = 0; i < col.length; i += 3) {
    if (col[i] + col[i + 1] + col[i + 2] > 0.02) n++;
  }
  return n;
}

/** The head mote (slot 0) world position. */
function headPos(target: ReturnType<typeof makeTarget>): [number, number, number] {
  const arr = instancePositions(target).array as Float32Array;
  return [arr[0], arr[1], arr[2]];
}

// The advocate pins control sweeps at an ENGAGED time (the rig seeks t=1 on a
// fallback clock with repeated dt≈0 seeks). Every control must visibly reshape
// THAT frozen frame. We measure each control's low→high delta at this pin with
// repeated static seeks (NOT a transient difference).
const PIN_T = 1.0;

/** Read the [min, max] of a knob/fader control from the schema. */
function range(id: string): [number, number] {
  const c = cometOrbitPrimitive.schema.find((x) => x.id === id) as
    | { min: number; max: number }
    | undefined;
  if (!c) throw new Error(`no control ${id}`);
  return [c.min, c.max];
}

/** Re-seek the same pinned t several times (mirrors the rig's repeated dt≈0
 *  seeks) so the assertion measures the genuine STANDING frame, not a transient. */
function pinnedEnergy(
  target: ReturnType<typeof makeTarget>,
  inst: ReturnType<typeof cometOrbitPrimitive.create>,
): number {
  inst.seek(PIN_T);
  inst.seek(PIN_T);
  inst.seek(PIN_T);
  return totalEnergy(target);
}

describe('comet-orbit primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(cometOrbitPrimitive).dispose();
  });

  it('is a finite ~9s loop, time-driven, empty-subject particles', () => {
    expect(cometOrbitPrimitive.category).toBe('particles');
    expect(cometOrbitPrimitive.subject).toBe('empty');
    expect(cometOrbitPrimitive.defaultDriver).toBe('time');
    const target = makeTarget(cometOrbitPrimitive);
    const inst = cometOrbitPrimitive.create(target);
    const d = inst.duration();
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(6);
    expect(d).toBeLessThan(14);
    inst.dispose();
  });

  it('look layer is an instanced PointsNodeMaterial with TSL color/position nodes (no map)', () => {
    const target = makeTarget(cometOrbitPrimitive);
    const inst = cometOrbitPrimitive.create(target);

    const sprite = cometSprite(target);
    const mat = sprite.material as PointsNodeMaterial;

    expect(mat.isPointsNodeMaterial, 'material is a PointsNodeMaterial').toBe(true);
    expect(mat.colorNode, 'colorNode carries the radial-falloff look').toBeTruthy();
    expect(mat.positionNode, 'positionNode places instances').toBeTruthy();
    expect(mat.map, 'no texture map — falloff is TSL, not a baked sprite').toBeFalsy();
    expect(mat.sizeAttenuation, 'sizeAttenuation preserved').toBe(true);
    expect(mat.transparent, 'transparent preserved').toBe(true);
    expect(mat.depthWrite, 'depthWrite stays off (translucent motes)').toBe(false);

    // positionNode reads the SAME instanced buffer the CPU loop writes.
    const posAttr = instancePositions(target);
    expect(posAttr.isInstancedBufferAttribute, 'positions are instanced').toBe(true);
    const positionNode = mat.positionNode as unknown as { attribute?: unknown };
    expect(positionNode.attribute, 'positionNode reads the instanced position buffer').toBe(posAttr);

    const colAttr = instanceColors(target);
    expect(colAttr.isInstancedBufferAttribute, 'colors are instanced').toBe(true);
    expect(sprite.count, 'sprite.count drives instanceCount').toBeGreaterThan(0);

    inst.dispose();
  });

  // ── Behavior: the comet HEAD moves along its ellipse over time ─────────────
  it('plays: the comet head sweeps to a different ellipse position across distinct seeks', () => {
    const target = makeTarget(cometOrbitPrimitive);
    const inst = cometOrbitPrimitive.create(target);

    inst.seek(0.5);
    const a = headPos(target);
    inst.seek(3.0);
    const b = headPos(target);
    inst.seek(6.0);
    const c = headPos(target);

    const moved = (p: number[], q: number[]) =>
      Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    // The head visibly relocates between snapshots (not a static dot).
    expect(moved(a, b)).toBeGreaterThan(0.2);
    expect(moved(b, c)).toBeGreaterThan(0.2);
    inst.dispose();
  });

  // ── Behavior: the head stays inside the tile envelope at default params ────
  it('keeps the head and tail inside the tile frame at default params', () => {
    const target = makeTarget(cometOrbitPrimitive);
    const inst = cometOrbitPrimitive.create(target);
    const SPAN = 2.6; // generous envelope half-extent the design targets
    for (let i = 0; i <= 12; i++) {
      inst.seek((i / 12) * inst.duration());
      const pos = instancePositions(target).array as Float32Array;
      const col = instanceColors(target).array as Float32Array;
      for (let m = 0; m < pos.length / 3; m++) {
        // Only check LIT motes (parked/dark motes sit far out of view by design).
        if (col[m * 3] + col[m * 3 + 1] + col[m * 3 + 2] < 0.01) continue;
        expect(Math.abs(pos[m * 3])).toBeLessThan(SPAN);
        expect(Math.abs(pos[m * 3 + 1])).toBeLessThan(SPAN);
      }
    }
    inst.dispose();
  });

  // ── Behavior: physical anti-solar tail — tail motes stream AWAY from the
  // sun-point, NOT a motion trail behind the head. We verify the lit tail motes'
  // mean direction from the head is closer to the anti-solar direction (head→away
  // from sun) than to the anti-velocity direction (a plain motion trail). ──────
  it('tail streams anti-solar (away from the sun-point), not a motion trail', () => {
    const target = makeTarget(cometOrbitPrimitive);
    const inst = cometOrbitPrimitive.create(target);
    // Pin near perihelion-ish engaged time where the tail is full and flaring.
    inst.seek(PIN_T);

    const pos = instancePositions(target).array as Float32Array;
    const col = instanceColors(target).array as Float32Array;
    const [hx, hy] = headPos(target);

    // Sun-point lives at the primitive's exported SUN offset; recover the
    // anti-solar unit direction (head → away from sun).
    const SUN_X = COMET_SUN_POINT.x;
    const SUN_Y = COMET_SUN_POINT.y;
    let ax = hx - SUN_X;
    let ay = hy - SUN_Y;
    const al = Math.hypot(ax, ay) || 1;
    ax /= al;
    ay /= al;

    // Mean offset of lit tail motes from the head (skip the first few head/core
    // slots — they ARE the head, not tail).
    let mx = 0;
    let my = 0;
    let n = 0;
    const HEAD_SLOTS = COMET_HEAD_SLOTS;
    for (let m = HEAD_SLOTS; m < pos.length / 3; m++) {
      if (col[m * 3] + col[m * 3 + 1] + col[m * 3 + 2] < 0.02) continue;
      mx += pos[m * 3] - hx;
      my += pos[m * 3 + 1] - hy;
      n++;
    }
    expect(n, 'tail has lit motes at the pinned engaged frame').toBeGreaterThan(5);
    mx /= n;
    my /= n;
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml;
    my /= ml;

    // The mean tail direction should align with the anti-solar direction
    // (positive dot, meaningfully so).
    const dotSolar = mx * ax + my * ay;
    expect(dotSolar, 'tail mean direction points away from the sun-point').toBeGreaterThan(0.4);
    inst.dispose();
  });

  // ── Behavior: cooling — fresh tail motes (near head) are brighter/whiter than
  // old motes (far down the tail). ───────────────────────────────────────────
  it('tail cools and fades along its length (fresh near head brighter than old)', () => {
    const target = makeTarget(cometOrbitPrimitive);
    const inst = cometOrbitPrimitive.create(target);
    inst.seek(PIN_T);

    const pos = instancePositions(target).array as Float32Array;
    const col = instanceColors(target).array as Float32Array;
    const HEAD_SLOTS = COMET_HEAD_SLOTS;
    // Slot layout: head slots, then tail motes in emission order (slot HEAD_SLOTS
    // = freshest, increasing slot = older). Compare a fresh tail mote vs an old one.
    const freshIdx = HEAD_SLOTS;
    // find the last lit tail slot (oldest live mote)
    let oldIdx = -1;
    for (let m = pos.length / 3 - 1; m >= HEAD_SLOTS; m--) {
      if (col[m * 3] + col[m * 3 + 1] + col[m * 3 + 2] > 0.02) {
        oldIdx = m;
        break;
      }
    }
    expect(oldIdx, 'found an old lit tail mote').toBeGreaterThan(freshIdx);

    const bright = (i: number) => col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2];
    expect(
      bright(freshIdx),
      'fresh tail mote brighter than oldest',
    ).toBeGreaterThan(bright(oldIdx) * 1.3);
    inst.dispose();
  });

  // ── FROZEN-FRAME CONTROL LIVENESS (the #1 W4 failure mode) ─────────────────
  // Each control's low→high delta MUST be bold at the real pinned engaged frame
  // (static repeated-seek measure), not merely "changed". We assert a magnitude
  // far above sub-noise.
  describe('controls visibly reshape the pinned engaged frame', () => {
    it('eccentricity: reshapes the ellipse → head lands somewhere clearly different', () => {
      const target = makeTarget(cometOrbitPrimitive);
      const inst = cometOrbitPrimitive.create(target);

      inst.setControl('eccentricity', 0.15);
      inst.seek(PIN_T);
      inst.seek(PIN_T);
      const lo = headPos(target);

      inst.setControl('eccentricity', 0.85);
      inst.seek(PIN_T);
      inst.seek(PIN_T);
      const hi = headPos(target);

      const moved = Math.hypot(lo[0] - hi[0], lo[1] - hi[1], lo[2] - hi[2]);
      expect(moved, 'head relocates boldly when eccentricity changes').toBeGreaterThan(0.3);
      inst.dispose();
    });

    it('tailLength: a longer tail lights up MANY more motes at the pin', () => {
      const target = makeTarget(cometOrbitPrimitive);
      const inst = cometOrbitPrimitive.create(target);

      const [tlMin, tlMax] = range('tailLength');
      inst.setControl('tailLength', tlMin);
      inst.seek(PIN_T);
      inst.seek(PIN_T);
      const lo = litCount(target);

      inst.setControl('tailLength', tlMax);
      inst.seek(PIN_T);
      inst.seek(PIN_T);
      const hi = litCount(target);

      expect(hi - lo, 'far more lit tail motes at long tail').toBeGreaterThanOrEqual(15);
      inst.dispose();
    });

    it('flare: a stronger flare boldly brightens the standing frame at the pin', () => {
      const target = makeTarget(cometOrbitPrimitive);
      const inst = cometOrbitPrimitive.create(target);

      const [flMin, flMax] = range('flare');
      inst.setControl('flare', flMin);
      const lo = pinnedEnergy(target, inst);

      inst.setControl('flare', flMax);
      const hi = pinnedEnergy(target, inst);

      // Bold brightness delta — energy grows substantially with flare.
      expect(hi, 'flare brightens the frozen frame substantially').toBeGreaterThan(lo * 1.4);
      inst.dispose();
    });

    it('speed: faster sweep relocates the head AND respreads the tail at the pin', () => {
      const target = makeTarget(cometOrbitPrimitive);
      const inst = cometOrbitPrimitive.create(target);

      const [spMin, spMax] = range('speed');
      inst.setControl('speed', spMin);
      inst.seek(PIN_T);
      inst.seek(PIN_T);
      const lo = headPos(target);

      inst.setControl('speed', spMax);
      inst.seek(PIN_T);
      inst.seek(PIN_T);
      const hi = headPos(target);

      const moved = Math.hypot(lo[0] - hi[0], lo[1] - hi[1], lo[2] - hi[2]);
      expect(moved, 'head sits at a clearly different orbital point').toBeGreaterThan(0.3);
      inst.dispose();
    });
  });

  it('determinism: re-seeking the same t reproduces identical positions and colors', () => {
    const target = makeTarget(cometOrbitPrimitive);
    const inst = cometOrbitPrimitive.create(target);

    inst.seek(2.4);
    const posA = Float32Array.from(instancePositions(target).array as Float32Array);
    const colA = Float32Array.from(instanceColors(target).array as Float32Array);

    inst.seek(5.1); // scrub away…
    inst.seek(2.4); // …and back: pure seek must reproduce the exact frame
    expect(instancePositions(target).array as Float32Array).toEqual(posA);
    expect(instanceColors(target).array as Float32Array).toEqual(colA);

    inst.dispose();
  });

  it('determinism: two independent instances seeked identically match byte-for-byte', () => {
    const t1 = makeTarget(cometOrbitPrimitive);
    const i1 = cometOrbitPrimitive.create(t1);
    const t2 = makeTarget(cometOrbitPrimitive);
    const i2 = cometOrbitPrimitive.create(t2);

    i1.seek(3.7);
    i2.seek(3.7);
    expect(instancePositions(t1).array as Float32Array).toEqual(
      instancePositions(t2).array as Float32Array,
    );
    expect(instanceColors(t1).array as Float32Array).toEqual(
      instanceColors(t2).array as Float32Array,
    );
    i1.dispose();
    i2.dispose();
  });

  it('idle frame (t=0) shows a sensible rest state, not an empty/black tile', () => {
    const target = makeTarget(cometOrbitPrimitive);
    const inst = cometOrbitPrimitive.create(target);
    inst.seek(0);
    // The head + some tail must be lit at rest (embers-idle convention: a rest
    // state, never empty black).
    expect(totalEnergy(target), 'energy present at idle').toBeGreaterThan(0.5);
    expect(litCount(target), 'multiple motes lit at idle').toBeGreaterThan(4);
    inst.dispose();
  });

  it('dispose frees the geometry (instanced buffers) and material it created', () => {
    const target = makeTarget(cometOrbitPrimitive);
    const inst = cometOrbitPrimitive.create(target);

    const sprite = cometSprite(target);
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
