import { describe, it, expect } from 'vitest';
import { Color, Mesh, type MeshStandardMaterial } from 'three';
import { swapFlipMorphPrimitive } from '@/lib/prism/animatable/primitives/swap-flip-morph';
import { makeTarget, runConformance } from './_conformance';

// Defaults (mirrors the schema): hold 0.5s, flip duration 0.45s -> cycle 0.95s.
// Retimed (advocate must-fix 2026-06-12) so the FIRST flip completes before
// t=1s — the capture rig pins control sweeps at t=1, which must be an engaged
// face-B state for the faceBias sweep to read.
const HOLD = 0.5;
const DUR = 0.45;
const CYCLE = HOLD + DUR;

function hslOf(mat: MeshStandardMaterial): { h: number; s: number; l: number } {
  const hsl = { h: 0, s: 0, l: 0 };
  mat.color.getHSL(hsl);
  return hsl;
}
const lightnessOf = (mat: MeshStandardMaterial): number => hslOf(mat).l;

describe('swap-flip-morph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(swapFlipMorphPrimitive).dispose();
  });

  it('plays (t-fallback): auto half-flips each cycle, swapping the face at the 90° edge', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const mat = subject.material as MeshStandardMaterial;
    const baseHex = mat.color.getHex();
    const baseL = lightnessOf(mat);
    const inst = swapFlipMorphPrimitive.create(target);

    expect(inst.duration()).toBe(Infinity); // stateful loop with t-fallback

    // t=0: holding face A — untouched pose and untouched look.
    inst.seek(0);
    expect(subject.rotation.y).toBeCloseTo(0, 6);
    expect(mat.color.getHex()).toBe(baseHex);

    // Early in the flip (eased phase < 0.5): rotation underway, still face A
    // (the swap happens at the 90deg edge, which the eased phase hasn't crossed).
    inst.seek(HOLD + 0.05);
    expect(subject.rotation.y).toBeGreaterThan(0.2);
    expect(subject.rotation.y).toBeLessThan(Math.PI * 0.95);
    expect(mat.color.getHex()).toBe(baseHex);

    // Just past the edge crossing (eased phase >= 0.5): face B engaged — the
    // tint is on AND the card is showing its FRONT side (cos(angle) > 0): the
    // swap adds a half-turn so the chrome-bearing face stays toward the
    // camera. The bare back of the panel is never presented.
    inst.seek(HOLD + DUR * 0.2); // backOut(0.2) ≈ 0.71 >= 0.5
    expect(mat.color.getHex()).not.toBe(baseHex);
    expect(Math.cos(subject.rotation.y)).toBeGreaterThan(0);

    // End of cycle 0 (t=0.95): the swap-flip settles FRONT-facing (a full turn:
    // rotation.y = 2*PI) showing the alternate face — tinted LIGHTER than base
    // (default bias +), with the composite structure intact.
    inst.seek(CYCLE);
    expect(subject.rotation.y).toBeCloseTo(Math.PI * 2, 5);
    expect(Math.cos(subject.rotation.y)).toBeGreaterThan(0.99); // front-facing
    expect(mat.color.getHex()).not.toBe(baseHex);
    expect(lightnessOf(mat)).toBeGreaterThan(baseL);

    // End of cycle 1 (t=1.9): the return flip lands back on face A at the same
    // full-turn angle (2*PI) and face A's exact base look is restored.
    inst.seek(CYCLE * 2);
    expect(subject.rotation.y).toBeCloseTo(Math.PI * 2, 5);
    expect(mat.color.getHex()).toBe(baseHex);

    inst.dispose();
  });

  it('face B keeps the composite structure: chrome is co-tinted with capped desaturation', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const panelMat = subject.material as MeshStandardMaterial;
    const header = subject.children.find((c) => c.name === 'card-header') as Mesh;
    const headerMat = header.material as MeshStandardMaterial;
    const baseHeaderHex = headerMat.color.getHex();
    const baseHeaderS = hslOf(headerMat).s;
    const basePanelL = lightnessOf(panelMat);
    const inst = swapFlipMorphPrimitive.create(target);

    inst.setControl('faceBias', 1);
    inst.seek(CYCLE); // face B settled, front-facing

    // The chrome rotates WITH the face and stays camera-facing (same parent
    // transform; front-facing checked above), and it IS re-tinted...
    expect(headerMat.color.getHex()).not.toBe(baseHeaderHex);
    // ...but its lerp is capped: the brass header keeps most of its chroma
    // (identity survives — face B is a bone-tinted card, not a grey slab).
    expect(hslOf(headerMat).s).toBeGreaterThan(0.4);
    expect(hslOf(headerMat).s).toBeGreaterThan(baseHeaderS * 0.6);
    // The near-neutral panel takes a much larger lightness shift than the
    // header loses saturation — per-material weighting, not a uniform wash.
    expect(lightnessOf(panelMat) - basePanelL).toBeGreaterThan(0.25);

    inst.dispose();
  });

  it('state-driven: reads userData.state, flips ONLY on toggles (no auto-loop)', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const mat = subject.material as MeshStandardMaterial;
    const baseHex = mat.color.getHex();
    const inst = swapFlipMorphPrimitive.create(target);

    // External boolean present -> the t-clock fallback is OFF. Holding state
    // false across a long span produces NO motion.
    target.userData.state = false;
    inst.seek(0.1);
    expect(subject.rotation.y).toBeCloseTo(0, 6);
    inst.seek(5);
    expect(subject.rotation.y).toBeCloseTo(0, 6);
    expect(mat.color.getHex()).toBe(baseHex);

    // Toggle -> the half-flip runs over `duration` from the toggle instant,
    // landing front-facing (half-turn + the face-B swap half-turn = 2*PI).
    target.userData.state = true;
    inst.seek(5.1); // toggle observed here; flip starts now
    expect(subject.rotation.y).toBeCloseTo(0, 5);
    inst.seek(5.1 + DUR); // flip complete
    expect(subject.rotation.y).toBeCloseTo(Math.PI * 2, 5);
    expect(Math.cos(subject.rotation.y)).toBeGreaterThan(0.99); // front-facing
    expect(mat.color.getHex()).not.toBe(baseHex); // face B tint

    // Holding the new state: stable (repeat-safe).
    inst.seek(8);
    expect(subject.rotation.y).toBeCloseTo(Math.PI * 2, 5);

    // Toggle back -> completes the turn and restores face A's exact look.
    target.userData.state = false;
    inst.seek(8.2);
    inst.seek(8.2 + DUR);
    expect(subject.rotation.y).toBeCloseTo(Math.PI * 2, 5);
    expect(mat.color.getHex()).toBe(baseHex);

    inst.dispose();
  });

  it('controls change output: axis re-targets live; duration shifts the pose at t=1', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const inst = swapFlipMorphPrimitive.create(target);

    // Default axis 'y': rotation.y carries the flip (settled face B = full
    // turn), rotation.x stays at base.
    inst.seek(CYCLE);
    expect(subject.rotation.y).toBeCloseTo(Math.PI * 2, 5);
    expect(subject.rotation.x).toBeCloseTo(0, 6);

    // Axis read LIVE in seek: switching re-targets on the next frame.
    inst.setControl('axis', 'x');
    inst.seek(CYCLE);
    expect(subject.rotation.x).toBeCloseTo(Math.PI * 2, 5);
    expect(subject.rotation.y).toBeCloseTo(0, 6);
    inst.setControl('axis', 'y');

    // CONTROLS-gate mirror: paused at t=1s, duration min vs max produces
    // clearly different flip poses (min: face B settled; max: mid-flip).
    inst.setControl('duration', 0.2);
    inst.seek(1);
    const fastPose = subject.rotation.y;
    inst.setControl('duration', 2.0);
    inst.seek(1);
    const slowPose = subject.rotation.y;
    expect(Math.abs(fastPose - slowPose)).toBeGreaterThan(0.5);

    inst.dispose();
  });

  it('faceBias control: positive lightens face B, negative darkens it, both derived from base', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const mat = subject.material as MeshStandardMaterial;
    const baseL = lightnessOf(mat);
    const baseEI = mat.emissiveIntensity;
    const inst = swapFlipMorphPrimitive.create(target);

    inst.setControl('faceBias', 1);
    inst.seek(CYCLE); // face B showing
    const lightL = lightnessOf(mat);
    const lightEI = mat.emissiveIntensity;

    inst.setControl('faceBias', -1);
    inst.seek(CYCLE);
    const darkL = lightnessOf(mat);
    const darkEI = mat.emissiveIntensity;

    expect(lightL).toBeGreaterThan(baseL);
    expect(darkL).toBeLessThan(baseL);
    expect(lightEI).toBeGreaterThan(baseEI);
    expect(darkEI).toBeLessThan(baseEI);

    inst.dispose();
  });

  it('capture-rig gate: t=1s is an engaged face-B state and every fader changes the frozen frame', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const mat = subject.material as MeshStandardMaterial;
    const baseHex = mat.color.getHex();
    const inst = swapFlipMorphPrimitive.create(target);

    // DEFAULTS at the pinned control time t=1: the first flip (0.5..0.95s) has
    // completed — the tile is HOLDING face B, front-facing and tinted.
    inst.seek(1);
    expect(subject.rotation.y).toBeCloseTo(Math.PI * 2, 5);
    expect(mat.color.getHex()).not.toBe(baseHex);

    // faceBias sweeps the frozen frame: -1 (ink) vs +1 (bone) at the same t.
    inst.setControl('faceBias', -1);
    inst.seek(1);
    const darkHex = mat.color.getHex();
    const darkL = lightnessOf(mat);
    inst.setControl('faceBias', 1);
    inst.seek(1);
    const lightL = lightnessOf(mat);
    expect(mat.color.getHex()).not.toBe(darkHex);
    expect(lightL - darkL).toBeGreaterThan(0.3);

    // Rig residue guard: the capture leaves earlier sliders at MAX. With
    // duration left at 2, the hold fader must still change the t=1 frame:
    // hold=min -> mid-flip face B (tinted); hold=max -> still pre-flip face A.
    inst.setControl('faceBias', 1);
    inst.setControl('duration', 2);
    inst.setControl('hold', 0.2);
    inst.seek(1);
    const lowHoldHex = mat.color.getHex();
    const lowHoldRot = subject.rotation.y;
    expect(lowHoldHex).not.toBe(baseHex); // face B engaged
    inst.setControl('hold', 3);
    inst.seek(1);
    expect(mat.color.getHex()).toBe(baseHex); // face A rest — visibly different
    expect(Math.abs(subject.rotation.y - lowHoldRot)).toBeGreaterThan(0.2);

    inst.dispose();
  });

  it('onParamChange re-applies at the last seek time (no host re-seek needed)', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const mat = subject.material as MeshStandardMaterial;
    const inst = swapFlipMorphPrimitive.create(target);

    inst.seek(1); // paused, face B held (default bias 0.55 -> bone tint)
    const heldHex = mat.color.getHex();
    const heldL = lightnessOf(mat);

    // Tweak the bias WITHOUT seeking again — the material must repaint.
    inst.setControl('faceBias', -1);
    expect(mat.color.getHex()).not.toBe(heldHex);
    expect(lightnessOf(mat)).toBeLessThan(heldL);

    // And the pose stays pinned at the frozen frame (no clock advance).
    expect(subject.rotation.y).toBeCloseTo(Math.PI * 2, 5);

    inst.dispose();
  });

  it('dispose restores transforms and every touched material (panel + chrome children)', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const panelMat = subject.material as MeshStandardMaterial;
    const header = subject.children.find((c) => c.name === 'card-header') as Mesh;
    const headerMat = header.material as MeshStandardMaterial;

    const basePanelHex = panelMat.color.getHex();
    const basePanelEmissive = panelMat.emissive.getHex();
    const basePanelEI = panelMat.emissiveIntensity;
    const baseHeaderHex = headerMat.color.getHex();
    const baseHeaderEI = headerMat.emissiveIntensity;
    const baseScale = subject.scale.clone();

    const inst = swapFlipMorphPrimitive.create(target);
    inst.seek(CYCLE); // face B: full turn, subtree tinted
    expect(panelMat.color.getHex()).not.toBe(basePanelHex);
    expect(headerMat.color.getHex()).not.toBe(baseHeaderHex);

    inst.dispose();
    expect(subject.rotation.x).toBeCloseTo(0, 6);
    expect(subject.rotation.y).toBeCloseTo(0, 6);
    expect(subject.scale.x).toBeCloseTo(baseScale.x, 6);
    expect(panelMat.color.getHex()).toBe(basePanelHex);
    expect(panelMat.emissive.getHex()).toBe(basePanelEmissive);
    expect(panelMat.emissiveIntensity).toBeCloseTo(basePanelEI, 6);
    expect(headerMat.color.getHex()).toBe(baseHeaderHex);
    expect(headerMat.emissiveIntensity).toBeCloseTo(baseHeaderEI, 6);
    // The face tint is a lerp FROM the subject's own colors — sanity-check the
    // restore really came from snapshots, not re-derivation.
    expect(new Color(basePanelHex).getHex()).toBe(panelMat.color.getHex());
  });
});
