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
import { scrollMarqueePrimitive } from '@/lib/prism/animatable/primitives/scroll-marquee';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

/** Echo roots (the ghost belt members), sorted by index. Roots are Groups
 *  named `marquee-ghost-<i>`; their child meshes carry a different name so
 *  this regex only matches roots. */
function ghostRootsOf(root: Object3D): Group[] {
  const out: Group[] = [];
  root.traverse((o) => {
    if (/^marquee-ghost-\d+$/.test(o.name)) out.push(o as Group);
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

/** A mounted-artifact-like target: ONE textured Mesh subject of a known size,
 *  so the belt math is exactly predictable (width 2 ⇒ slotSpan 2.6 at the
 *  default gap 0.3; 2 ghosts ⇒ belt length 7.8). */
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

// Belt constants mirrored from the primitive (defaults: gap 0.3, ghosts 2):
//   slotSpan S = width·(1+gap) = 2·1.3 = 2.6
//   members   = ghosts+1      = 3
//   length  L = 3·2.6         = 7.8
//   offset    = ±(scroll·0.75 + boost·0.45)·L, members wrap-centered on baseX.
const S = 2.6;
const L = 7.8;

describe('scroll-marquee primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollMarqueePrimitive).dispose();
  });

  it('scroll position drives the belt with a seamless wrap: concrete x at scroll 0 / 0.5 / 1', () => {
    // scroll=0 (the pinned idle frame): subject EXACTLY at its base pose,
    // fully legible, ghosts flanking symmetrically at ±slotSpan.
    {
      const { target, subject } = makeTexturedTarget();
      const inst = scrollMarqueePrimitive.create(target);
      target.userData.scroll = 0;
      inst.seek(0);
      const ghosts = ghostRootsOf(target.scene);
      expect(ghosts.length).toBe(2); // schema default
      expect(subject.position.x).toBeCloseTo(0, 6);
      // slot 1 ⇒ wrap(2.6, 7.8) = +2.6; slot 2 ⇒ wrap(5.2, 7.8) = −2.6.
      expect(ghosts[0].position.x).toBeCloseTo(S, 3);
      expect(ghosts[1].position.x).toBeCloseTo(-S, 3);
      inst.dispose();
    }

    // scroll=0.5 (the advocate's pinned mid-state), first seek (zero velocity):
    // offset = 0.75·0.5·7.8 = 2.925 ⇒ subject −2.925, ghosts at −0.325 / 2.275.
    {
      const { target, subject } = makeTexturedTarget();
      const inst = scrollMarqueePrimitive.create(target);
      target.userData.scroll = 0.5;
      inst.seek(0);
      const ghosts = ghostRootsOf(target.scene);
      expect(subject.position.x).toBeCloseTo(-2.925, 3);
      expect(ghosts[0].position.x).toBeCloseTo(S - 2.925, 3); // −0.325
      expect(ghosts[1].position.x).toBeCloseTo(2 * S - 2.925, 3); // 2.275
      inst.dispose();
    }

    // scroll=1: pure offset 0.75·7.8 = 5.85 exceeds L/2 — the subject exits
    // the left and RE-ENTERS from the right at +1.95. That wrap is the belt.
    {
      const { target, subject } = makeTexturedTarget();
      const inst = scrollMarqueePrimitive.create(target);
      target.userData.scroll = 1;
      inst.seek(0);
      expect(subject.position.x).toBeCloseTo(-5.85 + L, 3); // +1.95
      expect(subject.position.x).toBeGreaterThan(0);
      inst.dispose();
    }
  });

  it('velocity impulse: a fast jump slings the belt ahead, holds while pinned (dt=0), decays at rest', () => {
    const { target, subject } = makeTexturedTarget();
    const inst = scrollMarqueePrimitive.create(target);

    // Prime at rest.
    target.userData.scroll = 0;
    inst.seek(0);

    // Fast jump 0 → 0.5 in one seek: raw vel 0.5 clamps to 0.2 ⇒ boost 0.2
    // ⇒ offset = (0.375 + 0.2·0.45)·7.8 = 3.627 — overshoot past the pure
    // position pose (−2.925).
    target.userData.scroll = 0.5;
    inst.seek(1);
    expect(subject.position.x).toBeCloseTo(-3.627, 3);
    expect(subject.position.x).toBeLessThan(-2.925 - 0.3);

    // PINNED (the advocate control sweep): repeated seeks at the SAME t and
    // scroll — dt=0 freezes the impulse envelope, the pose holds exactly.
    for (let i = 0; i < 5; i++) {
      inst.seek(1);
      expect(subject.position.x).toBeCloseTo(-3.627, 6);
    }

    // Scroll rests with time advancing: the impulse drains (dt-normalized)
    // and the belt eases back to the pure position pose — the inertia feel.
    for (let t = 1.25; t <= 4.001; t += 0.25) inst.seek(t);
    expect(Math.abs(subject.position.x - -2.925)).toBeLessThan(0.05);
    expect(subject.position.x).toBeGreaterThan(-3.627 + 0.3);

    inst.dispose();
  });

  it('every control reshapes the engaged pose at scroll=0.5 with NO further seek (onParamChange re-applies)', () => {
    const { target, subject } = makeTexturedTarget();
    const inst = scrollMarqueePrimitive.create(target);
    target.userData.scroll = 0.5;
    inst.seek(0); // first seek, vel 0 ⇒ pure position pose
    expect(subject.position.x).toBeCloseTo(-2.925, 3);

    // reverse: flips the offset sign — DRIFT_TURNS=0.75 makes ±offset
    // DISTINCT poses at scroll=0.5 (0.375L ≠ L/2).
    inst.setControl('reverse', true);
    expect(subject.position.x).toBeCloseTo(2.925, 3);
    inst.setControl('reverse', false);

    // gap: slotSpan 2→4, L→12, offset = 0.375·12 = 4.5.
    inst.setControl('gap', 1);
    expect(subject.position.x).toBeCloseTo(-4.5, 3);
    expect(ghostRootsOf(target.scene)[0].position.x).toBeCloseTo(4 - 4.5, 3);

    // dim: re-grades the echo opacity in place.
    inst.setControl('dim', 0.2);
    const echoMat = firstEchoMesh(ghostRootsOf(target.scene)[0]).material as Material;
    expect(echoMat.opacity).toBeCloseTo(0.2, 6);

    // ghosts: STRUCTURAL — member count and belt length change (gap still 1:
    // 2 members ⇒ L=8 ⇒ offset 3; 4 members ⇒ L=16 ⇒ offset 6).
    inst.setControl('ghosts', 1);
    expect(ghostRootsOf(target.scene).length).toBe(1);
    expect(subject.position.x).toBeCloseTo(-3, 3);
    inst.setControl('ghosts', 3);
    expect(ghostRootsOf(target.scene).length).toBe(3);
    expect(subject.position.x).toBeCloseTo(-6, 3);

    inst.dispose();
  });

  it('echoes carry the subject FULL look: shared geometry + cloned materials with color/PBR scalars, dimmed', () => {
    // The REAL catalog card: panel mesh subject with brass chrome children.
    const target = makeTarget(scrollMarqueePrimitive);
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

    const inst = scrollMarqueePrimitive.create(target);
    target.userData.scroll = 0.5;
    inst.seek(0);

    const ghosts = ghostRootsOf(target.scene);
    expect(ghosts.length).toBe(2);
    for (const ghost of ghosts) {
      // Deep echo: EVERY subject mesh is mirrored (panel + header + dot + rows).
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
      // Dimmed via opacity (default dim 0.55 × subject opacity 1).
      expect(mat.transparent).toBe(true);
      expect(mat.opacity).toBeCloseTo(0.55 * subjectMat.opacity, 6);
    }
    // The subject's own material was never mutated.
    expect(subjectMat.opacity).toBe(1);

    inst.dispose();
  });

  it('async map pour: a texture landing AFTER create reaches the echoes by reference; no rebuild churn when stable', () => {
    // Mounted-artifact shape at attach time: map-LESS mesh (the factory pours
    // the texture later in loadTexture().then()).
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Mesh(new PlaneGeometry(2, 1), new MeshBasicMaterial({ transparent: true }));
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    };

    const inst = scrollMarqueePrimitive.create(target);
    inst.seek(0);
    const echo = firstEchoMesh(ghostRootsOf(scene)[0]);
    expect(((echo.material as Material & { map?: Texture | null }).map ?? null)).toBeNull();

    // The pour lands on the subject's material.
    const texture = new DataTexture(new Uint8Array([200, 160, 90, 255]), 1, 1, RGBAFormat);
    texture.needsUpdate = true;
    (subject.material as MeshBasicMaterial).map = texture;
    inst.seek(0.5);
    const pouredMat = echo.material as Material & { map?: Texture | null };
    expect(pouredMat.map, 'echo shares the poured texture by reference').toBe(texture);
    expect(pouredMat, 'echo material is a clone, not the original').not.toBe(subject.material);

    // A whole-material swap (applyImageSpec upgrade) also re-binds.
    const texture2 = new DataTexture(new Uint8Array([90, 160, 200, 255]), 1, 1, RGBAFormat);
    texture2.needsUpdate = true;
    subject.material = new MeshBasicMaterial({ map: texture2, transparent: true });
    inst.seek(1);
    expect((echo.material as Material & { map?: Texture | null }).map).toBe(texture2);

    // Stability: with no further source change, seeks do NOT churn materials.
    const stableMat = echo.material;
    inst.seek(1.5);
    expect(echo.material).toBe(stableMat);

    // Dispose never touches the subject's texture.
    let texDisposed = 0;
    texture2.addEventListener('dispose', () => texDisposed++);
    inst.dispose();
    expect(texDisposed).toBe(0);
  });

  it('echo roots re-sync to the subject live base pose every seek (Group subject, co-binding tilt/lift)', () => {
    // MSDF-text-like Group subject with two member meshes — the deep-handle path.
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Group();
    subject.name = 'glyph-row';
    for (let i = 0; i < 2; i++) {
      const m = new Mesh(
        new PlaneGeometry(1, 0.5),
        new MeshStandardMaterial({ transparent: true }),
      );
      m.position.x = i === 0 ? -0.5 : 0.5;
      subject.add(m);
    }
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.3 },
    };

    const inst = scrollMarqueePrimitive.create(target);
    inst.seek(0);
    const ghosts = ghostRootsOf(scene);
    expect(ghosts.length).toBe(2);
    // Deep handle: every member mesh of the Group is echoed.
    for (const g of ghosts) expect(g.children.length).toBe(2);

    // A co-binding tilts/lifts the subject AFTER create.
    subject.position.y = 0.4;
    subject.position.z = 0.12;
    subject.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), 0.3);
    subject.scale.set(1.1, 1.1, 1);
    inst.seek(0.5);

    for (const g of ghosts) {
      expect(g.position.y).toBeCloseTo(0.4, 6);
      expect(g.position.z).toBeCloseTo(0.12, 6);
      expect(g.quaternion.z).toBeCloseTo(subject.quaternion.z, 6);
      expect(g.quaternion.w).toBeCloseTo(subject.quaternion.w, 6);
      expect(g.scale.x).toBeCloseTo(1.1, 6);
      // x stays a belt slot, never a blind copy of the subject's x.
      expect(g.position.x).not.toBeCloseTo(subject.position.x, 2);
    }
    inst.dispose();
  });

  it('external x writes re-base the belt (a magnetic co-binding shifts the subject; the whole belt follows)', () => {
    const { target, subject } = makeTexturedTarget();
    const inst = scrollMarqueePrimitive.create(target);
    target.userData.scroll = 0.5;
    inst.seek(0);
    expect(subject.position.x).toBeCloseTo(-2.925, 3);

    // A co-binding nudges the subject's x by +0.5 between our writes.
    subject.position.x += 0.5;
    inst.seek(0); // same t, same scroll: pure re-base, no impulse
    expect(subject.position.x).toBeCloseTo(-2.925 + 0.5, 3);
    expect(ghostRootsOf(target.scene)[0].position.x).toBeCloseTo(S - 2.925 + 0.5, 3);

    inst.dispose();
  });

  it('dispose removes the echoes, frees ONLY clone materials, and restores the subject pose exactly', () => {
    const { target, subject, texture } = makeTexturedTarget();
    let subjectResourceDisposed = 0;
    subject.geometry.addEventListener('dispose', () => subjectResourceDisposed++);
    (subject.material as Material).addEventListener('dispose', () => subjectResourceDisposed++);
    texture.addEventListener('dispose', () => subjectResourceDisposed++);

    const inst = scrollMarqueePrimitive.create(target);
    target.userData.scroll = 0.7;
    inst.seek(0);
    expect(subject.position.x).not.toBeCloseTo(0, 2); // really drifted

    let cloneDisposed = 0;
    const watchClones = () => {
      for (const g of ghostRootsOf(target.scene)) {
        g.traverse((o) => {
          const m = o as Mesh;
          if (m.isMesh && m.material) {
            (m.material as Material).addEventListener('dispose', () => cloneDisposed++);
          }
        });
      }
    };
    watchClones(); // 2 ghosts × 1 mesh = 2 clone materials

    // Structural rebuild via the 'ghosts' knob disposes the old echo set…
    inst.setControl('ghosts', 3);
    expect(cloneDisposed).toBe(2);
    expect(ghostRootsOf(target.scene).length).toBe(3);
    watchClones();

    // …and dispose() releases the rebuilt set too: 2 + 3 clone materials.
    inst.dispose();
    expect(cloneDisposed).toBe(2 + 3);

    // The subject's geometry/material/texture (shared by reference into the
    // echoes) are NEVER disposed.
    expect(subjectResourceDisposed).toBe(0);

    // Nothing of ours is left in the tree, and the pose is handed back.
    let leftover = 0;
    target.scene.traverse((o) => {
      if (o.name.startsWith('marquee-ghost') || o.name.startsWith('marquee-echo')) leftover++;
    });
    expect(leftover).toBe(0);
    expect(subject.position.x).toBeCloseTo(0, 6);
  });
});
