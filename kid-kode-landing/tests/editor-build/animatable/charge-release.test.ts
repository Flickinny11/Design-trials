import { describe, it, expect } from 'vitest';
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  type Object3D,
} from 'three';
import { chargeReleasePrimitive } from '@/lib/prism/animatable/primitives/charge-release';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

const EDGE_OVERLAY = 'charge-release-edge';
const RING_OVERLAY = 'charge-release-ring';

function findByName(root: Object3D, name: string): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((o) => {
    if (!found && o.name === name) found = o;
  });
  return found;
}

interface ChargeUniforms {
  uCharge: { value: number };
  uEdgeColor: { value: { r: number; g: number; b: number } };
  uRingT: { value: number };
}

/** A mounted-artifact-shaped target: subject is a GROUP (e.g. the MSDF
 *  'text-object') with a textured Mesh child — what bindings hands a pointer
 *  primitive in the real app. Exercises the Group code path. */
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

describe('charge-release primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(chargeReleasePrimitive).dispose();
  });

  // ── Physics response across a moving pointer ───────────────────────────
  it('physics: holding near center CHARGES — card compresses (y squash, x bulge) and charge climbs over consecutive seeks', () => {
    const target = makeTarget(chargeReleasePrimitive);
    const inst = chargeReleasePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const uni = target.userData.chargeReleaseUniforms as ChargeUniforms;
    const baseY = mesh.scale.y;
    const baseX = mesh.scale.x;

    // Disengaged idle anchor at t=0.
    target.userData.pointer = { x: 0.05, y: 0.95 };
    inst.seek(0);
    const charge0 = uni.uCharge.value;

    // Hold the cursor right on the card center across consecutive seeks: the
    // charge integrates UP (dt-normalized), and the card squashes.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0.15);
    const chargeA = uni.uCharge.value;
    inst.seek(0.45);
    const chargeB = uni.uCharge.value;
    inst.seek(0.95);
    const chargeC = uni.uCharge.value;

    // Charge accumulates monotonically while engaged.
    expect(chargeA).toBeGreaterThan(charge0);
    expect(chargeB).toBeGreaterThan(chargeA);
    expect(chargeC).toBeGreaterThan(chargeB);
    expect(chargeC).toBeGreaterThan(0.3);

    // Compression: y squashes (shorter), x bulges (wider).
    expect(mesh.scale.y).toBeLessThan(baseY);
    expect(mesh.scale.x).toBeGreaterThan(baseX);

    inst.dispose();
  });

  it('physics: break away from a charged card RELEASES — scale pops above rest and a light ring is born', () => {
    const target = makeTarget(chargeReleasePrimitive);
    const inst = chargeReleasePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const uni = target.userData.chargeReleaseUniforms as ChargeUniforms;
    const baseY = mesh.scale.y;

    // Charge it up holding near center.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0.2);
    inst.seek(0.6);
    inst.seek(1.0);
    const chargedY = mesh.scale.y;
    expect(chargedY).toBeLessThan(baseY); // compressed while charged

    // Break away: proximity drops below the release threshold -> RELEASE.
    target.userData.pointer = { x: 0.02, y: 0.98 };
    inst.seek(1.05); // release fires here
    // A light ring is born at release: its normalized progress starts low.
    const ringJustFired = uni.uRingT.value;
    inst.seek(1.18); // just after release: spring overshoots TALL (above rest)
    const overshootY = mesh.scale.y;

    // Overshoot springs the card taller than its rest height (a crack of light).
    expect(overshootY).toBeGreaterThan(baseY);
    // Ring progresses outward after the release.
    expect(uni.uRingT.value).toBeGreaterThan(ringJustFired);

    // It settles back to rest with no lingering charge once disengaged a while.
    for (let i = 0; i < 30; i++) inst.seek(1.2 + i * 0.1);
    expect(uni.uCharge.value).toBeLessThan(0.02);
    expect(mesh.scale.y).toBeCloseTo(baseY, 2);

    inst.dispose();
  });

  // ── Controls reshape the PINNED ENGAGED state {0.62, 0.5} ──────────────
  it('controls change output at the pinned engaged state {0.62,0.5} (repeated seeks at the same t)', () => {
    const seekTo = (inst: ReturnType<typeof chargeReleasePrimitive.create>) => {
      // Warm the charge to its engaged equilibrium with repeated seeks, then
      // pin like the harness does (repeated seeks at the SAME t).
      for (let i = 0; i < 24; i++) inst.seek(i * 0.1);
      for (let i = 0; i < 6; i++) inst.seek(2.4); // pinned
    };

    // compressionDepth sweep reshapes the squash at the pinned engaged pose.
    {
      const target = makeTarget(chargeReleasePrimitive);
      target.userData.pointer = { x: 0.62, y: 0.5 };
      const inst = chargeReleasePrimitive.create(target);
      const mesh = target.subject as Mesh;
      const baseY = mesh.scale.y;

      inst.setControl('compressionDepth', 0.05);
      seekTo(inst);
      const squashShallow = baseY - mesh.scale.y;

      inst.setControl('compressionDepth', 0.45);
      for (let i = 0; i < 6; i++) inst.seek(2.4); // re-pin -> onParamChange + apply
      const squashDeep = baseY - mesh.scale.y;

      expect(squashDeep).toBeGreaterThan(squashShallow + 0.05);
      inst.dispose();
    }

    // tremble sweep reshapes the micro-offset amplitude at the pinned pose.
    {
      const target = makeTarget(chargeReleasePrimitive);
      target.userData.pointer = { x: 0.62, y: 0.5 };
      const inst = chargeReleasePrimitive.create(target);
      const uni = target.userData.chargeReleaseUniforms as ChargeUniforms & {
        trembleAmp: { value: number };
      };

      inst.setControl('tremble', 0);
      seekTo(inst);
      const trembleLow = uni.trembleAmp.value;

      inst.setControl('tremble', 1);
      for (let i = 0; i < 6; i++) inst.seek(2.4);
      const trembleHigh = uni.trembleAmp.value;

      expect(trembleHigh).toBeGreaterThan(trembleLow);
      inst.dispose();
    }

    // chargeRate sweep changes how fast charge reaches equilibrium — reshapes
    // the edge-heat brightness at the pinned engaged pose over a fixed schedule.
    {
      const target = makeTarget(chargeReleasePrimitive);
      target.userData.pointer = { x: 0.62, y: 0.5 };
      const inst = chargeReleasePrimitive.create(target);
      const uni = target.userData.chargeReleaseUniforms as ChargeUniforms;

      // Same short schedule both times — a faster rate accumulates more charge.
      inst.setControl('chargeRate', 0.2);
      inst.seek(0);
      inst.seek(0.1);
      inst.seek(0.2);
      const slow = uni.uCharge.value;

      const t2 = makeTarget(chargeReleasePrimitive);
      t2.userData.pointer = { x: 0.62, y: 0.5 };
      const inst2 = chargeReleasePrimitive.create(t2);
      const uni2 = t2.userData.chargeReleaseUniforms as ChargeUniforms;
      inst2.setControl('chargeRate', 4);
      inst2.seek(0);
      inst2.seek(0.1);
      inst2.seek(0.2);
      const fast = uni2.uCharge.value;

      expect(fast).toBeGreaterThan(slow);
      inst.dispose();
      inst2.dispose();
    }
  });

  it('settle/restore-home: a disengaged pointer at t=0 leaves the card FULLY at home pose (legible idle)', () => {
    const target = makeTarget(chargeReleasePrimitive);
    const mesh = target.subject as Mesh;
    const home = {
      sx: mesh.scale.x,
      sy: mesh.scale.y,
      sz: mesh.scale.z,
      px: mesh.position.x,
      py: mesh.position.y,
    };
    const inst = chargeReleasePrimitive.create(target);

    // Idle: pinned t=0, pointer disengaged (far corner).
    target.userData.pointer = { x: 0.02, y: 0.98 };
    inst.seek(0);

    expect(mesh.scale.x).toBeCloseTo(home.sx, 5);
    expect(mesh.scale.y).toBeCloseTo(home.sy, 5);
    expect(mesh.scale.z).toBeCloseTo(home.sz, 5);
    expect(mesh.position.x).toBeCloseTo(home.px, 5);
    expect(mesh.position.y).toBeCloseTo(home.py, 5);

    inst.dispose();
  });

  // ── Subject material safety + dispose ──────────────────────────────────
  it('REGRESSION: never swaps the subject material — identical reference before, during, after', () => {
    const target = makeTarget(chargeReleasePrimitive);
    const mesh = target.subject as Mesh;
    const originalMaterial = mesh.material;

    const inst = chargeReleasePrimitive.create(target);
    expect(mesh.material).toBe(originalMaterial);
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0.4);
    inst.seek(0.8);
    expect(mesh.material).toBe(originalMaterial);

    inst.dispose();
    expect(mesh.material).toBe(originalMaterial);
  });

  it('dispose restores transform + removes both additive overlays', () => {
    const target = makeTarget(chargeReleasePrimitive);
    const mesh = target.subject as Mesh;
    const home = {
      sx: mesh.scale.x,
      sy: mesh.scale.y,
      sz: mesh.scale.z,
      px: mesh.position.x,
      py: mesh.position.y,
    };
    const inst = chargeReleasePrimitive.create(target);

    // Edge overlay exists, is additive + transparent, parented under subject.
    const edge = findByName(target.object, EDGE_OVERLAY) as Mesh | null;
    expect(edge, 'edge overlay exists while active').not.toBeNull();
    const emat = (edge as Mesh).material as { transparent: boolean; depthWrite: boolean };
    expect(emat.transparent).toBe(true);
    expect(emat.depthWrite).toBe(false);

    // Charge + release so a ring is alive at dispose time.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0.3);
    inst.seek(0.7);
    target.userData.pointer = { x: 0.02, y: 0.98 };
    inst.seek(0.75); // release
    inst.seek(0.8);
    expect(findByName(target.object, RING_OVERLAY), 'ring overlay alive post-release').not.toBeNull();

    inst.dispose();

    // Both overlays gone, transform fully restored.
    expect(findByName(target.object, EDGE_OVERLAY)).toBeNull();
    expect(findByName(target.object, RING_OVERLAY)).toBeNull();
    expect(mesh.scale.x).toBeCloseTo(home.sx, 5);
    expect(mesh.scale.y).toBeCloseTo(home.sy, 5);
    expect(mesh.scale.z).toBeCloseTo(home.sz, 5);
    expect(mesh.position.x).toBeCloseTo(home.px, 5);
    expect(mesh.position.y).toBeCloseTo(home.py, 5);
  });

  it('Group subject (text-object): no crash, no bogus .material on the Group, overlays still created', () => {
    const { target, group, childMesh } = makeGroupSubjectTarget();
    const childMaterial = childMesh.material;

    const inst = chargeReleasePrimitive.create(target);
    expect(
      (group as unknown as { material?: unknown }).material,
      'no bogus .material written onto the Group',
    ).toBeUndefined();
    expect(childMesh.material).toBe(childMaterial);

    const edge = findByName(target.object, EDGE_OVERLAY);
    expect(edge, 'edge overlay created for a Group subject').not.toBeNull();

    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0.3);
    inst.seek(0.7); // must not throw

    inst.dispose();
    expect(findByName(target.object, EDGE_OVERLAY)).toBeNull();
    expect(childMesh.material).toBe(childMaterial);
  });

  it('determinism: identical seek schedules produce identical transforms + charge', () => {
    const run = () => {
      const target = makeTarget(chargeReleasePrimitive);
      const inst = chargeReleasePrimitive.create(target);
      const mesh = target.subject as Mesh;
      const uni = target.userData.chargeReleaseUniforms as ChargeUniforms;
      target.userData.pointer = { x: 0.55, y: 0.48 };
      const ts = [0, 0.12, 0.31, 0.5, 0.77, 1.0, 1.3];
      for (const t of ts) inst.seek(t);
      const out = {
        sx: mesh.scale.x,
        sy: mesh.scale.y,
        px: mesh.position.x,
        py: mesh.position.y,
        charge: uni.uCharge.value,
      };
      inst.dispose();
      return out;
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b);
  });
});
