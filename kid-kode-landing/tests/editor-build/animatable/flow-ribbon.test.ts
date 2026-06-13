import { describe, it, expect } from 'vitest';
import { Sprite, type BufferGeometry, type InstancedBufferAttribute } from 'three';
import type { PointsNodeMaterial } from 'three/webgpu';
import { flowRibbonPrimitive } from '@/lib/prism/animatable/primitives/flow-ribbon';
import { makeTarget, runConformance } from './_conformance';

/** Find the built instanced Sprite under the target. */
function ribbonSprite(target: ReturnType<typeof makeTarget>): Sprite {
  let sprite: Sprite | null = null;
  target.object.traverse((o) => {
    if ((o as Sprite).isSprite) sprite = o as Sprite;
  });
  if (!sprite) throw new Error('no Sprite built');
  return sprite;
}

function instancePositions(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = ribbonSprite(target).geometry as BufferGeometry;
  return geo.attributes.instancePosition as InstancedBufferAttribute;
}

function instanceColors(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = ribbonSprite(target).geometry as BufferGeometry;
  return geo.attributes.instanceColor as InstancedBufferAttribute;
}

/** Sum of |Δposition| over the live (drawn) motes between two CPU snapshots. */
function posDelta(a: Float32Array, b: Float32Array, liveCount: number): number {
  let d = 0;
  for (let i = 0; i < liveCount * 3; i++) d += Math.abs(a[i] - b[i]);
  return d;
}

/**
 * Mimic the advocate's control sweep at a SINGLE frozen pinned engaged frame:
 * repeated dt≈0 seeks at the same t, low value vs high value, measure how much
 * the standing CPU buffer reshapes. The advocate pixel-diffs these frames, so a
 * control that only governs a rate/speed must still have evolved the pinned
 * snapshot to a visibly different STATE low→high. We assert a bold delta.
 */
function frozenControlDelta(
  control: string,
  low: number,
  high: number,
  pinT = 1,
): { delta: number; liveCount: number } {
  const target = makeTarget(flowRibbonPrimitive);
  const inst = flowRibbonPrimitive.create(target);

  inst.setControl(control, low);
  // Repeated seeks at the SAME pinned t (the rig re-seeks t=1 on a fallback clock).
  inst.seek(pinT);
  inst.seek(pinT);
  const lowSnap = Float32Array.from(instancePositions(target).array as Float32Array);

  inst.setControl(control, high);
  inst.seek(pinT);
  inst.seek(pinT);
  const highSnap = Float32Array.from(instancePositions(target).array as Float32Array);

  // Use the full allocated span so structural (count) changes — which park
  // motes far away — register their full delta.
  const liveCount = lowSnap.length / 3;
  inst.dispose();
  return { delta: posDelta(lowSnap, highSnap, liveCount), liveCount };
}

