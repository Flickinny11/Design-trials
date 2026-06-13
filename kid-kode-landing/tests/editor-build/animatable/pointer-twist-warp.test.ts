import { describe, it, expect } from 'vitest';
import {
  Color,
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { pointerTwistWarpPrimitive } from '@/lib/prism/animatable/primitives/pointer-twist-warp';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

/** Uniform handles the primitive publishes for headless observability (TSL
 *  vertex/uv work happens on the GPU, so tests read the driven uniforms, the
 *  scene graph, and material identity — the water-droplet pattern). */
interface TwistHandles {
  uAngle: { value: number };
  uCenter: { value: { x: number; y: number } };
  uRadius: { value: number };
  uLift: { value: number };
  uEngage: { value: number };
  uColor: { value: { getHexString(): string } };
}
const handlesOf = (t: AnimatableTarget): TwistHandles =>
  t.userData.pointerTwistWarp as TwistHandles;

/** The overlay sheet mesh anywhere under the root (sibling of the hidden
 *  subject — a hidden parent hides its children, so it can't live under it). */
function sheetOf(root: Object3D): Mesh {
  let found: Mesh | null = null;
  root.traverse((o) => {
    if (o.name === 'pointer-twist-warp-sheet') found = o as Mesh;
  });
  if (!found) throw new Error('twist sheet not found');
  return found;
}

function overlayNodesIn(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o.name.startsWith('pointer-twist-warp')) n++;
  });
  return n;
}

/** A mounted-artifact-like target: a single textured Mesh subject — mirrors how
 *  bindings resolve the mounted subject in the real app (not the catalog rig). */
function makeTexturedTarget(width: number, height: number) {
  const scene = new Scene();
  const object = new Group();
  scene.add(object);
  const texture = new DataTexture(new Uint8Array([200, 160, 90, 255]), 1, 1, RGBAFormat);
  texture.needsUpdate = true;
  const subject = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({ map: texture }),
  );
  subject.name = 'artifact-mesh';
  object.add(subject);
  const target: AnimatableTarget = {
    object,
    subject,
    scene,
    userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
  };
  return { target, subject, texture };
}

/** Drive the engagement envelope to its steady state at a fixed pointer by
 *  seeking repeatedly with a small dt — the damped envelope converges. */
function settle(inst: { seek: (t: number) => void }, from = 0, steps = 60, dt = 0.05) {
  for (let i = 0; i <= steps; i++) inst.seek(from + i * dt);
}

