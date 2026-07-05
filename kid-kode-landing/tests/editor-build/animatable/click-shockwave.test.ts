import { describe, it, expect } from 'vitest';
import { Color, Mesh, MeshStandardMaterial, Texture } from 'three';
import { clickShockwavePrimitive } from '@/lib/prism/animatable/primitives/click-shockwave';
import { makeTarget, runConformance } from './_conformance';

type Uniform<T = number> = { value: T };
interface Stash {
  uRadius: Uniform;
  uWidth: Uniform;
  uKick: Uniform;
  uWobble: Uniform;
  uWobbleZ: Uniform; // STANDING corrugation z-amplitude (units) — re-renders at the pin
  uWobbleFreq: Uniform; // corrugation spatial frequency (rad/unit)
  getFireTime: () => number | null;
}

/** The pinned engaged rig point: state engaged. Under the standing-ring
 *  doctrine a single seek at the pin already holds a live crest (no repeated-t
 *  trick needed). */
function pinEngaged(target: ReturnType<typeof makeTarget>): void {
  target.userData.state = true;
}

/** Read the per-control uniform that a control level should move. For wobble we
 *  read the STANDING corrugation amplitude uWobbleZ — the channel that actually
 *  re-renders the frozen pose (uWobble alone was the r2 dead-control: a temporal
 *  UV shear that read byte-identical at the pin). */
function ctrlUniform(s: Stash, id: string): number {
  return id === 'width'
    ? s.uWidth.value
    : id === 'kick'
      ? s.uKick.value
      : id === 'wobble'
        ? s.uWobbleZ.value
        : s.uRadius.value; // speed shifts the live crest's radius at the pin
}

