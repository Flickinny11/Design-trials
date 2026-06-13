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
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { springChainFollowPrimitive } from '@/lib/prism/animatable/primitives/spring-chain-follow';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

/** Ghost echo roots (the trailing chain links), sorted by index. Roots are
 *  Groups named `chain-ghost-<i>`; their child meshes carry a different name so
 *  this regex only matches the roots. */
function ghostRootsOf(root: Object3D): Group[] {
  const out: Group[] = [];
  root.traverse((o) => {
    if (/^chain-ghost-\d+$/.test(o.name)) out.push(o as Group);
  });
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** First echo mesh of a ghost root (pairs preserve subject traverse order, so
 *  child 0 mirrors the subject's representative/panel mesh). */
function firstEchoMesh(ghost: Group): Mesh {
  const mesh = ghost.children[0] as Mesh;
  expect(mesh?.isMesh, 'ghost root carries echo meshes').toBe(true);
  return mesh;
}

/** A mounted-artifact-like target: ONE textured Mesh subject, so the chain math
 *  is predictable and the look-cloning assertions have a known material. */
function makeTexturedTarget(width = 2, height = 1) {
  const scene = new Scene();
  const object = new Group();
  scene.add(object);
  const texture = new DataTexture(new Uint8Array([200, 160, 90, 255]), 1, 1, RGBAFormat);
  texture.needsUpdate = true;
  const subject = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({ map: texture, transparent: true }),
  );
  subject.name = 'artifact-mesh';
  object.add(subject);
  const target: AnimatableTarget = {
    object,
    subject,
    scene,
    userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0 },
  };
  return { target, subject, texture };
}

