// gravity-well — behavior tests.
//
// The cursor bends space: the card slides DOWN the well's curve toward the
// pointer along an inverse-square-ish falloff (strong near, vanishing far — NOT
// linear), stretching tidally (elongate along the pull axis, squash across it,
// growing as distance shrinks, bounded), while 6-10 faint brass dust motes
// stream on decaying spiral paths into the drain at the pointer.
//
// We assert:
//  - conformance to the Animatable contract,
//  - INVERSE-SQUARE-ish pull: the per-distance displacement curve is convex —
//    halving the distance more-than-doubles the pull (super-linear), distinct
//    from magnetic's linear soft pull,
//  - the card TRAVELS toward a moving pointer across consecutive seeks and the
//    near pointer pulls HARDER than a far one,
//  - TIDAL stretch: at the engaged pin the card elongates along the pull axis
//    and squashes across it (anisotropic, det > restored), growing as the
//    pointer nears,
//  - motes exist as ONE instanced Sprite (never THREE.Points) carrying the
//    deterministic spiral, count tracks the control (3-12), positions are finite
//    and converge toward the pointer drain,
//  - the engaged pin {x:0.62,y:0.5} holds a visibly drawn + stretched pose and
//    EVERY control re-shapes that pinned (dt≈0) frame immediately (onParamChange),
//  - travel + stretch stay bounded subject-relative (never leaves the tile),
//  - the idle disengaged frame (pointer centered, first seek) is the home pose,
//  - dispose restores position / scale / rotation exactly AND removes the motes.

import { describe, it, expect } from 'vitest';
import { Box3, Sprite, Vector3, type Object3D } from 'three';
import { gravityWellPrimitive } from '@/lib/prism/animatable/primitives/gravity-well';
import { makeTarget, runConformance } from './_conformance';
import type { AnimatableTarget, ParamState } from '@/lib/prism/animatable/contract';

/** Fresh target + instance with optional param overrides. */
function fresh(overrides?: Partial<ParamState>) {
  const target: AnimatableTarget = makeTarget(gravityWellPrimitive);
  const inst = gravityWellPrimitive.create(target, overrides);
  return { target, inst, subject: target.subject as Object3D };
}

/** Stateful spring: settle by seeking many fixed-dt frames at a moving clock. */
function settle(inst: { seek: (t: number) => void }, startT = 0, frames = 120, dt = 0.016): number {
  let t = startT;
  for (let i = 0; i < frames; i++) {
    inst.seek(t);
    t += dt;
  }
  return t;
}

/** Seed a clean idle frame (disengaged center, first seek t=0). */
function idle(target: AnimatableTarget, inst: { seek(t: number): void }) {
  target.userData.pointer = { x: 0.5, y: 0.5 };
  inst.seek(0);
}

/** Subject bbox width (the primitive's subject-relative travel unit). */
function subjectWidth(subject: Object3D): number {
  return new Box3().setFromObject(subject).getSize(new Vector3()).x;
}

/** The motes Sprite that the primitive parents under target.object. */
function findMotes(target: AnimatableTarget): Sprite | null {
  let found: Sprite | null = null;
  target.object.traverse((o) => {
    if (!found && (o as Sprite).isSprite) found = o as Sprite;
  });
  return found;
}

/** Aggregate VISIBLE mote energy at the current frame: sum over the LIVE draw
 *  count of each mote's instanced luminance (the additive brass it contributes
 *  to the frame). This is the quantity a per-pixel control sweep measures — it
 *  must be > 0 (motes are actually drawn at the pin, not all in their faint
 *  tail) and must GROW with moteCount (more dust = more visible pixels). Mirrors
 *  the advocate's pixel-energy read at the static engaged pin. */