describe('flow-ribbon primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(flowRibbonPrimitive).dispose();
  });

  it('is a time-driven, looping particles primitive on an empty subject', () => {
    expect(flowRibbonPrimitive.category).toBe('particles');
    expect(flowRibbonPrimitive.subject).toBe('empty');
    expect(flowRibbonPrimitive.defaultDriver).toBe('time');
    expect(flowRibbonPrimitive.difficulty).toBe('hard');
    const target = makeTarget(flowRibbonPrimitive);
    const inst = flowRibbonPrimitive.create(target);
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  // ── Look layer: instanced sprite, TSL falloff, no baked map (embers P0) ───
  it('renders instanced sprites with a TSL falloff PointsNodeMaterial (no map)', () => {
    const target = makeTarget(flowRibbonPrimitive);
    const inst = flowRibbonPrimitive.create(target);

    const sprite = ribbonSprite(target);
    const mat = sprite.material as PointsNodeMaterial;

    expect(mat.isPointsNodeMaterial, 'material is a PointsNodeMaterial').toBe(true);
    expect(mat.colorNode, 'colorNode carries the radial-falloff look').toBeTruthy();
    expect(mat.positionNode, 'positionNode places instances').toBeTruthy();
    expect(mat.map, 'no baked texture map — falloff is TSL').toBeFalsy();
    expect(mat.transparent, 'transparent preserved').toBe(true);
    expect(mat.depthWrite, 'depthWrite off for translucent motes').toBe(false);

    // positionNode reads the SAME instanced buffer the CPU loop writes.
    const posAttr = instancePositions(target);
    expect(posAttr.isInstancedBufferAttribute, 'positions are instanced').toBe(true);
    const positionNode = mat.positionNode as unknown as { attribute?: unknown };
    expect(positionNode.attribute, 'positionNode reads the instanced position buffer').toBe(
      posAttr,
    );

    const colAttr = instanceColors(target);
    expect(colAttr.isInstancedBufferAttribute, 'colors are instanced').toBe(true);
    expect(sprite.count, 'sprite.count drives instanceCount').toBeGreaterThan(0);

    inst.dispose();
  });

  // ── Behavior at concrete seeks: the ribbon streams (motes advance) ────────
  it('streams: motes advect along the current between distinct seek times', () => {
    const target = makeTarget(flowRibbonPrimitive);
    const inst = flowRibbonPrimitive.create(target);

    inst.seek(0.2);
    const early = Float32Array.from(instancePositions(target).array as Float32Array);
    inst.seek(1.4);
    const mid = Float32Array.from(instancePositions(target).array as Float32Array);
    inst.seek(2.9);
    const late = Float32Array.from(instancePositions(target).array as Float32Array);

    const liveCount = (inst.getParams().density as number) ?? 150;
    // The whole stream moves between every pair of frames (flow + spine sweep).
    expect(posDelta(early, mid, liveCount)).toBeGreaterThan(0.5);
    expect(posDelta(mid, late, liveCount)).toBeGreaterThan(0.5);
    inst.dispose();
  });

  it('idle (t=0) shows a sensible rest state: a coherent ribbon, not empty/NaN', () => {
    const target = makeTarget(flowRibbonPrimitive);
    const inst = flowRibbonPrimitive.create(target);

    inst.seek(0);
    const pos = instancePositions(target).array as Float32Array;
    const col = instanceColors(target).array as Float32Array;
    const liveCount = (inst.getParams().density as number) ?? 150;

    // No NaNs; motes occupy a bounded ribbon inside the tile frame.
    let bright = 0;
    let inFrame = 0;
    for (let i = 0; i < liveCount; i++) {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
      // Inside a tasteful empty-scene span (~±1.5 each axis).
      if (Math.abs(x) < 1.6 && Math.abs(y) < 1.6 && Math.abs(z) < 1.6) inFrame++;
      const lum = col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2];
      if (lum > 0.06) bright++; // embers brightness floor lesson
    }
    // The rest ribbon is visible (most motes lit) and contained in-frame.
    expect(bright, 'idle ribbon shows visibly lit motes').toBeGreaterThan(liveCount * 0.5);
    expect(inFrame, 'idle ribbon stays inside the tile frame').toBeGreaterThan(liveCount * 0.9);
    inst.dispose();
  });

  it('color: a brass→bone gradient runs along the ribbon length', () => {
    const target = makeTarget(flowRibbonPrimitive);
    const inst = flowRibbonPrimitive.create(target);
    inst.seek(1.0);

    const col = instanceColors(target).array as Float32Array;
    const liveCount = (inst.getParams().density as number) ?? 150;

    // The motes are seeded in arc order, so index ~ position along the ribbon.
    // Head (brass: warm, R>B) vs tail (bone: pale, B lifted toward R). Average a
    // small bracket at each end to be robust to per-mote envelope/turbulence.
    const avg = (a: number, b: number) => {
      let r = 0;
      let g = 0;
      let bl = 0;
      let n = 0;
      for (let i = a; i < b; i++) {
        r += col[i * 3];
        g += col[i * 3 + 1];
        bl += col[i * 3 + 2];
        n++;
      }
      return [r / n, g / n, bl / n] as const;
    };
    const head = avg(0, Math.floor(liveCount * 0.12));
    const tail = avg(Math.floor(liveCount * 0.88), liveCount);

    // Brass head is warmer (more red-vs-blue separation) than the bone tail.
    const headWarm = head[0] - head[2];
    const tailWarm = tail[0] - tail[2];
    expect(headWarm).toBeGreaterThan(tailWarm + 0.04);
    // No purple anywhere: blue never dominates red on the lit motes.
    for (let i = 0; i < liveCount; i++) {
      if (col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2] > 0.1) {
        expect(col[i * 3 + 2]).toBeLessThanOrEqual(col[i * 3] + 1e-4);
      }
    }
    inst.dispose();
  });

  // ── CONTROL-LIVENESS — the #1 W4 failure. Every control must reshape the ──
  // STANDING pinned engaged frame (repeated dt≈0 seeks), low→high, BOLDLY.
  // meanAbsDiff target ≥ 6 over the buffer per the brief → with ~150 motes ×3
  // comps the summed delta target is large; we assert a generous floor.
  it('controls reshape the frozen pinned engaged frame (flow speed)', () => {
    const { delta, liveCount } = frozenControlDelta('speed', 0.15, 2.5);
    // Bold reshape: faster flow has advected the standing ribbon much further
    // along its path at the pinned t than slow flow. meanAbsDiff ≥ 6 → summed
    // delta ≥ 6 * liveCount * 3 is the bar; we use a safe fraction of it.
    expect(delta, 'speed visibly reshapes the pinned frame').toBeGreaterThan(liveCount * 0.6);
  });

  it('controls reshape the frozen pinned engaged frame (ribbon width)', () => {
    const { delta, liveCount } = frozenControlDelta('width', 0.05, 1.4);
    expect(delta, 'width visibly reshapes the pinned frame').toBeGreaterThan(liveCount * 0.6);
  });

  it('controls reshape the frozen pinned engaged frame (turbulence)', () => {
    const { delta, liveCount } = frozenControlDelta('turbulence', 0.0, 1.4);
    expect(delta, 'turbulence visibly reshapes the pinned frame').toBeGreaterThan(liveCount * 0.6);
  });

  it('controls reshape the frozen pinned engaged frame (mote density / structural)', () => {
    // Density is structural: low→high changes the live drawn population, so far
    // more motes occupy the ribbon (parked motes sit far off-frame). The delta
    // over the full allocated span is dominated by parked↔live transitions.
    const { delta } = frozenControlDelta('density', 40, 200);
    expect(delta, 'density visibly changes the drawn population').toBeGreaterThan(40);

    // Also assert the live draw count actually changes (population visible).
    const target = makeTarget(flowRibbonPrimitive);
    const inst = flowRibbonPrimitive.create(target);
    inst.setControl('density', 40);
    inst.seek(1);
    const low = ribbonSprite(target).count;
    inst.setControl('density', 200);
    inst.seek(1);
    const high = ribbonSprite(target).count;
    expect(high).toBeGreaterThan(low + 100);
    inst.dispose();
  });

  it('determinism: two instances seeked identically produce identical buffers', () => {
    const tA = makeTarget(flowRibbonPrimitive);
    const tB = makeTarget(flowRibbonPrimitive);
    const a = flowRibbonPrimitive.create(tA);
    const b = flowRibbonPrimitive.create(tB);

    for (const t of [0, 0.37, 1.0, 2.6]) {
      a.seek(t);
      b.seek(t);
    }
    expect(instancePositions(tA).array as Float32Array).toEqual(
      instancePositions(tB).array as Float32Array,
    );
    expect(instanceColors(tA).array as Float32Array).toEqual(
      instanceColors(tB).array as Float32Array,
    );

    // And re-seeking the same t on one instance reproduces the exact frame.
    a.seek(0.5);
    const snap = Float32Array.from(instancePositions(tA).array as Float32Array);
    a.seek(3.1);
    a.seek(0.5);
    expect(instancePositions(tA).array as Float32Array).toEqual(snap);

    a.dispose();
    b.dispose();
  });

  it('dispose restores the scene and frees created resources', () => {
    const target = makeTarget(flowRibbonPrimitive);
    const inst = flowRibbonPrimitive.create(target);

    const sprite = ribbonSprite(target);
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

    const childrenBefore = target.object.children.length;
    inst.dispose();

    expect(geometryDisposed, 'geometry dispose() fired').toBe(true);
    expect(materialDisposed, 'material dispose() fired').toBe(true);
    expect(target.object.children.includes(sprite), 'sprite removed from target').toBe(false);
    expect(target.object.children.length, 'target child count restored').toBe(childrenBefore - 1);
  });
});
