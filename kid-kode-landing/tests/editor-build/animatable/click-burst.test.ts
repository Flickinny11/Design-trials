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

/** Per-mote billboard quad scale (1 float each). The material reads this via
 *  material.scaleNode, so it is the literal per-instance SIZE the GPU draws —
 *  the pixel-coverage variance the twinkle control reshapes at the frozen pin. */
function instanceScales(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = burstSprite(target).geometry as BufferGeometry;
  return geo.attributes.instanceScale as InstancedBufferAttribute;
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
 * Standard deviation of per-mote luminance across the live color buffer. This is
 * the "speckle" measure: a smooth/uniform ring has near-zero per-mote spread; a
 * strongly twinkled ring has some bright motes and some dim ones, so the spread
 * is large. It is what the advocate's pixel-diff actually sees at the FROZEN pin,
 * where time-only flicker averages out and only a per-mote hash can vary
 * neighbouring motes.
 */
function lumaStdDev(target: ReturnType<typeof makeTarget>, count: number): number {
  const col = instanceColors(target).array as Float32Array;
  const lums: number[] = [];
  for (let i = 0; i < count; i++) {
    lums.push(col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2]);
  }
  const mean = lums.reduce((a, b) => a + b, 0) / Math.max(1, lums.length);
  const variance = lums.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lums.length);
  return Math.sqrt(variance);
}

/** Mean per-mote quad SIZE across the live motes. */
function sizeMean(target: ReturnType<typeof makeTarget>, count: number): number {
  const s = instanceScales(target).array as Float32Array;
  let sum = 0;
  for (let i = 0; i < count; i++) sum += s[i];
  return sum / Math.max(1, count);
}

/** Standard deviation of per-mote quad SIZE — the dominant "speckle" measure.
 *  A smooth/uniform ring has every mote at scale 1 (std 0); a strongly twinkled
 *  ring has some motes bloomed big and some shrunk to pinpoints, so the spread
 *  is wide. This is the per-mote SIZE variance that moves PIXEL COVERAGE (a
 *  brightness-only change over a sparse ring cannot move enough pixels to read
 *  on the advocate's whole-frame diff; a size change does). */
function sizeStdDev(target: ReturnType<typeof makeTarget>, count: number): number {
  const s = instanceScales(target).array as Float32Array;
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) sizes.push(s[i]);
  const mean = sizes.reduce((a, b) => a + b, 0) / Math.max(1, sizes.length);
  const variance = sizes.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, sizes.length);
  return Math.sqrt(variance);
}

/** Coverage proxy: Σ scale² over the live motes. Quad area scales with the
 *  square of the per-mote size, so this tracks the lit PIXEL FOOTPRINT of the
 *  ring at the static pinned frame. A uniform ring and a size-speckled ring of
 *  the same mote count differ here precisely because big motes cover much more
 *  area than the equal-and-opposite small ones give back. */
function coverageProxy(target: ReturnType<typeof makeTarget>, count: number): number {
  const s = instanceScales(target).array as Float32Array;
  let sum = 0;
  for (let i = 0; i < count; i++) sum += s[i] * s[i];
  return sum;
}

/**
 * Replicate the advocate "pinned engaged frame" control sweep EXACTLY as the
 * shared rig drives a state tile: the rig NEVER sets userData.state (so the
 * primitive is engaged-by-default), and it pins the same frozen t=1 with
 * repeated dt≈0 seeks before sweeping each control. A live control must reshape
 * THIS frozen frame, not merely a transient. Returns the live-mote summary at
 * the pin for the given control value.
 */
function pinnedEngagedSummary(
  controlId: string,
  value: number,
): {
  radius: number;
  luma: number;
  count: number;
  lumaStd: number;
  sizeStd: number;
  sizeMean: number;
  coverage: number;
} {
  const target = makeTarget(clickBurstPrimitive);
  const inst = clickBurstPrimitive.create(target);
  // NO userData.state — exactly what the rig does. The primitive must engage by
  // default and carry a standing bloom at the pinned t.
  inst.setControl(controlId, value);
  // Repeated seeks at the same pinned t — exactly what the rig does for sweeps.
  inst.seek(1);
  inst.seek(1);
  inst.seek(1);
  const count = Math.round(inst.getParams().count as number);
  const radius = meanRadius(target, count);
  const luma = totalLuma(target, count);
  const lumaStd = lumaStdDev(target, count);
  const sizeStd = sizeStdDev(target, count);
  const sizeMeanV = sizeMean(target, count);
  const coverage = coverageProxy(target, count);
  inst.dispose();
  return { radius, luma, count, lumaStd, sizeStd, sizeMean: sizeMeanV, coverage };
}

