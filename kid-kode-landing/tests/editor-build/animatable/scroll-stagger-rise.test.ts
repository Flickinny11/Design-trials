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
  type Texture,
} from 'three';
import { scrollStaggerRisePrimitive } from '@/lib/prism/animatable/primitives/scroll-stagger-rise';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

/** Find the generated band group anywhere under the primitive root. The fixed
 *  primitive parents it as a SIBLING of the (hidden) subject — hiding a parent
 *  in three.js hides its children, so the bands cannot live under the subject
 *  itself. Searching from the root finds it in either layout. */
function bandGroupOf(root: Object3D): Group {
  let found: Group | null = null;
  root.traverse((o) => {
    if (o.name === 'stagger-rise-bands') found = o as Group;
  });
  if (!found) throw new Error('band group not found');
  return found;
}

/** Every band mesh anywhere under the root. */
function bandMeshesOf(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o.name.startsWith('stagger-band-')) out.push(o as Mesh);
  });
  return out;
}

/** A mounted-artifact-like target: a single textured Mesh subject of the given
 *  size — mirrors how bindings.ts resolves the mounted subject (the first Mesh
 *  descendant of a real, textured, arbitrarily-sized artifact), NOT the
 *  catalog's synthetic card. */
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

describe('scroll-stagger-rise primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollStaggerRisePrimitive).dispose();
  });

  it('plays: a band reveals (opacity + position.y) as scroll advances', () => {
    // Textured target — the band-decomposition path (the catalog card has no
    // map and >= 2 child meshes, so it takes the children-as-rows path below).
    const { target } = makeTexturedTarget(2, 1);
    const inst = scrollStaggerRisePrimitive.create(target);
    const group = bandGroupOf(target.object);

    // Pick the last band (highest reveal point) so the scroll sweep is observable.
    const last = group.children[group.children.length - 1] as Mesh;
    const mat = last.material as Material;

    // Early scroll: this band has not yet arrived.
    target.userData.scroll = 0.0;
    inst.seek(0);
    const opEarly = mat.opacity;
    const yEarly = last.position.y;

    // Late scroll: every band has settled.
    target.userData.scroll = 1.0;
    inst.seek(0);
    const opLate = mat.opacity;
    const yLate = last.position.y;

    // Opacity rises and the band lifts up across the scroll sweep.
    expect(opLate).toBeGreaterThan(opEarly + 0.2);
    expect(yLate).toBeGreaterThan(yEarly + 0.1);
    inst.dispose();
  });

  it('controls change output: larger lift means a lower start position', () => {
    const { target } = makeTexturedTarget(2, 1);
    const inst = scrollStaggerRisePrimitive.create(target);
    const group = bandGroupOf(target.object);
    const last = group.children[group.children.length - 1] as Mesh;

    // Before the band arrives, its y sits lift-travel below settled. Larger
    // lift => lower y.
    target.userData.scroll = 0.0;

    inst.setControl('lift', 0.3);
    inst.seek(0);
    const ySmall = last.position.y;

    inst.setControl('lift', 3);
    inst.seek(0);
    const yLarge = last.position.y;

    expect(ySmall).toBeGreaterThan(yLarge + 0.3);
    inst.dispose();
  });

  // ── Regressions: "untextured twin quads" (advocate, ORRERY showcase) ──────
  // The broken build spawned solid #7ea2ff MeshBasicMaterial quads in
  // hardcoded world units floating OVER the still-visible artifact. The bands
  // must instead be built FROM the subject itself.

  it('regression: bands sample the subject texture via cloned materials (no solid placeholder quads)', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    const inst = scrollStaggerRisePrimitive.create(target);

    const bands = bandMeshesOf(target.object);
    expect(bands.length).toBeGreaterThan(1);
    for (const band of bands) {
      const mat = band.material as Material & { map?: Texture | null };
      // Every band shares the subject's OWN texture…
      expect(mat.map, 'band material samples the subject texture').toBe(texture);
      // …through a per-band clone, never the original material instance.
      expect(mat, 'band material is a clone, not the original').not.toBe(subject.material);
    }
    // The subject's material was never mutated.
    expect((subject.material as MeshBasicMaterial).map).toBe(texture);
    expect((subject.material as MeshBasicMaterial).opacity).toBe(1);

    // UVs are windowed per band — each band shows ITS horizontal slice of the
    // texture, not the whole map repeated on twin quads.
    const uvOf = (m: Mesh) =>
      Array.from(m.geometry.attributes.uv.array as ArrayLike<number>).join(',');
    expect(uvOf(bands[0])).not.toBe(uvOf(bands[1]));

    inst.dispose();
  });

  it('regression: band geometry derives from the measured subject bbox (resize the subject, bands follow)', () => {
    const small = makeTexturedTarget(2, 1);
    const big = makeTexturedTarget(4, 2);
    const instSmall = scrollStaggerRisePrimitive.create(small.target);
    const instBig = scrollStaggerRisePrimitive.create(big.target);

    const sizeOf = (m: Mesh) => {
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox!;
      return { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y };
    };
    const sSmall = sizeOf(bandMeshesOf(small.target.object)[0]);
    const sBig = sizeOf(bandMeshesOf(big.target.object)[0]);

    // Width tracks the measured subject width (default 5 bands => h = H/5).
    expect(sSmall.w).toBeCloseTo(2, 1);
    expect(sBig.w).toBeCloseTo(4, 1);
    expect(sSmall.h).toBeCloseTo(1 / 5, 1);
    expect(sBig.h).toBeCloseTo(2 / 5, 1);

    instSmall.dispose();
    instBig.dispose();
  });

  // ── Regressions: in-context defects (P0 ORRERY, orr-materia-brass) ────────
  // Probed live: (a) the plane factory pours `.map` ASYNCHRONOUSLY after the
  // binding attaches, so band clones taken at create were permanently map-less
  // solid-white quads; (b) co-bindings (magnetic / scroll-rotate-3d) keep
  // animating the hidden subject, but the band group froze at its create-time
  // pose (~35° off the live artifact).

  it('regression: band group tracks the subject LIVE transform each seek (co-bindings tilt the hidden subject)', () => {
    const { target, subject } = makeTexturedTarget(2, 1);
    const inst = scrollStaggerRisePrimitive.create(target);
    const group = bandGroupOf(target.scene);

    // A co-binding moves/tilts/scales the subject AFTER create — exactly what
    // magnetic + scroll-rotate-3d do in the ORRERY showcase.
    subject.position.set(0.4, -0.2, 0.64);
    subject.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -0.122);
    subject.scale.set(1.1, 1.1, 1);

    target.userData.scroll = 0.5;
    inst.seek(0);

    expect(group.position.x).toBeCloseTo(subject.position.x, 6);
    expect(group.position.y).toBeCloseTo(subject.position.y, 6);
    expect(group.position.z).toBeCloseTo(subject.position.z, 6);
    expect(group.quaternion.x).toBeCloseTo(subject.quaternion.x, 6);
    expect(group.quaternion.y).toBeCloseTo(subject.quaternion.y, 6);
    expect(group.quaternion.z).toBeCloseTo(subject.quaternion.z, 6);
    expect(group.quaternion.w).toBeCloseTo(subject.quaternion.w, 6);
    expect(group.scale.x).toBeCloseTo(subject.scale.x, 6);
    expect(group.scale.y).toBeCloseTo(subject.scale.y, 6);

    // It keeps tracking — move again, seek again.
    subject.position.set(-0.3, 0.1, 0.2);
    inst.seek(0);
    expect(group.position.x).toBeCloseTo(-0.3, 6);
    expect(group.position.z).toBeCloseTo(0.2, 6);

    inst.dispose();
  });

  it('regression: a texture poured AFTER create reaches the bands (async map pour → rebuild with windowed UVs)', () => {
    // Mounted-artifact shape at attach time: a single map-LESS mesh (the
    // factory pours the texture later in loadTexture().then()).
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Mesh(
      new PlaneGeometry(2, 1),
      new MeshBasicMaterial({ transparent: true }), // map: null, color white
    );
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    };

    const inst = scrollStaggerRisePrimitive.create(target);
    const before = bandMeshesOf(scene);
    expect(before.length).toBe(5);
    for (const band of before) {
      expect((band.material as Material & { map?: Texture | null }).map ?? null).toBeNull();
    }

    // The pour lands on the subject's material (what default-factory does).
    const texture = new DataTexture(new Uint8Array([200, 160, 90, 255]), 1, 1, RGBAFormat);
    texture.needsUpdate = true;
    (subject.material as MeshBasicMaterial).map = texture;
    (subject.material as MeshBasicMaterial).needsUpdate = true;

    target.userData.scroll = 0.6;
    inst.seek(0);

    const after = bandMeshesOf(scene);
    expect(after.length).toBe(5);
    for (const band of after) {
      const mat = band.material as Material & { map?: Texture | null };
      expect(mat.map, 'band samples the poured texture').toBe(texture);
      expect(mat, 'band material is a clone, not the original').not.toBe(subject.material);
    }
    // The rebuilt bands are UV-windowed per slice (texture-band behavior).
    const uvOf = (m: Mesh) =>
      Array.from(m.geometry.attributes.uv.array as ArrayLike<number>).join(',');
    expect(uvOf(after[0])).not.toBe(uvOf(after[1]));
    // Stagger opacity still drives the rebuilt set on this same seek.
    const ops = after.map((m) => (m.material as Material).opacity);
    expect(Math.max(...ops)).toBeGreaterThan(Math.min(...ops) + 0.2);

    // A whole-material swap (applyImageSpec radius upgrade) also rebuilds.
    const texture2 = new DataTexture(new Uint8Array([90, 160, 200, 255]), 1, 1, RGBAFormat);
    texture2.needsUpdate = true;
    subject.material = new MeshBasicMaterial({ map: texture2, transparent: true });
    inst.seek(0);
    for (const band of bandMeshesOf(scene)) {
      expect((band.material as Material & { map?: Texture | null }).map).toBe(texture2);
    }

    // Stability: with no further source change, seeks do NOT rebuild.
    const stable = bandMeshesOf(scene);
    inst.seek(0);
    const stillThere = bandMeshesOf(scene);
    expect(stillThere.map((m) => m.uuid)).toEqual(stable.map((m) => m.uuid));

    // Dispose never touches the subject's texture.
    let texDisposed = 0;
    texture2.addEventListener('dispose', () => texDisposed++);
    inst.dispose();
    expect(texDisposed).toBe(0);
    expect((subject.material as MeshBasicMaterial).map).toBe(texture2);
  });

  it('regression: the original subject is hidden while active and restored on dispose', () => {
    const { target, subject } = makeTexturedTarget(2, 1);
    expect(subject.visible).toBe(true);

    const inst = scrollStaggerRisePrimitive.create(target);
    target.userData.scroll = 0.5;
    inst.seek(0);
    expect(subject.visible, 'subject hidden during play (bands ARE the subject)').toBe(false);

    inst.dispose();
    expect(subject.visible, 'subject restored after dispose').toBe(true);
  });

  it('regression: dispose + bands rebuild leak nothing created and never dispose subject resources', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    const inst = scrollStaggerRisePrimitive.create(target);

    let disposedCount = 0;
    const watch = (meshes: Mesh[]) => {
      for (const m of meshes) {
        m.geometry.addEventListener('dispose', () => disposedCount++);
        (m.material as Material).addEventListener('dispose', () => disposedCount++);
      }
    };
    let subjectDisposed = 0;
    (subject.material as Material).addEventListener('dispose', () => subjectDisposed++);
    texture.addEventListener('dispose', () => subjectDisposed++);

    const first = bandMeshesOf(target.object);
    expect(first.length).toBe(5); // schema default
    watch(first);

    // Structural rebuild via the 'bands' control disposes the original set…
    inst.setControl('bands', 8);
    expect(disposedCount).toBe(5 * 2);
    const rebuilt = bandMeshesOf(target.object);
    expect(rebuilt.length).toBe(8);
    watch(rebuilt);

    // …and dispose() releases the rebuilt set too: count matches exactly.
    inst.dispose();
    expect(disposedCount).toBe(5 * 2 + 8 * 2);

    // The subject's own material/texture are NEVER disposed (shared by ref).
    expect(subjectDisposed).toBe(0);

    // Nothing of ours is left in the tree.
    let leftover = 0;
    target.object.traverse((o) => {
      if (o.name === 'stagger-rise-bands' || o.name.startsWith('stagger-band-')) leftover++;
    });
    expect(leftover).toBe(0);
  });

  // ── Children-as-rows path (art-fidelity fix: dark featureless slab) ───────
  // The catalog card subject has NO texture map but real chrome children
  // (header bar, accent dot, content rows). Color-clone bands flattened it
  // into a featureless dark slab; the fixed primitive must instead stagger
  // THE SUBJECT'S OWN CHILDREN as the arriving rows — nothing spawned, the
  // card's real chrome arrives row by row while the face fades in.

  it('card-like subject (child meshes, no map): no band planes spawned — the real children animate and settle exactly', () => {
    // makeTarget builds the REAL catalog card: panel mesh (subject) with
    // card-header / card-dot / card-rows children, materials without .map.
    const target = makeTarget(scrollStaggerRisePrimitive);
    const subject = target.subject as Mesh;
    const header = target.object.getObjectByName('card-header') as Mesh;
    const rows = target.object.getObjectByName('card-rows') as Group;
    const lastRow = rows.children[rows.children.length - 1] as Mesh;
    expect(header?.isMesh).toBe(true);
    expect(lastRow?.isMesh).toBe(true);

    // Settled poses, captured BEFORE the primitive exists.
    const headerSettledY = header.position.y;
    const lastRowSettledY = lastRow.position.y;
    const lastRowBaseOpacity = (lastRow.material as Material).opacity;
    const faceMat = subject.material as Material;
    const faceBaseOpacity = faceMat.opacity;

    const inst = scrollStaggerRisePrimitive.create(target);

    // NOTHING is spawned: no band planes, no band group mounted anywhere.
    expect(bandMeshesOf(target.object).length, 'no band planes spawned').toBe(0);
    let bandGroups = 0;
    target.scene.traverse((o) => {
      if (o.name === 'stagger-rise-bands') bandGroups++;
    });
    expect(bandGroups, 'no band group mounted').toBe(0);
    // The face mesh stays visible (it fades via opacity, never visible=false).
    expect(subject.visible, 'subject face stays visible').toBe(true);

    // Early scroll: rows below their settled pose, faded out.
    target.userData.scroll = 0;
    inst.seek(0);
    const headerMatEarly = (header.material as Material).opacity;
    const lastRowEarlyY = lastRow.position.y;
    expect(headerMatEarly, 'header not yet arrived at scroll=0').toBeLessThan(0.01);
    expect(lastRowEarlyY, 'row starts below settled pose').toBeLessThan(lastRowSettledY - 0.1);
    expect(faceMat.opacity, 'face fades in from 0').toBeLessThan(0.01);

    // Mid scroll: the header (top unit) leads the last row (bottom unit).
    target.userData.scroll = 0.5;
    inst.seek(0);
    expect((header.material as Material).opacity).toBeGreaterThan(
      (lastRow.material as Material).opacity + 0.1,
    );
    expect(faceMat.opacity, 'face arrives across the first window').toBeGreaterThan(0.5);

    // Late scroll: everything settles EXACTLY back at its own pose.
    target.userData.scroll = 1;
    inst.seek(0);
    expect((lastRow.material as Material).opacity, 'row opacity reaches base').toBeCloseTo(
      lastRowBaseOpacity,
      6,
    );
    expect(lastRow.position.y, 'row settles at its captured pose').toBeCloseTo(lastRowSettledY, 6);
    expect(header.position.y, 'header settles at its captured pose').toBeCloseTo(headerSettledY, 6);
    expect(faceMat.opacity, 'face reaches its base opacity').toBeCloseTo(faceBaseOpacity, 6);

    inst.dispose();
  });

  it('card-like subject: dispose restores every child transform + opacity + transparent flag exactly', () => {
    const target = makeTarget(scrollStaggerRisePrimitive);
    const rows = target.object.getObjectByName('card-rows') as Group;
    // Prove the .transparent restore is real: flip one child opaque pre-create.
    ((rows.children[0] as Mesh).material as Material).transparent = false;

    // Snapshot EVERY mesh in the tree before the primitive exists.
    interface Snap {
      mesh: Mesh;
      pos: [number, number, number];
      opacity: number;
      transparent: boolean;
    }
    const snaps: Snap[] = [];
    target.object.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mat = mesh.material as Material;
      snaps.push({
        mesh,
        pos: [mesh.position.x, mesh.position.y, mesh.position.z],
        opacity: mat.opacity,
        transparent: mat.transparent,
      });
    });
    expect(snaps.length).toBeGreaterThan(2); // panel + chrome

    const inst = scrollStaggerRisePrimitive.create(target);
    target.userData.scroll = 0.37;
    inst.seek(0);

    // Mid-flight the state really diverged (otherwise restore proves nothing).
    const diverged = snaps.some(
      (s) =>
        s.mesh.position.y !== s.pos[1] || (s.mesh.material as Material).opacity !== s.opacity,
    );
    expect(diverged, 'children moved/faded mid-scroll').toBe(true);

    inst.dispose();
    for (const s of snaps) {
      expect(s.mesh.position.x, `${s.mesh.name} position.x restored`).toBe(s.pos[0]);
      expect(s.mesh.position.y, `${s.mesh.name} position.y restored`).toBe(s.pos[1]);
      expect(s.mesh.position.z, `${s.mesh.name} position.z restored`).toBe(s.pos[2]);
      const mat = s.mesh.material as Material;
      expect(mat.opacity, `${s.mesh.name} opacity restored`).toBe(s.opacity);
      expect(mat.transparent, `${s.mesh.name} transparent flag restored`).toBe(s.transparent);
    }
  });

  it('regression: with no usable subject it rises the whole group instead of spawning placeholder quads', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Group(); // no meshes, no materials — nothing to decompose
    subject.name = 'empty-artifact';
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0 },
    };

    const inst = scrollStaggerRisePrimitive.create(target);
    expect(bandMeshesOf(object).length, 'no placeholder quads spawned').toBe(0);
    expect(subject.visible, 'fallback never hides the subject it animates').toBe(true);

    target.userData.scroll = 0;
    inst.seek(0);
    const yEarly = subject.position.y;
    target.userData.scroll = 1;
    inst.seek(0);
    const yLate = subject.position.y;
    expect(yLate, 'whole subject rises across the scroll sweep').toBeGreaterThan(yEarly + 0.1);

    inst.dispose();
    expect(subject.position.y, 'position restored after dispose').toBeCloseTo(0, 6);
  });
});
