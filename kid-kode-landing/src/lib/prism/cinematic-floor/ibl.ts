// CINEMATIC-FLOOR — IBL / HDRI environment (W-PHOTO D4).
//
// Photoreal PBR needs image-based lighting: a real environment reflected in the
// material, not three point lights. This installs a studio IBL via the repo's
// sanctioned path — a PMREM prefilter of `RoomEnvironment` (no remote HDRI, no
// RGBELoader; honours the zero-remote-asset doctrine). Use on an OWNED canvas
// (the photo-lab, the R1 showcase) or hand the env texture to a node group's
// materials; NEVER by editing the engine SceneRoot/LightingRig (I-ENGINE, DEV-2).
//
// Browser-safe three; the RoomEnvironment + PMREMGenerator are already
// allowlisted (three/examples subpath).

import {
  PMREMGenerator,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface IBLHandle {
  env: Texture;
  dispose(): void;
}

/**
 * Build a studio IBL environment texture from RoomEnvironment via PMREM.
 * `renderer` may be a WebGLRenderer or a WebGPURenderer (both accepted by
 * PMREMGenerator in r184).
 */
export function buildStudioIBL(renderer: WebGLRenderer): IBLHandle {
  const pmrem = new PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, 0.04);
  const env = target.texture;
  return {
    env,
    dispose() {
      target.dispose();
      pmrem.dispose();
    },
  };
}

/**
 * Install a studio IBL on a scene (sets scene.environment + intensity). Returns
 * a handle whose dispose() releases the PMREM target. Owned canvases only.
 */
export function installStudioIBL(
  scene: Scene,
  renderer: WebGLRenderer,
  opts: { intensity?: number } = {},
): IBLHandle {
  const handle = buildStudioIBL(renderer);
  scene.environment = handle.env;
  (scene as unknown as { environmentIntensity?: number }).environmentIntensity =
    opts.intensity ?? 0.9;
  return {
    env: handle.env,
    dispose() {
      if (scene.environment === handle.env) scene.environment = null;
      handle.dispose();
    },
  };
}
