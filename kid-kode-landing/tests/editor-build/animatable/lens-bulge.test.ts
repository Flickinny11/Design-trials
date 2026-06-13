import { describe, it, expect } from 'vitest';
import {
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  type Material,
  type Object3D,
} from 'three';
import { lensBulgePrimitive } from '@/lib/prism/animatable/primitives/lens-bulge';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

/** Uniform handles the primitive publishes for headless observability (the
 *  water-droplet pattern — the optical dome lives in the TSL vertex/color lanes
 *  on the GPU, so tests read the driven uniforms, the scene graph, and material
 *  identity). */
interface LensHandles {
  uStrength: { value: number };
  uRadius: { value: number };
  uMag: { value: number };
  uRim: { value: number };
  uCenterX: { value: number };
  uCenterY: { value: number };
  uEngage: { value: number };
  uHeight: { value: number };
  /** Peak content magnification factor applied to a chrome child this seek
   *  (1 = no magnification). A deterministic, browser-free proof the lens
   *  genuinely enlarges the card's content at the engaged state. */
  uMagApplied: { value: number };
}
const handlesOf = (t: AnimatableTarget): LensHandles =>
  t.userData.lensBulge as LensHandles;

/** The overlay sheet mesh anywhere under the root (sibling of the hidden
 *  subject — a hidden parent hides its children, so it can't live under it). */
function sheetOf(root: Object3D): Mesh {
  let found: Mesh | null = null;
  root.traverse((o) => {
    if (o.name === 'lens-bulge-sheet') found = o as Mesh;
  });
  if (!found) throw new Error('lens-bulge sheet not found');
  return found;
}

function overlayNodesIn(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o.name.startsWith('lens-bulge')) n++;
  });
  return n;
}

/** Engaged pointer matching the harness CONTROL sweep pin (proximity ~0.7-0.9). */
const ENGAGED = { x: 0.62, y: 0.5 };

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
    userData: { pointer: { ...ENGAGED }, scroll: 0.5 },
  };
  return { target, subject, texture };
}