describe('click-shockwave primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(clickShockwavePrimitive).dispose();
  });

  it('declares the mountable + displacement + state metadata of the W3 class', () => {
    // The whole point of W3: a TEXTURE-PRESERVING displacement that runs on
    // mounted artifacts despite the category sitting in UNMOUNTABLE_CATEGORIES.
    expect(clickShockwavePrimitive.category).toBe('displacement');
    expect(clickShockwavePrimitive.mountable).toBe(true);
    expect(clickShockwavePrimitive.defaultDriver).toBe('state');
    expect(clickShockwavePrimitive.subject).toBe('card');
  });

  it('idle at t=0: surface fully undistorted and legible (zero kick / wobble)', () => {
    // The rig pins the idle frame at t=0. Whether disengaged (explicit state)
    // or in the self-fire tile loop, the surface MUST be flat at t=0 — the
    // detonation envelope is 0 at age 0, so no kick / no wobble / no warp.
    const target = makeTarget(clickShockwavePrimitive);
    const inst = clickShockwavePrimitive.create(target);
    const s = target.userData.clickShockwave as Stash;

    inst.seek(0);
    expect(s.uKick.value).toBeCloseTo(0, 6);
    expect(s.uWobble.value).toBeCloseTo(0, 6);
    inst.dispose();
  });

  it('explicit disengaged state: no detonation is ever stamped (clean idle)', () => {
    const target = makeTarget(clickShockwavePrimitive);
    target.userData.state = false; // explicitly disengaged
    const inst = clickShockwavePrimitive.create(target);
    const s = target.userData.clickShockwave as Stash;

    inst.seek(0);
    inst.seek(1.0);
    inst.seek(2.0);
    // No rising edge ever fired -> no live ring, zero kick the whole time.
    expect(s.getFireTime()).toBeNull();
    expect(s.uRadius.value).toBeLessThan(0);
    expect(s.uKick.value).toBeCloseTo(0, 6);
    inst.dispose();
  });

  it('texture preservation: overlay sheet carries the subject look, real subject untouched + hidden', () => {
    const target = makeTarget(clickShockwavePrimitive);
    const subjectMesh = target.subject as Mesh;
    const origMat = subjectMesh.material; // the catalog panel material
    const inst = clickShockwavePrimitive.create(target);

    // The real subject's material is NEVER swapped (texture-preserving class),
    // and the subject is hidden behind the overlay while active.
    expect(subjectMesh.material).toBe(origMat);
    expect(subjectMesh.visible).toBe(false);

    // A sibling overlay sheet exists carrying a node material (its own look).
    const sheet = target.object.getObjectByName('click-shockwave-sheet') as Mesh | null;
    expect(sheet).not.toBeNull();
    const sheetMat = sheet!.material as unknown as {
      colorNode?: unknown;
      positionNode?: unknown;
      normalNode?: unknown;
      roughness: number;
      metalness: number;
    };
    expect(sheetMat.colorNode).toBeDefined(); // carries the subject's color/map
    expect(sheetMat.positionNode).toBeDefined(); // the vertex-lane ring
    expect(sheetMat.normalNode).toBeDefined(); // honest bent normals
    // PBR scalars copied from the panel so it shades identically under the rig.
    const panel = origMat as MeshStandardMaterial;
    expect(sheetMat.roughness).toBeCloseTo(panel.roughness, 5);
    expect(sheetMat.metalness).toBeCloseTo(panel.metalness, 5);

    inst.dispose();
    // dispose restores visibility and leaves the subject's own material intact.
    expect(subjectMesh.visible).toBe(true);
    expect(subjectMesh.material).toBe(origMat);
  });

  it('texture preservation: when the live material has a .map, the sheet samples it BY REFERENCE', () => {
    const target = makeTarget(clickShockwavePrimitive);
    const subjectMesh = target.subject as Mesh;
    const tex = new Texture();
    (subjectMesh.material as MeshStandardMaterial).map = tex;

    const inst = clickShockwavePrimitive.create(target);
    inst.seek(0.1); // a seek triggers the late-pour rebuild path

    const sheet = target.object.getObjectByName('click-shockwave-sheet') as Mesh;
    const sheetMat = sheet.material as unknown as { colorNode?: { value?: unknown } };
    // colorNode is a texture(map, warpedUv) node — the shared Texture instance
    // must be the SUBJECT's own (by reference), never a clone/invented fill.
    const node = sheetMat.colorNode as { value?: unknown } | undefined;
    // three's texture() node stashes the Texture on .value.
    expect(node?.value).toBe(tex);

    inst.dispose();
    expect((subjectMesh.material as MeshStandardMaterial).map).toBe(tex); // untouched
  });

  it('engaged: a STANDING ring runs — at every mid-cycle phase a live crest kicks the surface (W3 standing-ring doctrine)', () => {
    // THE W3 FIX: while engaged the ring is not a one-shot that decays to flat
    // forever — it is a REPEATING traveling crest, a standing function of phase.
    // The original defect was that the rig pins seek(t=1) AFTER a one-shot front
    // had passed, so the frame read DEAD. Here we prove a live, substantial ring
    // exists at the harness pin and across the cycle.
    const target = makeTarget(clickShockwavePrimitive);
    target.userData.state = false; // explicitly disengaged
    const inst = clickShockwavePrimitive.create(target);
    const s = target.userData.clickShockwave as Stash;

    // Disengaged + idle: no ring.
    inst.seek(0);
    expect(s.getFireTime()).toBeNull();
    expect(s.uRadius.value).toBeLessThan(0);
    expect(s.uKick.value).toBeCloseTo(0, 6);

    // Engage. The harness pins control sweeps at seek(t=1) — that frame MUST
    // hold a SUBSTANTIAL live crest (the previously-dead pin).
    target.userData.state = true;
    inst.seek(1.0);
    expect(s.uRadius.value).toBeGreaterThan(0); // a live crest is on the card
    expect(s.uKick.value).toBeGreaterThan(0.05); // substantially kicking the surface
    expect(s.uWobble.value).toBeGreaterThan(0); // and shearing the surface look

    // The ring RACES outward as the clock advances (radius grows within a cycle).
    inst.seek(1.0);
    const r0 = s.uRadius.value;
    inst.seek(1.12);
    const r1 = s.uRadius.value;
    expect(r1).toBeGreaterThan(r0 + 0.05);

    // It is a STANDING ring: sampling many distinct mid-cycle phases, the crest
    // is live and the surface kicked at (almost) every one — never a persistent
    // dead after-state. (We allow the rare phase that lands on the recycle seam.)
    let liveFrames = 0;
    const N = 40;
    for (let i = 1; i <= N; i++) {
      inst.seek(1.0 + i * 0.043);
      if (s.uRadius.value > 0 && s.uKick.value > 0.02) liveFrames++;
    }
    // The vast majority of phases hold a live crest (a one-shot would go dead
    // after the first ~third and stay dead).
    expect(liveFrames).toBeGreaterThan(N * 0.7);

    inst.dispose();
  });

  it('disengage stops the ring; re-engage runs it again (clean on/off)', () => {
    const target = makeTarget(clickShockwavePrimitive);
    target.userData.state = false;
    const inst = clickShockwavePrimitive.create(target);
    const s = target.userData.clickShockwave as Stash;

    // Engaged: a live ring runs at the pin.
    target.userData.state = true;
    inst.seek(2.0);
    expect(s.uRadius.value).toBeGreaterThan(0);
    expect(s.uKick.value).toBeGreaterThan(0.05);

    // Disengage -> the ring is gone, surface clean (no live crest, zero kick).
    target.userData.state = false;
    inst.seek(3.0);
    expect(s.uRadius.value).toBeLessThan(0);
    expect(s.uKick.value).toBeCloseTo(0, 6);
    expect(s.getFireTime()).toBeNull();

    // Re-engage -> the standing ring runs again at the next pin.
    target.userData.state = true;
    inst.seek(5.0);
    expect(s.uRadius.value).toBeGreaterThan(0);
    expect(s.uKick.value).toBeGreaterThan(0.05);

    inst.dispose();
  });

  it('controls reshape a LIVE ring at the pinned engaged state (one seek, then re-seek per level)', () => {
    const target = makeTarget(clickShockwavePrimitive);
    pinEngaged(target);
    const inst = clickShockwavePrimitive.create(target);
    const s = target.userData.clickShockwave as Stash;

    // Standing-ring doctrine: a SINGLE engaged seek already holds a live crest
    // (no repeated-t trick). This is the pin the rig captures controls at.
    const T = 1.5;
    inst.seek(T);
    expect(s.uRadius.value).toBeGreaterThan(0);
    expect(s.uKick.value).toBeGreaterThan(0.05);

    // width: a wider ring widens the cross-section uniform at the pinned state.
    inst.setControl('width', 0.04);
    inst.seek(T);
    const wNarrow = s.uWidth.value;
    inst.setControl('width', 0.4);
    inst.seek(T);
    const wWide = s.uWidth.value;
    expect(wWide).toBeGreaterThan(wNarrow + 0.05);

    // kick: amplitude drives the surface-kick uniform at the live ring.
    inst.setControl('kick', 0.0);
    inst.seek(T);
    const kLow = s.uKick.value;
    inst.setControl('kick', 0.5);
    inst.seek(T);
    const kHigh = s.uKick.value;
    expect(kHigh).toBeGreaterThan(kLow + 0.05);

    // wobble: aftershock drives the UV refraction uniform at the live ring.
    inst.setControl('wobble', 0.0);
    inst.seek(T);
    const woLow = s.uWobble.value;
    inst.setControl('wobble', 0.12);
    inst.seek(T);
    const woHigh = s.uWobble.value;
    expect(woHigh).toBeGreaterThan(woLow + 0.01);

    inst.dispose();
  });

  it('wobble adds a STANDING radial corrugation to the pinned ring (the r2 dead-control fix)', () => {
    // THE r2 RESIDUAL DEFECT: control-wobble low/mid/high were byte-identical at
    // the pinned engaged pose (meanAbsDiff 0) because wobble drove only a temporal
    // UV shear that read sub-noise at a frozen frame. The fix maps wobble into a
    // STANDING z-corrugation sin(distC * freq) riding the ring band, so a higher
    // wobble visibly grooves the crest (extra ripples catching the rig light). We
    // prove that standing corrugation re-renders the engaged pose two ways:
    //   (1) the standing corrugation amplitude uWobbleZ scales low -> high, and
    //   (2) the rigid-chrome dot's ACTUAL z position (a measured rendered output)
    //       differs between low and high wobble at the SAME pinned phase.
    const target = makeTarget(clickShockwavePrimitive);
    target.userData.state = true; // engaged
    const inst = clickShockwavePrimitive.create(target);
    const s = target.userData.clickShockwave as Stash;

    // A spatial corrugation frequency must be set (several ripples per half-span).
    expect(s.uWobbleFreq.value).toBeGreaterThan(0);

    // Pick a phase where a live crest sits ON the dot so the corrugation actually
    // modulates the dot's z (the dot is off-center, so the ring must reach it).
    const rigid = (() => {
      let m: Mesh | null = null;
      target.object.traverse((o) => {
        if ((o as Mesh).isMesh && o.name.startsWith('click-shockwave-chrome-rigid')) m = o as Mesh;
      });
      return m as Mesh | null;
    })();
    expect(rigid).not.toBeNull();

    // Sweep the clock to find a phase where the crest overlaps the dot at a
    // sin() corrugation extreme; measure the dot z there for low vs high wobble.
    let bestT = 1.0;
    let bestDelta = 0;
    for (let i = 0; i <= 60; i++) {
      const T = 1.0 + i * 0.02;
      inst.setControl('wobble', 0.0);
      inst.seek(T);
      const zLow = rigid!.position.z;
      const wzLow = s.uWobbleZ.value;
      inst.setControl('wobble', 0.12);
      inst.seek(T);
      const zHigh = rigid!.position.z;
      const wzHigh = s.uWobbleZ.value;
      // The standing corrugation amplitude must scale with the control whenever a
      // live crest is present (uWobbleZ>0); when scaled it must move the dot z.
      if (wzHigh > 0.01) {
        expect(wzHigh).toBeGreaterThan(wzLow + 0.01); // amplitude scales
        const d = Math.abs(zHigh - zLow);
        if (d > bestDelta) {
          bestDelta = d;
          bestT = T;
        }
      }
    }
    // At the best-overlap phase the dot's rendered z is materially different
    // between smooth (wobble=0) and grooved (wobble=max) — the standing
    // corrugation re-renders the engaged frame, no longer byte-identical.
    expect(bestDelta, `dot z must move between low/high wobble (best at t=${bestT})`).toBeGreaterThan(1e-4);

    inst.dispose();
  });

  it('EVERY control is LIVE under the EXACT advocate harness stimulus (stateless tile, seek(1) once, then onParamChange per level)', () => {
    // This reproduces the precise capture the advocate ran and that BLOCKED the
    // tile: no userData.state (the catalog tile is stateless and self-fires),
    // controls pinned at seek(t=1) ONCE, then each control filled low/mid/high
    // which fires onParamChange -> apply(lastT=1) with NO further seek. The
    // original one-shot decayed before t=1 so width/kick/wobble read DEAD
    // (meanAbsDiff 0). Under the standing-ring fix each control must move a
    // measured uniform between its min and max at this exact pin.
    const target = makeTarget(clickShockwavePrimitive);
    delete (target.userData as Record<string, unknown>).state; // stateless, like the tile
    const inst = clickShockwavePrimitive.create(target);
    const s = target.userData.clickShockwave as Stash;

    inst.seek(0); // idle pin first (as the harness does)
    expect(s.uKick.value).toBeCloseTo(0, 6); // clean idle

    inst.seek(1); // the SINGLE controls pin
    // A substantial live crest must be present at the default params.
    expect(s.uRadius.value).toBeGreaterThan(0);
    expect(s.uKick.value).toBeGreaterThan(0.05);
    expect(s.uWobble.value).toBeGreaterThan(0);

    // Each control, swept min->max via onParamChange ONLY (no re-seek), must
    // change its measured output at this pin — a browser-free proof the control
    // is wired and visibly reshapes the engaged frame.
    const controls = [
      { id: 'speed', min: 0.4, max: 4, restore: 1.6 },
      { id: 'width', min: 0.04, max: 0.4, restore: 0.12 },
      { id: 'kick', min: 0, max: 0.5, restore: 0.2 },
      { id: 'wobble', min: 0, max: 0.12, restore: 0.04 },
    ] as const;
    for (const c of controls) {
      inst.setControl(c.id, c.min); // onParamChange -> apply(lastT=1), no seek
      const lo = ctrlUniform(s, c.id);
      inst.setControl(c.id, c.max);
      const hi = ctrlUniform(s, c.id);
      // The control moved its measured output by a real, non-trivial margin.
      expect(Math.abs(hi - lo), `${c.id} must change its measured output at the pin`).toBeGreaterThan(0.01);
      inst.setControl(c.id, c.restore); // independence between controls
    }

    inst.dispose();
  });

  it('onParamChange re-applies at the last seek state without a new seek', () => {
    const target = makeTarget(clickShockwavePrimitive);
    pinEngaged(target);
    const inst = clickShockwavePrimitive.create(target);
    const s = target.userData.clickShockwave as Stash;

    inst.seek(1.4); // a single engaged seek already holds a live crest
    expect(s.uKick.value).toBeGreaterThan(0);

    // Changing kick WITHOUT a new seek must re-apply at the pinned ring.
    const before = s.uKick.value;
    inst.setControl('kick', 0.5);
    const after = s.uKick.value; // re-applied via onParamChange
    expect(after).not.toBeCloseTo(before, 3);

    inst.dispose();
  });

  it('chrome co-treatment: the card chrome rides the field — bent clones + a rigid dot exist', () => {
    const target = makeTarget(clickShockwavePrimitive);
    const inst = clickShockwavePrimitive.create(target);

    // The catalog card has a brass header + 3 grey rows (wide -> bent clones)
    // and a violet accent dot (small -> rigid clone). Both clone classes must
    // exist so the FULL card look rides the ring (no blank deformed slab).
    const bent: Mesh[] = [];
    const rigid: Mesh[] = [];
    target.object.traverse((o) => {
      if ((o as Mesh).isMesh && o.name.startsWith('click-shockwave-chrome-bent')) bent.push(o as Mesh);
      if ((o as Mesh).isMesh && o.name.startsWith('click-shockwave-chrome-rigid')) rigid.push(o as Mesh);
    });
    expect(bent.length).toBeGreaterThanOrEqual(1); // header + rows
    expect(rigid.length).toBeGreaterThanOrEqual(1); // the dot

    // A rigid dot must actually MOVE as a ring crosses it (per-child kick).
    delete (target.userData as Record<string, unknown>).state;
    target.userData.state = true;
    inst.seek(1.0);
    const rigidMesh = rigid[0];
    const restZ = rigidMesh.position.z;
    // Sweep the ring outward; the dot's z must differ from rest at some frame
    // as the front crosses its radius.
    let kicked = false;
    for (let i = 0; i <= 30; i++) {
      inst.seek(1.0 + i * 0.03);
      if (Math.abs(rigidMesh.position.z - restZ) > 1e-4) {
        kicked = true;
        break;
      }
    }
    expect(kicked).toBe(true);

    inst.dispose();
  });

  it('chrome material copies the child color (never an invented fill)', () => {
    const target = makeTarget(clickShockwavePrimitive);
    const inst = clickShockwavePrimitive.create(target);

    // The brass header bar's bent clone must carry the brass color, not a
    // flat invented fill.
    const headerSrc = (target.subject as Mesh).getObjectByName('card-header') as Mesh;
    const headerColor = (headerSrc.material as MeshStandardMaterial).color.clone();

    let bentHeader: Mesh | null = null;
    target.object.traverse((o) => {
      if ((o as Mesh).isMesh && o.name === 'click-shockwave-chrome-bent:card-header') {
        bentHeader = o as Mesh;
      }
    });
    expect(bentHeader).not.toBeNull();
    const cloneColor = (bentHeader!.material as unknown as { color: Color }).color;
    expect(cloneColor.getHexString()).toBe(headerColor.getHexString());

    inst.dispose();
  });

  it('dispose restores everything it touched (visibility, transform, no overlay left)', () => {
    const target = makeTarget(clickShockwavePrimitive);
    const subjectMesh = target.subject as Mesh;
    const inst = clickShockwavePrimitive.create(target);

    target.userData.state = true;
    inst.seek(1.0);
    inst.seek(1.3);
    expect(subjectMesh.visible).toBe(false);

    inst.dispose();
    // Subject visible again; overlay removed; stash cleared.
    expect(subjectMesh.visible).toBe(true);
    expect(target.object.getObjectByName('click-shockwave-overlay')).toBeFalsy();
    expect(target.userData.clickShockwave).toBeUndefined();
  });
});
