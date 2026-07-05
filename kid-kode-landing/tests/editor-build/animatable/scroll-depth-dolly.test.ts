import { describe, it, expect } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Material, type Object3D } from 'three';
import { scrollDepthDollyPrimitive } from '@/lib/prism/animatable/primitives/scroll-depth-dolly';
import { makeTarget, runConformance } from './_conformance';

type FadableMaterial = Material & { opacity: number };

/** All materials in the subject subtree (what the primitive fades). */
function materialsUnder(root: Object3D): FadableMaterial[] {
  const out: FadableMaterial[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) out.push(mat as FadableMaterial);
  });
  return out;
}

/** Far-end → near-end z travel for a target/instance pair. */
function measureTravel(
  target: ReturnType<typeof makeTarget>,
  inst: { seek: (t: number) => void },
): number {
  const subject = target.subject as Mesh;
  target.userData.scroll = 0;
  inst.seek(0);
  const far = subject.position.z;
  target.userData.scroll = 1;
  inst.seek(0);
  return subject.position.z - far;
}

describe('scroll-depth-dolly primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollDepthDollyPrimitive).dispose();
  });

  it('plays: position.z and scale track scroll', () => {
    const target = makeTarget(scrollDepthDollyPrimitive);
    const inst = scrollDepthDollyPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // scroll near 0 → far + small
    target.userData.scroll = 0;
    inst.seek(0);
    const zFar = mesh.position.z;
    const scaleFar = mesh.scale.x;

    // scroll near 1 → near + large
    target.userData.scroll = 1;
    inst.seek(0);
    const zNear = mesh.position.z;
    const scaleNear = mesh.scale.x;

    // z dollies forward (toward the viewer = larger z)
    expect(zNear).toBeGreaterThan(zFar + 1);
    // coupled perspective scale grows
    expect(scaleNear).toBeGreaterThan(scaleFar + 0.3);
    inst.dispose();
  });

  it('controls change output: depth moves the far end of the dolly', () => {
    const target = makeTarget(scrollDepthDollyPrimitive);
    const inst = scrollDepthDollyPrimitive.create(target);
    const mesh = target.subject as Mesh;
    target.userData.scroll = 0; // sample the far end

    inst.setControl('depth', 6);
    inst.seek(0);
    const deep = mesh.position.z;

    inst.setControl('depth', 0.5);
    inst.seek(0);
    const shallow = mesh.position.z;

    // more depth pushes the card further from the viewer (smaller z)
    expect(shallow).toBeGreaterThan(deep + 5);
    inst.dispose();
  });

  it('fadeEnds dissolves the card only at the NEAR end (passing the viewer)', () => {
    const target = makeTarget(scrollDepthDollyPrimitive);
    const inst = scrollDepthDollyPrimitive.create(target);
    const mat = (target.subject as Mesh).material as FadableMaterial;

    target.userData.scroll = 0.5; // mid → full opacity
    inst.seek(0);
    const mid = mat.opacity;

    target.userData.scroll = 1; // past the viewer → faded
    inst.seek(0);
    const end = mat.opacity;

    expect(mid).toBeGreaterThan(end + 0.3);

    // fadeEnds OFF → no fade even at the near end.
    inst.setControl('fadeEnds', false);
    inst.seek(0);
    expect(mat.opacity).toBeGreaterThan(0.95);
    inst.dispose();
  });

  // ── REGRESSION: FIDELITY-2 "binding KILLED the headline (subject vanishes)" ──

  it('REGRESSION: never invisible at rest — scroll=0 keeps every material opacity >= 0.5 and scale >= 0.5x base', () => {
    const target = makeTarget(scrollDepthDollyPrimitive);
    const inst = scrollDepthDollyPrimitive.create(target);
    const subject = target.subject as Mesh;

    // Pages boot at scroll 0 — the subject must mount plainly visible
    // (distant: smaller + slightly dimmed is fine; never 0).
    target.userData.scroll = 0;
    inst.seek(0);
    for (const m of materialsUnder(subject)) {
      expect(m.opacity, 'material opacity at scroll=0').toBeGreaterThanOrEqual(0.5);
    }
    expect(subject.scale.x, 'scale.x at scroll=0').toBeGreaterThanOrEqual(0.5);
    expect(subject.scale.y, 'scale.y at scroll=0').toBeGreaterThanOrEqual(0.5);
    inst.dispose();
  });

  it('REGRESSION: z travel is subject-relative — doubling the subject scales the travel up', () => {
    // Mounted artifacts vary wildly in size: a 0.4-unit card and a 6-unit
    // headline must both dolly proportionally, not by a fixed -8..+3 world span.
    const small = makeTarget(scrollDepthDollyPrimitive);
    const big = makeTarget(scrollDepthDollyPrimitive);
    (big.subject as Mesh).scale.setScalar(2); // double the subject's footprint

    const smallInst = scrollDepthDollyPrimitive.create(small);
    const bigInst = scrollDepthDollyPrimitive.create(big);

    const smallTravel = measureTravel(small, smallInst);
    const bigTravel = measureTravel(big, bigInst);

    expect(smallTravel).toBeGreaterThan(0);
    // Double the subject → travel scales up with it (≈2x; assert well clear of "fixed").
    expect(bigTravel).toBeGreaterThan(smallTravel * 1.5);

    smallInst.dispose();
    bigInst.dispose();
  });

  it('REGRESSION: dispose restores .transparent flags AND opacity to pre-create values', () => {
    const target = makeTarget(scrollDepthDollyPrimitive);
    const subject = target.subject as Mesh;
    const mat = subject.material as FadableMaterial;

    // A mounted artifact arrives with its own material state — including
    // transparent:false. The primitive must hand it back exactly as found.
    mat.transparent = false;
    mat.opacity = 0.8;
    const baseZ = subject.position.z;
    const baseScaleX = subject.scale.x;

    const inst = scrollDepthDollyPrimitive.create(target);
    target.userData.scroll = 0;
    inst.seek(0);
    // While fading, the primitive may legitimately run the material transparent…
    expect(mat.opacity).toBeLessThan(0.8);

    inst.dispose();
    // …but dispose must restore EVERYTHING it touched.
    expect(mat.transparent, '.transparent restored').toBe(false);
    expect(mat.opacity, 'opacity restored').toBeCloseTo(0.8, 10);
    expect(subject.position.z, 'position.z restored').toBeCloseTo(baseZ, 10);
    expect(subject.scale.x, 'scale restored').toBeCloseTo(baseScaleX, 10);
  });

  it('REGRESSION: midrange is fully opaque and the approach is monotonic in z and scale', () => {
    const target = makeTarget(scrollDepthDollyPrimitive);
    const inst = scrollDepthDollyPrimitive.create(target);
    const subject = target.subject as Mesh;
    const mat = subject.material as FadableMaterial;

    // Full opacity through the whole midrange — the hard fade belongs ONLY
    // to the very near end (scroll >= ~0.85), where it passes the viewer.
    for (const s of [0.3, 0.5, 0.7, 0.85]) {
      target.userData.scroll = s;
      inst.seek(0);
      expect(mat.opacity, `opacity at scroll=${s}`).toBeGreaterThanOrEqual(0.95);
    }

    // Monotonic approach: z and scale only ever increase with scroll.
    let prevZ = -Infinity;
    let prevScale = -Infinity;
    for (let i = 0; i <= 20; i++) {
      target.userData.scroll = i / 20;
      inst.seek(0);
      expect(subject.position.z, `z monotonic at ${i / 20}`).toBeGreaterThanOrEqual(prevZ - 1e-9);
      expect(subject.scale.x, `scale monotonic at ${i / 20}`).toBeGreaterThanOrEqual(prevScale - 1e-9);
      prevZ = subject.position.z;
      prevScale = subject.scale.x;
    }
    inst.dispose();
  });

  it('REGRESSION: materials mounting AFTER create still get the fade envelope (async MSDF/GLB race)', () => {
    // A bare Group subject with NO materials at attach time — the MSDF
    // 'text-object' case: bindings attach as soon as the group exists, glyph
    // meshes (and their materials) stream in afterwards.
    const target = makeTarget(scrollDepthDollyPrimitive);
    const bare = new Group();
    (target.subject as Object3D).parent?.add(bare);
    const t2 = { ...target, subject: bare as Object3D };

    const inst = scrollDepthDollyPrimitive.create(t2);

    // Glyph mesh arrives late.
    const lateMat = new MeshBasicMaterial({ transparent: false, opacity: 1 });
    const glyph = new Mesh(new PlaneGeometry(2, 1), lateMat);
    bare.add(glyph);

    // At rest (scroll=0) the late-mounted material must STILL get the
    // distant-haze dim — pre-fix the empty create-time snapshot meant the
    // fade envelope silently never ran on late-mounting artifacts.
    t2.userData.scroll = 0;
    inst.seek(0);
    expect(lateMat.opacity, 'late material dimmed at rest').toBeLessThan(0.9);
    expect(lateMat.opacity, 'never invisible').toBeGreaterThanOrEqual(0.5);

    inst.dispose();
    expect(lateMat.opacity, 'restored on dispose').toBeCloseTo(1, 5);
    expect(lateMat.transparent, '.transparent restored on dispose').toBe(false);
    lateMat.dispose();
    glyph.geometry.dispose();
  });
});
