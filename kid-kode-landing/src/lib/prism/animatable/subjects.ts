// Preview-subject factory. The picker stage builds one of these per tile and
// hands it to the primitive as `target.subject`. Keeping subjects consistent
// makes the gallery read as a coherent catalog.
//
// These are richer than bare quads on purpose (catalog-prep, 2026-06-07): a
// primitive animating a representative *UI element* (a rounded card with a
// header bar and content rows, a depth-rich panel, a glassy sphere, a glyph
// row) reads its motion far more clearly than a flat plane. The shared preview
// rig adds an environment map, so the standard PBR materials below pick up
// reflections and the glass/refraction primitives shine.
//
// Contract preserved: card / plane / sphere expose a SINGLE Mesh as `subject`
// (shimmer/mask-wipe/glass swap `subject.material`; transform primitives read
// `subject.position/scale/rotation`). Decorative chrome on the card is parented
// to that subject mesh so it co-moves under transforms and co-fades under the
// primitives' `materialsOf(subject)` subtree traversal. `text` keeps its
// glyph-child group (per-glyph decomposition). Standard THREE materials render
// fine under WebGPURenderer (three/webgpu); primitives needing TSL node
// materials build their own content into `target.object` (subject:'empty').

import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  Color,
  type Material,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { VOLUMETRIC_DEPTH_ATTR, type SubjectKind } from './contract';
import { createTextObject } from '../text/text-object';
import type { LoadedFontAtlas } from '../text/contract';

const ACCENT = '#cd9f55'; // design-system brass-400 (Observatory Brass)
const VIOLET = '#7d9fb4'; // design-system ice-400 (purple is banned)
const PANEL = '#1d212b'; // design-system graphite family
const INK = '#0b0d13';   // design-system ink

// Injectable MSDF atlas for the 'text' subject (INV-11). A host with async IO
// (the catalog's shared rig) preloads the Inter-400 atlas and injects it here;
// buildSubject('text') then assembles REAL letterforms via createTextObject.
// When no atlas is set (vitest/node, atlas fetch failed) the legacy RoundedBox
// proxy path below is used unchanged.
let textSubjectAtlas: LoadedFontAtlas | null = null;
export function setTextSubjectAtlas(atlas: LoadedFontAtlas | null): void {
  textSubjectAtlas = atlas;
}

export interface BuiltSubject {
  /** Group the primitive owns (added to the stage by the host). */
  object: Group;
  /** Reference subject child, or null for 'empty'. */
  subject: Object3D | null;
}

/** Options threaded from a PrimitiveDefinition into the subject factory.
 *  Additive — every field optional, so legacy `buildSubject(kind)` calls are
 *  unchanged. */
export interface BuildSubjectOptions {
  /** Definition's `volumetric` flag — only meaningful for the 'plane' subject. */
  volumetric?: boolean;
}

// Volumetric slab parameters. A volumetric plane is a single Mesh whose geometry
// is VOL_SLABS coplanar quads stacked back-to-front from z=0 (front) to
// z=-VOL_DEPTH (back), so one swapped material covers the whole stack (the
// primitives swap `subject.material` — the contract is preserved: subject is ONE
// Mesh). Each vertex carries an `aDepth` float (0 front → 1 back). A volumetric
// shader reads it via `attribute('aDepth')` to parallax/fade its field across
// depth. Far-to-near vertex order so a transparent (depthWrite:false) material
// composites correctly painter-style.
const VOL_SLABS = 5;
const VOL_DEPTH = 0.62;
const VOL_SEG = 40;
const VOL_SIZE = 1.8;
// The catalog camera sits at z≈3.2 looking down −z. Rear slabs are further from
// the camera, so under perspective they project SMALLER than the front slab —
// which exposed their rectangular edges as nested "square frame" outlines inside
// the tile. Scaling each slab by (camZ + |z|)/camZ makes every slab cover the
// SAME screen footprint (the front slab's), so the slab edges all land at/outside
// the tile boundary (clipped by the scissor) and the nested-frame banding is gone.
const VOL_CAM_Z = 3.2;

/**
 * Build a multi-slab "volume" geometry for a volumetric plane subject: VOL_SLABS
 * subdivided quads stacked along −z, merged into ONE indexed BufferGeometry with
 * position / normal / uv / `aDepth` attributes. Slabs are emitted far-first so a
 * back-to-front transparent material blends correctly. Hand-merged (no
 * BufferGeometryUtils import) from PlaneGeometry slices.
 */
