import { describe, it, expect } from 'vitest';
import { Color, Mesh, MeshStandardMaterial, Texture, type Material } from 'three';
import { flowWarpIdlePrimitive } from '@/lib/prism/animatable/primitives/flow-warp-idle';
import { makeTarget, runConformance } from './_conformance';

type Uniform<T = number> = { value: T };
interface FlowUniforms {
  uTime: Uniform;
  uDrift: Uniform;
  uFlowScale: Uniform;
  uBreath: Uniform;
  uDuration: Uniform;
  uPhase: Uniform;
  // The current bounded-orbit advection vector (subject-fraction units).
  uFlowX: Uniform;
  uFlowY: Uniform;
}

/** Pull the published uniform bag the primitive exposes for headless tests. */
function uniformsOf(userData: Record<string, unknown>): FlowUniforms {
  return userData.flowWarpIdle as unknown as FlowUniforms;
}

/** The overlay sheet (the panel stand-in). */
function sheetOf(target: ReturnType<typeof makeTarget>): Mesh | null {
  let sheet: Mesh | null = null;
  target.object.traverse((o) => {
    if (sheet) return;
    if ((o as Mesh).isMesh && o.name === 'flow-warp-idle-sheet') sheet = o as Mesh;
  });
  return sheet;
}

/** The first rigid chrome clone (the accent dot), posed by the CPU field mirror. */
function rigidCloneOf(target: ReturnType<typeof makeTarget>): Mesh | null {
  let m: Mesh | null = null;
  target.object.traverse((o) => {
    if (!m && o.name.startsWith('flow-warp-idle-chrome-rigid')) m = o as Mesh;
  });
  return m;
}