describe('spring-chain-follow primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(springChainFollowPrimitive).dispose();
  });

  it('builds a head + 2 trailing ghost echoes carrying the subject FULL look, dimmed and tapered behind', () => {
    const target = makeTarget(springChainFollowPrimitive);
    const subject = target.subject as Mesh;
    const subjectMat = subject.material as MeshStandardMaterial;
    const subjectMeshCount = (() => {
      let n = 0;
      subject.traverse((o) => {
        if ((o as Mesh).isMesh && (o as Mesh).material) n++;
      });
      return n;
    })();
    expect(subjectMeshCount).toBeGreaterThan(2); // panel + chrome

    const inst = springChainFollowPrimitive.create(target);
    inst.seek(0);

    const ghosts = ghostRootsOf(target.scene);
    expect(ghosts.length).toBe(2); // schema default
    for (const ghost of ghosts) {
      // Deep echo: EVERY subject mesh mirrored (panel + header + dot + rows).
      expect(ghost.children.length).toBe(subjectMeshCount);
      const echo = firstEchoMesh(ghost);
      // Geometry is the subject's OWN, shared by reference — never re-built.
      expect(echo.geometry).toBe(subject.geometry);
      const mat = echo.material as MeshStandardMaterial;
      // Material is a CLONE (never the original instance, never a flat fill)…
      expect(mat).not.toBe(subjectMat);
      // …carrying the subject's color AND PBR scalars so it shades identically.
      expect(mat.color.getHex()).toBe(subjectMat.color.getHex());
      expect(mat.roughness).toBe(subjectMat.roughness);
      expect(mat.metalness).toBe(subjectMat.metalness);
      expect(mat.envMapIntensity).toBe(subjectMat.envMapIntensity);
      expect(mat.transparent).toBe(true);
    }
    // Per-link dim taper (defaults 0.45 / 0.25) and a slight z recession behind
    // the head (more negative the deeper into the chain), with a scale taper.
    const e0 = firstEchoMesh(ghosts[0]).material as MeshStandardMaterial;
    const e1 = firstEchoMesh(ghosts[1]).material as MeshStandardMaterial;
    expect(e0.opacity).toBeGreaterThan(e1.opacity); // closer link brighter
    expect(ghosts[0].position.z).toBeLessThan(0); // behind the head plane
    expect(ghosts[1].position.z).toBeLessThan(ghosts[0].position.z); // deeper
    expect(ghosts[1].scale.x).toBeLessThan(ghosts[0].scale.x); // taper
    // The subject's own material was never mutated.
    expect(subjectMat.opacity).toBe(1);
    inst.dispose();
  });

  it('physics: a moving pointer drags the head, and the chain lags behind it across seeks (per-link whip)', () => {
    const { target, subject } = makeTexturedTarget();
    const inst = springChainFollowPrimitive.create(target);

    // Idle frame: pointer centered, everything at home.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0);
    const baseX = subject.position.x;
    const ghosts = ghostRootsOf(target.scene);
    expect(subject.position.x).toBeCloseTo(baseX, 6);

    // Drag the pointer hard to one side and advance time. The head chases it;
    // ghosts spring toward the PREVIOUS link, so they lag (chain order).
    target.userData.pointer = { x: 1, y: 0.5 };
    let t = 0;
    for (let i = 0; i < 3; i++) {
      t += 1 / 60;
      inst.seek(t);
    }
    const headOff = subject.position.x - baseX;
    const g0Off = ghosts[0].position.x - baseX;
    const g1Off = ghosts[1].position.x - baseX;

    // The head moved toward the pointer (+x).
    expect(headOff).toBeGreaterThan(0.05);
    // Per-link lag: head leads link 0 leads link 1 (a cracked whip, mid-arc).
    expect(headOff).toBeGreaterThan(g0Off + 1e-3);
    expect(g0Off).toBeGreaterThan(g1Off - 1e-3);

    // Hold the pointer; let the chain settle. It converges to a TRAILING line:
    // the head leads, each link rests one gap further back toward home.
    for (let i = 0; i < 400; i++) {
      t += 1 / 60;
      inst.seek(t);
    }
    const settledHead = subject.position.x - baseX;
    const settledG0 = ghosts[0].position.x - baseX;
    const settledG1 = ghosts[1].position.x - baseX;
    expect(settledHead).toBeGreaterThan(0.1);
    // Monotonic trailing line behind the head, evenly spaced (one rest gap).
    expect(settledHead).toBeGreaterThan(settledG0 + 0.05);
    expect(settledG0).toBeGreaterThan(settledG1 + 0.05);
    const gap0 = settledHead - settledG0;
    const gap1 = settledG0 - settledG1;
    expect(Math.abs(gap0 - gap1)).toBeLessThan(0.02); // equal link spacing
    inst.dispose();
  });

  it('settles to a visible offset LINE toward the engaged point {0.62,0.5}; controls reshape it at the pinned state', () => {
    // Engaged pinned pose: settle the chain at the harness pin point, then
    // sweep each control with NO further seek (onParamChange re-applies).
    const { target, subject } = makeTexturedTarget();
    const inst = springChainFollowPrimitive.create(target);
    target.userData.pointer = { x: 0.62, y: 0.5 };
    let t = 0;
    for (let i = 0; i < 500; i++) {
      t += 1 / 60;
      inst.seek(t);
    }
    const ghosts = ghostRootsOf(target.scene);
    const headSettled = subject.position.x;
    const g0Settled = ghosts[0].position.x;
    const g1Settled = ghosts[1].position.x;
    // A real, visible offset toward the engaged point (+x of base 0).
    expect(headSettled).toBeGreaterThan(0.1);
    // It is a LINE: the chain strings out monotonically BEHIND the head toward
    // home, evenly spaced (one rest gap per link).
    expect(headSettled).toBeGreaterThan(g0Settled);
    expect(g0Settled).toBeGreaterThan(g1Settled);
    expect(Math.abs((headSettled - g0Settled) - (g0Settled - g1Settled))).toBeLessThan(0.02);

    // spacing: wider link spacing pushes the trailing ghosts FURTHER back from
    // the head along the chain (the resting line lengthens) — re-applied with
    // no seek.
    const g1Before = ghosts[1].position.x;
    inst.setControl('spacing', 2.4);
    const g1After = ghosts[1].position.x;
    // Larger spacing ⇒ link 1 sits at a different (further) resting x.
    expect(Math.abs(g1After - g1Before)).toBeGreaterThan(1e-3);
    inst.setControl('spacing', 1);

    // dimming: re-grades the echo opacity in place at the pinned state.
    inst.setControl('dimming', 0.15);
    const e0 = firstEchoMesh(ghosts[0]).material as Material;
    const e1 = firstEchoMesh(ghosts[1]).material as Material;
    expect(e0.opacity).toBeGreaterThan(e1.opacity);
    expect(e1.opacity).toBeLessThan(0.15); // deepest link dimmed below the knob

    // stiffness: a structural-free knob — re-applies the pose; output stays a
    // finite, engaged offset (no NaN/explosion at the extreme).
    inst.setControl('stiffness', 40);
    expect(Number.isFinite(subject.position.x)).toBe(true);
    expect(subject.position.x).toBeGreaterThan(0.1);

    // chaseSpeed: same — re-applies, output finite + engaged.
    inst.setControl('chaseSpeed', 30);
    expect(Number.isFinite(subject.position.x)).toBe(true);
    expect(subject.position.x).toBeGreaterThan(0.1);
    inst.dispose();
  });

  it('home settle: when the pointer disengages to center, the head and chain return toward base', () => {
    const { target, subject } = makeTexturedTarget();
    const inst = springChainFollowPrimitive.create(target);
    const baseX = subject.position.x;
    const baseY = subject.position.y;

    // Drag away and settle.
    target.userData.pointer = { x: 1, y: 1 };
    let t = 0;
    for (let i = 0; i < 400; i++) {
      t += 1 / 60;
      inst.seek(t);
    }
    expect(Math.hypot(subject.position.x - baseX, subject.position.y - baseY)).toBeGreaterThan(0.1);

    // Pointer disengages back to center; chain relaxes home.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    for (let i = 0; i < 500; i++) {
      t += 1 / 60;
      inst.seek(t);
    }
    const ghosts = ghostRootsOf(target.scene);
    expect(Math.hypot(subject.position.x - baseX, subject.position.y - baseY)).toBeLessThan(0.02);
    for (const g of ghosts) {
      // Ghosts ride the head's home pose (x/y back near base; z stays behind).
      expect(Math.abs(g.position.x - baseX)).toBeLessThan(0.02);
      expect(Math.abs(g.position.y - baseY)).toBeLessThan(0.02);
    }
    inst.dispose();
  });

  it('pinned engaged repeats are stable: dt=0 freezes integration, the pose holds exactly', () => {
    const { target, subject } = makeTexturedTarget();
    const inst = springChainFollowPrimitive.create(target);
    target.userData.pointer = { x: 0.62, y: 0.5 };

    // Advance to an engaged pose.
    let t = 0;
    for (let i = 0; i < 30; i++) {
      t += 1 / 60;
      inst.seek(t);
    }
    const snapX = subject.position.x;
    const ghosts = ghostRootsOf(target.scene);
    const snapG = ghosts.map((g) => g.position.x);

    // Repeated seeks at the SAME t (dt=0): nothing integrates, the pose holds.
    for (let i = 0; i < 6; i++) {
      inst.seek(t);
      expect(subject.position.x).toBeCloseTo(snapX, 6);
      ghosts.forEach((g, k) => expect(g.position.x).toBeCloseTo(snapG[k], 6));
    }
    inst.dispose();
  });

  it('async map pour: a texture landing AFTER create reaches the echoes by reference; stable when unchanged', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Mesh(new PlaneGeometry(2, 1), new MeshBasicMaterial({ transparent: true }));
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.62, y: 0.5 }, scroll: 0 },
    };

    const inst = springChainFollowPrimitive.create(target);
    inst.seek(0);
    const echo = firstEchoMesh(ghostRootsOf(scene)[0]);
    expect((echo.material as Material & { map?: Texture | null }).map ?? null).toBeNull();

    // The pour lands on the subject's material.
    const texture = new DataTexture(new Uint8Array([200, 160, 90, 255]), 1, 1, RGBAFormat);
    texture.needsUpdate = true;
    (subject.material as MeshBasicMaterial).map = texture;
    inst.seek(1 / 60);
    const poured = echo.material as Material & { map?: Texture | null };
    expect(poured.map, 'echo shares the poured texture by reference').toBe(texture);
    expect(poured, 'echo material is a clone, not the original').not.toBe(subject.material);

    // A whole-material swap also re-binds.
    const texture2 = new DataTexture(new Uint8Array([90, 160, 200, 255]), 1, 1, RGBAFormat);
    texture2.needsUpdate = true;
    subject.material = new MeshBasicMaterial({ map: texture2, transparent: true });
    inst.seek(2 / 60);
    expect((echo.material as Material & { map?: Texture | null }).map).toBe(texture2);

    // Stability: no further source change ⇒ no material churn.
    const stable = echo.material;
    inst.seek(3 / 60);
    expect(echo.material).toBe(stable);
    inst.dispose();
  });

  it('Group subject (MSDF text): the deep-handle path echoes every member mesh', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Group();
    subject.name = 'glyph-row';
    for (let i = 0; i < 3; i++) {
      const m = new Mesh(new PlaneGeometry(1, 0.5), new MeshStandardMaterial({ transparent: true }));
      m.position.x = (i - 1) * 0.6;
      subject.add(m);
    }
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.62, y: 0.5 }, scroll: 0 },
    };

    const inst = springChainFollowPrimitive.create(target);
    inst.seek(0);
    const ghosts = ghostRootsOf(scene);
    expect(ghosts.length).toBe(2);
    for (const g of ghosts) expect(g.children.length).toBe(3); // every member echoed
    inst.dispose();
  });

  it('dispose removes the echoes, frees ONLY clone materials, and restores the subject pose exactly', () => {
    const { target, subject, texture } = makeTexturedTarget();
    let subjectResourceDisposed = 0;
    subject.geometry.addEventListener('dispose', () => subjectResourceDisposed++);
    (subject.material as Material).addEventListener('dispose', () => subjectResourceDisposed++);
    texture.addEventListener('dispose', () => subjectResourceDisposed++);

    const baseX = subject.position.x;
    const baseY = subject.position.y;
    const baseZ = subject.position.z;

    const inst = springChainFollowPrimitive.create(target);
    target.userData.pointer = { x: 1, y: 1 };
    let t = 0;
    for (let i = 0; i < 120; i++) {
      t += 1 / 60;
      inst.seek(t);
    }
    expect(Math.hypot(subject.position.x - baseX, subject.position.y - baseY)).toBeGreaterThan(0.1);

    let cloneDisposed = 0;
    for (const g of ghostRootsOf(target.scene)) {
      g.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh && m.material) {
          (m.material as Material).addEventListener('dispose', () => cloneDisposed++);
        }
      });
    }

    inst.dispose();
    // 2 ghosts × 1 mesh = 2 clone materials freed.
    expect(cloneDisposed).toBe(2);
    // The subject's own geometry/material/texture are NEVER disposed.
    expect(subjectResourceDisposed).toBe(0);
    // Nothing of ours left in the tree.
    let leftover = 0;
    target.scene.traverse((o) => {
      if (o.name.startsWith('chain-ghost') || o.name.startsWith('chain-echo')) leftover++;
    });
    expect(leftover).toBe(0);
    // Subject pose restored exactly.
    expect(subject.position.x).toBeCloseTo(baseX, 6);
    expect(subject.position.y).toBeCloseTo(baseY, 6);
    expect(subject.position.z).toBeCloseTo(baseZ, 6);
  });
});