export function buildVolumetricSlabGeometry(
  size = VOL_SIZE,
  seg = VOL_SEG,
  slabs = VOL_SLABS,
  depth = VOL_DEPTH,
): BufferGeometry {
  const slices: PlaneGeometry[] = [];
  let vertCount = 0;
  let idxCount = 0;
  // Far (i = slabs-1) → near (i = 0): push far slabs first.
  for (let i = slabs - 1; i >= 0; i--) {
    const g = new PlaneGeometry(size, size, seg, seg);
    const z = -depth * (slabs > 1 ? i / (slabs - 1) : 0);
    // Perspective-compensate: enlarge rear slabs so every slab fills the same
    // screen footprint as the front slab (kills the nested-frame slab banding).
    const persp = (VOL_CAM_Z + Math.abs(z)) / VOL_CAM_Z;
    if (persp !== 1) g.scale(persp, persp, 1);
    g.translate(0, 0, z);
    slices.push(g);
    vertCount += g.attributes.position.count;
    idxCount += g.index ? g.index.count : 0;
  }

  const position = new Float32Array(vertCount * 3);
  const normal = new Float32Array(vertCount * 3);
  const uv = new Float32Array(vertCount * 2);
  const aDepth = new Float32Array(vertCount);
  const index = new Uint32Array(idxCount);

  let vOff = 0;
  let iOff = 0;
  // slices[] is already far→near; aDepth = 1 (far) → 0 (near).
  for (let s = 0; s < slices.length; s++) {
    const g = slices[s];
    const pos = g.attributes.position.array as ArrayLike<number>;
    const nor = g.attributes.normal.array as ArrayLike<number>;
    const tex = g.attributes.uv.array as ArrayLike<number>;
    const count = g.attributes.position.count;
    // s = 0 is the farthest slab → depth 1; s = last is nearest → depth 0.
    const dval = slices.length > 1 ? 1 - s / (slices.length - 1) : 0;
    position.set(pos as never, vOff * 3);
    normal.set(nor as never, vOff * 3);
    uv.set(tex as never, vOff * 2);
    for (let k = 0; k < count; k++) aDepth[vOff + k] = dval;
    const gi = g.index!.array as ArrayLike<number>;
    for (let k = 0; k < gi.length; k++) index[iOff + k] = gi[k] + vOff;
    vOff += count;
    iOff += gi.length;
    g.dispose();
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(position, 3));
  geo.setAttribute('normal', new BufferAttribute(normal, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setAttribute(VOLUMETRIC_DEPTH_ATTR, new BufferAttribute(aDepth, 1));
  geo.setIndex(new BufferAttribute(index, 1));
  return geo;
}

/** Premium panel material — metallic-ish so the env map reads as a soft sheen. */
function panelMaterial(color: string, emissive = INK, emissiveIntensity = 0.35): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(color),
    emissive: new Color(emissive),
    emissiveIntensity,
    roughness: 0.32,
    metalness: 0.45,
    envMapIntensity: 1.15,
    transparent: true,
    opacity: 1,
  });
}

/** A thin rounded bar used for the card's header / content rows. */
function chromeBar(
  width: number,
  height: number,
  color: string,
  opts: { emissive?: string; emissiveIntensity?: number; metalness?: number; roughness?: number } = {},
): Mesh {
  const mat = new MeshStandardMaterial({
    color: new Color(color),
    emissive: new Color(opts.emissive ?? color),
    emissiveIntensity: opts.emissiveIntensity ?? 0.5,
    roughness: opts.roughness ?? 0.4,
    metalness: opts.metalness ?? 0.2,
    envMapIntensity: 1.0,
    transparent: true,
    opacity: 1,
  });
  return new Mesh(new RoundedBoxGeometry(width, height, 0.03, 3, 0.014), mat);
}

/** Build the named subject. Returns the owning group + the subject handle.
 *  `opts.volumetric` (additive) upgrades a 'plane' subject to a depth slab
 *  stack; all other kinds ignore it. */