describe('lens-bulge primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(lensBulgePrimitive).dispose();
  });

  it('declares the texture-preserving displacement contract: mountable + displacement category + card subject', () => {
    expect(lensBulgePrimitive.category).toBe('displacement');
    expect(lensBulgePrimitive.mountable).toBe(true);
    expect(lensBulgePrimitive.subject).toBe('card');
    expect(lensBulgePrimitive.defaultDriver).toBe('pointer');
    // Stateful pointer effect → never "ends".
    const target = makeTarget(lensBulgePrimitive);
    const inst = lensBulgePrimitive.create(target);
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('distortion response: disengaged pointer is FLAT (engage 0); the dome swells as the pointer nears the card', () => {
    const target = makeTarget(lensBulgePrimitive);
    const inst = lensBulgePrimitive.create(target);
    const ud = handlesOf(target);

    // Idle: pointer disengaged (host signals absence by NOT setting it engaged;
    // the rig pins t=0 disengaged). A far-corner pointer → no bulge.
    target.userData.pointer = { x: 0.02, y: 0.98 };
    inst.seek(0);
    const engageFar = ud.uEngage.value;
    expect(engageFar).toBeCloseTo(0, 5);

    // Engaged: the harness-pinned proximity point — the dome is on screen.
    target.userData.pointer = { ...ENGAGED };
    inst.seek(0.5);
    const engageNear = ud.uEngage.value;
    expect(engageNear).toBeGreaterThan(0.5);

    // Dead center → maximal engagement, larger than the off-center pin.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0.6);
    const engageCenter = ud.uEngage.value;
    expect(engageCenter).toBeGreaterThan(engageNear);

    inst.dispose();
  });

  it('distortion response: the dome center tracks the pointer in subject-local units (engaged)', () => {
    const target = makeTarget(lensBulgePrimitive);
    const inst = lensBulgePrimitive.create(target);
    const ud = handlesOf(target);

    // Card is 1.74 x 1.12. Pointer x=0.62 maps to a local x right of center;
    // x=0.5 maps to ~0. The center uniform must move with the pointer.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0.4);
    const cx0 = ud.uCenterX.value;
    expect(cx0).toBeCloseTo(0, 2);

    target.userData.pointer = { ...ENGAGED };
    inst.seek(0.5);
    const cxR = ud.uCenterX.value;
    expect(cxR).toBeGreaterThan(cx0 + 0.05);

    // Non-finite pointer is guarded — no NaN leaks into the center uniform.
    target.userData.pointer = { x: Number.NaN, y: 0.5 };
    inst.seek(0.6);
    expect(Number.isFinite(ud.uCenterX.value)).toBe(true);
    expect(Number.isFinite(ud.uCenterY.value)).toBe(true);

    inst.dispose();
  });

  it('controls change output at the pinned engaged state: every knob visibly reshapes the lens', () => {
    const target = makeTarget(lensBulgePrimitive);
    const inst = lensBulgePrimitive.create(target);
    const ud = handlesOf(target);

    // The header clone — a real content child the lens magnifies. We read its
    // measured pose (offset distance from the lens center + scale) so each
    // control is proven LIVE against a rendered output, not just a raw uniform.
    const headerClone = (): Mesh => {
      let found: Mesh | null = null;
      target.scene.traverse((o) => {
        if (o.name === 'lens-bulge-chrome:card-header') found = o as Mesh;
      });
      if (!found) throw new Error('header clone not found');
      return found;
    };
    const header = headerClone();
    // Put the lens directly over the header so it is inside the engaged disc and
    // every control reshapes its magnification (header sits high-left).
    const OVER_HEADER = { x: 0.32, y: 0.78 };
    const pinAndSeek = () => {
      target.userData.pointer = { ...OVER_HEADER };
      inst.seek(1);
    };
    const headerScale = () => header.scale.x;
    const headerOffset = () => {
      const dx = header.position.x - ud.uCenterX.value;
      const dy = header.position.y - ud.uCenterY.value;
      return Math.hypot(dx, dy);
    };

    // bulge strength — a global gain on the magnification: the header swells more
    // (raw uniform AND measured clone scale both grow).
    inst.setControl('strength', 0.1);
    pinAndSeek();
    const lowS = ud.uStrength.value;
    const lowSScale = headerScale();
    inst.setControl('strength', 1);
    pinAndSeek();
    const highS = ud.uStrength.value;
    const highSScale = headerScale();
    expect(highS).toBeGreaterThan(lowS + 0.2);
    expect(highSScale, 'strength scales the magnified header').toBeGreaterThan(lowSScale + 1e-3);

    // lens radius — a wider disc reshapes which content is magnified (raw uniform
    // grows; the measured header pose changes between the two radii).
    inst.setControl('radius', 0.2);
    pinAndSeek();
    const lowR = ud.uRadius.value;
    const lowROffset = headerOffset();
    inst.setControl('radius', 0.9);
    pinAndSeek();
    const highR = ud.uRadius.value;
    const highROffset = headerOffset();
    expect(highR).toBeGreaterThan(lowR + 0.1);
    expect(
      Math.abs(highROffset - lowROffset),
      'radius reshapes the magnified header pose',
    ).toBeGreaterThan(1e-3);

    // magnification — THE core control. Raw uniform AND the measured peak applied
    // magnification AND the header clone scale all grow from min to max.
    inst.setControl('magnify', 0.05);
    pinAndSeek();
    const lowM = ud.uMag.value;
    const lowMApplied = ud.uMagApplied.value;
    const lowMScale = headerScale();
    inst.setControl('magnify', 0.8);
    pinAndSeek();
    const highM = ud.uMag.value;
    const highMApplied = ud.uMagApplied.value;
    const highMScale = headerScale();
    expect(highM).toBeGreaterThan(lowM + 0.2);
    expect(
      highMApplied,
      'magnify increases the applied content magnification',
    ).toBeGreaterThan(lowMApplied + 0.05);
    expect(highMScale, 'magnify enlarges the magnified header').toBeGreaterThan(lowMScale + 1e-3);

    // rim refraction — the tangential edge-stretch ring: raw uniform grows AND
    // the measured header pose (pushed outward by the rim stretch) changes.
    inst.setControl('magnify', 0.45); // back to default so rim isolates its effect
    inst.setControl('rim', 0);
    pinAndSeek();
    const lowRim = ud.uRim.value;
    const lowRimOffset = headerOffset();
    const lowRimScale = headerScale();
    inst.setControl('rim', 1);
    pinAndSeek();
    const highRim = ud.uRim.value;
    const highRimOffset = headerOffset();
    const highRimScale = headerScale();
    expect(highRim).toBeGreaterThan(lowRim + 0.2);
    expect(
      Math.abs(highRimOffset - lowRimOffset) + Math.abs(highRimScale - lowRimScale),
      'rim reshapes the magnified header (edge-stretch ring)',
    ).toBeGreaterThan(1e-3);

    inst.dispose();
  });

  it('substantial magnification: the lens genuinely ENLARGES the card content at the engaged state', () => {
    const target = makeTarget(lensBulgePrimitive);
    const inst = lensBulgePrimitive.create(target);
    const ud = handlesOf(target);

    // Idle / disengaged: the lens is OFF — content sits at its true 1:1 size
    // (no magnification, fully legible card at rest).
    target.userData.pointer = { x: 0.02, y: 0.98 };
    inst.seek(0);
    expect(ud.uMagApplied.value, 'disengaged: content is 1:1, never distorted').toBeCloseTo(1, 5);

    // Engaged dead-center: the lens magnifies the content by a SUBSTANTIAL,
    // premium amount — well above any discoverability floor (≥ ~25% enlargement),
    // not a faint accidental wobble.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0.5);
    expect(
      ud.uMagApplied.value,
      'engaged: content reads substantially larger through the lens',
    ).toBeGreaterThan(1.25);

    // At least one chrome content child is actually scaled up under the lens (a
    // real, measured transform — not a no-op). Pick the most-magnified clone (the
    // one closest under the lens center), independent of which child that is.
    let peakScale = 0;
    target.scene.traverse((o) => {
      if (o.name.startsWith('lens-bulge-chrome:')) {
        peakScale = Math.max(peakScale, (o as Mesh).scale.x);
      }
    });
    expect(peakScale, 'a magnified chrome child is scaled up under the lens').toBeGreaterThan(1.1);

    inst.dispose();
  });

  it('onParamChange re-applies at the last engaged seek state (paused control sweep)', () => {
    const target = makeTarget(lensBulgePrimitive);
    const inst = lensBulgePrimitive.create(target);
    const ud = handlesOf(target);

    target.userData.pointer = { ...ENGAGED };
    inst.seek(1);
    const engageBefore = ud.uEngage.value;
    expect(engageBefore).toBeGreaterThan(0.5);

    // A control tweak with NO new seek must still take effect (the rig pauses
    // the clock and drives one control), and the engaged envelope persists.
    inst.setControl('strength', 1);
    expect(ud.uStrength.value).toBeCloseTo(1, 5);
    expect(ud.uEngage.value).toBeGreaterThan(0.5);

    inst.dispose();
  });

  it("texture-preservation: the sheet's colorNode samples the subject's OWN texture by reference (never an invented fill)", () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    const inst = lensBulgePrimitive.create(target);
    const sheet = sheetOf(target.scene);

    const colorNode = (sheet.material as Material & { colorNode?: { value?: unknown } })
      .colorNode;
    expect(colorNode?.value, 'colorNode samples the shared texture').toBe(texture);
    expect(sheet.material, 'sheet material is its own instance').not.toBe(subject.material);

    // The subject's own material was never mutated.
    expect((subject.material as MeshBasicMaterial).map).toBe(texture);
    expect((subject.material as MeshBasicMaterial).opacity).toBe(1);
    expect(subject.visible, 'subject hidden while the sheet stands in').toBe(false);

    // Sheet geometry derives from the measured bbox (2 x 1, not the catalog 1.74).
    sheet.geometry.computeBoundingBox();
    const bb = sheet.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(2, 2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(1, 2);

    inst.dispose();
  });

  it('texture-preservation: a map-less subject copies color AND PBR scalars onto the sheet (shades identically)', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Mesh(
      new PlaneGeometry(2, 1),
      new MeshStandardMaterial({
        color: '#88aa66',
        roughness: 0.27,
        metalness: 0.61,
        envMapIntensity: 1.33,
        emissiveIntensity: 0.4,
      }),
    );
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { ...ENGAGED }, scroll: 0.5 },
    };

    const inst = lensBulgePrimitive.create(target);
    const sheet = sheetOf(scene);
    const mat = sheet.material as MeshStandardMaterial & {
      colorNode?: { value?: { getHexString(): string } };
    };

    // Color carried via the tracked uColor uniform (the colorNode), PBR scalars
    // copied onto the node material — NEVER an invented flat fill.
    expect(mat.colorNode?.value?.getHexString()).toBe('88aa66');
    expect(mat.roughness).toBeCloseTo(0.27, 5);
    expect(mat.metalness).toBeCloseTo(0.61, 5);
    expect(mat.envMapIntensity).toBeCloseTo(1.33, 5);

    inst.dispose();
  });

  it('regression: a texture poured AFTER create reaches the sheet (async map pour → material rebuild)', () => {
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
      userData: { pointer: { ...ENGAGED }, scroll: 0.5 },
    };

    const inst = lensBulgePrimitive.create(target);
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

    // Stability: with no further source change, seeks do NOT rebuild.
    const stable = sheet.material;
    inst.seek(0.5);
    expect(sheet.material).toBe(stable);

    // Dispose never touches the subject's shared texture.
    let texDisposed = 0;
    texture.addEventListener('dispose', () => texDisposed++);
    inst.dispose();
    expect(texDisposed).toBe(0);
    expect((subject.material as MeshBasicMaterial).map).toBe(texture);
  });

  it('chrome co-treatment: the card header/rows/dot become clones that lift/scale with the field; subject chrome never mutated', () => {
    const target = makeTarget(lensBulgePrimitive);
    const inst = lensBulgePrimitive.create(target);

    const clones: Mesh[] = [];
    target.scene.traverse((o) => {
      if (o.name.startsWith('lens-bulge-chrome:')) clones.push(o as Mesh);
    });
    // header + accent dot + 3 content rows = 5 chrome children become clones.
    expect(clones.length, 'every chrome child becomes a clone').toBe(5);

    // Subject chrome materials are NEVER mutated (no node fields injected,
    // opacity untouched), and the subject is hidden behind the overlay.
    const subjectPanel = target.subject as Mesh;
    subjectPanel.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        expect((mat as Material & { opacity: number }).opacity).toBe(1);
      }
    });
    expect(subjectPanel.visible).toBe(false);

    // A chrome clone near the lens center lifts (+z) and scales up when the lens
    // passes over it; disengaged it sits at its rest pose. Pick the header
    // clone (it sits high-left, so put the pointer over it).
    const header = clones.find((c) => c.name.includes('card-header'))!;
    expect(header).toBeDefined();
    const restZ = header.position.z;
    const restScale = header.scale.x;

    // Engage the lens directly over the header's screen location (upper area).
    target.userData.pointer = { x: 0.3, y: 0.78 };
    inst.seek(0.5);
    const liftedZ = header.position.z;
    const liftedScale = header.scale.x;
    expect(liftedZ, 'header lifts toward the camera under the lens').toBeGreaterThan(restZ + 1e-3);
    expect(liftedScale, 'header swells under the lens').toBeGreaterThan(restScale + 1e-3);

    inst.dispose();
  });

  it('dispose restores the subject and releases everything created (never subject resources)', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    expect(subject.visible).toBe(true);

    const inst = lensBulgePrimitive.create(target);
    const sheet = sheetOf(target.scene);
    expect(subject.visible, 'subject hidden while the sheet stands in').toBe(false);

    let createdDisposed = 0;
    sheet.geometry.addEventListener('dispose', () => createdDisposed++);
    (sheet.material as Material).addEventListener('dispose', () => createdDisposed++);
    let subjectDisposed = 0;
    (subject.material as Material).addEventListener('dispose', () => subjectDisposed++);
    texture.addEventListener('dispose', () => subjectDisposed++);

    target.userData.pointer = { ...ENGAGED };
    inst.seek(0.7);
    inst.dispose();

    expect(subject.visible, 'subject restored after dispose').toBe(true);
    expect(createdDisposed, 'sheet geometry + material both disposed').toBe(2);
    expect(subjectDisposed, 'subject material/texture never disposed').toBe(0);
    expect(overlayNodesIn(target.scene), 'nothing of ours left in the tree').toBe(0);
  });

  it('fallback: with no usable geometry/material it bulges the WHOLE subject toward the camera — nothing spawned, restored on dispose', () => {
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
      userData: { pointer: { ...ENGAGED }, scroll: 0.5 },
    };

    const baseZ = subject.position.z; // captured BEFORE create (create may engage)
    const inst = lensBulgePrimitive.create(target);
    expect(overlayNodesIn(scene), 'no overlay spawned for an empty subject').toBe(0);
    expect(subject.visible, 'fallback never hides the subject it animates').toBe(true);

    // Disengaged → at rest.
    target.userData.pointer = { x: 0.02, y: 0.98 };
    inst.seek(0);
    expect(subject.position.z).toBeCloseTo(baseZ, 5);

    // Engaged → the whole subject pushes toward the camera.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0.5);
    expect(subject.position.z, 'whole subject bulges toward the camera').toBeGreaterThan(baseZ + 1e-3);

    inst.dispose();
    expect(subject.position.z, 'z restored after dispose').toBeCloseTo(baseZ, 6);
  });
});
