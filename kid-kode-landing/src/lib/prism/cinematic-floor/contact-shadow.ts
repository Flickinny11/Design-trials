// CINEMATIC-FLOOR — soft contact shadow plate (W-PHOTO D4).
//
// A grounded object needs a soft AMBIENT-OCCLUSION contact shadow where it meets
// its surface — the cue that sells "sitting on something real" (the gap report's
// missing floor for coverflow/carousel). This builds a ground-plane plane with a
// soft radial dark falloff, cheap and lighting-independent. A NODE-LOCAL R1 floor
// piece (DEV-2): the atelier factory (D6) drops one under the watch; the
// `contact-shadow` catalog primitive drops one under any subject.
//
// Browser-safe three (generated DataTexture); no DOM.

import {
  DataTexture,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RGBAFormat,
} from "three";

/** Soft radial dark disc (dark centre → transparent edge) for a contact shadow. */
function contactShadowTexture(size = 128, softness = 1): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      // soft falloff; higher softness spreads the edge out
      const a = Math.pow(Math.max(0, 1 - d), 1.6 + softness);
      const i = (y * size + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export interface ContactShadowOptions {
  /** Plane diameter (world units). */
  size?: number;
  /** Peak darkness 0..1. */
  opacity?: number;
  /** Ground plane Y. */
  y?: number;
  /** 0 = crisp, 2 = very soft. */
  softness?: number;
  /** Lay flat on the ground (default) or face the camera (billboard). */
  ground?: boolean;
}

export interface ContactShadow {
  mesh: Mesh;
  dispose(): void;
}

/** Build a soft contact-shadow plate. Add it to the node group, under the object. */
export function makeContactShadow(
  opts: ContactShadowOptions = {},
): ContactShadow {
  const size = opts.size ?? 3;
  const opacity = opts.opacity ?? 0.55;
  const y = opts.y ?? 0;
  const softness = opts.softness ?? 1;
  const ground = opts.ground ?? true;

  const tex = contactShadowTexture(128, softness);
  const mat = new MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    depthWrite: false,
    side: DoubleSide,
  });
  const geo = new PlaneGeometry(size, size);
  const mesh = new Mesh(geo, mat);
  mesh.name = "contact-shadow";
  if (ground) mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = -1; // draw before the object

  return {
    mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}