export function buildSubject(kind: SubjectKind, opts: BuildSubjectOptions = {}): BuiltSubject {
  const object = new Group();
  object.name = 'primitive-root';

  if (kind === 'plane' && opts.volumetric) {
    // Volumetric plane: a single Mesh whose geometry is a back-to-front slab
    // stack carrying the `aDepth` attribute. The primitive swaps this mesh's
    // material (contract preserved — subject is ONE Mesh) and reads `aDepth` to
    // give its field real volume. depthWrite:false on the material lets the
    // slabs composite; the volumetric primitives set that on their swapped mat.
    const mesh = new Mesh(
      buildVolumetricSlabGeometry(),
      new MeshStandardMaterial({
        color: new Color('#2a303d'),
        emissive: new Color(ACCENT),
        emissiveIntensity: 0.28,
        roughness: 0.45,
        metalness: 0.25,
        envMapIntensity: 1.1,
        transparent: true,
        depthWrite: false,
      }),
    );
    mesh.name = 'subject';
    mesh.renderOrder = 1;
    mesh.userData.volumetric = true;
    object.add(mesh);
    return { object, subject: mesh };
  }

  switch (kind) {
    case 'card': {
      // A representative UI card: a rounded, depth-rich panel with a header bar,
      // an accent dot, and three content rows — not a bare quad. The panel is
      // the `subject` mesh; chrome is parented to it so it moves/fades together.
      const w = 1.74;
      const h = 1.12;
      const panel = new Mesh(
        new RoundedBoxGeometry(w, h, 0.14, 6, 0.1),
        panelMaterial(PANEL, '#12151d', 0.42),
      );
      panel.name = 'subject';

      const face = 0.072; // just proud of the panel's front face (depth/2 = 0.07)
      const padX = 0.16;
      const innerW = w - padX * 2;

      // Header bar + accent dot.
      const header = chromeBar(innerW * 0.62, 0.12, ACCENT, {
        emissive: ACCENT,
        emissiveIntensity: 0.8,
        metalness: 0.35,
        roughness: 0.3,
      });
      header.position.set(-w / 2 + padX + (innerW * 0.62) / 2, h / 2 - 0.24, face);
      header.name = 'card-header';

      const dot = new Mesh(
        new SphereGeometry(0.052, 24, 16),
        new MeshStandardMaterial({
          color: new Color(VIOLET),
          emissive: new Color(VIOLET),
          emissiveIntensity: 1.1,
          roughness: 0.25,
          metalness: 0.3,
          envMapIntensity: 1.2,
          transparent: true,
        }),
      );
      dot.position.set(w / 2 - padX - 0.05, h / 2 - 0.24, face);
      dot.name = 'card-dot';

      // Three content rows of decreasing width.
      const rowWidths = [innerW, innerW * 0.82, innerW * 0.5];
      const rows = new Group();
      rows.name = 'card-rows';
      rowWidths.forEach((rw, i) => {
        const row = chromeBar(rw, 0.072, '#3a4150', {
          emissive: '#1f242e',
          emissiveIntensity: 0.3,
          metalness: 0.15,
          roughness: 0.55,
        });
        row.position.set(-w / 2 + padX + rw / 2, 0.02 - i * 0.2, face);
        rows.add(row);
      });

      panel.add(header, dot, rows);
      object.add(panel);
      return { object, subject: panel };
    }
    case 'plane': {
      // Subdivided plane for vertex/shader work (wave, caustics, displacement).
      const mesh = new Mesh(
        new PlaneGeometry(1.8, 1.8, 64, 64),
        new MeshStandardMaterial({
          color: new Color('#2a303d'),
          emissive: new Color(ACCENT),
          emissiveIntensity: 0.28,
          roughness: 0.45,
          metalness: 0.25,
          envMapIntensity: 1.1,
          transparent: true,
        }),
      );
      mesh.name = 'subject';
      object.add(mesh);
      return { object, subject: mesh };
    }
    case 'sphere': {
      const mesh = new Mesh(
        new SphereGeometry(0.82, 96, 64),
        new MeshStandardMaterial({
          color: new Color(VIOLET),
          emissive: new Color('#16202b'),
          emissiveIntensity: 0.45,
          roughness: 0.16,
          metalness: 0.5,
          envMapIntensity: 1.4,
          transparent: true,
        }),
      );
      mesh.name = 'subject';
      object.add(mesh);
      return { object, subject: mesh };
    }
    case 'text': {
      if (textSubjectAtlas) {
        // Real MSDF letterforms (INV-11): 'PRISM' decomposed per glyph into
        // unit meshes named glyph-0..4 — the SAME names the text primitives
        // traverse. fontSize 0.565 puts the block at ≈1.71×0.47 scene units
        // (the legacy proxy row footprint, so tile framing is unchanged).
        const handle = createTextObject(
          {
            content: 'PRISM',
            fontSize: 0.565,
            decompose: 'glyph',
            fill: { kind: 'solid', color: ACCENT },
          },
          textSubjectAtlas,
        );
        handle.object.name = 'subject';
        // Legacy proxy look: alternating ice/brass units over the dark
        // emissive so the catalog tiles read consistently.
        handle.units.forEach((unit, i) => {
          const m = unit.material as Material & {
            color: Color;
            emissive: Color;
            emissiveIntensity: number;
          };
          m.color.set(i % 2 ? ACCENT : VIOLET);
          m.emissive.set('#141921');
          m.emissiveIntensity = 0.7;
        });
        object.add(handle.object);
        return { object, subject: handle.object };
      }
      // A row of pseudo-glyph tiles. Production text primitives bind to MSDF
      // glyph coverage (INV-11); the catalog uses rounded glyph meshes to prove
      // the per-glyph decomposition mechanism visibly (now depth-rich, not flat).
      const glyphs = new Group();
      glyphs.name = 'subject';
      const N = 7;
      const gw = 0.2;
      const gap = 0.07;
      const total = N * gw + (N - 1) * gap;
      for (let i = 0; i < N; i++) {
        const g = new Mesh(
          new RoundedBoxGeometry(gw, 0.46, 0.1, 4, 0.04),
          new MeshStandardMaterial({
            color: new Color(i % 2 ? ACCENT : VIOLET),
            emissive: new Color('#141921'),
            emissiveIntensity: 0.7,
            roughness: 0.28,
            metalness: 0.35,
            envMapIntensity: 1.15,
            transparent: true,
          }),
        );
        g.name = `glyph-${i}`;
        g.position.x = -total / 2 + gw / 2 + i * (gw + gap);
        glyphs.add(g);
      }
      object.add(glyphs);
      return { object, subject: glyphs };
    }
    case 'empty':
    default:
      return { object, subject: null };
  }
}
