import { describe, it, expect } from 'vitest';
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  Vector2,
  type Material,
  type Object3D,
} from 'three';
import { pointerCastShadowPrimitive } from '@/lib/prism/animatable/primitives/pointer-cast-shadow';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

const SHADOW_NAME = 'pointer-cast-shadow-quad';
const RIM_NAME = 'pointer-cast-shadow-rim';

function findByName(root: Object3D, name: string): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((o) => {
    if (!found && o.name === name) found = o;
  });
  return found;
}

/** A mounted-artifact-shaped target: subject is a GROUP containing a textured
 *  Mesh child — exactly what bindings.ts hands a pointer primitive for an MSDF
 *  text-object. */
function makeGroupSubjectTarget(): {
  target: AnimatableTarget;
  group: Group;
  childMesh: Mesh;
} {
  const scene = new Scene();
  const object = new Group();
  const group = new Group();
  group.name = 'text-object';
  const childMesh = new Mesh(
    new PlaneGeometry(2.4, 0.9),
    new MeshStandardMaterial({ color: '#cd9f55' }),
  );
  group.add(childMesh);
  object.add(group);
  scene.add(object);
  return {
    target: {
      object,
      subject: group,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    },
    group,
    childMesh,
  };
}

interface ShadowUniforms {
  uDir: { value: Vector2 };
  uLength: { value: number };
  uSoftness: { value: number };
  uOpacity: { value: number };
}
interface RimUniforms {
  uPointer: { value: Vector2 };
  uRim: { value: number };
}

function readShadowUniforms(t: AnimatableTarget): ShadowUniforms {
  return (t.userData.pointerCastShadowUniforms as { shadow: ShadowUniforms }).shadow;
}
function readRimUniforms(t: AnimatableTarget): RimUniforms {
  return (t.userData.pointerCastShadowUniforms as { rim: RimUniforms }).rim;
}

