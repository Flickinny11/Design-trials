import { describe, it, expect } from 'vitest';
import {
  Color,
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  Vector3,
  type BufferAttribute,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { scrollFoldScrubPrimitive } from '@/lib/prism/animatable/primitives/scroll-fold-scrub';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

// Mirrors the implementation's hinge-angle ladder: the hinge with fold order o
// scrubs to PI - (4deg + 7deg*o) at scroll=1 — later leaves stop at a wider
// wedge (and ride a small stack lift) so they drape OVER earlier leaves
// instead of slicing through them.
const MAX_ANGLE_0 = Math.PI - (4 * Math.PI) / 180;
const MAX_ANGLE_1 = Math.PI - (11 * Math.PI) / 180;

function hingeOf(root: Object3D, order: number): Group {
  const found = root.getObjectByName(`fold-scrub-hinge-${order}`);
  if (!found) throw new Error(`hinge ${order} not found`);
  return found as Group;
}

/** Every panel overlay mesh anywhere under the root, sorted by slice index. */
function panelMeshesOf(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o.name.startsWith('fold-scrub-panel-')) out.push(o as Mesh);
  });
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function hingeCountOf(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o.name.startsWith('fold-scrub-hinge-')) n++;
  });
  return n;
}

function foldGroupOf(root: Object3D): Group {
  let found: Group | null = null;
  root.traverse((o) => {
    if (o.name === 'fold-scrub-group') found = o as Group;
  });
  if (!found) throw new Error('fold group not found');
  return found;
}

