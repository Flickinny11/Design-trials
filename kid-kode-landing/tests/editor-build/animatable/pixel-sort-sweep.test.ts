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
} from 'three';
import { pixelSortSweepPrimitive } from '@/lib/prism/animatable/primitives/pixel-sort-sweep';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

/** Uniform handles the primitive publishes for headless observability (the
 *  water-droplet pattern — the smear/streak math lives in the TSL lanes on the
 *  GPU, so tests observe the driven uniforms, the scene graph, and material
 *  identity rather than sampling pixels). */
interface SweepHandles {
  uPhase: { value: number };
  uBandCenter: { value: number };
  uBandWidth: { value: number };
  uStreak: { value: number };
  uStreakFrac: { value: number };
  uAxis: { value: number };
  uDirSign: { value: number };
  uSpan: { value: number };
  uColor: { value: { getHexString(): string } };
  uHasMap: { value: number };
}
const handlesOf = (t: AnimatableTarget): SweepHandles =>
  t.userData.pixelSortSweep as SweepHandles;

/** The overlay sheet mesh anywhere under the root (sibling of the hidden
 *  subject — a hidden parent hides its children, so it can't live under it). */
function sheetOf(root: Object3D): Mesh {
  let found: Mesh | null = null;
  root.traverse((o) => {
    if (o.name === 'pixel-sort-sweep-sheet') found = o as Mesh;
  });
  if (!found) throw new Error('pixel-sort-sweep sheet not found');
  return found;
}

function overlayNodesIn(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o.name.startsWith('pixel-sort-sweep')) n++;
  });
  return n;
}

/** The catalog verification rig PINS the ENGAGED/controls frame at the
 *  primitive clock t=1 (paused). phaseAt() remaps that to p=0.5 so the
 *  wavefront sits mid-card. Every "engaged" assertion seeks here — exactly what
 *  the advocate screenshots. */
const ENGAGED_T = 1;

// ── Browser-free JS mirror of the primitive's TSL band + vertex-streak math ──
// (the water-droplet pattern: the GPU math runs nowhere in node, so we replicate
// the exact field + displacement on the CPU to PROVE the effect amplitude and
// that each control re-shapes the sampled output at the engaged frame). These
// must stay in lock-step with pixel-sort-sweep.ts.
const STREAK_PULL = 0.9;
const smoothstep01 = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1e-9)));
  return t * t * (3 - 2 * t);
};
/** Leading-edge field at along-coordinate `cAlong` (peaks at the front, decays
 *  AHEAD, ~0 behind). Mirror of bandField in the shader. */
function fieldAt(cAlong: number, center: number, bandWidth: number, dirSign = 1): number {
  const halfBand = Math.max(bandWidth * 0.5, 1e-4);
  const trailLen = halfBand * 0.35;
  const ahead = (cAlong - center) * dirSign;
  const lead = smoothstep01(halfBand, 0, Math.max(ahead, 0));
  const trail = smoothstep01(-trailLen, 0, Math.min(Math.max(ahead, -trailLen), 0));
  return Math.min(1, Math.max(0, lead * trail));
}
/** Per-row pull hash — mirror of rowHashV in the vertex lane. */
function pullHash(rowSeed: number): number {
  const s = Math.sin(Math.floor(rowSeed * 48) * 45.233) * 43758.5453;
  const h = s - Math.floor(s);
  return h * 0.6 + 0.4;
}
/** Along-axis vertex displacement at (cAlong, rowSeed) — mirror of dispMag. */
function dispAt(
  cAlong: number,
  rowSeed: number,
  center: number,
  bandWidth: number,
  streakFrac: number,
  dirSign = 1,
): number {
  return fieldAt(cAlong, center, bandWidth, dirSign) * streakFrac * STREAK_PULL * pullHash(rowSeed) * dirSign;
}
/** The leading-edge field at a point `aheadDist` AHEAD of the current wavefront
 *  (in local units), at the current engaged uniforms. A wider band reaches
 *  farther ahead, so this rises with bandWidth — a measured bandWidth proof. */
function fieldAtCenterRow(ud: SweepHandles, aheadDist: number): number {
  const center = ud.uBandCenter.value;
  const dir = ud.uDirSign.value;
  const cAlong = center + aheadDist * dir; // a fixed point ahead of the front
  return fieldAt(cAlong, center, ud.uBandWidth.value, dir);
}

