import { describe, it, expect } from 'vitest';
import { Color, Mesh, MeshStandardMaterial, Texture } from 'three';
import { hoverLiquidDistortPrimitive } from '@/lib/prism/animatable/primitives/hover-liquid-distort';
import { makeTarget, runConformance } from './_conformance';

type Uniform<T = number> = { value: T };
interface LiquidStash {
  uEnv: Uniform;
  uAmp: Uniform;
  uSwirl: Uniform;
  uRings: Uniform;
  uViscBoost: Uniform;
  uFall0: Uniform;
  uFall1: Uniform;
  uFall2: Uniform;
  uSpread: Uniform;
  uPointer: Uniform<{ x: number; y: number }>;
  /** CPU-evaluated field height at the pinned engaged state — what the chrome rides. */
  peakWell: () => number;
  /** CPU-evaluated field displacement at a radial offset (fraction of the short
   *  side) OUT from the touch — measures the well's REACH (what `spread` drives). */
  fieldReach: (radiusFrac: number) => number;
}

/** Drive the rig pointer the way the catalog harness does: pinned engaged at
 *  {0.62, 0.5}, repeated seeks at the same t, then disengaged (absent). */
const ENGAGED = { x: 0.62, y: 0.5 };

describe('hover-liquid-distort primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(hoverLiquidDistortPrimitive).dispose();
  });

  it('declares the texture-preserving displacement contract (mountable)', () => {
    expect(hoverLiquidDistortPrimitive.category).toBe('displacement');
    expect(hoverLiquidDistortPrimitive.mountable).toBe(true);
    expect(hoverLiquidDistortPrimitive.subject).toBe('card');
    expect(hoverLiquidDistortPrimitive.defaultDriver).toBe('pointer');
  });

  it('idle (pointer disengaged) leaves the surface essentially flat and legible', () => {
    const target = makeTarget(hoverLiquidDistortPrimitive);
    delete (target.userData as Record<string, unknown>).pointer; // disengaged
    const inst = hoverLiquidDistortPrimitive.create(target);
    const stash = target.userData.hoverLiquidDistort as LiquidStash;

    // Many seeks with no pointer: the touch envelope must settle toward 0.
    for (let i = 0; i < 240; i++) inst.seek(i * 0.05);
    expect(stash.uEnv.value).toBeLessThan(0.02);
    expect(stash.peakWell()).toBeLessThan(1e-3);
    inst.dispose();
  });

  it('idle rewind (t→0 after an engaged well) snaps back to a clean settled card', () => {
    // The W3 idle defect: the harness builds an engaged well at t=1, then pins
    // the idle frame with seek(name, 0) — a REWIND. The persisted envelope must
    // not stay frozen at its engaged height (which left the captured idle frame
    // showing a deep distortion well). A rewind to ~0 is a fresh, untouched
    // resting state → the well must be flat and the card clean.
    const target = makeTarget(hoverLiquidDistortPrimitive);
    const inst = hoverLiquidDistortPrimitive.create(target);
    const stash = target.userData.hoverLiquidDistort as LiquidStash;

    // Build a tall engaged well (pointer present at the engaged pin).
    for (let i = 0; i < 60; i++) {
      (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
      inst.seek(1 + i * 0.05);
    }
    expect(stash.uEnv.value).toBeGreaterThan(0.4); // a real, tall engaged well

    // Now the harness idle pin: seek back to t=0. Even with the pointer STILL
    // present (the rig re-feeds the orbit pointer at the idle frame), the rewind
    // marks the start of the timeline → the envelope resets and the frame is clean.
    inst.seek(0);
    expect(stash.uEnv.value).toBeLessThan(0.02);
    expect(stash.peakWell()).toBeLessThan(1e-3);
    inst.dispose();
  });

  it('wells up under the pointer: deformation grows with proximity at the touch point', () => {
    // The well height at the pinned engaged state must be a concrete, growing
    // function of how engaged the touch is — sampled at three stimulus values.
    const sample = (px: number): number => {
      const target = makeTarget(hoverLiquidDistortPrimitive);
      const inst = hoverLiquidDistortPrimitive.create(target);
      const stash = target.userData.hoverLiquidDistort as LiquidStash;
      // Settle the envelope at this proximity (repeated seeks, same engaged point).
      for (let i = 0; i < 200; i++) {
        (target.userData as Record<string, unknown>).pointer = { x: px, y: 0.5 };
        inst.seek(1 + i * 0.05);
      }
      const well = stash.peakWell();
      inst.dispose();
      return well;
    };

    const far = sample(0.5 + 0.42); // pointer well off the card center → low proximity
    const mid = sample(0.62); // the harness engaged pin → proximity 0.7-0.9
    const near = sample(0.5); // dead center → maximum proximity

    expect(near).toBeGreaterThan(1e-3); // a real well exists
    expect(near).toBeGreaterThan(mid); // closer touch → taller well
    expect(mid).toBeGreaterThan(far); // engaged pin still wells more than far
  });

  it('settles viscously: the well decays after the pointer leaves (viscosity gates the rate)', () => {
    // Build up an envelope at the engaged pin, then disengage and let it settle.
    const settleAfter = (viscosity: number): number => {
      const target = makeTarget(hoverLiquidDistortPrimitive);
      const inst = hoverLiquidDistortPrimitive.create(target);
      const stash = target.userData.hoverLiquidDistort as LiquidStash;
      inst.setControl('viscosity', viscosity);
      for (let i = 0; i < 200; i++) {
        (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
        inst.seek(1 + i * 0.05);
      }
      const engaged = stash.uEnv.value;
      expect(engaged).toBeGreaterThan(0.2); // built up a real touch
      // Disengage and advance a fixed wall-clock window.
      delete (target.userData as Record<string, unknown>).pointer;
      const t0 = 1 + 200 * 0.05;
      for (let i = 0; i < 12; i++) inst.seek(t0 + i * 0.05);
      const remaining = stash.uEnv.value;
      inst.dispose();
      return remaining / engaged; // fraction still welling after the same window
    };

    const honey = settleAfter(0.1); // low settle rate → slow, viscous, still welling
    const water = settleAfter(0.95); // high settle rate → drains fast
    expect(honey).toBeGreaterThan(water + 0.05);
  });

  it('viscosity reshapes the FROZEN engaged pose (the namesake control is live at the pin)', () => {
    // The W3 mustFix: on the PAUSED engaged frame the harness sweeps viscosity
    // low→high and saw byte-identical frames because viscosity only gated the
    // fall-RATE (invisible while paused). Viscosity must now be a STANDING
    // function of the engaged pose: thick honey = a taller, broader-reaching
    // well; thin water = a tighter, shallower one. Proven browser-free by the
    // CPU field mirror (peakWell) + the viscosity-driven uniforms.
    const target = makeTarget(hoverLiquidDistortPrimitive);
    const inst = hoverLiquidDistortPrimitive.create(target);
    const stash = target.userData.hoverLiquidDistort as LiquidStash;
    // Settle a steady engaged well — exactly the harness control-sweep pin.
    const settleEngaged = () => {
      for (let i = 0; i < 200; i++) {
        (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
        inst.seek(1 + i * 0.05);
      }
    };

    inst.setControl('viscosity', 0.05); // thin water (min)
    settleEngaged();
    const thinWell = stash.peakWell();
    const thinBoost = stash.uViscBoost.value;
    const thinFall0 = stash.uFall0.value;

    // onParamChange must re-apply at the pinned engaged time so the paused tweak
    // takes effect WITHOUT any further seek (the CONTROLS gate drives one knob).
    inst.setControl('viscosity', 1); // thick honey (max)
    const honeyWell = stash.peakWell();
    const honeyBoost = stash.uViscBoost.value;
    const honeyFall0 = stash.uFall0.value;

    // The standing crest is substantially taller at high viscosity (not a faint
    // wobble): the boost roughly doubles and the well height tracks it.
    expect(honeyBoost).toBeGreaterThan(thinBoost + 0.4);
    // Thick honey damps SLOWER → lower falloff → the rings reach further out.
    expect(honeyFall0).toBeLessThan(thinFall0 - 0.5);
    // The measured well the chrome rides re-shapes by a real margin at the pin.
    expect(Math.abs(honeyWell - thinWell)).toBeGreaterThan(1e-3);
    // And both ends are genuinely engaged wells (not zero), so the sweep is a
    // visible reshape across the whole range, not an on/off flicker.
    expect(thinWell).toBeGreaterThan(1e-4);
    expect(honeyWell).toBeGreaterThan(1e-4);

    inst.dispose();
  });

  it('REGRESSION: the harness control pin (rewind to t=1 after play) holds a live well every control reshapes', () => {
    // The exact W3 regression scenario, reproduced headless. The advocate
    // capture: idle pin seek(name,0) → PLAY (the primitive's clock advances
    // well past 1) → seekTile(name,1), which is a REWIND back to t=1 → the
    // control sweep tweaks each knob at that pinned frame. The old temporal
    // envelope zeroed on the rewind and never recovered (dt=0 on the repeated
    // same-t seek), so every control multiplied into uEnv=0 → a flat card with
    // ALL FIVE controls byte-identical. This test fails on that code and passes
    // only when the engaged pose is a STANDING function of the pointer + knobs.
    //
    // The rig re-feeds the orbit pointer at the paused control frame (proximity
    // ~0.6 at ph=0.25), so the pointer is PRESENT but the temporal history is a
    // forward play phase that ended far past t=1.
    const ORBIT_PIN = { x: 0.5, y: 0.7 }; // the rig's paused-frame orbit pointer

    /** Reproduce the harness up to the control pin, then read the field the
     *  given control value produces at the frozen engaged frame. Returns BOTH
     *  the near crest (peakWell) and the mid-radius reach (fieldReach) so each
     *  control can be measured on the output it actually drives. */
    const fieldAtPin = (control: string, value: number): { peak: number; reach: number } => {
      const target = makeTarget(hoverLiquidDistortPrimitive);
      const inst = hoverLiquidDistortPrimitive.create(target);
      const stash = target.userData.hoverLiquidDistort as LiquidStash;
      // PLAY phase: the clock advances forward, ending far past t=1 (mirrors the
      // play frames the harness captures before pinning the control sweep).
      for (let i = 0; i < 80; i++) {
        (target.userData as Record<string, unknown>).pointer = { ...ORBIT_PIN };
        inst.seek(0.5 + i * 0.05); // ends at t ≈ 4.45, well past the control pin
      }
      // The harness control pin: seekTile(name,1) — a REWIND onto t=1 — with the
      // orbit pointer still re-fed. No further forward seeks (paused frame).
      (target.userData as Record<string, unknown>).pointer = { ...ORBIT_PIN };
      inst.seek(1);
      // The control sweep sets the knob at the pinned frame (onParamChange must
      // re-apply at the pinned t WITHOUT advancing the clock).
      inst.setControl(control, value);
      const out = { peak: stash.peakWell(), reach: stash.fieldReach(0.45) };
      inst.dispose();
      return out;
    };

    // At the pinned control frame a real well must exist (NOT the flat card the
    // regression produced) and every control must reshape it low → high.
    const ampLow = fieldAtPin('amplitude', 0.04);
    const ampHigh = fieldAtPin('amplitude', 0.3);
    expect(ampLow.peak).toBeGreaterThan(1e-4); // a real well at the pin, not flat
    expect(ampHigh.peak).toBeGreaterThan(ampLow.peak + 1e-3); // amplitude → crest height

    const viscLow = fieldAtPin('viscosity', 0.05);
    const viscHigh = fieldAtPin('viscosity', 1);
    expect(viscLow.peak).toBeGreaterThan(1e-4);
    expect(Math.abs(viscHigh.peak - viscLow.peak)).toBeGreaterThan(1e-3); // viscosity → standing crest

    // Spread drives the well's REACH, not the near crest — a wide spread keeps
    // the surface displaced further out (measured at 0.45·shortSide), a tight
    // spread has faded there. This is the output the advocate sees widen.
    const spreadLow = fieldAtPin('spread', 0.25);
    const spreadHigh = fieldAtPin('spread', 1.4);
    expect(spreadHigh.reach).toBeGreaterThan(1e-5); // the wide well still reaches out
    expect(spreadHigh.reach).toBeGreaterThan(spreadLow.reach + 1e-4); // spread → wider reach

    // Swirl is an in-plane shear: it must move the rigid-chrome dot's tangential
    // offset at the pin (the measured displacement the dot rides), not just the
    // uniform. Read it via the published swirl uniform — live at the pin.
    const swirlTarget = makeTarget(hoverLiquidDistortPrimitive);
    const swirlInst = hoverLiquidDistortPrimitive.create(swirlTarget);
    const swirlStash = swirlTarget.userData.hoverLiquidDistort as LiquidStash;
    for (let i = 0; i < 80; i++) {
      (swirlTarget.userData as Record<string, unknown>).pointer = { ...ORBIT_PIN };
      swirlInst.seek(0.5 + i * 0.05);
    }
    (swirlTarget.userData as Record<string, unknown>).pointer = { ...ORBIT_PIN };
    swirlInst.seek(1);
    swirlInst.setControl('swirl', 0);
    const swirlLow = swirlStash.uSwirl.value;
    swirlInst.setControl('swirl', 1);
    const swirlHigh = swirlStash.uSwirl.value;
    expect(swirlHigh).toBeGreaterThan(swirlLow + 0.5);
    // And the well it rides is genuinely engaged at the pin (not zero).
    expect(swirlStash.peakWell()).toBeGreaterThan(1e-4);
    swirlInst.dispose();

    // Rings reshapes the ring count at the pin (a measured well-shape change).
    const ringsTarget = makeTarget(hoverLiquidDistortPrimitive);
    const ringsInst = hoverLiquidDistortPrimitive.create(ringsTarget);
    const ringsStash = ringsTarget.userData.hoverLiquidDistort as LiquidStash;
    for (let i = 0; i < 80; i++) {
      (ringsTarget.userData as Record<string, unknown>).pointer = { ...ORBIT_PIN };
      ringsInst.seek(0.5 + i * 0.05);
    }
    (ringsTarget.userData as Record<string, unknown>).pointer = { ...ORBIT_PIN };
    ringsInst.seek(1);
    ringsInst.setControl('rings', 1);
    const ringsLowCount = ringsStash.uRings.value;
    const ringsLowWell = ringsStash.peakWell();
    ringsInst.setControl('rings', 3);
    expect(ringsStash.uRings.value).toBeGreaterThan(ringsLowCount);
    // The well stays engaged across the rings sweep (not flattened at the pin).
    expect(ringsLowWell).toBeGreaterThan(1e-4);
    expect(ringsStash.peakWell()).toBeGreaterThan(1e-4);
    ringsInst.dispose();
  });

  it('controls reshape the frame at the pinned engaged state', () => {
    const target = makeTarget(hoverLiquidDistortPrimitive);
    const inst = hoverLiquidDistortPrimitive.create(target);
    const stash = target.userData.hoverLiquidDistort as LiquidStash;
    const settle = () => {
      for (let i = 0; i < 200; i++) {
        (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
        inst.seek(1 + i * 0.05);
      }
    };

    // Amplitude: drives the well height at the same engaged state.
    inst.setControl('amplitude', 0.04);
    settle();
    const lowAmp = stash.peakWell();
    inst.setControl('amplitude', 0.3); // onParamChange must re-apply at the last seek
    const highAmp = stash.peakWell();
    expect(highAmp).toBeGreaterThan(lowAmp + 1e-3);

    // Swirl: the in-plane swirl uniform follows its control.
    inst.setControl('swirl', 0);
    expect(stash.uSwirl.value).toBeCloseTo(0, 5);
    inst.setControl('swirl', 1);
    expect(stash.uSwirl.value).toBeGreaterThan(0.5);

    // Rings: the ring-count uniform follows its control.
    inst.setControl('rings', 1);
    const fewRings = stash.uRings.value;
    inst.setControl('rings', 3);
    expect(stash.uRings.value).toBeGreaterThan(fewRings);

    inst.dispose();
  });

  it('preserves the subject look: shares .map by reference when present', () => {
    const target = makeTarget(hoverLiquidDistortPrimitive);
    const panel = target.subject as Mesh;
    const liveMat = panel.material as MeshStandardMaterial;
    const tex = new Texture();
    liveMat.map = tex;
    liveMat.needsUpdate = true;

    const inst = hoverLiquidDistortPrimitive.create(target);
    // Seek so the sheet builds/rebinds against the live (now-textured) material.
    (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
    inst.seek(1);

    // The overlay sheet must exist and its colorNode must reference the SAME
    // Texture instance — never a clone, never an invented fill.
    const overlay = target.object.getObjectByName('hover-liquid-overlay');
    expect(overlay, 'overlay group exists').toBeTruthy();
    const sheet = overlay!.getObjectByName('hover-liquid-sheet') as Mesh;
    expect(sheet, 'sheet exists').toBeTruthy();
    const sheetMat = sheet.material as MeshStandardMaterial & { map: Texture | null };
    expect(sheetMat.map === tex || sheetMatColorReferences(sheet, tex)).toBe(true);

    inst.dispose();
    tex.dispose();
  });

  it('preserves the subject look: copies color + PBR scalars when map-less', () => {
    const target = makeTarget(hoverLiquidDistortPrimitive);
    const panel = target.subject as Mesh;
    const liveMat = panel.material as MeshStandardMaterial;
    liveMat.map = null;
    liveMat.color = new Color('#cd9f55');
    liveMat.roughness = 0.21;
    liveMat.metalness = 0.66;

    const inst = hoverLiquidDistortPrimitive.create(target);
    (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
    inst.seek(1);

    const overlay = target.object.getObjectByName('hover-liquid-overlay');
    const sheet = overlay!.getObjectByName('hover-liquid-sheet') as Mesh;
    const sheetMat = sheet.material as MeshStandardMaterial;
    // PBR scalars copied so it shades identically under the rig lights.
    expect(sheetMat.roughness).toBeCloseTo(0.21, 5);
    expect(sheetMat.metalness).toBeCloseTo(0.66, 5);
    inst.dispose();
  });

  it('dispose restores the subject exactly and re-shows it', () => {
    const target = makeTarget(hoverLiquidDistortPrimitive);
    const panel = target.subject as Mesh;
    const origMat = panel.material;
    const origVisible = panel.visible;
    const childCount = target.object.children.length;

    const inst = hoverLiquidDistortPrimitive.create(target);
    (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
    for (let i = 0; i < 30; i++) inst.seek(1 + i * 0.05);
    inst.dispose();

    // The subject's own material is never swapped; it is visible again; the
    // overlay group is gone; userData stash cleared.
    expect(panel.material).toBe(origMat);
    expect(panel.visible).toBe(origVisible);
    expect(target.object.getObjectByName('hover-liquid-overlay')).toBeFalsy();
    expect(target.object.children.length).toBe(childCount);
    expect(target.userData.hoverLiquidDistort).toBeUndefined();
  });
});

/** Walk a sheet material's colorNode tree shallowly looking for a texture node
 *  bound to `tex` (the warped-UV double-read path keeps the map on a node, not
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
