// Shared WebGPU renderer factory for catalog preview tiles. Mirrors
// GraphScene's createUnifiedRenderer (RT-SC-01 / INV-R1): one bundled
// three/webgpu renderer with automatic WebGL2 fallback, async init via R3F v9's
// promise `gl` factory. Node materials (TSL) require this — not the default
// WebGLRenderer.

import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';

export async function createPreviewRenderer(
  props: { canvas?: HTMLCanvasElement } & Record<string, unknown>,
): Promise<THREE.WebGLRenderer> {
  const renderer = new WebGPURenderer({
    canvas: props?.canvas as HTMLCanvasElement | undefined,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  (renderer as unknown as { toneMapping: THREE.ToneMapping }).toneMapping =
    THREE.ACESFilmicToneMapping;
  await renderer.init();
  return renderer as unknown as THREE.WebGLRenderer;
}