describe('pointer-twist-warp primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerTwistWarpPrimitive).dispose();
  });

  it('is a mountable, texture-preserving displacement primitive', () => {
    expect(pointerTwistWarpPrimitive.category).toBe('displacement');
    expect(pointerTwistWarpPrimitive.mountable).toBe(true);
    expect(pointerTwistWarpPrimitive.subject).toBe('card');
    expect(pointerTwistWarpPrimitive.defaultDriver).toBe('pointer');
    // Stateful pointer tile — never ends.
    const target = makeTarget(pointerTwistWarpPrimitive);
    const inst = pointerTwistWarpPrimitive.create(target);
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('idle (pointer disengaged) leaves the surface essentially undistorted, then a near pointer wrings it', () => {
    // Catalog CARD subject: a 1.74 x 1.12 panel + chrome children. The sheet
    // carries the panel footprint; the subject is hidden while it stands in.
    const target = makeTarget(pointerTwistWarpPrimitive);
    const inst = pointerTwistWarpPrimitive.create(target);
    const ud = handlesOf(target);

    const sheet = sheetOf(target.scene);
    sheet.geometry.computeBoundingBox();
    const bb = sheet.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(1.74, 2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(1.12, 2);
    expect((target.subject as Mesh).visible).toBe(false);

    // Idle: pointer parked at center but DISENGAGED — the rig pins the idle
    // frame at t=0 with the pointer off the subject. We model disengagement as
    // a far/parked pointer; engagement must decay to ~0 so the card is legible.
    target.userData.pointer = { x: -5, y: -5 }; // far away = disengaged
    settle(inst, 0);
    expect(ud.uEngage.value).toBeLessThan(0.05);
    expect(Math.abs(ud.uAngle.value)).toBeLessThan(0.02);

    // Engage: pointer lands ON the subject near center — the vortex builds and
    // the effective twist angle becomes non-trivial.
    target.userData.pointer = { x: 0.62, y: 0.5 };
    settle(inst, 5);
    expect(ud.uEngage.value).toBeGreaterThan(0.8);
    expect(Math.abs(ud.uAngle.value)).toBeGreaterThan(0.3);
    // The vortex center tracks the pointer's subject-local position (x mapped
    // around the panel center; 0.62 → just right of center).
    expect(ud.uCenter.value.x).toBeGreaterThan(0);

    inst.dispose();
  });

  it('distortion response: a stronger pointer engagement / strength yields a larger twist angle', () => {
    const target = makeTarget(pointerTwistWarpPrimitive);
    const inst = pointerTwistWarpPrimitive.create(target);
    const ud = handlesOf(target);

    target.userData.pointer = { x: 0.62, y: 0.5 };

    // Weak strength → small settled angle.
    inst.setControl('strength', 0.2);
    settle(inst, 0);
    const weak = Math.abs(ud.uAngle.value);

    // Strong strength → larger settled angle, same engaged pointer.
    inst.setControl('strength', 1.4);
    settle(inst, 5);
    const strong = Math.abs(ud.uAngle.value);

    expect(strong).toBeGreaterThan(weak + 0.3);
  });

  it('controls reshape the frame at the PINNED engaged state (t held, repeated seeks)', () => {
    const target = makeTarget(pointerTwistWarpPrimitive);
    const inst = pointerTwistWarpPrimitive.create(target);
    const ud = handlesOf(target);

    // Pin the rig's engaged pointer and settle the envelope.
    target.userData.pointer = { x: 0.62, y: 0.5 };
    settle(inst, 0);
    const tHeld = 3; // a fixed wall-clock instant the rig holds during a sweep
    inst.seek(tHeld);
    expect(ud.uEngage.value).toBeGreaterThan(0.8);

    // RADIUS: onParamChange must re-apply at the held seek state. Larger radius
    // = wider vortex uniform, visibly reshaping the frame without a re-seek.
    inst.setControl('radius', 0.3);
    const rSmall = ud.uRadius.value;
    inst.setControl('radius', 0.9);
    const rLarge = ud.uRadius.value;
    expect(rLarge).toBeGreaterThan(rSmall);

    // CORE LIFT: changes the z-lift uniform at the pinned state.
    inst.setControl('lift', 0);
    expect(ud.uLift.value).toBeCloseTo(0, 6);
    inst.setControl('lift', 0.4);
    expect(ud.uLift.value).toBeGreaterThan(0.05);

    // STRENGTH: re-applies the twist angle at the held state (no re-seek).
    inst.setControl('strength', 0.2);
    const aWeak = Math.abs(ud.uAngle.value);
    inst.setControl('strength', 1.6);
    const aStrong = Math.abs(ud.uAngle.value);
    expect(aStrong).toBeGreaterThan(aWeak + 0.3);

    inst.dispose();
  });

  it('untwist damping: a higher damping control unwinds the vortex faster after the pointer leaves', () => {
    const measureReturn = (damping: number): number => {
      const target = makeTarget(pointerTwistWarpPrimitive);
      const inst = pointerTwistWarpPrimitive.create(target);
      const ud = handlesOf(target);
      inst.setControl('damping', damping);

      // Engage and settle the vortex (lower damping converges slower, so use a
      // long settle and a tolerant floor — the engaged vortex is clearly on).
      target.userData.pointer = { x: 0.62, y: 0.5 };
      settle(inst, 0, 120);
      const engaged = ud.uEngage.value;
      expect(engaged).toBeGreaterThan(0.7);

      // Pointer leaves: run a FIXED short window of seeks; higher damping
      // unwinds engagement further within the same window.
      target.userData.pointer = { x: -5, y: -5 };
      let t = 4;
      for (let i = 0; i < 6; i++) {
        t += 0.05;
        inst.seek(t);
      }
      const remaining = ud.uEngage.value;
      inst.dispose();
      return remaining;
    };

    const slow = measureReturn(1);
    const fast = measureReturn(8);
    // Faster damping leaves less residual twist after the same return window.
    expect(fast).toBeLessThan(slow);
  });

  it('texture preservation: the overlay samples the subject OWN texture by reference (never an invented fill)', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    const inst = pointerTwistWarpPrimitive.create(target);
    const sheet = sheetOf(target.scene);

    const colorNode = (sheet.material as Material & { colorNode?: { value?: unknown } })
      .colorNode;
    expect(colorNode?.value, 'colorNode samples the shared texture').toBe(texture);
    expect(sheet.material, 'sheet material is its own instance').not.toBe(subject.material);

    // The subject's own material is never mutated.
    expect((subject.material as MeshBasicMaterial).map).toBe(texture);
    expect((subject.material as MeshBasicMaterial).opacity).toBe(1);

    // Sheet geometry derives from the measured bbox (2 x 1, not the catalog).
    sheet.geometry.computeBoundingBox();
    const bb = sheet.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(2, 2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(1, 2);

    inst.dispose();
  });

  it('texture preservation: a map-less subject copies color + PBR scalars onto the node material (no flat invention)', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Mesh(
      new PlaneGeometry(2, 1),
      new MeshBasicMaterial({ color: '#88aa66' }), // no map
    );
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    };

    const inst = pointerTwistWarpPrimitive.create(target);
    const ud = handlesOf(target);
    expect(ud.uColor.value.getHexString()).toBe('88aa66');

    // Live tint tracking: recolor the source, seek, fallback follows.
    (subject.material as MeshBasicMaterial).color.set('#cd9f55');
    inst.seek(0.2);
    expect(ud.uColor.value.getHexString()).toBe('cd9f55');

    inst.dispose();
  });

  it('regression: a texture poured AFTER create reaches the overlay (async map pour → material rebuild)', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Mesh(
      new PlaneGeometry(2, 1),
      new MeshBasicMaterial({ transparent: true }),
    );
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    };

    const inst = pointerTwistWarpPrimitive.create(target);
    const sheet = sheetOf(scene);
    const matBefore = sheet.material as Material;

    // The pour lands on the subject's material (what default-factory does).
    const texture = new DataTexture(new Uint8Array([200, 160, 90, 255]), 1, 1, RGBAFormat);
    texture.needsUpdate = true;
    (subject.material as MeshBasicMaterial).map = texture;
    (subject.material as MeshBasicMaterial).needsUpdate = true;

    inst.seek(0.4);
    expect(sheet.material, 'material rebuilt for the poured texture').not.toBe(matBefore);
    const colorNode = (sheet.material as Material & { colorNode?: { value?: unknown } })
      .colorNode;
    expect(colorNode?.value, 'rebuilt colorNode samples the poured texture').toBe(texture);

    // Dispose never touches the subject's shared texture.
    let texDisposed = 0;
    texture.addEventListener('dispose', () => texDisposed++);
    inst.dispose();
    expect(texDisposed).toBe(0);
    expect((subject.material as MeshBasicMaterial).map).toBe(texture);
  });

  it('chrome co-treatment: the card chrome children become rigid clones posed by the field, subject chrome never mutated', () => {
    const target = makeTarget(pointerTwistWarpPrimitive);
    const inst = pointerTwistWarpPrimitive.create(target);

    const clones: Mesh[] = [];
    target.scene.traverse((o) => {
      if (o.name.startsWith('pointer-twist-warp-chrome:')) clones.push(o as Mesh);
    });
    // header + 3 content rows + dot = 5 chrome meshes ride the field.
    expect(clones.length, 'chrome children become clones').toBeGreaterThanOrEqual(4);

    // Clones share each child's geometry BY REFERENCE; the material is a clone.
    const subjectPanel = target.subject as Mesh;
    let srcDot: Mesh | undefined;
    subjectPanel.traverse((o) => {
      if (o.name === 'card-dot') srcDot = o as Mesh;
    });
    expect(srcDot).toBeDefined();
    const dotClone = clones.find((m) => m.name.includes('card-dot'));
    expect(dotClone).toBeDefined();
    expect(dotClone!.geometry, 'clone geometry shared by reference').toBe(srcDot!.geometry);
    expect(dotClone!.material).not.toBe(srcDot!.material);

    // A chrome clone OFF the vortex center visibly cocks (rotates) when engaged.
    target.userData.pointer = { x: 0.62, y: 0.5 };
    settle(inst, 0);
    const movers = clones.filter((m) => Math.abs(m.rotation.z) > 1e-3);
    expect(movers.length, 'at least one chrome clone cocks under the vortex').toBeGreaterThan(0);

    // Subject chrome materials are NEVER mutated.
    subjectPanel.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || m === subjectPanel) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        expect(
          (mat as Material & { positionNode?: unknown }).positionNode,
          'subject chrome material untouched',
        ).toBeUndefined();
        expect((mat as Material & { opacity: number }).opacity).toBe(1);
      }
    });

    inst.dispose();
  });

  it('dispose restores the subject and releases everything created (never subject resources)', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    expect(subject.visible).toBe(true);

    const inst = pointerTwistWarpPrimitive.create(target);
    const sheet = sheetOf(target.scene);
    expect(subject.visible, 'subject hidden while the sheet stands in').toBe(false);

    let createdDisposed = 0;
    sheet.geometry.addEventListener('dispose', () => createdDisposed++);
    (sheet.material as Material).addEventListener('dispose', () => createdDisposed++);
    let subjectDisposed = 0;
    (subject.material as Material).addEventListener('dispose', () => subjectDisposed++);
    texture.addEventListener('dispose', () => subjectDisposed++);

    target.userData.pointer = { x: 0.62, y: 0.5 };
    inst.seek(0.7);
    inst.dispose();

    expect(subject.visible, 'subject restored after dispose').toBe(true);
    expect(createdDisposed, 'sheet geometry + material both disposed').toBe(2);
    expect(subjectDisposed, 'subject material/texture never disposed').toBe(0);
    expect(overlayNodesIn(target.scene), 'nothing of ours left in the tree').toBe(0);
  });

  it('fallback: with no usable geometry/material it twists the WHOLE subject down rigidly — nothing spawned, restored on dispose', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Group(); // no meshes, no materials — nothing to overlay
    subject.name = 'empty-artifact';
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    };

    const inst = pointerTwistWarpPrimitive.create(target);
    expect(overlayNodesIn(scene), 'no overlay spawned for an empty subject').toBe(0);
    expect(subject.visible, 'fallback never hides the subject it animates').toBe(true);

    // Engaged pointer rotates the whole group; disengaged unwinds to base.
    target.userData.pointer = { x: 0.62, y: 0.5 };
    settle(inst, 0);
    const engagedRot = subject.rotation.z;
    expect(Math.abs(engagedRot), 'whole subject twists under the vortex').toBeGreaterThan(0.05);

    target.userData.pointer = { x: -5, y: -5 };
    settle(inst, 5);
    expect(subject.rotation.z, 'unwinds toward base when disengaged').toBeCloseTo(0, 2);

    inst.dispose();
    expect(subject.rotation.z, 'rotation restored after dispose').toBeCloseTo(0, 6);
  });

  it('guards non-finite pointer input (no NaN propagation)', () => {
    const target = makeTarget(pointerTwistWarpPrimitive);
    const inst = pointerTwistWarpPrimitive.create(target);
    const ud = handlesOf(target);

    target.userData.pointer = { x: Number.NaN, y: Number.POSITIVE_INFINITY };
    inst.seek(0.1);
    inst.seek(0.2);
    expect(Number.isFinite(ud.uAngle.value)).toBe(true);
    expect(Number.isFinite(ud.uEngage.value)).toBe(true);
    expect(Number.isFinite(ud.uCenter.value.x)).toBe(true);

    inst.dispose();
  });
});

// Silence unused-import lint when adjusting the test surface.
void Color;