describe('pointer-cast-shadow primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerCastShadowPrimitive).dispose();
  });

  it('is a pointer primitive with the premium defaults and 4 controls', () => {
    expect(pointerCastShadowPrimitive.category).toBe('pointer');
    expect(pointerCastShadowPrimitive.defaultDriver).toBe('pointer');
    expect(pointerCastShadowPrimitive.subject).toBe('card');
    const ids = pointerCastShadowPrimitive.schema.map((c) => c.id).sort();
    expect(ids).toEqual(['opacity', 'rimIntensity', 'shadowLength', 'softness']);
    // Duration is Infinity (stateful pointer effect).
    const inst = pointerCastShadowPrimitive.create(makeTarget(pointerCastShadowPrimitive));
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  // ── Physics: the shadow points AWAY from the pointer and stretches with the
  //    light angle, and the card leans away. Concrete numeric transforms across
  //    seeks with a moving pointer. ──────────────────────────────────────────
  it('physics: shadow displaces opposite the pointer and stretches as the light rakes low; card leans away', () => {
    const target = makeTarget(pointerCastShadowPrimitive);
    const inst = pointerCastShadowPrimitive.create(target);
    const subject = target.subject as Object3D;
    const shadow = findByName(target.object, SHADOW_NAME) as Mesh;
    expect(shadow).not.toBeNull();
    const shadowUni = readShadowUniforms(target);

    // Seed: settle from the idle disengaged state. Warm up a few seeks so the
    // springs reach the engaged pose (semi-implicit Euler convergence).
    // Pointer high overhead (near top center) → tight shadow underfoot.
    target.userData.pointer = { x: 0.5, y: 0.92 };
    let lastShadowOffsetY = 0;
    for (let i = 0; i < 60; i++) inst.seek(i * 0.05);
    const overheadOffset = new Vector2(shadow.position.x, shadow.position.y);
    const overheadLength = shadowUni.uLength.value;
    lastShadowOffsetY = shadow.position.y;

    // Now the light rakes LOW from the left (x low, y low) → long shadow thrown
    // up-and-right (opposite the pointer), longer than the overhead case.
    target.userData.pointer = { x: 0.08, y: 0.1 };
    for (let i = 0; i < 60; i++) inst.seek(3 + i * 0.05);
    const rakingOffset = new Vector2(shadow.position.x, shadow.position.y);
    const rakingLength = shadowUni.uLength.value;

    // Shadow displaces OPPOSITE the pointer: pointer left-low → shadow center
    // pushed right (+x) and up (+y) relative to the subject.
    expect(rakingOffset.x).toBeGreaterThan(0);
    expect(rakingOffset.y).toBeGreaterThan(0);
    // Raking-low light throws a LONGER shadow than overhead light.
    expect(rakingLength).toBeGreaterThan(overheadLength + 0.05);
    // Overhead shadow sits low/under the card (negative-ish y offset), tighter
    // than the raking displacement magnitude.
    expect(overheadOffset.length()).toBeLessThan(rakingOffset.length());
    expect(lastShadowOffsetY).toBeLessThan(rakingOffset.y);

    // The card leans AWAY from the light: pointer on the left → card tips its
    // rotation toward +; we just assert a non-zero, finite lean was applied and
    // it flipped sign with the pointer crossing center.
    const leanLeft = subject.rotation.y;
    expect(Number.isFinite(leanLeft)).toBe(true);

    target.userData.pointer = { x: 0.92, y: 0.1 };
    for (let i = 0; i < 60; i++) inst.seek(6 + i * 0.05);
    const leanRight = subject.rotation.y;
    expect(Number.isFinite(leanRight)).toBe(true);
    // Lean reversed sign when the light crossed to the other side.
    expect(Math.sign(leanRight)).not.toBe(Math.sign(leanLeft));

    inst.dispose();
  });

  // ── Pinned engaged state {0.62, 0.5}: every control visibly reshapes the
  //    frame under repeated seeks at the same t. ──────────────────────────────
  it('controls reshape the pinned engaged frame {0.62,0.5} (repeated seeks at the same t)', () => {
    const target = makeTarget(pointerCastShadowPrimitive);
    const inst = pointerCastShadowPrimitive.create(target);
    const shadow = findByName(target.object, SHADOW_NAME) as Mesh;
    const shadowUni = readShadowUniforms(target);
    const rimUni = readRimUniforms(target);

    // Pin the rig pointer at the engaged point and settle.
    target.userData.pointer = { x: 0.62, y: 0.5 };
    const PIN_T = 2.0;
    const settle = () => {
      for (let i = 0; i < 80; i++) inst.seek(PIN_T);
    };

    // shadowLength: longer length → larger uLength + a longer quad scale.
    inst.setControl('shadowLength', pointerCastShadowPrimitive.schema.find((c) => c.id === 'shadowLength')!['min' as never]);
    settle();
    const lenLow = shadowUni.uLength.value;
    const scaleLow = shadow.scale.y;
    inst.setControl('shadowLength', pointerCastShadowPrimitive.schema.find((c) => c.id === 'shadowLength')!['max' as never]);
    settle();
    const lenHigh = shadowUni.uLength.value;
    const scaleHigh = shadow.scale.y;
    expect(lenHigh).toBeGreaterThan(lenLow + 0.1);
    expect(scaleHigh).toBeGreaterThan(scaleLow + 0.05);

    // softness reshapes the uSoftness uniform.
    inst.setControl('softness', 0.05);
    settle();
    const softLow = shadowUni.uSoftness.value;
    inst.setControl('softness', 1);
    settle();
    const softHigh = shadowUni.uSoftness.value;
    expect(softHigh).toBeGreaterThan(softLow + 0.1);

    // opacity reshapes the uOpacity uniform.
    inst.setControl('opacity', 0.1);
    settle();
    const opLow = shadowUni.uOpacity.value;
    inst.setControl('opacity', 0.9);
    settle();
    const opHigh = shadowUni.uOpacity.value;
    expect(opHigh).toBeGreaterThan(opLow + 0.3);

    // rimIntensity reshapes the rim uniform.
    inst.setControl('rimIntensity', 0);
    settle();
    const rimLow = rimUni.uRim.value;
    inst.setControl('rimIntensity', 3);
    settle();
    const rimHigh = rimUni.uRim.value;
    expect(rimHigh).toBeGreaterThan(rimLow + 1);

    inst.dispose();
  });

  // ── ADVOCATE-FIDELITY (W4 dead-control fix): the capture harness PINS the
  //    cursor statically at the engaged point (pointer velocity ≈ 0, spring
  //    settled), then sweeps a control via the slider's input/change event
  //    (→ onParamChange) and screenshots WITHOUT any further seek. So the
  //    formerly-DEAD headline control `shadowLength` must reshape the engaged
  //    pose purely through onParamChange at a frozen seek state — the rake
  //    length must be a STANDING geometric function of the control, not gated
  //    on velocity/rake angle. This test reproduces that exact flow and asserts
  //    EVERY visible standing rake output (quad displacement magnitude, quad
  //    along-axis scale, and the in-quad oval uLength) moves low → high. ──────
  it('shadowLength reshapes the STATIC pinned engaged pose via onParamChange alone (no re-seek) — mirrors the advocate capture', () => {
    const target = makeTarget(pointerCastShadowPrimitive);
    const inst = pointerCastShadowPrimitive.create(target);
    const subject = target.subject as Object3D;
    const shadow = findByName(target.object, SHADOW_NAME) as Mesh;
    const shadowUni = readShadowUniforms(target);

    // Pin the cursor at the engaged point and settle the springs by repeating
    // the SAME seek time (dt ≈ 0, like the paused/pinned harness frame).
    target.userData.pointer = { x: 0.62, y: 0.5 };
    const PIN_T = 1.0;
    for (let i = 0; i < 120; i++) inst.seek(PIN_T);

    // A standing displacement magnitude of the cast-shadow quad relative to the
    // subject centre — the part that rakes the shadow out from behind the card.
    const homeX = subject.position.x;
    const homeY = subject.position.y;
    const dispMag = () =>
      Math.hypot(shadow.position.x - homeX, shadow.position.y - homeY);

    // LOW length: sweep the slider to its minimum via setControl ONLY (this is
    // exactly what the harness does: fill() → input/change → onParamChange).
    // NO inst.seek() after this point — the pose must re-render from the
    // control change alone at the frozen seek state.
    inst.setControl('shadowLength', 0.2);
    const lenLow = shadowUni.uLength.value;
    const scaleLow = shadow.scale.y;
    const dispLow = dispMag();

    // HIGH length: sweep to maximum, again with no re-seek.
    inst.setControl('shadowLength', 1);
    const lenHigh = shadowUni.uLength.value;
    const scaleHigh = shadow.scale.y;
    const dispHigh = dispMag();

    // The full slider sweep must visibly LENGTHEN the standing cast shadow on
    // every measured channel — this is the headline control and the whole
    // premise of the claim ("rakes long when the light is low").
    expect(lenHigh).toBeGreaterThan(lenLow + 0.3); // in-quad oval elongation
    expect(scaleHigh).toBeGreaterThan(scaleLow + 0.5); // quad along-axis stretch
    expect(dispHigh).toBeGreaterThan(dispLow + 0.05); // rakes farther out

    // And it must be MONOTONIC across the travel (mid sits between), so the
    // slider reads as a continuous length control, not a two-state flip.
    inst.setControl('shadowLength', 0.6);
    const lenMid = shadowUni.uLength.value;
    const scaleMid = shadow.scale.y;
    expect(lenMid).toBeGreaterThan(lenLow);
    expect(lenMid).toBeLessThan(lenHigh);
    expect(scaleMid).toBeGreaterThan(scaleLow);
    expect(scaleMid).toBeLessThan(scaleHigh);

    inst.dispose();
  });

  // ── onParamChange re-applies the pose at the last seek state without a new
  //    seek call. ───────────────────────────────────────────────────────────
  it('onParamChange re-applies at the last seek state (no new seek needed)', () => {
    const target = makeTarget(pointerCastShadowPrimitive);
    const inst = pointerCastShadowPrimitive.create(target);
    const shadowUni = readShadowUniforms(target);

    target.userData.pointer = { x: 0.62, y: 0.5 };
    for (let i = 0; i < 80; i++) inst.seek(2.0);
    const before = shadowUni.uOpacity.value;

    // Change opacity WITHOUT another seek — onParamChange must push the new
    // value through `apply()` at the last seek state. (uOpacity rides an
    // engagement scalar, so it lands below the raw 0.95 control, but it must
    // jump visibly upward immediately, proving the re-apply.)
    inst.setControl('opacity', 0.95);
    const after = shadowUni.uOpacity.value;
    expect(after).toBeGreaterThan(before + 0.1);

    inst.dispose();
  });

  // ── Idle / settle-home: disengaged pointer at rest → subject FULLY legible
  //    at home pose (no lean, shadow tight/faint). ──────────────────────────
  it('settles home: disengaged center pointer → subject returns to home pose, fully legible', () => {
    const target = makeTarget(pointerCastShadowPrimitive);
    const subject = target.subject as Object3D;
    const baseRotY = subject.rotation.y;
    const baseRotZ = subject.rotation.z;
    const inst = pointerCastShadowPrimitive.create(target);

    // First engage hard, then disengage (pointer dead-center = light overhead /
    // neutral) and let it settle for many frames.
    target.userData.pointer = { x: 0.05, y: 0.05 };
    for (let i = 0; i < 30; i++) inst.seek(i * 0.05);

    target.userData.pointer = { x: 0.5, y: 0.5 };
    for (let i = 0; i < 200; i++) inst.seek(2 + i * 0.05);

    // Card returns to home rotation (legible, no residual lean).
    expect(subject.rotation.y).toBeCloseTo(baseRotY, 2);
    expect(subject.rotation.z).toBeCloseTo(baseRotZ, 2);
    inst.dispose();
  });

  // ── Stability: no jitter/explosion at control extremes after a hard pointer
  //    swing — all transforms finite and bounded. ────────────────────────────
  it('stable at extremes: no NaN/explosion after hard pointer swings at max controls', () => {
    const target = makeTarget(pointerCastShadowPrimitive);
    const inst = pointerCastShadowPrimitive.create(target);
    const subject = target.subject as Object3D;
    const shadow = findByName(target.object, SHADOW_NAME) as Mesh;

    inst.setControl('shadowLength', 1);
    inst.setControl('softness', 1);
    inst.setControl('opacity', 1);
    inst.setControl('rimIntensity', 3);

    for (let i = 0; i < 120; i++) {
      // Hard alternating swings (worst-case velocity) + a non-finite probe.
      const x = i % 2 ? 0.0 : 1.0;
      const y = i % 3 ? 0.0 : 1.0;
      target.userData.pointer = { x, y };
      inst.seek(i * 0.05);
    }
    // Probe a non-finite pointer — must be guarded, never poisons the pose.
    target.userData.pointer = { x: NaN, y: Infinity };
    inst.seek(6.5);

    expect(Number.isFinite(subject.rotation.y)).toBe(true);
    expect(Number.isFinite(subject.rotation.z)).toBe(true);
    expect(Number.isFinite(shadow.position.x)).toBe(true);
    expect(Number.isFinite(shadow.position.y)).toBe(true);
    expect(Number.isFinite(shadow.scale.x)).toBe(true);
    expect(Number.isFinite(shadow.scale.y)).toBe(true);
    // Bounded: the lean stays a gentle tip (< ~0.4 rad), shadow stays in frame.
    expect(Math.abs(subject.rotation.y)).toBeLessThan(0.5);
    expect(Math.abs(shadow.position.x)).toBeLessThan(3);
    expect(Math.abs(shadow.position.y)).toBeLessThan(3);

    inst.dispose();
  });

  // ── NON-DESTRUCTIVE: the subject's own material is NEVER swapped; shadow +
  //    rim are dedicated overlay meshes the primitive owns. ──────────────────
  it('never swaps the subject material; shadow + rim are owned overlays removed on dispose', () => {
    const target = makeTarget(pointerCastShadowPrimitive);
    const mesh = target.subject as Mesh;
    const originalMaterial = mesh.material;

    const inst = pointerCastShadowPrimitive.create(target);
    expect(mesh.material).toBe(originalMaterial);

    const shadow = findByName(target.object, SHADOW_NAME) as Mesh;
    const rim = findByName(target.object, RIM_NAME) as Mesh;
    expect(shadow).not.toBeNull();
    expect(rim).not.toBeNull();
    // Shadow + rim never write depth (must not occlude the artifact).
    expect((shadow.material as { depthWrite: boolean }).depthWrite).toBe(false);
    expect((shadow.material as { transparent: boolean }).transparent).toBe(true);
    expect((rim.material as { depthWrite: boolean }).depthWrite).toBe(false);
    expect((rim.material as { transparent: boolean }).transparent).toBe(true);

    target.userData.pointer = { x: 0.3, y: 0.2 };
    inst.seek(0.8);
    expect(mesh.material).toBe(originalMaterial);

    inst.dispose();
    expect(mesh.material).toBe(originalMaterial);
    expect(findByName(target.object, SHADOW_NAME)).toBeNull();
    expect(findByName(target.object, RIM_NAME)).toBeNull();
  });

  // ── Group subject (mounted text-object): no bogus .material write, overlays
  //    still created, no crash. ──────────────────────────────────────────────
  it('Group subject: no bogus .material on the Group, overlays created, restores on dispose', () => {
    const { target, group, childMesh } = makeGroupSubjectTarget();
    const childMaterial: Material = childMesh.material as Material;

    const inst = pointerCastShadowPrimitive.create(target);
    expect(
      (group as unknown as { material?: unknown }).material,
      'no bogus .material written onto the Group',
    ).toBeUndefined();
    expect(childMesh.material).toBe(childMaterial);

    expect(findByName(target.object, SHADOW_NAME)).not.toBeNull();
    expect(findByName(target.object, RIM_NAME)).not.toBeNull();

    target.userData.pointer = { x: 0.9, y: 0.1 };
    for (let i = 0; i < 20; i++) inst.seek(i * 0.05); // must not throw

    inst.dispose();
    expect(findByName(target.object, SHADOW_NAME)).toBeNull();
    expect(findByName(target.object, RIM_NAME)).toBeNull();
    expect(childMesh.material).toBe(childMaterial);
  });
});
