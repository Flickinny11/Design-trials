// layered-photo-scene — the R2 photographic composite as a catalog primitive
// (W-PHOTO D2). It assembles a CompositeManifest's baked plates into a layered
// parallax scene: backdrop · headline(behind) · product cutout · detached soft
// shadow · floating garnish · glow, each drifting at its OWN parallax rate on
// scroll and floating on its OWN slow idle loop (phase-desynced) — "alive, not
// busy" (design-grammar/observations/layered-photo-product-hero.md). The realism
// is in the SOURCE IMAGERY + detached shadow + baked grade, not geometry, so the
// plates are unlit.
//
// The heavy assembly lives in @/lib/photo-pipeline/scene (buildLayeredPhotoScene);
// this file is the thin catalog wrapper. It builds an immediate 2-plane
// placeholder so seek() has geometry synchronously (the catalog verify harness
// samples before any fetch resolves), then loads the manifest and swaps in the
// full scene. Default manifest = the committed celestia-hero composite.
//
// scroll/card/hard; duration Infinity (stateful, scroll+time driven). No new
// colours: the theme hue comes from the manifest. DOM-free.

import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import type { PrimitiveDefinition } from "../contract";
import { defineAnimatable } from "../base";
import { num, str } from "../contract";
import {
  buildLayeredPhotoScene,
  loadCompositeManifest,
  type LayeredPhotoScene,
} from "@/lib/photo-pipeline/scene";

const DEFAULT_MANIFEST_URL = "/prism-mock/photo/celestia-hero/composite.json";

const SCHEMA = [
  {
    id: "parallaxDepth",
    label: "Parallax depth",
    type: "fader",
    min: 0,
    max: 3,
    step: 0.05,
    default: 1.2,
  },
  {
    id: "floatAmount",
    label: "Float amount",
    type: "fader",
    min: 0,
    max: 3,
    step: 0.05,
    default: 1,
  },
  {
    id: "driftSpeed",
    label: "Idle drift",
    type: "fader",
    min: 0,
    max: 1,
    step: 0.02,
    default: 0.35,
    unit: "x",
  },
] as const;

/** scroll (0..1) → parallax drive (−1..1); gentle time auto-sway when at rest. */
function driveOf(
  userData: Record<string, unknown>,
  t: number,
  driftSpeed: number,
): number {
  const s = userData.scroll;
  if (typeof s === "number" && Number.isFinite(s)) return (s - 0.5) * 2;
  // No scroll bound (catalog tile / time driver): a slow sinusoidal sway so the
  // differentiated parallax is always visible, never frozen.
  return Math.sin(t * driftSpeed) * 0.6;
}

export const layeredPhotoScenePrimitive: PrimitiveDefinition = {
  name: "layered-photo-scene",
  label: "Layered Photo Scene",
  category: "scroll",
  difficulty: "hard",
  subject: "empty", // self-generates the whole composite
  defaultDriver: "scroll",
  schema: SCHEMA,
  description:
    "The R2 photographic method: baked cutout + depth + detached shadow + graded " +
    "plates assembled as a differentiated-parallax layered scene with independent " +
    "idle float loops (alive, not busy).",
  create: defineAnimatable(
    { name: "layered-photo-scene", category: "scroll", schema: SCHEMA },
    (target, params) => {
      const root = new Group();
      root.name = "layered-photo-root";
      target.object.add(root);

      // Immediate placeholder so seek() has geometry before the manifest lands.
      const phGeo = new PlaneGeometry(1, 1);
      const backdrop = new Mesh(
        phGeo,
        new MeshBasicMaterial({ color: "#0a0a0c" }),
      );
      backdrop.scale.set(14, 9, 1);
      backdrop.position.z = -8;
      const proxy = new Mesh(
        phGeo,
        new MeshBasicMaterial({ color: "#3a2c12" }),
      );
      proxy.scale.set(4, 4, 1);
      proxy.position.z = -2.4;
      root.add(backdrop, proxy);

      let scene: LayeredPhotoScene | null = null;
      let lastT = 0;

      // W-TPL (additive): a binding may point at its own composite —
      // `params.manifestUrl` (string) survives resolveParams passthrough.
      // Default unchanged (celestia-hero) so every existing use is untouched.
      const manifestUrl = str(params.manifestUrl, DEFAULT_MANIFEST_URL);
      loadCompositeManifest(manifestUrl)
        .then((manifest) => {
          const built = buildLayeredPhotoScene(manifest);
          root.remove(backdrop, proxy);
          backdrop.geometry.dispose();
          (backdrop.material as MeshBasicMaterial).dispose();
          (proxy.material as MeshBasicMaterial).dispose();
          root.add(built.group);
          scene = built;
          apply(lastT);
        })
        .catch(() => {
          /* keep the placeholder; the tile still parallaxes the two proxy planes */
        });

      function apply(t: number): void {
        lastT = t;
        const drift = num(params.driftSpeed, 0.35);
        const drive = driveOf(target.userData, t, drift);
        const parallaxDepth = num(params.parallaxDepth, 1.2);
        const floatAmount = num(params.floatAmount, 1);
        if (scene) {
          scene.apply({ drive, parallaxDepth, floatAmount, time: t });
        } else {
          // placeholder differentiated parallax (backdrop slow, proxy fast)
          backdrop.position.x = drive * 0.15 * parallaxDepth;
          proxy.position.x = drive * 0.9 * parallaxDepth;
          proxy.position.y = Math.sin(t * 0.9) * 0.06 * floatAmount;
        }
      }

      return {
        duration: () => Infinity,
        seek: (t: number) => apply(t),
        dispose: () => {
          if (scene) scene.dispose();
          else {
            backdrop.geometry.dispose();
            (backdrop.material as MeshBasicMaterial).dispose();
            (proxy.material as MeshBasicMaterial).dispose();
          }
          target.object.remove(root);
        },
      };
    },
  ),
};