function moteEnergy(motes: Sprite): number {
  const col = motes.geometry.getAttribute('instanceColor');
  const arr = col.array as ArrayLike<number>;
  let energy = 0;
  for (let i = 0; i < motes.count; i++) {
    energy += arr[i * 3] + arr[i * 3 + 1] + arr[i * 3 + 2];
  }
  return energy;
}

// ── Advocate-faithful RASTER PROXY ──────────────────────────────────────────
// The advocate's verdict is a PIXEL metric, not an energy sum: it resizes the
// detail-preview region, computes per-pixel luma (0.2126R+0.7152G+0.0722B),
// and reports meanAbsDiff = mean(|lumaLo − lumaHi|) over the frame plus
// changedFrac = frac(pixels moving > 8 luma). A pure energy sum can grow while
// the RASTERIZED footprint stays sub-noise (tiny far-flung motes) — exactly the
// W4 r2/r3 failure mode (energy claim met, meanAbsDiff 0.594). So the test
// rasterizes the standing motes the SAME way the GPU does and runs the SAME
// metric the advocate runs, asserting the BOLD target at the real {0.5,0.7} pin.
const RASTER_PX = 240; //               advocate's frameDeltaOf resize width
const RASTER_HALF = 1.165; //           visible half-extent @ fov40°,z3.2 (tan20°·3.2)
const SPRITE_SIZE = 0.48; //            MOTE_SPRITE_SIZE in the primitive (world units)

/** Render the LIVE standing motes of `motes` into a RASTER_PX² luma grid the
 *  same way the renderer does: each instance is an additive brass disc with a
 *  Gaussian×rim radial falloff (the primitive's TSL `glow·rim`), projected with
 *  the rig camera scale, composited additively over the dark Observatory ground.
 *  Returns Float32 luma per pixel (0..255-ish). Mirrors what the advocate's
 *  camera captures, so meanAbsDiff over two such grids ≈ the advocate's number. */
function rasterizeMotes(motes: Sprite): Float32Array {
  const luma = new Float32Array(RASTER_PX * RASTER_PX);
  const pos = motes.geometry.getAttribute('instancePosition').array as ArrayLike<number>;
  const col = motes.geometry.getAttribute('instanceColor').array as ArrayLike<number>;
  // Projected disc radius in pixels: a world-size sprite of SPRITE_SIZE spans
  // SPRITE_SIZE / (2·RASTER_HALF) of the frame; half of that is the radius.
  const radiusPx = (SPRITE_SIZE / (2 * RASTER_HALF)) * RASTER_PX * 0.5;
  const r2 = radiusPx * radiusPx;
  const toPx = (w: number) => ((w / (2 * RASTER_HALF)) + 0.5) * RASTER_PX; // world→pixel
  for (let i = 0; i < motes.count; i++) {
    const cx = toPx(pos[i * 3]);
    const cy = toPx(-pos[i * 3 + 1]); // screen y is flipped
    // Per-instance brass luma (additive), matching the renderer's blend.
    const r = col[i * 3], g = col[i * 3 + 1], b = col[i * 3 + 2];
    const baseL = (0.2126 * r + 0.7152 * g + 0.0722 * b) * 255;
    const lo = Math.max(0, Math.floor(cx - radiusPx)), hi = Math.min(RASTER_PX - 1, Math.ceil(cx + radiusPx));
    const lo2 = Math.max(0, Math.floor(cy - radiusPx)), hi2 = Math.min(RASTER_PX - 1, Math.ceil(cy + radiusPx));
    for (let py = lo2; py <= hi2; py++) {
      for (let px = lo; px <= hi; px++) {
        const dx = px - cx, dy = py - cy;
        const dd = (dx * dx + dy * dy) / r2; // 0 center → 1 edge
        if (dd >= 1) continue;
        // Gaussian core × rim cutoff to EXACT zero before the edge — the
        // primitive's TSL is `glow = exp(d²·−3.4)` with `d` the unit radial
        // distance (0 center → 1 disc edge), `rim = 1 − smoothstep(0.7,0.95,d)`.
        const d = Math.sqrt(dd);
        const glow = Math.exp(-3.4 * d * d);
        const rim = d < 0.7 ? 1 : Math.max(0, 1 - (d - 0.7) / 0.25);
        luma[py * RASTER_PX + px] += baseL * glow * rim;
      }
    }
  }
  return luma;
}

