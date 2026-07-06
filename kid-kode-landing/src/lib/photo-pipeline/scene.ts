// PHOTO-PIPELINE — the layered-photo scene assembler (W-PHOTO D2, runtime side).
//
// Reads a CompositeManifest and builds the layered parallax scene the R2 method
// depends on (design-grammar/observations/layered-photo-product-hero.md):
//   • z-order back→front: backdrop · headline · product · shadow · garnish · glow
//   • differentiated parallax: each layer drifts at its own rate on scroll/cursor
//   • slow INDEPENDENT float loops: garnish + product bob on distinct periods/
//     phases so "nothing is static, nothing is fast — alive, not busy"
//   • z-interleaved display type: the headline sits BEHIND the product (a cheap,
//     powerful depth illusion), realised here by the product's z being nearer
//     than the headline z.
//
// Photographic plates are UNLIT (MeshBasicMaterial) — the realism is baked into
// the imagery + detached shadow + grade, not runtime lighting (that is the whole
// point of R2). Browser-safe three only; no sharp, no DOM.

import {
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  type Object3D,
  type Texture,
} from "three";
import type { CompositeLayer, CompositeManifest } from "./types";

const BASE_W = 12; // scene width in world units for a scale-1 layer

export interface SceneMotion {
  /** −1..1 normalized scroll/cursor drive for parallax (0 = rest). */
  drive: number;
  /** Multiplies each layer's parallaxRate. */
  parallaxDepth: number;
  /** Multiplies each layer's float amplitude. */
  floatAmount: number;
  /** Seconds, for the idle float loops. */
  time: number;
}

interface BuiltLayer {
  spec: CompositeLayer;
  mesh: Mesh;
  baseX: number;
  baseY: number;
  texture: Texture | null;
  disposed: boolean;
}

export interface LayeredPhotoScene {
  group: Group;
  layers: BuiltLayer[];
  /** Apply parallax + float for the given motion state. */
  apply(motion: SceneMotion): void;
  dispose(): void;
}

function planeHeightFor(tex: Texture | null): number {
  const img = tex?.image as { width?: number; height?: number } | undefined;
  if (img && img.width && img.height) return img.height / img.width;
  return 0.66; // 3:2 default until the texture lands
}

/** Fetch + parse a committed composite manifest. */
export async function loadCompositeManifest(
  url: string,
): Promise<CompositeManifest> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`composite manifest ${url}: ${res.status}`);
  return (await res.json()) as CompositeManifest;
}

/**
 * Build the layered scene from a manifest. `loadTexture` is injected so the
 * caller can supply a cached loader (NodeContext.textureLoader) or the default.
 */
export function buildLayeredPhotoScene(
  manifest: CompositeManifest,
  opts: { loadTexture?: (url: string) => Promise<Texture> } = {},
): LayeredPhotoScene {
  const group = new Group();
  group.name = `layered-photo:${manifest.id}`;
  const geo = new PlaneGeometry(1, 1);
  const loader = new TextureLoader();
  const loadTexture =
    opts.loadTexture ??
    ((url: string) =>
      new Promise<Texture>((resolve, reject) =>
        loader.load(url, resolve, undefined, reject),
      ));

  const layers: BuiltLayer[] = [];

  for (const spec of manifest.layers) {
    // Headline is MSDF text in the real graph; represented here as a subtle
    // theme-hue emissive guide plane so the z-interleave is visible in the
    // preview (product occludes it). No letterforms are rendered (MSDF law).
    const isPlate = spec.kind !== "headline";
    const mat = new MeshBasicMaterial({
      transparent: true,
      depthWrite: spec.kind === "backdrop",
      opacity: spec.opacity ?? 1,
    });
    if (!isPlate) {
      mat.color.set(manifest.themeHue);
      mat.opacity = 0.18;
    } else {
      // Start tinted near-black so a not-yet-loaded plate reads as scene, not white.
      mat.color.set("#050506");
    }

    const mesh = new Mesh(geo, mat);
    mesh.name = spec.id;
    mesh.position.set(0, 0, spec.z);
    mesh.renderOrder = Math.round((spec.z + 10) * 10); // stable back-to-front order
    const w = BASE_W * spec.scale;
    mesh.scale.set(w, w * (isPlate ? 0.66 : 0.14), 1);
    group.add(mesh);

    const built: BuiltLayer = {
      spec,
      mesh,
      baseX: 0,
      baseY: 0,
      texture: null,
      disposed: false,
    };
    layers.push(built);

    if (isPlate && spec.assetUrl) {
      loadTexture(spec.assetUrl)
        .then((tex) => {
          if (built.disposed) {
            tex.dispose();
            return;
          }
          tex.colorSpace = SRGBColorSpace;
          tex.minFilter = LinearFilter;
          tex.magFilter = LinearFilter;
          built.texture = tex;
          mat.map = tex;
          mat.color.set("#ffffff"); // reveal the true plate
          mat.needsUpdate = true;
          mesh.scale.set(w, w * planeHeightFor(tex), 1);
        })
        .catch(() => {
          /* keep the near-black placeholder on load failure */
        });
    }
  }

  function apply(motion: SceneMotion): void {
    const { drive, parallaxDepth, floatAmount, time } = motion;
    for (const l of layers) {
      const s = l.spec;
      // Differentiated parallax: nearer (higher parallaxRate) layers drift more.
      const px = drive * s.parallaxRate * parallaxDepth * 1.2;
      // Independent idle float loop (garnish + product); phase de-syncs them.
      let fx = 0;
      let fy = 0;
      let rot = 0;
      if (s.float) {
        const w = (2 * Math.PI) / Math.max(0.5, s.float.period);
        fx = Math.sin(time * w + s.float.phase) * s.float.ampX * floatAmount;
        fy =
          Math.cos(time * w * 0.85 + s.float.phase) *
          s.float.ampY *
          floatAmount;
        rot =
          Math.sin(time * w * 0.5 + s.float.phase) *
          s.float.rotate *
          floatAmount;
      }
      l.mesh.position.x = l.baseX + px + fx;
      l.mesh.position.y = l.baseY + fy;
      l.mesh.rotation.z = rot;
    }
  }

  function dispose(): void {
    for (const l of layers) {
      l.disposed = true;
      l.texture?.dispose();
      (l.mesh.material as MeshBasicMaterial).dispose();
      group.remove(l.mesh);
    }
    geo.dispose();
  }

  return { group, layers, apply, dispose };
}

export type { Object3D };
