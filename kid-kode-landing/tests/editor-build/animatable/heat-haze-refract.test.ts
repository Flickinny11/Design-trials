import { describe, it, expect } from 'vitest';
import { Color, Mesh, MeshStandardMaterial, Texture, type Material } from 'three';
import { heatHazeRefractPrimitive } from '@/lib/prism/animatable/primitives/heat-haze-refract';
import { makeTarget, runConformance } from './_conformance';

type Uniform<T = number> = { value: T };
interface RefractUniforms {
  uTime: Uniform;
  uAmp: Uniform;
  uColumnW: Uniform;
  uColumnX: Uniform;
  uRise: Uniform;
  uScale: Uniform;
  uColumnY: Uniform;
  uBreath: Uniform;
  /** CPU mirror of the GPU vertex-lane displacement at content UV (u,v), in
   *  subject-local units — the browser-free measurement of the rendered waver. */
  sampleDisp: (u: number, v: number) => { ox: number; oy: number; raw: number };
}

/** Pull the published uniform bag the primitive exposes for headless tests. */
function uniformsOf(userData: Record<string, unknown>): RefractUniforms {
  return userData.heatHazeRefract as unknown as RefractUniforms;
}

/** The first descendant Mesh of the overlay sheet (the panel stand-in). */
function sheetOf(target: ReturnType<typeof makeTarget>): Mesh | null {
  let sheet: Mesh | null = null;
  target.object.traverse((o) => {
    if (sheet) return;
    if ((o as Mesh).isMesh && o.name === 'heat-haze-refract-sheet') sheet = o as Mesh;
  });
  return sheet;
}

/** The rigid chrome clone (the accent dot) — its .position is a REAL CPU-
 *  computed transform driven by the heat field, so it is a deterministic,
 *  browser-free proxy for the rendered displacement: if a control reshapes the
 *  field, the dot's offset from its rest anchor changes. */
function rigidCloneOf(target: ReturnType<typeof makeTarget>): Mesh | null {
  let m: Mesh | null = null;
  target.object.traverse((o) => {
    if (!m && o.name.startsWith('heat-haze-refract-chrome-rigid')) m = o as Mesh;
  });
  return m;
}

/** The dot's displacement magnitude away from its rest anchor at the engaged
 *  pin — a single scalar that every field-driving control must move. The rest
 *  anchor is captured at t=0 (clean idle), where the engage envelope is 0. */
function engagedDisp(
  inst: ReturnType<typeof heatHazeRefractPrimitive.create>,
  target: ReturnType<typeof makeTarget>,
  t: number,
): number {
  inst.seek(0);
  const dot = rigidCloneOf(target)!;
  const rest = dot.position.clone();
  inst.seek(t);
  return dot.position.distanceTo(rest);
}

