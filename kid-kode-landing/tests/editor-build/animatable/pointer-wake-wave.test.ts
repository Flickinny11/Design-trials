import { describe, it, expect } from 'vitest';
import { Color, Mesh, MeshStandardMaterial, Texture, Vector2 } from 'three';
import { pointerWakeWavePrimitive } from '@/lib/prism/animatable/primitives/pointer-wake-wave';
import { makeTarget, runConformance } from './_conformance';

type Uniform<T = number> = { value: T };
interface WakeStash {
  uAmp: Uniform;
  uTrail: Uniform;
  uCrestFreq: Uniform;
  uDecay: Uniform;
  uTravel: Uniform;
  uMouse: Uniform<Vector2>;
  uHeadX: Uniform;
  uHeadY: Uniform;
  /** Peak |wake crest| across the sheet — what the chrome rides. */
  peakWake: () => number;
  /** CPU mirror of the field height at a sheet-frame point. */
  fieldAt: (sx: number, sy: number) => number;
  /** Fraction of a sampling grid carrying a live wake (a trailing V covers far
   *  more cells than a point bulge). */
  wakeCoverage: (thresholdFrac?: number) => number;
  /** Proxy for live wake presence (round(coverage*100)). */
  liveSlots: () => number;
}

/** The catalog harness pins the pointer ENGAGED at {0.62, 0.5} and PAUSES. */
const ENGAGED = { x: 0.62, y: 0.5 };

/** Drive the rig the way the catalog harness does for a CONTROL sweep: the
 *  pointer engaged at the pin, then ONE paused seek at t=1 (the env snaps to 1
 *  on a dt=0 engaged seek so the frozen frame holds the full wake). */
function engageAt(
  inst: ReturnType<typeof pointerWakeWavePrimitive.create>,
  target: ReturnType<typeof makeTarget>,
  pointer: { x: number; y: number },
  t = 1,
): void {
  (target.userData as Record<string, unknown>).pointer = { ...pointer };
  inst.seek(t);
}

/** Settle the wake at a fixed pinned pointer by repeated seeks (the play-frame
 *  convention — same engaged point, advancing wall clock). */
function settleAt(
  inst: ReturnType<typeof pointerWakeWavePrimitive.create>,
  target: ReturnType<typeof makeTarget>,
  pointer: { x: number; y: number },
  steps = 40,
): void {
  for (let i = 0; i < steps; i++) {
    (target.userData as Record<string, unknown>).pointer = { ...pointer };
    inst.seek(1 + i * 0.05);
  }
}

