import { describe, it, expect } from 'vitest';
import {
  Group,
  Mesh,
  Scene,
  Texture,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { genieSuckPrimitive } from '@/lib/prism/animatable/primitives/genie-suck';
import { buildSubject } from '@/lib/prism/animatable/subjects';
import { makeTarget, runConformance } from './_conformance';

type UniformHandle = { value: number };
interface GenieHandles {
  uSuck: UniformHandle;
  uK: UniformHandle;
  uCornerX: UniformHandle;
  uCornerY: UniformHandle;
}

const handlesOf = (target: { userData: Record<string, unknown> }): GenieHandles =>
  target.userData.genieSuck as GenieHandles;

const findOverlay = (parent: Object3D): Group | null =>
  (parent.children.find((c) => c.name === 'genie-suck-overlay') as Group | undefined) ?? null;

const overlayMeshOf = (overlay: Group): Mesh =>
  overlay.children.find((c) => (c as Mesh).isMesh) as Mesh;

describe('genie-suck primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(genieSuckPrimitive).dispose();
  });

  it('plays: out-beat flat, suck-in rises, beat holds at 1, spring-out returns to 0', () => {
    const target = makeTarget(genieSuckPrimitive);
    const inst = genieSuckPrimitive.create(target);
    const subject = target.subject as Mesh;
    const D = inst.duration();
    expect(Number.isFinite(D)).toBe(true);
    const h = handlesOf(target);

    // Overlay discipline: a sibling overlay carries the warp; the subject is
    // hidden while the genie is active.
    const overlay = findOverlay(subject.parent as Object3D);
    expect(overlay).not.toBeNull();
    expect(subject.visible).toBe(false);
    const mesh = overlayMeshOf(overlay as Group);
    expect(mesh).toBeDefined();
    // Vertex-lane TSL warp is wired (positionNode set on the overlay material).
    expect((mesh.material as Material & { positionNode?: unknown }).positionNode).toBeTruthy();

    // Out-beat: surface at rest.
    inst.seek(0.05 * D);
    expect(h.uSuck.value).toBeCloseTo(0, 6);

    // Mid suck-in: partially drawn toward the corner (easeInOut of the phase).
    inst.seek(0.3 * D);
    const mid = h.uSuck.value;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.85);

    // Beat: held fully sucked into the corner point.
    inst.seek(0.54 * D);
    expect(h.uSuck.value).toBeCloseTo(1, 6);

    // Spring-out (backOut default): 1 - backOut(0.25) = 0.18259...
    inst.seek(0.7 * D);
    expect(h.uSuck.value).toBeCloseTo(0.18259, 3);

    // Cycle end: back to flat (loop-ready).
    inst.seek(D);
    expect(h.uSuck.value).toBeCloseTo(0, 6);

    inst.dispose();
  });

  it('controls change output: corner flips the target point, spring changes the out-curve, curvature drives the funnel uniform', () => {
    const target = makeTarget(genieSuckPrimitive);
    const inst = genieSuckPrimitive.create(target);
    const D = inst.duration();
    const h = handlesOf(target);

    // Default corner is bottom-right: +x, -y in the overlay's local frame.
    inst.seek(0.3 * D);
    expect(h.uCornerX.value).toBeGreaterThan(0);
    expect(h.uCornerY.value).toBeLessThan(0);

    inst.setControl('corner', 'tl');
    inst.seek(0.3 * D);
    expect(h.uCornerX.value).toBeLessThan(0);
    expect(h.uCornerY.value).toBeGreaterThan(0);

    // Funnel curvature lands in the live uniform the vertex lane reads.
    inst.setControl('curvature', 0.6);
    inst.seek(0.3 * D);
    expect(h.uK.value).toBeCloseTo(0.6, 6);
    inst.setControl('curvature', 3);
    inst.seek(0.3 * D);
    expect(h.uK.value).toBeCloseTo(3, 6);

    // Spring ease reshapes the spring-out: bounceOut(0.25)=0.47266 vs
    // backOut(0.25)=0.81741 — visibly different suck at the same time.
    inst.seek(0.7 * D);
    const backOutSuck = h.uSuck.value;
    inst.setControl('spring', 'bounceOut');
    inst.seek(0.7 * D);
    const bounceSuck = h.uSuck.value;
    expect(bounceSuck).toBeCloseTo(0.52734, 3);
    expect(Math.abs(bounceSuck - backOutSuck)).toBeGreaterThan(0.2);

    inst.dispose();
  });

  it("honors the subject's own look: color mirrored at create, async-poured map picked up by reference", () => {
    const target = makeTarget(genieSuckPrimitive);
    const inst = genieSuckPrimitive.create(target);
    const subject = target.subject as Mesh;
    const srcMat = subject.material as MeshStandardMaterial;
    const overlay = findOverlay(subject.parent as Object3D) as Group;
    const mesh = overlayMeshOf(overlay);

    // No invented fill: the overlay carries the subject's own color.
    const overlayMat = mesh.material as MeshStandardMaterial;
    expect(overlayMat.color.getHexString()).toBe(srcMat.color.getHexString());
    expect(overlayMat.map ?? null).toBeNull();

    // Async texture pour AFTER attach (the mounted-artifact reality): the next
    // seek must rebuild and share the live texture BY REFERENCE.
    const poured = new Texture();
    srcMat.map = poured;
    inst.seek(0.2 * inst.duration());
    const rebuilt = mesh.material as MeshStandardMaterial;
    expect(rebuilt.map).toBe(poured);
    // The rebuilt material still carries the vertex warp.
    expect((rebuilt as Material & { positionNode?: unknown }).positionNode).toBeTruthy();

    // Wholesale material swap (applyImageSpec reality) also triggers a rebind.
    const before = mesh.material;
    srcMat.map = null;
    inst.seek(0.25 * inst.duration());
    expect(mesh.material).not.toBe(before);

    inst.dispose();
    // The shared texture is the subject's — never disposed by the primitive.
    expect(srcMat.map).toBeNull(); // we set it null above; just sanity
  });

  it('tracks the live subject transform every seek (co-bindings move the hidden subject)', () => {
    const target = makeTarget(genieSuckPrimitive);
    const inst = genieSuckPrimitive.create(target);
    const subject = target.subject as Mesh;
    const overlay = findOverlay(subject.parent as Object3D) as Group;

    subject.position.x = 0.37;
    subject.rotation.z = 0.21;
    inst.seek(0.3 * inst.duration());

    expect(overlay.position.x).toBeCloseTo(0.37, 6);
    expect(overlay.quaternion.equals(subject.quaternion)).toBe(true);

    inst.dispose();
  });

  it('dispose restores everything and frees created resources', () => {
    const target = makeTarget(genieSuckPrimitive);
    const inst = genieSuckPrimitive.create(target);
    const subject = target.subject as Mesh;
    const srcMat = subject.material as MeshStandardMaterial;
    const baseOpacity = srcMat.opacity;
    const baseTransparent = srcMat.transparent;
    const overlay = findOverlay(subject.parent as Object3D) as Group;
    const mesh = overlayMeshOf(overlay);

    inst.seek(0.4 * inst.duration());

    let geomDisposed = false;
    let matDisposed = false;
    mesh.geometry.addEventListener('dispose', () => {
      geomDisposed = true;
    });
    (mesh.material as Material).addEventListener('dispose', () => {
      matDisposed = true;
    });

    inst.dispose();

    expect(subject.visible).toBe(true);
    expect(findOverlay(subject.parent as Object3D)).toBeNull();
    expect(target.userData.genieSuck).toBeUndefined();
    expect(geomDisposed).toBe(true);
    expect(matDisposed).toBe(true);
    // The subject's own material was never touched.
    expect(srcMat.opacity).toBe(baseOpacity);
    expect(srcMat.transparent).toBe(baseTransparent);
    // Subject transform untouched (overlay mode never moves the subject).
    expect(subject.position.x).toBe(0);
    expect(subject.scale.x).toBe(1);
  });

  it('handles a Group subject (MSDF text-object shape) without throwing', () => {
    const scene = new Scene();
    const { object, subject } = buildSubject('text');
    scene.add(object);
    const target = { object, subject, scene, userData: {} as Record<string, unknown> };
    const inst = genieSuckPrimitive.create(target);
    const D = inst.duration();

    inst.seek(0.3 * D);
    inst.seek(0.7 * D);
    // The glyph group has child meshes with materials → overlay path engages.
    expect((subject as Object3D).visible).toBe(false);
    expect(findOverlay((subject as Object3D).parent as Object3D)).not.toBeNull();

    inst.dispose();
    expect((subject as Object3D).visible).toBe(true);
  });
});