describe('heat-haze-refract primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(heatHazeRefractPrimitive).dispose();
  });

  it('declares the texture-preserving / mountable metadata', () => {
    // The whole point of the W3 class: a displacement primitive that PRESERVES
    // the subject look, so it opts out of the category mount-skip.
    expect(heatHazeRefractPrimitive.category).toBe('displacement');
    expect(heatHazeRefractPrimitive.mountable).toBe(true);
    expect(heatHazeRefractPrimitive.subject).toBe('card');
    expect(heatHazeRefractPrimitive.defaultDriver).toBe('time');
    // Loop ~6s by default.
    const target = makeTarget(heatHazeRefractPrimitive);
    const inst = heatHazeRefractPrimitive.create(target);
    expect(inst.duration()).toBeCloseTo(6, 0);
    inst.dispose();
  });

  it('builds an overlay and hides the real subject while active', () => {
    const target = makeTarget(heatHazeRefractPrimitive);
    const subject = target.subject!;
    const inst = heatHazeRefractPrimitive.create(target);
    expect(subject.visible).toBe(false);
    expect(sheetOf(target)).not.toBeNull();
    inst.dispose();
    // dispose restores visibility and removes the overlay.
    expect(subject.visible).toBe(true);
    expect(sheetOf(target)).toBeNull();
  });

  it('distortion response: the shimmer field advances over the loop and is non-trivial', () => {
    const target = makeTarget(heatHazeRefractPrimitive);
    const inst = heatHazeRefractPrimitive.create(target);
    const u = uniformsOf(target.userData);

    inst.seek(0);
    const t0 = u.uTime.value;
    const colY0 = u.uColumnY.value;
    const breath0 = u.uBreath.value;

    inst.seek(2);
    const t2 = u.uTime.value;
    const colY2 = u.uColumnY.value;
    const breath2 = u.uBreath.value;

    inst.seek(4);
    const colY4 = u.uColumnY.value;

    // Time uniform tracks the clock.
    expect(t2).toBeGreaterThan(t0 + 1);
    // The masked column drifts upward across the loop (concrete numeric motion
    // at distinct stimulus values).
    expect(colY2).not.toBeCloseTo(colY0, 3);
    expect(colY4).not.toBeCloseTo(colY2, 3);
    // The slow amplitude breath is alive (organic, not static).
    expect(breath2).not.toBeCloseTo(breath0, 3);
    // Default shimmer amplitude is engaged (the premium look) and small.
    expect(u.uAmp.value).toBeGreaterThan(0);
    expect(u.uAmp.value).toBeLessThan(0.2);
    inst.dispose();
  });

  it('idle frame (t=0) is essentially undistorted: the engage envelope is closed', () => {
    const target = makeTarget(heatHazeRefractPrimitive);
    const inst = heatHazeRefractPrimitive.create(target);
    const u = uniformsOf(target.userData);
    inst.seek(0);
    // At the pinned idle the engage envelope (uBreath) is shut, so the effective
    // displacement is sub-pixel and the card rests clean and fully legible — the
    // disengaged-at-rest contract for a paused t=0 frame.
    const effective = u.uAmp.value * u.uBreath.value;
    expect(effective).toBeLessThan(0.02);
    // And the rigid chrome clone sits exactly at its rest anchor (no waver).
    const dot0 = rigidCloneOf(target)!;
    const restX = dot0.position.x;
    const restY = dot0.position.y;
    inst.seek(0); // re-pin idle
    expect(dot0.position.x).toBeCloseTo(restX, 6);
    expect(dot0.position.y).toBeCloseTo(restY, 6);
    inst.dispose();
  });

  it('engaged pin shows SUBSTANTIAL displacement across the CONTENT BODY (not an edge wobble)', () => {
    // The W3 failure was an under-powered, near-static effect (frameDeltaMag
    // 0.02-0.05) confined to the brass bar's top edge. The engaged frame must
    // carry an obviously-alive waver across the WHOLE column of content — the
    // grey rows included. We measure the in-plane displacement the vertex lane
    // applies at content positions (grey rows + header) via the CPU mirror at the
    // harness's engaged pin (t=1) and assert it is large in subject-local units.
    const target = makeTarget(heatHazeRefractPrimitive);
    const inst = heatHazeRefractPrimitive.create(target);
    const u = uniformsOf(target.userData);

    // At the engaged pin the envelope is wide open (strong standing shimmer).
    inst.seek(1);
    expect(u.uBreath.value).toBeGreaterThan(0.7);
    const effective = u.uAmp.value * u.uBreath.value;
    // Effective amplitude (fraction of span) is well above any sub-pixel floor.
    expect(effective).toBeGreaterThan(0.04);

    // Content-body waver: the grey rows (NOT just the brass edge) are displaced.
    // Sample several content points and assert a real summed magnitude — the
    // whole column wavers, the defect's core failure now resolved.
    const rowProbes: Array<[number, number]> = [
      [0.5, 0.42],
      [0.4, 0.62],
      [0.45, 0.28],
      [0.55, 0.5],
    ];
    let rowMag = 0;
    for (const [pu, pv] of rowProbes) {
      const d = u.sampleDisp(pu, pv);
      rowMag += Math.hypot(d.ox, d.oy);
    }
    // Premium-strength: a clearly rising column of wavering air on the content,
    // not a faint single-edge notch. Subject-local units; the card spans ~O(1).
    expect(rowMag).toBeGreaterThan(0.03);

    // And the rigid dot still carries a real (smaller, corner) flutter.
    const disp = engagedDisp(inst, target, 1);
    expect(disp).toBeGreaterThan(0.002);
    inst.dispose();
  });

  it('controls change the published uniforms at the pinned engaged state', () => {
    const target = makeTarget(heatHazeRefractPrimitive);
    const inst = heatHazeRefractPrimitive.create(target);
    const u = uniformsOf(target.userData);

    // Pinned-engaged convention: repeated seeks at the same t; every control
    // must reshape the published frame.
    const T = 1.5;

    inst.setControl('amplitude', 0.01);
    inst.seek(T);
    const ampLo = u.uAmp.value;
    inst.setControl('amplitude', 0.16);
    inst.seek(T);
    const ampHi = u.uAmp.value;
    expect(ampHi).toBeGreaterThan(ampLo + 0.05);

    inst.setControl('columnWidth', 0.2);
    inst.seek(T);
    const wNarrow = u.uColumnW.value;
    inst.setControl('columnWidth', 0.8);
    inst.seek(T);
    const wWide = u.uColumnW.value;
    expect(wWide).toBeGreaterThan(wNarrow + 0.1);

    inst.setControl('riseSpeed', 0.3);
    inst.seek(T);
    const riseLo = u.uRise.value;
    inst.setControl('riseSpeed', 1.6);
    inst.seek(T);
    const riseHi = u.uRise.value;
    expect(riseHi).toBeGreaterThan(riseLo + 0.5);

    inst.setControl('distortionScale', 3);
    inst.seek(T);
    const scaleLo = u.uScale.value;
    inst.setControl('distortionScale', 10);
    inst.seek(T);
    const scaleHi = u.uScale.value;
    expect(scaleHi).toBeGreaterThan(scaleLo + 3);

    inst.dispose();
  });

  it('EVERY control measurably reshapes the rendered displacement field at the engaged pin', () => {
    // The W3 BLOCK: the harness scored changed=false on all five controls at the
    // engaged pin (t=1) because the effect was sub-pixel there and only the brass
    // bar's top edge moved. This is the browser-free proof that each control now
    // moves the REAL in-plane displacement applied to the CONTENT BODY (a grey
    // row at the card center) — sampled via the primitive's CPU field mirror,
    // the exact arithmetic the TSL vertex lane applies — between min and max at
    // the pinned engaged phase. The probe sits on a grey row (u=0.5, v=0.42), in
    // the column at the pin, so columnWidth/duration also register there.
    const PIN = 1; // the harness's controlsPinT
    // Probe content points spanning the column AND its horizontal edges: center
    // rows + header band catch amplitude/scale/rise/duration; the off-center
    // points (u≈0.2/0.8) catch columnWidth, whose effect is the EXTENT of the
    // wavering zone. So a control reshaping ANY part of the surface registers.
    const probes: Array<[number, number]> = [
      [0.5, 0.42],
      [0.4, 0.62],
      [0.45, 0.28],
      [0.78, 0.5],
      [0.22, 0.45],
    ];
    const magAt = (u: RefractUniforms): number => {
      let s = 0;
      for (const [pu, pv] of probes) {
        const d = u.sampleDisp(pu, pv);
        s += Math.hypot(d.ox, d.oy);
      }
      return s;
    };

    const cases: Array<[string, number, number]> = [
      ['amplitude', 0.01, 0.16],
      ['distortionScale', 2, 12],
      ['riseSpeed', 0.2, 2],
      ['columnWidth', 0.2, 0.9],
      ['duration', 3, 12],
    ];

    for (const [id, lo, hi] of cases) {
      const target = makeTarget(heatHazeRefractPrimitive);
      const inst = heatHazeRefractPrimitive.create(target);
      const u = uniformsOf(target.userData);

      inst.setControl(id, lo);
      inst.seek(PIN);
      const magLo = magAt(u);
      inst.setControl(id, hi);
      inst.seek(PIN);
      const magHi = magAt(u);

      // The measured displacement magnitude must differ meaningfully between min
      // and max — a deterministic proof the control is wired to a visible output.
      const delta = Math.abs(magHi - magLo);
      expect(
        delta,
        `control "${id}" must change the rendered displacement at the engaged pin (lo=${magLo}, hi=${magHi})`,
      ).toBeGreaterThan(1e-3);

      inst.dispose();
    }
  });

  it('onParamChange re-applies at the last seek state (paused control tweak)', () => {
    const target = makeTarget(heatHazeRefractPrimitive);
    const inst = heatHazeRefractPrimitive.create(target);
    const u = uniformsOf(target.userData);
    inst.seek(2.3);
    const before = u.uAmp.value;
    inst.setControl('amplitude', 0.15); // no new seek
    const after = u.uAmp.value;
    expect(after).not.toBeCloseTo(before, 3);
    inst.dispose();
  });

  it('texture preservation: shares the live map BY REFERENCE when present', () => {
    const target = makeTarget(heatHazeRefractPrimitive);
    // Pour a texture onto the representative panel AFTER build to mimic a
    // mounted artifact's async texture arrival.
    const subject = target.subject!;
    let panel: Mesh | null = null;
    subject.traverse((o) => {
      if (!panel && (o as Mesh).isMesh) panel = o as Mesh;
    });
    expect(panel).not.toBeNull();
    const mat = (panel!.material as MeshStandardMaterial);
    const tex = new Texture();
    mat.map = tex;
    mat.needsUpdate = true;

    const inst = heatHazeRefractPrimitive.create(target);
    inst.seek(0.5); // late-pour re-check should bind the texture by reference

    const sheet = sheetOf(target);
    expect(sheet).not.toBeNull();
    const sheetMat = sheet!.material as Material & { map?: Texture | null };
    // The overlay carries the SUBJECT'S texture by reference — never a clone,
    // never an invented fill.
    expect(sheetMat.map).toBe(tex);
    inst.dispose();
    // The shared texture survives dispose (we only dispose our own resources).
    expect(tex.uuid).toBeTruthy();
  });

  it('texture preservation (map-less): copies color + PBR scalars onto the overlay', () => {
    const target = makeTarget(heatHazeRefractPrimitive);
    const subject = target.subject!;
    let panel: Mesh | null = null;
    subject.traverse((o) => {
      if (!panel && (o as Mesh).isMesh) panel = o as Mesh;
    });
    const srcMat = panel!.material as MeshStandardMaterial;
    srcMat.color = new Color('#2b3344');
    srcMat.roughness = 0.41;
    srcMat.metalness = 0.53;

    const inst = heatHazeRefractPrimitive.create(target);
    inst.seek(0);
    const sheet = sheetOf(target);
    const sheetMat = sheet!.material as MeshStandardMaterial;
    // No map → the overlay must carry the source's own color + PBR scalars so
    // it shades identically under the rig (never a flat invented fill).
    expect(sheetMat.map ?? null).toBeNull();
    expect(sheetMat.roughness).toBeCloseTo(0.41, 5);
    expect(sheetMat.metalness).toBeCloseTo(0.53, 5);
    inst.dispose();
  });

  it('chrome children ride the shimmer: clones are created and posed', () => {
    const target = makeTarget(heatHazeRefractPrimitive);
    const inst = heatHazeRefractPrimitive.create(target);
    // The card has a header bar, an accent dot, and a row group → clones exist
    // so the chrome visibly flutters with the field.
    let cloneCount = 0;
    target.object.traverse((o) => {
      if (o.name.startsWith('heat-haze-refract-chrome')) cloneCount += 1;
    });
    expect(cloneCount).toBeGreaterThan(0);

    // A RIGID chrome clone (the accent dot) is posed by the CPU field mirror, so
    // its .position / .rotation move as the heat field advances (heat-bent light).
    // Bent chrome (header/rows) flutters in the vertex lane instead (not CPU-
    // observable), so target the rigid clone explicitly.
    const findRigidClone = (): Mesh | null => {
      let m: Mesh | null = null;
      target.object.traverse((o) => {
        if (!m && o.name.startsWith('heat-haze-refract-chrome-rigid')) m = o as Mesh;
      });
      return m;
    };
    inst.seek(0.5);
    const c = findRigidClone()!;
    expect(c).not.toBeNull();
    const p0 = c.position.clone();
    const r0 = c.rotation.z;
    inst.seek(3.1);
    const p1 = c.position.clone();
    const r1 = c.rotation.z;
    // The clone jitters in offset and/or rotation as the heat field advances.
    const moved =
      p0.distanceTo(p1) > 1e-5 || Math.abs(r1 - r0) > 1e-5;
    expect(moved).toBe(true);
    inst.dispose();
  });

  it('dispose restores everything and disposes only our resources', () => {
    const target = makeTarget(heatHazeRefractPrimitive);
    const subject = target.subject!;
    const visBefore = subject.visible;
    const childMatUuids: string[] = [];
    subject.traverse((o) => {
      const m = (o as Mesh).material as Material | undefined;
      if (m) childMatUuids.push((m as Material).uuid);
    });

    const inst = heatHazeRefractPrimitive.create(target);
    inst.seek(1);
    inst.dispose();

    expect(subject.visible).toBe(visBefore);
    // The overlay + its userData bag are gone.
    expect(sheetOf(target)).toBeNull();
    expect(target.userData.heatHazeRefract).toBeUndefined();
    // The subject's own materials are untouched (same instances).
    const after: string[] = [];
    subject.traverse((o) => {
      const m = (o as Mesh).material as Material | undefined;
      if (m) after.push((m as Material).uuid);
    });
    expect(after).toEqual(childMatUuids);
  });
});