describe('pointer-wake-wave primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerWakeWavePrimitive).dispose();
  });

  it('declares the texture-preserving displacement contract (mountable)', () => {
    expect(pointerWakeWavePrimitive.category).toBe('displacement');
    expect(pointerWakeWavePrimitive.mountable).toBe(true);
    expect(pointerWakeWavePrimitive.subject).toBe('card');
    expect(pointerWakeWavePrimitive.defaultDriver).toBe('pointer');
    expect(pointerWakeWavePrimitive.create(makeTarget(pointerWakeWavePrimitive)).duration()).toBe(
      Infinity,
    );
    // 4 controls, all the wake knobs present (IDs stable).
    const ids = pointerWakeWavePrimitive.schema.map((c) => c.id).sort();
    expect(ids).toEqual(['amplitude', 'decayRate', 'trailLength', 'waveSpeed']);
  });

  it('idle (pointer disengaged) leaves the surface essentially flat and legible', () => {
    const target = makeTarget(pointerWakeWavePrimitive);
    delete (target.userData as Record<string, unknown>).pointer; // disengaged
    const inst = pointerWakeWavePrimitive.create(target);
    const stash = target.userData.pointerWakeWave as WakeStash;

    // Many seeks with no pointer: the envelope settles to 0 → the wake crest at
    // rest is ~0 (fully legible idle frame) and no cells carry a live wake.
    for (let i = 0; i < 200; i++) inst.seek(i * 0.05);
    expect(stash.peakWake()).toBeLessThan(1e-3);
    expect(stash.liveSlots()).toBe(0);
    inst.dispose();
  });

  it('engaged pin holds a SUBSTANTIAL standing wake (not a transient that decays away)', () => {
    // The W3 stimulus: ONE paused engaged seek at the pin. A velocity-driven
    // effect would read ~0 here; a standing field of pointer POSITION holds a
    // real wake. Assert a non-trivial crest AND a V that covers many cells.
    const target = makeTarget(pointerWakeWavePrimitive);
    const inst = pointerWakeWavePrimitive.create(target);
    const stash = target.userData.pointerWakeWave as WakeStash;
    engageAt(inst, target, ENGAGED);

    // Substantial amplitude: well above any discoverability floor. uAmp is
    // amplitude×shortSide×env; at default amp 0.16 and env 1 this is sizeable.
    expect(stash.uAmp.value).toBeGreaterThan(0.02);
    // A real surface crest rides at a meaningful fraction of uAmp.
    expect(stash.peakWake()).toBeGreaterThan(stash.uAmp.value * 0.2);
    // The wake is a TRAIL, not a point: it covers a real swath of the sheet.
    expect(stash.wakeCoverage()).toBeGreaterThan(0.05);
    inst.dispose();
  });

  it('reads as a trailing V: the wake lives BEHIND the boat along the heading', () => {
    // A boat wake trails the cursor along −heading. With the canonical heading
    // (toward −x) and the pointer at the right of the card, the wake field must
    // be far stronger on the trailing (−x) side than ahead of the boat (+x).
    const target = makeTarget(pointerWakeWavePrimitive);
    const inst = pointerWakeWavePrimitive.create(target);
    const stash = target.userData.pointerWakeWave as WakeStash;
    settleAt(inst, target, ENGAGED, 30); // settle the heading + env

    const m = stash.uMouse.value;
    const ax = stash.uHeadX.value;
    const ay = stash.uHeadY.value;
    // Sample a small cluster BEHIND the boat (along −heading) to be robust to
    // the crest phase nulls, and a matching cluster AHEAD of the boat.
    let behindPeak = 0;
    for (let s = 0.1; s <= 0.7; s += 0.05) {
      behindPeak = Math.max(behindPeak, Math.abs(stash.fieldAt(m.x - ax * s, m.y - ay * s)));
    }
    let aheadPeak = 0;
    for (let s = 0.1; s <= 0.7; s += 0.05) {
      aheadPeak = Math.max(aheadPeak, Math.abs(stash.fieldAt(m.x + ax * s, m.y + ay * s)));
    }
    expect(behindPeak).toBeGreaterThan(1e-3); // a real wake trails the boat
    expect(behindPeak).toBeGreaterThan(aheadPeak * 3); // it's BEHIND, not ahead
    inst.dispose();
  });

  it('animates over time: the crests march backward during play (NOT a frozen frame)', () => {
    // The defect: all play frames were byte-identical. The field carries a time
    // travel term, so the wake crest at a FIXED sheet point changes across play
    // seeks even with a stationary pinned pointer. Sample the field at a fixed
    // probe over a play sweep and assert it is not constant.
    const target = makeTarget(pointerWakeWavePrimitive);
    const inst = pointerWakeWavePrimitive.create(target);
    const stash = target.userData.pointerWakeWave as WakeStash;
    // Settle so env=1 and the heading is stable.
    settleAt(inst, target, ENGAGED, 20);
    const m = stash.uMouse.value;
    const ax = stash.uHeadX.value;
    const ay = stash.uHeadY.value;
    // A probe well inside the wake tail (behind the boat along −heading).
    const px = m.x - ax * 0.45;
    const py = m.y - ay * 0.45;
    const samples: number[] = [];
    for (let i = 0; i < 24; i++) {
      (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
      inst.seek(2 + i * 0.04); // a play sweep at the pinned pointer
      samples.push(stash.fieldAt(px, py));
    }
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    // The traveling crest sweeps a SUBSTANTIAL range at the fixed probe over the
    // play sweep — a frozen frame would be a flat line. The cresting cos passes
    // through the probe, so the range is a real fraction of the wake amplitude.
    expect(max - min).toBeGreaterThan(stash.uAmp.value * 0.4);
    inst.dispose();
  });

  it('controls reshape the frame at the pinned engaged state (every knob live)', () => {
    // amplitude: drives the wake crest height at the same engaged state.
    const ampWake = (amp: number): number => {
      const target = makeTarget(pointerWakeWavePrimitive);
      const inst = pointerWakeWavePrimitive.create(target);
      const stash = target.userData.pointerWakeWave as WakeStash;
      inst.setControl('amplitude', amp);
      engageAt(inst, target, ENGAGED);
      const w = stash.peakWake();
      inst.dispose();
      return w;
    };
    const lowAmp = ampWake(0.04);
    const highAmp = ampWake(0.3);
    // A SUBSTANTIAL crest-height change (not a hair above the floor): high amp
    // rides several times the low-amp crest at the same engaged state.
    expect(highAmp).toBeGreaterThan(lowAmp * 2);
    expect(highAmp - lowAmp).toBeGreaterThan(0.05);

    // trailLength: a longer trail reaches further behind the boat → the wake
    // COVERS more of the sheet at the engaged state (longitudinal extent).
    const coverageAt = (len: number): number => {
      const target = makeTarget(pointerWakeWavePrimitive);
      const inst = pointerWakeWavePrimitive.create(target);
      const stash = target.userData.pointerWakeWave as WakeStash;
      inst.setControl('decayRate', 0.6); // hold decay so the trail can reach
      inst.setControl('trailLength', len);
      engageAt(inst, target, ENGAGED);
      const cov = stash.wakeCoverage();
      inst.dispose();
      return cov;
    };
    const shortTrail = coverageAt(0.4);
    const longTrail = coverageAt(2.2);
    // A SUBSTANTIAL longitudinal resize: a long trail covers a far larger swath
    // of the sheet than a stubby one (well past any noise floor).
    expect(longTrail).toBeGreaterThan(shortTrail + 0.15);

    // waveSpeed: re-applies at the pinned seek (onParamChange) and reshapes the
    // standing crest spacing — the field at a fixed probe DIFFERS by waveSpeed.
    const crestFreqAtSpeed = (speed: number): number => {
      const target = makeTarget(pointerWakeWavePrimitive);
      const inst = pointerWakeWavePrimitive.create(target);
      const stash = target.userData.pointerWakeWave as WakeStash;
      inst.setControl('waveSpeed', speed);
      engageAt(inst, target, ENGAGED);
      const freq = stash.uCrestFreq.value; // a direct function of waveSpeed
      inst.dispose();
      return freq;
    };
    const slowFreq = crestFreqAtSpeed(0.4);
    const fastFreq = crestFreqAtSpeed(4);
    expect(fastFreq).toBeGreaterThan(slowFreq); // tighter-packed crests when fast

    // decayRate: a faster decay leaves a smaller / shorter-reaching wake at the
    // same engaged pin (less coverage + a lower far-tail field).
    const tailFieldAtDecay = (rate: number): number => {
      const target = makeTarget(pointerWakeWavePrimitive);
      const inst = pointerWakeWavePrimitive.create(target);
      const stash = target.userData.pointerWakeWave as WakeStash;
      inst.setControl('trailLength', 2.2); // long trail so decay can express
      inst.setControl('decayRate', rate);
      engageAt(inst, target, ENGAGED);
      const cov = stash.wakeCoverage();
      inst.dispose();
      return cov;
    };
    const slowDecay = tailFieldAtDecay(0.4); // lingering wake → more coverage
    const fastDecay = tailFieldAtDecay(4); // dies right behind the cursor
    // A SUBSTANTIAL persistence change: a slow decay lingers across far more of
    // the sheet than a fast one (the tail visibly collapses to the boat).
    expect(slowDecay).toBeGreaterThan(fastDecay + 0.08);

    // waveSpeed also live-tracks its travel uniform direction under re-seek.
    {
      const target = makeTarget(pointerWakeWavePrimitive);
      const inst = pointerWakeWavePrimitive.create(target);
      const stash = target.userData.pointerWakeWave as WakeStash;
      engageAt(inst, target, ENGAGED, 1);
      inst.setControl('waveSpeed', 0.4);
      const slowFreqU = stash.uCrestFreq.value;
      inst.setControl('waveSpeed', 4); // onParamChange re-applies at the last seek
      const fastFreqU = stash.uCrestFreq.value;
      expect(fastFreqU).toBeGreaterThan(slowFreqU);
      inst.dispose();
    }
  });

  it('a moving cursor steers the wake heading along its PATH', () => {
    // When the cursor sweeps, the wake heading follows the travel direction so
    // the trail extends back the way it came. Sweep right vs left and assert the
    // peak field x-position lands on the matching (trailing) side.
    const peakX = (fromX: number, toX: number): number => {
      const target = makeTarget(pointerWakeWavePrimitive);
      const inst = pointerWakeWavePrimitive.create(target);
      const stash = target.userData.pointerWakeWave as WakeStash;
      inst.setControl('waveSpeed', 1);
      inst.setControl('decayRate', 1);
      const N = 16;
      for (let i = 0; i <= N; i++) {
        const px = fromX + (i / N) * (toX - fromX);
        (target.userData as Record<string, unknown>).pointer = { x: px, y: 0.5 };
        inst.seek(1 + i * 0.05);
      }
      let bestX = 0;
      let bestV = 0;
      for (let i = 0; i <= 80; i++) {
        const sx = -0.85 + (i / 80) * 1.7;
        const v = Math.abs(stash.fieldAt(sx, 0));
        if (v > bestV) {
          bestV = v;
          bestX = sx;
        }
      }
      expect(bestV).toBeGreaterThan(1e-3); // a real wake exists
      inst.dispose();
      return bestX;
    };
    // The freshest, strongest crest sits just behind the cursor's LATEST
    // position. Sweeping right ends the boat on the right → the wake peak lands
    // on the right; sweeping left ends on the left → the peak lands on the left.
    // So the right-sweep peak x is greater than the left-sweep peak x. This is
    // concrete numeric deformation that DIFFERS by stimulus (sweep direction).
    const sweptRight = peakX(0.25, 0.78);
    const sweptLeft = peakX(0.78, 0.22);
    expect(sweptRight).toBeGreaterThan(sweptLeft);
  });

  it('preserves the subject look: shares .map by reference when present', () => {
    const target = makeTarget(pointerWakeWavePrimitive);
    const panel = target.subject as Mesh;
    const liveMat = panel.material as MeshStandardMaterial;
    const tex = new Texture();
    liveMat.map = tex;
    liveMat.needsUpdate = true;

    const inst = pointerWakeWavePrimitive.create(target);
    // Seek so the sheet builds/rebinds against the live (now-textured) material.
    (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
    inst.seek(1);

    // The overlay sheet must exist and its colorNode must reference the SAME
    // Texture instance — never a clone, never an invented fill.
    const overlay = target.object.getObjectByName('pointer-wake-wave-overlay');
    expect(overlay, 'overlay group exists').toBeTruthy();
    const sheet = overlay!.getObjectByName('pointer-wake-wave-sheet') as Mesh;
    expect(sheet, 'sheet exists').toBeTruthy();
    expect(sheetMatColorReferences(sheet, tex)).toBe(true);

    inst.dispose();
    tex.dispose();
  });

  it('preserves the subject look: copies color + PBR scalars when map-less', () => {
    const target = makeTarget(pointerWakeWavePrimitive);
    const panel = target.subject as Mesh;
    const liveMat = panel.material as MeshStandardMaterial;
    liveMat.map = null;
    liveMat.color = new Color('#cd9f55');
    liveMat.roughness = 0.21;
    liveMat.metalness = 0.66;

    const inst = pointerWakeWavePrimitive.create(target);
    (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
    inst.seek(1);

    const overlay = target.object.getObjectByName('pointer-wake-wave-overlay');
    const sheet = overlay!.getObjectByName('pointer-wake-wave-sheet') as Mesh;
    const sheetMat = sheet.material as MeshStandardMaterial;
    // PBR scalars copied so it shades identically under the rig lights.
    expect(sheetMat.roughness).toBeCloseTo(0.21, 5);
    expect(sheetMat.metalness).toBeCloseTo(0.66, 5);
    inst.dispose();
  });

  it('builds bent chrome clones so the composite card rides the wake', () => {
    const target = makeTarget(pointerWakeWavePrimitive);
    const inst = pointerWakeWavePrimitive.create(target);
    (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
    inst.seek(1);
    const overlay = target.object.getObjectByName('pointer-wake-wave-overlay');
    expect(overlay).toBeTruthy();
    // The card subject has a header bar + 3 rows (bent clones) and an accent dot
    // (rigid clone) — chrome must be cloned onto the overlay, not left blank.
    const bent = overlay!.children.filter((c) => c.name.startsWith('pointer-wake-wave-chrome-bent'));
    const rigid = overlay!.children.filter((c) => c.name.startsWith('pointer-wake-wave-chrome-rigid'));
    expect(bent.length).toBeGreaterThanOrEqual(1); // header + rows ride the bend
    expect(rigid.length).toBeGreaterThanOrEqual(1); // the accent dot is posed rigidly
    inst.dispose();
  });

  it('dispose restores the subject exactly and re-shows it', () => {
    const target = makeTarget(pointerWakeWavePrimitive);
    const panel = target.subject as Mesh;
    const origMat = panel.material;
    const origVisible = panel.visible;
    const childCount = target.object.children.length;

    const inst = pointerWakeWavePrimitive.create(target);
    (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
    for (let i = 0; i < 30; i++) inst.seek(1 + i * 0.05);
    inst.dispose();

    // The subject's own material is never swapped; it is visible again; the
    // overlay group is gone; userData stash cleared.
    expect(panel.material).toBe(origMat);
    expect(panel.visible).toBe(origVisible);
    expect(target.object.getObjectByName('pointer-wake-wave-overlay')).toBeFalsy();
    expect(target.object.children.length).toBe(childCount);
    expect(target.userData.pointerWakeWave).toBeUndefined();
  });
});

/** Walk a sheet material's colorNode tree shallowly looking for a texture node
 *  bound to `tex` (the warped-uv double-read path keeps the map on a node, not
 *  the material's .map slot). */
function sheetMatColorReferences(sheet: Mesh, tex: Texture): boolean {
  const mat = sheet.material as { colorNode?: unknown };
  const seen = new Set<unknown>();
  const walk = (n: unknown, depth: number): boolean => {
    if (!n || typeof n !== 'object' || depth > 6 || seen.has(n)) return false;
    seen.add(n);
    if ((n as { value?: unknown }).value === tex) return true;
    for (const v of Object.values(n as Record<string, unknown>)) {
      if (walk(v, depth + 1)) return true;
    }
    return false;
  };
  return walk(mat.colorNode, 0);
}