const MAX = 120;

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

  it('idle (t=0) shows a clean rest state — no live motes lit', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);
    // No userData.state (rig idle pin is seek(t=0) with state never set). At
    // t=0 the recycle seam life is 0, so the field carries no emitted light.
    inst.seek(0);
    expect(totalLuma(target, MAX)).toBeLessThan(1e-4);
    inst.dispose();
  });

  it('explicit disengage shows a clean empty rest even at a mid-cycle t', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);
    target.userData.state = false; // explicitly OFF
    inst.seek(1); // mid-cycle, but disengaged ⇒ no bloom
    expect(totalLuma(target, MAX)).toBeLessThan(1e-4);
    inst.dispose();
  });

  // ── THE CORE FIX: the stateless engaged pin renders a NON-EMPTY standing bloom.
  // This is the defect the advocate caught (idle == play == every control sweep,
  // effVal 0, empty panel). The rig never sets userData.state and pins the
  // engaged sweep at seek(t=1); a one-shot rising-edge burst showed nothing.
  it('engaged-by-default: the pinned t=1 frame is a NON-EMPTY standing bloom', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);
    const count = Math.round(inst.getParams().count as number);
    // No userData.state — exactly the rig's stateless drive.
    inst.seek(1);
    inst.seek(1); // repeated dt≈0 seeks (the frozen pin)
    const luma = totalLuma(target, count);
    const r = meanRadius(target, count);
    expect(luma, 'standing bloom emits substantial light at the pin').toBeGreaterThan(5);
    expect(r, 'standing bloom motes have expanded outward from the origin').toBeGreaterThan(0.1);
    inst.dispose();
  });

  it('engaged recycling bloom: motes expand outward as the clock advances within a cycle', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);
    const count = Math.round(inst.getParams().count as number);

    // Stateless engaged-by-default. Pick two times inside the SAME bloom cycle
    // (CYCLE_PERIOD ≈ 2.6) where the later one sits further along the bloom.
    inst.seek(0.4);
    const rEarly = meanRadius(target, count);
    const lumaEarly = totalLuma(target, count);

    inst.seek(1.4);
    const rMid = meanRadius(target, count);

    expect(rMid, 'ring expands outward as the bloom decelerates').toBeGreaterThan(rEarly + 0.05);
    expect(lumaEarly, 'the fresh bloom is bright').toBeGreaterThan(1);
    inst.dispose();
  });

  it('the bloom fades toward the end of its cycle (one clean ignite→fade)', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);
    const count = Math.round(inst.getParams().count as number);

    // A mid-bloom frame is bright; a near-end-of-cycle frame has faded.
    inst.seek(1); // pinned mid-tail (PIN_LIFE)
    const lumaMid = totalLuma(target, count);
    // Choose a t whose phase is near 1 (end of cycle): phase = frac(t/P + off).
    // P≈2.6, off≈0.1654 → t=2.17 gives phase ≈ frac(0.835 + 0.165) = ~0.999.
    inst.seek(2.17);
    const lumaEnd = totalLuma(target, count);

    expect(lumaEnd, 'everything fades toward the end of the bloom cycle').toBeLessThan(
      lumaMid * 0.25,
    );
    inst.dispose();
  });

  it('cools white-hot -> brass: a fresh mote is whiter than a tail mote', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);

    // Stateless engaged. Fresh (small phase) vs tail (large phase) within a
    // cycle. phase = frac(t/2.6 + 0.1654). t=0.05 → phase ≈ 0.184 (fresh-ish),
    // t=1.6 → phase ≈ 0.781 (cooled tail).
    inst.seek(0.05);
    const colA = Float32Array.from(instanceColors(target).array as Float32Array);
    inst.seek(1.6);
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

  // ── Control liveness at the PINNED ENGAGED frame (the W5 #1 failure) ──────
  // The advocate sweeps each control low/mid/high at a single frozen engaged
  // frame (the rig sets NO state, pins seek(t=1), repeated dt≈0) and pixel-
  // diffs. Every control must reshape THAT standing frame boldly. We assert
  // each control's low→high delta at the real pin AND that the pin is non-empty.

  it('control [count] reshapes the pinned engaged frame: more live motes', () => {
    const lo = pinnedEngagedSummary('count', 40);
    const hi = pinnedEngagedSummary('count', 90);
    expect(lo.luma, 'low-count pin is still a non-empty standing bloom').toBeGreaterThan(1);
    expect(hi.count, 'high count draws far more motes').toBeGreaterThan(lo.count + 30);
    // More motes => more total emitted light at the frozen frame.
    expect(hi.luma, 'denser burst emits more light at the pin').toBeGreaterThan(lo.luma * 1.4);
  });

  it('control [radius] reshapes the pinned engaged frame: wider ring', () => {
    const lo = pinnedEngagedSummary('radius', 0.5);
    const hi = pinnedEngagedSummary('radius', 1.8);
    expect(lo.radius, 'low-radius pin is a non-empty expanded ring').toBeGreaterThan(0.05);
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
    expect(lo.radius, 'low-decel pin is a non-empty ring').toBeGreaterThan(0.02);
    expect(Math.abs(hi.radius - lo.radius), 'deceleration changes the pinned ring radius').toBeGreaterThan(
      0.12,
    );
  });

  it('control [twinkle] reshapes the pinned engaged frame: a BOLD per-mote SIZE speckle', () => {
    const lo = pinnedEngagedSummary('twinkle', 0);
    const hi = pinnedEngagedSummary('twinkle', 1);
    expect(lo.luma, 'twinkle-low pin is a non-empty standing bloom').toBeGreaterThan(1);

    // ── THE DOMINANT, COVERAGE-CHANGING TERM: per-mote SIZE variance ─────────
    // The prior fix drove a brightness-only speckle. But the burst is a THIN
    // SPARSE RING (~5% frame coverage), and the advocate's gate is a WHOLE-FRAME
    // meanAbsDiff: a brightness-only change over 5% of pixels can never clear it.
    // The fix gives twinkle real PIXEL COVERAGE by varying each mote's SIZE.
    //
    // At twinkle=0 every mote is exactly baseline size — a SMOOTH uniform ring.
    expect(lo.sizeStd, 'twinkle=0 ring is uniform — zero per-mote SIZE spread').toBeLessThan(1e-4);
    expect(lo.sizeMean, 'twinkle=0 motes are all baseline size (1.0)').toBeCloseTo(1, 3);
    // At twinkle=1 the per-mote sizes vary WIDELY — some bloom into big sparkle-
    // stars, some shrink to pinpoints. The SIZE std is a BOLD fraction (≥30%) of
    // the mean size, so the lit footprint of the ring visibly changes low→high
    // (big motes cover many more pixels). This is what clears the whole-frame
    // diff that brightness alone could not.
    expect(hi.sizeStd, 'twinkle=1 ring has a wide per-mote SIZE spread').toBeGreaterThan(0.1);
    expect(
      hi.sizeStd,
      'twinkle=1 per-mote SIZE spread is ≥30% of the mean mote size — a bold, area-moving glitter',
    ).toBeGreaterThan(hi.sizeMean * 0.3);
    // And the lit pixel FOOTPRINT (Σ scale², the coverage proxy) shifts boldly
    // low→high: a real area change, not just a brightness redistribution. This
    // is the coverage-proxy delta at the static pinned frame.
    expect(
      Math.abs(hi.coverage - lo.coverage),
      'twinkle changes the ring pixel footprint (coverage proxy) at the frozen pin',
    ).toBeGreaterThan(lo.coverage * 0.08);

    // ── Complementary brightness speckle still rides on top ─────────────────
    // At twinkle=0 every ring mote also burns at the same brightness (smooth);
    // at twinkle=1 the per-mote luminance spread blows up too.
    expect(lo.lumaStd, 'twinkle=0 ring is smooth/uniform — near-zero per-mote luma spread').toBeLessThan(
      0.02,
    );
    expect(hi.lumaStd, 'twinkle=1 ring is strongly speckled — wide per-mote luma spread').toBeGreaterThan(
      lo.lumaStd + 0.1,
    );
    const meanMoteLuma = hi.luma / Math.max(1, hi.count);
    expect(
      hi.lumaStd,
      'twinkle=1 per-mote luma spread is a substantial fraction of mean mote brightness',
    ).toBeGreaterThan(meanMoteLuma * 0.25);
    // Mean-preserving brightness: total emitted light stays roughly stable (the
    // fix is a per-mote redistribution, NOT a global dim — a uniform dim reads as
    // the same smooth ring, just darker, which is the original sub-noise defect).
    expect(
      Math.abs(hi.luma - lo.luma),
      'twinkle is mean-preserving — no global dim/brighten',
    ).toBeLessThan(lo.luma * 0.2);
  });

  it('control [twinkle] holds its per-mote SIZE + brightness speckle across repeated dt=0 seeks (frozen pin)', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);
    inst.setControl('twinkle', 1);
    // Repeated identical seeks at the SAME pinned t — exactly the rig's frozen
    // sweep. The speckle must persist (it's hash-driven, not transient flicker
    // that would average out at dt=0). Capture both the SIZE and color buffers.
    inst.seek(1);
    const count = Math.round(inst.getParams().count as number);
    const colA = Float32Array.from(instanceColors(target).array as Float32Array);
    const sizeA = Float32Array.from(instanceScales(target).array as Float32Array);
    inst.seek(1);
    inst.seek(1);
    const colB = Float32Array.from(instanceColors(target).array as Float32Array);
    const sizeB = Float32Array.from(instanceScales(target).array as Float32Array);
    expect(sizeB, 'frozen-pin SIZE speckle is identical across repeated dt=0 seeks').toEqual(sizeA);
    expect(colB, 'frozen-pin brightness speckle is identical across repeated dt=0 seeks').toEqual(colA);
    // And it is genuinely speckled — both in SIZE (the dominant coverage term)
    // and brightness — not uniform, at this frozen frame.
    expect(sizeStdDev(target, count), 'frozen pin carries a wide per-mote SIZE spread').toBeGreaterThan(
      0.1,
    );
    expect(lumaStdDev(target, count), 'frozen pin carries a wide per-mote luma spread').toBeGreaterThan(
      0.1,
    );
    inst.dispose();
  });

  it('determinism: re-seeking the same t reproduces identical buffers', () => {
    const target = makeTarget(clickBurstPrimitive);
    const inst = clickBurstPrimitive.create(target);

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
