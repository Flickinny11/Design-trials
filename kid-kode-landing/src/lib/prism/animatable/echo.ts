// echo — clone a subject into an independent copy for multi-cell primitives
// (carousel, loop-column). Geometry + textures stay SHARED by reference (never
// disposed by the echo); only materials are cloned so each cell can carry its
// own opacity/scale without touching the subject's look. Mirrors the deep-echo
// idiom scroll-marquee uses. DOM-free.

import type { Material, Mesh, Object3D } from "three";

export interface Echo {
  root: Object3D;
  materials: Material[];
  /** Set opacity on every cloned material (transparent-enabled). */
  setOpacity(o: number): void;
  /** Dispose ONLY the cloned materials (geometry + textures are the subject's). */
  dispose(): void;
}

/** Build a deep echo of `subject` with cloned materials (shared geometry). */
export function makeEcho(subject: Object3D): Echo {
  const root = subject.clone(true);
  const materials: Material[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || !m.material) return;
    if (Array.isArray(m.material)) {
      m.material = m.material.map((mat) => {
        const c = mat.clone();
        materials.push(c);
        return c;
      });
    } else {
      const c = (m.material as Material).clone();
      materials.push(c);
      m.material = c;
    }
  });
  return {
    root,
    materials,
    setOpacity(o: number) {
      for (const mat of materials) {
        (
          mat as Material & { transparent: boolean; opacity: number }
        ).transparent = true;
        (mat as Material & { opacity: number }).opacity = o;
      }
    },
    dispose() {
      for (const mat of materials) mat.dispose();
    },
  };
}