/** Peak |displacement| sampled across the span at the current engaged uniforms —
 *  the strongest streak any row gets. */
function peakDisp(ud: SweepHandles, rows = 64, cols = 96): number {
  const span = ud.uSpan.value;
  const center = ud.uBandCenter.value;
  const bw = ud.uBandWidth.value;
  const sf = ud.uStreakFrac.value;
  const dir = ud.uDirSign.value;
  let peak = 0;
  for (let r = 0; r < rows; r++) {
    const rowSeed = -span / 2 + (span * r) / (rows - 1);
    for (let c = 0; c < cols; c++) {
      const cAlong = -span / 2 + (span * c) / (cols - 1);
      peak = Math.max(peak, Math.abs(dispAt(cAlong, rowSeed, center, bw, sf, dir)));
    }
  }
  return peak;
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

describe('pixel-sort-sweep primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pixelSortSweepPrimitive).dispose();
  });

  it('declares the texture-preserving mount override (displacement + mountable)', () => {
    expect(pixelSortSweepPrimitive.category).toBe('displacement');
    expect(pixelSortSweepPrimitive.mountable).toBe(true);
    expect(pixelSortSweepPrimitive.subject).toBe('card');
    expect(pixelSortSweepPrimitive.defaultDriver).toBe('time');
  });

  it('idle frame: at t=0 the band sits OFF the subject so the card is fully legible', () => {
    const target = makeTarget(pixelSortSweepPrimitive);
    const inst = pixelSortSweepPrimitive.create(target);
    const ud = handlesOf(target);

    inst.seek(0);
    // The band is parked at/before the start edge — its leading falloff has not
    // entered the visible span, so no row is smeared at rest.
    const span = ud.uSpan.value;
    const halfBand = ud.uBandWidth.value / 2;
    // Band center is at or below (min edge - half band): nothing inside frame.
    expect(ud.uBandCenter.value).toBeLessThanOrEqual(-span / 2 - halfBand + 1e-6);

    inst.dispose();
  });

  it('plays: the sweep band travels monotonically across the span over the loop', () => {
    const target = makeTarget(pixelSortSweepPrimitive);
    const inst = pixelSortSweepPrimitive.create(target);
    const ud = handlesOf(target);
    const dur = inst.duration();
    expect(Number.isFinite(dur)).toBe(true);

    // The sheet exists, sized from the MEASURED subject bbox, and the subject is
    // hidden while the sheet stands in for it.
    const sheet = sheetOf(target.scene);
    sheet.geometry.computeBoundingBox();
    const bb = sheet.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(1.74, 2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(1.12, 2);
    expect((target.subject as Mesh).visible).toBe(false);

    inst.seek(0.25 * dur);
    const c25 = ud.uBandCenter.value;
    inst.seek(0.5 * dur);
    const c50 = ud.uBandCenter.value;
    inst.seek(0.75 * dur);
    const c75 = ud.uBandCenter.value;

    // The band marches across the span (left -> right by default).
    expect(c50).toBeGreaterThan(c25);
    expect(c75).toBeGreaterThan(c50);
    // Mid-loop the band is somewhere inside the frame.
    expect(Math.abs(c50)).toBeLessThan(ud.uSpan.value / 2 + ud.uBandWidth.value);

    inst.dispose();
  });

  it('band covers a MINORITY of the surface (subject stays majority-legible at any phase)', () => {
    const target = makeTarget(pixelSortSweepPrimitive);
    const inst = pixelSortSweepPrimitive.create(target);
    const ud = handlesOf(target);
    // Default band width is < 40% of the span at every sampled phase.
    inst.seek(0.5 * inst.duration());
    expect(ud.uBandWidth.value).toBeLessThan(0.4 * ud.uSpan.value);
    inst.dispose();
  });

  it('engaged frame: the wavefront sits MID-CARD at substantial amplitude (no left-edge tear)', () => {
    const target = makeTarget(pixelSortSweepPrimitive);
    const inst = pixelSortSweepPrimitive.create(target);
    const ud = handlesOf(target);

    // Idle (t=0): the band is parked OFF the start edge → no displacement anywhere
    // on the visible card.
    inst.seek(0);
    expect(peakDisp(ud), 'idle frame is clean (no streak)').toBeLessThan(1e-3);

    // Engaged (the harness pin t=1 → phaseAt=0.5): the wavefront sits at the card
    // centre, NOT pinned to the left edge.
    inst.seek(ENGAGED_T);
    const span = ud.uSpan.value;
    expect(Math.abs(ud.uBandCenter.value), 'wavefront centred mid-card at engaged').toBeLessThan(span * 0.06);
    // The streak amplitude at the engaged frame is SUBSTANTIAL — a real tear, far
    // above the discoverability floor (a few % of the span).
    expect(peakDisp(ud), 'engaged streak is substantial').toBeGreaterThan(span * 0.08);

    inst.dispose();
  });

  it('controls are ALL live at the engaged frame: streak, bandWidth, speed each re-shape a measured output; direction remaps the axis', () => {
    const target = makeTarget(pixelSortSweepPrimitive);
    const inst = pixelSortSweepPrimitive.create(target);
    const ud = handlesOf(target);
    // Pin the ENGAGED frame the advocate samples (t=1, wavefront mid-card).
    inst.seek(ENGAGED_T);

    // ── streak (the previously-DEAD namesake control) ──────────────────────
    // It drives BOTH lanes; on the map-less catalog card it lengthens the
    // geometric forward-pull, so the sampled peak displacement grows low→high.
    inst.setControl('streak', 0.05);
    const streakSmallUniform = ud.uStreak.value;
    const streakSmallDisp = peakDisp(ud);
    inst.setControl('streak', 0.45);
    const streakLargeUniform = ud.uStreak.value;
    const streakLargeDisp = peakDisp(ud);
    // The uniform tracks the control (texture lane) …
    expect(streakLargeUniform).toBeGreaterThan(streakSmallUniform + 0.2);
    expect(ud.uStreakFrac.value).toBeCloseTo(streakLargeUniform, 6); // both lanes share it
    // … AND the sampled geometric streak measurably lengthens (map-less card):
    // the control is NOT dead at the engaged frame.
    expect(streakLargeDisp).toBeGreaterThan(streakSmallDisp + 0.05);
    inst.setControl('streak', 0.18);

    // ── bandWidth ──────────────────────────────────────────────────────────
    inst.setControl('bandWidth', 0.08);
    const wNarrow = ud.uBandWidth.value;
    const narrowField = fieldAtCenterRow(ud, 0.18); // sample a point 0.18 ahead
    inst.setControl('bandWidth', 0.36);
    const wWide = ud.uBandWidth.value;
    const wideField = fieldAtCenterRow(ud, 0.18);
    expect(wWide).toBeGreaterThan(wNarrow + 0.05);
    expect(wWide).toBeLessThan(0.4 * ud.uSpan.value); // stays a minority
    // A wider band reaches FARTHER ahead of the front, so a fixed point ahead of
    // the wavefront sees more field with the wide band — a measured change.
    expect(wideField).toBeGreaterThan(narrowField + 0.05);
    inst.setControl('bandWidth', 0.18);

    // ── direction remaps the axis + span ───────────────────────────────────
    expect(ud.uAxis.value).toBe(0);
    expect(ud.uSpan.value).toBeCloseTo(1.74, 5);
    inst.setControl('direction', 'vertical');
    expect(ud.uAxis.value).toBe(1);
    expect(ud.uSpan.value).toBeCloseTo(1.12, 5);
    inst.setControl('direction', 'horizontal');

    // ── speed: the r3 regression fix. `speed` (loop duration) is temporal, so
    // at a FROZEN frame a naive phase map renders it DEAD (the advocate read
    // control-speed low/mid/high byte-identical, changed=false). The fix folds
    // speed into the STANDING pose: at the engaged pin (t=1) a FASTER sweep has
    // carried the wavefront FARTHER across the card, so the front's x at t=1 is a
    // function of speed. Pin t=1 EXACTLY as the advocate capture does, then sweep
    // the slider: the standing wavefront position must measurably move.
    inst.setControl('speed', 2); // fast
    inst.seek(ENGAGED_T);
    const fastCenter = ud.uBandCenter.value;
    const fastDisp = peakDisp(ud);
    inst.setControl('speed', 9); // slow
    inst.seek(ENGAGED_T);
    const slowCenter = ud.uBandCenter.value;
    // A faster sweep lands the front FARTHER along (larger uBandCenter) at the
    // same pinned t=1 — the standing pose is a function of speed, so the slider
    // is NOT dead at the engaged frame. Demand a SUBSTANTIAL shift (well above
    // the advocate's noise floor), not a sub-pixel nudge.
    expect(fastCenter).toBeGreaterThan(slowCenter + ud.uSpan.value * 0.1);
    // And the named effect is still alive at the engaged pin for the fast pose
    // (the front is on-card, not parked off-edge) — the standing pose is a real
    // sort wave at every speed.
    expect(fastDisp, 'fast-speed engaged frame still streaks').toBeGreaterThan(
      ud.uSpan.value * 0.04,
    );
    // Re-pin the engaged frame the advocate samples without changing speed: a
    // continuously playing loop still sweeps the front fully across (monotonic
    // phase map) — t=0 is clean idle, t=dur exits off the far edge.
    inst.setControl('speed', 5);
    inst.seek(0);
    const idleCenter = ud.uBandCenter.value;
    inst.seek(5); // t = dur
    const endCenter = ud.uBandCenter.value;
    expect(endCenter).toBeGreaterThan(idleCenter); // band travelled across

    inst.dispose();
  });

  it('texture preservation: the sheet colorNode samples the subject OWN texture by reference (never an invented fill)', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    const inst = pixelSortSweepPrimitive.create(target);
    const sheet = sheetOf(target.scene);
    const ud = handlesOf(target);

    // The colorNode tree references the shared texture — proving the smear reads
    // the real artifact, not a procedural pattern. The texture appears as a
    // .value somewhere in the colorNode tree; the published flag confirms map mode.
    expect(ud.uHasMap.value).toBe(1);
    expect(sheet.material, 'sheet material is its own instance').not.toBe(subject.material);

    // The subject's own material was never mutated.
    expect((subject.material as MeshBasicMaterial).map).toBe(texture);
    expect((subject.material as MeshBasicMaterial).opacity).toBe(1);

    // Sheet geometry derives from the measured bbox (2 x 1, not the catalog 1.8).
    sheet.geometry.computeBoundingBox();
    const bb = sheet.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(2, 2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(1, 2);
    inst.seek(0.5 * inst.duration());
    expect(ud.uSpan.value).toBeCloseTo(2, 5);

    inst.dispose();
  });

  it('texture preservation: a map-less subject copies color + PBR scalars onto the sheet, tracked live (never an invented fill)', () => {
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

    const inst = pixelSortSweepPrimitive.create(target);
    const ud = handlesOf(target);
    expect(ud.uHasMap.value).toBe(0);
    expect(ud.uColor.value.getHexString()).toBe('88aa66');

    // Live tint tracking: recolor the source, seek, the map-less fallback follows.
    (subject.material as MeshBasicMaterial).color.set('#cd9f55');
    inst.seek(0.4);
    expect(ud.uColor.value.getHexString()).toBe('cd9f55');

    inst.dispose();
  });

  it('regression: a texture poured AFTER create reaches the sheet (async map pour → material rebuild)', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Mesh(
      new PlaneGeometry(2, 1),
      new MeshBasicMaterial({ transparent: true }), // map-less at attach
    );
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    };

    const inst = pixelSortSweepPrimitive.create(target);
    const sheet = sheetOf(scene);
    const ud = handlesOf(target);
    const matBefore = sheet.material as Material;
    expect(ud.uHasMap.value).toBe(0);

    // The pour lands on the subject's material (what default-factory does).
    const texture = new DataTexture(new Uint8Array([200, 160, 90, 255]), 1, 1, RGBAFormat);
    texture.needsUpdate = true;
    (subject.material as MeshBasicMaterial).map = texture;
    (subject.material as MeshBasicMaterial).needsUpdate = true;

    inst.seek(0.4);
    expect(sheet.material, 'material rebuilt for the poured texture').not.toBe(matBefore);
    expect(ud.uHasMap.value).toBe(1);

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

  it('chrome co-treatment: the card header/rows ride the band as bent clones, the dot as a rigid clone — subject chrome never mutated', () => {
    const target = makeTarget(pixelSortSweepPrimitive);
    const inst = pixelSortSweepPrimitive.create(target);

    const bent: Mesh[] = [];
    let rigid: Mesh | undefined;
    target.scene.traverse((o) => {
      if (o.name.startsWith('pixel-sort-sweep-chrome-bent:')) bent.push(o as Mesh);
      if (o.name.startsWith('pixel-sort-sweep-chrome-rigid:')) rigid = o as Mesh;
    });
    expect(bent.length, 'header + 3 rows become bent clones').toBe(4);
    expect(rigid, 'the dot becomes a rigid clone').toBeDefined();

    // Bent clones share the SAME bend trees as the sheet (one uniform set drives
    // the whole composite).
    const sheet = sheetOf(target.scene);
    const sheetNodes = sheet.material as Material & { positionNode?: unknown };
    for (const m of bent) {
      const mat = m.material as Material & { positionNode?: unknown };
      expect(mat.positionNode, 'bent clone shares the sheet bend tree').toBe(
        sheetNodes.positionNode,
      );
      expect(mat).not.toBe(sheet.material);
    }

    // The dot clone shares the subject child geometry BY REFERENCE but owns its
    // material clone; the original child is untouched.
    const subjectPanel = target.subject as Mesh;
    let srcDot: Mesh | undefined;
    subjectPanel.traverse((o) => {
      if (o.name === 'card-dot') srcDot = o as Mesh;
    });
    expect(srcDot).toBeDefined();
    expect(rigid!.geometry, 'rigid clone geometry shared by reference').toBe(srcDot!.geometry);
    expect(rigid!.material).not.toBe(srcDot!.material);

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

    // The rigid dot SHEARS when the wavefront crosses it. The leading-edge field
    // is narrow (peaks at the front), so the shear is maximal only when the front
    // sits at the dot's x — sweep the loop and take the rest pose vs the peak
    // pose. At t=0 (idle, band off-card) the dot rests at its clean position.
    const dur = inst.duration();
    inst.seek(0); // idle — band parked off the start edge
    const xRest = rigid!.position.x;
    let xPeak = xRest;
    for (let i = 1; i <= 40; i++) {
      inst.seek((i / 40) * dur);
      if (Math.abs(rigid!.position.x - xRest) > Math.abs(xPeak - xRest)) {
        xPeak = rigid!.position.x;
      }
    }
    // A SUBSTANTIAL lateral shear as the front drags the dot forward — well above
    // a sub-pixel wobble.
    expect(Math.abs(xPeak - xRest), 'dot shears substantially as the front crosses it').toBeGreaterThan(0.03);

    inst.dispose();
  });

  it('regression: the overlay tracks the subject LIVE local pose each seek (co-bindings tilt the hidden subject)', () => {
    const { target, subject } = makeTexturedTarget(2, 1);
    const inst = pixelSortSweepPrimitive.create(target);
    let overlay: Object3D | null = null;
    target.scene.traverse((o) => {
      if (o.name === 'pixel-sort-sweep-overlay') overlay = o;
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
    expect(grp.scale.x).toBeCloseTo(1.1, 6);

    inst.dispose();
  });

  it('dispose restores the subject and releases everything created (never subject resources)', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    expect(subject.visible).toBe(true);

    const inst = pixelSortSweepPrimitive.create(target);
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

  it('fallback: with no usable geometry/material it micro-displaces the WHOLE subject — nothing spawned, restored on dispose', () => {
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

    const inst = pixelSortSweepPrimitive.create(target);
    expect(overlayNodesIn(scene), 'no overlay spawned for an empty subject').toBe(0);
    expect(subject.visible, 'fallback never hides the subject it animates').toBe(true);

    const baseX = subject.position.x;
    // The harness pins the ENGAGED frame at the primitive clock t=1 (the
    // wavefront sits mid-card by phaseAt). The whole subject lurches along the
    // sweep axis while the front crosses its centre — a SUBSTANTIAL shove, not a
    // sub-pixel flicker.
    inst.seek(ENGAGED_T);
    const engagedX = subject.position.x;
    expect(
      Math.abs(engagedX - baseX),
      'whole subject lurches along the sweep axis at the engaged frame',
    ).toBeGreaterThan(0.01);

    inst.dispose();
    expect(subject.position.x, 'position restored after dispose').toBeCloseTo(baseX, 6);
  });
});
