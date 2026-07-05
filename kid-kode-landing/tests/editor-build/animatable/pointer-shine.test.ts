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
import { pointerShinePrimitive } from '@/lib/prism/animatable/primitives/pointer-shine';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

const OVERLAY_NAME = 'pointer-shine-overlay';

function findOverlay(root: Object3D): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((o) => {
    if (!found && o.name === OVERLAY_NAME) found = o;
  });
  return found;
}

/** A mounted-artifact-shaped target: subject is a GROUP (e.g. the MSDF
 *  'text-object') containing a textured Mesh child — exactly what
 *  bindings.ts hands a pointer primitive in the real app. */
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

interface ShineUniforms {
  uPointer: { value: Vector2 };
  uTime: { value: number };
  uLength: { value: number };
  uIntensity: { value: number };
  uTwinkle: { value: number };
}

describe('pointer-shine primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerShinePrimitive).dispose();
  });

  it('plays: glint time advances and centre tracks the pointer across seeks', () => {
    const target = makeTarget(pointerShinePrimitive);
    const inst = pointerShinePrimitive.create(target);
    const uni = target.userData.pointerShineUniforms as ShineUniforms;

    // Pointer at lower-left at an early frame.
    target.userData.pointer = { x: 0.2, y: 0.3 };
    inst.seek(0);
    const time0 = uni.uTime.value;
    const px0 = uni.uPointer.value.x;
    const py0 = uni.uPointer.value.y;

    // Pointer moved to upper-right at a later frame.
    target.userData.pointer = { x: 0.8, y: 0.7 };
    inst.seek(1.5);
    const timeMid = uni.uTime.value;
    const pxMid = uni.uPointer.value.x;
    const pyMid = uni.uPointer.value.y;

    // Time advanced (twinkle clock moves).
    expect(timeMid).toBeGreaterThan(time0 + 0.5);
    // Glint centre tracked the cursor in both axes.
    expect(pxMid).toBeGreaterThan(px0 + 0.3);
    expect(pyMid).toBeGreaterThan(py0 + 0.3);

    inst.dispose();
  });

  it('controls change output: intensity extremes drive uIntensity differently', () => {
    const target = makeTarget(pointerShinePrimitive);
    const inst = pointerShinePrimitive.create(target);
    const uni = target.userData.pointerShineUniforms as ShineUniforms;

    inst.setControl('intensity', 0);
    inst.seek(0.5);
    const low = uni.uIntensity.value;

    inst.setControl('intensity', 4);
    inst.seek(0.5);
    const high = uni.uIntensity.value;

    expect(high).toBeGreaterThan(low + 3);
    inst.dispose();
  });

  // ── Regression: mounted-artifact safety (advocate "untextured twin quads") ──

  it('REGRESSION: never swaps the subject Mesh material — identical reference before create, during seek, and after dispose', () => {
    const target = makeTarget(pointerShinePrimitive);
    const mesh = target.subject as Mesh;
    const originalMaterial = mesh.material;

    const inst = pointerShinePrimitive.create(target);
    // During create + seek the artifact's baked material must be untouched.
    expect(mesh.material).toBe(originalMaterial);
    target.userData.pointer = { x: 0.3, y: 0.6 };
    inst.seek(0.8);
    expect(mesh.material).toBe(originalMaterial);

    inst.dispose();
    expect(mesh.material).toBe(originalMaterial);
  });

  it('REGRESSION: glint lives on an additive overlay node under the subject while active, removed after dispose', () => {
    const target = makeTarget(pointerShinePrimitive);
    const inst = pointerShinePrimitive.create(target);

    const overlay = findOverlay(target.object);
    expect(overlay, 'overlay exists while active').not.toBeNull();
    // Parented under the subject so it co-moves with the artifact.
    let underSubject = false;
    (target.subject as Object3D).traverse((o) => {
      if (o === overlay) underSubject = true;
    });
    expect(underSubject, 'overlay parented under the subject').toBe(true);

    const overlayMesh = overlay as Mesh;
    expect(overlayMesh.isMesh, 'overlay is a Mesh').toBe(true);
    // Overlay must not occlude the artifact: transparent, no depth writes.
    const mat = overlayMesh.material as { transparent: boolean; depthWrite: boolean };
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    // Mesh subject: the overlay reuses the subject's geometry so the glint
    // hugs the artifact's exact silhouette/uv space.
    expect(overlayMesh.geometry).toBe((target.subject as Mesh).geometry);

    inst.dispose();
    expect(findOverlay(target.object), 'overlay removed after dispose').toBeNull();
  });

  it('REGRESSION: Group subject (text-object) — no crash, no bogus .material on the Group, overlay still created', () => {
    const { target, group, childMesh } = makeGroupSubjectTarget();
    const childMaterial = childMesh.material;

    const inst = pointerShinePrimitive.create(target);

    // The old (target.subject as Mesh) cast silently wrote .material onto the
    // Group — nothing may write that property.
    expect(
      (group as unknown as { material?: unknown }).material,
      'no bogus .material written onto the Group',
    ).toBeUndefined();
    // The glyph mesh inside keeps its baked material.
    expect(childMesh.material).toBe(childMaterial);

    const overlay = findOverlay(target.object);
    expect(overlay, 'overlay created for a Group subject').not.toBeNull();

    target.userData.pointer = { x: 0.9, y: 0.1 };
    inst.seek(1.2); // must not throw

    inst.dispose();
    expect(findOverlay(target.object), 'overlay removed after dispose').toBeNull();
    expect(childMesh.material).toBe(childMaterial);
  });

  it('REGRESSION: exposed uniform handles keep responding to userData.pointer on the overlay path', () => {
    const { target } = makeGroupSubjectTarget();
    const inst = pointerShinePrimitive.create(target);
    const uni = target.userData.pointerShineUniforms as ShineUniforms;

    target.userData.pointer = { x: 0.15, y: 0.85 };
    inst.seek(0.4);
    expect(uni.uPointer.value.x).toBeCloseTo(0.15, 5);
    expect(uni.uPointer.value.y).toBeCloseTo(0.85, 5);
    expect(uni.uTime.value).toBeCloseTo(0.4, 5);

    target.userData.pointer = { x: 0.7, y: 0.25 };
    inst.seek(2.0);
    expect(uni.uPointer.value.x).toBeCloseTo(0.7, 5);
    expect(uni.uPointer.value.y).toBeCloseTo(0.25, 5);
    expect(uni.uTime.value).toBeCloseTo(2.0, 5);

    inst.dispose();
  });
});
