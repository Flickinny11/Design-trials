// Preview-subject factory. The picker stage builds one of these per tile and
// hands it to the primitive as `target.subject`. Keeping subjects consistent
// makes the gallery read as a coherent catalog.
//
// Standard THREE materials render fine under WebGPURenderer (three/webgpu);
// primitives that need TSL node materials build their own content into
// `target.object` (subject:'empty').

import {
  Group,
  Mesh,
  BoxGeometry,
  PlaneGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  Color,
  type Object3D,
} from 'three';
import type { SubjectKind } from './contract';

const ACCENT = '#5d8bff';
const VIOLET = '#a978ff';

export interface BuiltSubject {
  /** Group the primitive owns (added to the stage by the host). */
  object: Group;
  /** Reference subject child, or null for 'empty'. */
  subject: Object3D | null;
}

function cardMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(ACCENT),
    emissive: new Color('#16224a'),
    emissiveIntensity: 0.6,
    roughness: 0.35,
    metalness: 0.2,
    transparent: true,
    opacity: 1,
  });
}

/** Build the named subject. Returns the owning group + the subject handle. */
export function buildSubject(kind: SubjectKind): BuiltSubject {
  const object = new Group();
  object.name = 'primitive-root';

  switch (kind) {
    case 'card': {
      const mesh = new Mesh(new PlaneGeometry(1.7, 1.05, 1, 1), cardMaterial());
      mesh.name = 'subject';
      object.add(mesh);
      return { object, subject: mesh };
    }
    case 'plane': {
      // Subdivided plane for vertex/shader work (wave, caustics, displacement).
      const mesh = new Mesh(
        new PlaneGeometry(1.8, 1.8, 64, 64),
        new MeshStandardMaterial({
          color: new Color('#23304f'),
          emissive: new Color(ACCENT),
          emissiveIntensity: 0.25,
          roughness: 0.5,
          metalness: 0.1,
          transparent: true,
        }),
      );
      mesh.name = 'subject';
      object.add(mesh);
      return { object, subject: mesh };
    }
    case 'sphere': {
      const mesh = new Mesh(
        new SphereGeometry(0.8, 64, 48),
        new MeshStandardMaterial({
          color: new Color(VIOLET),
          emissive: new Color('#1a1140'),
          emissiveIntensity: 0.5,
          roughness: 0.2,
          metalness: 0.4,
          transparent: true,
        }),
      );
      mesh.name = 'subject';
      object.add(mesh);
      return { object, subject: mesh };
    }
    case 'text': {
      // A row of pseudo-glyph boxes. Production text primitives bind to MSDF
      // glyph coverage (INV-11); the pilot uses placeholder glyph meshes to
      // prove the per-glyph decomposition mechanism visibly.
      const glyphs = new Group();
      glyphs.name = 'subject';
      const N = 7;
      const w = 0.18;
      const gap = 0.07;
      const total = N * w + (N - 1) * gap;
      for (let i = 0; i < N; i++) {
        const g = new Mesh(
          new BoxGeometry(w, 0.42, 0.06),
          new MeshStandardMaterial({
            color: new Color(i % 2 ? ACCENT : VIOLET),
            emissive: new Color('#0e1838'),
            emissiveIntensity: 0.7,
            roughness: 0.3,
            metalness: 0.25,
            transparent: true,
          }),
        );
        g.name = `glyph-${i}`;
        g.position.x = -total / 2 + w / 2 + i * (w + gap);
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