describe('flow-warp-idle primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(flowWarpIdlePrimitive).dispose();
  });

  it('declares the texture-preserving / mountable metadata', () => {
    // The whole W3 point: a displacement primitive that PRESERVES the subject
    // look, so it opts out of the category mount-skip.
    expect(flowWarpIdlePrimitive.category).toBe('displacement');
    expect(flowWarpIdlePrimitive.mountable).toBe(true);
    expect(flowWarpIdlePrimitive.subject).toBe('card');
    expect(flowWarpIdlePrimitive.defaultDriver).toBe('time');
    // 3-6 controls.
    expect(flowWarpIdlePrimitive.schema.length).toBeGreaterThanOrEqual(3);
    expect(flowWarpIdlePrimitive.schema.length).toBeLessThanOrEqual(6);
    const target = makeTarget(flowWarpIdlePrimitive);
    const inst = flowWarpIdlePrimitive.create(target);
    // Stateful idle loop → Infinity (the master clock drives the loop phase).
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('builds an overlay and hides the real subject while active', () => {
    const target = makeTarget(flowWarpIdlePrimitive);
    const subject = target.subject!;
    const inst = flowWarpIdlePrimitive.create(target);
    expect(subject.visible).toBe(false);
    expect(sheetOf(target)).not.toBeNull();
    inst.dispose();
    expect(subject.visible).toBe(true);
    expect(sheetOf(target)).toBeNull();
  });

  it('distortion response: the flow advects in a bounded orbit and returns (seamless loop)', () => {
    const target = makeTarget(flowWarpIdlePrimitive);
    const inst = flowWarpIdlePrimitive.create(target);
    const u = uniformsOf(target.userData);
    const dur = u.uDuration.value;

    // Sample the advection vector at three distinct phases of one loop.
    inst.seek(0);
    const x0 = u.uFlowX.value;
    const y0 = u.uFlowY.value;
    const p0 = u.uPhase.value;

    inst.seek(dur * 0.25);
    const x1 = u.uFlowX.value;
    const y1 = u.uFlowY.value;

    inst.seek(dur * 0.5);
    const x2 = u.uFlowX.value;
    const y2 = u.uFlowY.value;

    // Concrete numeric motion at distinct stimulus values: the advection vector
    // visibly moves between phases (content drifts along the flow).
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(1e-3);
    expect(Math.hypot(x2 - x1, y2 - y1)).toBeGreaterThan(1e-3);

    // Seamless loop: at t = duration the advection vector returns to its t=0
    // value (content drifts and comes back, never tearing).
    inst.seek(dur);
    const xLoop = u.uFlowX.value;
    const yLoop = u.uFlowY.value;
    expect(xLoop).toBeCloseTo(x0, 4);
    expect(yLoop).toBeCloseTo(y0, 4);
    expect(u.uPhase.value).toBeCloseTo(p0, 4);

    // Bounded orbit: the advection magnitude never escapes the small envelope
    // (content always fully legible — no tearing, no large jumps).
    for (let i = 0; i <= 16; i++) {
      inst.seek((i / 16) * dur);
      expect(Math.hypot(u.uFlowX.value, u.uFlowY.value)).toBeLessThan(0.3);
    }
    inst.dispose();
  });

  it('idle frame (t=0) is essentially undistorted: the effective offset is sub-pixel', () => {
    const target = makeTarget(flowWarpIdlePrimitive);
    const inst = flowWarpIdlePrimitive.create(target);
    const u = uniformsOf(target.userData);
    inst.seek(0);
    // At the loop origin the orbit returns to center — the surface is at rest
    // and fully legible, never an empty / heavily-warped frame.
    expect(Math.hypot(u.uFlowX.value, u.uFlowY.value)).toBeLessThan(0.02);
    inst.dispose();
  });

  it('controls change output at the pinned engaged state', () => {
    const target = makeTarget(flowWarpIdlePrimitive);
    const inst = flowWarpIdlePrimitive.create(target);
    const u = uniformsOf(target.userData);

    // Pinned-engaged convention: repeated seeks at the SAME t; every control
    // must reshape the published frame. Pick a t mid-loop so the orbit is open.
    const T = u.uDuration.value * 0.3;

    // drift amplitude scales the advection envelope.
    inst.setControl('drift', 0.01);
    inst.seek(T);
    const driftLo = u.uDrift.value;
    const magLo = Math.hypot(u.uFlowX.value, u.uFlowY.value);
    inst.setControl('drift', 0.08);
    inst.seek(T);
    const driftHi = u.uDrift.value;
    const magHi = Math.hypot(u.uFlowX.value, u.uFlowY.value);
    expect(driftHi).toBeGreaterThan(driftLo + 0.02);
    // Bigger drift amplitude → a visibly larger orbit at the same phase.
    expect(magHi).toBeGreaterThan(magLo + 1e-3);

    // flow scale shifts the field frequency.
    inst.setControl('flowScale', 1.2);
    inst.seek(T);
    const scaleLo = u.uFlowScale.value;
    inst.setControl('flowScale', 4);
    inst.seek(T);
    const scaleHi = u.uFlowScale.value;
    expect(scaleHi).toBeGreaterThan(scaleLo + 1);

    // breathing depth scales the vertex swell envelope.
    inst.setControl('breathing', 0.02);
    inst.seek(T);
    const breathLo = u.uBreath.value;
    inst.setControl('breathing', 0.12);
    inst.seek(T);
    const breathHi = u.uBreath.value;
    expect(breathHi).toBeGreaterThan(breathLo + 0.05);

    // loop duration retimes the whole cycle.
    inst.setControl('duration', 6);
    inst.seek(0);
    const durLo = u.uDuration.value;
    inst.setControl('duration', 14);
    inst.seek(0);
    const durHi = u.uDuration.value;
    expect(durHi).toBeGreaterThan(durLo + 4);

    inst.dispose();
  });

  it('onParamChange re-applies at the last seek state (paused control tweak)', () => {
    const target = makeTarget(flowWarpIdlePrimitive);
    const inst = flowWarpIdlePrimitive.create(target);
    const u = uniformsOf(target.userData);
    inst.seek(2.3);
    const before = u.uDrift.value;
    inst.setControl('drift', 0.08); // no new seek
    const after = u.uDrift.value;
    expect(after).not.toBeCloseTo(before, 3);
    inst.dispose();
  });

  it('texture preservation: shares the live map BY REFERENCE when present', () => {
    const target = makeTarget(flowWarpIdlePrimitive);
    // Pour a texture onto the representative panel AFTER build to mimic a mounted
    // artifact's async texture arrival.
    const subject = target.subject!;
    let panel: Mesh | null = null;
    subject.traverse((o) => {
      if (!panel && (o as Mesh).isMesh) panel = o as Mesh;
    });
    expect(panel).not.toBeNull();
    const mat = panel!.material as MeshStandardMaterial;
    const tex = new Texture();
    mat.map = tex;
    mat.needsUpdate = true;

    const inst = flowWarpIdlePrimitive.create(target);
    inst.seek(0.5); // late-pour re-check binds the texture by reference

    const sheet = sheetOf(target);
    expect(sheet).not.toBeNull();
    const sheetMat = sheet!.material as Material & { map?: Texture | null };
    expect(sheetMat.map).toBe(tex);
    inst.dispose();
    expect(tex.uuid).toBeTruthy();
  });

  it('texture preservation (map-less): copies color + PBR scalars onto the overlay', () => {
    const target = makeTarget(flowWarpIdlePrimitive);
    const subject = target.subject!;
    let panel: Mesh | null = null;
    subject.traverse((o) => {
      if (!panel && (o as Mesh).isMesh) panel = o as Mesh;
    });
    const srcMat = panel!.material as MeshStandardMaterial;
    srcMat.color = new Color('#2b3344');
    srcMat.roughness = 0.41;
    srcMat.metalness = 0.53;

    const inst = flowWarpIdlePrimitive.create(target);
    inst.seek(0);
    const sheet = sheetOf(target);
    const sheetMat = sheet!.material as MeshStandardMaterial;
    expect(sheetMat.map ?? null).toBeNull();
    expect(sheetMat.roughness).toBeCloseTo(0.41, 5);
    expect(sheetMat.metalness).toBeCloseTo(0.53, 5);
    inst.dispose();
  });

  it('chrome children ride the flow: clones are created and sway microscopically', () => {
    const target = makeTarget(flowWarpIdlePrimitive);
    const inst = flowWarpIdlePrimitive.create(target);
    // The card has a header bar, an accent dot, and a row group → clones exist
    // so the chrome visibly sways with the field.
    let cloneCount = 0;
    target.object.traverse((o) => {
      if (o.name.startsWith('flow-warp-idle-chrome')) cloneCount += 1;
    });
    expect(cloneCount).toBeGreaterThan(0);

    // The RIGID clone (the accent dot) is posed by the CPU field mirror, so its
    // .position moves as the flow advances (microscopic sway).
    const c = rigidCloneOf(target)!;
    expect(c).not.toBeNull();
    const u = uniformsOf(target.userData);
    inst.seek(u.uDuration.value * 0.15);
    const p0 = c.position.clone();
    inst.seek(u.uDuration.value * 0.55);
    const p1 = c.position.clone();
    expect(p0.distanceTo(p1)).toBeGreaterThan(1e-6);
    inst.dispose();
  });

  it('dispose restores everything and disposes only our resources', () => {
    const target = makeTarget(flowWarpIdlePrimitive);
    const subject = target.subject!;
    const visBefore = subject.visible;
    const childMatUuids: string[] = [];
    subject.traverse((o) => {
      const m = (o as Mesh).material as Material | undefined;
      if (m) childMatUuids.push((m as Material).uuid);
    });

    const inst = flowWarpIdlePrimitive.create(target);
    inst.seek(1);
    inst.dispose();

    expect(subject.visible).toBe(visBefore);
    expect(sheetOf(target)).toBeNull();
    expect(target.userData.flowWarpIdle).toBeUndefined();
    // The subject's own materials are untouched (same instances).
    const after: string[] = [];
    subject.traverse((o) => {
      const m = (o as Mesh).material as Material | undefined;
      if (m) after.push((m as Material).uuid);
    });
    expect(after).toEqual(childMatUuids);
  });
});
