// Environment IBL — shared PMREM studio-environment builder for the Prism
// Material + Lighting subsystem (PRISM-CANVAS-EDITOR-SPEC §10/§11, tier T0).
//
// This is the canonical IBL implementation for the RUNTIME (scene-root /
// lighting-rig). It mirrors the proven pattern from the catalog preview rig
// (`shared-tile-renderer.ts` `buildEnv()`, which keeps its own copy under the
// editor-scope), where a PMREM RoomEnvironment was shown to be what makes glass
// / transmission / PBR materials read as real glass. The runtime scene-root had
// no IBL at all — so transmissive nodes rendered dark in canvas/preview-app.
// This module gives the runtime that same lit backdrop. (The catalog rig is left
// on its working inline copy on purpose; this is the shared module for new
// runtime/editor consumers — e.g. lighting-rig and HubLighting.)
//
// DOM-free (INV-R12): no document/window access. The renderer is injected. The
// PMREM path needs only a renderer; the procedural fallback is pure data.

import {
  DataTexture,
  EquirectangularReflectionMapping,
  PMREMGenerator,
  type Texture,
} from 'three/webgpu';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Minimal renderer surface PMREMGenerator needs. WebGPURenderer satisfies it. */
export interface IBLRenderer {
  // PMREMGenerator is typed against WebGLRenderer; WebGPURenderer is structurally
  // compatible for the equirect/scene compile path. Cast at the call site.
  [k: string]: unknown;
}

export interface EnvironmentIBLHandle {
  /** The PMREM (or procedural-fallback) environment texture. */
  readonly texture: Texture;
  /** True when PMREM succeeded; false when the procedural fallback was used. */
  readonly fromPMREM: boolean;
  /** Dispose the generated texture. */
  dispose(): void;
}

/**
 * Build a studio IBL environment texture from a `RoomEnvironment` via PMREM.
 * Falls back to a procedural vertical-gradient equirectangular texture if PMREM
 * is unavailable on the active backend (keeps T0 working on any device).
 */
export function buildEnvironmentIBL(renderer: IBLRenderer): EnvironmentIBLHandle {
  let texture: Texture | null = null;
  let fromPMREM = false;
  try {
    const pmrem = new PMREMGenerator(renderer as never);
    // On the three/webgpu build this warm-up awaits renderer.compile()
    // internally and returns a promise — a rejection would otherwise escape
    // this try/catch as an app-level unhandled rejection (P5 finding).
    const warmup = (pmrem as unknown as { compileEquirectangularShader?: () => unknown })
      .compileEquirectangularShader?.();
    if (warmup && typeof (warmup as Promise<unknown>).catch === 'function') {
      (warmup as Promise<unknown>).catch(() => { /* IBL falls back below */ });
    }
    const envScene = new RoomEnvironment();
    texture = pmrem.fromScene(envScene as never, 0.04).texture;
    pmrem.dispose();
    (envScene as unknown as { dispose?: () => void }).dispose?.();
    fromPMREM = true;
  } catch {
    texture = proceduralEnv();
    fromPMREM = false;
  }
  if (!texture) {
    texture = proceduralEnv();
    fromPMREM = false;
  }
  const tex = texture;
  return {
    get texture() {
      return tex;
    },
    fromPMREM,
    dispose() {
      tex.dispose();
    },
  };
}

/**
 * Vertical studio-ish gradient equirect — cool key light at top fading to deep
 * ink at the bottom. Used only when PMREM is unavailable. Pure data; no DOM.
 */
export function proceduralEnv(): Texture {
  const w = 16;
  const h = 64;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const r = Math.round(40 + 150 * Math.pow(1 - v, 1.5));
    const g = Math.round(48 + 150 * Math.pow(1 - v, 1.4));
    const b = Math.round(70 + 170 * Math.pow(1 - v, 1.2));
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, w, h);
  tex.mapping = EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}