/** min/max over a panel's vertex-color attribute (the contact-shade channel). */
function colorRange(mesh: Mesh): { min: number; max: number } {
  const attr = mesh.geometry.getAttribute('color') as BufferAttribute;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < attr.count; i++) {
    const v = attr.getX(i);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/** A mounted-artifact-like target: a single textured Mesh subject of the given
 *  size — mirrors how bindings.ts resolves the mounted subject (the first Mesh
 *  descendant of a real, textured, arbitrarily-sized artifact), NOT the
 *  catalog's synthetic plane. */
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

describe('scroll-fold-scrub primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollFoldScrubPrimitive).dispose();
  });

  it('scrubs: flat and fully legible at scroll=0, leaves fold in sequence, exact hinge angles at scroll=1, reversible', () => {
    const { target } = makeTexturedTarget(2, 1);
    const inst = scrollFoldScrubPrimitive.create(target);

    // Default tri-fold: 3 panels, 2 hinges (order 0 = low/left leaf first).
    expect(panelMeshesOf(target.scene).length).toBe(3);
    expect(hingeCountOf(target.scene)).toBe(2);
    const h0 = hingeOf(target.scene, 0);
    const h1 = hingeOf(target.scene, 1);

    // Idle pin (scroll=0): every hinge flat — the panels exactly reassemble
    // the subject. Never an empty/folded idle frame.
    target.userData.scroll = 0;
    inst.seek(0);
    expect(h0.rotation.y).toBeCloseTo(0, 6);
    expect(h1.rotation.y).toBeCloseTo(0, 6);

    // Engaged mid-state (the advocate's pinned frame): order-0 leaf leads,
    // order-1 leaf trails — sequential, not simultaneous.
    target.userData.scroll = 0.5;
    inst.seek(0);
    expect(Math.abs(h0.rotation.y)).toBeGreaterThan(2.0);
    expect(Math.abs(h0.rotation.y)).toBeGreaterThan(Math.abs(h1.rotation.y) + 0.5);

    // Fully folded (scroll=1): exact ladder angles — left leaf +, right leaf −
    // (both fold over the FRONT of the center panel).
    target.userData.scroll = 1;
    inst.seek(0);
    expect(h0.rotation.y).toBeCloseTo(MAX_ANGLE_0, 3);
    expect(h1.rotation.y).toBeCloseTo(-MAX_ANGLE_1, 3);

    // Pure scrub: scrolling back unfolds it flat again, frame-exact.
    target.userData.scroll = 0;
    inst.seek(0);
    expect(h0.rotation.y).toBeCloseTo(0, 6);
    expect(h1.rotation.y).toBeCloseTo(0, 6);

    inst.dispose();
  });

  it('controls reshape the pose at scroll=0.5 and re-apply WITHOUT a fresh seek (onParamChange)', () => {
    const { target } = makeTexturedTarget(2, 1);
    const inst = scrollFoldScrubPrimitive.create(target);
    const h0 = hingeOf(target.scene, 0);
    const h1 = hingeOf(target.scene, 1);

    target.userData.scroll = 0.5;
    inst.seek(0);

    // stagger=0: both hinges share one window — equal fold FRACTIONS (angles
    // differ by the wedge ladder, so compare normalized fractions).
    inst.setControl('stagger', 0);
    const fracL0 = Math.abs(h0.rotation.y) / MAX_ANGLE_0;
    const fracR0 = Math.abs(h1.rotation.y) / MAX_ANGLE_1;
    expect(fracL0).toBeCloseTo(fracR0, 6);
    expect(fracL0).toBeGreaterThan(0.1); // engaged, not flat

    // stagger=0.95: near-fully sequential — the first leaf is far ahead.
    inst.setControl('stagger', 0.95);
    const fracL1 = Math.abs(h0.rotation.y) / MAX_ANGLE_0;
    const fracR1 = Math.abs(h1.rotation.y) / MAX_ANGLE_1;
    expect(fracL1).toBeGreaterThan(fracR1 + 0.3);

    inst.dispose();
  });

  it('panel count and fold direction rebuild structurally and keep the scrubbed pose', () => {
    const { target } = makeTexturedTarget(2, 1);
    const inst = scrollFoldScrubPrimitive.create(target);

    target.userData.scroll = 0.5;
    inst.seek(0);

    // 4 panels => 3 hinges, pose re-applied at the last scroll immediately.
    inst.setControl('panels', '4');
    expect(panelMeshesOf(target.scene).length).toBe(4);
    expect(hingeCountOf(target.scene)).toBe(3);
    expect(Math.abs(hingeOf(target.scene, 0).rotation.y)).toBeGreaterThan(0.1);

    // Vertical: hinges rotate about X (horizontal hinge lines), never Y.
    inst.setControl('direction', 'vertical');
    const h0 = hingeOf(target.scene, 0);
    expect(Math.abs(h0.rotation.x)).toBeGreaterThan(0.2);
    expect(h0.rotation.y).toBeCloseTo(0, 6);

    inst.dispose();
  });

  it('texture path: panels window the subject OWN map via per-panel clones (no invented fills)', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    const inst = scrollFoldScrubPrimitive.create(target);

    const panels = panelMeshesOf(target.scene);
    expect(panels.length).toBe(3);
    for (const p of panels) {
      const mat = p.material as Material & { map?: Texture | null };
      // Every panel shares the subject's OWN texture by reference…
      expect(mat.map, 'panel samples the subject texture').toBe(texture);
      // …through a per-panel clone, never the original material instance.
      expect(mat, 'panel material is a clone').not.toBe(subject.material);
    }
    // UVs are windowed per slice — each panel shows ITS strip of the map.
    const uvOf = (m: Mesh) =>
      Array.from(m.geometry.attributes.uv.array as ArrayLike<number>).join(',');
    expect(uvOf(panels[0])).not.toBe(uvOf(panels[1]));

    // The subject's material was never mutated; the subject is hidden while
    // the fold overlays ARE the subject, and restored on dispose.
    expect((subject.material as MeshBasicMaterial).map).toBe(texture);
    expect((subject.material as MeshBasicMaterial).opacity).toBe(1);
    expect(subject.visible, 'subject hidden during play').toBe(false);
    inst.dispose();
    expect(subject.visible, 'subject restored after dispose').toBe(true);
  });

  it('async map pour: a texture landing AFTER create reaches the panels (rebuild), swaps rebuild too, stable otherwise', () => {
    // Mounted-artifact shape at attach time: a single map-LESS mesh (the
    // factory pours the texture later in loadTexture().then()).
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Mesh(
      new PlaneGeometry(2, 1),
      new MeshBasicMaterial({ transparent: true }), // map: null
    );
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    };

    const inst = scrollFoldScrubPrimitive.create(target);
    for (const p of panelMeshesOf(scene)) {
      expect((p.material as Material & { map?: Texture | null }).map ?? null).toBeNull();
    }

    // The pour lands on the subject's material (what default-factory does).
    const texture = new DataTexture(new Uint8Array([200, 160, 90, 255]), 1, 1, RGBAFormat);
    texture.needsUpdate = true;
    (subject.material as MeshBasicMaterial).map = texture;
    (subject.material as MeshBasicMaterial).needsUpdate = true;

    target.userData.scroll = 0.6;
    inst.seek(0);

    const after = panelMeshesOf(scene);
    expect(after.length).toBe(3);
    for (const p of after) {
      expect((p.material as Material & { map?: Texture | null }).map).toBe(texture);
      expect(p.material).not.toBe(subject.material);
    }
    // Rebuilt panels are UV-windowed per slice, and the SAME seek re-applied
    // the scrubbed pose (a hinge is engaged at scroll=0.6).
    const uvOf = (m: Mesh) =>
      Array.from(m.geometry.attributes.uv.array as ArrayLike<number>).join(',');
    expect(uvOf(after[0])).not.toBe(uvOf(after[1]));
    expect(Math.abs(hingeOf(scene, 0).rotation.y)).toBeGreaterThan(0.5);

    // A whole-material swap (applyImageSpec upgrade) also rebuilds.
    const texture2 = new DataTexture(new Uint8Array([90, 160, 200, 255]), 1, 1, RGBAFormat);
    texture2.needsUpdate = true;
    subject.material = new MeshBasicMaterial({ map: texture2, transparent: true });
    inst.seek(0);
    for (const p of panelMeshesOf(scene)) {
      expect((p.material as Material & { map?: Texture | null }).map).toBe(texture2);
    }

    // Stability: with no further source change, seeks do NOT rebuild.
    const stable = panelMeshesOf(scene).map((m) => m.uuid);
    inst.seek(0);
    expect(panelMeshesOf(scene).map((m) => m.uuid)).toEqual(stable);

    // Dispose never touches the subject's texture.
    let texDisposed = 0;
    texture2.addEventListener('dispose', () => texDisposed++);
    inst.dispose();
    expect(texDisposed).toBe(0);
    expect((subject.material as MeshBasicMaterial).map).toBe(texture2);
  });

  it('fold group tracks the subject LIVE transform each seek (co-bindings tilt the hidden subject)', () => {
    const { target, subject } = makeTexturedTarget(2, 1);
    const inst = scrollFoldScrubPrimitive.create(target);
    const group = foldGroupOf(target.scene);

    // A co-binding moves/tilts/scales the subject AFTER create.
    subject.position.set(0.4, -0.2, 0.64);
    subject.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -0.122);
    subject.scale.set(1.1, 1.1, 1);

    target.userData.scroll = 0.5;
    inst.seek(0);

    expect(group.position.x).toBeCloseTo(subject.position.x, 6);
    expect(group.position.y).toBeCloseTo(subject.position.y, 6);
    expect(group.position.z).toBeCloseTo(subject.position.z, 6);
    expect(group.quaternion.x).toBeCloseTo(subject.quaternion.x, 6);
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

  it('contact shading darkens folding leaves multiplicatively (subject tone, crease-darkest); folded stack stays legible', () => {
    const { target } = makeTexturedTarget(2, 1);
    const inst = scrollFoldScrubPrimitive.create(target);

    target.userData.scroll = 1;
    inst.seek(0);

    const panels = panelMeshesOf(target.scene);
    const leaf = panels.find((p) => p.name === 'fold-scrub-panel-0')!;
    const center = panels.find((p) => p.name === 'fold-scrub-panel-1')!;

    // Fully folded leaf, shade=0.4 default. Crease shade m(h) = 1 - shade*(1 -
    // 0.7h) => 0.6 at the hinge. A uniform whole-leaf BODY dim (the leaf falls
    // into shadow as it tilts away) = LEAF_BODY_SHADE*shade*w = 0.72*0.4 = 0.288
    // floors the free-edge multiplier at 1-0.288 = 0.712. The shade channel is a
    // MULTIPLIER over the subject's own look — no invented color.
    const r = colorRange(leaf);
    expect(r.min).toBeCloseTo(0.6, 5); // darkest at the crease
    expect(r.max).toBeCloseTo(0.712, 5); // free edge: floored by the body dim

    // BOOK-GUTTER CONTACT SHADOW (advocate MF1): with both adjacent leaves
    // folded the center ANCHOR is now darkened down BOTH creases — the largest
    // lit band near the gutter. It is still a MULTIPLIER over the subject tone
    // (≤ 1, never an invented color) and the card stays legible (no black-out).
    const rc = colorRange(center);
    expect(rc.min, 'anchor darkens near the gutter').toBeLessThan(0.95);
    expect(rc.min, 'gutter is a contact shadow, not a black-out').toBeGreaterThan(0.4);
    expect(rc.max, 'anchor never brightens past base').toBeLessThanOrEqual(1.000001);

    // Control reshapes the pinned frame with NO fresh seek (onParamChange):
    // raising shade deepens BOTH the leaf crease AND the anchor gutter.
    const anchorMinBefore = colorRange(center).min;
    inst.setControl('shade', 0.8);
    expect(colorRange(leaf).min).toBeCloseTo(0.2, 5);
    expect(colorRange(center).min, 'higher shade deepens the gutter').toBeLessThan(
      anchorMinBefore,
    );

    // Legible stacked card at full fold: every panel visible, nothing faded.
    for (const p of panels) {
      expect(p.visible).toBe(true);
      expect((p.material as Material).opacity).toBe(1);
    }
    // The center anchor still sits in the fold group at the subject's spot.
    expect(center.parent?.name).toBe('fold-scrub-group');

    // Unfold flat again: ALL shading clears exactly — leaf AND anchor gutter
    // (idle frame = pure subject, no adjacent fold ⇒ no contact shadow).
    target.userData.scroll = 0;
    inst.seek(0);
    const flat = colorRange(leaf);
    expect(flat.min).toBeCloseTo(1, 6);
    expect(flat.max).toBeCloseTo(1, 6);
    const flatCenter = colorRange(center);
    expect(flatCenter.min).toBeCloseTo(1, 6);
    expect(flatCenter.max).toBeCloseTo(1, 6);

    inst.dispose();
  });

  it('no-map card panel: panel clones carry the panel color AND PBR scalars (catalog card path)', () => {
    const target = makeTarget(scrollFoldScrubPrimitive);
    const subjMat = (target.subject as Mesh).material as MeshStandardMaterial;
    const inst = scrollFoldScrubPrimitive.create(target);

    const panels = panelMeshesOf(target.scene);
    expect(panels.length).toBe(3);
    for (const p of panels) {
      const mat = p.material as MeshStandardMaterial;
      expect(mat, 'clone, not the original').not.toBe(subjMat);
      expect(mat.color.getHex()).toBe(subjMat.color.getHex());
      expect(mat.emissive.getHex()).toBe(subjMat.emissive.getHex());
      expect(mat.roughness).toBe(subjMat.roughness);
      expect(mat.metalness).toBe(subjMat.metalness);
      expect(mat.envMapIntensity).toBe(subjMat.envMapIntensity);
      expect(mat.map ?? null).toBeNull();
    }
    inst.dispose();
  });

  it('CHROME CO-TREATMENT: the card chrome (header/dot/rows) rides the fold as per-leaf clones, not a blank panel', () => {
    // The catalog subject is the card: a dark RoundedBox panel + brass header,
    // accent dot, three grey rows parented to it. The advocate flagged a
    // FEATURELESS TAN SLAB — the chrome was never visible. After the fix every
    // wide bar is clipped per panel slice and the dot is a rigid clone, all
    // PARENTED to the slice panel meshes so they fold WITH the leaves.
    const target = makeTarget(scrollFoldScrubPrimitive);
    const inst = scrollFoldScrubPrimitive.create(target);

    const chromeOf = (root: Object3D): Mesh[] => {
      const out: Mesh[] = [];
      root.traverse((o) => {
        if (o.name.startsWith('fold-scrub-chrome-')) out.push(o as Mesh);
      });
      return out;
    };

    const clones = chromeOf(target.scene);
    // header + row0 + row1 + row2 = 4 wide bars clipped across the slices they
    // overlap (default tri-fold), plus the dot rigid clone on the right leaf.
    expect(clones.length, 'chrome rides the fold').toBeGreaterThanOrEqual(8);
    // At least one clip is a child of a FOLDING leaf panel (slice 0/2), not all
    // parked on the static center — so chrome visibly hinges away.
    const onLeaf = clones.filter((m) => {
      const parent = m.parent;
      return (
        parent?.name === 'fold-scrub-panel-0' || parent?.name === 'fold-scrub-panel-2'
      );
    });
    expect(onLeaf.length, 'chrome sits on the folding leaves').toBeGreaterThan(0);
    // The dot (small chrome) is a rigid clone sharing the subject sphere
    // geometry by reference (never our PlaneGeometry).
    const rigid = clones.filter((m) => m.name.startsWith('fold-scrub-chrome-rigid'));
    expect(rigid.length, 'the dot is a rigid clone').toBeGreaterThanOrEqual(1);

    // Every chrome clone carries the child's OWN tone (brass/violet/grey),
    // never an invented fill — material is a clone, never the subject's own.
    const dot = target.subject!.getObjectByName('card-dot') as Mesh;
    const dotMat = dot.material as MeshStandardMaterial;
    for (const m of rigid) {
      const mat = m.material as MeshStandardMaterial;
      expect(mat).not.toBe(dotMat);
      expect(mat.color.getHex()).toBe(dotMat.color.getHex());
    }

    inst.dispose();
    // After dispose nothing of ours survives in the scene.
    expect(chromeOf(target.scene).length, 'chrome cleaned up').toBe(0);
  });

  it('SHADE CONTROL reshapes the chrome crease at the engaged fold (not just the dark panel)', () => {
    // MF1: the shade control read as dead on a featureless dark slab. With the
    // chrome riding the fold, the crease shadow multiplies the brass/grey
    // chrome tone — visible at the pinned engaged angle, and re-applied by
    // onParamChange with no fresh seek.
    const target = makeTarget(scrollFoldScrubPrimitive);
    const inst = scrollFoldScrubPrimitive.create(target);

    // Pinned engaged frame (the advocate's controls state ≈ scroll 0.5).
    target.userData.scroll = 0.5;
    inst.seek(0);

    // Find a chrome clip on a FOLDING leaf and read its lit color at low vs
    // high shade — the crease darkening must visibly change it.
    const clipOnLeaf = (): Mesh | null => {
      let found: Mesh | null = null;
      target.scene.traverse((o) => {
        if (found) return;
        const parent = (o as Mesh).parent;
        if (
          o.name.startsWith('fold-scrub-chrome-clip-') &&
          (parent?.name === 'fold-scrub-panel-0' || parent?.name === 'fold-scrub-panel-2')
        ) {
          found = o as Mesh;
        }
      });
      return found;
    };

    const clip = clipOnLeaf();
    expect(clip, 'a chrome clip sits on a folding leaf').not.toBeNull();
    const colorHex = () =>
      ((clip!.material as MeshStandardMaterial).color as Color).getHex();

    inst.setControl('shade', 0); // no crease shadow
    const lowHex = colorHex();
    inst.setControl('shade', 0.8); // full crease shadow — re-applied via onParamChange
    const highHex = colorHex();

    expect(highHex, 'shade visibly darkens the chrome at the engaged fold').not.toBe(lowHex);

    inst.dispose();
  });

  it('BOOK-GUTTER: shade casts a contact shadow onto the STATIONARY center anchor (panel + chrome) at the engaged fold', () => {
    // MF1 residual: shade read DEAD at the pinned engaged frame because the
    // only darkening lived on one partially-folded leaf — a tiny bright sliver.
    // The fix casts a gutter contact shadow down BOTH sides of every active
    // crease onto the center ANCHOR too: a large central band, plus the bright
    // header/rows crossing it darken near the gutter. That band is what makes
    // shade visibly reshape the pinned frame.
    const target = makeTarget(scrollFoldScrubPrimitive);
    const inst = scrollFoldScrubPrimitive.create(target);

    target.userData.scroll = 0.5; // pinned engaged frame
    inst.seek(0);

    const center = panelMeshesOf(target.scene).find(
      (p) => p.name === 'fold-scrub-panel-1',
    )!;
    const centerMinColor = () => {
      const attr = center.geometry.getAttribute('color') as BufferAttribute;
      let min = Infinity;
      for (let i = 0; i < attr.count; i++) min = Math.min(min, attr.getX(i));
      return min;
    };

    // An anchor chrome clip (the header/rows clipped onto the center slice).
    const anchorClip = (): Mesh | null => {
      let found: Mesh | null = null;
      target.scene.traverse((o) => {
        if (found) return;
        if (
          o.name.startsWith('fold-scrub-chrome-clip-') &&
          (o as Mesh).parent?.name === 'fold-scrub-panel-1'
        ) {
          found = o as Mesh;
        }
      });
      return found;
    };
    const clip = anchorClip();
    expect(clip, 'the header/rows clip onto the center anchor').not.toBeNull();
    const clipHex = () => (clip!.material as MeshStandardMaterial).color.getHex();

    // shade=0 ⇒ NO gutter: anchor panel is pristine base (1.0), chrome at base.
    inst.setControl('shade', 0);
    expect(centerMinColor(), 'no gutter when shade=0').toBeCloseTo(1, 5);
    const clipLow = clipHex();

    // shade=0.8 ⇒ the gutter band darkens the anchor panel AND its near-crease
    // chrome — re-applied via onParamChange, no fresh seek.
    inst.setControl('shade', 0.8);
    expect(centerMinColor(), 'gutter darkens the anchor panel band').toBeLessThan(0.85);
    expect(centerMinColor(), 'but stays legible — contact shadow, not a black-out').toBeGreaterThan(0.3);
    const clipHigh = clipHex();
    expect(clipHigh, 'gutter darkens the anchor chrome near the crease').not.toBe(clipLow);

    // Flat (scroll=0): no adjacent fold ⇒ the gutter clears to exactly base.
    target.userData.scroll = 0;
    inst.seek(0);
    expect(centerMinColor(), 'gutter clears flat').toBeCloseTo(1, 5);

    inst.dispose();
  });

  it('panel geometry derives from the measured subject bbox (resize the subject, panels follow)', () => {
    const small = makeTexturedTarget(2, 1);
    const big = makeTexturedTarget(4, 2);
    const instSmall = scrollFoldScrubPrimitive.create(small.target);
    const instBig = scrollFoldScrubPrimitive.create(big.target);

    const sizeOf = (m: Mesh) => {
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox!;
      return { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y };
    };
    const sSmall = sizeOf(panelMeshesOf(small.target.scene)[0]);
    const sBig = sizeOf(panelMeshesOf(big.target.scene)[0]);

    // Tri-fold => panel width = W/3, full subject height. Never world units.
    expect(sSmall.w).toBeCloseTo(2 / 3, 5);
    expect(sSmall.h).toBeCloseTo(1, 5);
    expect(sBig.w).toBeCloseTo(4 / 3, 5);
    expect(sBig.h).toBeCloseTo(2, 5);

    instSmall.dispose();
    instBig.dispose();
  });

  it('dispose restores everything and releases every created resource (subject resources untouched)', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    const inst = scrollFoldScrubPrimitive.create(target);

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

    const first = panelMeshesOf(target.scene);
    expect(first.length).toBe(3);
    watch(first);

    // Structural rebuild via 'panels' disposes the original set…
    inst.setControl('panels', '4');
    expect(disposedCount).toBe(3 * 2);
    const rebuilt = panelMeshesOf(target.scene);
    expect(rebuilt.length).toBe(4);
    watch(rebuilt);

    // …and dispose() releases the rebuilt set too: count matches exactly.
    inst.dispose();
    expect(disposedCount).toBe(3 * 2 + 4 * 2);

    // Subject material/texture NEVER disposed (texture shared by reference).
    expect(subjectDisposed).toBe(0);

    // Nothing of ours is left anywhere in the scene.
    let leftover = 0;
    target.scene.traverse((o) => {
      if (
        o.name === 'fold-scrub-group' ||
        o.name.startsWith('fold-scrub-panel-') ||
        o.name.startsWith('fold-scrub-hinge-')
      )
        leftover++;
    });
    expect(leftover).toBe(0);
    expect(subject.visible).toBe(true);
  });

  it('degenerate subject (nothing to decompose): no overlays spawned, whole-subject lean fold, exact restore', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Group(); // no meshes, no materials
    subject.name = 'empty-artifact';
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0 },
    };

    const inst = scrollFoldScrubPrimitive.create(target);
    expect(panelMeshesOf(scene).length, 'no overlay panels spawned').toBe(0);
    expect(subject.visible, 'fallback never hides the subject it animates').toBe(true);

    target.userData.scroll = 0;
    inst.seek(0);
    const rotEarly = subject.rotation.x;
    target.userData.scroll = 1;
    inst.seek(0);
    expect(Math.abs(subject.rotation.x - rotEarly), 'whole subject lean-folds').toBeGreaterThan(0.1);

    inst.dispose();
    expect(subject.rotation.x).toBeCloseTo(0, 6);
  });
});