/** The advocate's exact pixel metric over two rasterized luma grids:
 *  meanAbsDiff (mean |Δluma|, 0..255) + changedFrac (frac moving > 8 luma). */
function rasterDelta(a: Float32Array, b: Float32Array): { meanAbsDiff: number; changedFrac: number } {
  const n = a.length;
  let sum = 0, moved = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    if (d > 8) moved += 1;
  }
  return { meanAbsDiff: sum / n, changedFrac: moved / n };
}

/** Pin the pointer at an engaged point and hold it with REPEATED same-t seeks
 *  (dt≈0), exactly as the capture rigs do (controlsPinT, paused control sweep).
 *  Returns after the pose is byte-stable. */
function pinEngaged(
  target: AnimatableTarget,
  inst: { seek(t: number): void },
  pinT = 1,
  pin: { x: number; y: number } = PIN,
): void {
  idle(target, inst);
  target.userData.pointer = { ...pin };
  settle(inst, 0, 120); // drive in with real velocity (live spring)
  for (let i = 0; i < 4; i++) inst.seek(pinT); // then freeze: repeated same-t
}

// TWO capture rigs pin this tile, at DIFFERENT points — the engaged pose must
// reshape under every control at BOTH:
//  • verify-catalog-parallel pins {0.62,0.5} — a HORIZONTAL pull (+x).
//  • useradvocate-capture pins the orbit pointer at lastT=1 of a dur=4 loop:
//    ph=0.25 → {0.5,0.7} — a PURE VERTICAL downward offset, x DEAD-CENTER. Any
//    standing function keyed off the pointer's X reads ZERO here (the W4 r2
//    moteCount BLOCK: the spiral collapsed motes onto the occluded drain → no
//    visible dust, byte-identical sweep). The standing ring is keyed off the
//    FULL-MAGNITUDE drain so it works at both.
const PIN = { x: 0.62, y: 0.5 };
const PIN_ADVOCATE = { x: 0.5, y: 0.7 };

