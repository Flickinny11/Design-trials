import { describe, it, expect } from 'vitest';
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  Vector2,
  type Object3D,
} from 'three';
import { proximityRimGlowPrimitive } from '@/lib/prism/animatable/primitives/proximity-rim-glow';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

const OVERLAY_NAME = 'proximity-rim-glow-overlay';

function findOverlay(root: Object3D): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((o) => {
    if (!found && o.name === OVERLAY_NAME) found = o;
  });
  return found;
}

interface RimUniforms {
  uProximity: { value: number };
  uPower: { value: number };
  uIntensity: { value: number };
  uBias: { value: number };
  uPointerDir: { value: Vector2 };
  uTime: { value: number };
}

/** A mounted-artifact-shaped target: subject is a GROUP (e.g. the MSDF
 *  'text-object') containing a textured Mesh child — exactly what bindings.ts
 *  hands a pointer primitive in the real app. */
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

describe('proximity-rim-glow primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(proximityRimGlowPrimitive).dispose();
  });

  it('is a pointer-driven card primitive with Infinity duration', () => {
    expect(proximityRimGlowPrimitive.category).toBe('pointer');
    expect(proximityRimGlowPrimitive.defaultDriver).toBe('pointer');
    expect(proximityRimGlowPrimitive.subject).toBe('card');
    const target = makeTarget(proximityRimGlowPrimitive);
    const inst = proximityRimGlowPrimitive.create(target);
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  // ── Physics response across a moving pointer (concrete numerics) ───────────

  it('plays: proximity rises as the pointer nears center and the card leans toward the cursor across seeks', () => {
    const target = makeTarget(proximityRimGlowPrimitive);
    const inst = proximityRimGlowPrimitive.create(target);
    const uni = target.userData.proximityRimGlowUniforms as RimUniforms;
    const obj = target.object;

    // Frame 0: pointer far from center (lower-left corner) → low proximity.
    target.userData.pointer = { x: 0.05, y: 0.05 };
    inst.seek(0);
    inst.seek(0.2);
    const proxFar = uni.uProximity.value;

    // Frame later: pointer parked AT center → proximity saturates near 1.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    for (let i = 1; i <= 12; i++) inst.seek(0.2 + i * 0.05);
    const proxNear = uni.uProximity.value;

    expect(proxNear).toBeGreaterThan(proxFar + 0.3);
    expect(proxNear).toBeLessThanOrEqual(1.0001);
    expect(proxFar).toBeGreaterThanOrEqual(0);

    // Time advanced → breathing clock moved.
    expect(uni.uTime.value).toBeGreaterThan(0.5);

    // Whole-card lean: an engaged pointer to the right of center yaws the card
    // one way, left yaws it the other. Settle each pose with repeated seeks.
    target.userData.pointer = { x: 0.74, y: 0.5 };
    let tt = 1.0;
    for (let i = 0; i < 40; i++) inst.seek((tt += 0.05));
    const yawRight = obj.rotation.y;

    target.userData.pointer = { x: 0.26, y: 0.5 };
    for (let i = 0; i < 40; i++) inst.seek((tt += 0.05));
    const yawLeft = obj.rotation.y;

    expect(Math.abs(yawRight - yawLeft)).toBeGreaterThan(0.01);
    // Lean stays subtle (≤ ~5° at default, well inside the tile frame).
    expect(Math.abs(yawRight)).toBeLessThan(0.12);
    expect(Math.abs(yawLeft)).toBeLessThan(0.12);

    inst.dispose();
  });

  it('directional bias: the pointer-offset direction is tracked into uPointerDir as the cursor moves', () => {
    const target = makeTarget(proximityRimGlowPrimitive);
    const inst = proximityRimGlowPrimitive.create(target);
    const uni = target.userData.proximityRimGlowUniforms as RimUniforms;

    // Pointer to the right of center → bias direction points +x.
    target.userData.pointer = { x: 0.9, y: 0.5 };
    inst.seek(0.1);
    expect(uni.uPointerDir.value.x).toBeGreaterThan(0.5);

    // Pointer above center → bias direction points +y.
    target.userData.pointer = { x: 0.5, y: 0.9 };
    inst.seek(0.2);
    expect(uni.uPointerDir.value.y).toBeGreaterThan(0.5);

    inst.dispose();
  });

  // ── Controls reshape the frame at the pinned ENGAGED state {0.62, 0.5} ─────

  it('controls change output at the pinned engaged state {0.62,0.5}', () => {
    const target = makeTarget(proximityRimGlowPrimitive);
    const inst = proximityRimGlowPrimitive.create(target);
    const uni = target.userData.proximityRimGlowUniforms as RimUniforms;

    // Pin the rig pointer at the engaged point the harness uses; settle the pose.
    target.userData.pointer = { x: 0.62, y: 0.5 };
    const settle = (n: number, t0: number) => {
      for (let i = 0; i < n; i++) inst.seek(t0 + i * 0.05);
    };
    settle(20, 0);

    // Engaged: proximity must be visibly lit at the pinned state.
    expect(uni.uProximity.value).toBeGreaterThan(0.2);

    // intensity reshapes the frame (re-seek at the SAME pinned t).
    inst.setControl('intensity', 0.2);
    inst.seek(1.0);
    const lowI = uni.uIntensity.value;
    inst.setControl('intensity', 3);
    inst.seek(1.0);
    const highI = uni.uIntensity.value;
    expect(highI).toBeGreaterThan(lowI + 2);

    // rimTightness (power) reshapes the frame.
    inst.setControl('rimTightness', 1);
    inst.seek(1.0);
    const lowP = uni.uPower.value;
    inst.setControl('rimTightness', 6);
    inst.seek(1.0);
    const highP = uni.uPower.value;
    expect(highP).toBeGreaterThan(lowP + 3);

    // directionalBias reshapes the frame.
    inst.setControl('directionalBias', 0);
    inst.seek(1.0);
    const lowB = uni.uBias.value;
    inst.setControl('directionalBias', 1);
    inst.seek(1.0);
    const highB = uni.uBias.value;
    expect(highB).toBeGreaterThan(lowB + 0.5);

    // proximityRange reshapes the engaged proximity (wider range → brighter at
    // the same pinned engaged offset).
    inst.setControl('proximityRange', 0.2);
    settle(20, 2.0);
    const proxTight = uni.uProximity.value;
    inst.setControl('proximityRange', 0.9);
    settle(20, 4.0);
    const proxWide = uni.uProximity.value;
    expect(proxWide).toBeGreaterThan(proxTight);

    inst.dispose();
  });

  it('onParamChange re-applies the pose at the last seek state (no re-seek needed)', () => {
    const target = makeTarget(proximityRimGlowPrimitive);
    const inst = proximityRimGlowPrimitive.create(target);
    const uni = target.userData.proximityRimGlowUniforms as RimUniforms;

    target.userData.pointer = { x: 0.62, y: 0.5 };
    for (let i = 0; i < 20; i++) inst.seek(i * 0.05);

    // setControl alone (no following seek) must update the live uniform.
    inst.setControl('intensity', 0.4);
    const beforeI = uni.uIntensity.value;
    inst.setControl('intensity', 2.8);
    expect(uni.uIntensity.value).toBeGreaterThan(beforeI + 2);
    inst.setControl('rimTightness', 5.5);
    expect(uni.uPower.value).toBeGreaterThan(5);

    inst.dispose();
  });

  // ── Settle / restore-home: disengaged pointer relaxes the lean to base ─────

  it('settles home: a disengaged pointer relaxes the card lean back toward rest', () => {
    const target = makeTarget(proximityRimGlowPrimitive);
    const inst = proximityRimGlowPrimitive.create(target);
    const obj = target.object;
    const baseYaw = obj.rotation.y;

    // Engage to one side at a clearly-engaged offset.
    target.userData.pointer = { x: 0.74, y: 0.5 };
    let tt = 0;
    for (let i = 0; i < 40; i++) inst.seek((tt += 0.05));
    const engagedYaw = obj.rotation.y;
    expect(Math.abs(engagedYaw - baseYaw)).toBeGreaterThan(0.01);

    // Disengage to a far corner; proximity → 0 → the lean relaxes back to base.
    target.userData.pointer = { x: 0.02, y: 0.02 };
    for (let i = 0; i < 80; i++) inst.seek((tt += 0.05));
    const relaxedYaw = obj.rotation.y;
    expect(Math.abs(relaxedYaw - baseYaw)).toBeLessThan(Math.abs(engagedYaw - baseYaw));
    expect(Math.abs(relaxedYaw - baseYaw)).toBeLessThan(0.02);

    inst.dispose();
  });

  it('idle frame (t=0, disengaged): subject is fully legible — no lean, glow off, material untouched', () => {
    const target = makeTarget(proximityRimGlowPrimitive);
    const mesh = target.subject as Mesh;
    const originalMaterial = mesh.material;
    const inst = proximityRimGlowPrimitive.create(target);
    const uni = target.userData.proximityRimGlowUniforms as RimUniforms;

    // Disengaged idle frame at the very first seek.
    target.userData.pointer = { x: 1.0, y: 1.0 }; // far corner → disengaged
    inst.seek(0);
    // Card sits at home pose (no accumulated lean on the first frame).
    expect(target.object.rotation.x).toBeCloseTo(0, 4);
    expect(target.object.rotation.y).toBeCloseTo(0, 4);
    // Proximity reads ~0 when disengaged → rim glow contributes nothing.
    expect(uni.uProximity.value).toBeLessThan(0.05);
    // The subject's own baked material is untouched.
    expect(mesh.material).toBe(originalMaterial);

    inst.dispose();
  });

  // ── Additive overlay discipline (pointer-shine pattern) ────────────────────

  it('REGRESSION: never swaps the subject material — identical reference before/during/after', () => {
    const target = makeTarget(proximityRimGlowPrimitive);
    const mesh = target.subject as Mesh;
    const originalMaterial = mesh.material;

    const inst = proximityRimGlowPrimitive.create(target);
    expect(mesh.material).toBe(originalMaterial);
    target.userData.pointer = { x: 0.62, y: 0.5 };
    inst.seek(0.8);
    expect(mesh.material).toBe(originalMaterial);

    inst.dispose();
    expect(mesh.material).toBe(originalMaterial);
  });

  it('REGRESSION: rim lives on an additive overlay under the subject — transparent, depthWrite off, removed on dispose', () => {
    const target = makeTarget(proximityRimGlowPrimitive);
    const inst = proximityRimGlowPrimitive.create(target);

    const overlay = findOverlay(target.object) as Mesh | null;
    expect(overlay, 'overlay exists while active').not.toBeNull();
    let underSubject = false;
    (target.subject as Object3D).traverse((o) => {
      if (o === overlay) underSubject = true;
    });
    expect(underSubject, 'overlay parented under the subject').toBe(true);

    const mat = (overlay as Mesh).material as { transparent: boolean; depthWrite: boolean };
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);

    inst.dispose();
    expect(findOverlay(target.object), 'overlay removed after dispose').toBeNull();
  });

  it('REGRESSION: Group subject (text-object) — no crash, no bogus .material on the Group, overlay created and removed', () => {
    const { target, group, childMesh } = makeGroupSubjectTarget();
    const childMaterial = childMesh.material;

    const inst = proximityRimGlowPrimitive.create(target);

    expect(
      (group as unknown as { material?: unknown }).material,
      'no bogus .material written onto the Group',
    ).toBeUndefined();
    expect(childMesh.material).toBe(childMaterial);

    const overlay = findOverlay(target.object);
    expect(overlay, 'overlay created for a Group subject').not.toBeNull();

    target.userData.pointer = { x: 0.9, y: 0.1 };
    inst.seek(1.2); // must not throw

    inst.dispose();
    expect(findOverlay(target.object), 'overlay removed after dispose').toBeNull();
    expect(childMesh.material).toBe(childMaterial);
  });

  it('REGRESSION: dispose restores everything (lean + overlay) and is idempotent', () => {
    const target = makeTarget(proximityRimGlowPrimitive);
    const obj = target.object;
    const baseRotX = obj.rotation.x;
    const baseRotY = obj.rotation.y;

    const inst = proximityRimGlowPrimitive.create(target);
    target.userData.pointer = { x: 0.9, y: 0.9 };
    for (let i = 0; i < 20; i++) inst.seek(i * 0.05);

    inst.dispose();
    expect(obj.rotation.x).toBeCloseTo(baseRotX, 4);
    expect(obj.rotation.y).toBeCloseTo(baseRotY, 4);
    expect(findOverlay(target.object)).toBeNull();
    // Second dispose must not throw.
    expect(() => inst.dispose()).not.toThrow();
  });

  it('non-finite pointer is guarded — no NaN leaks into the lean or proximity', () => {
    const target = makeTarget(proximityRimGlowPrimitive);
    const inst = proximityRimGlowPrimitive.create(target);
    const uni = target.userData.proximityRimGlowUniforms as RimUniforms;

    target.userData.pointer = { x: NaN, y: Infinity };
    inst.seek(0.5);
    inst.seek(0.7);
    expect(Number.isFinite(uni.uProximity.value)).toBe(true);
    expect(Number.isFinite(target.object.rotation.y)).toBe(true);
    expect(Number.isFinite(uni.uPointerDir.value.x)).toBe(true);

    inst.dispose();
  });
});
