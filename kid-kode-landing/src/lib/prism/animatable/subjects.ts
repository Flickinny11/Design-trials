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
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  Color,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { SubjectKind } from './contract';

const ACCENT = '#5d8bff';
const VIOLET = '#a978ff';
const PANEL = '#1b2444';
const INK = '#0b1124';

export interface BuiltSubject {
  /** Group the primitive owns (added to the stage by the host). */
  object: Group;
  /** Reference subject child, or null for 'empty'. */
  subject: Object3D | null;
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

/** Build the named subject. Returns the owning group + the subject handle. */
export function buildSubject(kind: SubjectKind): BuiltSubject {
  const object = new Group();
  object.name = 'primitive-root';

  switch (kind) {
    case 'card': {
      // A representative UI card: a rounded, depth-rich panel with a header bar,
      // an accent dot, and three content rows — not a bare quad. The panel is
      // the `subject` mesh; chrome is parented to it so it moves/fades together.
      const w = 1.74;
      const h = 1.12;
      const panel = new Mesh(
        new RoundedBoxGeometry(w, h, 0.14, 6, 0.1),
        panelMaterial(PANEL, '#101a3a', 0.42),
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
        const row = chromeBar(rw, 0.072, '#33406a', {
          emissive: '#1b2747',
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
          color: new Color('#23304f'),
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
          emissive: new Color('#1a1140'),
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
            emissive: new Color('#0e1838'),
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
