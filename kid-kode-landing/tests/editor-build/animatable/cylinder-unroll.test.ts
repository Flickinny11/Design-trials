import { describe, it, expect } from 'vitest';
import {
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { cylinderUnrollPrimitive } from '@/lib/prism/animatable/primitives/cylinder-unroll';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

/** Uniform handles the primitive publishes for headless observability (the
 *  water-droplet pattern — TSL vertex work happens on the GPU, so tests
 *  observe the driven uniforms, the scene graph, and material identity). */
interface UnrollHandles {
  uFront: { value: number };
  uRadius: { value: number };
  uOver: { value: number };
  uAxis: { value: number };
  uStart: { value: number };
  uDirSign: { value: number };
  uSpan: { value: number };
  uColor: { value: { getHexString(): string } };
}
const handlesOf = (t: AnimatableTarget): UnrollHandles =>
  t.userData.cylinderUnroll as UnrollHandles;

/** The overlay sheet mesh anywhere under the root (sibling of the hidden
 *  subject — a hidden parent hides its children, so it can't live under it). */
function sheetOf(root: Object3D): Mesh {
  let found: Mesh | null = null;
  root.traverse((o) => {
    if (o.name === 'cylinder-unroll-sheet') found = o as Mesh;
  });
  if (!found) throw new Error('unroll sheet not found');
  return found;
}

function overlayNodesIn(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o.name === 'cylinder-unroll-overlay' || o.name === 'cylinder-unroll-sheet') n++;
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

describe('cylinder-unroll primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(cylinderUnrollPrimitive).dispose();
  });

  it('plays: the unroll front sweeps the span over the duration and the curl overshoot settles flat', () => {
    // Catalog plane subject: 1.8 x 1.8 local units, no texture map.
    const target = makeTarget(cylinderUnrollPrimitive);
    const inst = cylinderUnrollPrimitive.create(target);
    const ud = handlesOf(target);
    const dur = inst.duration();
    expect(Number.isFinite(dur)).toBe(true);

    // The sheet exists, sized from the MEASURED subject bbox, and the subject
    // is hidden while the sheet stands in for it.
    const sheet = sheetOf(target.scene);
    sheet.geometry.computeBoundingBox();
    const bb = sheet.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(1.8, 2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(1.8, 2);
    expect((target.subject as Mesh).visible).toBe(false);

    // t ~ 0: fully rolled — the front has not left the start edge.
    inst.seek(0.01 * dur);
    expect(ud.uSpan.value).toBeCloseTo(1.8, 5);
    expect(ud.uFront.value).toBeLessThan(0.05);
    const frontEarly = ud.uFront.value;

    // Mid-timeline: the front is mid-sweep across the 1.8 span.
    inst.seek(0.5 * dur);
    expect(ud.uFront.value).toBeGreaterThan(0.8);
    expect(ud.uFront.value).toBeLessThan(1.7);
    expect(ud.uFront.value).toBeGreaterThan(frontEarly + 0.5);

    // Late: the sheet is laid (front past the span) and the paper-curl
    // overshoot dip is ACTIVE (negative z bow of the far edge).
    inst.seek(0.91 * dur);
    expect(ud.uFront.value).toBeCloseTo(1.8, 5);
    expect(ud.uOver.value).toBeLessThan(-0.02);

    // End: exactly flat — front at full span, overshoot settled to zero.
    inst.seek(dur);
    expect(ud.uFront.value).toBeCloseTo(1.8, 5);
    expect(ud.uOver.value).toBeCloseTo(0, 6);

    inst.dispose();
  });

  it('controls change output: radius scales the cylinder, direction remaps the travel axis, duration moves the front at fixed t', () => {
    const target = makeTarget(cylinderUnrollPrimitive);
    const inst = cylinderUnrollPrimitive.create(target);
    const ud = handlesOf(target);
    inst.seek(1); // establish a live time so control tweaks re-apply at it

    // Roll radius is a FRACTION of the span (scale-free): min vs max.
    inst.setControl('radius', 0.05);
    expect(ud.uRadius.value).toBeCloseTo(0.05 * 1.8, 5);
    inst.setControl('radius', 0.35);
    expect(ud.uRadius.value).toBeCloseTo(0.35 * 1.8, 5);

    // Direction remaps the travel axis uniforms without a rebuild.
    expect(ud.uAxis.value).toBe(0); // default 'left': travel along local x
    expect(ud.uDirSign.value).toBe(1);
    expect(ud.uStart.value).toBeCloseTo(-0.9, 5);
    inst.setControl('direction', 'top');
    expect(ud.uAxis.value).toBe(1); // travel along local y
    expect(ud.uDirSign.value).toBe(-1); // start edge at +h/2
    expect(ud.uStart.value).toBeCloseTo(0.9, 5);
    expect(ud.uSpan.value).toBeCloseTo(1.8, 5);
    inst.setControl('direction', 'left');

    // Duration: at the same wall-clock t, a short run is flat, a long run is
    // still mostly rolled.
    inst.setControl('duration', 0.6);
    inst.seek(1);
    expect(ud.uFront.value).toBeCloseTo(1.8, 5);
    inst.setControl('duration', 5);
    inst.seek(1);
    expect(ud.uFront.value).toBeLessThan(0.9);

    inst.dispose();
  });

  it("honest look: the sheet's colorNode samples the subject's OWN texture by reference (never an invented fill)", () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    const inst = cylinderUnrollPrimitive.create(target);
    const sheet = sheetOf(target.scene);

    const colorNode = (sheet.material as Material & { colorNode?: { value?: unknown } })
      .colorNode;
    expect(colorNode?.value, 'colorNode samples the shared texture').toBe(texture);
    expect(sheet.material, 'sheet material is its own instance').not.toBe(subject.material);

    // The subject's own material was never mutated.
    expect((subject.material as MeshBasicMaterial).map).toBe(texture);
    expect((subject.material as MeshBasicMaterial).opacity).toBe(1);

    // Sheet geometry derives from the measured bbox (2 x 1, not the catalog 1.8).
    sheet.geometry.computeBoundingBox();
    const bb = sheet.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(2, 2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(1, 2);
    const ud = handlesOf(target);
    inst.seek(0.01);
    expect(ud.uSpan.value).toBeCloseTo(2, 5);

    inst.dispose();
  });

  it("honest look: a map-less subject falls back to the subject material's color, tracked live", () => {
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

    const inst = cylinderUnrollPrimitive.create(target);
    const ud = handlesOf(target);
    expect(ud.uColor.value.getHexString()).toBe('88aa66');

    // Live tint tracking: recolor the source, seek, fallback follows.
    (subject.material as MeshBasicMaterial).color.set('#cd9f55');
    inst.seek(0.2);
    expect(ud.uColor.value.getHexString()).toBe('cd9f55');

    inst.dispose();
  });

  it('regression: a texture poured AFTER create reaches the sheet (async map pour → material rebuild)', () => {
    // Mounted-artifact shape at attach time: map-LESS mesh; the factory pours
    // `.map` later in loadTexture().then().
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

    const inst = cylinderUnrollPrimitive.create(target);
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

    // A whole-material swap (applyImageSpec upgrade) also rebinds.
    const texture2 = new DataTexture(new Uint8Array([90, 160, 200, 255]), 1, 1, RGBAFormat);
    texture2.needsUpdate = true;
    subject.material = new MeshBasicMaterial({ map: texture2, transparent: true });
    inst.seek(0.5);
    const colorNode2 = (sheet.material as Material & { colorNode?: { value?: unknown } })
      .colorNode;
    expect(colorNode2?.value).toBe(texture2);

    // Stability: with no further source change, seeks do NOT rebuild.
    const stable = sheet.material;
    inst.seek(0.6);
    expect(sheet.material).toBe(stable);

    // Dispose never touches the subject's shared texture.
    let texDisposed = 0;
    texture2.addEventListener('dispose', () => texDisposed++);
    inst.dispose();
    expect(texDisposed).toBe(0);
    expect((subject.material as MeshBasicMaterial).map).toBe(texture2);
  });

  it('regression: the overlay tracks the subject LIVE local pose each seek (co-bindings tilt the hidden subject)', () => {
    const { target, subject } = makeTexturedTarget(2, 1);
    const inst = cylinderUnrollPrimitive.create(target);
    let overlay: Object3D | null = null;
    target.scene.traverse((o) => {
      if (o.name === 'cylinder-unroll-overlay') overlay = o;
    });
    expect(overlay).not.toBeNull();
    const grp = overlay as unknown as Group;

    subject.position.set(0.4, -0.2, 0.64);
    subject.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -0.122);
    subject.scale.set(1.1, 1.1, 1);
    inst.seek(0.3);

    expect(grp.position.x).toBeCloseTo(0.4, 6);
    expect(grp.position.y).toBeCloseTo(-0.2, 6);
    expect(grp.position.z).toBeCloseTo(0.64, 6);
    expect(grp.quaternion.x).toBeCloseTo(subject.quaternion.x, 6);
    expect(grp.quaternion.w).toBeCloseTo(subject.quaternion.w, 6);
    expect(grp.scale.x).toBeCloseTo(1.1, 6);

    // It keeps tracking.
    subject.position.set(-0.3, 0.1, 0.2);
    inst.seek(0.31);
    expect(grp.position.x).toBeCloseTo(-0.3, 6);

    inst.dispose();
  });

  it('dispose restores the subject and releases everything created (never subject resources)', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    expect(subject.visible).toBe(true);

    const inst = cylinderUnrollPrimitive.create(target);
    const sheet = sheetOf(target.scene);
    expect(subject.visible, 'subject hidden while the sheet stands in').toBe(false);

    let createdDisposed = 0;
    sheet.geometry.addEventListener('dispose', () => createdDisposed++);
    (sheet.material as Material).addEventListener('dispose', () => createdDisposed++);
    let subjectDisposed = 0;
    (subject.material as Material).addEventListener('dispose', () => subjectDisposed++);
    texture.addEventListener('dispose', () => subjectDisposed++);

    inst.seek(0.7);
    inst.dispose();

    expect(subject.visible, 'subject restored after dispose').toBe(true);
    expect(createdDisposed, 'sheet geometry + material both disposed').toBe(2);
    expect(subjectDisposed, 'subject material/texture never disposed').toBe(0);
    expect(overlayNodesIn(target.scene), 'nothing of ours left in the tree').toBe(0);
  });

  it('fallback: with no usable geometry/material it lays the WHOLE subject down — nothing spawned, restored on dispose', () => {
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

    const inst = cylinderUnrollPrimitive.create(target);
    expect(overlayNodesIn(scene), 'no overlay spawned for an empty subject').toBe(0);
    expect(subject.visible, 'fallback never hides the subject it animates').toBe(true);

    const dur = inst.duration();
    inst.seek(0.02 * dur);
    const rotEarly = subject.rotation.x;
    inst.seek(dur);
    const rotEnd = subject.rotation.x;
    expect(Math.abs(rotEarly - rotEnd), 'whole subject lays down across the timeline').toBeGreaterThan(0.5);
    expect(rotEnd, 'settles at the base pose by the end').toBeCloseTo(0, 5);

    inst.seek(0.3 * dur);
    inst.dispose();
    expect(subject.rotation.x, 'rotation restored after dispose').toBeCloseTo(0, 6);
  });
});