describe('gravity-well primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(gravityWellPrimitive).dispose();
  });

  it('is a stateful pointer primitive on the card', () => {
    expect(gravityWellPrimitive.category).toBe('pointer');
    expect(gravityWellPrimitive.defaultDriver).toBe('pointer');
    expect(gravityWellPrimitive.subject).toBe('card');
    const { inst } = fresh();
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('idle disengaged frame is the home pose (legible at rest)', () => {
    const { target, inst, subject } = fresh();
    const baseX = subject.position.x;
    const baseY = subject.position.y;
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0);
    expect(subject.position.x).toBeCloseTo(baseX, 6);
    expect(subject.position.y).toBeCloseTo(baseY, 6);
    expect(subject.scale.x).toBeCloseTo(1, 6);
    expect(subject.scale.y).toBeCloseTo(1, 6);
    expect(subject.rotation.z).toBeCloseTo(0, 6);
    inst.dispose();
  });

  it('physics: the card TRAVELS toward a moving pointer; a near pointer pulls harder than a far one', () => {
    // Slow well so the slide stays visibly en route across the sampled frames.
    const { target, inst, subject } = fresh({ pullSpeed: 0.12 });
    const baseX = subject.position.x;
    idle(target, inst);

    // Pointer steps right of center → the card slides +x, monotone increasing.
    target.userData.pointer = { x: 0.7, y: 0.5 };
    inst.seek(0.016);
    const s1 = subject.position.x - baseX;
    inst.seek(0.032);
    const s2 = subject.position.x - baseX;
    inst.seek(0.064);
    const s3 = subject.position.x - baseX;
    expect(s1).toBeGreaterThan(0);
    expect(s2).toBeGreaterThan(s1);
    expect(s3).toBeGreaterThan(s2);

    // A leftward pointer pulls the card the other way (past center, to −x).
    target.userData.pointer = { x: 0.1, y: 0.5 };
    settle(inst, 0.064, 120);
    expect(subject.position.x - baseX).toBeLessThan(0);
    inst.dispose();

    // NEAR vs FAR: settle two wells at a near and a far pointer; the near one
    // sits DEEPER in the well, so its tidal stretch is larger (the falloff is
    // inverse-square-ish, not flat). Read each stretch BEFORE disposing — dispose
    // restores the scale to identity.
    const near = fresh();
    near.target.userData.pointer = { x: 0.58, y: 0.5 }; // close to center
    settle(near.inst, 0, 200);
    const nearStretch = Math.abs(near.subject.scale.x - 1);
    near.inst.dispose();

    const far = fresh();
    far.target.userData.pointer = { x: 0.95, y: 0.5 }; // far from center
    settle(far.inst, 0, 200);
    const farStretch = Math.abs(far.subject.scale.x - 1);
    far.inst.dispose();

    // Tidal stretch GROWS as the pointer nears.
    expect(nearStretch).toBeGreaterThan(farStretch);
  });

  it('inverse-square-ish falloff: the pull curve is convex (super-linear), not magnetic’s linear pull', () => {
    // The well pulls the card a FRACTION of the way to the drain; with an
    // inverse-square-ish falloff that fraction is CONVEX in distance — high near,
    // collapsing far. A LINEAR pull (magnetic) would hold the fraction constant.
    // Measure the settled pull FRACTION (offset / raw drain) at three distances on
    // a FRESH well each time (no carried state, low gravity so nothing saturates).
    const pullFractionAt = (px: number): number => {
      const { target, inst, subject } = fresh({ pullSpeed: 0.6, gravity: 0.5 });
      const baseX = subject.position.x;
      target.userData.pointer = { x: px, y: 0.5 };
      settle(inst, 0, 260);
      const off = subject.position.x - baseX;
      inst.dispose();
      // Raw drain offset the card is being pulled toward (REACH_UNITS=1.1, width
      // ≈1.74, x reach is undamped): fraction = achieved / raw.
      const drain = (px - 0.5) * 2 * 1.1 * 1.74;
      return off / drain;
    };

    const fNear = pullFractionAt(0.62); //  close drain
    const fMid = pullFractionAt(0.78); //   mid drain
    const fFar = pullFractionAt(0.95); //   far drain

    // Each is a real fraction of the way to its drain, and the fraction COLLAPSES
    // with distance — the inverse-square-ish signature (a linear pull would keep
    // these ratios roughly equal).
    expect(fNear).toBeGreaterThan(0);
    expect(fNear).toBeGreaterThan(fMid + 0.05);
    expect(fMid).toBeGreaterThan(fFar + 0.02);
  });

  it('tidal stretch: at the engaged pin the card elongates along the pull axis and squashes across it', () => {
    const { target, inst, subject } = fresh();
    idle(target, inst);
    target.userData.pointer = { ...PIN }; // horizontal pull (+x)
    settle(inst, 0, 200);

    // Elongated ALONG x (the pull axis), squashed ACROSS y. Anisotropic — the
    // two axes move in opposite directions from identity.
    expect(subject.scale.x).toBeGreaterThan(1.02);
    expect(subject.scale.y).toBeLessThan(0.99);
    expect(subject.scale.x).toBeGreaterThan(subject.scale.y);
    inst.dispose();
  });

  it('motes: exactly one instanced Sprite (never THREE.Points), count tracks the control, positions finite + drained toward the pointer', () => {
    const { target, inst, subject } = fresh({ moteCount: 8 });
    idle(target, inst);
    target.userData.pointer = { ...PIN };
    settle(inst, 0, 60);

    const motes = findMotes(target);
    expect(motes, 'motes are a Sprite').not.toBeNull();
    expect((motes as unknown as { isPoints?: boolean }).isPoints).not.toBe(true);
    // Live count honored.
    expect((motes as Sprite).count).toBe(8);

    // Per-instance positions are finite and live near the pointer drain (which
    // is mapped to a subject-relative offset toward +x at this pin).
    const geo = (motes as Sprite).geometry;
    const inst3 = geo.getAttribute('instancePosition');
    expect(inst3).toBeTruthy();
    const arr = inst3.array as ArrayLike<number>;
    let allFinite = true;
    let meanX = 0;
    for (let i = 0; i < 8; i++) {
      const x = arr[i * 3];
      const y = arr[i * 3 + 1];
      const z = arr[i * 3 + 2];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) allFinite = false;
      meanX += x;
    }
    meanX /= 8;
    expect(allFinite).toBe(true);
    // The motes spiral toward the +x drain, so their mean x sits right of 0.
    expect(meanX).toBeGreaterThan(0);

    // moteCount control reshapes the draw count.
    inst.setControl('moteCount', 4);
    expect((motes as Sprite).count).toBe(4);
    inst.setControl('moteCount', 12);
    expect((motes as Sprite).count).toBe(12);
    inst.dispose();
  });

  it('engaged pin {0.62,0.5}: holds a drawn + stretched pose and EVERY control re-shapes the pinned frame', () => {
    const { target, inst, subject } = fresh();
    const baseX = subject.position.x;

    // Drive into the pin with real velocity, then PIN (repeated same-t seeks).
    idle(target, inst);
    target.userData.pointer = { ...PIN };
    settle(inst, 0, 120);
    inst.seek(2.0); // first pinned seek (settling step)
    inst.seek(2.0);
    const pinnedX = subject.position.x;
    const pinnedSX = subject.scale.x;
    for (let i = 0; i < 3; i++) inst.seek(2.0);
    // Byte-stable across repeated pinned seeks.
    expect(subject.position.x).toBeCloseTo(pinnedX, 10);
    expect(subject.scale.x).toBeCloseTo(pinnedSX, 10);
    // Visibly drawn toward the pointer AND tidally stretched (not an empty frame).
    expect(Math.abs(pinnedX - baseX)).toBeGreaterThan(0.02);
    expect(pinnedSX).toBeGreaterThan(1.02);

    // gravity sweep → stronger gravity draws the card harder at the pinned offset
    // (no extra seek: onParamChange re-applies at the held state).
    inst.setControl('gravity', 0.3);
    const weakX = Math.abs(subject.position.x - baseX);
    inst.setControl('gravity', 3.0);
    const strongX = Math.abs(subject.position.x - baseX);
    expect(strongX).toBeGreaterThan(weakX + 0.01);
    inst.setControl('gravity', 1.4);

    // falloff sweep → a different falloff power reshapes the pinned pull.
    inst.setControl('falloff', 1.0);
    const loFall = subject.position.x;
    inst.setControl('falloff', 3.0);
    const hiFall = subject.position.x;
    expect(Math.abs(hiFall - loFall)).toBeGreaterThan(0.005);
    inst.setControl('falloff', 2.0);

    // tidalStretch sweep → the pinned elongation magnitude grows.
    inst.setControl('tidalStretch', 0.05);
    const loTide = subject.scale.x;
    inst.setControl('tidalStretch', 0.5);
    const hiTide = subject.scale.x;
    expect(hiTide).toBeGreaterThan(loTide + 0.02);
    inst.setControl('tidalStretch', 0.22);

    // moteCount sweep → the draw count reshapes (already covered, re-assert at pin).
    const motes = findMotes(target) as Sprite;
    inst.setControl('moteCount', 3);
    expect(motes.count).toBe(3);
    inst.setControl('moteCount', 10);
    expect(motes.count).toBe(10);

    inst.dispose();
  });

  // ── REGRESSION GUARD for the W4 advocate r1 BLOCK ───────────────────────────
  // The advocate pins the pointer STATICALLY at {0.62,0.5} and sweeps each control
  // with REPEATED same-t seeks (dt≈0). moteCount and pullSpeed were measured
  // byte-identical (meanAbsDiff=0) and the tile was BLOCKED. These tests assert
  // BOTH formerly-dead controls now change a measured ENGAGED-POSE output across
  // low→high at that exact static pin (not a transient-only / count-field-only
  // difference) — mirroring the rig.

  it('pullSpeed (was DEAD): reshapes the standing engaged pose at the static pin (deeper draw-in + more stretch low→high)', () => {
    const { target, inst, subject } = fresh();
    const baseX = subject.position.x;

    // Hold the engaged pin with dt≈0 repeated seeks (the rig's paused sweep).
    pinEngaged(target, inst);

    // Sweep pullSpeed at the FROZEN pin (onParamChange re-applies at the held
    // pose; no extra clock step). A faster pull settles the card DEEPER in the
    // well at the very same pinned pointer → larger offset AND larger tidal
    // stretch. The pose must visibly differ low→high.
    inst.setControl('pullSpeed', 0.05);
    const loOff = Math.abs(subject.position.x - baseX);
    const loStretch = subject.scale.x;

    inst.setControl('pullSpeed', 0.9);
    const hiOff = Math.abs(subject.position.x - baseX);
    const hiStretch = subject.scale.x;

    // Standing draw-in depth rises with pullSpeed: deeper offset, more stretch.
    expect(hiOff).toBeGreaterThan(loOff + 0.01);
    expect(hiStretch).toBeGreaterThan(loStretch + 0.01);

    // Byte-stable across further repeated pinned seeks at the high value (no
    // jitter / drift — physics stays critically stable at the extreme).
    inst.seek(1);
    inst.seek(1);
    const settledX = subject.position.x;
    inst.seek(1);
    expect(subject.position.x).toBeCloseTo(settledX, 10);
    expect(Number.isFinite(subject.position.x)).toBe(true);
    inst.dispose();
  });

  // moteCount was the W4 r2 BLOCK: at the useradvocate pin {0.5,0.7} (pure
  // vertical, x dead-center) the live spiral collapsed every mote onto the
  // occluded drain at a faint phase tail → NO visible dust, byte-identical
  // low/mid/high (meanAbsDiff=0). The fix lays a BOLD standing ring keyed off the
  // FULL-MAGNITUDE drain. This test mirrors the rig EXACTLY (repeated dt=0 seeks
  // at the real {0.5,0.7} pin) and asserts a BOLD low→high delta — the advocate
  // target is meanAbsDiff ≥ 6 / changedFrac ≥ 0.12; the energy-domain proxy is a
  // ≥2.5× growth in summed visible luminance with EVERY mote on a legible ring.
  it('moteCount (was DEAD): BOLD ring of dust is drawn at the {0.5,0.7} pin and the visible count grows low→high', () => {
    const { target, inst } = fresh({ moteCount: 3 });
    // The pin the useradvocate rig actually uses — pure vertical, x = 0.5.
    pinEngaged(target, inst, 1, PIN_ADVOCATE);
    const motes = findMotes(target) as Sprite;

    // At the static pin the dust must be VISIBLY drawn — the advocate saw NONE
    // because the spiral left every mote on the occluded drain. The bold standing
    // ring guarantees strong luminance here.
    inst.setControl('moteCount', 3);
    inst.seek(1); // re-derive the pinned standing pose (dt=0 path)
    inst.seek(1);
    const loEnergy = moteEnergy(motes);
    const loGrid = rasterizeMotes(motes); // advocate-faithful pixel capture (3)
    expect(loEnergy).toBeGreaterThan(1); // motes plainly lit at the pin (bold)
    expect(motes.count).toBe(3);

    inst.setControl('moteCount', 12);
    inst.seek(1);
    inst.seek(1);
    const hiEnergy = moteEnergy(motes);
    const hiGrid = rasterizeMotes(motes); // advocate-faithful pixel capture (12)
    expect(motes.count).toBe(12);

    // BOLD density change: 12 motes carry ≥2.5× the visible brass of 3 — the
    // density a user plainly sees dragging the knob (NOT the timid sub-noise
    // delta the prior round produced). Energy scales ~linearly with count on the
    // ring, so 12/3 ≈ 4× in the ideal; assert well above the discoverability
    // floor.
    expect(hiEnergy).toBeGreaterThan(loEnergy * 2.5);

    // ── THE ADVOCATE'S OWN METRIC (the real BLOCK gate) ──────────────────────
    // The r2 verdict measured meanAbsDiff=0.594 / changedFrac=0.0083 (sub-noise)
    // over the rasterized frame. Rasterize the SAME motes the SAME way the GPU
    // does and run the SAME pixel metric: the 3→12 sweep at the real {0.5,0.7}
    // pin must now clear the BOLD discoverability target the advocate uses for a
    // live control — meanAbsDiff ≥ 6 (live siblings: 3.4–5.0; we exceed them),
    // changedFrac ≥ 0.12 (live siblings: 0.06–0.13). This is the assertion that
    // would have caught the byte-identical r2 frame.
    const delta = rasterDelta(loGrid, hiGrid);
    expect(delta.meanAbsDiff).toBeGreaterThanOrEqual(6);
    expect(delta.changedFrac).toBeGreaterThanOrEqual(0.12);

    // And the same BOLD delta lands via onParamChange ALONE (no clock seek) —
    // the rig fires the control input then captures the held frame. Drive 3→12
    // purely through setControl and re-measure: the pinned frame must reshape
    // boldly off the paused tweak, not only after an extra seek.
    inst.setControl('moteCount', 3);
    const loParamGrid = rasterizeMotes(motes);
    inst.setControl('moteCount', 12);
    const hiParamGrid = rasterizeMotes(motes);
    const paramDelta = rasterDelta(loParamGrid, hiParamGrid);
    expect(paramDelta.meanAbsDiff).toBeGreaterThanOrEqual(6);
    expect(paramDelta.changedFrac).toBeGreaterThanOrEqual(0.12);

    // Every drawn mote sits on a VISIBLE ring around the drain — none collapsed
    // onto the occluded drain centre. Drain is a PURE VERTICAL offset at this pin
    // (x = 0), so a function keyed off x alone would put every mote at x≈0; the
    // full-magnitude ring spreads them in BOTH axes. Measure radius FROM the
    // drain point (bounded vertical offset, x = 0).
    const w = subjectWidth(target.subject as Object3D);
    const drainY = Math.min((0.7 - 0.5) * 2 * 1.1 * 0.7 * w, 1.55 * 0.94 - w / 2);
    const pos = motes.geometry.getAttribute('instancePosition');
    const arr = pos.array as ArrayLike<number>;
    let onRing = 0;
    let spreadX = 0; // motes must spread in x too (not all stuck at the x=0 axis)
    for (let i = 0; i < motes.count; i++) {
      const x = arr[i * 3];
      const y = arr[i * 3 + 1];
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      if (Math.hypot(x - 0, y - drainY) > 0.2) onRing += 1;
      if (Math.abs(x) > 0.1) spreadX += 1;
    }
    expect(onRing).toBe(motes.count); // all on a legible ring, none on the drain
    expect(spreadX).toBeGreaterThan(0); // horizontally spread (full-mag, not x-keyed)
    inst.dispose();
  });

  // The same bold ring must also work at the OTHER rig pin (horizontal {0.62,0.5}).
  it('moteCount: bold ring + count growth also hold at the {0.62,0.5} horizontal pin', () => {
    const { target, inst } = fresh({ moteCount: 3 });
    pinEngaged(target, inst, 1, PIN);
    const motes = findMotes(target) as Sprite;
    inst.setControl('moteCount', 3);
    inst.seek(1);
    inst.seek(1);
    const loEnergy = moteEnergy(motes);
    expect(loEnergy).toBeGreaterThan(1);
    inst.setControl('moteCount', 12);
    inst.seek(1);
    inst.seek(1);
    const hiEnergy = moteEnergy(motes);
    expect(hiEnergy).toBeGreaterThan(loEnergy * 2.5);
    inst.dispose();
  });

  it('travel + stretch stay bounded subject-relative inside the tile frame at extremes', () => {
    const { target, inst, subject } = fresh({ gravity: 3.0, tidalStretch: 0.5, pullSpeed: 0.9 });
    const w = subjectWidth(subject);
    const baseX = subject.position.x;
    idle(target, inst);
    // Pointer slammed to the far corner; drive hard to convergence.
    target.userData.pointer = { x: 1, y: 1 };
    settle(inst, 0, 400);
    const offX = subject.position.x - baseX;
    // Card's near edge stays inside the tile half-width (~1.55 @ fov40 z3.2).
    expect(baseX + offX + w / 2).toBeLessThan(1.55);
    // Tidal stretch is bounded — never blows up.
    expect(subject.scale.x).toBeLessThan(2.0);
    expect(subject.scale.y).toBeGreaterThan(0.5);
    expect(Number.isFinite(subject.scale.x)).toBe(true);
    inst.dispose();
  });

  it('never writes non-finite transforms under a hostile pointer', () => {
    const { target, inst, subject } = fresh();
    (target.userData as { pointer: unknown }).pointer = { x: NaN, y: Infinity };
    let t = settle(inst, 0, 30);
    (target.userData as { pointer: unknown }).pointer = undefined;
    settle(inst, t, 30);
    expect(Number.isFinite(subject.position.x)).toBe(true);
    expect(Number.isFinite(subject.position.y)).toBe(true);
    expect(Number.isFinite(subject.scale.x)).toBe(true);
    expect(Number.isFinite(subject.scale.y)).toBe(true);
    expect(Number.isFinite(subject.rotation.z)).toBe(true);
    inst.dispose();
  });

  it('dispose restores the full home transform AND removes the motes', () => {
    const { target, inst, subject } = fresh();
    const before = {
      px: subject.position.x, py: subject.position.y, pz: subject.position.z,
      sx: subject.scale.x, sy: subject.scale.y, sz: subject.scale.z,
      rz: subject.rotation.z,
    };
    // The instance was already created (motes sprite added), so the baseline
    // includes it; dispose must drop the child count back by exactly one.
    const childCountWithMotes = target.object.children.length;

    idle(target, inst);
    target.userData.pointer = { x: 0.9, y: 0.2 };
    settle(inst, 0, 80);
    const moved =
      Math.abs(subject.position.x - before.px) + Math.abs(subject.scale.x - before.sx);
    expect(moved).toBeGreaterThan(0.02);
    expect(findMotes(target)).not.toBeNull();

    inst.dispose();
    expect(subject.position.x).toBe(before.px);
    expect(subject.position.y).toBe(before.py);
    expect(subject.position.z).toBe(before.pz);
    expect(subject.scale.x).toBe(before.sx);
    expect(subject.scale.y).toBe(before.sy);
    expect(subject.scale.z).toBe(before.sz);
    expect(subject.rotation.z).toBe(before.rz);
    // The motes sprite was removed and the child count dropped by one.
    expect(findMotes(target)).toBeNull();
    expect(target.object.children.length).toBe(childCountWithMotes - 1);
  });
});
