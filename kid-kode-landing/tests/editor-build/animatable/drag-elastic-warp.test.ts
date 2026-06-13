import { describe, it, expect } from 'vitest';
import { Color, Mesh, MeshStandardMaterial, Texture } from 'three';
import { dragElasticWarpPrimitive } from '@/lib/prism/animatable/primitives/drag-elastic-warp';
import { makeTarget, runConformance } from './_conformance';

type Vec2U = { value: { x: number; y: number } };
type NumU = { value: number };
type ColU = { value: Color };

/** The harness's pinned ENGAGED pointer (proximity 0.7..0.9 in the rig). */
const ENGAGED = { x: 0.62, y: 0.5 };
/** A disengaged pointer well outside the engage radius. */
const DISENGAGED = { x: 0.02, y: 0.02 };

function warpUniforms(target: ReturnType<typeof makeTarget>) {
  return target.userData.dragElasticWarp as {
    uGrab: Vec2U;
    uPull: Vec2U;
    uFalloff: NumU;
    uPin: NumU;
    uDimple: NumU;
    uColor: ColU;
    uOpacity: NumU;
    uHalfW: NumU;
    uHalfH: NumU;
  };
}

describe('drag-elastic-warp primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dragElasticWarpPrimitive).dispose();
  });

  it('declares the Wave-3 texture-preserving contract (displacement + mountable)', () => {
    expect(dragElasticWarpPrimitive.category).toBe('displacement');
    // The whole point of W3: a displacement tile that may ride mounted artifacts.
    expect(dragElasticWarpPrimitive.mountable).toBe(true);
    expect(dragElasticWarpPrimitive.subject).toBe('card');
    expect(dragElasticWarpPrimitive.defaultDriver).toBe('pointer');
    expect(dragElasticWarpPrimitive.schema.length).toBeGreaterThanOrEqual(3);
    expect(dragElasticWarpPrimitive.schema.length).toBeLessThanOrEqual(6);
  });

  it('idle frame (t=0, pointer disengaged) leaves the subject essentially undistorted', () => {
    const target = makeTarget(dragElasticWarpPrimitive);
    target.userData.pointer = { ...DISENGAGED };
    const inst = dragElasticWarpPrimitive.create(target);
    inst.seek(0);
    const u = warpUniforms(target);
    // No grab → no lateral pull, no dimple at rest. Fully legible.
    expect(Math.hypot(u.uPull.value.x, u.uPull.value.y)).toBeLessThan(1e-3);
    expect(u.uDimple.value).toBeLessThan(1e-3);
    inst.dispose();
  });

  it('drag response: the stretch grows with engagement (proximity) at 2-3 stimuli', () => {
    const target = makeTarget(dragElasticWarpPrimitive);
    const inst = dragElasticWarpPrimitive.create(target);
    const u = warpUniforms(target);

    // The pull magnitude = engagement(proximity) * grabStrength * span, with the
    // direction the unit vector toward the cursor. So the stretch is strongest
    // near center and falls off monotonically to the engage edge. Repeated seeks
    // at the SAME stimulus let the engage envelope settle (the pinned-engaged-
    // control rule).
    const settled = (px: number, py: number): number => {
      // Reset the closure from a disengaged settle, then engage and converge.
      target.userData.pointer = { ...DISENGAGED };
      for (let i = 0; i < 60; i++) inst.seek((i + 100) * (1 / 60));
      target.userData.pointer = { x: px, y: py };
      for (let i = 0; i < 40; i++) inst.seek(i * (1 / 60));
      return Math.hypot(u.uPull.value.x, u.uPull.value.y);
    };

    const near = settled(0.58, 0.5); // close to center → highest engagement
    const mid = settled(0.7, 0.5); // further out → lower engagement
    const far = settled(0.85, 0.5); // near the engage edge → lowest

    expect(near).toBeGreaterThan(0.02); // a real, non-zero stretch when engaged
    expect(near).toBeGreaterThan(mid); // pull grows toward center
    expect(mid).toBeGreaterThan(far);
    inst.dispose();
  });

  it('pull points toward the cursor offset (sign of the stretch follows x)', () => {
    const target = makeTarget(dragElasticWarpPrimitive);
    const inst = dragElasticWarpPrimitive.create(target);
    const u = warpUniforms(target);

    target.userData.pointer = { x: 0.62, y: 0.5 }; // right of center
    for (let i = 0; i < 40; i++) inst.seek(i * (1 / 60));
    const right = u.uPull.value.x;

    target.userData.pointer = { ...DISENGAGED };
    for (let i = 0; i < 60; i++) inst.seek((i + 100) * (1 / 60));

    target.userData.pointer = { x: 0.38, y: 0.5 }; // left of center
    for (let i = 0; i < 40; i++) inst.seek((i + 200) * (1 / 60));
    const left = u.uPull.value.x;

    expect(right).toBeGreaterThan(0); // pull toward +x when cursor is right
    expect(left).toBeLessThan(0); // pull toward -x when cursor is left
    inst.dispose();
  });

  it('controls reshape the frame at the pinned engaged state', () => {
    const target = makeTarget(dragElasticWarpPrimitive);
    const inst = dragElasticWarpPrimitive.create(target);
    const u = warpUniforms(target);
    target.userData.pointer = { ...ENGAGED };

    const settleAt = (): void => {
      for (let i = 0; i < 40; i++) inst.seek(i * (1 / 60));
    };

    // grabStrength: stronger grab → larger lateral pull at the same proximity.
    inst.setControl('grabStrength', 0.08);
    settleAt();
    const weakPull = Math.hypot(u.uPull.value.x, u.uPull.value.y);
    inst.setControl('grabStrength', 0.55);
    // onParamChange re-applies at the last seek state; settle to be safe.
    settleAt();
    const strongPull = Math.hypot(u.uPull.value.x, u.uPull.value.y);
    expect(strongPull).toBeGreaterThan(weakPull + 0.05);

    // falloff: a wider falloff fraction grows the grab-falloff radius uniform.
    inst.setControl('falloff', 0.25);
    inst.seek(2);
    const tightFalloff = u.uFalloff.value;
    inst.setControl('falloff', 0.95);
    inst.seek(2);
    const wideFalloff = u.uFalloff.value;
    expect(wideFalloff).toBeGreaterThan(tightFalloff + 0.1);

    // stiffness: a higher corner stiffness widens the anchored-border pin width.
    inst.setControl('stiffness', 0.06);
    inst.seek(2);
    const softPin = u.uPin.value;
    inst.setControl('stiffness', 0.44);
    inst.seek(2);
    const stiffPin = u.uPin.value;
    expect(stiffPin).toBeGreaterThan(softPin + 0.05);

    inst.dispose();
  });

  it('release wobble: disengaging overshoots the stretch back through zero', () => {
    const target = makeTarget(dragElasticWarpPrimitive);
    const inst = dragElasticWarpPrimitive.create(target);
    const u = warpUniforms(target);

    // High wobble for a clearly oscillating snap-back.
    inst.setControl('wobble', 1);
    inst.setControl('grabStrength', 0.5);

    // Engage and settle to a strong stretch.
    target.userData.pointer = { x: 0.58, y: 0.5 };
    let tt = 0;
    for (let i = 0; i < 40; i++) inst.seek((tt += 1 / 60));
    const engagedPull = u.uPull.value.x;
    expect(engagedPull).toBeGreaterThan(0.02);

    // Disengage and sample the snap-back. The damped sinusoid must cross zero
    // (overshoot to the opposite sign) before settling — that's the wobble.
    target.userData.pointer = { ...DISENGAGED };
    let minPull = Infinity;
    let maxPull = -Infinity;
    for (let i = 0; i < 90; i++) {
      inst.seek((tt += 1 / 60));
      minPull = Math.min(minPull, u.uPull.value.x);
      maxPull = Math.max(maxPull, u.uPull.value.x);
    }
    // It overshot to the opposite sign at some point (a real wobble, not a fade).
    expect(minPull).toBeLessThan(-1e-3);
    // And it ultimately settled near flat.
    expect(Math.abs(u.uPull.value.x)).toBeLessThan(0.02);
    inst.dispose();
  });

  it('texture preservation: overlay carries the subject color/PBR when map-less', () => {
    const target = makeTarget(dragElasticWarpPrimitive);
    // Stamp the panel material with a distinctive color + PBR scalars BEFORE create.
    const subject = target.subject as Mesh;
    const panelMat = (Array.isArray(subject.material) ? subject.material[0] : subject.material) as MeshStandardMaterial;
    panelMat.color = new Color('#c08040');
    panelMat.roughness = 0.21;
    panelMat.metalness = 0.66;

    const inst = dragElasticWarpPrimitive.create(target);
    inst.seek(0);
    const u = warpUniforms(target);
    // Map-less → the tracked color uniform mirrors the subject's own color
    // (never an invented flat fill).
    expect(u.uColor.value.getHexString()).toBe(new Color('#c08040').getHexString());

    // The overlay sheet must exist and use a node material that copies the PBR scalars.
    const overlay = target.object.getObjectByName('drag-elastic-warp-overlay');
    expect(overlay).toBeTruthy();
    const sheet = overlay!.getObjectByName('drag-elastic-warp-sheet') as Mesh;
    expect(sheet).toBeTruthy();
    const sheetMat = sheet.material as MeshStandardMaterial;
    expect(sheetMat.roughness).toBeCloseTo(0.21, 5);
    expect(sheetMat.metalness).toBeCloseTo(0.66, 5);
    inst.dispose();
  });

  it('texture preservation: shares the subject .map BY REFERENCE when present', () => {
    const target = makeTarget(dragElasticWarpPrimitive);
    const subject = target.subject as Mesh;
    const panelMat = (Array.isArray(subject.material) ? subject.material[0] : subject.material) as MeshStandardMaterial;
    const tex = new Texture();
    panelMat.map = tex;

    const inst = dragElasticWarpPrimitive.create(target);
    inst.seek(0);
    const overlay = target.object.getObjectByName('drag-elastic-warp-overlay')!;
    const sheet = overlay.getObjectByName('drag-elastic-warp-sheet') as Mesh;
    const sheetMat = sheet.material as MeshStandardMaterial & { colorNode?: { value?: Texture } };
    // colorNode is a texture node referencing the SAME Texture instance — shared
    // by reference, not cloned (disposing the sheet must never free the subject's map).
    const node = sheetMat.colorNode as unknown as { value?: Texture };
    expect(node?.value).toBe(tex);
    inst.dispose();
    // The subject's own map survives dispose untouched.
    expect(panelMat.map).toBe(tex);
    expect(tex.image).toBeNull(); // texture itself not disposed/replaced
  });

  it('carries the chrome children: bent clones + a rigid clone ride the warp', () => {
    const target = makeTarget(dragElasticWarpPrimitive);
    const inst = dragElasticWarpPrimitive.create(target);
    inst.seek(0);
    const overlay = target.object.getObjectByName('drag-elastic-warp-overlay')!;
    const bent = overlay.children.filter((c) => c.name.startsWith('drag-elastic-warp-chrome-bent'));
    const rigid = overlay.children.filter((c) => c.name.startsWith('drag-elastic-warp-chrome-rigid'));
    // The catalog card has a brass header + 3 grey rows (wide → bent) and a
    // violet dot (small → rigid). At least one of each must clone.
    expect(bent.length).toBeGreaterThanOrEqual(1);
    expect(rigid.length).toBeGreaterThanOrEqual(1);

    // The rigid dot must visibly move under an engaged drag (the parallax of pull).
    const dot = rigid[0] as Mesh;
    const rest = dot.position.clone();
    target.userData.pointer = { x: 0.6, y: 0.5 };
    for (let i = 0; i < 40; i++) inst.seek(i * (1 / 60));
    const pulled = dot.position.clone();
    expect(rest.distanceTo(pulled)).toBeGreaterThan(1e-4);
    inst.dispose();
  });

  it('dispose restores subject visibility and removes the overlay', () => {
    const target = makeTarget(dragElasticWarpPrimitive);
    const subject = target.subject as Mesh;
    const wasVisible = subject.visible;
    const inst = dragElasticWarpPrimitive.create(target);
    inst.seek(0);
    // While active, the real subject is hidden and an overlay stands in.
    expect(subject.visible).toBe(false);
    expect(target.object.getObjectByName('drag-elastic-warp-overlay')).toBeTruthy();

    inst.dispose();
    // After dispose: subject restored, overlay gone.
    expect(subject.visible).toBe(wasVisible);
    expect(target.object.getObjectByName('drag-elastic-warp-overlay')).toBeFalsy();
  });
});
